import { TraceChain } from "./TraceChain";

/**
 * The supreme parent context that holds global state and trace IDs.
 * All specific runtime contexts (e.g. LearningContext) should extend this.
 */
export interface IRuntimeContext {
  /** The definitive trace chain that links all runtimes participating in this request */
  readonly trace: TraceChain;
  
  /** When this execution was triggered */
  readonly timestamp: number;
}

