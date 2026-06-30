import { ExecutionState } from "./ExecutionUnit";

export interface SchedulerSnapshot {
  timestamp: number;
  totalUnits: number;
  states: Record<ExecutionState, number>;
  activeRuntimes: Record<string, number>; // How many of each capability are running
}
