// src/production/logger/__tests__/FullSerializer.regression.failFast.test.ts
/**
 * Regression ID: REG-006
 * Requirement: SER-003
 * Sprint: M2
 * Purpose: Protect against regressions in the fail‑fast contract of the serializer.
 * Origin:
 *   Regression discovered during CanonicalSerializer development.
 *   Fixed in Sprint M2 Step 2.4.
 */

import { DefaultSerializer } from "../DefaultSerializer";
import { LogEntry } from "../LogEntry";
import * as Canonical from "../CanonicalSerializer";
import { InvalidCorrelationIdError } from "../InvalidCorrelationIdError";

/** Helper to create a policy that returns a specific invalid correlation id */
function policyReturning(value: any): any {
  return {
    computeCorrelationId: (_: LogEntry) => value,
  } as any;
}

describe("REG-006 Fail‑fast regression", () => {
  const invalidScenarios = [
    { name: "empty string", value: "" },
    { name: "null", value: null },
    { name: "undefined", value: undefined },
    { name: "whitespace", value: "   " },
  ];

  invalidScenarios.forEach(({ name, value }) => {
    test(`throws InvalidCorrelationIdError when correlationId is ${name}`, () => {
      const serializer = new DefaultSerializer(policyReturning(value));
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: "info",
        message: "fail‑fast test",
      } as any;

      const spy = jest.spyOn(Canonical, "canonicalSerialize");
      expect(() => serializer.serialize(entry)).toThrow(InvalidCorrelationIdError);
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
