import { calendarError } from '@huishouden/pwa-kit/calendar';
import { popupCancelled } from '@huishouden/pwa-kit/feedback';
import { t } from '../i18n';
/** What went wrong, phrased for the household rather than for a developer. */
export interface FriendlyError {
  kind: 'offline' | 'busy' | 'quota' | 'timeout' | 'verification' | 'permission' | 'empty' | 'cancelled' | 'unknown';
  message: string;
  /** Whether trying the same thing again soon is likely to work. */
  retryable: boolean;
  /** The original error text, shown only behind "Details". */
  detail: string;
}

export type ErrorContext = 'meals' | 'sign-in' | 'save' | 'calendar';

/** Thrown when a reply arrives but contains nothing usable. */
export class EmptyResultError extends Error {
  constructor() {
    super('No usable results');
    this.name = 'EmptyResultError';
  }
}

export class TimeoutError extends Error {
  constructor() {
    super('Timed out');
    this.name = 'TimeoutError';
  }
}

function text(e: unknown): string {
  if (e instanceof Error) {
    const cause = e.cause instanceof Error ? ` (${e.cause.message})` : '';
    return `${e.message}${cause}`;
  }
  return String(e);
}

function code(e: unknown): string {
  return (e as { code?: unknown })?.code?.toString() ?? '';
}

export function friendlyError(e: unknown, context: ErrorContext, online = typeof navigator === 'undefined' || navigator.onLine): FriendlyError {
  const detail = text(e);
  const all = `${code(e)} ${detail}`.toLowerCase();
  const make = (kind: FriendlyError['kind'], message: string, retryable: boolean): FriendlyError => ({ kind, message, retryable, detail });

  if (!online || /network-request-failed|failed to fetch|networkerror|err_internet_disconnected|load failed/.test(all)) {
    return make(
      'offline',
      context === 'meals' ? t('errors.offlineMeals') : t('errors.offline'),
      true,
    );
  }
  if (context === 'calendar') {
    // Google's permission window (Google Identity Services) in the kit's words, like every other app.
    return make(popupCancelled(e) || /access_denied/.test(all) ? 'cancelled' : 'unknown', calendarError(e), true);
  }
  if (/popup-closed-by-user|cancelled-popup-request|access_denied/.test(all)) return make('cancelled', t('errors.signInCancelled'), true);
  if (/user-mismatch/.test(all)) {
    return make('verification', t('errors.sameAccount'), true);
  }
  if (e instanceof TimeoutError || /timed out|timeout|deadline/.test(all)) {
    return make('timeout', t('errors.timeout'), true);
  }
  if (e instanceof EmptyResultError) {
    return make('empty', t('errors.empty'), true);
  }
  // 429 covers both per-minute and per-day limits; only the daily one is worth waiting a day for.
  if (/(quota|resource_exhausted|limit).*(per ?day|daily)|(per ?day|daily).*(quota|limit)/.test(all)) {
    return make('quota', t('errors.quota'), false);
  }
  if (/\[(500|502|503|429)|resource_exhausted|quota|high demand|overloaded|unavailable|is busy/.test(all)) {
    return make('busy', context === 'meals' ? t('errors.busyMeals') : t('errors.busy'), true);
  }
  if (/app.?check|appcheck|recaptcha|unauthenticated|\[403|attestation/.test(all)) {
    return make('verification', t('errors.verify'), true);
  }
  if (/permission-denied|insufficient permissions/.test(all)) {
    return make('permission', t('errors.permission'), false);
  }
  if (context === 'sign-in' && /unauthorized-domain/.test(all)) {
    return make('verification', t('errors.domain'), false);
  }
  return make('unknown', t('errors.unknown'), true);
}

/** Rejects with TimeoutError if `promise` has not settled within `ms`. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError()), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
