// Verifies backend/src/faceDetect.js — the moderation gate for marketplace
// design submissions (POST /api/designs). No Postgres, no LND, no R2: this
// tests the detection module directly against real image bytes, decoded and
// run through the actual model exactly the way index.js's handler does.
//
// Fixture note: fixtures/ intentionally ships no photo of a real person —
// blank_sample.png (face-api.js's own test asset) and no_face_sample.jpg (a
// generated abstract graphic) cover the "no face" side. The "has a face"
// side needs a real photographic face to mean anything (the model is
// trained on photos, not drawings) — rather than committing someone's
// likeness to this repo, that assertion is opt-in: drop your own photo (a
// selfie you're fine with sitting in test fixtures) at
// fixtures/face_sample.jpg and it runs; otherwise it's skipped, not failed.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { detectFace } from '../src/faceDetect.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, 'fixtures');

const ok = (label, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? ` — ${extra}` : ''}`);
  if (!cond) process.exitCode = 1;
};
const skip = (label, reason) => console.log(`SKIP  ${label} — ${reason}`);

// ── No-face cases (committed fixtures) ────────────────────
const blank = fs.readFileSync(path.join(FIXTURES, 'blank_sample.png'));
const r1 = await detectFace(blank);
ok('blank image → no face detected', r1.hasFace === false, JSON.stringify(r1));

const abstract = fs.readFileSync(path.join(FIXTURES, 'no_face_sample.jpg'));
const r2 = await detectFace(abstract);
ok('abstract graphic → no face detected', r2.hasFace === false, JSON.stringify(r2));

// ── Face case (opt-in fixture — see note above) ───────────
const faceFixturePath = path.join(FIXTURES, 'face_sample.jpg');
if (fs.existsSync(faceFixturePath)) {
  const face = fs.readFileSync(faceFixturePath);
  const r3 = await detectFace(face);
  ok('photo with a face → face detected', r3.hasFace === true, JSON.stringify(r3));
  ok('detection score is a real confidence value', r3.topScore > 0 && r3.topScore <= 1, String(r3.topScore));
} else {
  skip('photo with a face → face detected', `add fixtures/face_sample.jpg to run this assertion (${faceFixturePath})`);
}

// ── Threshold sanity: hasFace and count must always agree, at any
// threshold. (Verified separately, by hand: an unreasonably low threshold
// like 0.01 does produce noise-level false positives even on a blank image
// — ~0.02 confidence "detections" — which is exactly why detectFace()
// defaults to 0.5 and the caller in index.js never overrides it downward.)
const r4 = await detectFace(blank);
ok('default threshold agrees with count', r4.hasFace === (r4.count > 0), JSON.stringify(r4));

// ── Model reuse: loading twice concurrently doesn't double-load or throw
// (index.js calls ensureModelLoaded() at startup AND detectFace() calls it
// again per-request — both must be safe to call repeatedly).
const [a, b] = await Promise.all([detectFace(blank), detectFace(abstract)]);
ok('concurrent detections both complete', a.hasFace === false && b.hasFace === false);

if (process.exitCode) {
  console.log('\nOne or more assertions FAILED.');
} else {
  console.log('\nAll assertions passed (see SKIP lines above for opt-in coverage not run).');
}
