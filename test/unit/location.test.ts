import { afterEach, describe, expect, test, vi } from 'vitest';
import type { HouseholdHome } from '@huishouden/pwa-kit/home';
import { storesByDistance, type StoreLayout } from '../../src/data/stores';
import { distanceOrigin } from '../../src/lib/location';

// An invented home and stores in Springfield, Illinois.
const HOME: HouseholdHome = { address: '12 Example Lane, Springfield, Illinois 62701', lat: 39.7817, lng: -89.6501, setBy: 'alex@example.com', updatedAt: 0 };
const store = (id: string, location: { lat: number; lng: number } | null): StoreLayout => ({ id, name: id, categoryOrder: [], aisleLabels: {}, location, createdAt: 0 });
const FAR = store('far', { lat: 39.77, lng: -89.68 });
const NEAR = store('near', { lat: 39.79, lng: -89.644 });
const NOWHERE = store('nowhere', null);

/** A browser whose location permission is `state`; a position read answers (40, -75) or fails. */
function browser(state: PermissionState | 'unsupported', fails = false) {
  const getCurrentPosition = vi.fn((ok: PositionCallback, fail: PositionErrorCallback) =>
    fails ? fail({ code: 3 } as GeolocationPositionError) : ok({ coords: { latitude: 40, longitude: -75 } } as GeolocationPosition),
  );
  vi.stubGlobal('window', {});
  vi.stubGlobal('navigator', state === 'unsupported' ? {} : { geolocation: { getCurrentPosition }, permissions: { query: async () => ({ state }) } });
  return getCurrentPosition;
}

afterEach(() => vi.unstubAllGlobals());

describe('storesByDistance', () => {
  test('nearest first with metres; stores without a location follow in their order', () => {
    const { stores, meters } = storesByDistance([NOWHERE, FAR, NEAR], { lat: HOME.lat, lng: HOME.lng });
    expect(stores.map((s) => s.id)).toEqual(['near', 'far', 'nowhere']);
    expect(meters.get('near')).toBeGreaterThan(1000);
    expect(meters.get('near')).toBeLessThan(1100);
    expect(meters.get('far')).toBeGreaterThan(2800);
    expect(meters.has('nowhere')).toBe(false);
  });

  test('with nowhere to measure from, the usual order and no distances', () => {
    const { stores, meters } = storesByDistance([FAR, NEAR], null);
    expect(stores.map((s) => s.id)).toEqual(['far', 'near']);
    expect(meters.size).toBe(0);
  });
});

describe('distanceOrigin', () => {
  test('location allowed: from the device', async () => {
    browser('granted');
    expect(await distanceOrigin(HOME)).toEqual({ point: { lat: 40, lng: -75 }, from: 'here' });
  });

  test('not allowed, off or unsupported: from home, without asking', async () => {
    for (const state of ['prompt', 'denied', 'unsupported'] as const) {
      const read = browser(state);
      expect(await distanceOrigin(HOME)).toEqual({ point: { lat: HOME.lat, lng: HOME.lng }, from: 'home' });
      expect(read).not.toHaveBeenCalled();
    }
  });

  test('allowed but no fix: from home', async () => {
    browser('granted', true);
    expect(await distanceOrigin(HOME)).toMatchObject({ from: 'home' });
  });

  test('neither: nothing to measure from', async () => {
    browser('denied');
    expect(await distanceOrigin(undefined)).toBeNull();
  });
});
