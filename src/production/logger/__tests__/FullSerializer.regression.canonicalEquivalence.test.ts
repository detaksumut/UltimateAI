// src/production/logger/__tests__/FullSerializer.regression.canonicalEquivalence.test.ts
/**
 * Regression ID: REG-007
 * Requirement: SER-003
 * Sprint: M2
 * Purpose: Ensure canonical equivalence – different property orderings produce identical payloads.
 * Origin:
 *   Regression discovered during CanonicalSerializer development.
 *   Fixed in Sprint M2 Step 2.4.
 */

import { DefaultSerializer } from "../DefaultSerializer";
import { LogEntry } from "../LogEntry";
import { mockCorrelationPolicy } from "../test-utils/serializerTestHelpers";

/** Helper to compare serialized payloads and correlationIds */
function expectEqualSerialized(a: ReturnType<DefaultSerializer['serialize']>, b: ReturnType<DefaultSerializer['serialize']>) {
  expect(a.payload).toBe(b.payload);
  expect(a.id).toBe(b.id);
}

describe("REG-007 Canonical equivalence", () => {
  const serializer = new DefaultSerializer(mockCorrelationPolicy(true));

  test("Case A – object property order does not affect payload", () => {
    const objA = { b: 1, a: 2 } as any;
    const objB = { a: 2, b: 1 } as any;
    const entryA: LogEntry = { timestamp: new Date().toISOString(), level: "info", message: "caseA", payload: objA } as any;
    const entryB: LogEntry = { timestamp: new Date().toISOString(), level: "info", message: "caseA", payload: objB } as any;
    const serA = serializer.serialize(entryA);
    const serB = serializer.serialize(entryB);
    expectEqualSerialized(serA, serB);
  });

  test("Case B – nested object ordering", () => {
    const nestedA = { outer: { y: 2, x: 1 }, z: 3 } as any;
    const nestedB = { outer: { x: 1, y: 2 }, z: 3 } as any;
    const entryA: LogEntry = { timestamp: new Date().toISOString(), level: "debug", message: "caseB", payload: nestedA } as any;
    const entryB: LogEntry = { timestamp: new Date().toISOString(), level: "debug", message: "caseB", payload: nestedB } as any;
    const serA = serializer.serialize(entryA);
    const serB = serializer.serialize(entryB);
    expectEqualSerialized(serA, serB);
  });

  test("Case C – array order preserved, objects inside canonicalized", () => {
    const arrA = [{ b: 2, a: 1 }, { d: 4, c: 3 }] as any[];
    const arrB = [{ a: 1, b: 2 }, { c: 3, d: 4 }] as any[];
    const entryA: LogEntry = { timestamp: new Date().toISOString(), level: "info", message: "caseC", payloadArray: arrA } as any;
    const entryB: LogEntry = { timestamp: new Date().toISOString(), level: "info", message: "caseC", payloadArray: arrB } as any;
    const serA = serializer.serialize(entryA);
    const serB = serializer.serialize(entryB);
    expectEqualSerialized(serA, serB);
    // Verify array order is unchanged
    const parsed = JSON.parse(serA.payload);
    expect(parsed.payloadArray.map((o: any) => o.a)).toEqual([1, 3]);
  });

  test("Case D – metadata order does not affect payload", () => {
    const metaA = { requestId: "req-1", userId: "user-1" } as any;
    const metaB = { userId: "user-1", requestId: "req-1" } as any;
    const entryA: LogEntry = { timestamp: new Date().toISOString(), level: "info", message: "caseD", ...metaA } as any;
    const entryB: LogEntry = { timestamp: new Date().toISOString(), level: "info", message: "caseD", ...metaB } as any;
    const serA = serializer.serialize(entryA);
    const serB = serializer.serialize(entryB);
    expectEqualSerialized(serA, serB);
  });
});
