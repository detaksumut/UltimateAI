// src/production/logger/__tests__/CanonicalSerializer.branchCoverage.test.ts
import { canonicalSerialize } from "../CanonicalSerializer";
import { LogEntry } from "../LogEntry";

describe('CanonicalSerializer branch coverage', () => {
  test('Array containing undefined serializes undefined as null', () => {
    const entry = {
      timestamp: new Date('2020-01-01T00:00:00Z'),
      level: 'info',
      message: 'test',
      data: [undefined, 'value'] as any,
    } as any;
    const result = canonicalSerialize(entry as LogEntry);
    expect(result).toContain('[null,"value"]');
  });

  test('Object property with Symbol falls back to JSON.stringify and becomes null', () => {
    const entry = {
      timestamp: new Date('2020-01-01T00:00:00Z'),
      level: 'info',
      message: 'symbol test',
      meta: Symbol('test') as any,
    } as any;
    const result = canonicalSerialize(entry as LogEntry);
    expect(result).toContain('"meta":null');
  });
});
