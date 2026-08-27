/**
 * Regression ID: REG-002
 * Requirement: SER-003
 * Sprint: M2
 * Purpose: Protect against future regressions in deep nested object handling.
 * Origin:
 *   Regression discovered during CanonicalSerializer development.
 *   Fixed in Sprint M2 Step 2.4.
 */

// src/production/logger/__tests__/FullSerializer.regression.deepNested.test.ts
import { DefaultSerializer } from "../DefaultSerializer";
import { LogEntry } from "../LogEntry";
import { mockCorrelationPolicy, generateNestedObject } from "../test-utils/serializerTestHelpers";

describe("REG-002 – Deep nested objects", () => {
  const serializer = new DefaultSerializer(mockCorrelationPolicy(true));

  test("serializes deeply nested objects without error and remains deterministic", () => {
    const nested = generateNestedObject(10); // depth 10
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: "debug",
      message: "Deep nesting test",
      payload: nested,
    } as any;
    const first = serializer.serialize(entry);
    const second = serializer.serialize(entry);
    expect(first).toEqual(second);
    // Ensure JSON parses correctly and retains structure
    const parsed = JSON.parse(first.payload);
    expect(parsed).toHaveProperty("payload");
    // Verify depth by checking nested property chain existence
    let cur = parsed.payload;
    for (let i = 0; i < 10; i++) {
      expect(cur).toHaveProperty("nested");
      cur = cur.nested;
    }
    expect(cur).toHaveProperty("leaf", true);
  });
});
