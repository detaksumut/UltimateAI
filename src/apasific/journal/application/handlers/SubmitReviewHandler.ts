import { AuthorizationPolicy } from '../policies/AuthorizationPolicy';
import { CommandResult } from '../commands/CommandResult';
import { Review, ReviewRecommendation } from '../../domain/aggregates/Review';
import { ReviewerReference, BlindReviewMode } from '../../domain/value-objects/ReviewerReference';
import { ITransactionManager, IDomainEventPublisher } from '../ports/JournalPorts';

export class SubmitReviewCommand {
  constructor(
    public readonly correlationId: string,
    public readonly reviewId: string,
    public readonly assignmentId: string,
    public readonly manuscriptId: string,
    public readonly roundNumber: number,
    public readonly recommendation: ReviewRecommendation,
    public readonly publicComments: string,
    public readonly confidentialNotes: string,
    public readonly reviewerMemberId: string,
    public readonly reviewerAcademicId: string,
    public readonly blindMode: BlindReviewMode,
    public readonly requesterRoles: string[],
    public readonly requesterId: string
  ) {}
}

export interface IReviewRepository {
  save(review: Review): Promise<void>;
}

export class SubmitReviewHandler {
  constructor(
    private readonly reviewRepo: IReviewRepository,
    private readonly eventPublisher: IDomainEventPublisher,
    private readonly transactionManager: ITransactionManager
  ) {}

  public async execute(command: SubmitReviewCommand): Promise<CommandResult<void>> {
    // 1. Authorization (Only the assigned reviewer can submit, basic role check here)
    if (command.requesterId !== command.reviewerMemberId) {
      return CommandResult.fail("UNAUTHORIZED: Only the assigned reviewer can submit this review.", command.correlationId);
    }

    try {
      await this.transactionManager.executeInTransaction(async () => {
        // 4. Execute Aggregate (Review Immutable Record Creation)
        const reviewer = new ReviewerReference(command.reviewerMemberId, command.reviewerAcademicId);
        const review = Review.submit(
          command.reviewId,
          command.assignmentId,
          command.manuscriptId,
          command.roundNumber,
          command.recommendation,
          command.publicComments,
          command.confidentialNotes,
          reviewer,
          command.blindMode
        );

        // 5. Save to Repository (Transactional Outbox bounds applied here)
        await this.reviewRepo.save(review);

        // 6. Publish Event
        const mockEvent = { eventId: `evt_${Date.now()}`, occurredAt: new Date(), aggregateId: review.id };
        await this.eventPublisher.publishAll([mockEvent]);
      });

      // 7. Return CommandResult (including the generated Hash conceptually attached to the aggregate)
      return CommandResult.ok(command.reviewId, command.correlationId, 1);
    } catch (error: any) {
      return CommandResult.fail(`SYSTEM_ERROR: ${error.message}`, command.correlationId);
    }
  }
}
