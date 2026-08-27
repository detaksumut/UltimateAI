import { IRuntime } from "../contracts/IRuntime";
import { IRuntimeContext } from "../contracts/IRuntimeContext";
import { IRuntimeResult } from "../contracts/IRuntimeResult";
import { RuntimeManifest } from "../registry/RuntimeManifest";
import { RuntimeCapability } from "../contracts/RuntimeCapability";
import { RuntimeLifecycle } from "../contracts/RuntimeLifecycle";
import { IDomainBlueprint } from "../../foundation/blueprint/IDomainBlueprint";
import { IExecutionPlan } from "../../foundation/execution/IExecutionPlan";
import { IArtifactBundle } from "../../foundation/execution/IArtifactBundle";
import { ArtifactGenerator } from "./ArtifactGenerator";
import { ArtifactValidator } from "./ArtifactValidator";
import * as crypto from "crypto";

export interface ExecutionRuntimeContext extends IRuntimeContext {
  readonly blueprint: IDomainBlueprint;
  readonly writeToDiskPath?: string; // Optional path to physically write files for test
}

/**
 * ExecutionRuntime - Generic and Stateless Execution Engine
 * Memenuhi spesifikasi arsitektur platform UAI-FB-1.0
 * Hanya mengonsumsi IDomainBlueprint untuk diwujudkan menjadi ArtifactBundle logis.
 */
export class ExecutionRuntime implements IRuntime<ExecutionRuntimeContext, IRuntimeResult<IArtifactBundle>> {
  readonly manifest: RuntimeManifest;
  state: RuntimeLifecycle;

  constructor() {
    this.state = RuntimeLifecycle.INSTALLED;
    this.manifest = {
      id: "ultimate.runtime.execution",
      name: "Generic Execution Runtime",
      version: "1.0.0",
      author: "System",
      description: "Platform eksekusi generik dan stateless untuk mewujudkan cetak biru",
      capabilities: [RuntimeCapability.EXECUTION],
      requiredCapabilities: [],
      contractVersion: "1.0",
      startupPriority: 60,
      healthCheck: async () => this.health()
    };
  }

  async health(): Promise<boolean> {
    return this.state === RuntimeLifecycle.READY;
  }

  setState(newState: RuntimeLifecycle): void {
    this.state = newState;
  }

  /**
   * Execute: Menghasilkan ArtifactBundle dari IDomainBlueprint secara stateless
   */
  async execute(context: ExecutionRuntimeContext): Promise<IRuntimeResult<IArtifactBundle>> {
    const startedAt = Date.now();
    this.setState(RuntimeLifecycle.RUNNING);

    const blueprint = context.blueprint;
    
    // Strict Verification: HANYA menerima IDomainBlueprint valid
    if (!blueprint || !blueprint.blueprintId || !blueprint.specification) {
      throw new Error("Execution Runtime error: Invalid input parameter, expected IDomainBlueprint contract");
    }

    if (blueprint.foundationBaseline !== "UAI-FB-1.0") {
      throw new Error(`Execution Runtime version mismatch: Incompatible baseline version ${blueprint.foundationBaseline}, expected UAI-FB-1.0`);
    }

    if (blueprint.schemaVersion !== "1.0") {
      throw new Error(`Execution Runtime version mismatch: Incompatible blueprint schema version ${blueprint.schemaVersion}, expected 1.0`);
    }

    const executionId = `exec-${crypto.createHash("sha256").update(blueprint.blueprintId).digest("hex").substring(0, 16)}`;
    const bundleId = `bundle-${crypto.createHash("sha256").update(executionId).digest("hex").substring(0, 16)}`;

    // 1. Menyusun Execution Plan (Stateless step composition)
    const plan: IExecutionPlan = {
      executionId,
      blueprintId: blueprint.blueprintId,
      steps: [
        { stepId: "S-BE", name: "Backend Gen", description: "Generate backend skeleton", targetDescriptorName: "BackendSkeleton" },
        { stepId: "S-DB", name: "DB Gen", description: "Generate database schema", targetDescriptorName: "DatabaseSchema" },
        { stepId: "S-API", name: "API Gen", description: "Generate OpenAPI spec", targetDescriptorName: "ApiContract" },
        { stepId: "S-CFG", name: "Config Gen", description: "Generate configuration templates", targetDescriptorName: "Configuration" },
        { stepId: "S-DOC", name: "Doc Gen", description: "Generate markdown README", targetDescriptorName: "Documentation" }
      ],
      descriptors: [
        { name: "BackendSkeleton", type: "BACKEND", targetPath: "backend/Controller.ts" },
        { name: "DatabaseSchema", type: "DATABASE", targetPath: "database/schema.sql" },
        { name: "ApiContract", type: "API", targetPath: "api/openapi.yaml" },
        { name: "Configuration", type: "CONFIG", targetPath: "config/app.conf" },
        { name: "Documentation", type: "DOCUMENTATION", targetPath: "README.md" }
      ]
    };

    // 2. Artifact Generator (Plugin orchestration)
    const generator = new ArtifactGenerator();
    const draftBundle = generator.generateBundle(
      plan,
      blueprint.specification,
      blueprint.analysisId,
      bundleId,
      executionId
    );

    // 3. Artifact Validator & Hash Compilation
    const validator = new ArtifactValidator();
    const bundleHash = ArtifactValidator.calculateBundleHash(draftBundle);
    const finalBundle: IArtifactBundle = {
      ...draftBundle,
      bundleHash
    };

    const validation = validator.validate(finalBundle, plan);
    if (!validation.isValid) {
      throw new Error(`Artifact Bundle validation failed: ${validation.issues.join(", ")}`);
    }

    this.setState(RuntimeLifecycle.READY);
    const finishedAt = Date.now();

    return {
      runtimeId: this.manifest.id,
      startedAt,
      finishedAt,
      durationMs: finishedAt - startedAt,
      status: "SUCCESS",
      warnings: [],
      payload: finalBundle
    };
  }
}
