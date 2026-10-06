#!/usr/bin/env node
/**
 * seam-check.mjs — verify frame continuity at every seam, without eyeballing it.
 *
 *   node seam-check.mjs <workdir> [--json]
 *
 * Expects the upstream naming in <workdir>:
 *   dive_<name>.mp4   one per scene, in the order given by --order or sorted
 *   conn_<i>.mp4      connector i joins scene i and scene i+1   (architecture B)
 *
 *   --order a,b,c     scene order, if it is not alphabetical
 *   --arch a          architecture A (continuous forward take): legs chain
 *                     directly, there are no connectors
 *
 * WHY TWO NUMBERS
 * Upstream's Step 8 says to judge seams by composition, not raw PSNR, because a
 * correctly frame-locked seam still reads ~18-25 dB from detail shimmer alone.
 * That is true and it is also why a single number cannot decide this. So we take
 * two: PSNR at full resolution (detail) and PSNR at 32x32 (composition). A good
 * seam is soft-but-identical — mediocre detail, very high composition. A real
 * mismatch is low on both, because it is a different picture.
 *
 *   detail  low  + composition high  -> fine, this is the normal case
 *   detail  low  + composition low   -> FAIL, the endpoints are different renders
 *   detail  high + composition high  -> perfect frame lock
 *
 * Thresholds follow upstream's own measurements: a start-image is obeyed exactly
 * (they measured 31.6 dB), an end-image only lands on the same composition
 * (27.5 dB, prop-level drift), and the engine's crossfade covers the difference.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const argv = process.argv.slice(2);
const has = (n) => argv.includes('--' + n);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i === -1 ? d : argv[i + 1]; };
const dir = argv.find((a) => !a.startsWith('--'));
if (!dir) { console.error('usage: node seam-check.mjs <workdir> [--order a,b,c] [--arch a] [--json]'); process.exit(2); }
if (!fs.existsSync(dir)) { console.error(`no such directory: ${dir}`); process.exit(2); }

const ARCH_A = String(flag('arch', 'b')).toLowerCase() === 'a';
const JSONOUT = has('json');

const T = {
  startDetail: 28,      // a start-image must be obeyed exactly
  endDetail: 18,        // an end-image only needs the same composition
  composition: 26,      // below this the two frames are different pictures
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'seam-'));
const results = [];
const add = (level, name, detail) => results.push({ level, name, detail });

// ffmpeg writes the psnr filter's result to STDERR, so both streams have to be
// read. execFileSync returns stdout only, which is why this uses spawnSync.
// -nostdin because ffmpeg will otherwise eat the parent's stdin.
function ff(args) {
  const r = spawnSync('ffmpeg', ['-nostdin', ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  return (r.stdout || '') + (r.stderr || '');
}

function frame(clip, which) {
  const out = path.join(tmp, path.basename(clip, '.mp4') + '_' + which + '.png');
  const pre = which === 'first' ? ['-ss', '0'] : ['-sseof', '-0.15'];
  ff(['-v', 'error', '-y', ...pre, '-i', clip, '-frames:v', '1', '-q:v', '2', out]);
  return fs.existsSync(out) ? out : null;
}

function psnr(a, b, scale) {
  // scale2ref conforms input 1 to input 0 — psnr requires identical dimensions,
  // and a mixed-resolution chain (e.g. a kling 720p clip next to a seedance
  // 1080p one) would otherwise just error out with no number.
  const lavfi = scale
    ? `[0:v]scale=${scale}:${scale},format=gray[a];[1:v]scale=${scale}:${scale},format=gray[b];[a][b]psnr`
    : `[1:v][0:v]scale2ref=flags=bicubic[b][a];[a]format=gray[ga];[b]format=gray[gb];[ga][gb]psnr`;
  const out = ff(['-v', 'info', '-i', a, '-i', b, '-lavfi', lavfi, '-f', 'null', '-']);
  const m = out.match(/average:\s*([0-9.]+|inf)/i);
  if (!m) return null;
  return m[1] === 'inf' ? 99 : parseFloat(m[1]);
}

function compare(label, aFrame, bFrame, detailFloor) {
  if (!aFrame || !bFrame) { add('FAIL', `${label}: could not extract a frame`); return; }
  const d = psnr(aFrame, bFrame, null);
  const c = psnr(aFrame, bFrame, 32);
  if (d === null || c === null) { add('FAIL', `${label}: ffmpeg gave no PSNR`); return; }
  const nums = `detail ${d.toFixed(1)} dB, composition ${c.toFixed(1)} dB`;
  if (c < T.composition) {
    add('FAIL', `${label}: endpoints are different pictures`, `${nums} — the connector was generated from the still, not the neighbour's ACTUAL frame. Re-extract and re-render; no crossfade hides this.`);
  } else if (d < detailFloor) {
    add('warn', `${label}: soft but aligned`, `${nums} — same composition, detail drift. Normal for an end-image; investigate if this is a start seam.`);
  } else {
    add('pass', `${label}`, nums);
  }
}

const names = flag('order', '')
  ? flag('order', '').split(',').map((s) => s.trim()).filter(Boolean)
  : fs.readdirSync(dir).filter((f) => /^dive_.*\.mp4$/.test(f)).sort()
      .map((f) => f.replace(/^dive_/, '').replace(/\.mp4$/, ''));

if (!names.length) { console.error(`no dive_*.mp4 in ${dir}`); process.exit(2); }

const dive = (n) => path.join(dir, `dive_${n}.mp4`);
const conn = (i) => {
  for (const c of [`conn_${i}.mp4`, `con_${i}.mp4`, `connector_${i}.mp4`]) {
    const p = path.join(dir, c); if (fs.existsSync(p)) return p;
  }
  return null;
};

console.log(`\nSeam check — ${names.length} scenes, architecture ${ARCH_A ? 'A (continuous take)' : 'B (dive + connector)'}\n`);

for (let i = 0; i < names.length - 1; i++) {
  const a = dive(names[i]), b = dive(names[i + 1]);
  if (!fs.existsSync(a) || !fs.existsSync(b)) { add('FAIL', `scene ${names[i]}→${names[i + 1]}: a clip is missing`); continue; }

  if (ARCH_A) {
    // Legs chain directly: leg i+1's frame 0 was rendered FROM leg i's last frame.
    compare(`${names[i]} → ${names[i + 1]}`, frame(a, 'last'), frame(b, 'first'), T.startDetail);
    continue;
  }

  const c = conn(i + 1);
  if (!c) {
    add('warn', `${names[i]} → ${names[i + 1]}: no connector`, 'the engine crossfades this seam directly — intentional only if a connector could not be generated');
    continue;
  }
  compare(`${names[i]} → conn${i + 1} (start)`, frame(a, 'last'), frame(c, 'first'), T.startDetail);
  compare(`conn${i + 1} → ${names[i + 1]} (end)`, frame(c, 'last'), frame(b, 'first'), T.endDetail);
}

// Velocity check: architecture B reverses camera direction at every seam. That
// reads as intentional in a miniature world and as a rewind stutter in a
// grounded one — worth restating where it will actually be seen.
if (!ARCH_A && names.length > 1) {
  add('warn', 'architecture B reverses camera direction at each seam',
    'Intentional for diorama/miniature worlds. In a grounded or photoreal direction this reads as a rewind — architecture A has no connectors and never reverses.');
}

fs.rmSync(tmp, { recursive: true, force: true });

if (JSONOUT) {
  console.log(JSON.stringify({ scenes: names, arch: ARCH_A ? 'A' : 'B', findings: results }, null, 2));
} else {
  const icon = { pass: '  ✓', warn: '  !', FAIL: '  ✗' };
  results.forEach((r) => console.log(`${icon[r.level]} ${r.name}${r.detail ? `\n       ${r.detail}` : ''}`));
  const fails = results.filter((r) => r.level === 'FAIL').length;
  const warns = results.filter((r) => r.level === 'warn').length;
  console.log('\n' + (fails ? `${fails} FAILED, ${warns} warning(s)` : warns ? `seams hold, ${warns} warning(s)` : 'seams hold') + '\n');
}

process.exit(results.some((r) => r.level === 'FAIL') ? 1 : 0);
