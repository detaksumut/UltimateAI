/**
 * DashboardAPI.ts
 *
 * Consumer 5 (Presentation Layer).
 * Never reads the Kernel. Never mutates data. Only reads the Read Model.
 */

import { ObservabilityReadModel } from './ObservabilityReadModel';

export class DashboardAPI {
  constructor(private readModel: ObservabilityReadModel) {}
  
  public getMetricsOverview() {
    return this.readModel.getMetricsSnapshot();
  }
  
  public getExecutionTrace(traceId: string) {
    return this.readModel.getTraceSummary(traceId);
  }
}
