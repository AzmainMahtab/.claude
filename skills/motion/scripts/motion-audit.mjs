#!/usr/bin/env node
/**
 * motion-audit.mjs — check a built page for the motion defects that are
 * invisible in review and obvious on a phone.
 *
 *   npm i playwright-core
 *   node motion-audit.mjs http://localhost:4321 [--width 1440] [--mobile]
 *
 * Exits non-zero if anything FAILS, so it drops straight into a quality gate.
 *
 * It checks mechanics, not taste. A page can pass every line here and still be
 * boring: see references/award-bar.md for the other half.
 */

import { chromium } from 'playwright-core';
import fs from 'node:fs';
import zlib from 'node:zlib';

const argv = process.argv.slice(2);
const url = argv.find((a) => !a.startsWith('--'));
if (!url) { console.error('usage: node motion-audit.mjs <url> [--width N] [--mobile]'); process.exit(2); }
const has = (n) => argv.includes('--' + n);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i === -1 ? d : argv[i + 1]; };
const MOBILE = has('mobile');
const W = +flag('width', MOBILE ? 390 : 1440);
const H = +flag('height', MOBILE ? 844 : 900);

const CHROME = process.env.CHROME_PATH ||
  ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
   '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => fs.existsSync(p));
if (!CHROME) { console.error('No Chrome. Set CHROME_PATH.'); process.exit(3); }

const results = [];
const add = (level, name, detail) => results.push({ level, name, detail });

/* Scripted scrolling has to be instant, or it is not measuring what it thinks.
   A page with `scroll-behavior: smooth` — which is most of them — animates
   every window.scrollTo, so successive calls restart the animation and the
   pass silently covers a fraction of the document. Measured on a real build:
   a pass meant to reach 6532px ended at 3256px, and every check that depends
   on "after a full scroll" was reading half a page. Suppressed for the
   duration, then restored. */
const HARD_SCROLL = `
  (() => {
    const el = document.documentElement;
    const prev = el.style.scrollBehavior;
    el.style.setProperty('scroll-behavior', 'auto', 'important');
    return () => { el.style.scrollBehavior = prev; };
  })()`;

async function withHardScroll(target, fn) {
  await target.evaluate(`window.__restoreScroll = ${HARD_SCROLL}`);
  const out = await fn();
  await target.evaluate('window.__restoreScroll && window.__restoreScroll()');
  return out;
}


const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: MOBILE, hasTouch: MOBILE });
const page = await ctx.newPage();

/* collect stylesheet text the reliable way: URLs from responses, re-fetched */
const sheets = new Set();
page.on('response', (r) => { if (r.request().resourceType() === 'stylesheet') sheets.add(r.url()); });

/* script weight, so the tier 2 cost is a measured number rather than a claim */
const scripts = [];
page.on('response', async (r) => {
  if (r.request().resourceType() !== 'script') return;
  const enc = r.headers()['content-encoding'];
  let bytes = +(r.headers()['content-length'] || 0);
  let body = null;
  try { body = await r.body(); } catch { /* opaque */ }
  if (!bytes && body) bytes = body.length;
  /* If the server did not compress it, gzip it here rather than applying a
     ratio: the budget is quoted in gzipped bytes and the two must be the same
     unit or the number is decorative. */
  const transfer = enc ? bytes : (body ? zlib.gzipSync(body, { level: 9 }).length : bytes);
  scripts.push({ url: r.url(), bytes, transfer, compressed: !!enc });
});

const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
await page.waitForTimeout(700);

/* ---------------------------------------------------------- 1. hero at load */
/* Anything running an animation or a transition inside the first viewport at
   load delays the largest paint and steals the one screen you get for free. */
const hero = await page.evaluate(() => {
  const out = [], declared = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.top > innerHeight * 0.9 || r.bottom < 0 || r.width < 4) continue;
    /* A deliberate intro declares itself, the same way the GSAP tier does with
       data-g-at-load. Declared is not free — it is reported, with the reason —
       but it is a decision rather than an accident, and an accident is what
       this check exists to catch. */
    const opted = el.closest('[data-at-load="animate"], [data-g-at-load="animate"]');
    const anims = el.getAnimations ? el.getAnimations() : [];
    for (const a of anims) {
      const t = a.effect && a.effect.getTiming ? a.effect.getTiming() : {};
      /* scroll-driven animations are fine: they are parked, not playing */
      const scrollDriven = a.timeline && a.timeline.constructor &&
        /ScrollTimeline|ViewTimeline/.test(a.timeline.constructor.name);
      if (scrollDriven) continue;
      if (t.iterations === Infinity) continue;           /* ambient loop, judged below */
      if (a.playState === 'running') {
        const label = (el.tagName.toLowerCase()) + (el.className ? '.' + String(el.className).split(' ')[0] : '') +
                 ' · ' + (a.animationName || 'transition');
        (opted ? declared : out).push(label);
      }
    }
  }
  return { out: out.slice(0, 6), declared: [...new Set(declared)].slice(0, 4) };
});
if (hero.out.length) add('FAIL', 'Hero animates at load', hero.out.join(', '));
else if (hero.declared.length) {
  add('warn', `Declared intro on ${hero.declared.length} element(s) in the first viewport`,
    hero.declared.join(', ') + ' — marked data-at-load="animate", so intentional. Check the largest paint is still where it was: an element faded up from zero is not painted until it has some opacity, which moves LCP by the length of the fade. Transform inside a mask does not.');
} else add('pass', 'Nothing in the first viewport animates at load');

/* The same question for GSAP, sampled HERE rather than in the tier 2 block
   below, because that block runs after the scroll pass — by which point an
   entrance tween that fired legitimately halfway down the page is still in
   flight and would read as a hero bug. getAnimations() cannot see GSAP tweens,
   so without this probe nothing on the page catches an untriggered tween. */
const gsapAtLoad = await page.evaluate(() => {
  const G = window.gsap || (window.MotionGSAP && window.MotionGSAP.gsap) || null;
  if (!G) return null;
  return G.globalTimeline.getChildren(true, true, false)
    .filter((t) => t.isActive() && !t.scrollTrigger && !(t.parent && t.parent.scrollTrigger))
    .map((t) => {
      const ts = (t.targets ? t.targets() : []).slice(0, 2)
        .map((x) => (x && x.tagName) ? x.tagName.toLowerCase() + (x.className ? '.' + String(x.className).split(' ')[0] : '') : 'obj');
      return ts.join(', ') + ' · ' + t.duration().toFixed(2) + 's';
    });
});

/* ------------------------------------------------- 2. CSS discipline */
let css = '';
for (const u of [...sheets].slice(0, 30)) {
  /* file:// is not fetchable by the request context, so auditing a local
     fixture would silently see no CSS at all and report a missing
     reduced-motion block that is right there in the file. */
  if (u.startsWith('file://')) {
    try { css += '\n' + fs.readFileSync(new URL(u), 'utf8'); } catch { /* gone */ }
    continue;
  }
  try { const r = await ctx.request.get(u, { timeout: 8000 }); if (r.ok()) css += '\n' + await r.text(); }
  catch { /* unreachable sheet */ }
}
css += '\n' + await page.evaluate(() => {
  let s = '';
  for (const el of document.querySelectorAll('style')) s += el.textContent + '\n';
  for (const sh of document.styleSheets) {
    try { if (!sh.href) s += [...sh.cssRules].map((r) => r.cssText).join('\n'); } catch {}
  }
  return s;
});

const badTransition = [...css.matchAll(/transition(?:-property)?\s*:\s*([^;}]+)/g)]
  .map((m) => m[1].trim())
  .filter((v) => /\b(all|width|height|top|left|right|bottom|margin|padding)\b/.test(v));
if (badTransition.length) {
  const uniq = [...new Set(badTransition)].slice(0, 3);
  add('FAIL', `${badTransition.length} transition(s) on a layout property or \`all\``, uniq.join(' | '));
} else add('pass', 'No transition on layout properties or `all`');

const kfBlocks = css.match(/@keyframes[^{]*\{(?:[^{}]|\{[^{}]*\})*\}/g) || [];
const kfLayout = kfBlocks.filter((b) => /\n?\s*(width|height|top|left|margin|padding)\s*:/.test(b));
if (kfLayout.length) add('FAIL', `${kfLayout.length} @keyframes animate a layout property`, kfLayout[0].slice(0, 70));
else add('pass', `${kfBlocks.length} @keyframes blocks, none animating layout`);

if (!/prefers-reduced-motion/.test(css)) add('FAIL', 'No prefers-reduced-motion block in any stylesheet');
else add('pass', 'prefers-reduced-motion honoured in CSS');

/* curve vocabulary: two or three per site, not nine */
const eases = {};
for (const m of css.matchAll(/cubic-bezier\([^)]+\)|\bease-in-out\b|\bease-out\b|\bease-in\b|\bease\b/g)) {
  const k = m[0].replace(/\s+/g, '');
  eases[k] = (eases[k] || 0) + 1;
}
const curveList = Object.entries(eases).sort((a, b) => b[1] - a[1]);
if (curveList.length > 5) add('warn', `${curveList.length} distinct easing curves`, curveList.slice(0, 6).map(([k, n]) => `${k}×${n}`).join('  '));
else add('pass', `${curveList.length} easing curves: ${curveList.map(([k]) => k).join(', ') || 'none'}`);

if (/\bease-in\b(?!-out)/.test(css)) add('warn', '`ease-in` present', 'It delays the moment the eye is already waiting for. Entrances take ease-out.');

/* durations over a second that are not loops */
const longs = [...css.matchAll(/(?:transition|animation)[^;}]*?(\d+(?:\.\d+)?)s\b/g)]
  .map((m) => parseFloat(m[1])).filter((v) => v > 1 && v < 20);
if (longs.length > 3) add('warn', `${longs.length} declarations over 1s`, 'Anything over 1s that is not an ambient loop is the page talking over the visitor.');

/* ------------------------------------- 3. scroll the page and watch for jank */
const scrollReport = await withHardScroll(page, () => page.evaluate(async () => {
  const frames = [];
  let last = performance.now();
  let stop = false;
  const loop = (t) => { frames.push(t - last); last = t; if (!stop) requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  const h = document.documentElement.scrollHeight;
  for (let y = 0; y < h; y += Math.round(innerHeight * 0.5)) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 110));
  }
  stop = true;
  await new Promise((r) => setTimeout(r, 120));
  const sorted = frames.slice(3).sort((a, b) => a - b);
  return {
    frames: sorted.length,
    median: sorted[Math.floor(sorted.length / 2)] || 0,
    p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
    worst: sorted[sorted.length - 1] || 0,
    long: sorted.filter((f) => f > 32).length,
  };
}));
const jankPct = scrollReport.frames ? (scrollReport.long / scrollReport.frames) * 100 : 0;
if (jankPct > 10) add('FAIL', `${jankPct.toFixed(0)}% of frames over 32ms while scrolling`, `p95 ${scrollReport.p95.toFixed(0)}ms, worst ${scrollReport.worst.toFixed(0)}ms`);
else if (jankPct > 3) add('warn', `${jankPct.toFixed(0)}% of frames over 32ms while scrolling`, `p95 ${scrollReport.p95.toFixed(0)}ms`);
else add('pass', `Scroll holds frame budget (median ${scrollReport.median.toFixed(0)}ms, p95 ${scrollReport.p95.toFixed(0)}ms)`);

/* ------------------------------------------- 4. content that never revealed */
/* An element hidden inside a pinned or scrubbed sequence is a different animal
   from one whose entrance never fired. A pinned step sequence shows one panel
   at a time BY DESIGN, and its mitigation is the reduced-motion branch, which
   is checked separately below. So they are separated here rather than lumped
   into one number that a pinned page can never get to zero. */
const stuck = await page.evaluate(() => {
  const orphan = [], staged = [];
  const inStage = (el) => !!el.closest('.pin-spacer, [data-g~="pin"], [data-g~="scrub"], [data-m~="scene"]');
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) continue;
    if (!(el.textContent || '').trim() && el.tagName !== 'IMG') continue;
    if (+cs.opacity >= 0.05) continue;
    const label = el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : '');
    (inStage(el) ? staged : orphan).push(label);
  }
  return { orphan: [...new Set(orphan)].slice(0, 8), staged: [...new Set(staged)].slice(0, 8) };
});
if (stuck.orphan.length) add('FAIL', `${stuck.orphan.length} element(s) still at opacity 0 after a full scroll`, stuck.orphan.join(', ') + ' — content that never reveals is invisible to readers and to crawlers');
else add('pass', 'No content stuck hidden after a full scroll pass');
if (stuck.staged.length) add('warn', `${stuck.staged.length} element(s) hidden inside a pinned or scrubbed stage`, stuck.staged.join(', ') + ' — legitimate for a sequence, but it only stays legitimate while the reduced-motion branch below is green');

/* -------------------------------------------- 5. will-change discipline */
const wc = await page.evaluate(() => [...document.querySelectorAll('body *')]
  .filter((e) => { const v = getComputedStyle(e).willChange; return v && v !== 'auto'; }).length);
if (wc > 30) add('FAIL', `will-change on ${wc} elements`, 'It is a loan, not a decoration. A page covered in it exhausts compositor memory.');
else if (wc > 12) add('warn', `will-change on ${wc} elements`);
else add('pass', `will-change on ${wc} elements`);

/* ==================================================== 6. the tier 2 audit ==
   Everything below is skipped on a page with no GSAP, which is most pages and
   should stay that way. When GSAP IS present it is the biggest single line on
   the JavaScript budget, so it gets measured rather than assumed. */

const g = await page.evaluate(() => {
  /* Finding GSAP is the hard part, and getting it wrong is silent.
     `window.gsap` only exists when GSAP came from a <script src> — and the
     recommended setup is a bundled ESM import, where there is no global at
     all. An audit that checks only the global reports "no GSAP on this page"
     for every page that did it properly, and skips every check below.

     Three routes, in order of how much they can tell us:
       1. the motion-gsap runtime, which holds gsap and its plugins
       2. the window globals, for a CDN build
       3. the _gsap cache GSAP attaches to every element it has ever touched,
          which proves it is running even when nothing is exposed */
  const RT = window.MotionGSAP;
  const G = window.gsap || (RT && RT.gsap) || null;
  const ST = window.ScrollTrigger || (RT && RT.p && RT.p.ScrollTrigger) || null;

  if (!G) {
    const touched = [...document.querySelectorAll('body *')].some((e) => e._gsap);
    if (!touched) return null;
    return {
      version: 'unknown (bundled, not exposed)',
      plugins: [], opaque: true,
      triggers: 0, pins: 0, hardScrub: 0, noAnticipate: 0,
      spacers: document.querySelectorAll('.pin-spacer').length,
      runtime: false,
    };
  }

  const triggers = ST ? ST.getAll() : [];
  /* gsap.plugins is the INTERNAL property plugin table (css, attr, snap …).
     The registered add-ons live on the globals registry, so that is what is
     reported — otherwise every page reads as "6 plugins" and the number is
     meaningless. */
  const KNOWN = ['ScrollTrigger', 'SplitText', 'Flip', 'Observer', 'DrawSVGPlugin',
    'MorphSVGPlugin', 'MotionPathPlugin', 'ScrollToPlugin', 'ScrollSmoother',
    'InertiaPlugin', 'CustomEase', 'CustomBounce', 'CustomWiggle', 'TextPlugin',
    'ScrambleTextPlugin', 'Physics2DPlugin', 'Draggable', 'EaselPlugin', 'PixiPlugin'];
  const globals = (G.core && G.core.globals) ? G.core.globals() : {};
  const fromRuntime = RT && RT.p ? Object.keys(RT.p) : [];
  return {
    version: G.version,
    plugins: KNOWN.filter((n) => globals[n] || window[n] || fromRuntime.indexOf(n) > -1),
    triggers: triggers.length,
    pins: triggers.filter((t) => t.pin).length,
    hardScrub: triggers.filter((t) => t.scrub === true || t.vars?.scrub === true).length,
    noAnticipate: triggers.filter((t) => t.pin && !t.vars?.anticipatePin).length,
    spacers: document.querySelectorAll('.pin-spacer').length,
    smoother: !!(window.ScrollSmoother && ScrollSmoother.get && ScrollSmoother.get()),
    runtime: !!RT,
  };
});

const jack = await page.evaluate(() => {
  const libs = [];
  if (window.Lenis || document.documentElement.classList.contains('lenis')) libs.push('Lenis');
  if (window.ScrollSmoother && ScrollSmoother.get && ScrollSmoother.get()) libs.push('ScrollSmoother');
  if (window.LocomotiveScroll || document.querySelector('[data-scroll-container]')) libs.push('Locomotive');
  return libs;
});

if (!g) {
  if (jack.length) add('warn', `Smooth-scroll library present with no GSAP: ${jack.join(', ')}`);
  add('pass', 'No GSAP on this page (tier 0/1 only)');
} else {
  const isGsap = (s) => /gsap|scrolltrigger|splittext|flip|observer|drawsvg|morphsvg|motionpath|scrollsmoother|inertia|customease|scrambletext/i.test(s.url);
  const gsapBytes = scripts.filter(isGsap).reduce((n, s) => n + s.transfer, 0);
  const totalBytes = scripts.reduce((n, s) => n + s.transfer, 0);
  const otherBytes = totalBytes - gsapBytes;
  const kb = (n) => (n / 1024).toFixed(0) + 'KB';

  /* 45KB is core + ScrollTrigger, measured on 3.15. Past that you are into
     plugins, and each one needs a row in the motion table to justify it. */
  const overBudget = gsapBytes > 62 * 1024;
  const servedRaw = scripts.filter(isGsap).some((s) => !s.compressed);
  add(overBudget ? 'warn' : 'pass',
    `GSAP ${g.version} · ${kb(gsapBytes)} gzipped of ${kb(totalBytes)} script weight`,
    `plugins: ${g.plugins.length ? g.plugins.join(', ') : 'core only'}` +
    (overBudget ? ' — past the 45KB core + ScrollTrigger baseline. Every plugin needs a row in the motion table.' : '') +
    (servedRaw ? '  [measured by gzipping here: the server sent it uncompressed]' : ''));

  if (g.opaque) {
    add('warn', 'GSAP is running but not reachable from the page',
      'Detected from the _gsap element cache. Neither a global nor the motion-gsap runtime is exposed, so trigger counts, pins, scrub values and plugin list cannot be checked here. Expose the runtime (it already sets globalThis.MotionGSAP) to get the rest of this section.');
  } else {
    add(g.runtime ? 'pass' : 'warn',
      g.runtime ? `motion-gsap runtime in use · ${g.triggers} ScrollTrigger(s), ${g.pins} pinned`
                : `GSAP used directly · ${g.triggers} ScrollTrigger(s), ${g.pins} pinned`,
      g.runtime ? '' : 'Hand-rolled setup: check gsap.matchMedia() and gsap.context() are in it, or reduced motion and teardown are both on you.');
  }

  if (gsapAtLoad && gsapAtLoad.length) add('FAIL', `${gsapAtLoad.length} untriggered GSAP tween(s) playing at load`, gsapAtLoad.slice(0, 3).join(' | ') + ' — a tween with no trigger plays at the reader on arrival');
  else add('pass', 'No untriggered GSAP tweens playing at load');

  if (g.noAnticipate > 0) add('warn', `${g.noAnticipate} pin(s) without anticipatePin`, 'The single most common "why does the pin stutter" cause: the pin engages one frame late.');
  else if (g.pins) add('pass', `All ${g.pins} pin(s) set anticipatePin`);

  if (g.hardScrub > 0) add('warn', `${g.hardScrub} trigger(s) use scrub: true`, 'No catch-up, so it is glued to trackpad jitter. `scrub: 0.6`–`1` is what reads as weight.');

  if (g.spacers > g.pins) add('FAIL', `${g.spacers} pin spacers for ${g.pins} pins`, 'Spacers are leaking — a context was never reverted. On a view transition or in an SPA the page grows on every navigation.');
  else if (g.pins) add('pass', `${g.spacers} pin spacer(s) for ${g.pins} pin(s), no leak`);

  if (jack.length) {
    add('warn', `Scroll rate is overridden by ${jack.join(', ')}`,
      'Pinning is fine; changing the scroll rate is not. It breaks keyboard paging, trackpad momentum and anyone in a hurry, and it is the first thing to remove when a phone feels bad.');
  } else add('pass', 'Scroll rate is untouched — no smooth-scroll hijack');
}

/* ------------------------------------------------- 7. reduced-motion parity */
const rctx = await browser.newContext({ viewport: { width: W, height: H }, reducedMotion: 'reduce' });
const rp = await rctx.newPage();
await rp.goto(url, { waitUntil: 'domcontentloaded' });
await rp.waitForTimeout(600);
const rStuck = await withHardScroll(rp, () => rp.evaluate(async () => {
  const h = document.documentElement.scrollHeight;
  for (let y = 0; y < h; y += Math.round(innerHeight * 0.6)) {
    window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 70));
  }
  window.scrollTo(0, 0); await new Promise((r) => setTimeout(r, 200));
  let n = 0;
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (!(el.textContent || '').trim()) continue;
    if (+cs.opacity < 0.05) n++;
  }
  return n;
}));
if (rStuck > 0) add('FAIL', `${rStuck} element(s) hidden under prefers-reduced-motion`, 'Reduced motion means fewer and gentler, not content that never arrives.');
else add('pass', 'Nothing is hidden under prefers-reduced-motion');

/* The tier 2 version of the same question. Shortening a scrubbed timeline is
   not a reduced-motion state — the reader still has to scroll a pinned section
   to find out whether a paragraph exists. The bar is that the triggers are not
   built at all. */
if (g) {
  const rg = await rp.evaluate(() => {
    const ST = window.ScrollTrigger;
    return { triggers: ST ? ST.getAll().length : 0, pins: ST ? ST.getAll().filter((t) => t.pin).length : 0 };
  });
  if (rg.pins > 0) add('FAIL', `${rg.pins} pin(s) still built under prefers-reduced-motion`, 'A pinned section under reduced motion is still a section the reader must scroll through to read. Build the stacked version instead.');
  else if (rg.triggers > 0) add('warn', `${rg.triggers} ScrollTrigger(s) still built under prefers-reduced-motion`, 'Check each one paints a final state rather than gating content on scroll.');
  else add('pass', 'No ScrollTriggers are built at all under prefers-reduced-motion');
}
await rctx.close();

if (pageErrors.length) add('FAIL', `${pageErrors.length} page error(s)`, pageErrors[0]);

/* ------------------------------------------------------------------ print */
const icon = { pass: '  ✓', warn: '  !', FAIL: '  ✗' };
console.log();
console.log(`motion audit · ${url} · ${W}×${H}${MOBILE ? ' mobile' : ''}`);
console.log('─'.repeat(72));
for (const r of results) {
  console.log(`${icon[r.level]} ${r.name}`);
  if (r.detail) console.log(`      ${r.detail}`);
}
const fails = results.filter((r) => r.level === 'FAIL').length;
const warns = results.filter((r) => r.level === 'warn').length;
console.log('─'.repeat(72));
console.log(fails ? `${fails} FAILED, ${warns} warning(s)` : warns ? `clean, ${warns} warning(s)` : 'clean');
console.log();
console.log('Mechanics only. Whether the motion is any good is award-bar.md §2, axis 4.');
console.log();

await browser.close();
process.exit(fails ? 1 : 0);
