import { IRuntimeContext } from "../../runtime/contracts/IRuntimeContext";

export interface ExecutionCheckpoint {
  checkpointId: string;
  traceId: string;
  sequenceNumber: number;
  runtimeId: string;
  phase: "BEFORE" | "AFTER";
  artifactIds: string[];
  timestamp: number;
  contextSnapshot: IRuntimeContext; // Immutable clone of the context at this point
  resultPayload?: any; // To allow ResumeEngine to bypass execution and inject the result
}
