import { IDomainEvent } from '../../domain/events/MembershipEvents';

export interface IMemberRepository {
  // Methods defined in Domain, implemented in Infrastructure
}

export interface IVerificationRepository {
  // Methods defined in Domain, implemented in Infrastructure
}

export interface IDomainEventPublisher {
  publishAll(events: IDomainEvent[]): Promise<void>;
}

export interface IIdentityProvider {
  createAccount(email: string): Promise<string>; // Returns external provider ID
}

export interface IDocumentStorage {
  upload(fileBuffer: Buffer, fileName: string): Promise<string>; // Returns URL
}

export interface IClock {
  now(): Date;
}

export interface IIdGenerator {
  generateMemberId(): string;
  generateAcademicId(): string;
}

export interface ITransactionManager {
  executeInTransaction<T>(work: () => Promise<T>): Promise<T>;
}
