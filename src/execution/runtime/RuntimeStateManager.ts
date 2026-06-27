// src/execution/runtime/RuntimeStateManager.ts

import { ExecutionState } from "../models/ExecutionState";
import { ExecutionMetrics } from "../models/ExecutionMetrics";

/**
 * RuntimeStateManager is the single source of truth for runtime execution states.
 * It manages workflow status, individual task status, outputs, and errors.
 */
export class RuntimeStateManager {
  private workflowState: ExecutionState = ExecutionState.Pending;
  private readonly taskStates: Map<string, ExecutionState> = new Map();
  private readonly taskOutputs: Map<string, unknown> = new Map();
  private readonly errors: Error[] = [];
  private readonly startedAt: Date;
  private finishedAt?: Date;

  constructor() {
    this.startedAt = new Date();
  }

  /**
   * Gets the current workflow execution state.
   */
  public getWorkflowState(): ExecutionState {
    return this.workflowState;
  }

  /**
   * Sets the current workflow execution state.
   */
  public setWorkflowState(state: ExecutionState): void {
    this.workflowState = state;
    if (state === ExecutionState.Completed || state === ExecutionState.Failed || state === ExecutionState.Cancelled) {
      this.finishedAt = new Date();
    }
  }

  /**
   * Gets the state of a specific task.
   */
  public getTaskState(taskId: string): ExecutionState {
    return this.taskStates.get(taskId) ?? ExecutionState.Pending;
  }

  /**
   * Sets the state of a specific task.
   */
  public setTaskState(taskId: string, state: ExecutionState): void {
    this.taskStates.set(taskId, state);
  }

  /**
   * Gets the output of a specific task.
   */
  public getTaskOutput(taskId: string): unknown | undefined {
    return this.taskOutputs.get(taskId);
  }

  /**
   * Sets the output of a specific task.
   */
  public setTaskOutput(taskId: string, output: unknown): void {
    this.taskOutputs.set(taskId, output);
  }

  /**
   * Gets the set of successfully completed task IDs.
   */
  public getCompletedTaskIds(): ReadonlySet<string> {
    const completed = new Set<string>();
    for (const [taskId, state] of this.taskStates.entries()) {
      if (state === ExecutionState.Completed) {
        completed.add(taskId);
      }
    }
    return completed;
  }

  /**
   * Gets all task outputs mapped by task ID.
   */
  public getTaskOutputs(): Readonly<Record<string, unknown>> {
    const outputsObj: Record<string, unknown> = {};
    for (const [taskId, output] of this.taskOutputs.entries()) {
      outputsObj[taskId] = output;
    }
    return outputsObj;
  }

  /**
   * Adds an error to the execution log.
   */
  public addError(error: Error): void {
    this.errors.push(error);
  }

  /**
   * Gets the collected list of errors.
   */
  public getErrors(): readonly Error[] {
    return this.errors;
  }

  /**
   * Calculates and returns the ExecutionMetrics snapshot.
   *
   * @param totalTasks - total tasks in the graph
   */
  public getMetrics(totalTasks: number): ExecutionMetrics {
    let completedCount = 0;
    let failedCount = 0;
    for (const state of this.taskStates.values()) {
      if (state === ExecutionState.Completed) completedCount++;
      if (state === ExecutionState.Failed) failedCount++;
    }

    const finished = this.finishedAt ?? new Date();
    const durationMs = finished.getTime() - this.startedAt.getTime();

    // TODO: parallel execution
    // TODO: retry policy
    // TODO: timeout
    // TODO: rollback
    // TODO: persistence
    // TODO: checkpoint
    // TODO: resume
    // TODO: distributed execution
    // TODO: telemetry

    return {
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      durationMs,
      totalTasks,
      completedTasks: completedCount,
      failedTasks: failedCount
    };
  }
}
