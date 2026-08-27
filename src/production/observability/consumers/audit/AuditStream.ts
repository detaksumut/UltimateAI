/**
 * AuditStream.ts
 *
 * Consumer 4: Compliance Consumer.
 * Append-only. Throws explicit errors if writing fails (simulated here).
 */

import { IEventConsumer } from '../../contracts/IEventDispatcher';
import { IObservabilityContext } from '../../contracts/IObservabilityContext';

export class AuditStream implements IEventConsumer {
  public readonly name = 'AuditStream';
  
  public readonly ledger: string[] = [];
  public simulateFailure = false; // For isolation testing
  
  public consume(context: IObservabilityContext): void {
    if (this.simulateFailure) {
      throw new Error(`AuditStream Error: Failed to flush compliance log to WORM storage.`);
    }
    
    const e = context.event;
    
    // Construct an immutable, legally binding audit record string
    const record = `[AUDIT] Time: ${e.timestamp} | Trace: ${context.correlation_id || e.execution_id} | Node: ${context.node_id} | Event: ${e.type} | PayloadHash: ${this.hash(e.payload)}`;
    
    this.ledger.push(record);
  }
  
  private hash(payload: any): string {
    // In production, cryptographically hash the payload for tamper evidence
    return '0x' + Buffer.from(JSON.stringify(payload) || '').toString('base64').substring(0, 8);
  }
}
