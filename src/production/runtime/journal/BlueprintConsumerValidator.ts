import { IDomainBlueprint } from "../../foundation/blueprint/IDomainBlueprint";

export class BlueprintConsumerValidator {
  /**
   * Membuktikan bahwa blueprint dapat dikonsumsi oleh runtime eksekusi hilir.
   * Hanya melakukan validasi pembacaan schema/version tanpa filesystem output.
   */
  consume(blueprint: IDomainBlueprint): { success: boolean; message: string } {
    if (blueprint.foundationBaseline !== "UAI-FB-1.0") {
      return { success: false, message: `Incompatible baseline in consumer: ${blueprint.foundationBaseline}` };
    }
    
    const spec = blueprint.specification;
    if (!spec.database || !spec.workflow || !spec.api) {
      return { success: false, message: "Missing required spec components in consumer validation" };
    }

    return { 
      success: true, 
      message: `Blueprint ${blueprint.blueprintId} parsed successfully by Consumer. Domain: ${blueprint.domain}. Status: ${blueprint.status}`
    };
  }
}
