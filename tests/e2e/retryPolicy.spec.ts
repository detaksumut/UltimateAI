// tests/e2e/retryPolicy.spec.ts

import { test, expect } from "@playwright/test";
import { RetryPolicy, RetryType } from "../../src/execution/retry/models/RetryPolicy";

test.describe("RetryPolicy Domain Model", () => {

  test.describe("Instantiation", () => {

    test("should create a RetryPolicy with type 'none'", () => {
      const policy = new RetryPolicy({
        type: "none",
        maxAttempts: 1,
        baseDelay: 0,
        maxDelay: 0,
        multiplier: 1,
      });

      expect(policy.type).toBe("none");
      expect(policy.maxAttempts).toBe(1);
      expect(policy.baseDelay).toBe(0);
      expect(policy.maxDelay).toBe(0);
      expect(policy.multiplier).toBe(1);
    });

    test("should create a RetryPolicy with type 'fixed'", () => {
      const policy = new RetryPolicy({
        type: "fixed",
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 1000,
        multiplier: 1,
      });

      expect(policy.type).toBe("fixed");
      expect(policy.maxAttempts).toBe(3);
      expect(policy.baseDelay).toBe(1000);
      expect(policy.maxDelay).toBe(1000);
      expect(policy.multiplier).toBe(1);
    });

    test("should create a RetryPolicy with type 'exponential'", () => {
      const policy = new RetryPolicy({
        type: "exponential",
        maxAttempts: 5,
        baseDelay: 200,
        maxDelay: 10000,
        multiplier: 2,
      });

      expect(policy.type).toBe("exponential");
      expect(policy.maxAttempts).toBe(5);
      expect(policy.baseDelay).toBe(200);
      expect(policy.maxDelay).toBe(10000);
      expect(policy.multiplier).toBe(2);
    });
  });

  test.describe("Immutability", () => {

    test("should be frozen after construction", () => {
      const policy = new RetryPolicy({
        type: "none",
        maxAttempts: 1,
        baseDelay: 0,
        maxDelay: 0,
        multiplier: 1,
      });

      expect(Object.isFrozen(policy)).toBe(true);
    });

    test("should reject property mutation at runtime", () => {
      const policy = new RetryPolicy({
        type: "fixed",
        maxAttempts: 3,
        baseDelay: 500,
        maxDelay: 5000,
        multiplier: 1,
      });

      // In strict mode, assigning to a frozen property throws.
      // In non-strict mode the assignment silently fails.
      // Either way, the value must remain unchanged.
      expect(() => {
        (policy as any).maxAttempts = 99;
      }).toThrow();
      expect(policy.maxAttempts).toBe(3);
    });

    test("should reject adding new properties", () => {
      const policy = new RetryPolicy({
        type: "exponential",
        maxAttempts: 5,
        baseDelay: 100,
        maxDelay: 8000,
        multiplier: 2,
      });

      expect(() => {
        (policy as any).newProp = "should not work";
      }).toThrow();
    });
  });

  test.describe("RetryType values", () => {

    test("should accept all valid RetryType values", () => {
      const types: RetryType[] = ["none", "fixed", "exponential"];

      for (const t of types) {
        const policy = new RetryPolicy({
          type: t,
          maxAttempts: 1,
          baseDelay: 0,
          maxDelay: 0,
          multiplier: 1,
        });
        expect(policy.type).toBe(t);
      }
    });
  });

  test.describe("Property preservation", () => {

    test("should preserve all constructor values exactly", () => {
      const params = {
        type: "exponential" as RetryType,
        maxAttempts: 10,
        baseDelay: 250,
        maxDelay: 30000,
        multiplier: 1.5,
      };

      const policy = new RetryPolicy(params);

      expect(policy.type).toBe(params.type);
      expect(policy.maxAttempts).toBe(params.maxAttempts);
      expect(policy.baseDelay).toBe(params.baseDelay);
      expect(policy.maxDelay).toBe(params.maxDelay);
      expect(policy.multiplier).toBe(params.multiplier);
    });
  });
});
