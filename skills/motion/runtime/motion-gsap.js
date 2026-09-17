/* ============================================================================
   motion-gsap.js — the tier 2 runtime. Set-pieces GSAP can do and CSS cannot.

   This file ships NO GSAP. You provide it, so you own the bundle and the audit
   can see exactly what you paid. Measured on gsap 3.15, bundled and minified:

     gsap core alone ................................ 27.5KB gzipped
     + ScrollTrigger ................................ 45KB gzipped
     + ScrollTrigger + SplitText + Flip ............. 57KB gzipped

   That is the entire JavaScript budget for a marketing route, spent in one
   place. Do not load this file because the page "could use some polish". Load
   it when the page has a set-piece in its motion table that tier 0 and tier 1
   genuinely cannot express, and say so in the PR.

   ── Use ───────────────────────────────────────────────────────────────────

   ESM (bundled, preferred — the bundler sees the cost):

     import { gsap } from 'gsap';
     import { ScrollTrigger } from 'gsap/ScrollTrigger';
     import { SplitText } from 'gsap/SplitText';
     import { MotionGSAP } from './motion-gsap.js';

     MotionGSAP.init({ gsap, plugins: { ScrollTrigger, SplitText } });

   Globals (CDN): load gsap + plugins first, then this file. It finds them.

   ── Contract ──────────────────────────────────────────────────────────────

   Everything runs inside gsap.matchMedia(). Under prefers-reduced-motion the
   runtime does not shorten durations — it never builds the ScrollTriggers at
   all and paints every final state immediately. Reduced motion is a designed
   state, not a fast-forward.

   Everything also runs inside gsap.context(), so MotionGSAP.destroy() removes
   every tween, trigger, pin spacer and inline style this file created. That
   matters on Astro view transitions, in an SPA, and in dev HMR, where the
   usual failure is pin spacers accumulating until the page is twice as tall
   as it should be.

   ── Namespace ─────────────────────────────────────────────────────────────

   Tier 0/1 read `data-m`. This tier reads `data-g`. They are separate on
   purpose so a page can run CSS reveals everywhere and spend GSAP on one
   section. Putting both on ONE element makes a CSS animation and a GSAP tween
   fight over the same transform; init() detects that and tells you.
   ========================================================================= */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MotionGSAP = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* House curves, matching runtime/motion.css and DESIGN-GUIDELINES §5.
     GSAP's named eases are not the same shapes, so they are declared as real
     cubic-beziers rather than approximated with "power2.out". */
  var EASE = {
    out: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    std: 'cubic-bezier(0.4, 0, 0.2, 1)',
    quad: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  };

  var api = {
    gsap: null,
    p: {},          /* registered plugins, by name */
    ctx: null,      /* gsap.context() */
    mm: null,       /* gsap.matchMedia() */
    eases: EASE,       /* the declared cubic-bezier strings */
    ease: null,        /* the sampled functions, after init() */
    version: '1.0.0',
  };

  /* ------------------------------------------------------------- helpers -- */

  function $$(sel, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(sel));
  }
  function attr(el, name, dflt) {
    var v = el.getAttribute(name);
    if (v === null || v === '') return dflt;
    var n = parseFloat(v);
    return isNaN(n) ? v : n;
  }
  function has(el, token) {
    return (' ' + (el.getAttribute('data-g') || '') + ' ').indexOf(' ' + token + ' ') > -1;
  }
  function warn(msg, el) {
    if (typeof console !== 'undefined' && console.warn) console.warn('[motion-gsap] ' + msg, el || '');
  }

  /* Resolve a plugin from what was passed in, or from a global. Returns null
     rather than throwing: a device whose plugin is absent degrades to its
     no-plugin form or skips, and says which. */
  function plugin(name) {
    if (api.p[name]) return api.p[name];
    var g = typeof globalThis !== 'undefined' ? globalThis : null;
    if (g && g[name]) return (api.p[name] = g[name]);
    return null;
  }

  /* The CustomEase-free way to get a real cubic-bezier into GSAP. GSAP parses
     a "cubic-bezier(...)" string natively via CSSPlugin's ease parsing in 3.x,
     but only when CustomEase is registered; otherwise it silently falls back
     to "power1.out" and the page quietly loses its curve vocabulary. So the
     bezier is converted to a sampled function here and nothing is silent. */
  function bezier(str) {
    var m = /cubic-bezier\(([^)]+)\)/.exec(str);
    if (!m) return null;
    var c = m[1].split(',').map(parseFloat);
    var x1 = c[0], y1 = c[1], x2 = c[2], y2 = c[3];
    var bx = function (t) {
      var u = 1 - t;
      return 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t;
    };
    var by = function (t) {
      var u = 1 - t;
      return 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t;
    };
    return function (p) {
      if (p <= 0) return 0;
      if (p >= 1) return 1;
      /* bisection: 18 iterations puts the error under 1e-5, which is well
         below a pixel on any real travel, and costs nothing at build time */
      var lo = 0, hi = 1, t = p, i;
      for (i = 0; i < 18; i++) {
        t = (lo + hi) / 2;
        if (bx(t) < p) lo = t; else hi = t;
      }
      return by(t);
    };
  }

  var easeOut, easeStd, easeQuad;

  /* Never animate something the reader is ALREADY looking at.
     An entrance device on an element that is on screen when the runtime mounts
     paints its final state and skips the tween.

     Two things fall out of one rule:

     · At load it is the skill's first hard rule — nothing on the first screen
       moves — enforced here instead of trusted to the author.
     · When the runtime is LAZY-LOADED on first scroll, it also stops every
       heading the reader has already reached from firing at once, several
       screens deep, the instant the bundle lands. That one is invisible in
       development, where the runtime is always there before the scroll is.

     It is a default, not a ban. A deliberate intro opts in per element:

       <h1 data-g="chop" data-g-at-load="animate">

     …and then owns the LCP cost, which the audit will show. */
  function onScreenAtMount(el) {
    if (el.getAttribute('data-g-at-load') === 'animate') return false;
    var r = el.getBoundingClientRect();
    return r.top < window.innerHeight * 0.92 && r.bottom > 0;
  }

  /* ============================================================ devices == */
  /* Every device takes (el, mm-conditions) and returns nothing. Each one is
     responsible for its own reduced-motion final state. */

  var devices = {};

  /* ---- reveal / stagger -------------------------------------------------
     You already paid for GSAP, so reveals may as well come from it: batching
     means ONE ScrollTrigger for a whole grid instead of one per card, and
     `once: true` means nothing re-hides on the way back up. */
  devices.reveal = function (els, reduced) {
    if (!els.length) return;
    var gsap = api.gsap, ST = plugin('ScrollTrigger');
    if (reduced || !ST) { gsap.set(els, { clearProps: 'all', opacity: 1, y: 0 }); return; }

    var above = els.filter(onScreenAtMount);
    if (above.length) gsap.set(above, { opacity: 1, y: 0 });
    els = els.filter(function (el) { return above.indexOf(el) === -1; });
    if (!els.length) return;

    gsap.set(els, { opacity: 0, y: function (i, el) { return attr(el, 'data-g-rise', 18); } });
    ST.batch(els, {
      start: 'top 88%',
      once: true,
      onEnter: function (batch) {
        gsap.to(batch, {
          opacity: 1, y: 0, duration: 0.62, ease: easeOut,
          /* capped at 8: past that the tail arrives late enough to read as
             broken, which is the same rule the CSS tier enforces with nth-child */
          stagger: { each: 0.05, amount: Math.min(batch.length, 8) * 0.05 },
        });
      },
    });
  };

  devices.staggerGroups = function (groups, reduced) {
    groups.forEach(function (group) {
      var step = attr(group, 'data-g-stagger', 60) / 1000;
      var kids = Array.prototype.slice.call(group.children);
      if (!kids.length) return;
      var gsap = api.gsap, ST = plugin('ScrollTrigger');
      if (reduced || !ST || onScreenAtMount(group)) { gsap.set(kids, { opacity: 1, y: 0 }); return; }
      gsap.set(kids, { opacity: 0, y: attr(group, 'data-g-rise', 16) });
      ST.create({
        trigger: group, start: 'top 85%', once: true,
        onEnter: function () {
          gsap.to(kids, {
            opacity: 1, y: 0, duration: 0.56, ease: easeOut,
            stagger: { each: step, amount: Math.min(kids.length, 8) * step },
          });
        },
      });
    });
  };

  /* ---- chop: the headline that assembles -------------------------------
     SplitText when it is registered (correct line boxes, correct on resize,
     handles nested markup); a word splitter when it is not. Lines by default:
     splitting a headline per character turns reading into waiting.

     The mask wrapper is what makes this read as type rather than as a fade —
     each line rises from behind its own edge. `linesClass` gets the inner
     span; the mask is the parent SplitText creates when mask: 'lines'. */
  devices.chop = function (el, reduced) {
    var gsap = api.gsap, ST = plugin('ScrollTrigger'), SplitText = plugin('SplitText');
    var mode = el.getAttribute('data-g-chop') || 'lines';
    var units;

    if (SplitText) {
      var split = new SplitText(el, {
        type: mode,
        /* Mask whatever is being split, not just lines. Unmasked chars rise
           from below with nothing to rise out of, which reads as the letters
           sliding rather than arriving. */
        mask: mode,
        linesClass: 'g-line',
        wordsClass: 'g-word',
        charsClass: 'g-char',
        /* Re-split on resize, or the line boxes measured at 1440 stay wrapped
           that way at 390 and the mask clips mid-word. */
        autoSplit: true,
      });
      units = split[mode] || split.lines || [el];
    } else {
      units = fallbackSplit(el, mode === 'chars' ? 'words' : mode);
    }
    if (!units.length) return;

    if (reduced || onScreenAtMount(el)) { gsap.set(units, { opacity: 1, yPercent: 0 }); return; }

    var tl = gsap.timeline({
      paused: !!ST,
      defaults: { ease: easeOut },
    });
    tl.from(units, {
      yPercent: 108,          /* past 100 so the descenders clear the mask */
      opacity: 0,
      /* 0.6s with the stagger below puts the last unit home in well under a
         second. Longer than that and a reader scrolling briskly leaves a trail
         of half-assembled headings behind them — which motion-audit.mjs will
         flag as content still at low opacity after a scroll pass, and it is
         right to. */
      duration: 0.6,
      /* Overlapping is what separates this from a stagger. Each line starts
         before the one above lands, so the block assembles as one gesture. */
      stagger: mode === 'chars' ? 0.028 : 0.08,
    });

    if (ST) {
      /* Play on entry — and if the reader has already scrolled clean past it,
         finish instantly instead of assembling a heading nobody is looking at.
         Without the onLeave a brisk scroll leaves a trail of half-built
         headings behind it, every one of them a real element sitting at
         opacity 0 after the scroll has stopped. motion-audit.mjs flags exactly
         that, and it is right to: it is indistinguishable from an entrance
         that never fired. */
      var st = ST.create({
        trigger: el,
        start: 'top 88%',
        end: 'bottom top',
        onEnter: function () { tl.play(); },
        onEnterBack: function () { tl.play(); },
        onLeave: function () { tl.progress(1); st.kill(); },
      });
      /* Created already above the viewport — same reasoning, no animation.
         Measured from the element's own box rather than from st.progress,
         which is not resolved until the trigger's first refresh and so makes
         this a race when the runtime is lazy-loaded mid-scroll. */
      if (el.getBoundingClientRect().bottom < 0) { tl.progress(1); st.kill(); }
    }
  };

  /* Word/line splitter for when SplitText is not in the bundle. Lines need
     real line boxes, so it measures rather than guesses. */
  function fallbackSplit(el, mode) {
    var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text) return [];
    var words = text.split(' ');
    el.textContent = '';

    var probes = words.map(function (w, i) {
      var s = document.createElement('span');
      s.textContent = w + (i < words.length - 1 ? ' ' : '');
      el.appendChild(s);
      return s;
    });

    var out = [];
    if (mode === 'words') {
      probes.forEach(function (s) { s.style.display = 'inline-block'; out.push(s); });
      return out;
    }

    var lines = [], top = null, cur = null;
    probes.forEach(function (s) {
      var t = Math.round(s.getBoundingClientRect().top);
      if (top === null || Math.abs(t - top) > 2) { top = t; cur = []; lines.push(cur); }
      cur.push(s.textContent);
    });
    el.textContent = '';
    lines.forEach(function (w) {
      var mask = document.createElement('span');
      mask.className = 'g-mask';
      mask.style.display = 'block';
      mask.style.overflow = 'hidden';
      mask.style.paddingBottom = '0.12em';   /* descender room, or g/y/p shear */
      mask.style.marginBottom = '-0.12em';
      var inner = document.createElement('span');
      inner.className = 'g-line';
      inner.style.display = 'block';
      inner.textContent = w.join('');
      mask.appendChild(inner);
      el.appendChild(mask);
      out.push(inner);
    });
    return out;
  }

  /* ---- scrub: a timeline the hand drives -------------------------------
     The only zoom, pan or sequence that is not a gimmick, because the reader
     owns the playhead. `scrub: 1` rather than `true` adds a 1s catch-up, which
     is what stops it feeling glued to a trackpad's exact jitter. */
  devices.scrub = function (el, reduced) {
    var gsap = api.gsap, ST = plugin('ScrollTrigger');
    if (!ST) { warn('data-g="scrub" needs ScrollTrigger', el); return; }

    var targets = $$('[data-g-scrub-item]', el);
    if (!targets.length) targets = Array.prototype.slice.call(el.children);
    if (!targets.length) return;

    if (reduced) { gsap.set(targets, { clearProps: 'all' }); return; }

    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: el,
        start: el.getAttribute('data-g-start') || 'top bottom',
        end: el.getAttribute('data-g-end') || 'bottom top',
        scrub: attr(el, 'data-g-catch', 1),
        invalidateOnRefresh: true,
      },
    });

    targets.forEach(function (t) {
      tl.fromTo(t,
        { x: attr(t, 'data-g-from-x', 0), y: attr(t, 'data-g-from-y', 0), scale: attr(t, 'data-g-from-scale', 1), rotate: attr(t, 'data-g-from-rotate', 0) },
        { x: attr(t, 'data-g-to-x', 0), y: attr(t, 'data-g-to-y', 0), scale: attr(t, 'data-g-to-scale', 1), rotate: attr(t, 'data-g-to-rotate', 0), ease: 'none' },
        0);
    });
  };

  /* ---- pin: hold the frame, advance the content ------------------------
     Pinning is fine. Overriding the scroll RATE is not — that breaks keyboard,
     trackpad, and anyone in a hurry. This pins and lets the wheel do its normal
     job; the content advances against a held frame.

     anticipatePin softens the one-frame jump as the pin engages, which is the
     single most common "why does it stutter" report on a pinned section. */
  devices.pin = function (el, reduced) {
    var gsap = api.gsap, ST = plugin('ScrollTrigger');
    if (!ST) { warn('data-g="pin" needs ScrollTrigger', el); return; }

    var stage = el.querySelector('[data-g-stage]') || el.firstElementChild;
    var steps = $$('[data-g-step]', el);
    if (reduced) {
      /* No pin at all. Steps become a normal stacked read, in order. */
      gsap.set(steps, { clearProps: 'all', opacity: 1, position: 'relative' });
      return;
    }

    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: el,
        start: 'top top',
        end: '+=' + (attr(el, 'data-g-hold', 100) * Math.max(steps.length, 1)) + '%',
        pin: stage || true,
        pinSpacing: true,
        anticipatePin: 1,
        scrub: attr(el, 'data-g-catch', 0.8),
        invalidateOnRefresh: true,
      },
    });

    steps.forEach(function (step, i) {
      if (i > 0) tl.fromTo(step, { opacity: 0, y: 28 }, { opacity: 1, y: 0, ease: easeOut }, '>');
      if (i < steps.length - 1) tl.to(step, { opacity: 0, y: -28, ease: easeStd }, '>+=0.35');
    });
  };

  /* ---- rail: the horizontal band ---------------------------------------
     Lateral travel reads as "options" or "range"; vertical reads as "argument".
     Use it for a gallery or a process, never for the page's main thread.

     The distance is measured from real widths on every refresh, because a
     hardcoded x is wrong the moment the font swaps or a card wraps. */
  devices.rail = function (el, reduced) {
    var gsap = api.gsap, ST = plugin('ScrollTrigger');
    if (!ST) { warn('data-g="rail" needs ScrollTrigger', el); return; }

    var track = el.querySelector('[data-g-track]');
    if (!track) { warn('data-g="rail" needs a [data-g-track] child', el); return; }

    if (reduced) {
      /* A real horizontal scroll container: same content, same order, and it
         still works with a keyboard and a trackpad. */
      track.style.transform = 'none';
      el.style.overflowX = 'auto';
      return;
    }

    gsap.to(track, {
      x: function () { return -(track.scrollWidth - el.offsetWidth); },
      ease: 'none',
      scrollTrigger: {
        trigger: el,
        start: 'top top',
        end: function () { return '+=' + (track.scrollWidth - el.offsetWidth); },
        pin: true,
        anticipatePin: 1,
        scrub: attr(el, 'data-g-catch', 0.8),
        invalidateOnRefresh: true,
      },
    });
  };

  /* ---- stack: cards that pile up ---------------------------------------
     Each card sticks, then the next one covers it while the one below scales
     back and dims. Reads as depth, costs one trigger per card, and degrades to
     a plain stacked list. */
  devices.stack = function (el, reduced) {
    var gsap = api.gsap, ST = plugin('ScrollTrigger');
    var cards = $$('[data-g-card]', el);
    if (!cards.length) return;
    if (reduced || !ST) { gsap.set(cards, { clearProps: 'all' }); return; }

    var top = attr(el, 'data-g-top', 80);
    cards.forEach(function (card, i) {
      card.style.position = 'sticky';
      card.style.top = top + i * attr(el, 'data-g-offset', 12) + 'px';
      if (i === cards.length - 1) return;
      gsap.to(card, {
        scale: 0.94,
        filter: 'brightness(0.72)',
        ease: 'none',
        scrollTrigger: {
          trigger: cards[i + 1],
          start: 'top bottom',
          end: 'top ' + (top + 40) + 'px',
          /* a short catch-up rather than scrub:true — enough to smooth trackpad
             jitter, short enough that the card still feels locked to the one
             covering it */
          scrub: 0.3,
          invalidateOnRefresh: true,
        },
      });
    });
  };

  /* ---- draw: an SVG that draws itself ----------------------------------
     DrawSVGPlugin if it is registered; otherwise getTotalLength() and the
     dasharray, which is the same effect for 0 extra bytes and works on any
     path, line, polyline, circle or rect. */
  devices.draw = function (el, reduced) {
    var gsap = api.gsap, ST = plugin('ScrollTrigger'), Draw = plugin('DrawSVGPlugin');
    var paths = $$('path, line, polyline, circle, rect, ellipse', el);
    if (!paths.length) return;

    if (reduced) {
      paths.forEach(function (p) { p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; });
      return;
    }

    if (Draw) {
      gsap.fromTo(paths, { drawSVG: '0%' }, {
        drawSVG: '100%', ease: 'none', stagger: 0.08,
        scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 55%', scrub: 0.6 },
      });
      return;
    }

    paths.forEach(function (p, i) {
      var len = typeof p.getTotalLength === 'function' ? p.getTotalLength() : 0;
      if (!len) return;
      gsap.fromTo(p,
        { strokeDasharray: len, strokeDashoffset: len },
        {
          strokeDashoffset: 0, ease: 'none',
          scrollTrigger: {
            trigger: el,
            start: 'top 80%',
            end: 'bottom 55%',
            scrub: 0.6,
          },
          delay: i * 0.05,
        });
    });
  };

  /* ---- counter ---------------------------------------------------------
     Real numbers or no counter. The target is read from the element's own
     rendered text so the DOM is correct before any script runs and correct if
     none ever does — which is also what a crawler and a reduced-motion reader
     get. snap keeps it on whole units instead of flickering decimals. */
  devices.counter = function (el, reduced) {
    var gsap = api.gsap, ST = plugin('ScrollTrigger');
    var raw = el.getAttribute('data-g-to') || el.textContent || '';
    var target = parseFloat(String(raw).replace(/[^0-9.\-]/g, ''));
    if (isNaN(target)) { warn('data-g="counter" found no number', el); return; }

    var final = el.textContent;
    var prefix = (/^[^\d\-]*/.exec(final) || [''])[0];
    var suffix = (/[^\d]*$/.exec(final) || [''])[0];
    var grouped = /,/.test(final);
    var decimals = (String(target).split('.')[1] || '').length;

    el.style.fontVariantNumeric = 'tabular-nums';
    if (reduced || !ST) { el.textContent = final; return; }

    var obj = { v: 0 };
    var render = function () {
      var s = obj.v.toFixed(decimals);
      if (grouped) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      el.textContent = prefix + s + suffix;
    };

    if (onScreenAtMount(el)) { el.textContent = final; return; }

    ST.create({
      trigger: el, start: 'top 85%', once: true,
      onEnter: function () {
        gsap.to(obj, {
          v: target,
          duration: attr(el, 'data-g-dur', 1.4),
          ease: easeOut,
          snap: decimals ? undefined : { v: 1 },
          onUpdate: render,
          onComplete: function () { el.textContent = final; },
        });
      },
    });
  };

  /* ---- skew: the page leans into its own velocity ----------------------
     Tiny amounts only. 4-7 degrees at full tilt reads as weight; 15 reads as
     a broken page. Clamped, and it always returns to 0 at rest, or a fast
     flick leaves the layout permanently crooked. */
  devices.skew = function (els, reduced) {
    var gsap = api.gsap, ST = plugin('ScrollTrigger');
    if (!els.length || reduced || !ST) { if (els.length) gsap.set(els, { skewY: 0 }); return; }

    var max = 6, setters = els.map(function (el) {
      return gsap.quickTo(el, 'skewY', { duration: 0.42, ease: easeOut });
    });
    var clamp = gsap.utils.clamp(-max, max);

    ST.create({
      onUpdate: function (self) {
        var v = clamp(self.getVelocity() / -260);
        setters.forEach(function (set) { set(v); });
      },
      onRefresh: function () { setters.forEach(function (set) { set(0); }); },
    });
    /* velocity decays to 0 on its own, but only while events keep firing;
       this guarantees the resting state after the last one. */
    var idle;
    window.addEventListener('scroll', function () {
      clearTimeout(idle);
      idle = setTimeout(function () { setters.forEach(function (set) { set(0); }); }, 140);
    }, { passive: true });
  };

  /* ---- magnet: a CTA with real inertia ---------------------------------
     quickTo is in GSAP core, so this needs no plugin and no rAF loop of its
     own — GSAP's single ticker owns it, which is exactly the "one owner"
     rule tier 1 has to enforce by hand.

     Fine pointers only, primary CTA only. A page of magnetic elements is
     unusable, and on touch it fires a hover that never un-hovers. */
  devices.magnet = function (els, reduced) {
    var gsap = api.gsap;
    if (!els.length) return;
    if (reduced || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      gsap.set(els, { x: 0, y: 0 });
      return;
    }
    els.forEach(function (el) {
      var strength = attr(el, 'data-g-strength', 0.3);
      var xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: easeOut });
      var yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: easeOut });
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * strength);
        yTo((e.clientY - (r.top + r.height / 2)) * strength);
      });
      el.addEventListener('pointerleave', function () { xTo(0); yTo(0); });
    });
  };

  /* ---- mask: a pointer-carried reveal ----------------------------------
     Two stacked layers, the top one clipped to a circle under the cursor, so
     moving the pointer wipes between two states of the same composition.
     Publishes nothing to CSS variables per frame — the clip is tweened, so
     GSAP's ticker batches the write. */
  devices.mask = function (els, reduced) {
    var gsap = api.gsap;
    if (!els.length) return;
    els.forEach(function (el) {
      var layer = el.querySelector('[data-g-mask-layer]');
      if (!layer) return;
      if (reduced || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        /* No pointer, no reveal: show the top layer outright rather than
           leaving half the composition permanently unreachable. */
        layer.style.clipPath = 'none';
        return;
      }
      var r0 = attr(el, 'data-g-radius', 130);
      var set = gsap.quickSetter(layer, 'clipPath');
      var state = { x: 50, y: 50, r: 0 };
      var apply = function () {
        set('circle(' + state.r + 'px at ' + state.x + 'px ' + state.y + 'px)');
      };
      gsap.set(layer, { clipPath: 'circle(0px at 50% 50%)' });
      el.addEventListener('pointermove', function (e) {
        var b = el.getBoundingClientRect();
        state.x = e.clientX - b.left;
        state.y = e.clientY - b.top;
        apply();
      });
      el.addEventListener('pointerenter', function () { gsap.to(state, { r: r0, duration: 0.4, ease: easeOut, onUpdate: apply }); });
      el.addEventListener('pointerleave', function () { gsap.to(state, { r: 0, duration: 0.35, ease: easeStd, onUpdate: apply }); });
    });
  };

  /* ---- flip: layout change as a movement, not a jump -------------------
     The one thing on this list with no CSS equivalent at all. Filtering a grid
     normally teleports every surviving card to a new slot; Flip records the
     first layout, lets you make any DOM change you like, and animates the
     difference. Exposed as a method because the DOM change is yours. */
  function flip(targets, mutate, opts) {
    var gsap = api.gsap, Flip = plugin('Flip');
    if (!Flip) { mutate(); return null; }
    if (api.reduced) { mutate(); return null; }
    /* toArray normalises a selector, NodeList or live HTMLCollection. A live
       collection is the trap: it re-queries as the DOM changes, so Flip records
       one set of elements and animates a different one. */
    targets = gsap.utils.toArray(targets);
    var state = Flip.getState(targets, { props: 'opacity' });
    mutate();
    return Flip.from(state, Object.assign({
      duration: 0.62,
      ease: easeOut,
      absolute: true,
      stagger: 0.03,
      onEnter: function (els) { return gsap.fromTo(els, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.42 }); },
      onLeave: function (els) { return gsap.to(els, { opacity: 0, scale: 0.9, duration: 0.3 }); },
    }, opts || {}));
  }

  /* ============================================================== mount == */

  function build(scope, reduced) {
    api.reduced = reduced;

    /* Namespace collision guard. A CSS scroll-driven animation and a GSAP
       tween writing the same transform produce a result neither author
       intended, and it looks like a GSAP bug rather than a markup mistake. */
    $$('[data-g][data-m]', scope).forEach(function (el) {
      warn('element carries both data-m and data-g; the CSS tier and GSAP will fight over its transform. Remove one.', el);
    });

    devices.reveal($$('[data-g~="reveal"]', scope), reduced);
    devices.staggerGroups($$('[data-g-stagger]', scope), reduced);
    $$('[data-g~="chop"]', scope).forEach(function (el) { devices.chop(el, reduced); });
    $$('[data-g~="scrub"]', scope).forEach(function (el) { devices.scrub(el, reduced); });
    $$('[data-g~="pin"]', scope).forEach(function (el) { devices.pin(el, reduced); });
    $$('[data-g~="rail"]', scope).forEach(function (el) { devices.rail(el, reduced); });
    $$('[data-g~="stack"]', scope).forEach(function (el) { devices.stack(el, reduced); });
    $$('[data-g~="draw"]', scope).forEach(function (el) { devices.draw(el, reduced); });
    $$('[data-g~="counter"]', scope).forEach(function (el) { devices.counter(el, reduced); });
    devices.skew($$('[data-g~="skew"]', scope), reduced);
    devices.magnet($$('[data-g~="magnet"]', scope), reduced);
    devices.mask($$('[data-g~="mask"]', scope), reduced);

    document.documentElement.classList.add('g-ready');
  }

  /* ---------------------------------------------------------------- init -- */
  function init(opts) {
    opts = opts || {};
    var g = opts.gsap || (typeof globalThis !== 'undefined' ? globalThis.gsap : null);
    if (!g) {
      warn('no gsap found. Pass it: MotionGSAP.init({ gsap, plugins: { ScrollTrigger } })');
      return null;
    }
    api.gsap = g;

    if (opts.plugins) for (var k in opts.plugins) if (opts.plugins[k]) api.p[k] = opts.plugins[k];

    /* Register whatever is actually present. Registering is idempotent, and
       GSAP warns loudly if a plugin is used unregistered — which is the single
       most common "it works in dev and not in the build" cause, because a
       tree-shaking bundler drops an imported-but-unregistered plugin. */
    var names = ['ScrollTrigger', 'SplitText', 'Flip', 'Observer', 'DrawSVGPlugin',
                 'MorphSVGPlugin', 'MotionPathPlugin', 'ScrollToPlugin', 'InertiaPlugin',
                 'CustomEase', 'TextPlugin', 'ScrambleTextPlugin'];
    var found = [];
    names.forEach(function (n) { var p = plugin(n); if (p) { found.push(n); } });
    if (found.length) g.registerPlugin.apply(g, found.map(function (n) { return api.p[n]; }));

    easeOut = bezier(EASE.out);
    easeStd = bezier(EASE.std);
    easeQuad = bezier(EASE.quad);

    /* Sampled and exposed, so a page authoring its own signature move uses the
       site's curves rather than reaching for "power2.out" and quietly widening
       the vocabulary the audit counts. */
    api.ease = { out: easeOut, std: easeStd, quad: easeQuad };

    var scope = opts.scope || document;

    /* matchMedia is the whole reduced-motion contract: GSAP builds the
       matching branch, and tears down everything the other branch made when
       the preference changes mid-session. A manual `if (reduce)` never
       un-builds, which is why a page that respected the setting at load stops
       respecting it the moment someone toggles it. */
    api.mm = g.matchMedia();
    api.ctx = g.context(function () {
      api.mm.add({
        motion: '(prefers-reduced-motion: no-preference)',
        reduce: '(prefers-reduced-motion: reduce)',
      }, function (ctx) {
        build(scope, !ctx.conditions.motion);
      });
    }, scope === document ? undefined : scope);

    /* Fonts change line boxes, and every pinned or scrubbed distance is
       measured from layout. Without this, a page looks right in dev with a
       warm cache and wrong on a cold load. */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        var ST = plugin('ScrollTrigger');
        if (ST) ST.refresh();
      });
    }

    return api;
  }

  function destroy() {
    if (api.mm) { api.mm.revert(); api.mm = null; }
    if (api.ctx) { api.ctx.revert(); api.ctx = null; }
    var ST = api.p.ScrollTrigger;
    if (ST) ST.getAll().forEach(function (t) { t.kill(); });
    document.documentElement.classList.remove('g-ready');
  }

  api.init = init;
  api.destroy = destroy;
  api.flip = flip;
  api.refresh = function () { var ST = plugin('ScrollTrigger'); if (ST) ST.refresh(); };
  api.devices = devices;

  return api;
});
