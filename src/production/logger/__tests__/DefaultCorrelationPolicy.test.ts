// src/production/logger/__tests__/DefaultCorrelationPolicy.test.ts
import { DefaultCorrelationPolicy } from "../DefaultCorrelationPolicy";
import { LogEntry } from "../LogEntry";

/** Helper to create a LogEntry with optional fields */
function makeEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    timestamp: Date.now(),
    type: "TEST",
    entityId: "entity123",
    payload: {},
    ...overrides,
  } as LogEntry;
}

const policy = new DefaultCorrelationPolicy();

test("Same input yields same correlationId", () => {
  const entry = makeEntry({ requestId: "req1", workflowId: "wf1", parentId: "p1" });
  const id1 = policy.computeCorrelationId(entry);
  const id2 = policy.computeCorrelationId(entry);
  expect(id1).toBe(id2);
});

test("Different requestId yields different correlationId", () => {
  const base = { workflowId: "wf", parentId: "p" };
  const id1 = policy.computeCorrelationId(makeEntry({ requestId: "reqA", ...base }));
  const id2 = policy.computeCorrelationId(makeEntry({ requestId: "reqB", ...base }));
  expect(id1).not.toBe(id2);
});

test("Different workflowId yields different correlationId", () => {
  const base = { requestId: "req", parentId: "p" };
  const id1 = policy.computeCorrelationId(makeEntry({ workflowId: "wfA", ...base }));
  const id2 = policy.computeCorrelationId(makeEntry({ workflowId: "wfB", ...base }));
  expect(id1).not.toBe(id2);
});

test("Different parentId yields different correlationId", () => {
  const base = { requestId: "req", workflowId: "wf" };
  const id1 = policy.computeCorrelationId(makeEntry({ parentId: "pA", ...base }));
  const id2 = policy.computeCorrelationId(makeEntry({ parentId: "pB", ...base }));
  expect(id1).not.toBe(id2);
});

test("Fallback to type|entityId when no IDs are present", () => {
  const entry = makeEntry({ requestId: undefined, workflowId: undefined, parentId: undefined });
  const expected = policy.computeCorrelationId({
    ...entry,
    // manual fallback string for comparison
  });
  // Recompute using manual fallback logic (type|entityId) to ensure hash matches
  const fallbackRaw = `${entry.type}|${entry.entityId}`;
  const crypto = require("crypto");
  const expectedHash = crypto.createHash("sha256").update(fallbackRaw).digest("hex");
  expect(expected).toBe(expectedHash);
});

test("Timestamp changes do not affect correlationId", () => {
  const entry1 = makeEntry({ requestId: "req", timestamp: 1 });
  const entry2 = makeEntry({ requestId: "req", timestamp: 999999 });
  const id1 = policy.computeCorrelationId(entry1);
  const id2 = policy.computeCorrelationId(entry2);
  expect(id1).toBe(id2);
});

test("Repeated executions produce identical output", () => {
  const entry = makeEntry({ requestId: "repeat", workflowId: "wf", parentId: "p" });
  let first = policy.computeCorrelationId(entry);
  for (let i = 0; i < 1000; i++) {
    const id = policy.computeCorrelationId(entry);
    expect(id).toBe(first);
  }
});

test("Empty optional IDs use deterministic fallback", () => {
  const entry = makeEntry({ requestId: undefined, workflowId: undefined, parentId: undefined });
  const id = policy.computeCorrelationId(entry);
  const fallbackRaw = `${entry.type}|${entry.entityId}`;
  const crypto = require("crypto");
  const expectedHash = crypto.createHash("sha256").update(fallbackRaw).digest("hex");
  expect(id).toBe(expectedHash);
});
