/**
 * StudioContext — Authentication and authorization boundary (ADR-008).
 *
 * This interface establishes the security contract for all Studio API calls.
 * The current implementation is a stub — enforcement is deferred to
 * Phase H (Enterprise Cloud). The contract is defined now so that
 * no API signatures need to change when enforcement is added.
 */
export interface StudioContext {
  /** Unique identifier of the caller (user ID, service account, API key). */
  readonly callerId: string;
  /** Assigned roles for this caller (e.g. "admin", "developer", "viewer"). */
  readonly roles: string[];
  /** Fine-grained permissions (e.g. "generation:submit", "metrics:read"). */
  readonly permissions: string[];
}

/** Predefined permission tokens. */
export const StudioPermissions = {
  SUBMIT:              "generation:submit",
  CANCEL:              "generation:cancel",
  PREVIEW:             "generation:preview",
  REPLAY:              "generation:replay",
  METRICS_READ:        "metrics:read",
  TRACE_READ:          "trace:read",
  EXPORT:              "export:execute",
  IMPORT:              "import:execute",
  POLICY_READ:         "policy:read",
  CAPABILITY_READ:     "capability:read",
  HEALTH_READ:         "health:read"
} as const;

/** Anonymous/unrestricted context — used in development and test. */
export const ANONYMOUS_CONTEXT: StudioContext = {
  callerId: "anonymous",
  roles: ["developer"],
  permissions: Object.values(StudioPermissions)
};

/**
 * Stub permission check — always passes in this phase.
 * Replace with real enforcement in Phase H (Enterprise Cloud).
 */
export function assertPermission(context: StudioContext, permission: string): void {
  // Stub: log the check for audit trail; enforcement deferred to Phase H
  // In production this would throw if context.permissions does not include permission
  void context;
  void permission;
}
