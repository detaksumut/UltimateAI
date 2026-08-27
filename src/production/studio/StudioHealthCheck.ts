import { DEFAULT_ORCHESTRATION_MANIFEST } from "../orchestrator/OrchestrationManifest";

export type ComponentHealthStatus = "healthy" | "degraded" | "unhealthy";

export interface ComponentHealth {
  readonly componentId: string;
  readonly name: string;
  readonly status: ComponentHealthStatus;
  readonly detail?: string;
}

export interface HealthReport {
  readonly status: ComponentHealthStatus;
  readonly components: ComponentHealth[];
  readonly checkedAt: string;
  readonly summary: string;
}

/**
 * StudioHealthCheck inspects all components declared in the OrchestrationManifest
 * and reports their health status. In this phase, all components are presumed
 * healthy if they are present in the manifest (structural health check).
 */
export class StudioHealthCheck {
  check(): HealthReport {
    const manifest = DEFAULT_ORCHESTRATION_MANIFEST;
    const components: ComponentHealth[] = manifest.registeredComponents.map(comp => ({
      componentId: comp.componentId,
      name: comp.name,
      status: "healthy" as ComponentHealthStatus,
      detail: `Sprint ${comp.sprint} — v${comp.version}`
    }));

    // Studio-specific components
    const studioComponents: ComponentHealth[] = [
      { componentId: "COMP-G1A", name: "StudioContext",         status: "healthy", detail: "Sprint G1 — v1.0.0" },
      { componentId: "COMP-G1B", name: "StudioContracts",       status: "healthy", detail: "Sprint G1 — v1.0.0" },
      { componentId: "COMP-G2A", name: "StudioFacade",          status: "healthy", detail: "Sprint G2 — v1.0.0" },
      { componentId: "COMP-G5A", name: "StudioNotificationBus", status: "healthy", detail: "Sprint G5 — v1.0.0" },
      { componentId: "COMP-G5B", name: "StudioSession",         status: "healthy", detail: "Sprint G5 — v1.0.0" },
      { componentId: "COMP-G5C", name: "StudioHealthCheck",     status: "healthy", detail: "Sprint G5 — v1.0.0" },
      // G0 improvements
      { componentId: "COMP-G0A", name: "WorkflowPersistence",   status: "healthy", detail: "Sprint G0 — v1.0.0" },
      { componentId: "COMP-G0B", name: "IdempotencyGuard",      status: "healthy", detail: "Sprint G0 — v1.0.0" },
      { componentId: "COMP-G0C", name: "IScheduler",            status: "healthy", detail: "Sprint G0 — v1.0.0" },
      { componentId: "COMP-G0D", name: "MetricsCollector",      status: "healthy", detail: "Sprint G0 — v1.0.0" }
    ];

    const allComponents = [...components, ...studioComponents];
    const unhealthyCount = allComponents.filter(c => c.status === "unhealthy").length;
    const degradedCount  = allComponents.filter(c => c.status === "degraded").length;

    const overallStatus: ComponentHealthStatus =
      unhealthyCount > 0 ? "unhealthy" :
      degradedCount > 0  ? "degraded"  :
      "healthy";

    return {
      status: overallStatus,
      components: allComponents,
      checkedAt: new Date().toISOString(),
      summary: `${allComponents.length} components checked — ${overallStatus.toUpperCase()}. Unhealthy: ${unhealthyCount}, Degraded: ${degradedCount}`
    };
  }
}
