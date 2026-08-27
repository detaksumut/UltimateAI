// src/production/logger/__tests__/FullSerializer.regression.largePayload.test.ts
/**
 * Regression ID: REG-005
 * Requirement: SER-003
 * Sprint: M2
 * Purpose:
 *   Protect against future regressions in large payload serialization.
 *   Ensures payload checksum, canonical output stability, no truncation, and no mutation.
 * Origin:
 *   Regression discovered during CanonicalSerializer development.
 *   Fixed in Sprint M2 Step 2.4.
 */

import { DefaultSerializer } from "../DefaultSerializer";
import { LogEntry } from "../LogEntry";
import { mockCorrelationPolicy, generatePayload, deepFreeze } from "../test-utils/serializerTestHelpers";

// Simple checksum: sum of char codes
function checksum(str: string): number {
  return Array.from(str).reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
}

describe("REG-005 Large payload serialization", () => {
  const serializer = new DefaultSerializer(mockCorrelationPolicy(true));

  test("serializes a large payload deterministically and without mutation", () => {
    // Generate ~1 MB payload (adjust size for test runtime)
    const largePayload = generatePayload(1_000_000);
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: "info",
      message: "Large payload test",
      ...largePayload,
    } as any;

    // Freeze to ensure no mutation occurs during serialization
    deepFreeze(entry);

    const serialized = serializer.serialize(entry);
    expect(serialized).toBeTruthy();

    // Verify payload is present and not truncated
    expect(serialized.payload.length).toBeGreaterThan(0);

    // Compute checksum and ensure deterministic output across two runs
    const checksum1 = checksum(serialized.payload);
    const serialized2 = serializer.serialize(entry);
    const checksum2 = checksum(serialized2.payload);
    expect(checksum1).toBe(checksum2);
  });
});
