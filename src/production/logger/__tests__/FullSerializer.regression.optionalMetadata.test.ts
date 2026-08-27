/**
 * Regression ID: REG-004
 * Requirement: SER-003
 * Sprint: M2
 * Purpose: Protect against future regressions in optional metadata handling.
 * Origin:
 *   Regression discovered during CanonicalSerializer development.
 *   Fixed in Sprint M2 Step 2.4.
 */

// src/production/logger/__tests__/FullSerializer.regression.optionalMetadata.test.ts
import { DefaultSerializer } from "../DefaultSerializer";
import { LogEntry } from "../LogEntry";
import { mockCorrelationPolicy } from "../test-utils/serializerTestHelpers";

describe("REG-004 – Optional metadata combinations", () => {
  const serializer = new DefaultSerializer(mockCorrelationPolicy(true));

  const metadataVariants = [
    {},
    { requestId: "req-123" },
    { userId: "user-456" },
    { requestId: "req-123", userId: "user-456" },
    { correlationId: "corr-789" },
  ];

  metadataVariants.forEach((meta, idx) => {
    test(`serializes entry with metadata variant ${idx + 1}` , () => {
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: "info",
        message: `Metadata test ${idx}`,
        ...meta,
      } as any;
      expect(() => serializer.serialize(entry)).not.toThrow();
      const serialized = serializer.serialize(entry);
      const parsed = JSON.parse(serialized.payload);
      // Ensure all provided meta fields appear in the canonical payload
      Object.keys(meta).forEach((k) => expect(parsed).toHaveProperty(k, (meta as any)[k]));
    });
  });
});
