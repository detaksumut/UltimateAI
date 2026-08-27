export interface ArchitecturePattern {
  readonly patternId: string;
  readonly name: string;
  readonly suitableFor: string[];
  readonly components: string[];
  readonly tradeoffs: { readonly pros: string[]; readonly cons: string[] };
}

export interface GeneratorCapability {
  readonly generatorId: string;
  readonly technology: string;
  readonly produces: string[];
  readonly requiredPattern: string[];
}

export interface BestPractice {
  readonly domain: string;
  readonly rule: string;
}

const PATTERNS: ArchitecturePattern[] = [
  {
    patternId: "PAT-001",
    name: "Microservices",
    suitableFor: ["enterprise"],
    components: ["API Gateway", "Service Registry", "Message Broker", "Independent DB per service"],
    tradeoffs: {
      pros: ["High scalability", "Independent deployment", "Fault isolation"],
      cons: ["Complex orchestration", "Network overhead"]
    }
  },
  {
    patternId: "PAT-002",
    name: "Monolith",
    suitableFor: ["small", "medium"],
    components: ["Single Application Server", "Shared Database", "Internal Modules"],
    tradeoffs: {
      pros: ["Simple deployment", "Easy debugging", "Low latency"],
      cons: ["Vertical scaling only", "Tightly coupled"]
    }
  }
];

const GENERATOR_CAPABILITIES: GeneratorCapability[] = [
  { generatorId: "GEN-NEST", technology: "nestjs", produces: ["backend", "api"], requiredPattern: ["monolith", "microservices"] },
  { generatorId: "GEN-REACT", technology: "react", produces: ["frontend"], requiredPattern: ["monolith", "microservices"] },
  { generatorId: "GEN-POSTGRES", technology: "postgresql", produces: ["database"], requiredPattern: ["monolith", "microservices"] },
  { generatorId: "GEN-SQLITE", technology: "sqlite", produces: ["database"], requiredPattern: ["monolith"] },
  { generatorId: "GEN-DOCKER", technology: "docker", produces: ["deployment"], requiredPattern: ["monolith", "microservices"] }
];

const BEST_PRACTICES: BestPractice[] = [
  { domain: "journal", rule: "Editorial workflow must separate submission from peer review stages" },
  { domain: "journal", rule: "DOI/ORCID integrations must be modular and pluggable" },
  { domain: "medical", rule: "Patient data must be encrypted at rest and in transit" },
  { domain: "legal", rule: "All case records must have immutable audit trail" }
];

export class KnowledgeBase {
  getPattern(name: string): ArchitecturePattern | undefined {
    return PATTERNS.find(p => p.name.toLowerCase() === name.toLowerCase());
  }

  getPatternsForScale(scale: string): ArchitecturePattern[] {
    return PATTERNS.filter(p => p.suitableFor.includes(scale));
  }

  getGeneratorsForPattern(pattern: string): GeneratorCapability[] {
    return GENERATOR_CAPABILITIES.filter(g => g.requiredPattern.includes(pattern.toLowerCase()));
  }

  getBestPractices(domain: string): BestPractice[] {
    return BEST_PRACTICES.filter(bp => bp.domain === domain);
  }
}
