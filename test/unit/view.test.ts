import { describe, expect, it } from 'vitest';
import { resolveView } from '../../src/lib/view';

const saved = { mode: 'hub' as const, list: 'pantry' };
const ids = ['groceries', 'pantry'];

describe('resolveView', () => {
  it('a bare address shows what this device last showed and names it in the address', () => {
    expect(resolveView({ mode: null, list: null }, saved, ids)).toEqual({ mode: 'hub', list: 'pantry', save: {}, address: { mode: 'hub', list: 'pantry' } });
  });

  it('?list= with no mode (a link to an item) opens Lists on that list, and remembers the list', () => {
    expect(resolveView({ mode: null, list: 'groceries' }, saved, ids)).toEqual({
      mode: 'lists',
      list: 'groceries',
      save: { list: 'groceries' },
      address: { mode: 'lists', list: 'groceries' },
    });
  });

  it('an unknown ?mode= falls back to the remembered view', () => {
    expect(resolveView({ mode: 'foo', list: 'groceries' }, saved, ids).mode).toBe('hub');
  });

  it('the address view and list win over the remembered ones and are remembered', () => {
    expect(resolveView({ mode: 'store', list: 'groceries' }, saved, ids)).toEqual({ mode: 'store', list: 'groceries', save: { mode: 'store', list: 'groceries' }, address: null });
  });

  it('a stale or foreign list is corrected in the address and never remembered', () => {
    expect(resolveView({ mode: 'lists', list: 'demo-only' }, saved, ids)).toEqual({ mode: 'lists', list: 'pantry', save: { mode: 'lists' }, address: { mode: 'lists', list: 'pantry' } });
    expect(resolveView({ mode: 'lists', list: 'gone' }, { mode: 'lists', list: 'gone-too' }, ids).list).toBe('groceries');
  });

  it('a list just created is kept while its snapshot is on the way', () => {
    expect(resolveView({ mode: 'lists', list: 'new1' }, saved, ids, 'new1')).toEqual({ mode: 'lists', list: 'new1', save: { mode: 'lists' }, address: null });
  });

  it('before the lists load the list is neither checked nor remembered', () => {
    expect(resolveView({ mode: 'lists', list: 'anything' }, saved, null)).toEqual({ mode: 'lists', list: 'anything', save: { mode: 'lists' }, address: null });
    expect(resolveView({ mode: null, list: null }, saved, null).address).toEqual({ mode: 'hub', list: 'pantry' });
  });
});
