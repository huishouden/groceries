/**
 * Add by photo against the staging Worker, with the invented photos in e2e/fixtures/photos/: what
 * each photo reads as, and what it cost in Workers AI neurons (the Worker's own count, from the D1
 * total before and after, and the model's tokens). Staging only; it seeds a test household of its
 * own and removes it after (pwa-staging run).
 *
 *   STAGING_WORKER_URL=https://huishouden-calendar-staging.<subdomain>.workers.dev \
 *     bunx pwa-staging run -- bun scripts/photo-probe.ts [photo …]
 *
 * Each photo costs the account's free Workers AI allocation (about 28 neurons of 10,000 a day).
 */
import sharp from 'sharp';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PRODUCT_PHOTO_EDGE, PRODUCT_PHOTO_PATH, type ProductPhotoResponse } from '@huishouden/pwa-kit/product-photo-core';
import { assertStagingProject, mintCustomToken, seedTestHousehold, STAGING_PROJECT } from '@huishouden/pwa-kit/staging';
import { ALL_CATEGORIES } from '../src/data/model';

const worker = process.env.STAGING_WORKER_URL;
if (!worker || !/staging/.test(new URL(worker).hostname)) throw new Error('STAGING_WORKER_URL must name the staging Worker');
const apiKey = process.env.STAGING_VITE_FIREBASE_API_KEY ?? process.env.VITE_FIREBASE_API_KEY;
if (!apiKey) throw new Error('VITE_FIREBASE_API_KEY (staging) is needed to sign the test person in');
assertStagingProject(process.env.VITE_FIREBASE_PROJECT_ID ?? STAGING_PROJECT);

const dir = join(import.meta.dir, '..', 'e2e', 'fixtures', 'photos');
const names = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(dir).filter((f) => f.endsWith('.jpg')).map((f) => f.slice(0, -4));

const household = await seedTestHousehold();
const person = household.users.admin;
const custom = await mintCustomToken({ uid: person.uid, serviceAccount: process.env.HH_STAGING_SA });
const signIn = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: custom, returnSecureToken: true }),
});
const { idToken } = (await signIn.json()) as { idToken?: string };
if (!idToken) throw new Error(`sign-in failed: ${signIn.status}`);

for (const name of names) {
  const jpeg = await sharp(readFileSync(join(dir, `${name}.jpg`)))
    .resize(PRODUCT_PHOTO_EDGE, PRODUCT_PHOTO_EDGE, { fit: 'inside' })
    .jpeg({ quality: 80 })
    .toBuffer();
  const started = Date.now();
  const res = await fetch(`${worker}${PRODUCT_PHOTO_PATH}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ household: household.id, photos: [`data:image/jpeg;base64,${jpeg.toString('base64')}`], categories: ALL_CATEGORIES }),
  });
  const body = (await res.json()) as ProductPhotoResponse;
  console.log(JSON.stringify({ photo: name, kb: Math.round(jpeg.length / 1024), status: res.status, ms: Date.now() - started, ...body }));
}
