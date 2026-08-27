import { AuthorizationPolicy } from '../policies/AuthorizationPolicy';
import { CommandResult } from '../commands/CommandResult';
import { ReviewAssignment } from '../../domain/aggregates/ReviewAssignment';
import { BlindReviewMode, ReviewerReference } from '../../domain/value-objects/ReviewerReference';
import { ITransactionManager, IDomainEventPublisher } from '../ports/JournalPorts';

export class AssignReviewerCommand {
  constructor(
    public readonly correlationId: string,
    public readonly assignmentId: string,
    public readonly manuscriptId: string,
    public readonly reviewerMemberId: string,
    public readonly reviewerAcademicId: string,
    public readonly blindMode: BlindReviewMode,
    public readonly responseDeadline: Date,
    public readonly reviewDeadline: Date,
    public readonly requesterRoles: string[]
  ) {}
}

export interface IReviewAssignmentRepository {
  save(assignment: ReviewAssignment): Promise<void>;
}

export class AssignReviewerHandler {
  constructor(
    private readonly assignmentRepo: IReviewAssignmentRepository,
    private readonly eventPublisher: IDomainEventPublisher,
    private readonly transactionManager: ITransactionManager
  ) {}

  public async execute(command: AssignReviewerCommand): Promise<CommandResult<void>> {
    // 1. Authorization
    if (!AuthorizationPolicy.canAssignReviewer(command.requesterRoles)) {
      return CommandResult.fail("UNAUTHORIZED: Only Editors can assign reviewers.", command.correlationId);
    }

    // 2. Validate Command
    if (!command.assignmentId || !command.manuscriptId || !command.reviewerAcademicId) {
      return CommandResult.fail("VALIDATION_ERROR: Missing identities.", command.correlationId);
    }

    // 3. Load Reference Data (In a real scenario, check if Reviewer is active via external port, COI checks happen via Domain Service)

    try {
      await this.transactionManager.executeInTransaction(async () => {
        // 4. Execute Aggregate
        const reviewer = new ReviewerReference(command.reviewerMemberId, command.reviewerAcademicId);
        const assignment = ReviewAssignment.invite(
          command.assignmentId,
          command.manuscriptId,
          reviewer,
          command.blindMode,
          command.responseDeadline,
          command.reviewDeadline
        );

        // 5. Save (Inside transaction, Outbox pattern implied by infrastructure)
        await this.assignmentRepo.save(assignment);

        // 6. Publish (Integration Events dispatched via Outbox)
        const mockEvent = { eventId: `evt_${Date.now()}`, occurredAt: new Date(), aggregateId: assignment.id };
        await this.eventPublisher.publishAll([mockEvent]);
      });

      // 7. Return Result
      return CommandResult.ok(command.assignmentId, command.correlationId, 1);
    } catch (error: any) {
      return CommandResult.fail(`SYSTEM_ERROR: ${error.message}`, command.correlationId);
    }
  }
}
