/* ============================================================================
   motion.js — the tier 1 runtime. ~4KB unminified, no dependencies.

   Only does what motion.css genuinely cannot:
     · reveals on engines with no scroll-driven animations (the .m-io fallback)
     · counters, which need real arithmetic
     · line and word splitting, which needs measurement
     · pointer response, which has no CSS equivalent
     · parallax and JS-authored scenes that publish --m-p

   Load it deferred. If it never runs, motion.css has already left every element
   visible and static, which is a correct page.

     <link rel="stylesheet" href="/motion.css">
     <script src="/motion.js" defer></script>

   It self-mounts on DOMContentLoaded. Call Motion.mount(root) again after
   injecting markup.

   Two rules this file exists to obey, because breaking either is invisible in
   review and obvious on a phone:
     1. ONE rAF loop owns every scroll-derived value. Two owners and one of them
        eats the delta.
     2. Nothing written per frame may carry a CSS transition. The transition
        restarts on every write and the value never arrives.
   ========================================================================= */
(function (global) {
  'use strict';

  var reduce = global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = global.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var hasViewTimeline = global.CSS && CSS.supports && CSS.supports('animation-timeline', 'view()');

  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var num = function (el, attr, dflt) {
    var v = parseFloat(el.getAttribute(attr));
    return isNaN(v) ? dflt : v;
  };
  var clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };

  /* one loop, one owner ---------------------------------------------------- */
  var scrollJobs = [];
  var running = false;
  function tick() {
    var vh = global.innerHeight;
    for (var i = 0; i < scrollJobs.length; i++) scrollJobs[i](vh);
    running = false;
  }
  function schedule() {
    if (running) return;
    running = true;
    requestAnimationFrame(tick);
  }

  /* ---------------------------------------------------------------- split -- */
  /* Lines need real line boxes, so this runs after fonts settle. Words are
     cheap and exact. Characters are deliberately not offered: splitting a
     headline per character turns reading into waiting. */
  function split(el) {
    if (el.dataset.mSplitDone) return;
    var mode = el.getAttribute('data-m-split') || 'words';
    var text = el.textContent.replace(/\s+/g, ' ').trim();
    if (!text) return;
    el.dataset.mSplitDone = '1';

    if (mode === 'words') {
      el.textContent = '';
      text.split(' ').forEach(function (w, i) {
        var span = document.createElement('span');
        span.className = 'm-unit';
        span.style.setProperty('--i', i);
        span.textContent = w;
        el.appendChild(span);
        if (i < text.split(' ').length - 1) el.appendChild(document.createTextNode(' '));
      });
      return;
    }

    /* lines: measure where the browser actually broke them */
    el.textContent = '';
    var probes = text.split(' ').map(function (w, i, a) {
      var s = document.createElement('span');
      s.textContent = w + (i < a.length - 1 ? ' ' : '');
      el.appendChild(s);
      return s;
    });
    var lines = [], top = null, cur = null;
    probes.forEach(function (s) {
      var t = Math.round(s.getBoundingClientRect().top);
      if (top === null || Math.abs(t - top) > 2) { top = t; cur = []; lines.push(cur); }
      cur.push(s.textContent);
    });
    el.textContent = '';
    lines.forEach(function (words, i) {
      var mask = document.createElement('span');
      mask.className = 'm-line';
      var inner = document.createElement('span');
      inner.className = 'm-unit';
      inner.style.setProperty('--i', i);
      inner.textContent = words.join('');
      mask.appendChild(inner);
      el.appendChild(mask);
    });
  }

  /* ---------------------------------------------------------------- count -- */
  /* Real numbers only. The target is written exactly as it should render,
     commas included, and the formatting is inferred from it. */
  function count(el) {
    var raw = el.getAttribute('data-m-count') || el.textContent;
    var target = parseFloat(String(raw).replace(/,/g, ''));
    if (isNaN(target)) return;
    var grouped = /,/.test(String(raw)) || target >= 10000;
    var decimals = (String(raw).split('.')[1] || '').length;
    var dur = num(el, 'data-m-count-ms', 1500);
    var prefix = el.getAttribute('data-m-count-prefix') || '';
    var suffix = el.getAttribute('data-m-count-suffix') || '';
    var fmt = function (v) {
      var s = v.toFixed(decimals);
      if (grouped) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return prefix + s + suffix;
    };
    el.style.fontVariantNumeric = 'tabular-nums';

    if (reduce) { el.textContent = fmt(target); return; }
    var t0 = null;
    (function step(ts) {
      if (t0 === null) t0 = ts;
      var p = clamp01((ts - t0) / dur);
      /* ease out hard: most of the distance goes early, the last digits settle */
      el.textContent = fmt(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = fmt(target);
    })(performance.now());
  }

  /* ------------------------------------------------------------- reveals -- */
  /* Only needed where CSS scroll-driven animations are unavailable. Fires once
     and unobserves: content that re-hides on the way back up is a defect. */
  function revealsFallback(root) {
    document.documentElement.classList.add('m-io');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        if (el.hasAttribute('data-m-stagger')) {
          var step = num(el, 'data-m-stagger', 60);
          Array.prototype.slice.call(el.children).forEach(function (c, i) {
            c.style.setProperty('--m-delay', Math.min(i, 8) * step + 'ms');
            c.classList.add('is-in');
          });
        } else {
          el.classList.add('is-in');
        }
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.01 });

    $$('[data-m~="reveal"], [data-m~="fade"], [data-m~="clip"], [data-m-stagger]', root)
      .forEach(function (el) { io.observe(el); });
  }

  /* ------------------------------------------------------------ parallax -- */
  /* Rate is in hundreds of pixels across the element's whole travel, so the
     effect is independent of screen height. 0.3 to 1.5 is the usable band;
     adjacent planes should differ by 10-30% or it stops reading as depth.
     Never put body copy on one. */
  function parallax(els) {
    if (!els.length || reduce) return;
    scrollJobs.push(function (vh) {
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        var r = el.getBoundingClientRect();
        if (r.bottom < -vh || r.top > vh * 2) continue;
        var p = clamp01((vh - r.top) / (vh + r.height));
        var rate = num(el, 'data-m-rate', 0.6);
        el.style.transform = 'translate3d(0,' + (rate * (p - 0.5) * 100).toFixed(2) + 'px,0)';
      }
    });
  }

  /* -------------------------------------------------------------- scenes -- */
  /* Publishes --m-p from 0 to 1 across the element's visible life, for engines
     without scroll-driven CSS. Descendants read it with calc(). */
  function scenes(els) {
    if (!els.length) return;
    if (hasViewTimeline && !reduce) return;   /* CSS already owns this */
    scrollJobs.push(function (vh) {
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        var r = el.getBoundingClientRect();
        el.style.setProperty('--m-p', clamp01((vh - r.top) / (vh + r.height)).toFixed(4));
      }
    });
  }

  /* ------------------------------------------------------------- pointer -- */
  /* Interpolated toward the pointer, never tracking it directly: direct
     tracking carries no momentum and reads as artificial. Fine pointers only,
     so touch never fires a false hover. */
  function pointer(root) {
    if (!finePointer || reduce) return;

    $$('[data-m~="magnet"]', root).forEach(function (el) {
      var str = num(el, 'data-m-strength', 0.28), x = 0, y = 0, tx = 0, ty = 0, live = false;
      el.addEventListener('pointerenter', function () { live = true; loop(); });
      el.addEventListener('pointerleave', function () { live = false; tx = ty = 0; });
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        tx = (e.clientX - (r.left + r.width / 2)) * str;
        ty = (e.clientY - (r.top + r.height / 2)) * str;
      });
      function loop() {
        x += (tx - x) * 0.18; y += (ty - y) * 0.18;
        el.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0)';
        if (live || Math.abs(x) > 0.1 || Math.abs(y) > 0.1) requestAnimationFrame(loop);
        else el.style.transform = '';
      }
    });

    $$('[data-m~="tilt"]', root).forEach(function (el) {
      var deg = num(el, 'data-m-deg', 6), live = false, rx = 0, ry = 0, trx = 0, tryy = 0;
      el.style.transformStyle = 'preserve-3d';
      el.addEventListener('pointerenter', function () { live = true; loop(); });
      el.addEventListener('pointerleave', function () { live = false; trx = tryy = 0; });
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        tryy = ((e.clientX - r.left) / r.width - 0.5) * 2 * deg;
        trx = -((e.clientY - r.top) / r.height - 0.5) * 2 * deg;
      });
      function loop() {
        rx += (trx - rx) * 0.16; ry += (tryy - ry) * 0.16;
        el.style.transform = 'perspective(900px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)';
        if (live || Math.abs(rx) > 0.05 || Math.abs(ry) > 0.05) requestAnimationFrame(loop);
        else el.style.transform = '';
      }
    });

    /* Publishes --m-mx / --m-my (0-1) on the element, for a light that follows
       the pointer across a surface. Costs nothing if nothing reads it. */
    $$('[data-m~="spot"]', root).forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--m-mx', ((e.clientX - r.left) / r.width).toFixed(3));
        el.style.setProperty('--m-my', ((e.clientY - r.top) / r.height).toFixed(3));
      });
    });
  }

  /* ---------------------------------------------------------------- mount -- */
  function mount(root) {
    root = root || document;

    var splits = $$('[data-m-split]', root);
    if (splits.length) {
      var run = function () { splits.forEach(split); };
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(run);
      else run();
    }

    if (!hasViewTimeline) revealsFallback(root);

    var counters = $$('[data-m~="count"]', root);
    if (counters.length) {
      var cio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          count(e.target);
          cio.unobserve(e.target);
        });
      }, { threshold: 0.5 });
      counters.forEach(function (el) { cio.observe(el); });
    }

    parallax($$('[data-m~="parallax"]', root));
    scenes($$('[data-m~="scene"]', root));
    pointer(root);

    if (scrollJobs.length) {
      global.addEventListener('scroll', schedule, { passive: true });
      global.addEventListener('resize', schedule, { passive: true });
      schedule();
    }
    document.documentElement.classList.add('m-ready');
  }

  global.Motion = { mount: mount, reduce: reduce, hasViewTimeline: hasViewTimeline };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { mount(document); });
  } else {
    mount(document);
  }
})(window);
