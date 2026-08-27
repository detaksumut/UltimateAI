import { ArtifactDescriptor, IExecutionPlan } from "../../foundation/execution/IExecutionPlan";
import { LogFileArtifact, IArtifactBundle } from "../../foundation/execution/IArtifactBundle";
import { IArtifactManifest, ArtifactRecord } from "../../foundation/execution/IArtifactManifest";
import { BlueprintValidator } from "../../foundation/blueprint/BlueprintValidator";
import * as crypto from "crypto";

export interface IArtifactGeneratorPlugin {
  generate(descriptor: ArtifactDescriptor, spec: any): string;
}

// 1. Concrete plugin implementations - 100% deterministic
export class BackendGeneratorPlugin implements IArtifactGeneratorPlugin {
  generate(desc: ArtifactDescriptor, spec: any): string {
    return `// Generated Backend Controller: ${desc.name}
export class ${desc.name}Controller {
  // Configured Review Method: ${spec.workflow?.reviewMethod || "unknown"}
  async handleRequest(req: any) {
    return { status: "PROCESSED", handler: "${desc.name}" };
  }
}`;
  }
}

export class DatabaseGeneratorPlugin implements IArtifactGeneratorPlugin {
  generate(desc: ArtifactDescriptor, spec: any): string {
    return `-- Generated Database Schema: ${desc.name}
CREATE TABLE ${desc.name.toLowerCase()}_records (
  id VARCHAR(50) PRIMARY KEY,
  audit_trail_enabled BOOLEAN DEFAULT ${spec.database?.auditTrail ? "TRUE" : "FALSE"}
);`;
  }
}

export class ApiGeneratorPlugin implements IArtifactGeneratorPlugin {
  generate(desc: ArtifactDescriptor, spec: any): string {
    return `# Generated OpenAPI Contract: ${desc.name}
openapi: 3.0.0
info:
  title: ${desc.name} API
  version: 1.0.0
paths:
  /api/${desc.name.toLowerCase()}:
    get:
      summary: Retrieve standard domain records
      responses:
        '200':
          description: Successful retrieval
`;
  }
}

export class ConfigGeneratorPlugin implements IArtifactGeneratorPlugin {
  generate(desc: ArtifactDescriptor, spec: any): string {
    return `# Generated Configuration: ${desc.name}
domain: ${spec.compliance?.indexingTarget ? spec.compliance.indexingTarget.join(",") : "none"}
metadata_standard: ${spec.compliance?.metadataStandard || "dublin-core"}
issn: ${spec.compliance?.issn || "0000-0000"}
`;
  }
}

export class DocumentationGeneratorPlugin implements IArtifactGeneratorPlugin {
  generate(desc: ArtifactDescriptor, spec: any): string {
    return `# Documentation: ${desc.name}
Ini adalah dokumentasi resmi untuk modul yang dihasilkan secara deterministik.
Target Indeksasi: ${spec.compliance?.indexingTarget ? spec.compliance.indexingTarget.join(",") : "SINTA"}
`;
  }
}

/**
 * ArtifactGeneratorResolver
 * Menyelesaikan generator spesifik berdasarkan tipe deskriptor secara dinamis (Plugin Architecture)
 */
export class ArtifactGeneratorResolver {
  private readonly plugins = new Map<string, IArtifactGeneratorPlugin>();

  constructor() {
    this.plugins.set("BACKEND", new BackendGeneratorPlugin());
    this.plugins.set("DATABASE", new DatabaseGeneratorPlugin());
    this.plugins.set("API", new ApiGeneratorPlugin());
    this.plugins.set("CONFIG", new ConfigGeneratorPlugin());
    this.plugins.set("DOCUMENTATION", new DocumentationGeneratorPlugin());
  }

  resolve(type: string): IArtifactGeneratorPlugin {
    const plugin = this.plugins.get(type);
    if (!plugin) {
      throw new Error(`No generator plugin registered for type: ${type}`);
    }
    return plugin;
  }
}

export class ArtifactGenerator {
  private readonly resolver = new ArtifactGeneratorResolver();

  generateBundle(
    plan: IExecutionPlan,
    specification: any,
    analysisId: string,
    bundleId: string,
    executionId: string
  ): Omit<IArtifactBundle, "bundleHash"> {
    const artifacts: LogFileArtifact[] = [];
    const records: ArtifactRecord[] = [];

    // Proses perakitan berkas secara deterministik
    plan.descriptors.forEach(desc => {
      const plugin = this.resolver.resolve(desc.type);
      const content = plugin.generate(desc, specification);
      
      const filepath = desc.targetPath;
      artifacts.push({ filepath, content });

      // Generate stable filehash (SHA-256)
      const filehash = crypto.createHash("sha256").update(content).digest("hex");
      
      records.push({
        artifactId: `art-${crypto.createHash("sha256").update(filepath).digest("hex").substring(0, 16)}`,
        requirementId: "req-b4-user-input",
        analysisId,
        blueprintId: plan.blueprintId,
        executionId,
        bundleId,
        filepath,
        filehash,
        filetype: desc.type,
        generatedAt: 1767225600000 // Deterministic fixed timestamp (Jan 1, 2026) instead of Date.now()
      });
    });

    // Generate Manifest content
    const manifestId = `manifest-${crypto.createHash("sha256").update(executionId).digest("hex").substring(0, 16)}`;
    const manifest: IArtifactManifest = {
      manifestId,
      blueprintId: plan.blueprintId,
      executionId,
      records
    };

    const manifestContent = JSON.stringify(manifest, null, 2);
    const manifestPath = "manifest.json";
    artifacts.push({ filepath: manifestPath, content: manifestContent });

    return {
      bundleId,
      executionId,
      blueprintId: plan.blueprintId,
      artifacts,
      manifest
    };
  }
}
