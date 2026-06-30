import { Task } from "./Task";

export interface Job {
  id: string;
  name: string;
  tasks: Task[]; // DAG of tasks
}
