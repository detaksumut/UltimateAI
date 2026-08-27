import { IRuntime } from "../contracts/IRuntime";
import { IRuntimeContext } from "../contracts/IRuntimeContext";
import { IRuntimeResult } from "../contracts/IRuntimeResult";
import { RuntimeManifest } from "../registry/RuntimeManifest";
import { RuntimeCapability } from "../contracts/RuntimeCapability";
import { RuntimeLifecycle } from "../contracts/RuntimeLifecycle";
import { RequirementNormalizer, InputRequirements, NormalizedRequirements } from "./RequirementNormalizer";
import { JournalIntelligence, IntelligenceAnalysis, Recommendation, ConfidenceDerivation } from "./JournalIntelligence";
import { ComplianceEngine, ComplianceResult, KnowledgeProvider } from "./ComplianceEngine";
import { BlueprintGenerator } from "./BlueprintGenerator";
import { IDomainBlueprint } from "../../foundation/blueprint/IDomainBlueprint";
import { RuntimeIntegrationAdapter, RuntimeBus } from "./RuntimeIntegrationAdapter";
import { IBlueprintRegistry } from "../../foundation/blueprint/BlueprintRegistry";

export interface DomainAnalysisResult {
  readonly normalizedRequirements: NormalizedRequirements;
  readonly observations: string[];
  readonly recommendations: Recommendation[];
  readonly complianceResults: ComplianceResult[];
  readonly confidence: ConfidenceDerivation;
  readonly explainability: string[];
  readonly warnings: string[];
  readonly nextAction: string;
}

export interface JournalDomainContext extends IRuntimeContext {
  readonly requirements?: InputRequirements;
  readonly analysisResult?: DomainAnalysisResult; // Input for Blueprint Generation
  readonly knowledgeProvider?: KnowledgeProvider; // Optional mock provider injection
  readonly requestedCapability?: "JournalDomainAnalysis" | "JournalBlueprintGeneration";
  readonly runtimeBus?: RuntimeBus; // Optional injection for B4 test
  readonly blueprintRegistry?: IBlueprintRegistry; // Optional registry injection for B4 test
}

/**
 * JournalRuntime - Reference Runtime for Domain Analysis, Blueprint, & Integration (Sprint B4)
 * Memenuhi spesifikasi arsitektur kognitif UAI-FB-1.0.
 */
export class JournalRuntime implements IRuntime<JournalDomainContext, IRuntimeResult<any>> {
  readonly manifest: RuntimeManifest;
  state: RuntimeLifecycle;

  constructor() {
    this.state = RuntimeLifecycle.INSTALLED;
    
    this.manifest = {
      id: "ultimate.runtime.journal",
      name: "Journal Domain Analysis, Blueprint & Integration Runtime",
      version: "1.0.0",
      author: "System",
      description: "Reference Runtime untuk analisis domain, blueprint, dan integrasi kognitif",
      capabilities: [RuntimeCapability.PLANNING],
      requiredCapabilities: [],
      contractVersion: "1.0",
      startupPriority: 50,
      healthCheck: async () => this.health()
    };
  }

  async health(): Promise<boolean> {
    return this.state === RuntimeLifecycle.READY;
  }

  setState(newState: RuntimeLifecycle): void {
    const current = this.state;
    if (newState === RuntimeLifecycle.RUNNING && current === RuntimeLifecycle.INSTALLED) {
      throw new Error(`Invalid state transition: Cannot transition from ${current} directly to ${newState}`);
    }
    this.state = newState;
  }

  async execute(context: JournalDomainContext): Promise<IRuntimeResult<any>> {
    const startedAt = Date.now();
    this.setState(RuntimeLifecycle.RUNNING);

    const capability = context.requestedCapability || "JournalDomainAnalysis";
    let payload: any;
    const warnings: string[] = [];

    if (capability === "JournalDomainAnalysis") {
      // Sprint B2 & B4 flow
      const requirements = context.requirements || {};
      const normalizer = new RequirementNormalizer();
      const { normalized, ambiguities } = normalizer.normalize(requirements);

      const intelligence = new JournalIntelligence();
      const intelAnalysis = intelligence.analyze(normalized, ambiguities.length);

      const defaultProvider: KnowledgeProvider = context.knowledgeProvider || {
        fetchRules: async () => [
          { id: "R1", code: "ISSN_FORMAT", value: "true", severity: "CRITICAL" },
          { id: "R2", code: "REVIEW_METHOD", value: "true", severity: "WARNING" }
        ]
      };
      const complianceEngine = new ComplianceEngine(defaultProvider);
      const compliance = await complianceEngine.checkCompliance(normalized);

      let nextAction = "PROCEED_TO_BLUEPRINT";
      if (normalized.metadata.ambiguityLevel === 2) {
        nextAction = "REQUEST_MORE_INFORMATION";
      }

      const explainability = intelAnalysis.recommendations.map(
        r => `Recommendation: ${r.recommendation} | Because: ${r.evidence} | Source: ${r.knowledgeSource}`
      );

      warnings.push(...ambiguities, ...compliance.errors);

      payload = {
        normalizedRequirements: normalized,
        observations: intelAnalysis.observations,
        recommendations: intelAnalysis.recommendations,
        complianceResults: compliance.results,
        confidence: intelAnalysis.confidence,
        explainability,
        warnings,
        nextAction
      } as DomainAnalysisResult;

      // B4 Integration: Kirim Sinyal Pembelajaran ke Evolution Runtime jika Bus diinjeksikan
      if (context.runtimeBus) {
        const adapter = new RuntimeIntegrationAdapter(context.runtimeBus);
        const failedComplianceCount = compliance.results.filter(r => !r.passed).length;
        adapter.sendEvolutionSignals({
          ambiguityLevel: normalized.metadata.ambiguityLevel,
          overallConfidence: intelAnalysis.confidence.overall,
          failedComplianceCount,
          warningCount: warnings.length
        });
      }

    } else if (capability === "JournalBlueprintGeneration") {
      // Sprint B3 & B4 flow
      if (!context.analysisResult) {
        throw new Error("Missing 'analysisResult' in context for blueprint generation");
      }
      
      const generator = new BlueprintGenerator();
      const analysisId = `analysis-${Date.now()}`;
      const draftBlueprint = generator.generate(context.analysisResult, analysisId);

      // Sprint B4: Ubah status menjadi REGISTERED saat dimasukkan ke Registry
      const registeredBlueprint: IDomainBlueprint = {
        ...draftBlueprint,
        status: "REGISTERED" // B4 Lifecycle Target status
      };

      // Simpan blueprint ke Blueprint Registry jika diinjeksikan
      if (context.blueprintRegistry) {
        context.blueprintRegistry.register(registeredBlueprint);
      }

      // B4 Integration: Simpan Rantai Traceability ke Memory Runtime jika Bus diinjeksikan
      if (context.runtimeBus) {
        const adapter = new RuntimeIntegrationAdapter(context.runtimeBus);
        adapter.storeTraceability({
          requirementId: "req-b4-user-input",
          analysisId,
          blueprintId: registeredBlueprint.blueprintId,
          foundationBaseline: registeredBlueprint.foundationBaseline,
          blueprintVersion: registeredBlueprint.schemaVersion,
          blueprintHash: registeredBlueprint.blueprintHash
        });
      }

      payload = registeredBlueprint;
    }

    this.setState(RuntimeLifecycle.READY);
    const finishedAt = Date.now();

    return {
      runtimeId: this.manifest.id,
      startedAt,
      finishedAt,
      durationMs: finishedAt - startedAt,
      status: "SUCCESS",
      warnings,
      payload
    };
  }
}
