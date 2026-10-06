#!/usr/bin/env node
/**
 * test-placeholder.mjs — assertions over the placeholder provenance chain.
 *
 *   npm test
 *
 * Pins the one assumption the whole guard rests on: that a marker stamped into
 * source media SURVIVES encode.sh and is still there in the shipped file. That
 * holds only because enc_one() passes no -map_metadata, so ffmpeg's default
 * (copy global metadata from input 0) applies. Someone adding `-map_metadata -1`
 * to enc_one for hygiene would blind every gate in the skill and nothing else
 * would notice — hence a test rather than a comment.
 *
 * Also asserts the guard is SPECIFIC: real media must pass. A gate that is always
 * red teaches people to ignore it.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { MARKER, fileHasMarker, stampPng, stampArgs } from './lib/provenance.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scroll-prov-'));

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}${detail ? `  ${detail}` : ''}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? `  ${detail}` : ''}`); }
};

const run = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8' });
if (!run('ffmpeg', ['-version']).stdout) { console.error('ffmpeg not on PATH'); process.exit(3); }

console.log('\ntest-placeholder\n');

/* A spec small enough to be fast, real enough to exercise both clip kinds. */
const spec = {
  brand: 'Test', style: 'clay', bg: '#101820', palette: 'a, b', arch: 'b',
  diveDur: 1, connDur: 1,
  scenes: [{ id: 'one', subject: 's1', focal: 'f1' }, { id: 'two', subject: 's2', focal: 'f2' }],
};
const specPath = path.join(root, 'scenes.json');
fs.writeFileSync(specPath, JSON.stringify(spec));

const work = path.join(root, 'work');
const gen = run('node', [path.join(HERE, 'placeholder.mjs'), '--spec', specPath, '--out', work]);
ok('generator exits 0', gen.status === 0, gen.status === 0 ? '' : (gen.stderr || '').slice(0, 120));

const clips = fs.readdirSync(work).filter((f) => f.endsWith('.mp4'));
const pngs = fs.readdirSync(work).filter((f) => f.endsWith('.png'));
ok('generates a clip per dive and connector', clips.length === 3, `${clips.length} clips`);
ok('every generated clip is stamped', clips.every((f) => fileHasMarker(path.join(work, f))));
ok('every generated still is stamped', pngs.length === 2 && pngs.every((f) => fileHasMarker(path.join(work, f))));

/* A stamped PNG must still be a valid PNG — the chunk is spliced by hand. */
const probe = run('ffprobe', ['-v', 'error', '-show_entries', 'stream=width', '-of', 'csv=p=0', path.join(work, pngs[0])]);
ok('stamped PNG still decodes', (probe.stdout || '').trim().length > 0, (probe.stdout || '').trim());

/* THE LOAD-BEARING ONE. */
const out = path.join(root, 'out');
const enc = run('bash', [path.join(HERE, 'encode.sh'), work, out]);
const encoded = fs.existsSync(out) ? fs.readdirSync(out).filter((f) => f.endsWith('.mp4')) : [];
ok('encode.sh produced output', encoded.length > 0, `${encoded.length} files`);
ok('stamp SURVIVES encode.sh (enc_one must not strip metadata)',
  encoded.length > 0 && encoded.every((f) => fileHasMarker(path.join(out, f))),
  `${encoded.filter((f) => fileHasMarker(path.join(out, f))).length}/${encoded.length} retained`);

/* The gate fires... */
const bad = run('node', [path.join(HERE, 'budget.mjs'), out]);
ok('budget.mjs exits non-zero on placeholder media', bad.status === 1, `exit=${bad.status}`);
ok('budget.mjs names the marker', (bad.stdout || '').includes(MARKER));

/* ...and only on placeholder media. Strip the tag and it must go green, or the
   guard is just a permanent red light. */
const clean = path.join(root, 'clean');
fs.mkdirSync(clean, { recursive: true });
for (const f of encoded) {
  run('ffmpeg', ['-nostdin', '-y', '-loglevel', 'error', '-i', path.join(out, f),
    '-map_metadata', '-1', '-c', 'copy', path.join(clean, f)]);
}
const good = run('node', [path.join(HERE, 'budget.mjs'), clean]);
ok('budget.mjs exits 0 once the stamp is gone', good.status === 0, `exit=${good.status}`);

/* The fail-safe property: replacing a file clears its stamp, with no flag to unset. */
const victim = path.join(out, encoded[0]);
run('ffmpeg', ['-nostdin', '-y', '-loglevel', 'error', '-f', 'lavfi',
  '-i', 'color=c=0x223344:s=320x180:d=1:r=30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', victim]);
ok('replacing a file clears its stamp', !fileHasMarker(victim));

/* And a stamp applied by hand is detected wherever it lands. */
const solo = path.join(root, 'solo.mp4');
run('ffmpeg', ['-nostdin', '-y', '-loglevel', 'error', '-f', 'lavfi',
  '-i', 'color=c=0x000000:s=320x180:d=1:r=30', ...stampArgs('unit'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', solo]);
ok('stampArgs() produces a detectable file', fileHasMarker(solo));

const solop = path.join(root, 'solo.png');
run('ffmpeg', ['-nostdin', '-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=0x000000:s=32x32:d=1', '-frames:v', '1', solop]);
ok('an unstamped PNG reads clean', !fileHasMarker(solop));
stampPng(solop, 'unit');
ok('stampPng() produces a detectable file', fileHasMarker(solop));

fs.rmSync(root, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
