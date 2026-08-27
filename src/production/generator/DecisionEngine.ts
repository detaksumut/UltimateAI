import { RequirementModel } from "./RequirementInterpreter";
import { PolicyEngine, PolicyEvaluationResult, PolicyEvaluateOptions } from "./PolicyEngine";
import { KnowledgeBase, ArchitecturePattern, GeneratorCapability } from "./KnowledgeBase";

// ─── Explainability ───────────────────────────────────────────────────────────

export interface DecisionReason {
  readonly factor: string;
  readonly source: "policy" | "knowledge-base" | "requirement" | "default";
  readonly detail: string;
}

export interface ExplainabilityRecord {
  readonly pattern: { selected: string; reasons: DecisionReason[] };
  readonly database: { selected: string; reasons: DecisionReason[] };
  readonly deployment: { selected: string; reasons: DecisionReason[] };
  readonly auth: { selected: string; reasons: DecisionReason[] };
  readonly caching: { selected: string; reasons: DecisionReason[] };
}

// ─── Technology Strategy ──────────────────────────────────────────────────────

export interface TechnologyStrategy {
  readonly strategyId: string;
  readonly pattern: "monolith" | "microservices" | "serverless";
  readonly database: string;
  readonly caching: string;
  readonly messaging: string;
  readonly auth: string;
  readonly frontend: string;
  readonly backend: string;
  readonly deployment: string;
  readonly selectedGenerators: GeneratorCapability[];
  readonly selectedPattern: ArchitecturePattern;
  readonly policyEvaluation: PolicyEvaluationResult;
  readonly rationale: string[];
  readonly explanation: ExplainabilityRecord;  // NEW: full audit trail per decision
}

// ─── Decision Engine ──────────────────────────────────────────────────────────

export class DecisionEngine {
  private readonly policyEngine: PolicyEngine;
  private readonly knowledgeBase: KnowledgeBase;

  constructor(policyEngine?: PolicyEngine, knowledgeBase?: KnowledgeBase) {
    this.policyEngine = policyEngine ?? new PolicyEngine();
    this.knowledgeBase = knowledgeBase ?? new KnowledgeBase();
  }

  decide(requirement: RequirementModel, options: PolicyEvaluateOptions = {}): TechnologyStrategy {
    // Step 1: Evaluate policies (with optional asOf for historical replay)
    const policyResult = this.policyEngine.evaluate(requirement, options);
    const mandates = policyResult.effectiveMandates;
    const matchedPolicyNames = policyResult.matchedPolicies.map(p => `${p.name} v${p.version}`).join(", ");

    // Step 2: Resolve pattern
    const patternName = mandates.pattern ?? "monolith";
    const selectedPattern =
      this.knowledgeBase.getPattern(patternName) ??
      this.knowledgeBase.getPatternsForScale(requirement.scale)[0];

    // Step 3: Resolve generators
    const selectedGenerators = this.knowledgeBase.getGeneratorsForPattern(selectedPattern.name);

    // Step 4: Build rationale
    const rationale: string[] = [];
    rationale.push(`Scale '${requirement.scale}' matched: ${matchedPolicyNames}`);
    rationale.push(`Architecture pattern: ${selectedPattern.name}`);
    rationale.push(`Database mandated by policy: ${mandates.database}`);
    if (mandates.docker) rationale.push("Docker deployment mandated for containerization");
    if (mandates.rbac) rationale.push("RBAC enforced by enterprise policy");

    // Step 5: Build Explainability record
    const explanation: ExplainabilityRecord = {
      pattern: {
        selected: selectedPattern.name,
        reasons: [
          {
            factor: "Scale requirement",
            source: "requirement",
            detail: `Scale '${requirement.scale}' requires scalable architecture`
          },
          {
            factor: "Policy mandate",
            source: "policy",
            detail: `${matchedPolicyNames} mandates '${patternName}' pattern`
          },
          {
            factor: "Knowledge Base confirmation",
            source: "knowledge-base",
            detail: `Pattern '${selectedPattern.name}' suitable for: ${selectedPattern.suitableFor.join(", ")}`
          }
        ]
      },
      database: {
        selected: mandates.database ?? "sqlite",
        reasons: [
          {
            factor: "Policy mandate",
            source: "policy",
            detail: mandates.database
              ? `${matchedPolicyNames} explicitly mandates '${mandates.database}'`
              : "No policy mandate — defaulting to sqlite"
          }
        ]
      },
      deployment: {
        selected: mandates.docker ? "docker" : "local",
        reasons: [
          {
            factor: "Policy mandate",
            source: "policy",
            detail: mandates.docker
              ? `${matchedPolicyNames} mandates Docker containerization`
              : "Policy does not require Docker — using local deployment"
          }
        ]
      },
      auth: {
        selected: mandates.auth ?? "session",
        reasons: [
          {
            factor: "Policy mandate",
            source: "policy",
            detail: mandates.auth
              ? `${matchedPolicyNames} mandates '${mandates.auth}' authentication`
              : "No auth policy — defaulting to session"
          }
        ]
      },
      caching: {
        selected: mandates.caching ?? "none",
        reasons: [
          {
            factor: "Policy mandate",
            source: "policy",
            detail: mandates.caching && mandates.caching !== "none"
              ? `${matchedPolicyNames} mandates '${mandates.caching}' caching layer`
              : "No caching mandated by active policies"
          }
        ]
      }
    };

    const strategyId = `strategy-${requirement.requirementId}-${Date.now()}`;

    return {
      strategyId,
      pattern: patternName,
      database: mandates.database ?? "sqlite",
      caching: mandates.caching ?? "none",
      messaging: mandates.messaging ?? "none",
      auth: mandates.auth ?? "session",
      frontend: requirement.features.includes("dashboard-views") ? "react" : "minimal-react",
      backend: "nestjs",
      deployment: mandates.docker ? "docker" : "local",
      selectedGenerators,
      selectedPattern,
      policyEvaluation: policyResult,
      rationale,
      explanation
    };
  }
}
