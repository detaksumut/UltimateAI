import { IRuntime } from "../contracts/IRuntime";
import { IRuntimeContext } from "../contracts/IRuntimeContext";
import { IRuntimeResult } from "../contracts/IRuntimeResult";
import { RuntimeManifest } from "../registry/RuntimeManifest";
import { RuntimeCapability } from "../contracts/RuntimeCapability";
import { RuntimeLifecycle } from "../contracts/RuntimeLifecycle";
import { IDomainBlueprint } from "../../foundation/blueprint/IDomainBlueprint";
import { BlueprintValidator } from "../../foundation/blueprint/BlueprintValidator";
import * as crypto from "crypto";

export interface DummyDomainContext extends IRuntimeContext {
  readonly testInput?: string;
}

/**
 * ReferenceValidationRuntime (Dummy Runtime)
 * Runtime minimal yang murni bertugas memvalidasi pipa kognitif lintas-domain
 * tanpa membawa asumsi domain bisnis apa pun.
 */
export class ReferenceValidationRuntime implements IRuntime<DummyDomainContext, IRuntimeResult<any>> {
  readonly manifest: RuntimeManifest;
  state: RuntimeLifecycle;

  constructor() {
    this.state = RuntimeLifecycle.INSTALLED;
    
    this.manifest = {
      id: "ultimate.runtime.dummy",
      name: "Reference Validation Runtime",
      version: "1.0.0",
      author: "System",
      description: "Runtime minimal untuk validasi kelayakan fondasi",
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
    this.state = newState;
  }

  async execute(context: DummyDomainContext): Promise<IRuntimeResult<IDomainBlueprint>> {
    const startedAt = Date.now();
    this.setState(RuntimeLifecycle.RUNNING);

    const testInput = context.testInput || "Default validation query";

    // Menyusun spesifikasi cetak biru logis minimal secara technology-agnostic
    const specification = {
      database: {
        auditTrail: false,
        dialect: "relational"
      },
      workflow: {
        stages: ["validation-start", "validation-end"],
        reviewMethod: "double-blind"
      },
      compliance: {
        indexingTarget: ["SINTA"],
        issn: "0000-0000",
        metadataStandard: "dublin-core"
      },
      security: {
        accessControl: "role-based",
        authMethod: "local"
      },
      api: {
        routing: "restful",
        documentation: "openapi"
      }
    };

    const draftBlueprint: Omit<IDomainBlueprint, "blueprintHash"> = {
      blueprintId: `bp-dummy-${crypto.randomUUID()}`,
      schemaVersion: "1.0",
      foundationBaseline: "UAI-FB-1.0",
      domain: "dummy",
      classification: "domain",
      type: "Reference Blueprint",
      status: "VALIDATED",
      analysisId: `analysis-dummy-${crypto.randomUUID()}`,
      metadata: {
        createdAt: 1767225600000,
        createdBy: "Reference Validation Runtime Generator",
        foundationBaseline: "UAI-FB-1.0",
        generatorVersion: "1.0.0",
        domainVersion: "1.0.0"
      },
      specification
    };

    const hash = BlueprintValidator.calculateHash(draftBlueprint);
    const finalBlueprint: IDomainBlueprint = {
      ...draftBlueprint,
      blueprintHash: hash
    };

    this.setState(RuntimeLifecycle.READY);
    const finishedAt = Date.now();

    return {
      runtimeId: this.manifest.id,
      startedAt,
      finishedAt,
      durationMs: finishedAt - startedAt,
      status: "SUCCESS",
      warnings: [],
      payload: finalBlueprint
    };
  }
}
