/* ESM entry for motion-gsap.
   runtime/motion-gsap.js is a UMD file so it can also be dropped in with a
   plain <script src> alongside a CDN copy of GSAP. That form has no ESM export,
   so a bundled project imports this instead:

     import { MotionGSAP } from './motion-gsap.mjs';

   The UMD file contains no import/export statements, which makes it valid ESM
   on its own: evaluating it takes the `root.MotionGSAP = factory()` branch
   (`typeof module` is safely "undefined" in a module) and this re-exports it.  */
import './motion-gsap.js';

export const MotionGSAP = globalThis.MotionGSAP;
export default MotionGSAP;
