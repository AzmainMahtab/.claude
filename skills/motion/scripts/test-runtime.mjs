/* Self-test for the motion runtime. Run after any change to runtime/*.
   npm i playwright-core, then:  node scripts/test-runtime.mjs            */
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME_PATH || '/usr/bin/chromium';
const b = await chromium.launch({ executablePath: CHROME, args:['--no-sandbox'] });
const URL = 'file://' + path.join(HERE, '..', 'demo', 'index.html');
const fails = [];
const ok = (c,m)=>{ console.log((c?'  ✓ ':'  ✗ ')+m); if(!c) fails.push(m); };

/* ---- 1. errors ---- */
const p = await b.newPage({ viewport:{width:1280,height:800} });
const errs=[]; p.on('console',m=>m.type()==='error'&&errs.push(m.text())); p.on('pageerror',e=>errs.push(e.message));
await p.goto(URL); await p.waitForTimeout(900);
console.log('RUNTIME');
ok(errs.length===0, 'no console/page errors  '+(errs[0]||''));
ok(await p.evaluate(()=>document.documentElement.classList.contains('m-ready')), 'runtime mounted');
ok(await p.evaluate(()=>Motion.hasViewTimeline), 'view-timeline path active (no .m-io fallback needed)');

/* ---- 2. the safety property ---- */
console.log('DEGRADATION');
/* Tier 0 is "motion.css with no motion.js". Block the runtime and check the
   page still works, which is the real contract for a 0-byte marketing page. */
const noRt = await b.newContext({ viewport:{width:1280,height:800} });
await noRt.route('**/motion.js', r => r.abort());
const p2 = await noRt.newPage();
await p2.goto(URL); await p2.waitForTimeout(600);
ok(!(await p2.evaluate(()=>'Motion' in window)), 'motion.js genuinely blocked');
const aboveFold = await p2.evaluate(()=>[...document.querySelectorAll('[data-m~="reveal"], [data-m-stagger] > *')]
  .filter(e=>{const r=e.getBoundingClientRect();
    return r.top < innerHeight && r.bottom > 0 && +getComputedStyle(e).opacity < 0.9;}).length);
ok(aboveFold===0, `nothing above the fold is hidden at load (${aboveFold} hidden)`);
const noJsReveal = await p2.evaluate(async ()=>{
  const e=document.querySelectorAll('[data-m~="reveal"]')[1];
  e.scrollIntoView({block:'center'}); await new Promise(r=>setTimeout(r,500));
  return +getComputedStyle(e).opacity;
});
ok(noJsReveal>0.95, `reveals run on CSS alone, 0 bytes of JS (opacity ${noJsReveal})`);
const sceneNoJs = await p2.evaluate(async ()=>{
  const s=document.querySelector('[data-m~="scene"]');
  s.scrollIntoView({block:'start'}); await new Promise(r=>setTimeout(r,300));
  window.scrollBy(0, innerHeight*1.4); await new Promise(r=>setTimeout(r,300));
  return getComputedStyle(s).getPropertyValue('--m-p').trim();
});
ok(parseFloat(sceneNoJs)>0.1, `scenes publish --m-p on CSS alone (${sceneNoJs})`);
const headingText = await p2.evaluate(()=>document.querySelector('[data-m-split]').textContent.trim().length);
ok(headingText>10, 'un-split headline keeps its text and is selectable');
await noRt.close();

/* Static guarantee: the hidden state exists only behind the feature gates, so
   an engine with neither scroll-timelines nor JS shows plain visible content. */
const cssRaw = (await import('node:fs')).readFileSync(path.join(HERE, '..', 'runtime', 'motion.css'),'utf8');
const preGate = cssRaw.split('@supports (animation-timeline: view())')[0];
ok(!/opacity:\s*0\s*;/.test(preGate), 'no bare rule hides content before the feature gates');

/* ---- 3. scroll-driven reveal actually animates ---- */
console.log('TIER 0');
const revealTop = await p.evaluate(()=>{ const e=document.querySelectorAll('[data-m~="reveal"]')[1];
  e.scrollIntoView({block:'end'}); return 1; });
await p.evaluate(()=>window.scrollTo(0,0)); await p.waitForTimeout(400);
const far = await p.evaluate(()=>{ const e=document.querySelectorAll('[data-m~="reveal"]')[1];
  const r=e.getBoundingClientRect(); window.scrollTo(0, window.scrollY + r.top - innerHeight - 50); return 1;});
await p.waitForTimeout(400);
const oBefore = await p.evaluate(()=>+getComputedStyle(document.querySelectorAll('[data-m~="reveal"]')[1]).opacity);
await p.evaluate(()=>{ document.querySelectorAll('[data-m~="reveal"]')[1].scrollIntoView({block:'center'}); });
await p.waitForTimeout(500);
const oAfter = await p.evaluate(()=>+getComputedStyle(document.querySelectorAll('[data-m~="reveal"]')[1]).opacity);
ok(oBefore < 0.5 && oAfter > 0.95, `reveal animates on scroll (${oBefore.toFixed(2)} → ${oAfter.toFixed(2)})`);

const st = await p.evaluate(()=>{ const g=document.querySelector('[data-m-stagger]');
  g.scrollIntoView({block:'center'}); return [...g.children].map(c=>getComputedStyle(c).getPropertyValue('--i').trim()); });
ok(st.join(',')==='0,1,2,3', 'stagger indices assigned by CSS: '+st.join(','));

/* scene publishes --m-p */
const sp = await p.evaluate(async ()=>{
  const s=document.querySelector('[data-m~="scene"]');
  const read=()=>getComputedStyle(s).getPropertyValue('--m-p').trim();
  s.scrollIntoView({block:'start'}); await new Promise(r=>setTimeout(r,350)); const a=read();
  window.scrollBy(0, window.innerHeight*1.6); await new Promise(r=>setTimeout(r,350)); const c=read();
  return [a,c];
});
ok(parseFloat(sp[1]) > parseFloat(sp[0]), `scene publishes --m-p (${sp[0]} → ${sp[1]})`);

const mover = await p.evaluate(()=>getComputedStyle(document.querySelector('.mover')).transform);
ok(mover !== 'none' && mover !== '', 'descendant reads --m-p in plain CSS: '+mover.slice(0,34));

/* progress bar */
await p.evaluate(()=>window.scrollTo(0, document.documentElement.scrollHeight));
await p.waitForTimeout(400);
const prog = await p.evaluate(()=>getComputedStyle(document.querySelector('[data-m~="progress"]')).transform);
ok(/matrix\(1,/.test(prog), 'progress bar reaches scaleX(1) at the end: '+prog.slice(0,22));

/* ---- 4. tier 1 ---- */
console.log('TIER 1');
const lines = await p.evaluate(()=>document.querySelectorAll('[data-m-split="lines"] .m-line').length);
ok(lines>=2, `line split produced ${lines} masked lines`);
const words = await p.evaluate(()=>document.querySelectorAll('[data-m-split="words"] .m-unit').length);
ok(words>5, `word split produced ${words} units`);
const counts = await p.evaluate(async ()=>{
  document.querySelector('[data-m~="count"]').scrollIntoView({block:'center'});
  await new Promise(r=>setTimeout(r,2200));
  return [...document.querySelectorAll('[data-m~="count"]')].map(e=>e.textContent);
});
ok(counts.join('|')==='9|6|1,240|4.8', 'counters land on the real values: '+counts.join(', '));
const par = await p.evaluate(async ()=>{
  const el=document.querySelector('[data-m~="parallax"]');
  el.scrollIntoView({block:'center'}); await new Promise(r=>setTimeout(r,300));
  const a=getComputedStyle(el).transform;
  window.scrollBy(0,400); await new Promise(r=>setTimeout(r,300));
  return [a, getComputedStyle(el).transform];
});
ok(par[0]!==par[1], 'parallax moves with scroll');

/* ---- 5. reduced motion ---- */
console.log('REDUCED MOTION');
const rc = await b.newContext({ viewport:{width:1280,height:800}, reducedMotion:'reduce' });
const p3 = await rc.newPage(); await p3.goto(URL); await p3.waitForTimeout(800);
const rm = await p3.evaluate(async ()=>{
  const out={};
  const r=document.querySelectorAll('[data-m~="reveal"]')[1];
  r.scrollIntoView({block:'center'}); await new Promise(res=>setTimeout(res,300));
  out.revealVisible = +getComputedStyle(r).opacity;
  out.rise = getComputedStyle(document.documentElement).getPropertyValue('--m-rise').trim();
  const m=document.querySelector('[data-m~="marquee"] > *');
  out.marquee = getComputedStyle(m).animationName;
  const img=document.querySelector('[data-m~="clip"]');
  out.clip = getComputedStyle(img).clipPath;
  document.querySelector('[data-m~="count"]').scrollIntoView({block:'center'});
  await new Promise(res=>setTimeout(res,400));
  out.count = document.querySelector('[data-m~="count"]').textContent;
  return out;
});
ok(rm.revealVisible>0.95, 'reveals still complete (opacity kept, travel dropped)');
ok(rm.rise==='0px', '--m-rise collapsed to 0');
ok(rm.marquee==='none', 'marquee is a static strip');
ok(rm.clip==='none', 'clip wipe disabled');
ok(rm.count==='9', 'counter writes the final value without animating');
await rc.close();

/* ---- 6. the banned properties ---- */
console.log('DISCIPLINE');
const css = await (await fetch('file:///dev/null').catch(()=>null), null);
const raw = (await import('node:fs')).readFileSync(path.join(HERE, '..', 'runtime', 'motion.css'),'utf8');
const bannedTransition = /transition:[^;]*\b(width|height|top|left|margin|padding|all)\b/.test(raw);
ok(!bannedTransition, 'no transition on layout properties or `all`');
const kf = raw.match(/@keyframes[^}]*\{[\s\S]*?\n\}/g)||[];
ok(!/\n\s*(width|height|top|left)\s*:/.test(kf.join('')), 'no keyframe animates a layout property');
console.log();
console.log(fails.length ? `FAILED ${fails.length}: ${fails.join(' | ')}` : 'ALL CHECKS PASSED');
await b.close();
process.exit(fails.length?1:0);
