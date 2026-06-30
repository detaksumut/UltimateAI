import { Stage } from "../contracts/Stage";
import { JobBuilder } from "./JobBuilder";

export class StageBuilder {
  private stage: Stage;

  constructor(id: string) {
    this.stage = {
      id,
      name: id,
      jobs: []
    };
  }

  withName(name: string): this {
    this.stage.name = name;
    return this;
  }

  addJob(id: string, config: (builder: JobBuilder) => void): this {
    const builder = new JobBuilder(id);
    config(builder);
    this.stage.jobs.push(builder.build());
    return this;
  }

  build(): Stage {
    return this.stage;
  }
}
