import { ExecutionCheckpoint } from "./ExecutionCheckpoint";

export class CheckpointManager {
  private checkpoints = new Map<string, ExecutionCheckpoint[]>();

  save(checkpoint: ExecutionCheckpoint): void {
    if (!this.checkpoints.has(checkpoint.traceId)) {
      this.checkpoints.set(checkpoint.traceId, []);
    }
    // Deep clone the snapshot to ensure immutability
    const clone = JSON.parse(JSON.stringify(checkpoint));
    this.checkpoints.get(checkpoint.traceId)!.push(clone);
  }

  getLatestSuccessfulCheckpoint(traceId: string): ExecutionCheckpoint | undefined {
    const list = this.checkpoints.get(traceId);
    if (!list || list.length === 0) return undefined;
    
    // In our model, an "AFTER" checkpoint means the runtime succeeded.
    // So we find the latest AFTER checkpoint.
    const successful = list.filter(c => c.phase === "AFTER");
    if (successful.length === 0) {
      // If no runtime succeeded yet, return the very first BEFORE checkpoint if exists
      return list[0];
    }
    
    // Return the one with highest sequence number
    return successful.reduce((prev, current) => 
      (prev.sequenceNumber > current.sequenceNumber) ? prev : current
    );
  }

  getHistory(traceId: string): ExecutionCheckpoint[] {
    return this.checkpoints.get(traceId) || [];
  }
}
