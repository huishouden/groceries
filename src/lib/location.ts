import { useEffect, useState } from 'react';
import { getHome, type HouseholdHome } from '@huishouden/pwa-kit/home';
import { useHome } from '@huishouden/pwa-kit/react/home';
import type { GeoPoint } from '../data/stores';

declare global {
  interface Window {
    /** Browser tests stand in for the device's position. */
    __mockPosition?: { lat: number; lon: number };
  }
}

/** Whether location may be read without asking ('granted'), would ask ('prompt'), or is off. */
export async function locationPermission(): Promise<PermissionState | 'unsupported'> {
  if (window.__mockPosition) return 'granted';
  if (!('geolocation' in navigator)) return 'unsupported';
  try {
    return (await navigator.permissions.query({ name: 'geolocation' })).state;
  } catch {
    return 'prompt';
  }
}

/**
 * Where the device is now. Asks for permission the first time; read only on demand or when the
 * app comes to the foreground, never stored (DESIGN.md, "Use where you are").
 */
export function currentPosition({ fresh = false }: { fresh?: boolean } = {}): Promise<GeoPoint> {
  if (window.__mockPosition) return Promise.resolve({ lat: window.__mockPosition.lat, lng: window.__mockPosition.lon });
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition((p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }), reject, {
      enableHighAccuracy: fresh,
      timeout: 10_000,
      maximumAge: fresh ? 0 : 60_000,
    }),
  );
}

/** Where store distances are measured from: the device ("from here") or the household's home. */
export interface DistanceOrigin {
  point: GeoPoint;
  from: 'here' | 'home';
}

/**
 * The device's position when location is already allowed (never asks), else the household's home;
 * null with neither. For ordering and measuring saved stores, not for detecting the store you are in
 * ("At a store?" needs a live fix).
 */
export async function distanceOrigin(home: HouseholdHome | undefined = getHome()): Promise<DistanceOrigin | null> {
  if ((await locationPermission()) === 'granted') {
    try {
      return { point: await currentPosition(), from: 'here' };
    } catch {
      // No fix right now: home will do.
    }
  }
  return home ? { point: { lat: home.lat, lng: home.lng }, from: 'home' } : null;
}

/**
 * `distanceOrigin` while `active` (the Store screen, an item's details): home at once, then the
 * device's position when location is allowed. Read when it becomes active, never in the background.
 */
export function useDistanceOrigin(active: boolean): DistanceOrigin | null {
  const home = useHome();
  const [origin, setOrigin] = useState<DistanceOrigin | null>(null);
  useEffect(() => {
    if (!active) return;
    let current = true;
    setOrigin(home ? { point: { lat: home.lat, lng: home.lng }, from: 'home' } : null);
    void distanceOrigin(home).then((o) => current && setOrigin(o));
    return () => {
      current = false;
    };
  }, [active, home]);
  return origin;
}
