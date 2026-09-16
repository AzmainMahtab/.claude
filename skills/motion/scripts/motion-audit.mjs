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

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: MOBILE, hasTouch: MOBILE });
const page = await ctx.newPage();

/* collect stylesheet text the reliable way: URLs from responses, re-fetched */
const sheets = new Set();
page.on('response', (r) => { if (r.request().resourceType() === 'stylesheet') sheets.add(r.url()); });

const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
await page.waitForTimeout(700);

/* ---------------------------------------------------------- 1. hero at load */
/* Anything running an animation or a transition inside the first viewport at
   load delays the largest paint and steals the one screen you get for free. */
const hero = await page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.top > innerHeight * 0.9 || r.bottom < 0 || r.width < 4) continue;
    const anims = el.getAnimations ? el.getAnimations() : [];
    for (const a of anims) {
      const t = a.effect && a.effect.getTiming ? a.effect.getTiming() : {};
      /* scroll-driven animations are fine: they are parked, not playing */
      const scrollDriven = a.timeline && a.timeline.constructor &&
        /ScrollTimeline|ViewTimeline/.test(a.timeline.constructor.name);
      if (scrollDriven) continue;
      if (t.iterations === Infinity) continue;           /* ambient loop, judged below */
      if (a.playState === 'running') {
        out.push((el.tagName.toLowerCase()) + (el.className ? '.' + String(el.className).split(' ')[0] : '') +
                 ' · ' + (a.animationName || 'transition'));
      }
    }
  }
  return out.slice(0, 6);
});
if (hero.length) add('FAIL', 'Hero animates at load', hero.join(', '));
else add('pass', 'Nothing in the first viewport animates at load');

/* ------------------------------------------------- 2. CSS discipline */
let css = '';
for (const u of [...sheets].slice(0, 30)) {
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
const scrollReport = await page.evaluate(async () => {
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
});
const jankPct = scrollReport.frames ? (scrollReport.long / scrollReport.frames) * 100 : 0;
if (jankPct > 10) add('FAIL', `${jankPct.toFixed(0)}% of frames over 32ms while scrolling`, `p95 ${scrollReport.p95.toFixed(0)}ms, worst ${scrollReport.worst.toFixed(0)}ms`);
else if (jankPct > 3) add('warn', `${jankPct.toFixed(0)}% of frames over 32ms while scrolling`, `p95 ${scrollReport.p95.toFixed(0)}ms`);
else add('pass', `Scroll holds frame budget (median ${scrollReport.median.toFixed(0)}ms, p95 ${scrollReport.p95.toFixed(0)}ms)`);

/* ------------------------------------------- 4. content that never revealed */
const stuck = await page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) continue;
    if (!(el.textContent || '').trim() && el.tagName !== 'IMG') continue;
    if (+cs.opacity < 0.05) out.push(el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : ''));
  }
  return [...new Set(out)].slice(0, 8);
});
if (stuck.length) add('FAIL', `${stuck.length} element(s) still at opacity 0 after a full scroll`, stuck.join(', ') + ' — content that never reveals is invisible to readers and to crawlers');
else add('pass', 'No content stuck hidden after a full scroll pass');

/* -------------------------------------------- 5. will-change discipline */
const wc = await page.evaluate(() => [...document.querySelectorAll('body *')]
  .filter((e) => { const v = getComputedStyle(e).willChange; return v && v !== 'auto'; }).length);
if (wc > 30) add('FAIL', `will-change on ${wc} elements`, 'It is a loan, not a decoration. A page covered in it exhausts compositor memory.');
else if (wc > 12) add('warn', `will-change on ${wc} elements`);
else add('pass', `will-change on ${wc} elements`);

/* ------------------------------------------------- 6. reduced-motion parity */
const rctx = await browser.newContext({ viewport: { width: W, height: H }, reducedMotion: 'reduce' });
const rp = await rctx.newPage();
await rp.goto(url, { waitUntil: 'domcontentloaded' });
await rp.waitForTimeout(600);
const rStuck = await rp.evaluate(async () => {
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
});
if (rStuck > 0) add('FAIL', `${rStuck} element(s) hidden under prefers-reduced-motion`, 'Reduced motion means fewer and gentler, not content that never arrives.');
else add('pass', 'Nothing is hidden under prefers-reduced-motion');
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
