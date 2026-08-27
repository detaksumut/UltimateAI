// src/production/logger/__tests__/ILogSerializer.interface.test.ts
/**
 * Unit test for the ILogSerializer contract – verifies that a mock implementation
 * conforms to the pure, stateless contract and does not mutate the supplied LogEntry.
 */
import { ILogSerializer } from "../ILogSerializer";
import { LogEntry } from "../LogEntry";
import { SerializedLog, createSerializedLog } from "../SerializedLog";

class MockSerializer implements ILogSerializer {
  serialize(entry: LogEntry): SerializedLog {
    // Simple deterministic serialization using JSON.stringify of the entry.
    const payload = JSON.stringify(entry);
    // Use the factory to ensure the result is frozen (immutable).
    return createSerializedLog("mock-id", payload);
  }
}

describe("ILogSerializer contract – Mock implementation", () => {
  const serializer: ILogSerializer = new MockSerializer();

  const entry: LogEntry = {
    timestamp: Date.now(),
    type: "TEST_EVENT",
    entityId: "entity-123",
    payload: { foo: "bar" },
    // optional fields omitted for brevity
  } as LogEntry;

  test("serialize returns an immutable SerializedLog", () => {
    const result = serializer.serialize(entry);
    expect(Object.isFrozen(result)).toBe(true);
    expect(result.id).toBe("mock-id");
    expect(result.payload).toBe(JSON.stringify(entry));
  });

  test("serialize does not mutate the original LogEntry", () => {
    const before = { ...entry };
    serializer.serialize(entry);
    expect(entry).toEqual(before);
  });

  test("consecutive calls are independent (no hidden state)", () => {
    const first = serializer.serialize(entry);
    const second = serializer.serialize(entry);
    expect(first).toEqual(second);
  });
});
