/* Self-test for the tier 2 runtime. Run after any change to runtime/motion-gsap.js.
     npm i playwright-core
     node scripts/test-gsap.mjs

   Needs GSAP in demo/vendor/ (gitignored). If it is missing, this fetches it:
     node scripts/test-gsap.mjs --install

   Everything here is a contract the reference promises, so a failure means the
   docs are now lying, not just that a tween looks different.                  */

import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VENDOR = path.join(HERE, '..', 'demo', 'vendor');
const FILES = ['gsap.min.js', 'ScrollTrigger.min.js', 'SplitText.min.js', 'Flip.min.js'];
const GSAP_V = '3.15.0';

if (process.argv.includes('--install') || FILES.some((f) => !fs.existsSync(path.join(VENDOR, f)))) {
  fs.mkdirSync(VENDOR, { recursive: true });
  for (const f of FILES) {
    const dest = path.join(VENDOR, f);
    if (fs.existsSync(dest) && !process.argv.includes('--install')) continue;
    const url = `https://cdn.jsdelivr.net/npm/gsap@${GSAP_V}/dist/${f}`;
    process.stdout.write(`  fetching ${f} … `);
    const r = await fetch(url);
    if (!r.ok) { console.log('FAILED ' + r.status); process.exit(3); }
    fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
    console.log('ok');
  }
}

const CHROME = process.env.CHROME_PATH || '/usr/bin/chromium';
const URL = 'file://' + path.join(HERE, '..', 'demo', 'gsap.html');
const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });

const fails = [];
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails.push(m); };
const settle = (p, ms = 500) => p.waitForTimeout(ms);

/* ─────────────────────────────────────────────────────────── 1. it mounts ── */
console.log('\nMOUNT');
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(URL);
await settle(p, 900);

ok(errs.length === 0, 'no console/page errors  ' + (errs[0] || ''));
ok(await p.evaluate(() => document.documentElement.classList.contains('g-ready')), 'runtime mounted');
ok(await p.evaluate(() => !!(window.MotionGSAP && MotionGSAP.gsap)), 'gsap wired in');

const registered = await p.evaluate(() => Object.keys(MotionGSAP.p));
ok(registered.includes('ScrollTrigger'), `plugins registered: ${registered.join(', ')}`);

/* The house curves must survive the trip into GSAP. A bezier silently falling
   back to power1.out is the exact failure this runtime exists to prevent. */
const curve = await p.evaluate(() => {
  const e = MotionGSAP.devices && MotionGSAP.eases;
  return { out: e.out, sample: null };
});
ok(/cubic-bezier\(0\.2, 0\.8, 0\.2, 1\)/.test(curve.out), 'house curve declared as a real cubic-bezier');

/* ────────────────────────────────────────────── 2. nothing at load, up top ── */
console.log('\nHERO');
const heroMoving = await p.evaluate(() => {
  let n = 0;
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.top > innerHeight || r.bottom < 0) continue;
    for (const a of (el.getAnimations ? el.getAnimations() : [])) {
      const t = a.effect?.getTiming?.() || {};
      if (t.iterations === Infinity) continue;
      if (a.playState === 'running') n++;
    }
  }
  return n;
});
ok(heroMoving === 0, `nothing in the first viewport is still animating after load (${heroMoving})`);

/* ────────────────────────────────────────────────────────── 3. the devices ── */
console.log('\nDEVICES');

const chopUnits = await p.evaluate(() => document.querySelectorAll('#s-chop .g-line, #s-chop .g-word').length);
ok(chopUnits >= 2, `chop split the heading into ${chopUnits} units`);
const chopText = await p.evaluate(() => document.querySelector('#s-chop h2').textContent.replace(/\s+/g, ' ').trim());
ok(/rises from behind its own edge/.test(chopText), 'chop preserved the text (selectable, crawlable)');
const chopShown = await p.evaluate(async () => {
  const el = document.querySelector('#s-chop h2');
  el.scrollIntoView({ block: 'center' });
  await new Promise((r) => setTimeout(r, 1400));
  return Math.min(...[...el.querySelectorAll('.g-line, .g-word')].map((u) => +getComputedStyle(u).opacity));
});
ok(chopShown > 0.95, `every chopped unit arrives (min opacity ${chopShown})`);

/* The first hard rule, enforced by the runtime rather than by the author. */
const heroStill = await p.evaluate(() => {
  const h1 = document.querySelector('h1');
  return { opacity: +getComputedStyle(h1).opacity, split: h1.querySelectorAll('.g-line, .g-word').length };
});
ok(heroStill.opacity > 0.95, 'the first-screen headline is painted, not animated');

const revealed = await p.evaluate(async () => {
  const el = document.querySelector('#s-reveal p[data-g="reveal"]') || document.querySelector('[data-g~="reveal"]');
  el.scrollIntoView({ block: 'center' });
  await new Promise((r) => setTimeout(r, 900));
  return +getComputedStyle(el).opacity;
});
ok(revealed > 0.95, `reveal completes on entry (opacity ${revealed})`);

const counted = await p.evaluate(async () => {
  const el = document.querySelector('[data-g="counter"]');
  el.scrollIntoView({ block: 'center' });
  await new Promise((r) => setTimeout(r, 2200));
  return el.textContent.trim();
});
ok(counted === '3,000', `counter lands exactly on its rendered value ("${counted}")`);

const pinned = await p.evaluate(async () => {
  const s = document.querySelector('#s-pin');
  s.scrollIntoView({ block: 'start' });
  await new Promise((r) => setTimeout(r, 400));
  window.scrollBy(0, innerHeight * 0.8);
  await new Promise((r) => setTimeout(r, 600));
  const stage = s.querySelector('[data-g-stage]');
  return { top: Math.round(stage.getBoundingClientRect().top), spacer: !!s.closest('.pin-spacer') || !!s.querySelector('.pin-spacer') || s.parentElement.classList.contains('pin-spacer') };
});
ok(Math.abs(pinned.top) < 12, `pin holds the stage at the top edge (top ${pinned.top}px)`);

const railMoved = await p.evaluate(async () => {
  const s = document.querySelector('#s-rail');
  s.scrollIntoView({ block: 'start' });
  await new Promise((r) => setTimeout(r, 400));
  window.scrollBy(0, innerHeight * 1.2);
  await new Promise((r) => setTimeout(r, 900));
  const t = s.querySelector('[data-g-track]');
  const m = new DOMMatrixReadOnly(getComputedStyle(t).transform);
  return Math.round(m.m41);
});
ok(railMoved < -40, `rail translates the track on scroll (x ${railMoved}px)`);

/* Scrubbed, so it is sampled at two scroll positions: partway through the
   range and past the end. Asserting one absolute value would just be encoding
   whatever the trigger happened to read on the day the test was written. */
const drawn = await p.evaluate(async () => {
  const svg = document.querySelector('[data-g="draw"]');
  const pth = svg.querySelector('path');
  const off = () => parseFloat(getComputedStyle(pth).strokeDashoffset);
  svg.scrollIntoView({ block: 'end' });
  await new Promise((r) => setTimeout(r, 700));
  const mid = off();
  window.scrollBy(0, innerHeight * 1.2);
  await new Promise((r) => setTimeout(r, 900));
  const len = parseFloat(getComputedStyle(pth).strokeDasharray);
  return { len, mid, end: off() };
});
ok(drawn.len > 0, `draw set a dasharray (${Math.round(drawn.len)}px)`);
ok(drawn.end < drawn.mid, `draw advances with scroll (${Math.round(drawn.mid)} → ${Math.round(drawn.end)})`);
ok(drawn.end < drawn.len * 0.02, `draw completes past the end of its range (${Math.round(drawn.end)} of ${Math.round(drawn.len)})`);

/* Sampled mid-flight, not after. Comparing before/after positions proves only
   that the layout changed, which `display: none` would do on its own. The claim
   under test is that the survivors MOVE, so the tell is a live transform on a
   surviving tile while the tween is still running. */
const flipped = await p.evaluate(async () => {
  document.querySelector('#s-flip').scrollIntoView({ block: 'center' });
  await new Promise((r) => setTimeout(r, 300));
  const b1 = document.querySelector('#flipgrid .tile[data-cat="b"]');
  const restingLeft = Math.round(b1.getBoundingClientRect().left);
  document.querySelector('.filters button[data-filter="b"]').click();
  await new Promise((r) => setTimeout(r, 140));
  const midLeft = Math.round(b1.getBoundingClientRect().left);
  const midTransform = getComputedStyle(b1).transform;
  await new Promise((r) => setTimeout(r, 900));
  const shown = [...document.querySelectorAll('#flipgrid .tile')].filter((t) => getComputedStyle(t).display !== 'none');
  return {
    count: shown.length,
    inFlight: midTransform !== 'none' || midLeft !== restingLeft,
    finalLeft: Math.round(b1.getBoundingClientRect().left),
    finalTransform: getComputedStyle(b1).transform,
  };
});
ok(flipped.count === 4, `flip filtered the grid to ${flipped.count} tiles`);
ok(flipped.inFlight, 'flip animates survivors rather than teleporting them');
ok(flipped.finalTransform === 'none', 'flip cleans its transforms up when it lands');

/* ──────────────────────────────────────────────────── 4. reduced motion ──── */
console.log('\nREDUCED MOTION');
const rctx = await b.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
const rp = await rctx.newPage();
const rErrs = [];
rp.on('pageerror', (e) => rErrs.push(e.message));
await rp.goto(URL);
await settle(rp, 900);

ok(rErrs.length === 0, 'no errors under reduced motion  ' + (rErrs[0] || ''));

const rTriggers = await rp.evaluate(() => (window.ScrollTrigger ? ScrollTrigger.getAll().length : -1));
ok(rTriggers === 0, `no ScrollTriggers are built at all under reduced motion (${rTriggers})`);

const rHidden = await rp.evaluate(async () => {
  const h = document.documentElement.scrollHeight;
  for (let y = 0; y < h; y += Math.round(innerHeight * 0.6)) {
    scrollTo(0, y); await new Promise((r) => setTimeout(r, 60));
  }
  scrollTo(0, 0); await new Promise((r) => setTimeout(r, 300));
  let n = 0;
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (!(el.textContent || '').trim()) continue;
    if (+cs.opacity < 0.05) n++;
  }
  return n;
});
ok(rHidden === 0, `nothing is hidden under reduced motion (${rHidden})`);

const rCounter = await rp.evaluate(() => document.querySelector('[data-g="counter"]').textContent.trim());
ok(rCounter === '3,000', `counter shows its final value immediately ("${rCounter}")`);

const rRail = await rp.evaluate(() => {
  const s = document.querySelector('#s-rail');
  return { overflow: getComputedStyle(s).overflowX, tx: getComputedStyle(s.querySelector('[data-g-track]')).transform };
});
ok(rRail.overflow === 'auto', `rail becomes a real scroll container (overflow-x: ${rRail.overflow})`);
ok(rRail.tx === 'none', 'rail track carries no transform under reduced motion');
await rctx.close();

/* ──────────────────────────────────────────────── 5. degradation, no gsap ── */
console.log('\nDEGRADATION');
const noG = await b.newContext({ viewport: { width: 1280, height: 800 } });
await noG.route('**/vendor/*.js', (r) => r.abort());
const p2 = await noG.newPage();
const p2Errs = [];
p2.on('pageerror', (e) => p2Errs.push(e.message));
await p2.goto(URL);
await settle(p2, 700);

ok(!(await p2.evaluate(() => 'gsap' in window)), 'gsap genuinely blocked');
ok(p2Errs.length === 0, 'runtime does not throw when gsap is absent  ' + (p2Errs[0] || ''));
const bareHidden = await p2.evaluate(() => [...document.querySelectorAll('body *')]
  .filter((e) => (e.textContent || '').trim() && +getComputedStyle(e).opacity < 0.05).length);
ok(bareHidden === 0, `page is fully readable with no gsap at all (${bareHidden} hidden)`);
const bareText = await p2.evaluate(() => document.body.innerText.trim().length);
ok(bareText > 800, `all copy present without gsap (${bareText} chars)`);
await noG.close();

/* ──────────────────────────────────────────────────────────── 6. teardown ── */
console.log('\nTEARDOWN');
const torn = await p.evaluate(async () => {
  const before = ScrollTrigger.getAll().length;
  const hBefore = document.documentElement.scrollHeight;
  MotionGSAP.destroy();
  await new Promise((r) => setTimeout(r, 200));
  return { before, after: ScrollTrigger.getAll().length, hBefore, hAfter: document.documentElement.scrollHeight };
});
ok(torn.before > 0, `${torn.before} ScrollTriggers were live`);
ok(torn.after === 0, `destroy() killed every one (${torn.after} left)`);
ok(torn.hAfter < torn.hBefore, `destroy() removed the pin spacers (${torn.hBefore}px → ${torn.hAfter}px)`);

/* ──────────────────────────────────────────────────────────────── result ── */
console.log('\n' + '─'.repeat(64));
console.log(fails.length ? `${fails.length} FAILED:\n  - ${fails.join('\n  - ')}` : 'all assertions passed');
console.log('─'.repeat(64) + '\n');
await b.close();
process.exit(fails.length ? 1 : 0);
