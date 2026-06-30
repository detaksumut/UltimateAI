export interface TimeoutPolicy {
  timeoutMs: number;
  hardTimeoutMs?: number; // Absolute max before killing process
}

export const DEFAULT_TIMEOUT_POLICY: TimeoutPolicy = {
  timeoutMs: 30000
};
