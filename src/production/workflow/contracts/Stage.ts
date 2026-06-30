import { Job } from "./Job";

export interface Stage {
  id: string;
  name: string;
  jobs: Job[]; // Independent jobs to be run in parallel
}
