/**
 * ExecutionContextFactory.ts
 *
 * Spawns thousands of ExecutionContext instances from a single Package.
 */

import { IExecutionPackage } from '../contracts/IExecutionPackage';
import { IExecutionContext } from '../contracts/IExecutionContext';
import { IExecutionPolicy } from '../contracts/IExecutionPolicy';
import { randomUUID } from 'crypto';

export class ExecutionContextFactory {
  
  public create(pkg: IExecutionPackage, actor: string = 'system', customPolicy?: IExecutionPolicy): IExecutionContext {
    const policy = customPolicy || {
      timeout_ms: 30000, // 30 seconds default
      max_retries: 3,
      retry_backoff_ms: 1000,
      priority: 1
    };

    return {
      metadata: {
        execution_id: randomUUID(),
        workflow_id: pkg.metadata.workflow_id,
        package_version: pkg.package_version,
        trace_id: randomUUID(), // Initial trace for observability
        actor: actor,
        created_at: new Date().toISOString(),
        policy: policy
      },
      state: {
        current_state: pkg.plan.initial_state,
        status: 'PENDING',
        variables: {},
        history: [],
        retry_count: 0
      }
    };
  }
}
