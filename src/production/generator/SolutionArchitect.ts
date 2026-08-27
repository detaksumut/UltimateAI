import { TechnologyStrategy } from "./DecisionEngine";
import * as crypto from "crypto";

export interface ServiceNode {
  readonly serviceId: string;
  readonly name: string;
  readonly type: "backend" | "frontend" | "database" | "cache" | "broker" | "gateway";
  readonly technology: string;
  readonly dependencies: string[];
  readonly port?: number;
}

export interface SolutionArchitecture {
  readonly architectureId: string;
  readonly architectureHash: string;
  readonly pattern: string;
  readonly services: ServiceNode[];
  readonly deploymentTopology: string[];
  readonly dependencyGraph: Record<string, string[]>;
}

export class SolutionArchitect {
  design(strategy: TechnologyStrategy): SolutionArchitecture {
    const services: ServiceNode[] = [];

    // Backend service (always present)
    services.push({
      serviceId: "svc-backend",
      name: "Application Backend",
      type: "backend",
      technology: strategy.backend,
      dependencies: ["svc-db"],
      port: 3000
    });

    // Database service
    services.push({
      serviceId: "svc-db",
      name: "Primary Database",
      type: "database",
      technology: strategy.database,
      dependencies: [],
      port: 5432
    });

    // Frontend service
    services.push({
      serviceId: "svc-frontend",
      name: "Web Frontend",
      type: "frontend",
      technology: strategy.frontend,
      dependencies: ["svc-backend"],
      port: 80
    });

    // Optional: Caching layer
    if (strategy.caching && strategy.caching !== "none") {
      services.push({
        serviceId: "svc-cache",
        name: "Cache Layer",
        type: "cache",
        technology: strategy.caching,
        dependencies: [],
        port: 6379
      });
      // backend depends on cache too
      const backend = services.find(s => s.serviceId === "svc-backend");
      if (backend) {
        const updated = { ...backend, dependencies: [...backend.dependencies, "svc-cache"] };
        services.splice(services.indexOf(backend), 1, updated);
      }
    }

    // Optional: Messaging broker
    if (strategy.messaging && strategy.messaging !== "none") {
      services.push({
        serviceId: "svc-broker",
        name: "Message Broker",
        type: "broker",
        technology: strategy.messaging,
        dependencies: [],
        port: 9092
      });
    }

    // Dependency graph
    const dependencyGraph: Record<string, string[]> = {};
    for (const svc of services) {
      dependencyGraph[svc.serviceId] = svc.dependencies;
    }

    // Deployment topology (ordered boot sequence)
    const deploymentTopology = ["svc-db"];
    if (strategy.caching !== "none") deploymentTopology.push("svc-cache");
    if (strategy.messaging !== "none") deploymentTopology.push("svc-broker");
    deploymentTopology.push("svc-backend");
    deploymentTopology.push("svc-frontend");

    const architectureId = `arch-${crypto.createHash("sha256").update(strategy.strategyId).digest("hex").substring(0, 8)}`;
    const hashData = JSON.stringify({ pattern: strategy.pattern, services: services.map(s => s.serviceId) });
    const architectureHash = crypto.createHash("sha256").update(hashData).digest("hex");

    return {
      architectureId,
      architectureHash,
      pattern: strategy.pattern,
      services,
      deploymentTopology,
      dependencyGraph
    };
  }
}
