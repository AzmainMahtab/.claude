#!/usr/bin/env node
/**
 * budget.mjs — the byte gate.
 *
 * The upstream skill prices every clip in dollars and never once says what the
 * page will weigh. This is the other half of that decision.
 *
 *   node budget.mjs --estimate --scenes 5 [--res 1080p] [--tier light]
 *   node budget.mjs <dir> [--tier light] [--json]
 *
 * ESTIMATE runs before you spend anything: given a scene count it reports the
 * payload you are committing to, per tier, so the weight is approved at the same
 * moment as the spend.
 *
 * MEASURE runs over a directory of encoded clips (and stills) and asserts the
 * ceilings. Exits non-zero when over, so it drops into a gate.
 *
 * Ceilings are per-scene, because that is how the format actually scales: a
 * scene is one dive plus (usually) one connector.
 *
 * It also refuses to pass a directory containing placeholder media. Weight is
 * only half of 'is this shippable' — a 3.8 MB chain of synthetic gradients is
 * comfortably within budget and must never go out the door. Detection is a byte
 * scan for a marker embedded by placeholder.mjs, so this stays dependency-free.
 */

import fs from 'node:fs';
import path from 'node:path';
import { findPlaceholders, MARKER } from './lib/provenance.mjs';

/* Per-scene ceilings in bytes. Derived from measured builds: a 720p N=4 chain
   at crf20/-g8 lands ~4.3 MB/scene; 1080p roughly doubles it. The hard cap is
   what a marketing route can defend at all. */
const CEIL = {
  desktopPerScene: 6.0 * 1024 * 1024,
  desktopHard:      40 * 1024 * 1024,
  mobilePerScene:  2.0 * 1024 * 1024,
  mobileHard:       12 * 1024 * 1024,
  stillsPerScene:  120 * 1024,
  // Bytes that must land before the FIRST scene can move. This is the number the
  // visitor actually feels, and nothing upstream tracks it.
  firstPaintDesktop: 5 * 1024 * 1024,
  firstPaintMobile:  2.5 * 1024 * 1024,
  engine:           40 * 1024,
};

/* Estimated encoded size per clip-second, measured at crf 20 / -g 8. Dense GOP
   is why these are ~2-3x a normal web encode. */
const PER_SEC = { '1080p': 560 * 1024, '720p': 300 * 1024, '480p': 140 * 1024 };
const DIVE_SEC = 8, CONN_SEC = 5;

const argv = process.argv.slice(2);
const has = (n) => argv.includes('--' + n);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i === -1 ? d : argv[i + 1]; };
const JSONOUT = has('json');

const mb = (b) => (b / 1048576).toFixed(1) + ' MB';
const kb = (b) => (b / 1024).toFixed(0) + ' KB';

const results = [];
const add = (level, name, detail) => results.push({ level, name, detail });

/* ---------------------------------------------------------------- estimate */
if (has('estimate')) {
  const n = +flag('scenes', 0);
  if (!n) { console.error('usage: node budget.mjs --estimate --scenes N [--res 1080p]'); process.exit(2); }
  const res = flag('res', '1080p');
  const rate = PER_SEC[res];
  if (!rate) { console.error(`unknown --res ${res}; one of ${Object.keys(PER_SEC).join(', ')}`); process.exit(2); }

  const dives = n * DIVE_SEC * rate;
  const conns = (n - 1) * CONN_SEC * rate;
  const desktop = dives + conns;
  // Tier 1 is a 720p/-g4/crf23 re-encode of the master: measured ~38% of it.
  const tier1 = desktop * 0.38;
  // Tier 2 is a separate native 9:16 render at 720 wide — similar weight to tier 1,
  // but it costs 2N-1 more generations to produce.
  const tier2 = tier1 * 1.05;
  const stills = n * 45 * 1024;

  console.log(`\nPayload estimate — ${n} scenes at ${res}, ${2 * n - 1} clips\n`);
  console.log(`  stills (WebP posters)      ${mb(stills)}`);
  console.log(`  engine                     ~${kb(28 * 1024)} (minified ~${kb(11 * 1024)})`);
  console.log(`  desktop chain              ${mb(desktop)}`);
  console.log(`  tier 1 phone (free)        ${mb(tier1)}`);
  console.log(`  tier 2 phone (paid)        ${mb(tier2)}   +${2 * n - 1} generations`);
  console.log(`\n  What a phone downloads:`);
  console.log(`    tier 0 stills-only       ${mb(stills)}`);
  console.log(`    tier 1 (default)         ${mb(stills + tier1)}`);
  console.log(`    tier 2                   ${mb(stills + tier2)}`);
  console.log(`  What a desktop downloads   ${mb(stills + desktop)}`);
  console.log(`\n  First motion needs        ${mb(dives / n)} (scene 1's dive) on desktop`);
  console.log(`                             ${mb(tier1 / (2 * n - 1))} on tier 1\n`);

  const over = [];
  if (desktop > n * CEIL.desktopPerScene) over.push(`desktop ${mb(desktop)} > ${mb(n * CEIL.desktopPerScene)}`);
  if (desktop > CEIL.desktopHard) over.push(`desktop over hard cap ${mb(CEIL.desktopHard)}`);
  if (tier1 > n * CEIL.mobilePerScene) over.push(`tier 1 ${mb(tier1)} > ${mb(n * CEIL.mobilePerScene)}`);
  if (over.length) {
    console.log('  ⚠ over budget at this scene count / resolution:');
    over.forEach((o) => console.log('    - ' + o));
    console.log(`\n  Options: fewer scenes, shorter dives, 720p masters, or state the`);
    console.log(`  overage explicitly in the page spec and get it approved.\n`);
    process.exit(1);
  }
  console.log('  ✓ within budget\n');
  process.exit(0);
}

/* ----------------------------------------------------------------- measure */
const dir = argv.find((a) => !a.startsWith('--'));
if (!dir) { console.error('usage: node budget.mjs <dir> | --estimate --scenes N'); process.exit(2); }
if (!fs.existsSync(dir)) { console.error(`no such directory: ${dir}`); process.exit(2); }

const walk = (d, out = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== '.git') walk(p, out); }
    else out.push(p);
  }
  return out;
};

const files = walk(dir);
const size = (f) => fs.statSync(f).size;
const sum = (arr) => arr.reduce((a, f) => a + size(f), 0);

const isVid = (f) => /\.mp4$/i.test(f);
const portrait = files.filter((f) => isVid(f) && /-p\.mp4$/i.test(f));
const mobile   = files.filter((f) => isVid(f) && /-m\.mp4$/i.test(f));
const desktop  = files.filter((f) => isVid(f) && !/-[mp]\.mp4$/i.test(f));
const stills   = files.filter((f) => /\.(webp|avif|jpe?g|png)$/i.test(f) && !/\/work\//.test(f));
const engine   = files.filter((f) => /scrub-engine.*\.js$/i.test(f));

// Scene count = dive clips. Connectors are conn1 / con_1 / connector_1 /
// dive-less numbered joins; everything else is a scene. Getting this wrong
// inflates the scene count and silently raises every per-scene ceiling.
const isConnector = (f) => /^(conn?|connector)[-_]?\d*\.mp4$/i.test(path.basename(f));
const dives = desktop.filter((f) => !isConnector(f));
const nScenes = Math.max(1, dives.length);

const D = sum(desktop), M = sum(mobile), P = sum(portrait), S = sum(stills), E = sum(engine);

// First-motion cost: the smallest dive, since scene 1 is what must land first.
const firstDesktop = desktop.length ? Math.min(...desktop.map(size)) : 0;
const firstMobile  = mobile.length  ? Math.min(...mobile.map(size))  : 0;

if (D > nScenes * CEIL.desktopPerScene)
  add('FAIL', `desktop chain ${mb(D)} over budget`, `${mb(nScenes * CEIL.desktopPerScene)} for ${nScenes} scenes (${mb(CEIL.desktopPerScene)}/scene)`);
if (D > CEIL.desktopHard)
  add('FAIL', `desktop chain ${mb(D)} over hard cap`, mb(CEIL.desktopHard));
if (mobile.length && M > nScenes * CEIL.mobilePerScene)
  add('FAIL', `tier 1 ${mb(M)} over budget`, `${mb(nScenes * CEIL.mobilePerScene)} for ${nScenes} scenes`);
if (portrait.length && P > nScenes * CEIL.mobilePerScene)
  add('FAIL', `tier 2 ${mb(P)} over budget`, `${mb(nScenes * CEIL.mobilePerScene)} for ${nScenes} scenes`);
if (S > nScenes * CEIL.stillsPerScene)
  add('warn', `stills ${kb(S)} heavier than expected`, `${kb(nScenes * CEIL.stillsPerScene)} for ${nScenes} scenes — re-encode the WebPs`);
if (firstDesktop > CEIL.firstPaintDesktop)
  add('FAIL', `first motion needs ${mb(firstDesktop)} on desktop`, `over ${mb(CEIL.firstPaintDesktop)} — split the opening dive or lower its crf`);
if (firstMobile && firstMobile > CEIL.firstPaintMobile)
  add('FAIL', `first motion needs ${mb(firstMobile)} on a phone`, `over ${mb(CEIL.firstPaintMobile)}`);
if (E > CEIL.engine)
  add('warn', `engine ${kb(E)} unminified`, `ship it through a bundler — under ${kb(CEIL.engine)} minified`);

// The defect that produced a 16 MB phone payload in the wild.
if (desktop.length && !mobile.length && !portrait.length)
  add('FAIL', 'no mobile tier present', 'phones would be served the desktop masters. Run encode.sh (tier 1 is free) or set mobileTier:"stills".');

/* Provenance. A scaffold build is a legitimate way to work (see placeholder.mjs),
   but it must not be able to reach production quietly. The stamp lives in the
   media's own bytes and survives encode.sh, so replacing a file is what clears
   it — there is no flag to unset and nothing to remember. */
const fakes = findPlaceholders(files);
if (fakes.length) {
  const names = fakes.slice(0, 3).map((f) => path.basename(f)).join(', ');
  add('FAIL', `${fakes.length} placeholder file(s) in the shipped directory`,
    `${names}${fakes.length > 3 ? `, +${fakes.length - 3} more` : ''} — stamped ${MARKER} by placeholder.mjs. ` +
    'Replace them with real renders; the stamp clears itself when the file is replaced. ' +
    'Payload numbers measured against these mean nothing.');
}

if (JSONOUT) {
  console.log(JSON.stringify({
    scenes: nScenes,
    bytes: { desktop: D, tier1: M, tier2: P, stills: S, engine: E },
    firstMotion: { desktop: firstDesktop, tier1: firstMobile },
    findings: results,
  }, null, 2));
} else {
  console.log(`\nPayload — ${dir}  (${nScenes} scenes, ${desktop.length} desktop clips)\n`);
  console.log(`  stills                     ${kb(S)}`);
  console.log(`  engine                     ${kb(E)}`);
  console.log(`  desktop chain              ${mb(D)}`);
  if (mobile.length)   console.log(`  tier 1 phone               ${mb(M)}`);
  if (portrait.length) console.log(`  tier 2 phone               ${mb(P)}`);
  console.log(`\n  desktop visitor downloads  ${mb(S + E + D)}`);
  if (mobile.length)   console.log(`  tier 1 phone downloads     ${mb(S + E + M)}`);
  console.log(`  first motion costs         ${mb(firstDesktop)} desktop${firstMobile ? `, ${mb(firstMobile)} phone` : ''}`);
  console.log();
  const icon = { pass: '  ✓', warn: '  !', FAIL: '  ✗' };
  results.forEach((r) => console.log(`${icon[r.level]} ${r.name}${r.detail ? `\n       ${r.detail}` : ''}`));
  const fails = results.filter((r) => r.level === 'FAIL').length;
  const warns = results.filter((r) => r.level === 'warn').length;
  console.log('\n' + (fails ? `${fails} FAILED, ${warns} warning(s)` : warns ? `within budget, ${warns} warning(s)` : 'within budget') + '\n');
}

process.exit(results.some((r) => r.level === 'FAIL') ? 1 : 0);
