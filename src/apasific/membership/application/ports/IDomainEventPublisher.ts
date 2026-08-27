import { IDomainEvent } from '../../domain/events/MembershipEvents';

/**
 * IDomainEventPublisher Port
 * Belongs to the Application Layer. Implemented by the Infrastructure Layer.
 * Decouples the application from Kafka/RabbitMQ/Temporal.
 */
export interface IDomainEventPublisher {
  publish(event: IDomainEvent): Promise<void>;
  publishAll(events: IDomainEvent[]): Promise<void>;
}
