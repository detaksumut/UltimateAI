// src/production/logger/__tests__/ICorrelationPolicy.test.ts
import { ICorrelationPolicy } from "../ICorrelationPolicy";
import { LogEntry } from "../LogEntry";

/**
 * Simple mock implementation for testing the ICorrelationPolicy contract.
 */
class MockCorrelationPolicy implements ICorrelationPolicy {
  computeCorrelationId(entry: LogEntry): string {
    const parts = [entry.type, entry.entityId];
    return `mock-${parts.join('-')}`;
  }
}

test('MockCorrelationPolicy returns deterministic id', () => {
  const policy = new MockCorrelationPolicy();
  const entry: LogEntry = {
    timestamp: Date.now(),
    type: 'TEST',
    entityId: 'entity123',
    payload: {},
  };
  const id = policy.computeCorrelationId(entry);
  expect(typeof id).toBe('string');
  expect(id).toBe('mock-TEST-entity123');
});
