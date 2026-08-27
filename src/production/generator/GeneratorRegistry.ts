import { GenerationTask } from "./DagGeneratorPlanner";

export interface ArtifactResult {
  readonly artifactId: string;
  readonly taskId: string;
  readonly generatorId: string;
  readonly outputType: string;
  readonly content: string;
  readonly metadata: Record<string, string>;
}

export interface IGenerator {
  readonly generatorId: string;
  generate(task: GenerationTask): ArtifactResult;
}

/** Capability metadata registered alongside every IGenerator. */
export interface GeneratorCapabilityMeta {
  readonly generatorId: string;
  readonly displayName: string;
  readonly version: string;
  readonly maturity: "stable" | "beta" | "experimental";
  readonly produces: ("backend" | "frontend" | "database" | "cache" | "broker" | "deployment")[];
  readonly supportedPatterns: ("monolith" | "microservices" | "serverless")[];
  readonly description: string;
}

class NestJSGenerator implements IGenerator {
  readonly generatorId = "GEN-NEST";
  generate(task: GenerationTask): ArtifactResult {
    return {
      artifactId: `art-${task.taskId}`,
      taskId: task.taskId,
      generatorId: this.generatorId,
      outputType: "typescript/nestjs",
      content: [
        `// [NestJS] Generated for: ${task.targetService.name}`,
        `import { Module } from '@nestjs/common';`,
        `@Module({ imports: [], providers: [], exports: [] })`,
        `export class AppModule {}`,
      ].join("\n"),
      metadata: { port: String(task.targetService.port ?? 3000) }
    };
  }
}

class ReactGenerator implements IGenerator {
  readonly generatorId = "GEN-REACT";
  generate(task: GenerationTask): ArtifactResult {
    return {
      artifactId: `art-${task.taskId}`,
      taskId: task.taskId,
      generatorId: this.generatorId,
      outputType: "typescript/react",
      content: [
        `// [React] Generated for: ${task.targetService.name}`,
        `export default function App() { return <div>UltimateAI App</div>; }`,
      ].join("\n"),
      metadata: { port: String(task.targetService.port ?? 80) }
    };
  }
}

class PostgresGenerator implements IGenerator {
  readonly generatorId = "GEN-POSTGRES";
  generate(task: GenerationTask): ArtifactResult {
    return {
      artifactId: `art-${task.taskId}`,
      taskId: task.taskId,
      generatorId: this.generatorId,
      outputType: "sql/postgresql",
      content: `-- [PostgreSQL] Generated for: ${task.targetService.name}\nCREATE SCHEMA IF NOT EXISTS app;`,
      metadata: { port: String(task.targetService.port ?? 5432) }
    };
  }
}

class RedisGenerator implements IGenerator {
  readonly generatorId = "GEN-REDIS";
  generate(task: GenerationTask): ArtifactResult {
    return {
      artifactId: `art-${task.taskId}`,
      taskId: task.taskId,
      generatorId: this.generatorId,
      outputType: "config/redis",
      content: `# [Redis] Generated for: ${task.targetService.name}\nbind 0.0.0.0\nport 6379`,
      metadata: { port: "6379" }
    };
  }
}

class KafkaGenerator implements IGenerator {
  readonly generatorId = "GEN-KAFKA";
  generate(task: GenerationTask): ArtifactResult {
    return {
      artifactId: `art-${task.taskId}`,
      taskId: task.taskId,
      generatorId: this.generatorId,
      outputType: "config/kafka",
      content: `# [Kafka] Generated for: ${task.targetService.name}\nbootstrap.servers=localhost:9092`,
      metadata: { port: "9092" }
    };
  }
}

// ─── Generator Registry ───────────────────────────────────────────────────────

const BUILT_IN_CAPABILITY_META: GeneratorCapabilityMeta[] = [
  {
    generatorId: "GEN-NEST",
    displayName: "NestJS Backend Generator",
    version: "1.0.0",
    maturity: "stable",
    produces: ["backend"],
    supportedPatterns: ["monolith", "microservices"],
    description: "Generates NestJS TypeScript application modules with DI and decorators."
  },
  {
    generatorId: "GEN-REACT",
    displayName: "React Frontend Generator",
    version: "1.0.0",
    maturity: "stable",
    produces: ["frontend"],
    supportedPatterns: ["monolith", "microservices"],
    description: "Generates React TypeScript components and application shell."
  },
  {
    generatorId: "GEN-POSTGRES",
    displayName: "PostgreSQL Schema Generator",
    version: "1.0.0",
    maturity: "stable",
    produces: ["database"],
    supportedPatterns: ["monolith", "microservices"],
    description: "Generates PostgreSQL DDL schema and migration scripts."
  },
  {
    generatorId: "GEN-REDIS",
    displayName: "Redis Cache Generator",
    version: "1.0.0",
    maturity: "stable",
    produces: ["cache"],
    supportedPatterns: ["monolith", "microservices"],
    description: "Generates Redis configuration and connection bootstrap."
  },
  {
    generatorId: "GEN-KAFKA",
    displayName: "Kafka Broker Generator",
    version: "1.0.0",
    maturity: "beta",
    produces: ["broker"],
    supportedPatterns: ["microservices"],
    description: "Generates Kafka topic definitions and consumer/producer bootstrap."
  }
];

export class GeneratorRegistry {
  private readonly generators: Map<string, IGenerator>;
  private readonly capabilityMeta: Map<string, GeneratorCapabilityMeta>;

  constructor() {
    this.generators = new Map<string, IGenerator>();
    this.capabilityMeta = new Map<string, GeneratorCapabilityMeta>();

    // Register all built-in generators
    [new NestJSGenerator(), new ReactGenerator(), new PostgresGenerator(), new RedisGenerator(), new KafkaGenerator()]
      .forEach(g => this.generators.set(g.generatorId, g));

    // Register built-in capability metadata
    BUILT_IN_CAPABILITY_META.forEach(m => this.capabilityMeta.set(m.generatorId, m));
  }

  register(generator: IGenerator, meta?: GeneratorCapabilityMeta): void {
    this.generators.set(generator.generatorId, generator);
    if (meta) this.capabilityMeta.set(generator.generatorId, meta);
  }

  resolve(generatorId: string): IGenerator | undefined {
    return this.generators.get(generatorId);
  }

  listAll(): string[] {
    return Array.from(this.generators.keys());
  }

  execute(task: GenerationTask): ArtifactResult {
    const generator = this.resolve(task.generatorId);
    if (!generator) {
      throw new Error(`Generator not found: ${task.generatorId}`);
    }
    return generator.generate(task);
  }

  /** Returns the full capability matrix — all generators with their metadata. */
  getCapabilityMatrix(): GeneratorCapabilityMeta[] {
    return Array.from(this.generators.keys()).map(id => {
      return (
        this.capabilityMeta.get(id) ?? {
          generatorId: id,
          displayName: id,
          version: "unknown",
          maturity: "experimental" as const,
          produces: [],
          supportedPatterns: [],
          description: "No capability metadata registered."
        }
      );
    });
  }
}
