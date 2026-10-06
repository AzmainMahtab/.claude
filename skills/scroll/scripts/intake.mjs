#!/usr/bin/env node
/**
 * intake.mjs — the no-subscription path.
 *
 * You have no Monid or Higgsfield CLI. You have a browser tab open on Kling,
 * Runway, Sora, Midjourney, whatever. This turns the interview into every prompt
 * you need as a file, tells you exactly what to feed each render and what to
 * call the result, and then checks what you dropped back in.
 *
 *   node intake.mjs --plan  <workdir> --spec scenes.json
 *   node intake.mjs --check <workdir> --spec scenes.json
 *   node intake.mjs --styles
 *
 * --plan writes:
 *     still_<id>.txt     one per scene   — the scene still
 *     dive_<id>.txt      one per scene   — architecture B
 *     leg_<id>.txt       one per scene   — architecture A
 *     conn_<i>.txt       N-1             — architecture B only
 *     WORKSHEET.md       the render order, conditioning frames, filenames, status
 *
 * --check validates what came back: present, plays, right aspect, right duration,
 * no audio, and — the one that matters — frame 0 actually matches the
 * conditioning frame you handed the tool. A renderer that silently ignored your
 * start image cannot hold its seam, and catching it here costs one re-render
 * instead of poisoning every leg after it.
 *
 * The spec is what the interview produces. Minimal example:
 *
 * {
 *   "brand": "Pearl & Co.",
 *   "style": "clay",
 *   "bg": "#F3EDE3",
 *   "palette": "warm cream, terracotta, sage, deep navy",
 *   "arch": "b",
 *   "diveDur": 8,
 *   "connDur": 5,
 *   "scenes": [
 *     { "id": "farm",  "subject": "a terraced tea farm on a hillside, pickers' baskets, drying racks",
 *       "focal": "the drying racks under the open shed" },
 *     { "id": "shop",  "subject": "a small tea shop counter with brass scales and tins",
 *       "focal": "the brass scales on the counter" }
 *   ]
 * }
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/* Art directions. Ported from lets-scroll's prompts.md (MIT, cyw). The first two
   sentences change; the palette/no-text tail is identical every time, and that
   identical text is what makes the world read as one place. */
const STYLES = {
  clay: {
    label: 'Clay diorama (default)',
    lead: 'Isometric low-poly 3D diorama floating as a small rounded island on a plain solid [BG] background with a soft contact shadow beneath it. Soft matte clay 3D render, rounded toy-model shapes, gentle warm studio lighting, soft long shadows, tilt-shift miniature look.',
    floating: true,
  },
  papercraft: {
    label: 'Flat papercraft',
    lead: 'Isometric layered paper-craft diorama, matte cardstock, clean die-cut edges, subtle drop shadows between layers, floating as a small island on a plain solid [BG] background.',
    floating: true,
  },
  toy: {
    label: 'Glossy vinyl toy',
    lead: 'Isometric glossy vinyl-toy diorama, smooth plastic shading, soft rim light, collectible figurine look, floating as a small island on a plain solid [BG] background.',
    floating: true,
  },
  claymation: {
    label: 'Claymation / stop-motion',
    lead: 'Isometric stop-motion clay set, visible thumbprints, handmade plasticine texture, soft studio softbox light, floating as a small island on a plain solid [BG] background.',
    floating: true,
  },
  neon: {
    label: 'Neon night miniature',
    lead: 'Isometric miniature at night, warm interior glow and neon signage, moody rim light, wet reflective ground, floating as a small island on a plain solid [BG] background.',
    floating: true,
  },
  photoreal: {
    label: 'Photoreal architectural (real estate, hospitality, luxury)',
    lead: 'Ultra-photorealistic architectural photography of a single cohesive [SUBJECT_KIND], cinematic wide-angle, warm golden-hour light, natural materials, restrained designer furnishings, a breathtaking view, editorial magazine quality (Architectural Digest), shallow depth of field, no people.',
    floating: false,
    note: 'Full-bleed, not floating: drop the knockout step, set the page background dark, and the dive glides THROUGH doorways and glass rather than opening a roof. Cohesion comes entirely from the identical preamble — do NOT pass a reference image, it clones the same room. Interiors trip content filters often.',
  },
};

const TAIL = 'Cohesive color palette of [PALETTE]. Highly detailed, centered composition, absolutely no text, no letters, no numbers, no logos.';

/* The motion handoff contract. Both clauses go in verbatim — they are what keeps
   a seam's velocity continuous, and paraphrasing them loses the effect. */
const SETTLE = 'The shot ends by settling into a slow, steady forward drift toward the next destination for the final second.';
const CONTINUE = 'The shot begins by continuing a slow, steady forward drift.';

const argv = process.argv.slice(2);
const has = (n) => argv.includes('--' + n);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i === -1 ? d : argv[i + 1]; };

if (has('styles')) {
  console.log('\nArt directions — pick one, it becomes the style preamble reused in every prompt:\n');
  for (const [k, v] of Object.entries(STYLES)) {
    console.log(`  ${k.padEnd(12)} ${v.label}`);
    if (v.note) console.log(`  ${''.padEnd(12)} ${v.note.replace(/\s+/g, ' ').slice(0, 96)}…`);
  }
  console.log('\nFull text and the tail clause: references/prompts.md\n');
  process.exit(0);
}

const dir = argv.find((a) => !a.startsWith('--') && !argv[argv.indexOf(a) - 1]?.startsWith('--spec'));
const specPath = flag('spec', dir ? path.join(dir, 'scenes.json') : null);
if (!dir || !specPath) {
  console.error('usage: node intake.mjs --plan|--check <workdir> --spec scenes.json');
  console.error('       node intake.mjs --styles');
  process.exit(2);
}
if (!fs.existsSync(specPath)) { console.error(`no spec at ${specPath}`); process.exit(2); }

const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const ARCH = String(spec.arch || 'b').toLowerCase();
const SCENES = spec.scenes || [];
if (!SCENES.length) { console.error('spec has no scenes'); process.exit(2); }
const style = STYLES[spec.style || 'clay'];
if (!style) { console.error(`unknown style "${spec.style}". Run --styles.`); process.exit(2); }
const DIVE_DUR = spec.diveDur || 8;
const CONN_DUR = spec.connDur || 5;

const preamble = (style.lead + ' ' + TAIL)
  .replace(/\[BG\]/g, spec.bg || '#F3EDE3')
  .replace(/\[PALETTE\]/g, spec.palette || 'the brand palette')
  .replace(/\[SUBJECT_KIND\]/g, spec.subjectKind || 'interior');

const legName = ARCH === 'a' ? 'leg' : 'dive';
const W = (f) => path.join(dir, f);

/* ------------------------------------------------------------------ plan --- */
if (has('plan')) {
  fs.mkdirSync(dir, { recursive: true });

  SCENES.forEach((s) => {
    // A floating-island direction locks the background to a flat colour so the
    // scene can be knocked out. A full-bleed one (photoreal) must NOT — an empty
    // backdrop contradicts "a breathtaking view" and produces a studio cutout.
    const framing = style.floating
      ? `The background stays plain solid ${spec.bg || '#F3EDE3'} across the whole frame — empty backdrop: no sky, no clouds, no horizon, no gradient.`
      : `Full-bleed composition that fills the whole frame edge to edge — real environment, real depth, no studio backdrop and no cutout.`;
    fs.writeFileSync(W(`still_${s.id}.txt`),
`${preamble}
Render a wide 3:2 landscape image (at least 1536 px wide). ${framing} Centered composition, nothing essential at the far edges. No text, no letters, no logos.
Subject: ${s.subject}.
`);
  });

  SCENES.forEach((s, i) => {
    if (ARCH === 'a') {
      const move = s.move ? ` ${s.move}` : '';
      fs.writeFileSync(W(`leg_${s.id}.txt`),
`Single continuous cinematic camera move, no cuts.${i === 0 ? '' : ' ' + CONTINUE} Glide smoothly FORWARD into ${s.subject}, never pulling back.${move} ${SETTLE}
${preamble} Smooth graceful slow motion. No text.
`);
    } else {
      // The dive's entry differs by direction: a miniature opens its roof, a
      // photoreal space is entered through its own doorways and glass.
      const entry = style.floating
        ? `Begin high and far looking at the whole scene from outside — ${s.subject} — then descend and fly inside toward ${s.focal || 'the focal point'}, the roof and walls gently opening to reveal the interior.`
        : `Begin outside looking toward ${s.subject}, then glide forward through the doorway or glass and continue inside toward ${s.focal || 'the focal point'}. No roof opens; the camera enters the way a person would.`;
      fs.writeFileSync(W(`dive_${s.id}.txt`),
`Single continuous cinematic camera move, no cuts. ${entry}
${preamble} Smooth graceful slow motion. No text.
`);
    }
  });

  if (ARCH !== 'a') {
    for (let i = 0; i < SCENES.length - 1; i++) {
      const a = SCENES[i], b = SCENES[i + 1];
      // The connector's grammar follows the same split as the dive. A miniature
      // world can be left by rising above it; a photoreal space cannot — an
      // aerial hop across a "miniature world" between two Architectural Digest
      // interiors breaks the one thing holding the film together.
      const hop = style.floating
        ? `Pull up and back out of ${a.subject}, rise into the sky, glide across the connected miniature world, and arrive above ${b.subject}, beginning to descend toward it. Seamless flowing aerial transition.`
        : `Drift smoothly backward out of ${a.subject} and turn through its doorway into a connecting passage of the same building, then continue forward and arrive at the threshold of ${b.subject}, beginning to move toward it. Stay at human eye level throughout — no aerial view, no miniature, no map: the camera travels the way a person walks between two rooms. Seamless flowing transition.`;
      fs.writeFileSync(W(`conn_${i + 1}.txt`),
`Single continuous camera move, no cuts. ${hop}
${preamble} No text.
`);
    }
  }

  /* The worksheet. Everything you need in one table, in render order, with the
     conditioning frames spelled out — because "connector i joins scene i and i+1"
     is exactly the sentence that goes wrong by one. */
  const rows = [];
  SCENES.forEach((s) => rows.push({
    order: rows.length + 1, what: `still · ${s.id}`, prompt: `still_${s.id}.txt`,
    cond: '—', out: `still_${s.id}.png`, spec: '3:2 landscape, ≥1536px wide, solid bg, no text',
  }));
  SCENES.forEach((s, i) => {
    const cond = ARCH === 'a'
      ? (i === 0 ? `still_${s.id}.png` : `last_${SCENES[i - 1].id}.png  ← extract from the PREVIOUS leg first`)
      : `still_${s.id}.png`;
    rows.push({
      order: rows.length + 1, what: `${legName} · ${s.id}`, prompt: `${legName}_${s.id}.txt`,
      cond: `start: ${cond}`, out: `${legName === 'leg' ? 'dive' : 'dive'}_${s.id}.mp4`,
      spec: `16:9, ~${DIVE_DUR}s, no audio, highest quality`,
    });
  });
  if (ARCH !== 'a') {
    for (let i = 0; i < SCENES.length - 1; i++) {
      rows.push({
        order: rows.length + 1, what: `connector ${i + 1}`, prompt: `conn_${i + 1}.txt`,
        cond: `start: last_${SCENES[i].id}.png\nend: first_${SCENES[i + 1].id}.png`,
        out: `conn_${i + 1}.mp4`, spec: `16:9, ~${CONN_DUR}s, no audio`,
      });
    }
  }

  const seq = ARCH === 'a'
    ? `**Legs render SEQUENTIALLY.** Each leg's start frame is extracted from the *previous* leg's finished file, so you cannot batch them. After every leg:\n\n\`\`\`bash\nbash scripts/extract-frames.sh ${dir}\n\`\`\``
    : `**Dives can all be rendered in parallel** — each starts from its own still. Connectors come after, because their endpoints are extracted from the finished dives:\n\n\`\`\`bash\nbash scripts/extract-frames.sh ${dir}\n\`\`\``;

  fs.writeFileSync(W('WORKSHEET.md'),
`# Render worksheet — ${spec.brand || 'untitled'}

**Art direction:** ${style.label}
**Architecture:** ${ARCH === 'a' ? 'A — continuous forward take (no connectors)' : `B — dive + ${style.floating ? 'aerial ' : ''}connector`}
**Scenes:** ${SCENES.length}   **Clips to render:** ${ARCH === 'a' ? SCENES.length : 2 * SCENES.length - 1}
${style.note ? `\n> ${style.note}\n` : ''}
Render these in any tool you like. Save every result into \`${dir}/\` under the exact
filename in the **Save as** column — the rest of the pipeline finds files by name.
${ARCH === 'a' ? `
> The prompt files are named \`leg_*.txt\` but the outputs are \`dive_*.mp4\`. That is
> deliberate, not a typo: everything downstream — \`extract-frames.sh\`, \`seam-check.mjs\`,
> \`encode.sh\` — looks for \`dive_*\`, so both architectures land on the same filenames.
` : ''}

## Your tool must accept a start frame

Every clip after the first is conditioned on a real frame from its neighbour. A tool
that cannot take a start image cannot hold a seam, and no crossfade hides that.
${ARCH === 'a' ? '' : '\nConnectors additionally need an **end** frame. If your tool has no end-frame input,\nswitch to architecture A (no connectors) rather than shipping unseamed joins.\n'}
## The order

${seq}

## Worksheet

| # | What | Prompt file | Feed it | Save as | Spec | Status |
|---|---|---|---|---|---|---|
${rows.map((r) => `| ${r.order} | ${r.what} | \`${r.prompt}\` | ${r.cond.replace(/\n/g, '<br>')} | \`${r.out}\` | ${r.spec} | pending |`).join('\n')}

## When a batch lands

\`\`\`bash
node scripts/intake.mjs --check ${dir} --spec ${path.basename(specPath)}
\`\`\`

It checks each file plays, has the right aspect and duration, carries no audio, and
that **frame 0 actually matches the conditioning frame you handed the tool**. A
renderer that quietly ignored your start image fails here — which costs one
re-render, instead of every leg after it.

Then:

\`\`\`bash
node scripts/seam-check.mjs ${dir} --order ${SCENES.map((s) => s.id).join(',')}${ARCH === 'a' ? ' --arch a' : ''}
bash scripts/encode.sh ${dir} public/scroll
\`\`\`
`);

  console.log(`\nWrote to ${dir}/\n`);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.txt')).sort();
  files.forEach((f) => console.log(`  ${f}`));
  console.log(`  WORKSHEET.md\n`);
  console.log(`Art direction : ${style.label}`);
  console.log(`Architecture  : ${ARCH === 'a' ? 'A — continuous take' : 'B — dive + connector'}`);
  console.log(`To render     : ${ARCH === 'a' ? SCENES.length : 2 * SCENES.length - 1} clips + ${SCENES.length} stills`);
  console.log(`\nOpen ${dir}/WORKSHEET.md and work down it. No CLI needed.\n`);
  process.exit(0);
}

/* ----------------------------------------------------------------- check --- */
if (!has('check')) { console.error('pass --plan or --check'); process.exit(2); }

const results = [];
const add = (level, name, detail) => results.push({ level, name, detail });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'intake-'));

function ff(args) {
  const r = spawnSync('ffmpeg', ['-nostdin', ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  return (r.stdout || '') + (r.stderr || '');
}
function probe(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,duration', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=0', file], { encoding: 'utf8' });
  const out = r.stdout || '';
  const g = (k) => { const m = out.match(new RegExp(`^${k}=(.+)$`, 'm')); return m ? m[1] : null; };
  const a = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a',
    '-show_entries', 'stream=index', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  return {
    w: +g('width'), h: +g('height'),
    dur: parseFloat(g('duration')) || 0,
    audio: (a.stdout || '').trim().length > 0,
  };
}
function psnrFrame0(clip, refPng) {
  const f0 = path.join(tmp, path.basename(clip, '.mp4') + '_f0.png');
  ff(['-v', 'error', '-y', '-ss', '0', '-i', clip, '-frames:v', '1', '-q:v', '2', f0]);
  if (!fs.existsSync(f0)) return null;
  const out = ff(['-v', 'info', '-i', f0, '-i', refPng, '-lavfi',
    '[1:v][0:v]scale2ref=flags=bicubic[b][a];[a]format=gray[ga];[b]format=gray[gb];[ga][gb]psnr',
    '-f', 'null', '-']);
  const m = out.match(/average:\s*([0-9.]+|inf)/i);
  return m ? (m[1] === 'inf' ? 99 : parseFloat(m[1])) : null;
}

/* Two kinds of conditioning frame, and they deserve different strictness.

   CHAINED — the frame was extracted from another clip in this very pipeline, so
   it is the same geometry and the same encoder. A mismatch here is real and it
   cascades into every clip after it. Measured on a good build: 39-40 dB. Fail it.

   FROM A STILL — the still is 3:2 and the clip is 16:9, and a renderer is free
   to letterbox, pillarbox or crop it. Observed in the wild: a correctly obeyed
   start image pillarboxed into 16:9 scores 8 dB against its own still while
   being visibly the same diorama. PSNR cannot answer this one, so report the
   number and the geometry and let a human look. Failing it would be a lie. */
const expect = [];
SCENES.forEach((s) => expect.push({ kind: 'still', file: `still_${s.id}.png`, id: s.id }));
SCENES.forEach((s, i) => expect.push({
  kind: 'clip', file: `${ARCH === 'a' ? 'dive' : 'dive'}_${s.id}.mp4`, id: s.id, dur: DIVE_DUR,
  ...(ARCH === 'a' && i > 0
    ? { cond: `last_${SCENES[i - 1].id}.png`, chained: true }
    : { cond: `still_${s.id}.png`, chained: false }),
}));
if (ARCH !== 'a') {
  for (let i = 0; i < SCENES.length - 1; i++) {
    expect.push({ kind: 'clip', file: `conn_${i + 1}.mp4`, id: `conn${i + 1}`, dur: CONN_DUR,
      cond: `last_${SCENES[i].id}.png`, chained: true });
  }
}

console.log(`\nIntake check — ${dir}  (architecture ${ARCH.toUpperCase()}, ${SCENES.length} scenes)\n`);

for (const e of expect) {
  const p = W(e.file);
  if (!fs.existsSync(p)) { add('warn', `${e.file} not delivered yet`, 'still pending on the worksheet'); continue; }

  if (e.kind === 'still') {
    const i = probe(p);
    if (!i.w) { add('FAIL', `${e.file} will not decode`); continue; }
    const ratio = i.w / i.h;
    if (i.w < 1200) add('FAIL', `${e.file} is only ${i.w}px wide`, 'needs ≥1536px (1200 tolerated); it is the conditioning frame for a whole clip');
    else if (Math.abs(ratio - 1.5) > 0.08) add('warn', `${e.file} is ${ratio.toFixed(2)}:1`, 'expected 3:2 (1.50) — a different aspect changes the video output aspect too');
    else add('pass', `${e.file}`, `${i.w}×${i.h}`);
    continue;
  }

  const i = probe(p);
  if (!i.w) { add('FAIL', `${e.file} will not decode`); continue; }
  const problems = [], notes = [];

  // encode.sh strips audio with -an, so this costs nothing downstream. Worth
  // saying, not worth failing.
  if (i.audio) notes.push('carries an audio track — encode.sh strips it');

  const ratio = i.w / i.h;
  if (Math.abs(ratio - 16 / 9) > 0.12) problems.push(`aspect ${ratio.toFixed(2)}:1, expected 16:9`);
  if (e.dur && Math.abs(i.dur - e.dur) > Math.max(1.5, e.dur * 0.3))
    problems.push(`${i.dur.toFixed(1)}s, expected ~${e.dur}s`);

  // The check that earns this script its place — but only where it is valid.
  let lock = null;
  const ref = e.cond ? W(e.cond) : null;
  if (ref && fs.existsSync(ref)) {
    lock = psnrFrame0(p, ref);
    if (lock === null) {
      notes.push('could not compare frame 0 to its conditioning frame');
    } else if (e.chained) {
      if (lock < 22) problems.push(`frame 0 does NOT match ${e.cond} (${lock.toFixed(1)} dB) — the tool ignored your start image. Re-render; do NOT chain from this, it poisons every clip after it`);
    } else if (lock < 22) {
      const refI = probe(ref);
      const refRatio = refI.w && refI.h ? refI.w / refI.h : 0;
      notes.push(
        `frame 0 reads ${lock.toFixed(1)} dB against ${e.cond}` +
        (refRatio && Math.abs(refRatio - ratio) > 0.1
          ? ` — expected, the still is ${refRatio.toFixed(2)}:1 and the clip is ${ratio.toFixed(2)}:1, so the tool letterboxed or cropped it. Open both and confirm it is the same scene. To get a tight lock instead, pad the still onto a 16:9 canvas before feeding it.`
          : ' — open both and confirm it is the same scene; PSNR cannot settle a reframe')
      );
    }
  }

  if (problems.length) add('FAIL', e.file, problems.join('; '));
  else add('pass', e.file, `${i.w}×${i.h}, ${i.dur.toFixed(1)}s` +
    (lock !== null && e.chained ? `, frame 0 locked at ${lock.toFixed(1)} dB` : '') +
    (notes.length ? `\n       · ${notes.join('\n       · ')}` : ''));
}

fs.rmSync(tmp, { recursive: true, force: true });

const icon = { pass: '  ✓', warn: '  ·', FAIL: '  ✗' };
results.forEach((r) => console.log(`${icon[r.level]} ${r.name}${r.detail ? `\n       ${r.detail}` : ''}`));
const fails = results.filter((r) => r.level === 'FAIL').length;
const pend = results.filter((r) => r.level === 'warn').length;
const done = results.filter((r) => r.level === 'pass').length;
console.log(`\n${done} accepted, ${pend} still pending, ${fails} need re-rendering\n`);
if (!fails && !pend) {
  console.log(`All in. Next:\n  node scripts/seam-check.mjs ${dir} --order ${SCENES.map((s) => s.id).join(',')}${ARCH === 'a' ? ' --arch a' : ''}\n`);
}
process.exit(fails ? 1 : 0);
