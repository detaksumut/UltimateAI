import { Task } from "../contracts/Task";
import { RuntimeCapability } from "../../runtime/contracts/RuntimeCapability";

export class TaskBuilder {
  private task: Task;

  constructor(id: string, capability: RuntimeCapability) {
    this.task = {
      id,
      name: id,
      capability,
      dependencies: []
    };
  }

  withName(name: string): this {
    this.task.name = name;
    return this;
  }

  dependsOn(...taskIds: string[]): this {
    this.task.dependencies.push(...taskIds);
    return this;
  }

  build(): Task {
    return this.task;
  }
}
