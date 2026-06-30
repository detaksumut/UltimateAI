export enum RecoveryAction {
  RETRY = "RETRY",
  RESUME = "RESUME",
  FALLBACK = "FALLBACK",
  ABORT = "ABORT"
}

export interface RecoveryPolicy {
  action: RecoveryAction;
  fallbackRuntimeId?: string;
}

export const DEFAULT_RECOVERY_POLICY: RecoveryPolicy = {
  action: RecoveryAction.ABORT
};
