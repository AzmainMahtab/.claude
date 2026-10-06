#!/usr/bin/env node
/**
 * scroll-audit.mjs — audit a built scroll-scrub page for the defects that are
 * invisible in review and expensive on a phone.
 *
 *   npm i playwright-core
 *   node scroll-audit.mjs http://localhost:4321 [--mobile] [--width N] [--json]
 *
 * Exits non-zero if anything FAILS, so it drops straight into a quality gate.
 * It replaces the Lighthouse Performance assertion for these routes — Lighthouse
 * cannot see any of this, and a scroll-scrub page can never score 100 anyway.
 *
 * Run it three ways. Each catches something the others cannot:
 *   node scroll-audit.mjs <url>              desktop payload + seams + SEO
 *   node scroll-audit.mjs <url> --mobile     the tier contract
 *   (reduced motion is exercised automatically inside the mobile pass)
 */

import { chromium } from 'playwright-core';
import { bufferHasMarker, MARKER } from './lib/provenance.mjs';
import fs from 'node:fs';

const argv = process.argv.slice(2);
const url = argv.find((a) => !a.startsWith('--'));
if (!url) { console.error('usage: node scroll-audit.mjs <url> [--mobile] [--width N] [--json]'); process.exit(2); }
const has = (n) => argv.includes('--' + n);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i === -1 ? d : argv[i + 1]; };
const MOBILE = has('mobile');
const JSONOUT = has('json');
const W = +flag('width', MOBILE ? 390 : 1440);
const H = +flag('height', MOBILE ? 844 : 900);

const CHROME = process.env.CHROME_PATH ||
  ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
   '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => fs.existsSync(p));
if (!CHROME) { console.error('No Chrome. Set CHROME_PATH.'); process.exit(3); }

/* Budgets. Mirrors budget.mjs, which checks the same numbers on disk; this one
   checks what the browser actually pulled down, which is the number that counts. */
const CEIL = {
  transferDesktop: 40 * 1024 * 1024,
  transferMobile:  12 * 1024 * 1024,
  firstMotion:     MOBILE ? 2.5 * 1024 * 1024 : 5 * 1024 * 1024,
  engine:          40 * 1024,
  jankPct:         12,
  liveVideos:      MOBILE ? 4 : 6,
};

const results = [];
const add = (level, name, detail) => results.push({ level, name, detail });
const mb = (b) => (b / 1048576).toFixed(1) + ' MB';
const kb = (b) => (b / 1024).toFixed(0) + ' KB';

/* Scripted scrolling has to be instant or it is not measuring what it thinks:
   `scroll-behavior: smooth` animates every scrollTo, so successive calls restart
   the animation and the pass silently covers a fraction of the document. */
const HARD_SCROLL = `
  (() => {
    const el = document.documentElement;
    const prev = el.style.scrollBehavior;
    el.style.setProperty('scroll-behavior', 'auto', 'important');
    return () => { el.style.scrollBehavior = prev; };
  })()`;

const isVideo = (u) => /\.(mp4|webm|mov)(\?|$)/i.test(u);
const isMobileEncode = (u) => /-[mp]\.(mp4|webm)(\?|$)/i.test(u);

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });

async function session({ reducedMotion = 'no-preference', mobile = MOBILE } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: mobile ? 390 : W, height: mobile ? 844 : H },
    isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 3 : 1,
    reducedMotion,
  });
  const page = await ctx.newPage();
  const requests = [];
  const errors = [];
  page.on('response', async (r) => {
    const video = isVideo(r.url());
    let size = 0, placeholder = false;
    try {
      const len = +(r.headers()['content-length'] || 0);
      if (video) {
        /* Video bodies are already buffered by the browser, so reading one costs
           no extra request. `moov` — and the ©cmt atom holding the placeholder
           marker — sits at the front thanks to encode.sh's -movflags +faststart,
           so the first chunk of even a ranged fetch carries it. */
        const buf = await r.body();
        placeholder = bufferHasMarker(buf.subarray(0, 1024 * 1024));
        size = len || buf.length;
      } else {
        size = len || (await r.body()).length;
      }
    } catch (e) {}
    requests.push({ url: r.url(), status: r.status(), size, video, placeholder });
  });
  // Only real JavaScript errors. A failed subresource also surfaces as a console
  // error, and reporting it twice — once as "page error", once as the 404 it
  // actually is — buries the useful message under the useless one.
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/Failed to load resource/i.test(t)) return;
    errors.push(t);
  });
  return { ctx, page, requests, errors };
}

async function fullScroll(page) {
  await page.evaluate(`window.__restore = ${HARD_SCROLL}`);
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = Math.max(200, Math.floor(h / 40));
  for (let y = 0; y <= h; y += step) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(60);
  }
  await page.evaluate('window.__restore && window.__restore()');
}

/* ------------------------------------------------------- main pass -------- */
const { ctx, page, requests, errors } = await session();
await page.goto(url, { waitUntil: 'networkidle' }).catch(() => page.goto(url));

/* --- head / SEO. The original skill shipped title+description and nothing else. */
const head = await page.evaluate(() => {
  const m = (sel, attr = 'content') => { const e = document.querySelector(sel); return e ? e.getAttribute(attr) : null; };
  return {
    title: document.title,
    desc: m('meta[name="description"]'),
    ogTitle: m('meta[property="og:title"]'),
    ogImage: m('meta[property="og:image"]'),
    ogDesc: m('meta[property="og:description"]'),
    twitter: m('meta[name="twitter:card"]'),
    canonical: m('link[rel="canonical"]', 'href'),
    jsonld: !!document.querySelector('script[type="application/ld+json"]'),
    h1s: [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()),
    lang: document.documentElement.lang,
    viewportFit: (m('meta[name="viewport"]') || '').includes('viewport-fit=cover'),
  };
});
if (!head.title) add('FAIL', 'no <title>');
if (!head.desc) add('FAIL', 'no meta description');
if (!head.ogImage) add('FAIL', 'no og:image', 'a scroll page exists to be shared; the poster still is already on disk and costs nothing to reuse');
if (!head.ogTitle) add('warn', 'no og:title');
if (!head.twitter) add('warn', 'no twitter:card');
if (!head.canonical) add('warn', 'no canonical link');
if (!head.jsonld) add('warn', 'no JSON-LD');
if (head.h1s.length !== 1) add('FAIL', `${head.h1s.length} <h1> on the page`, 'the engine emits h2 per scene; the page must own exactly one h1');
if (!head.lang) add('FAIL', 'no lang on <html>');
if (MOBILE && !head.viewportFit) add('warn', 'viewport lacks viewport-fit=cover', 'copy can slide under the notch / home indicator');
if (head.title && head.desc && head.ogImage && head.ogTitle && head.canonical && head.jsonld && head.h1s.length === 1 && head.lang)
  add('pass', 'head is complete', 'title, description, OG, canonical, JSON-LD, one h1, lang');

if (head.ogImage) {
  const r = await page.request.get(new URL(head.ogImage, url).href).catch(() => null);
  if (!r || !r.ok()) add('FAIL', 'og:image does not resolve', head.ogImage + ' — invisible locally, obvious in a link preview');
}

/* --- the accessible text mirror. Under reduced motion the stills are the page. */
const a11y = await page.evaluate(() => {
  const region = document.querySelector('.sw-a11y');
  const scenes = [...document.querySelectorAll('.sw-copy')].length;
  return {
    present: !!region,
    text: region ? region.innerText.trim().length : 0,
    headings: region ? region.querySelectorAll('h2').length : 0,
    scenes,
    stageHidden: document.querySelector('.sw-stage')?.getAttribute('aria-hidden') === 'true',
  };
});
if (!a11y.present) add('FAIL', 'no .sw-a11y text mirror', 'the visual copy is position:fixed and opacity-animated — without the mirror there is no reading order');
else if (a11y.headings < a11y.scenes) add('FAIL', `text mirror has ${a11y.headings} headings for ${a11y.scenes} scenes`);
else if (a11y.text < 80) add('FAIL', 'text mirror is effectively empty', `${a11y.text} chars`);
else add('pass', 'accessible text mirror present', `${a11y.headings} headings, ${a11y.text} chars, in reading order`);
if (!a11y.stageHidden) add('warn', '.sw-stage is not aria-hidden', 'the scene layer is decorative; its meaning lives in the copy');

/* --- focus. A link at opacity 0 is still in the tab order. */
const trap = await page.evaluate(() => {
  const bad = [];
  document.querySelectorAll('.sw-copy').forEach((c, i) => {
    const op = parseFloat(getComputedStyle(c).opacity);
    const focusables = c.querySelectorAll('a[href],button,[tabindex]:not([tabindex="-1"])');
    if (op < 0.5 && focusables.length && !c.inert) bad.push(`copy ${i} (opacity ${op.toFixed(2)}, ${focusables.length} focusable)`);
  });
  return bad;
});
if (trap.length) add('FAIL', `${trap.length} invisible copy block(s) still focusable`, trap.slice(0, 3).join(' | ') + ' — tab lands on a control nobody can see');
else add('pass', 'no focus lands on invisible copy');

/* --- horizontal overflow */
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
if (overflow) add('FAIL', 'page scrolls horizontally');

/* --- broken subresources. A 404 og:image or a missing clip is invisible until
   someone shares the page or scrolls to that scene. Favicon is noise. */
const broken = requests.filter((r) => r.status >= 400 && !/favicon/i.test(r.url));
if (broken.length) add('FAIL', `${broken.length} request(s) failed`, broken.slice(0, 3).map((b) => `${b.status} ${b.url}`).join(' | '));

/* --- provenance. The gate that answers "would a deploy right now ship stand-ins?"
   Bytes and wiring can all be correct while the footage is synthetic, and this is
   the only check that runs against a DEPLOYED url rather than a local directory. */
const fakeServed = requests.filter((r) => r.placeholder);
if (fakeServed.length) {
  add('FAIL', `${fakeServed.length} placeholder clip(s) served`,
    fakeServed.slice(0, 2).map((r) => r.url.split('/').pop()).join(', ') +
    ` — stamped ${MARKER}. Synthetic stand-ins from placeholder.mjs reached the wire; ` +
    'replace them with real renders before shipping.');
}

/* --- engine weight */
const engineBytes = requests.filter((r) => /scrub-engine|\.js(\?|$)/i.test(r.url)).reduce((a, r) => a + r.size, 0);
if (engineBytes > CEIL.engine) add('warn', `${kb(engineBytes)} of JavaScript`, `over ${kb(CEIL.engine)} — bundle and minify it`);

/* --- scrub actually works: seekable must be non-zero or every seek clamps to 0 */
await page.evaluate(`window.__restore = ${HARD_SCROLL}`);
await page.evaluate(() => window.scrollTo(0, window.innerHeight * 0.8));
await page.waitForTimeout(1800);
const scrub = await page.evaluate(() => {
  const vs = [...document.querySelectorAll('video')];
  return vs.map((v) => ({
    src: (v.currentSrc || v.src || '').slice(-60),
    seekEnd: v.seekable && v.seekable.length ? v.seekable.end(0) : 0,
    dur: v.duration || 0,
    t: v.currentTime,
    w: v.videoWidth, h: v.videoHeight,
  }));
});
await page.evaluate('window.__restore && window.__restore()');

if (!scrub.length) {
  add('warn', 'no <video> mounted after scrolling into scene 1', 'expected if the page is stills-only (tier 0) — a FAIL otherwise');
} else {
  const dead = scrub.filter((v) => v.dur > 0 && v.seekEnd === 0);
  if (dead.length) add('FAIL', `${dead.length} clip(s) with seekable=[0,0]`, 'the host is not serving byte ranges and the blob fallback did not engage — every seek clamps to frame 0 and the video looks frozen');
  const moved = scrub.some((v) => v.t > 0.05);
  if (!moved) add('FAIL', 'no clip advanced its currentTime', 'scroll is not driving the scrub');
  if (!dead.length && moved) add('pass', 'scrub is live', `${scrub.length} clip(s), seekable, currentTime tracking scroll`);
}

/* --- scroll frame budget */
const jank = await page.evaluate(async () => {
  const el = document.documentElement;
  const prev = el.style.scrollBehavior;
  el.style.setProperty('scroll-behavior', 'auto', 'important');
  const frames = [];
  let last = performance.now();
  let raf = true;
  const tick = () => { const n = performance.now(); frames.push(n - last); last = n; if (raf) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  const h = document.documentElement.scrollHeight;
  for (let y = 0; y <= h; y += Math.max(200, Math.floor(h / 50))) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 40));
  }
  raf = false;
  el.style.scrollBehavior = prev;
  const over = frames.filter((f) => f > 32).length;
  frames.sort((a, b) => a - b);
  return { pct: frames.length ? (over / frames.length) * 100 : 0, p95: frames[Math.floor(frames.length * 0.95)] || 0 };
});
if (jank.pct > CEIL.jankPct) add('FAIL', `${jank.pct.toFixed(0)}% of frames over 32ms while scrolling`, `p95 ${jank.p95.toFixed(0)}ms — tighten the GOP or drop a tier`);
else add('pass', `scroll holds frame budget`, `${jank.pct.toFixed(0)}% over 32ms, p95 ${jank.p95.toFixed(0)}ms`);

/* --- memory ceiling: the engine must release clips it has scrolled past */
await fullScroll(page);
const live = await page.evaluate(() => [...document.querySelectorAll('video')].filter((v) => v.src || v.currentSrc).length);
if (live > CEIL.liveVideos) add('FAIL', `${live} decoded clips held at once`, `over ${CEIL.liveVideos} — the engine is not releasing past scenes and a low-end phone will be killed by the OS`);
else add('pass', `${live} clip(s) held at once`, `ceiling ${CEIL.liveVideos}`);

/* --- payload, measured at the wire */
const videoBytes = requests.filter((r) => r.video).reduce((a, r) => a + r.size, 0);
const total = requests.reduce((a, r) => a + r.size, 0);
const ceil = MOBILE ? CEIL.transferMobile : CEIL.transferDesktop;
if (total > ceil) add('FAIL', `${mb(total)} transferred`, `over the ${MOBILE ? 'mobile' : 'desktop'} ceiling of ${mb(ceil)}`);
else add('pass', `${mb(total)} transferred`, `${mb(videoBytes)} of it video; ceiling ${mb(ceil)}`);

const firstClip = requests.filter((r) => r.video).sort((a, b) => a.size - b.size)[0];
if (firstClip && firstClip.size > CEIL.firstMotion)
  add('FAIL', `first motion needs ${mb(firstClip.size)}`, `over ${mb(CEIL.firstMotion)} — nothing moves until it lands`);

/* --- the tier contract: a phone must never be served a desktop master */
if (MOBILE) {
  const masters = requests.filter((r) => r.video && !isMobileEncode(r.url));
  if (masters.length) {
    add('FAIL', `${masters.length} desktop master(s) served to a phone`,
      masters.slice(0, 2).map((m) => m.url.split('/').pop() + ' ' + mb(m.size)).join(', ') +
      ' — run encode.sh for the free tier-1 variants, or set mobileTier:"stills"');
  } else if (requests.some((r) => r.video)) {
    add('pass', 'tier contract holds', 'only -m/-p encodes were fetched');
  }

  const portraitServed = requests.filter((r) => /-p\.mp4/i.test(r.url));
  if (portraitServed.length && scrub.length) {
    const landscape = scrub.filter((v) => v.w && v.h && v.w > v.h);
    if (landscape.length) add('FAIL', 'tier 2 declared but the clip is landscape', 'a -p.mp4 must be a NATIVE 9:16 render, not a downscaled 16:9 file');
  }
}

if (errors.length) add('FAIL', `${errors.length} page error(s)`, errors[0]);
await ctx.close();

/* ------------------------------------------------- reduced-motion pass ---- */
{
  const s = await session({ reducedMotion: 'reduce' });
  await s.page.goto(url, { waitUntil: 'networkidle' }).catch(() => s.page.goto(url));
  await fullScroll(s.page);
  const vids = s.requests.filter((r) => r.video);
  if (vids.length) {
    add('FAIL', `${vids.length} clip(s) fetched under prefers-reduced-motion`,
      mb(vids.reduce((a, r) => a + r.size, 0)) + ' — reduced motion must skip the download entirely, not just hold the video still');
  } else {
    add('pass', 'reduced motion fetches no video');
  }
  const stillsVisible = await s.page.evaluate(() =>
    [...document.querySelectorAll('.sw-scene__still')].some((i) => i.complete && i.naturalWidth > 0));
  if (!stillsVisible) add('FAIL', 'reduced motion shows no stills either', 'the page is blank for these users');
  await s.ctx.close();
}

await browser.close();

/* ------------------------------------------------------------- report ----- */
if (JSONOUT) {
  console.log(JSON.stringify({ url, mobile: MOBILE, findings: results }, null, 2));
} else {
  console.log(`\nscroll-audit — ${url} ${MOBILE ? '(mobile 390x844)' : `(desktop ${W}x${H})`}\n`);
  const icon = { pass: '  ✓', warn: '  !', FAIL: '  ✗' };
  results.forEach((r) => console.log(`${icon[r.level]} ${r.name}${r.detail ? `\n       ${r.detail}` : ''}`));
  const fails = results.filter((r) => r.level === 'FAIL').length;
  const warns = results.filter((r) => r.level === 'warn').length;
  console.log('\n' + (fails ? `${fails} FAILED, ${warns} warning(s)` : warns ? `clean, ${warns} warning(s)` : 'clean') + '\n');
}

process.exit(results.some((r) => r.level === 'FAIL') ? 1 : 0);
