import { IDomainEventPublisher } from '../../application/ports/InfrastructurePorts';
import { IDomainEvent } from '../../domain/events/MembershipEvents';

/**
 * KafkaEventPublisher
 * Infrastructure implementation of the IDomainEventPublisher Port.
 */
export class KafkaEventPublisher implements IDomainEventPublisher {
  public async publishAll(events: IDomainEvent[]): Promise<void> {
    for (const event of events) {
      // 1. Transform Domain Event to Integration Event Envelope
      const envelope = this.createEnvelope(event);
      
      // 2. Publish to Kafka Topic (Mocked)
      console.log(`[Kafka] Publishing to membership.events: ${JSON.stringify(envelope)}`);
      
      // Await kafkaProducer.send(...)
    }
  }

  private createEnvelope(event: IDomainEvent): any {
    return {
      eventId: event.eventId,
      eventType: event.constructor.name + 'IntegrationEvent',
      aggregateId: event.aggregateId,
      version: '1.0',
      occurredAt: event.occurredAt.toISOString(),
      payload: event
    };
  }
}
