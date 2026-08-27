import { RecoveryPolicy, DEFAULT_RECOVERY_POLICY } from "./RecoveryManager";
import { ResourceBudget, DEFAULT_RESOURCE_BUDGET } from "./ExecutionScheduler";

export interface ComponentEntry {
  readonly componentId: string;
  readonly name: string;
  readonly version: string;
  readonly sprint: string;
  readonly role: "interpreter" | "planner" | "policy" | "knowledge" | "decision" | "architect" | "dag" | "generator" | "composer" | "certification" | "tracer" | "eventbus" | "statestore" | "recovery" | "scheduler";
}

export interface ExecutionPolicy {
  readonly policyId: string;
  readonly description: string;
  readonly maxConcurrentRequests: number;
  readonly defaultPriority: "high" | "normal" | "low";
  readonly resourceBudget: ResourceBudget;
}

export interface SchedulerPolicy {
  readonly priorityWeights: Record<"high" | "normal" | "low", number>;
  readonly maxQueueSize: number;
  readonly starvationPreventionAfterMs: number;
}

/**
 * OrchestrationManifest is the single source of truth for the
 * Orchestration Engine configuration. It declares all registered
 * components, policies, and observability settings.
 */
export interface OrchestrationManifest {
  readonly orchestratorVersion: string;
  readonly foundationBaseline: string;
  readonly observabilityVersion: string;
  readonly registeredComponents: ComponentEntry[];
  readonly executionPolicies: ExecutionPolicy[];
  readonly recoveryPolicies: RecoveryPolicy[];
  readonly schedulerPolicies: SchedulerPolicy[];
  readonly activePolicies: string[];
  readonly generatedAt: string;
}

/** Default manifest for USGEC Phase F. */
export const DEFAULT_ORCHESTRATION_MANIFEST: OrchestrationManifest = {
  orchestratorVersion: "1.0.0",
  foundationBaseline: "UAI-FB-1.0",
  observabilityVersion: "1.0.0",
  generatedAt: new Date().toISOString(),
  registeredComponents: [
    { componentId: "COMP-E1A", name: "RequirementInterpreter", version: "1.0.0", sprint: "E1", role: "interpreter" },
    { componentId: "COMP-E1B", name: "BlueprintPlanner",       version: "1.0.0", sprint: "E1", role: "planner" },
    { componentId: "COMP-E2A", name: "PolicyEngine",           version: "1.1.0", sprint: "E2/F0", role: "policy" },
    { componentId: "COMP-E2B", name: "KnowledgeBase",          version: "1.0.0", sprint: "E2", role: "knowledge" },
    { componentId: "COMP-E2C", name: "DecisionEngine",         version: "1.1.0", sprint: "E2/F0", role: "decision" },
    { componentId: "COMP-E3A", name: "SolutionArchitect",      version: "1.0.0", sprint: "E3", role: "architect" },
    { componentId: "COMP-E4A", name: "DagGeneratorPlanner",    version: "1.0.0", sprint: "E4", role: "dag" },
    { componentId: "COMP-E4B", name: "GeneratorRegistry",      version: "1.1.0", sprint: "E4/F0", role: "generator" },
    { componentId: "COMP-E5A", name: "ArtifactComposer",       version: "1.0.0", sprint: "E5", role: "composer" },
    { componentId: "COMP-E5B", name: "CertificationLayer",     version: "1.0.0", sprint: "E5", role: "certification" },
    { componentId: "COMP-F1A", name: "ObservabilityTracer",    version: "1.0.0", sprint: "F1", role: "tracer" },
    { componentId: "COMP-F1B", name: "OrchestrationEventBus",  version: "1.0.0", sprint: "F1", role: "eventbus" },
    { componentId: "COMP-F2A", name: "ExecutionStateStore",    version: "1.0.0", sprint: "F2", role: "statestore" },
    { componentId: "COMP-F2B", name: "RecoveryManager",        version: "1.0.0", sprint: "F2", role: "recovery" },
    { componentId: "COMP-F3A", name: "ExecutionScheduler",     version: "1.0.0", sprint: "F3", role: "scheduler" }
  ],
  executionPolicies: [
    {
      policyId: "EXEC-001",
      description: "Default execution policy for all requests",
      maxConcurrentRequests: 10,
      defaultPriority: "normal",
      resourceBudget: DEFAULT_RESOURCE_BUDGET
    }
  ],
  recoveryPolicies: [DEFAULT_RECOVERY_POLICY],
  schedulerPolicies: [
    {
      priorityWeights: { high: 3, normal: 2, low: 1 },
      maxQueueSize: 1000,
      starvationPreventionAfterMs: 30_000
    }
  ],
  activePolicies: ["POL-001", "POL-002", "POL-003"]
};
