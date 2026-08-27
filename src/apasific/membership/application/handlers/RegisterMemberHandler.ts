import { RegisterMemberCommand } from '../commands/RegisterMemberCommand';
import { Member } from '../../domain/aggregates/Member';
import { MemberID } from '../../domain/value-objects/MemberID';
import { IDomainEventPublisher } from '../ports/IDomainEventPublisher';

// Mock interface for the Repository Port
export interface IMemberRepositoryPort {
  save(member: Member): Promise<void>;
  existsByEmail(email: string): Promise<boolean>;
}

/**
 * RegisterMemberHandler
 * Demonstrates the strict Orchestration Flow:
 * Validate -> Load/Create -> Execute -> Save -> Publish -> Return
 */
export class RegisterMemberHandler {
  constructor(
    private readonly memberRepository: IMemberRepositoryPort,
    private readonly eventPublisher: IDomainEventPublisher
  ) {}

  public async execute(command: RegisterMemberCommand): Promise<void> {
    // 1. Validate Command (Business validation happens here before Domain)
    if (!command.emailStr.includes('@')) {
      throw new Error('Invalid email format');
    }
    const exists = await this.memberRepository.existsByEmail(command.emailStr);
    if (exists) {
      throw new Error('Email already registered');
    }

    // 2. Load/Create Aggregate
    const memberId = new MemberID(command.memberIdStr);
    
    // 3. Execute Aggregate Method (Factory)
    const member = Member.registerNew(memberId, command.emailStr);

    // 4. Repository Save
    await this.memberRepository.save(member);

    // 5. Publish Domain Events
    const events = member.domainEvents;
    await this.eventPublisher.publishAll(events);
    member.clearDomainEvents();

    // 6. Return Result (void or DTO)
    return;
  }
}
