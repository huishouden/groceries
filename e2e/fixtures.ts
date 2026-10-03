import { expect, test as base, type BrowserContext, type Page } from '@playwright/test';

const PROJECT = 'demo-huishouden-groceries';

declare global {
  interface Window {
    __testSignIn: (email: string, name: string) => Promise<unknown>;
  }
}

/** Retries until the emulator answers; the hub reports ready before every emulator is listening. */
async function emulatorRequest(url: string, init: RequestInit): Promise<void> {
  const deadline = Date.now() + 60_000;
  for (;;) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return;
      throw new Error(`${res.status} ${await res.text()}`);
    } catch (e) {
      if (Date.now() > deadline) throw e;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

/** Wipes emulator data so every test starts with no users and no households. */
export async function resetEmulators(): Promise<void> {
  await emulatorRequest(`http://127.0.0.1:8180/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  await emulatorRequest(`http://127.0.0.1:9199/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
}

/**
 * Writes the household's food settings as the portal would, bypassing the rules (the emulator's
 * admin access), for the one household in the emulator. People follow @huishouden/pwa-kit/food.
 */
const REST = `http://127.0.0.1:8180/v1/projects/${PROJECT}/databases/(default)/documents`;
const ADMIN = { Authorization: 'Bearer owner' };

/** The id of the one household in the emulator, read with admin access; waits for the app's write to land. */
async function onlyHouseholdId(): Promise<string> {
  const deadline = Date.now() + 15_000;
  for (;;) {
    const list = (await (await fetch(`${REST}/households`, { headers: ADMIN })).json()) as { documents?: { name: string }[] };
    const id = list.documents?.[0]?.name.split('/').pop();
    if (id) return id;
    if (Date.now() > deadline) throw new Error('No household in the emulator yet');
    await new Promise((r) => setTimeout(r, 250));
  }
}

export async function seedFood(people: { id: string; name: string; diets: string[]; avoid: string[]; spice?: string }[]): Promise<void> {
  const headers = { ...ADMIN, 'Content-Type': 'application/json' };
  const household = await onlyHouseholdId();
  const str = (v: string) => ({ stringValue: v });
  const arr = (vs: string[]) => ({ arrayValue: { values: vs.map(str) } });
  const fields = {
    people: {
      arrayValue: {
        values: people.map((p) => ({ mapValue: { fields: { id: str(p.id), name: str(p.name), diets: arr(p.diets), avoid: arr(p.avoid), ...(p.spice ? { spice: str(p.spice) } : {}) } } })),
      },
    },
    pantryAssumed: arr(['salt', 'black pepper', 'common dried herbs and spices', 'cooking oil', 'cooking spray', 'butter']),
    updatedAt: { integerValue: String(Date.now()) },
    by: str('alice@example.com'),
  };
  await emulatorRequest(`${REST}/households/${household}/settings/food`, { method: 'PATCH', headers, body: JSON.stringify({ fields }) });
}

/** Documents in one of the household's collections, read with admin access (for checking writes). */
export async function readHouseholdCollection(name: string): Promise<Record<string, unknown>[]> {
  const household = await onlyHouseholdId();
  const res = (await (await fetch(`${REST}/households/${household}/${name}`, { headers: ADMIN })).json()) as { documents?: { fields: Record<string, { stringValue?: string }> }[] };
  return (res.documents ?? []).map((d) => Object.fromEntries(Object.entries(d.fields).map(([k, v]) => [k, v.stringValue ?? v])));
}

type Value = string | number | boolean | null | Value[] | { [k: string]: Value };
const encode = (v: Value): Record<string, unknown> =>
  v === null
    ? { nullValue: null }
    : typeof v === 'string'
      ? { stringValue: v }
      : typeof v === 'number'
        ? Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
        : typeof v === 'boolean'
          ? { booleanValue: v }
          : Array.isArray(v)
            ? { arrayValue: { values: v.map(encode) } }
            : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, encode(x)])) } };
const decode = (v: Record<string, unknown>): Value => {
  if ('stringValue' in v) return v.stringValue as string;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue as number;
  if ('booleanValue' in v) return v.booleanValue as boolean;
  if ('arrayValue' in v) return (((v.arrayValue as { values?: Record<string, unknown>[] }).values) ?? []).map(decode);
  if ('mapValue' in v) return Object.fromEntries(Object.entries((v.mapValue as { fields?: Record<string, Record<string, unknown>> }).fields ?? {}).map(([k, x]) => [k, decode(x)]));
  return null;
};

/**
 * Writes a document under the one household with admin access, as another app would (Huishouden
 * Tasks' to-dos, its Google Tasks links). `path` is relative to the household: `items/x`.
 */
export async function seedHouseholdDoc(path: string, data: Record<string, Value>): Promise<void> {
  const household = await onlyHouseholdId();
  await emulatorRequest(`${REST}/households/${household}/${path}`, {
    method: 'PATCH',
    headers: { ...ADMIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, encode(v)])) }),
  });
}

/** One household document, read with admin access; null when it does not exist. */
export async function readHouseholdDoc(path: string): Promise<Record<string, Value> | null> {
  const household = await onlyHouseholdId();
  const res = await fetch(`${REST}/households/${household}/${path}`, { headers: ADMIN });
  if (!res.ok) return null;
  const doc = (await res.json()) as { fields?: Record<string, Record<string, unknown>> };
  return Object.fromEntries(Object.entries(doc.fields ?? {}).map(([k, v]) => [k, decode(v)]));
}

export async function signIn(page: Page, email: string, name: string): Promise<void> {
  await page.goto('./');
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
  await page.waitForFunction(() => '__testSignIn' in window);
  await page.evaluate(([e, n]) => window.__testSignIn(e, n), [email, name] as const);
}

/** Adds round-trip latency so server acknowledgements arrive after local writes, as on a real network. */
export async function slowNetwork(context: BrowserContext, page: Page, latencyMs = 600): Promise<void> {
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: latencyMs, downloadThroughput: -1, uploadThroughput: -1 });
}

export async function addItem(page: Page, name: string): Promise<void> {
  await page.getByLabel('New item').fill(name);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.locator('main li', { hasText: name }).first()).toBeVisible();
}

export async function createHousehold(page: Page, timeout = 5_000): Promise<void> {
  await page.getByRole('button', { name: 'Create household' }).click();
  await expect(page.locator('main').getByRole('heading', { name: 'Groceries' })).toBeVisible({ timeout });
}

/** Fails the test on uncaught page errors and Firestore listener errors. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

export const test = base.extend<{ fresh: void; noMapLookups: void }>({
  fresh: [
    async ({}, use) => {
      await resetEmulators();
      await use();
    },
    { auto: true },
  ],
  // Tests never reach the real OpenStreetMap service: no shops nearby unless a test routes one in.
  noMapLookups: [
    async ({ context }, use) => {
      await context.route('https://overpass-api.de/**', (route) => route.fulfill({ json: { elements: [] } }));
      await use();
    },
    { auto: true },
  ],
});

export { expect };
