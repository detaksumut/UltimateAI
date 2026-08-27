/**
 * Regression ID: REG-003
 * Requirement: SER-003
 * Sprint: M2
 * Purpose: Protect against future regressions in canonical ordering of objects and arrays.
 * Origin:
 *   Regression discovered during CanonicalSerializer development.
 *   Fixed in Sprint M2 Step 2.4.
 */

// src/production/logger/__tests__/FullSerializer.regression.canonicalOrdering.test.ts
import { DefaultSerializer } from "../DefaultSerializer";
import { LogEntry } from "../LogEntry";
import { mockCorrelationPolicy, generateArrayOfObjects } from "../test-utils/serializerTestHelpers";

describe("REG-003 – Array/object canonical ordering", () => {
  const serializer = new DefaultSerializer(mockCorrelationPolicy(true));

  test("object keys are sorted and array order preserved", () => {
    // Object with keys out of alphabetical order
    const outOfOrderObj = { b: 2, a: 1, d: 4, c: 3 } as any;
    const arrayObjs = generateArrayOfObjects(3);
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: "info",
      message: "Ordering test",
      payloadObj: outOfOrderObj,
      payloadArray: arrayObjs,
    } as any;
    const serialized = serializer.serialize(entry);
    const parsed = JSON.parse(serialized.payload);
    // Verify object keys are sorted alphabetically
    expect(Object.keys(parsed.payloadObj)).toEqual(["a", "b", "c", "d"]);
    // Verify array order unchanged
    expect(parsed.payloadArray.map((o: any) => o.a)).toEqual([0, 1, 2]);
  });
});
