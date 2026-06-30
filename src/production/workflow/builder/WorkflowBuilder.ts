import { Workflow } from "../contracts/Workflow";
import { StageBuilder } from "./StageBuilder";

export class WorkflowBuilder {
  private workflow: Workflow;

  constructor(id: string) {
    this.workflow = {
      metadata: {
        id,
        name: id,
        version: "1.0.0",
        createdBy: "system",
        tags: [],
        description: ""
      },
      stages: []
    };
  }

  withMetadata(name: string, version: string, description: string = ""): this {
    this.workflow.metadata.name = name;
    this.workflow.metadata.version = version;
    this.workflow.metadata.description = description;
    return this;
  }

  addStage(id: string, config: (builder: StageBuilder) => void): this {
    const builder = new StageBuilder(id);
    config(builder);
    this.workflow.stages.push(builder.build());
    return this;
  }

  build(): Workflow {
    return this.workflow;
  }
}
