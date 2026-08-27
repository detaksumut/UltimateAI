import { RequirementModel } from "./RequirementInterpreter";

export interface Policy {
  readonly policyId: string;
  readonly version: string;          // e.g. "1.0", "2.0"
  readonly effectiveFrom: string;    // ISO 8601 date string
  readonly name: string;
  readonly conditions: {
    readonly scale?: "small" | "medium" | "enterprise";
    readonly domain?: string;
  };
  readonly mandates: {
    readonly database?: string;
    readonly caching?: string;
    readonly messaging?: string;
    readonly auth?: string;
    readonly auditLog?: boolean;
    readonly rbac?: boolean;
    readonly docker?: boolean;
    readonly pattern?: "monolith" | "microservices" | "serverless";
  };
}

const DEFAULT_POLICIES: Policy[] = [
  {
    policyId: "POL-001",
    version: "1.0",
    effectiveFrom: "2024-01-01",
    name: "Enterprise Scale Policy",
    conditions: { scale: "enterprise" },
    mandates: {
      database: "postgresql",
      caching: "redis",
      messaging: "kafka",
      auth: "multi-factor",
      auditLog: true,
      rbac: true,
      docker: true,
      pattern: "microservices"
    }
  },
  {
    policyId: "POL-002",
    version: "1.0",
    effectiveFrom: "2024-01-01",
    name: "Medium Scale Policy",
    conditions: { scale: "medium" },
    mandates: {
      database: "postgresql",
      caching: "none",
      messaging: "none",
      auth: "jwt",
      auditLog: true,
      rbac: false,
      docker: true,
      pattern: "monolith"
    }
  },
  {
    policyId: "POL-003",
    version: "1.0",
    effectiveFrom: "2024-01-01",
    name: "Small Scale Policy",
    conditions: { scale: "small" },
    mandates: {
      database: "sqlite",
      caching: "none",
      messaging: "none",
      auth: "session",
      auditLog: false,
      rbac: false,
      docker: false,
      pattern: "monolith"
    }
  }
];

export interface PolicyEvaluationResult {
  readonly matchedPolicies: Policy[];
  readonly effectiveMandates: Policy["mandates"];
  readonly evaluatedAsOf: string;
}

export interface PolicyEvaluateOptions {
  /** ISO date string — evaluate policies as they existed at this point in time.
   *  Enables historical reproduction of decisions. */
  asOf?: string;
}

export class PolicyEngine {
  private readonly policies: Policy[];

  constructor(policies: Policy[] = DEFAULT_POLICIES) {
    this.policies = policies;
  }

  evaluate(
    requirement: RequirementModel,
    options: PolicyEvaluateOptions = {}
  ): PolicyEvaluationResult {
    const asOf = options.asOf ?? new Date().toISOString().slice(0, 10);

    // Filter to policies that were effective at `asOf`
    const activePolicies = this.policies.filter(p => p.effectiveFrom <= asOf);

    const matched = activePolicies.filter(p => {
      if (p.conditions.scale && p.conditions.scale !== requirement.scale) return false;
      if (p.conditions.domain && p.conditions.domain !== requirement.domain) return false;
      return true;
    });

    // Merge mandates — more specific policies take precedence (last match wins)
    const effectiveMandates: Policy["mandates"] = {};
    for (const policy of matched) {
      Object.assign(effectiveMandates, policy.mandates);
    }

    return { matchedPolicies: matched, effectiveMandates, evaluatedAsOf: asOf };
  }

  /** Return all registered policy versions for audit purposes. */
  listVersionHistory(): { policyId: string; version: string; effectiveFrom: string; name: string }[] {
    return this.policies.map(p => ({
      policyId: p.policyId,
      version: p.version,
      effectiveFrom: p.effectiveFrom,
      name: p.name
    }));
  }
}
