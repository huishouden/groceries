import type { Auth } from 'firebase/auth';
import { getLang } from '@huishouden/pwa-kit/i18n';
import { readProductPhotos, type ProductReading } from '@huishouden/pwa-kit/product-photo';
import { ALL_CATEGORIES } from '../data/model';
import { useEmulators } from './firebase';

import { EMULATOR_PHOTO_ENDPOINT } from './photoEndpoint';

/**
 * The Worker that reads product names from photos (huishouden/calendar, `VITE_CALENDAR_URL`); none
 * means Add by photo is not offered.
 */
export const PHOTO_ENDPOINT: string = import.meta.env.VITE_CALENDAR_URL || (useEmulators ? EMULATOR_PHOTO_ENDPOINT : '');

/** Reads products from photos as the signed-in person, for their household (pwa-kit `readProductPhotos`). */
export function readPhotos(files: File[], auth: Auth, household: string): Promise<ProductReading> {
  return readProductPhotos(files, {
    endpoint: PHOTO_ENDPOINT,
    household,
    idToken: async () => {
      const user = auth.currentUser;
      if (!user) throw new Error('signed out');
      return user.getIdToken();
    },
    categories: ALL_CATEGORIES,
    lang: getLang(),
  });
}
