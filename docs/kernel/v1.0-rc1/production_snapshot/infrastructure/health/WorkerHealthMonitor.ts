// src/production/infrastructure/health/WorkerHealthMonitor.ts

/**
 * Represents the health status of a worker.
 */
export enum WorkerHealthStatus {
  HEALTHY = "healthy",
  UNHEALTHY = "unhealthy",
  UNKNOWN = "unknown",
}

/**
 * Contract for monitoring worker health, supporting failover
 * and worker selection.
 */
export interface WorkerHealthMonitor {
  /** Check if a worker type is currently healthy and available. */
  checkHealth(workerType: string): Promise<WorkerHealthStatus>;

  /** Mark a worker as temporarily unhealthy. */
  markUnhealthy(workerType: string, reason?: string): void;
  
  /** Mark a worker as healthy again. */
  markHealthy(workerType: string): void;
}
