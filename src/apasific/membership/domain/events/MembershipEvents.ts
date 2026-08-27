export interface IDomainEvent {
  eventId: string;
  occurredAt: Date;
  aggregateId: string;
}

export class MemberRegistered implements IDomainEvent {
  public eventId: string;
  public occurredAt: Date;

  constructor(public readonly aggregateId: string, public readonly email: string) {
    this.eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    this.occurredAt = new Date();
  }
}

export class MembershipActivated implements IDomainEvent {
  public eventId: string;
  public occurredAt: Date;

  constructor(public readonly aggregateId: string, public readonly academicId: string) {
    this.eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    this.occurredAt = new Date();
  }
}
