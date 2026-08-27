// src/production/logger/__tests__/CanonicalSerializer.test.ts
import { canonicalSerialize } from "../CanonicalSerializer";
import { LogEntry } from "../LogEntry";

describe('CanonicalSerializer', () => {
  const makeEntry = (payload: any): LogEntry => ({
    timestamp: Date.now(),
    type: 'TEST',
    entityId: 'entity-1',
    payload,
  });

  test('determinism – same object serializes identically 1000 times', () => {
    const entry = makeEntry({ a: 1, b: 'x', c: true });
    const first = canonicalSerialize(entry);
    for (let i = 0; i < 1000; i++) {
      expect(canonicalSerialize(entry)).toBe(first);
    }
  });

  test('property-order independence', () => {
    const obj1 = { b: 2, a: 1 } as any;
    const obj2 = { a: 1, b: 2 } as any;
    const entry1 = makeEntry(obj1);
    const entry2 = makeEntry(obj2);
    expect(canonicalSerialize(entry1)).toBe(canonicalSerialize(entry2));
  });

  test('recursive determinism – nested objects', () => {
    const nested = { a: { d: 4, c: 3 }, b: 2 } as any;
    const reordered = { b: 2, a: { c: 3, d: 4 } } as any;
    const entry1 = makeEntry(nested);
    const entry2 = makeEntry(reordered);
    expect(canonicalSerialize(entry1)).toBe(canonicalSerialize(entry2));
  });

  test('canonical equality test (different order, same structure)', () => {
    const obj1 = { b: 2, a: { d: 4, c: 3 } } as any;
    const obj2 = { a: { c: 3, d: 4 }, b: 2 } as any;
    const entry1 = makeEntry(obj1);
    const entry2 = makeEntry(obj2);
    expect(canonicalSerialize(entry1)).toBe(canonicalSerialize(entry2));
  });

  test('nested arrays preserve order', () => {
    const payload = [
      { b: 1, a: 2 },
      { d: 4, c: 3 }
    ];
    const entry = makeEntry(payload);
    const json = canonicalSerialize(entry);
    const parsed = JSON.parse(json);
    expect(parsed.payload[0]).toEqual({ a: 2, b: 1 });
    expect(parsed.payload[1]).toEqual({ c: 3, d: 4 });
  });

  test('empty array and empty object handling', () => {
    const entry = makeEntry({ emptyArr: [], emptyObj: {} });
    const json = canonicalSerialize(entry);
    const parsed = JSON.parse(json);
    expect(parsed.payload.emptyArr).toEqual([]);
    expect(parsed.payload.emptyObj).toEqual({});
  });

  test('undefined omitted, null preserved', () => {
    const entry = makeEntry({ present: 'yes', missing: undefined, nil: null } as any);
    const json = canonicalSerialize(entry);
    const parsed = JSON.parse(json);
    expect(parsed.payload).toHaveProperty('present', 'yes');
    expect(parsed.payload).not.toHaveProperty('missing');
    expect(parsed.payload).toHaveProperty('nil', null);
  });

  test('primitive values handling', () => {
    const entry = makeEntry({ str: 'text', num: 42, bool: false });
    const json = canonicalSerialize(entry);
    const parsed = JSON.parse(json);
    expect(parsed.payload).toMatchObject({ str: 'text', num: 42, bool: false });
  });

  test('unicode support', () => {
    const entry = makeEntry({ cjk: '你好', rtl: 'مرحبا', emoji: '😀' });
    const json = canonicalSerialize(entry);
    const parsed = JSON.parse(json);
    expect(parsed.payload.cjk).toBe('你好');
    expect(parsed.payload.rtl).toBe('مرحبا');
    expect(parsed.payload.emoji).toBe('😀');
  });

  test('date serialized to ISO-8601', () => {
    const now = new Date();
    const entry = makeEntry({ ts: now });
    const json = canonicalSerialize(entry);
    const parsed = JSON.parse(json);
    expect(parsed.payload.ts).toBe(now.toISOString());
  });

  test('mutation safety – input unchanged after serialization', () => {
    const payload = { a: 1, b: { c: 2 } } as any;
    const entry = makeEntry(payload);
    const original = JSON.stringify(entry);
    canonicalSerialize(entry);
    expect(JSON.stringify(entry)).toBe(original);
  });

  test('idempotency – serialize → parse → serialize yields identical string', () => {
    const entry = makeEntry({ a: 1, b: { c: 2 } });
    const first = canonicalSerialize(entry);
    const parsed = JSON.parse(first);
    const second = canonicalSerialize(parsed as any);
    expect(second).toBe(first);
  });

  test('large payload performance benchmark (non‑blocking)', () => {
    const large: any = {};
    for (let i = 0; i < 200; i++) {
      large['key' + i] = i;
    }
    const entry = makeEntry(large);
    const start = Date.now();
    canonicalSerialize(entry);
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(200);
  });

  test('deep nesting determinism', () => {
    const deep = { a: { b: { c: { d: { e: { f: 1 } } } } } } as any;
    const entry = makeEntry(deep);
    const json = canonicalSerialize(entry);
    const parsed = JSON.parse(json);
    expect(parsed.payload).toEqual(deep);
  });
});
