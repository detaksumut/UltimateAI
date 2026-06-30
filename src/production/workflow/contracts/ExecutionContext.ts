import { IRuntimeContext } from "../../runtime/contracts/IRuntimeContext";

export interface ExecutionContext {
  traceId: string;
  workflowId: string;
  runtimeContext: IRuntimeContext; // Used to pass state to runtimes
  // In the future, this can also inject active handles for Observability/Reliability components 
  // if they aren't globally available or injected via constructor.
}
