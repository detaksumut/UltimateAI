import { Job } from "../contracts/Job";
import { TaskBuilder } from "./TaskBuilder";
import { RuntimeCapability } from "../../runtime/contracts/RuntimeCapability";

export class JobBuilder {
  private job: Job;

  constructor(id: string) {
    this.job = {
      id,
      name: id,
      tasks: []
    };
  }

  withName(name: string): this {
    this.job.name = name;
    return this;
  }

  addTask(id: string, capability: RuntimeCapability, config?: (builder: TaskBuilder) => void): this {
    const builder = new TaskBuilder(id, capability);
    if (config) config(builder);
    this.job.tasks.push(builder.build());
    return this;
  }

  build(): Job {
    return this.job;
  }
}
