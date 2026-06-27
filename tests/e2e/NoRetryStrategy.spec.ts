// tests/e2e/NoRetryStrategy.spec.ts

import { test, expect } from "@playwright/test";
import { NoRetryStrategy } from "../../src/execution/retry/strategies/NoRetryStrategy";
import { RetryContext } from "../../src/execution/retry/models/RetryContext";

test.describe("NoRetryStrategy", () => {
  const strategy = new NoRetryStrategy();
  const context: Readonly<RetryContext> = { currentAttempt: 1, maxAttempts: 3 };

  test("should never retry", async () => {
    expect(strategy.shouldRetry(context)).toBe(false);
  });

  test("should have zero delay", async () => {
    expect(strategy.nextDelay(context)).toBe(0);
  });
});
