export interface PlanningContext {
  /** User's intent or prompt */
  prompt: string;
  /** Optional memory snapshot */
  memory?: unknown;
  /** Optional workspace description */
  workspace?: unknown;
  /** Additional settings */
  settings?: Record<string, unknown>;
  /** Required capabilities */
  capabilities?: string[];
}
