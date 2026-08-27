import { IDomainBlueprint } from "./IDomainBlueprint";
import { BlueprintValidator } from "./BlueprintValidator";

export interface BlueprintAuditLog {
  readonly eventType: string;
  readonly timestamp: number;
  readonly blueprintId: string;
  readonly hash: string;
  readonly foundationBaseline: string;
  readonly domain: string;
}

export interface IBlueprintRegistry {
  register(blueprint: IDomainBlueprint): void;
  find(blueprintId: string): IDomainBlueprint | undefined;
  list(): IDomainBlueprint[];
  exists(blueprintId: string): boolean;
  verifyHash(blueprintId: string): boolean;
  getAuditLogs(): BlueprintAuditLog[];
}

export class BlueprintRegistryImpl implements IBlueprintRegistry {
  private readonly blueprints = new Map<string, IDomainBlueprint>();
  private readonly auditLogs: BlueprintAuditLog[] = [];

  register(blueprint: IDomainBlueprint): void {
    if (blueprint.status !== "REGISTERED") {
      throw new Error(`Cannot register blueprint: Expected status REGISTERED, got ${blueprint.status}`);
    }
    
    if (this.blueprints.has(blueprint.blueprintId)) {
      throw new Error(`Blueprint with ID ${blueprint.blueprintId} is already registered.`);
    }

    // Verify hash integrity before registering
    const validator = new BlueprintValidator();
    const validation = validator.validate(blueprint);
    if (!validation.isValid) {
      throw new Error("Cannot register blueprint: Hash validation or integrity checks failed.");
    }

    this.blueprints.set(blueprint.blueprintId, blueprint);

    this.auditLogs.push({
      eventType: "Blueprint Registered",
      timestamp: Date.now(),
      blueprintId: blueprint.blueprintId,
      hash: blueprint.blueprintHash,
      foundationBaseline: blueprint.foundationBaseline,
      domain: blueprint.domain
    });
  }

  find(blueprintId: string): IDomainBlueprint | undefined {
    return this.blueprints.get(blueprintId);
  }

  list(): IDomainBlueprint[] {
    return Array.from(this.blueprints.values());
  }

  exists(blueprintId: string): boolean {
    return this.blueprints.has(blueprintId);
  }

  verifyHash(blueprintId: string): boolean {
    const bp = this.find(blueprintId);
    if (!bp) return false;
    
    const expected = BlueprintValidator.calculateHash(bp);
    return expected === bp.blueprintHash;
  }

  getAuditLogs(): BlueprintAuditLog[] {
    return this.auditLogs;
  }
}
