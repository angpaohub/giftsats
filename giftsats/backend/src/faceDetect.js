// ── Marketplace design moderation: face detection ──────────
//
// Used only by POST /api/designs (marketplace submission). Never imported by
// any payment/redeem code path (/api/gift/create, /api/redeem, /api/admin/pay,
// /api/wallet/send, lnd.js) — a bug here cannot touch money.
//
// Library choice, on record: face-api.js (justadudewhohacks) hasn't been
// updated since 2020 and pulls in an old, vulnerable node-fetch (high-severity
// advisory: forwards sensitive headers across redirects, ignores size limits
// after a redirect) via its own bundled @tensorflow/tfjs-core@1.7.0. That
// node-fetch copy lives at node_modules/face-api.js/node_modules/node-fetch —
// physically separate from this project's own node-fetch (used in lnd.js) —
// and its vulnerable code path is tfjs-core's HTTP model loader, which this
// module never calls. We only use loadFromDisk(), so the vulnerable function
// is present in node_modules but unreachable here. Newer alternatives
// (@vladmandic/face-api, modern-face-api) were evaluated and rejected: the
// former hard-requires @tensorflow/tfjs-node (native binary download that
// fails to install in some build environments) or breaks on Node 22 in its
// dependency-free build; the latter is a single-maintainer fork with ~17
// GitHub stars and no track record — worse supply-chain trust than a
// well-known abandoned package with a understood, dormant vulnerability.
//
// SECURITY — do not change this without re-reading the above: the model is
// loaded from a local directory committed to this repo (models/), never from
// a URL. Switching to loadFromUri()/a remote modelUrl would make the
// node-fetch vulnerability reachable again for no real benefit (the model
// never changes at runtime).

import path from 'path';
import { fileURLToPath } from 'url';
import faceapi from 'face-api.js';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODEL_DIR = path.join(__dirname, '..', 'models', 'tiny_face_detector');

const DEFAULT_SCORE_THRESHOLD = 0.5;
const DEFAULT_INPUT_SIZE = 320;

let modelReadyPromise = null;

// Call once at server startup so the first real submission isn't slowed down
// by a cold model load. Safe to call multiple times — loads only once.
export function ensureModelLoaded() {
  if (!modelReadyPromise) {
    modelReadyPromise = faceapi.nets.tinyFaceDetector.loadFromDisk(MODEL_DIR)
      .then(() => console.log('✓ face-detection model loaded (tiny_face_detector, local)'))
      .catch((e) => {
        // Reset so a later call can retry instead of being stuck on a
        // rejected promise forever (e.g. if this ran before the models/
        // directory existed on a fresh checkout).
        modelReadyPromise = null;
        throw e;
      });
  }
  return modelReadyPromise;
}

async function bufferToTensor(buffer) {
  // Decode with sharp first: the *original* file bytes never reach
  // face-api.js/tfjs, only a plain numeric RGB pixel array. A malformed or
  // polyglot upload can at worst confuse sharp (a maintained, regularly
  // patched library), not the unmaintained detection library.
  const { data, info } = await sharp(buffer)
    .rotate() // apply EXIF orientation before we strip metadata downstream
    .removeAlpha()
    .toColorspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true });
  return faceapi.tf.tensor3d(new Uint8Array(data), [info.height, info.width, info.channels]);
}

/**
 * Detects whether an uploaded image contains a face.
 * Returns { hasFace, topScore, count }. Throws if the model or the image
 * can't be loaded/decoded — callers should treat that as "reject the
 * submission", not "let it through" (fail closed on a moderation gate).
 */
export async function detectFace(buffer, { scoreThreshold = DEFAULT_SCORE_THRESHOLD } = {}) {
  await ensureModelLoaded();

  const tensor = await bufferToTensor(buffer);
  try {
    const options = new faceapi.TinyFaceDetectorOptions({
      inputSize: DEFAULT_INPUT_SIZE,
      scoreThreshold,
    });
    const detections = await faceapi.detectAllFaces(tensor, options);
    const topScore = detections.reduce((max, d) => Math.max(max, d.score), 0);
    return { hasFace: detections.length > 0, topScore, count: detections.length };
  } finally {
    tensor.dispose();
  }
}
