import * as crypto from "crypto";

export interface PersistedStep {
  readonly stepName: string;
  readonly completedAt: string;
  readonly result: unknown;
}

export interface PersistedWorkflow {
  readonly requestId: string;
  readonly naturalLanguage: string;
  readonly lastCompletedStep: string;
  readonly steps: PersistedStep[];
  readonly persistedAt: string;
  readonly checksum: string;
}

/**
 * WorkflowPersistence serializes intermediate pipeline state so that
 * execution can resume after a crash or restart.
 *
 * The in-memory implementation stores state in a Map. This can be replaced
 * by a file-system or database adapter without changing the interface.
 */
export class WorkflowPersistence {
  private readonly store: Map<string, PersistedWorkflow> = new Map();

  /** Save a completed step result for a request. */
  save(requestId: string, naturalLanguage: string, stepName: string, result: unknown): void {
    const existing = this.store.get(requestId);
    const steps: PersistedStep[] = existing ? [...existing.steps] : [];

    // Overwrite if step already recorded (idempotent save)
    const idx = steps.findIndex(s => s.stepName === stepName);
    const newStep: PersistedStep = { stepName, completedAt: new Date().toISOString(), result };
    if (idx !== -1) steps[idx] = newStep;
    else steps.push(newStep);

    const checksum = this.computeChecksum(requestId, steps);
    const workflow: PersistedWorkflow = {
      requestId,
      naturalLanguage,
      lastCompletedStep: stepName,
      steps,
      persistedAt: new Date().toISOString(),
      checksum
    };
    this.store.set(requestId, workflow);
  }

  /** Resume — returns persisted state or undefined if no state exists. */
  resume(requestId: string): PersistedWorkflow | undefined {
    const wf = this.store.get(requestId);
    if (!wf) return undefined;
    // Verify checksum integrity
    const expected = this.computeChecksum(requestId, wf.steps);
    if (expected !== wf.checksum) {
      throw new Error(`WorkflowPersistence: checksum mismatch for requestId=${requestId}`);
    }
    return wf;
  }

  /** Check if a specific step was already completed. */
  isStepCompleted(requestId: string, stepName: string): boolean {
    return (this.store.get(requestId)?.steps ?? []).some(s => s.stepName === stepName);
  }

  /** Retrieve the result of a previously completed step. */
  getStepResult<T>(requestId: string, stepName: string): T | undefined {
    const step = (this.store.get(requestId)?.steps ?? []).find(s => s.stepName === stepName);
    return step?.result as T | undefined;
  }

  /** Remove persisted state (after successful completion or explicit clear). */
  clear(requestId: string): void {
    this.store.delete(requestId);
  }

  private computeChecksum(requestId: string, steps: PersistedStep[]): string {
    const payload = JSON.stringify({ requestId, steps: steps.map(s => ({ n: s.stepName, r: s.result })) });
    return crypto.createHash("sha256").update(payload).digest("hex").substring(0, 16);
  }
}
