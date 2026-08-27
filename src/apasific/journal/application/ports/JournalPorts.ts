import { Submission } from '../../domain/aggregates/Submission';
import { Manuscript } from '../../domain/aggregates/Manuscript';

export interface IDomainEvent {
  eventId: string;
  occurredAt: Date;
  aggregateId: string;
}

export interface IDomainEventPublisher {
  publishAll(events: IDomainEvent[]): Promise<void>;
}

export interface ISubmissionRepository {
  save(submission: Submission): Promise<void>;
  findById(id: string): Promise<Submission | null>;
}

export interface IManuscriptRepository {
  save(manuscript: Manuscript): Promise<void>;
  findById(id: string): Promise<Manuscript | null>;
}

export interface ITransactionManager {
  executeInTransaction<T>(work: () => Promise<T>): Promise<T>;
}
