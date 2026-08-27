/**
 * MemoryDLQ.ts
 *
 * In-memory implementation of the DLQ.
 */

import { IDeadLetterQueue, IDLQRecord } from './IDeadLetterQueue';
import { randomUUID } from 'crypto';

export class MemoryDLQ implements IDeadLetterQueue {
  private records: IDLQRecord[] = [];
  
  public push(record: Omit<IDLQRecord, 'dlq_id' | 'timestamp'>): IDLQRecord {
    const fullRecord: IDLQRecord = {
      ...record,
      dlq_id: randomUUID(),
      timestamp: new Date().toISOString()
    };
    
    this.records.push(fullRecord);
    return fullRecord;
  }
  
  public get(dlqId: string): IDLQRecord | undefined {
    return this.records.find(r => r.dlq_id === dlqId);
  }
  
  public list(executionId?: string): IDLQRecord[] {
    if (executionId) {
      return this.records.filter(r => r.execution_id === executionId);
    }
    return this.records;
  }
}
