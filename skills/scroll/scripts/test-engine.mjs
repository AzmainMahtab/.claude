#!/usr/bin/env node
/**
 * test-engine.mjs — assertions over runtime/scrub-engine.js.
 *
 *   npm i playwright-core && npm test
 *
 * Synthesises its own clips with ffmpeg (no network, no render spend), serves
 * them, and drives the engine in a real browser. Run after ANY change to the
 * engine — the tier contract and the reduced-motion path are exactly the things
 * that regress silently and cost real money on a phone.
 */

import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.resolve(HERE, '..');
const ENGINE = path.join(SKILL, 'runtime', 'scrub-engine.js');

const CHROME = process.env.CHROME_PATH ||
  ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
   '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => fs.existsSync(p));
if (!CHROME) { console.error('No Chrome. Set CHROME_PATH.'); process.exit(3); }
try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); }
catch { console.error('ffmpeg not on PATH — needed to synthesise fixtures.'); process.exit(3); }

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? `\n       ${detail}` : ''}`); }
};

/* ---------------------------------------------------------- fixtures ------ */
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scroll-test-'));
const assets = path.join(root, 'assets');
fs.mkdirSync(assets);

const clip = (name, seed, w, h, gop) => {
  execFileSync('ffmpeg', ['-v', 'error', '-y',
    '-f', 'lavfi', '-i', `testsrc=size=${w}x${h}:rate=24:duration=2,hue=h=${seed}`,
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '30', '-pix_fmt', 'yuv420p',
    '-g', String(gop), '-keyint_min', String(gop), '-sc_threshold', '0',
    '-an', '-movflags', '+faststart', path.join(assets, name)]);
};
const still = (name, seed) => {
  execFileSync('ffmpeg', ['-v', 'error', '-y',
    '-f', 'lavfi', '-i', `testsrc=size=640x360:rate=1:duration=1,hue=h=${seed}`,
    '-frames:v', '1', path.join(assets, name)]);
};

for (const [i, n] of ['s1', 's2', 's3'].entries()) {
  clip(`${n}.mp4`, i * 60, 640, 360, 8);
  clip(`${n}-m.mp4`, i * 60, 320, 180, 4);
  still(`${n}.webp`, i * 60);
}
for (const [i, n] of ['c1', 'c2'].entries()) {
  clip(`${n}.mp4`, 30 + i * 60, 640, 360, 8);
  clip(`${n}-m.mp4`, 30 + i * 60, 320, 180, 4);
}
fs.copyFileSync(ENGINE, path.join(root, 'scrub-engine.js'));

const SECTIONS = ['s1', 's2', 's3'].map((id, i) => ({
  id, label: `Scene ${i + 1}`,
  still: `assets/${id}.webp`,
  clip: `assets/${id}.mp4`,
  clipMobile: `assets/${id}-m.mp4`,
  alt: `Test pattern standing in for scene ${i + 1}.`,
  accent: ['#18222D', '#D97757', '#2E9E8F'][i],
  scroll: 1.4, linger: 0.3,
  eyebrow: `Stage ${i + 1}`, title: `Scene ${i + 1} title.`,
  body: 'One plain sentence about this stage.',
  tags: ['One', 'Two'],
  ...(i === 2 ? { cta: { primary: { label: 'Back to top', href: '#top' } } } : {}),
}));

function fixture(name, overrides) {
  const cfg = {
    brand: { name: 'Fixture', href: '#top' },
    hint: 'scroll', diveScroll: 1.3, connScroll: 0.9,
    sections: SECTIONS,
    connectors: ['assets/c1.mp4', 'assets/c2.mp4'],
    connectorsMobile: ['assets/c1-m.mp4', 'assets/c2-m.mp4'],
    ...overrides,
  };
  fs.writeFileSync(path.join(root, name), `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>fixture</title><meta name="description" content="engine fixture">
<meta property="og:title" content="fixture"><meta property="og:image" content="assets/s1.webp">
<meta name="twitter:card" content="summary_large_image"><link rel="canonical" href="http://localhost/">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","name":"fixture"}</script>
<style>.t{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}</style>
</head><body><div id="top"></div><h1 class="t">fixture</h1><div id="world"></div>
<script src="scrub-engine.js"></script>
<script>window.__h = mountScroll(document.getElementById('world'), ${JSON.stringify(cfg)});</script>
</body></html>`);
}
fixture('light.html', { mobileTier: 'light' });
fixture('stills.html', { mobileTier: 'stills' });
fixture('tiny.html', { mobileTier: 'light', maxLive: 2 });

// Also populate the checked-in demo so a human can open it.
const demoAssets = path.join(SKILL, 'demo', 'assets');
fs.mkdirSync(demoAssets, { recursive: true });
for (const f of fs.readdirSync(assets)) fs.copyFileSync(path.join(assets, f), path.join(demoAssets, f));

/* ---------------------------------------------------------- server -------- */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mp4': 'video/mp4', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'light.html';
  const file = path.join(root, rel);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  const type = TYPES[path.extname(file)] || 'application/octet-stream';
  const size = fs.statSync(file).size;
  // Serve byte ranges, so the streaming-first path is what gets exercised.
  const range = req.headers.range;
  if (range && type === 'video/mp4') {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m[1] ? +m[1] : 0;
    const end = m[2] ? +m[2] : size - 1;
    res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;
const URL_ = (p) => `http://127.0.0.1:${PORT}/${p}`;

/* ---------------------------------------------------------- harness ------- */
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });

async function run(page_, { mobile = false, reducedMotion = 'no-preference' } = {}) {
  const ctx = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    isMobile: mobile, hasTouch: mobile, reducedMotion,
  });
  const page = await ctx.newPage();
  const vids = [];
  page.on('response', (r) => { if (/\.mp4/.test(r.url())) vids.push(r.url().split('/').pop()); });
  await page.goto(URL_(page_), { waitUntil: 'load' });
  return { ctx, page, vids };
}
const scrollTo = (page, f) => page.evaluate((frac) => {
  document.documentElement.style.setProperty('scroll-behavior', 'auto', 'important');
  window.scrollTo(0, document.documentElement.scrollHeight * frac);
}, f);
const fullScroll = async (page) => {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y <= h; y += Math.max(200, Math.floor(h / 30))) {
    await page.evaluate((v) => {
      document.documentElement.style.setProperty('scroll-behavior', 'auto', 'important');
      window.scrollTo(0, v);
    }, y);
    await page.waitForTimeout(50);
  }
};

console.log('\nscroll engine — runtime assertions\n');

/* --- structure ----------------------------------------------------------- */
{
  const { ctx, page } = await run('light.html');
  const d = await page.evaluate(() => ({
    scenes: document.querySelectorAll('.sw-scene').length,
    copies: document.querySelectorAll('.sw-copy').length,
    dots: document.querySelectorAll('.sw-route__dot').length,
    mirror: !!document.querySelector('.sw-a11y'),
    mirrorH2: document.querySelectorAll('.sw-a11y h2').length,
    mirrorText: document.querySelector('.sw-a11y')?.innerText.trim().length || 0,
    stageHidden: document.querySelector('.sw-stage')?.getAttribute('aria-hidden'),
    copyHidden: document.querySelector('.sw-copy')?.getAttribute('aria-hidden'),
    h1: document.querySelectorAll('h1').length,
    layer: [...document.styleSheets].some((s) => { try { return [...s.cssRules].some((r) => r.constructor.name === 'CSSLayerBlockRule'); } catch { return false; } }),
    tier: window.__h?.tier,
  }));
  ok('builds 5 segments (3 dives + 2 connectors)', d.scenes === 5, `got ${d.scenes}`);
  ok('one copy block per section', d.copies === 3, `got ${d.copies}`);
  ok('one route dot per section', d.dots === 3, `got ${d.dots}`);
  ok('emits the .sw-a11y text mirror', d.mirror);
  ok('mirror carries one h2 per scene', d.mirrorH2 === 3, `got ${d.mirrorH2}`);
  ok('mirror carries the alt text', d.mirrorText > 150, `${d.mirrorText} chars`);
  ok('stage is aria-hidden (decorative)', d.stageHidden === 'true');
  ok('visual copy is aria-hidden (mirror owns the reading order)', d.copyHidden === 'true');
  ok('page keeps exactly one h1', d.h1 === 1, `got ${d.h1}`);
  ok('CSS is wrapped in @layer sw', d.layer);
  ok('reports desktop tier', d.tier === 'desktop', `got ${d.tier}`);
  await ctx.close();
}

/* --- desktop serves masters, scrub engages ------------------------------- */
{
  const { ctx, page, vids } = await run('light.html');
  await scrollTo(page, 0.12);
  await page.waitForTimeout(2200);
  const v = await page.evaluate(() => {
    const el = document.querySelector('video');
    return el ? { seek: el.seekable.length ? el.seekable.end(0) : 0, t: el.currentTime, w: el.videoWidth, blob: (el.currentSrc || '').startsWith('blob:') } : null;
  });
  ok('desktop fetches the master', vids.some((u) => /^s1\.mp4/.test(u)), vids.join(', ') || 'none');
  ok('mounts a video', !!v);
  ok('seekable is non-zero (streaming path works)', !!v && v.seek > 0, `seekEnd=${v?.seek}`);
  ok('streams rather than blobbing on a range-serving host', !!v && !v.blob);
  ok('currentTime advances with scroll', !!v && v.t > 0.02, `t=${v?.t}`);
  await ctx.close();
}

/* --- the tier contract --------------------------------------------------- */
{
  const { ctx, page, vids } = await run('light.html', { mobile: true });
  await fullScroll(page);
  await page.waitForTimeout(600);
  const masters = vids.filter((u) => !/-m\.mp4/.test(u));
  ok('phone is never served a desktop master', masters.length === 0, `served: ${masters.join(', ')}`);
  ok('phone fetches the tier-1 encodes', vids.some((u) => /-m\.mp4/.test(u)), vids.join(', ') || 'none');
  const tier = await page.evaluate(() => window.__h?.tier);
  ok('reports the light tier', tier === 'light', `got ${tier}`);
  await ctx.close();
}

/* --- tier 0 -------------------------------------------------------------- */
{
  const { ctx, page, vids } = await run('stills.html', { mobile: true });
  await fullScroll(page);
  await page.waitForTimeout(400);
  const d = await page.evaluate(() => ({
    videos: document.querySelectorAll('video').length,
    cls: document.querySelector('.sw-root')?.classList.contains('sw-stills-only'),
    stills: [...document.querySelectorAll('.sw-scene__still')].filter((i) => i.complete && i.naturalWidth > 0).length,
    tier: window.__h?.tier,
  }));
  ok('stills tier fetches no video at all', vids.length === 0, vids.join(', '));
  ok('stills tier mounts no <video>', d.videos === 0, `${d.videos} mounted`);
  ok('stills tier flags the container', d.cls === true);
  ok('stills tier still paints its posters', d.stills >= 3, `${d.stills} loaded`);
  ok('reports the stills tier', d.tier === 'stills', `got ${d.tier}`);
  await ctx.close();
}

/* --- reduced motion ------------------------------------------------------ */
{
  const { ctx, page, vids } = await run('light.html', { reducedMotion: 'reduce' });
  await fullScroll(page);
  await page.waitForTimeout(400);
  const d = await page.evaluate(() => ({
    videos: document.querySelectorAll('video').length,
    stills: [...document.querySelectorAll('.sw-scene__still')].filter((i) => i.complete && i.naturalWidth > 0).length,
    particles: document.querySelectorAll('.sw-pt').length,
  }));
  ok('reduced motion fetches no video', vids.length === 0, vids.join(', '));
  ok('reduced motion mounts no <video>', d.videos === 0);
  ok('reduced motion still shows the stills', d.stills >= 3, `${d.stills} loaded`);
  ok('reduced motion seeds no particles', d.particles === 0, `${d.particles} present`);
  await ctx.close();
}

/* --- memory ceiling ------------------------------------------------------ */
{
  const { ctx, page } = await run('tiny.html');
  await fullScroll(page);
  await page.waitForTimeout(500);
  const live = await page.evaluate(() =>
    [...document.querySelectorAll('video')].filter((v) => v.getAttribute('src') || v.currentSrc).length);
  ok('holds no more than maxLive clips', live <= 2, `${live} held with maxLive=2`);
  await ctx.close();
}

/* --- focus containment --------------------------------------------------- */
{
  const { ctx, page } = await run('light.html');
  await scrollTo(page, 0);
  await page.waitForTimeout(300);
  const bad = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.sw-copy').forEach((c, i) => {
      const op = parseFloat(getComputedStyle(c).opacity);
      const f = c.querySelectorAll('a[href],button,[tabindex]:not([tabindex="-1"])').length;
      if (op < 0.5 && f && !c.inert) out.push(`copy ${i} op=${op.toFixed(2)} focusables=${f}`);
    });
    return out;
  });
  ok('invisible copy blocks are inert', bad.length === 0, bad.join(' | '));
  await ctx.close();
}

/* --- blob fallback on a range-less host ---------------------------------- */
{
  const noRange = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'light.html';
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    // No Accept-Ranges, and 200 for every request: seekable pins to [0,0].
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => noRange.listen(0, '127.0.0.1', r));
  const p2 = noRange.address().port;
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${p2}/light.html`, { waitUntil: 'load' });
  await scrollTo(page, 0.12);
  await page.waitForTimeout(3000);
  const v = await page.evaluate(() => {
    const el = document.querySelector('video');
    return el ? { blob: (el.currentSrc || '').startsWith('blob:'), seek: el.seekable.length ? el.seekable.end(0) : 0 } : null;
  });
  ok('falls back to a blob when the host serves no ranges', !!v && v.blob, v ? `blob=${v.blob}` : 'no video');
  ok('blob path restores seekability', !!v && v.seek > 0, `seekEnd=${v?.seek}`);
  await ctx.close();
  noRange.close();
}

await browser.close();
server.close();
fs.rmSync(root, { recursive: true, force: true });

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
