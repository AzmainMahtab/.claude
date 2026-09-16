#!/usr/bin/env node
/**
 * teardown.mjs — forensic read of a live reference website.
 *
 * Answers "what is this site actually made of", with measurements rather than
 * impressions: the stack, the animation libraries, the fonts as rendered, the
 * type scale and its ratio, the palette weighted by painted area, the spacing
 * base unit, the container widths, the motion vocabulary, and the weight.
 *
 *   npm i playwright-core            # once, anywhere on the path
 *   node teardown.mjs <url> [--out DIR] [--width 1440] [--height 900]
 *                           [--mobile] [--wait 2500] [--json]
 *
 * Chrome is found at CHROME_PATH, or the usual Linux/macOS locations.
 *
 * What it cannot see, and you still have to judge by eye: whether the thing is
 * any good. See references/research-protocol.md, "What the tool cannot tell you".
 */

import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

/* ---------------------------------------------------------------- args --- */
const argv = process.argv.slice(2);
const url = argv.find((a) => !a.startsWith('--'));
if (!url) {
  console.error('usage: node teardown.mjs <url> [--out DIR] [--width N] [--mobile] [--json]');
  process.exit(2);
}
const flag = (name, dflt) => {
  const i = argv.indexOf('--' + name);
  return i === -1 ? dflt : argv[i + 1];
};
const has = (name) => argv.includes('--' + name);
const MOBILE = has('mobile');
const W = +flag('width', MOBILE ? 390 : 1440);
const H = +flag('height', MOBILE ? 844 : 900);
const WAIT = +flag('wait', 2500);
const OUT = flag('out', null);

const CHROME =
  process.env.CHROME_PATH ||
  ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
   '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
    .find((p) => { try { return fs.existsSync(p); } catch { return false; } });

if (!CHROME) {
  console.error('No Chrome found. Set CHROME_PATH=/path/to/chrome');
  process.exit(3);
}

/* ------------------------------------------------- library signatures --- */
/* Matched against script URLs and against globals present on window. Keep the
   URL patterns loose: most of these ship minified under hashed filenames, and
   the global is the reliable half. */
const LIBS = [
  ['GSAP',            /\bgsap\b|greensock/i,            ['gsap', 'TweenMax', 'TweenLite']],
  ['ScrollTrigger',   /scrolltrigger/i,                 []],
  ['Lenis',           /\blenis\b|studio-freight/i,      ['Lenis', 'lenis']],
  ['Locomotive',      /locomotive-scroll/i,             ['LocomotiveScroll']],
  ['Three.js',        /\bthree(\.min)?\.js|three@/i,    ['THREE']],
  ['Framer Motion',   /framer-motion|framerusercontent/i, []],
  ['Motion One',      /motion(-one)?@|\/motion\.js/i,   ['Motion']],
  ['Barba',           /barba/i,                          ['barba']],
  ['Swiper',          /swiper/i,                         ['Swiper']],
  ['Lottie',          /lottie/i,                         ['lottie', 'bodymovin']],
  ['Rive',            /\brive\b/i,                       ['rive']],
  ['Splitting/SplitType', /split(ting|-type)/i,          ['Splitting', 'SplitType']],
  ['AOS',             /\baos(\.min)?\.js/i,              ['AOS']],
  ['ScrollMagic',     /scrollmagic/i,                    ['ScrollMagic']],
  ['Matter.js',       /matter(-js)?\./i,                 ['Matter']],
  ['PixiJS',          /\bpixi\b/i,                       ['PIXI']],
  ['Curtains/OGL',    /curtainsjs|\bogl\b/i,             ['Curtains']],
  ['Alpine',          /alpinejs/i,                        ['Alpine']],
  ['htmx',            /\bhtmx\b/i,                        ['htmx']],
  ['jQuery',          /jquery/i,                          ['jQuery']],
];

const FRAMEWORKS = [
  ['Next.js',   () => !!document.getElementById('__next') || !!document.querySelector('script#__NEXT_DATA__') || !!window.__NEXT_DATA__],
  ['Nuxt',      () => !!window.__NUXT__ || !!document.getElementById('__nuxt')],
  ['Astro',     () => !!document.querySelector('astro-island, [astro-island], astro-slot') || !!document.querySelector('script[type="module"][src*="/_astro/"]') || !!document.querySelector('link[href*="/_astro/"]')],
  ['SvelteKit', () => !!document.querySelector('[data-sveltekit-preload-data]') || !!window.__sveltekit],
  ['Remix',     () => !!window.__remixContext],
  ['Gatsby',    () => !!document.getElementById('___gatsby')],
  ['Vue',       () => !!document.querySelector('[data-v-app]') || !!window.__VUE__],
  ['React',     () => !!document.querySelector('[data-reactroot]') || Object.keys(window).some((k) => k.startsWith('__REACT_DEVTOOLS'))],
  ['Webflow',   () => !!document.querySelector('html[data-wf-page], [data-wf-site]')],
  ['Framer',    () => !!document.querySelector('[data-framer-name], #__framer-badge-container')],
  ['WordPress', () => !!document.querySelector('link[href*="/wp-content/"], script[src*="/wp-content/"]')],
  ['Shopify',   () => !!window.Shopify],
  ['Squarespace', () => !!window.Static && !!window.Static.SQUARESPACE_CONTEXT],
  ['Wix',       () => !!window.wixBiSession || !!document.querySelector('[id^="comp-"]')],
  ['Barba/SPA nav', () => !!document.querySelector('[data-barba]')],
  ['Tailwind',  () => !!document.querySelector('[class*="text-"][class*="bg-"], [class*="md:"], [class*="lg:"]')],
];

/* --------------------------------------------------------------- utils --- */
const hex = (c) => {
  if (!c) return null;
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m) return c.startsWith('#') ? c.toLowerCase() : null;
  const p = m[1].split(',').map((n) => parseFloat(n));
  if (p.length > 3 && p[3] === 0) return null;
  const h = p.slice(0, 3).map((n) => Math.round(n).toString(16).padStart(2, '0')).join('');
  return '#' + h;
};
const lum = (h) => {
  const v = [1, 3, 5].map((i) => {
    let c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const sat = (h) => {
  const v = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const mx = Math.max(...v), mn = Math.min(...v);
  return mx === 0 ? 0 : (mx - mn) / mx;
};
const kb = (n) => (n / 1024).toFixed(0) + 'KB';
const pct = (n, t) => ((n / t) * 100).toFixed(1) + '%';

/* ----------------------------------------------------------------- run --- */
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
  userAgent: MOBILE
    ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    : undefined,
  isMobile: MOBILE,
  hasTouch: MOBILE,
});
const page = await ctx.newPage();

const css = [];                 /* stylesheet bodies, for the motion pass  */
const sheetUrls = new Set();    /* collected from responses, fetched below */
const net = [];                 /* every response, for the weight pass     */
let headers = {};

page.on('response', async (res) => {
  try {
    const req = res.request();
    const type = req.resourceType();
    const len = +(res.headers()['content-length'] || 0);
    net.push({ type, url: res.url(), status: res.status(), len });
    if (type === 'stylesheet') sheetUrls.add(res.url());
  } catch { /* a response body can be gone by the time we ask */ }
});

let navErr = null;
try {
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  if (resp) headers = resp.headers();
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
} catch (e) { navErr = e.message; }
await page.waitForTimeout(WAIT);

/* scroll the whole page once so lazy content, fonts and reveals all commit */
await page.evaluate(async () => {
  const h = document.documentElement.scrollHeight;
  for (let y = 0; y < h; y += Math.round(innerHeight * 0.8)) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 90));
  }
  window.scrollTo(0, 0);
  await new Promise((r) => setTimeout(r, 400));
});

/* ---- stylesheets. response.text() is unreliable once navigation has moved
   on, so collect the URLs and re-request them, and take inline <style> and any
   same-origin CSSOM directly from the page. ---- */
const inline = await page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('style')) out.push(el.textContent || '');
  for (const sheet of document.styleSheets) {
    try {
      if (sheet.href) continue;                 /* externals handled below */
      out.push([...sheet.cssRules].map((r) => r.cssText).join('\n'));
    } catch { /* cross-origin sheet, fetched instead */ }
  }
  for (const l of document.querySelectorAll('link[rel~="stylesheet"][href]')) out.push('@@HREF@@' + l.href);
  return out;
});
for (const chunk of inline) {
  if (chunk.startsWith('@@HREF@@')) sheetUrls.add(chunk.slice(8));
  else if (chunk.trim()) css.push(chunk);
}
let sheetsFetched = 0;
for (const u of [...sheetUrls].slice(0, 30)) {
  try {
    const r = await ctx.request.get(u, { timeout: 8000 });
    if (r.ok()) { css.push(await r.text()); sheetsFetched++; }
  } catch { /* unreachable sheet: reported as a lower bound */ }
}

/* ------------------------------------------------------- in-page probe --- */
const data = await page.evaluate((FW_SRC) => {
  const out = {};
  const vis = [];
  const all = document.querySelectorAll('body *');
  for (const el of all) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (r.width < 2 || r.height < 2) continue;
    vis.push({ el, r, cs });
  }

  /* --- frameworks, evaluated here where window is real --- */
  out.frameworks = [];
  for (const [name, fnSrc] of FW_SRC) {
    try { if (new Function('return (' + fnSrc + ')()')()) out.frameworks.push(name); } catch {}
  }
  out.globals = Object.keys(window);

  /* --- fonts as actually rendered --- */
  const famCount = {};
  const sizeCount = {};
  const textNodes = [];
  for (const { el, r, cs } of vis) {
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!own) continue;
    const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
    const chars = el.textContent.trim().length;
    famCount[fam] = (famCount[fam] || 0) + chars;
    const fs = Math.round(parseFloat(cs.fontSize));
    sizeCount[fs] = (sizeCount[fs] || 0) + 1;
    textNodes.push({
      tag: el.tagName, size: fs,
      weight: cs.fontWeight,
      lh: cs.lineHeight === 'normal' ? 'normal' : +(parseFloat(cs.lineHeight) / fs).toFixed(2),
      track: cs.letterSpacing === 'normal' ? 0 : +(parseFloat(cs.letterSpacing) / fs).toFixed(3),
      transform: cs.textTransform,
      fam, chars, w: Math.round(r.width),
    });
  }
  out.families = Object.entries(famCount).sort((a, b) => b[1] - a[1]).slice(0, 6);
  out.sizes = Object.entries(sizeCount).map(([s, n]) => [+s, n]).sort((a, b) => a[0] - b[0]);
  out.loadedFonts = [...document.fonts].filter((f) => f.status === 'loaded')
    .map((f) => `${f.family} ${f.weight}${f.style === 'italic' ? ' italic' : ''}`)
    .filter((v, i, a) => a.indexOf(v) === i).slice(0, 24);

  /* the biggest and smallest text that carries real content */
  const real = textNodes.filter((t) => t.chars > 2);
  real.sort((a, b) => b.size - a.size);
  out.display = real[0] || null;
  out.bodyType = (() => {
    const body = real.filter((t) => t.chars > 80);
    body.sort((a, b) => b.chars - a.chars);
    return body[0] || null;
  })();

  /* --- palette, weighted by painted area --- */
  const bgArea = {};
  for (const { r, cs } of vis) {
    const c = cs.backgroundColor;
    if (!c || c === 'rgba(0, 0, 0, 0)' || c === 'transparent') continue;
    bgArea[c] = (bgArea[c] || 0) + r.width * r.height;
  }
  out.bg = Object.entries(bgArea).sort((a, b) => b[1] - a[1]).slice(0, 10);
  /* Ink is only meaningful against the ground it actually sits on, so walk up
     to the first painted ancestor and record the real pair. */
  const inkCount = {}, pairCount = {};
  const groundOf = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const c = getComputedStyle(n).backgroundColor;
      if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c;
      n = n.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor || 'rgb(255,255,255)';
  };
  for (const { el, cs } of vis) {
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!own) continue;
    const chars = el.textContent.trim().length;
    inkCount[cs.color] = (inkCount[cs.color] || 0) + chars;
    const size = parseFloat(cs.fontSize), wt = parseInt(cs.fontWeight) || 400;
    const key = cs.color + '|' + groundOf(el) + '|' + (size >= 24 || (size >= 18.66 && wt >= 700) ? 'L' : 'B');
    pairCount[key] = (pairCount[key] || 0) + chars;
  }
  out.ink = Object.entries(inkCount).sort((a, b) => b[1] - a[1]).slice(0, 8);
  out.pairs = Object.entries(pairCount).sort((a, b) => b[1] - a[1]).slice(0, 8);

  /* --- spacing, radius, borders, shadows --- */
  const space = {}, radius = {}, shadow = {}, border = {};
  for (const { cs } of vis) {
    for (const p of ['paddingTop', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginBottom', 'rowGap', 'columnGap']) {
      const v = Math.round(parseFloat(cs[p]) || 0);
      if (v > 0 && v <= 400) space[v] = (space[v] || 0) + 1;
    }
    const rad = Math.round(parseFloat(cs.borderTopLeftRadius) || 0);
    if (rad > 0) radius[rad > 500 ? 999 : rad] = (radius[rad > 500 ? 999 : rad] || 0) + 1;
    if (cs.boxShadow && cs.boxShadow !== 'none') shadow[cs.boxShadow.slice(0, 60)] = (shadow[cs.boxShadow.slice(0, 60)] || 0) + 1;
    const bw = Math.round(parseFloat(cs.borderTopWidth) || 0);
    if (bw > 0) border[bw] = (border[bw] || 0) + 1;
  }
  out.space = Object.entries(space).map(([v, n]) => [+v, n]).sort((a, b) => b[1] - a[1]).slice(0, 14);
  out.radius = Object.entries(radius).map(([v, n]) => [+v, n]).sort((a, b) => b[1] - a[1]).slice(0, 6);
  out.shadow = Object.entries(shadow).sort((a, b) => b[1] - a[1]).slice(0, 4);
  out.border = Object.entries(border).map(([v, n]) => [+v, n]).sort((a, b) => b[1] - a[1]).slice(0, 4);

  /* --- layout: container widths and grids --- */
  const widths = {};
  for (const { r, cs } of vis) {
    if (r.height < 120) continue;
    const w = Math.round(r.width);
    if (w > 320 && w <= innerWidth) widths[w] = (widths[w] || 0) + 1;
  }
  out.containers = Object.entries(widths).map(([v, n]) => [+v, n]).sort((a, b) => b[1] - a[1]).slice(0, 6);
  out.grids = [...new Set(vis.filter(v => v.cs.display.includes('grid') && v.cs.gridTemplateColumns !== 'none')
    .map(v => v.cs.gridTemplateColumns.split(' ').length + ' cols'))].slice(0, 6);

  /* --- structural / motion signals --- */
  out.sticky = vis.filter((v) => v.cs.position === 'sticky' || v.cs.position === 'fixed').length;
  out.willChange = vis.filter((v) => v.cs.willChange && v.cs.willChange !== 'auto').length;
  out.transformed = vis.filter((v) => v.cs.transform && v.cs.transform !== 'none').length;
  out.mixBlend = [...new Set(vis.map((v) => v.cs.mixBlendMode).filter((m) => m && m !== 'normal'))];
  out.backdrop = vis.filter((v) => v.cs.backdropFilter && v.cs.backdropFilter !== 'none').length;
  out.canvas = document.querySelectorAll('canvas').length;
  out.video = document.querySelectorAll('video').length;
  out.svg = document.querySelectorAll('svg').length;
  out.imgs = [...document.images].map((i) => (i.currentSrc || i.src).split('?')[0].split('.').pop().toLowerCase())
    .filter((e) => e.length <= 5);
  out.scrollBehavior = getComputedStyle(document.documentElement).scrollBehavior;
  out.h1 = document.querySelectorAll('h1').length;
  out.headings = [...document.querySelectorAll('h1,h2,h3,h4')].map((h) => h.tagName).join(' ');
  out.sections = document.querySelectorAll('body > *, main > *, main > * > section').length;
  out.title = document.title;
  out.docHeight = document.documentElement.scrollHeight;
  out.vh = +(document.documentElement.scrollHeight / innerHeight).toFixed(1);
  out.scripts = [...document.scripts].map((s) => s.src).filter(Boolean);
  out.bodyChars = (document.body.innerText || '').trim().length;
  out.generator = (document.querySelector('meta[name="generator"]') || {}).content || null;
  return out;
}, FRAMEWORKS.map(([n, f]) => [n, f.toString()]));

/* library detection needs both halves */
const scriptBlob = data.scripts.join(' ') + ' ' + net.filter(n => n.type === 'script').map(n => n.url).join(' ');
const globalsSet = new Set(data.globals);
const libs = LIBS.filter(([, re, globals]) => re.test(scriptBlob) || globals.some((g) => globalsSet.has(g)))
  .map(([name]) => name);

/* ------------------------------------------------------- motion in CSS --- */
const cssAll = css.join('\n');
const durs = {}, eases = {};
for (const m of cssAll.matchAll(/(\d*\.?\d+)\s*(ms|s)\b/g)) {
  let v = parseFloat(m[1]) * (m[2] === 's' ? 1000 : 1);
  if (v > 0 && v <= 8000) durs[v] = (durs[v] || 0) + 1;
}
for (const m of cssAll.matchAll(/cubic-bezier\([^)]+\)|\bease-in-out\b|\bease-out\b|\bease-in\b|\blinear\b|\bease\b|\bsteps\([^)]*\)/g)) {
  const k = m[0].replace(/\s+/g, '');
  eases[k] = (eases[k] || 0) + 1;
}
const keyframes = (cssAll.match(/@keyframes/g) || []).length;
const reducedMotion = /prefers-reduced-motion/.test(cssAll);
const cssVars = [...new Set((cssAll.match(/--[a-z0-9-]+(?=\s*:)/gi) || []))].length;

/* ------------------------------------------------------------- weight --- */
const byType = {};
for (const n of net) {
  byType[n.type] = byType[n.type] || { n: 0, bytes: 0 };
  byType[n.type].n++; byType[n.type].bytes += n.len;
}
const totalBytes = Object.values(byType).reduce((a, b) => a + b.bytes, 0);
const fontFiles = net.filter((n) => /\.(woff2?|otf|ttf)(\?|$)/i.test(n.url));
const fontHost = [...new Set(fontFiles.map((f) => { try { return new URL(f.url).host; } catch { return '?'; } }))];

/* ------------------------------------------------------------ derived --- */
/* type scale ratio from the sizes that carry real content */
const usedSizes = data.sizes.filter(([, n]) => n >= 2).map(([s]) => s);
const steps = usedSizes.filter((v, i, a) => i === 0 || v - a[i - 1] >= 2);
const ratios = [];
for (let i = 1; i < steps.length; i++) ratios.push(+(steps[i] / steps[i - 1]).toFixed(2));
const medianRatio = ratios.length ? ratios.sort((a, b) => a - b)[Math.floor(ratios.length / 2)] : null;

/* spacing base: which of 4 / 5 / 8 divides the most-used values */
const spaceBase = [4, 5, 8].map((b) => [b, data.space.filter(([v]) => v % b === 0).reduce((a, [, n]) => a + n, 0)])
  .sort((a, b) => b[1] - a[1])[0];

/* accent: a colour that is saturated and rare */
const bgHex = data.bg.map(([c, a]) => [hex(c), a]).filter(([c]) => c);
const inkHex = data.ink.map(([c, n]) => [hex(c), n]).filter(([c]) => c);
const totalArea = bgHex.reduce((a, [, x]) => a + x, 0) || 1;
const accent = bgHex.filter(([c, a]) => sat(c) > 0.35 && a / totalArea < 0.2).slice(0, 3);

const hostHeader = (k) => headers[k] ? `${k}: ${headers[k]}` : null;
const hosting = ['server', 'x-powered-by', 'x-vercel-id', 'x-nf-request-id', 'cf-ray', 'x-served-by', 'x-github-request-id']
  .map(hostHeader).filter(Boolean);

/* -------------------------------------------------------------- print --- */
const L = (s = '') => console.log(s);
const bar = (n, max, w = 22) => '█'.repeat(Math.max(1, Math.round((n / max) * w)));

L();
L('═'.repeat(74));
L(`  ${data.title || '(no title)'}`);
L(`  ${url}   ·   ${W}×${H}${MOBILE ? ' mobile UA' : ''}   ·   ${data.vh} viewport-heights`);
if (navErr) L(`  ⚠ navigation warning: ${navErr}`);
L('═'.repeat(74));

/* A bot wall, a consent gate or a client-rendered shell that never hydrated
   all look like a valid page to a scraper. Say so instead of reporting a
   confident teardown of an interstitial. */
const wallish = /just a moment|one moment|attention required|checking your browser|access denied|are you a (human|robot)|enable javascript|403|forbidden/i.test(data.title || '');
const thin = data.bodyChars < 400 || net.length < 8 || data.vh < 1.2;
if (wallish || thin) {
  L();
  L('  ⚠  THIS READ IS NOT TRUSTWORTHY');
  const why = [];
  if (wallish) why.push(`the title reads like an interstitial ("${data.title}")`);
  if (data.bodyChars < 400) why.push(`only ${data.bodyChars} characters of body text`);
  if (net.length < 8) why.push(`only ${net.length} network requests`);
  if (data.vh < 1.2) why.push(`the document is ${data.vh} viewport-heights tall`);
  L('     ' + why.join('; ') + '.');
  L('     You have almost certainly captured a bot wall, a consent gate or an');
  L('     unhydrated shell. Re-run with a longer --wait, try the www/non-www host,');
  L('     or read this reference by hand. Do not record these numbers as findings.');
  L('═'.repeat(74));
}

L();
L('BUILT WITH');
L(`  Framework     ${data.frameworks.length ? data.frameworks.join(', ') : '— none detected (likely hand-rolled or static)'}`);
L(`  Libraries     ${libs.length ? libs.join(', ') : '— none of the usual suspects'}`);
if (data.generator) L(`  Generator     ${data.generator}`);
if (hosting.length) L(`  Delivery      ${hosting.join('  ·  ')}`);
L(`  Fonts from    ${fontHost.length ? fontHost.join(', ') : 'system stack only'}  (${fontFiles.length} files, ${kb(fontFiles.reduce((a, f) => a + f.len, 0))})`);
L(`  CSS variables ${cssVars} custom properties declared${cssVars > 40 ? '  (token-driven)' : cssVars > 0 ? '' : '  (no token layer)'}`);
L(`  CSS read      ${css.length} sheets, ${kb(cssAll.length)} of source${sheetUrls.size > sheetsFetched + 1 ? `  (${sheetUrls.size - sheetsFetched} unreachable, motion numbers are a floor)` : ''}`);

L();
L('TYPE');
L(`  Families      ${data.families.map(([f, c]) => `${f} (${c} chars)`).join('  ·  ') || '—'}`);
if (data.loadedFonts.length) L(`  Weights       ${data.loadedFonts.join(', ')}`);
if (data.display) {
  const d = data.display;
  L(`  Display       ${d.size}px ${d.fam} ${d.weight}  ·  line-height ${d.lh}  ·  tracking ${d.track}em${d.transform !== 'none' ? '  ·  ' + d.transform : ''}`);
}
if (data.bodyType) {
  const b = data.bodyType;
  const ch = Math.round(b.w / (b.size * 0.5));
  L(`  Body          ${b.size}px ${b.fam} ${b.weight}  ·  line-height ${b.lh}  ·  measure ≈${ch}ch`);
}
L(`  Scale steps   ${steps.join(' → ')}`);
L(`  Ratio         ${medianRatio ? `${medianRatio}× median between steps` : '—'}${data.display && data.bodyType ? `  ·  display is ${(data.display.size / data.bodyType.size).toFixed(1)}× body` : ''}`);

L();
L('COLOUR  (background by painted area, ink by character count)');
for (const [c, a] of bgHex.slice(0, 5)) L(`  ${c}  ${bar(a, bgHex[0][1])} ${pct(a, totalArea)}`);
const totalChars = data.pairs.reduce((a, [, n]) => a + n, 0) || 1;
L('  Measured text pairs, each against the ground it actually sits on:');
for (const [key, n] of data.pairs.slice(0, 6)) {
  const [fg, bg, kind] = key.split('|');
  const f = hex(fg), g = hex(bg);
  if (!f || !g) continue;
  const r = ratio(f, g);
  const need = kind === 'L' ? 3 : 4.5;
  L(`    ${f} on ${g}  ${r.toFixed(2).padStart(6)}:1  ${r >= need ? 'pass' : 'FAIL'}  ${kind === 'L' ? 'large' : 'body '}  ${pct(n, totalChars)} of text`);
}
L(`  Accent        ${accent.length ? accent.map(([c, a]) => `${c} (${pct(a, totalArea)} of area)`).join(', ') : '— no saturated low-area colour: monochrome or neutral palette'}`);

L();
L('SPACE & SHAPE');
L(`  Base unit     ${spaceBase[0]}px  (${spaceBase[1]} of the sampled values divide by it)`);
L(`  Common steps  ${data.space.slice(0, 8).map(([v]) => v).sort((a, b) => a - b).join(', ')}`);
L(`  Containers    ${data.containers.map(([w, n]) => `${w}px ×${n}`).join('  ·  ')}`);
L(`  Grids         ${data.grids.join(', ') || '— flex or flow only'}`);
L(`  Radius        ${data.radius.length ? data.radius.map(([v, n]) => `${v === 999 ? 'pill' : v + 'px'} ×${n}`).join('  ·  ') : 'square everywhere'}`);
L(`  Borders       ${data.border.map(([v, n]) => `${v}px ×${n}`).join('  ·  ') || 'none'}`);
L(`  Shadows       ${data.shadow.length ? data.shadow.length + ' distinct  ·  ' + data.shadow[0][0] : 'none'}`);

L();
L('MOTION');
const topDur = Object.entries(durs).map(([v, n]) => [+v, n]).sort((a, b) => b[1] - a[1]).slice(0, 6);
L(`  Durations     ${topDur.map(([v, n]) => `${v}ms ×${n}`).join('  ·  ') || '—'}`);
L(`  Easing        ${Object.entries(eases).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => `${k} ×${n}`).join('  ·  ') || '—'}`);
L(`  Keyframes     ${keyframes} @keyframes blocks`);
if (cssAll.length < 15000 && data.bodyChars > 2000) {
  L('  ⚠ only ' + kb(cssAll.length) + ' of CSS was readable on a page this size, so the motion');
  L('    vocabulary above is a floor. The rest is inlined, CORS-blocked or set in JS.');
}
L(`  Reduced motion${reducedMotion ? ' ✓ honoured in CSS' : ' ✗ no prefers-reduced-motion block'}`);
L(`  Scroll        ${data.sticky} sticky/fixed  ·  ${data.transformed} transformed  ·  ${data.willChange} will-change  ·  scroll-behavior: ${data.scrollBehavior}`);
L(`  Compositing   ${data.canvas} canvas  ·  ${data.svg} svg  ·  ${data.video} video  ·  ${data.backdrop} backdrop-filter${data.mixBlend.length ? '  ·  blend: ' + data.mixBlend.join(',') : ''}`);

L();
L('STRUCTURE & WEIGHT');
L(`  Headings      ${data.h1} h1  ·  ${data.headings.split(' ').length} total  ·  ${data.headings.slice(0, 60)}`);
const fmt = {};
for (const e of data.imgs) fmt[e] = (fmt[e] || 0) + 1;
L(`  Images        ${data.imgs.length} total  ·  ${Object.entries(fmt).map(([k, v]) => `${k} ×${v}`).join(', ') || '—'}`);
L(`  Transferred   ${kb(totalBytes)} over ${net.length} requests`);
for (const [t, v] of Object.entries(byType).sort((a, b) => b[1].bytes - a[1].bytes).slice(0, 6)) {
  L(`    ${t.padEnd(12)} ${kb(v.bytes).padStart(8)}  ×${v.n}`);
}
L();
L('Content-length is missing on chunked responses, so the weight is a floor, not a total.');
L();

/* ------------------------------------------------------------- output --- */
if (OUT) {
  fs.mkdirSync(OUT, { recursive: true });
  const slug = url.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/-+$/, '').slice(0, 60);
  const report = {
    url, title: data.title, viewport: { w: W, h: H, mobile: MOBILE }, vh: data.vh,
    frameworks: data.frameworks, libraries: libs, generator: data.generator, hosting,
    fonts: { families: data.families, loaded: data.loadedFonts, hosts: fontHost, files: fontFiles.length },
    type: { display: data.display, body: data.bodyType, steps, medianRatio },
    colour: { bg: bgHex, ink: inkHex, accent },
    space: { base: spaceBase[0], steps: data.space, containers: data.containers, grids: data.grids },
    shape: { radius: data.radius, border: data.border, shadows: data.shadow.length },
    motion: { durations: topDur, easings: Object.entries(eases).sort((a, b) => b[1] - a[1]).slice(0, 8), keyframes, reducedMotion, sticky: data.sticky, canvas: data.canvas, backdrop: data.backdrop, blend: data.mixBlend },
    weight: { totalBytes, byType, requests: net.length },
    cssVars,
  };
  fs.writeFileSync(path.join(OUT, slug + '.json'), JSON.stringify(report, null, 2));
  await page.screenshot({ path: path.join(OUT, slug + '-top.png') });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, slug + '-end.png') });
  L(`Written: ${path.join(OUT, slug + '.json')}  + two screenshots`);
  L();
}

if (has('json')) console.log(JSON.stringify(data.frameworks));

await browser.close();
