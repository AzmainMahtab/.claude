/**
 * provenance.mjs — is this media a placeholder?
 *
 * The one rule: the marker lives INSIDE the media file, never in a sidecar.
 *
 * A manifest listing the placeholders fails in the wrong direction — delete the
 * manifest, keep the files, and every gate goes green. A tag embedded in the
 * bytes can only disappear by REPLACING THE FILE, which is exactly the action
 * that makes shipping safe. Same fallback logic as the tier model: the failure
 * mode has to point at the safe outcome, not the convenient one.
 *
 * Detection is a raw byte scan, not ffprobe. The marker is plain ASCII inside a
 * metadata atom/chunk, so a scan finds it without spawning anything — which
 * keeps budget.mjs dependency-free and lets the same function work on a Buffer
 * pulled off the wire.
 */

import fs from 'node:fs';

export const MARKER = 'SCROLL_PLACEHOLDER_V1';

/* Scan window. MP4s written with -movflags +faststart carry `moov` (and the
   ©cmt atom inside it) at the front — measured at byte ~1.5K on a real encode.
   The tail window catches a file muxed without faststart, where moov lands last.
   Between them this costs 1.25 MB of reads on a clip of any size. */
const HEAD = 1024 * 1024;
const TAIL = 256 * 1024;

export function bufferHasMarker(buf) {
  return Buffer.isBuffer(buf) ? buf.includes(MARKER) : false;
}

/** ffmpeg args that stamp a container-level comment. MP4/MOV/WebM honour this. */
export function stampArgs(note = '') {
  return ['-metadata', `comment=${MARKER}${note ? ' ' + note : ''}`];
}

export function fileHasMarker(file) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const { size } = fs.fstatSync(fd);

    const headLen = Math.min(HEAD, size);
    const head = Buffer.alloc(headLen);
    fs.readSync(fd, head, 0, headLen, 0);
    if (bufferHasMarker(head)) return true;

    if (size > HEAD) {
      const tailLen = Math.min(TAIL, size - HEAD);
      const tail = Buffer.alloc(tailLen);
      fs.readSync(fd, tail, 0, tailLen, size - tailLen);
      if (bufferHasMarker(tail)) return true;
    }
    return false;
  } catch {
    return false;
  } finally {
    if (fd !== undefined) try { fs.closeSync(fd); } catch {} // eslint-disable-line
  }
}

/* ---------------------------------------------------------------- PNG ----- *
 * ffmpeg's PNG muxer silently ignores -metadata — verified, it writes no tEXt
 * chunk — so stills are stamped by hand. A tEXt chunk is length + 'tEXt' +
 * 'Comment\0<text>' + CRC32, inserted before IEND. Any decoder ignores it.     */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function stampPng(file, note = '') {
  const png = fs.readFileSync(file);
  const idx = png.lastIndexOf(Buffer.from('IEND'));
  if (idx < 4) throw new Error(`not a PNG (no IEND): ${file}`);

  const text = Buffer.from(`Comment\0${MARKER}${note ? ' ' + note : ''}`, 'latin1');
  const type = Buffer.from('tEXt', 'latin1');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(text.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([type, text])), 0);

  // IEND's own 4-byte length field precedes its type; splice in just before it.
  const cut = idx - 4;
  fs.writeFileSync(file, Buffer.concat([png.subarray(0, cut), len, type, text, crc, png.subarray(cut)]));
}

/** Every placeholder in a directory tree. Cheap enough to run in a gate. */
export function findPlaceholders(files) {
  return files.filter((f) => /\.(mp4|webm|mov|png|jpe?g|webp|avif)$/i.test(f) && fileHasMarker(f));
}
