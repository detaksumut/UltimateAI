import { FailureClassification } from "./FailureClassification";

export class FailureClassifier {
  static classify(error: Error | any): FailureClassification {
    const message = error?.message?.toLowerCase() || "";

    if (message.includes("timeout") || error?.name === "TimeoutError") {
      return {
        category: "Timeout",
        retryable: true,
        checkpointSafe: true,
        suggestedDelayMs: 1000
      };
    }

    if (message.includes("network") || message.includes("econnrefused") || message.includes("503")) {
      return {
        category: "Transient",
        retryable: true,
        checkpointSafe: true,
        suggestedDelayMs: 2000
      };
    }

    if (message.includes("validation") || message.includes("invalid") || message.includes("schema")) {
      return {
        category: "Validation",
        retryable: false,
        checkpointSafe: true,
        suggestedDelayMs: 0
      };
    }

    if (message.includes("dependency") || message.includes("not found")) {
      return {
        category: "Dependency",
        retryable: false, // Usually permanent unless dependency is restored
        checkpointSafe: true,
        suggestedDelayMs: 0
      };
    }

    // Default to Unknown/Permanent
    return {
      category: "Unknown",
      retryable: false,
      checkpointSafe: false, // Assume unsafe if unknown
      suggestedDelayMs: 0
    };
  }
}
