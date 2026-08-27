import { SubmitArticleCommand } from '../commands/SubmitArticleCommand';
import { AuthorizationPolicy } from '../policies/AuthorizationPolicy';
import { Submission } from '../../domain/aggregates/Submission';
import { AuthorReference } from '../../domain/value-objects/ReviewerReference'; // Reusing VO for example
import { ISubmissionRepository, IDomainEventPublisher, ITransactionManager } from '../ports/JournalPorts';

export class SubmitArticleHandler {
  constructor(
    private readonly submissionRepo: ISubmissionRepository,
    private readonly eventPublisher: IDomainEventPublisher,
    private readonly transactionManager: ITransactionManager
  ) {}

  public async execute(command: SubmitArticleCommand): Promise<void> {
    // 1. Authorization
    if (!AuthorizationPolicy.canSubmitArticle(command.requesterRoles, command.requesterStatus)) {
      throw new Error("UNAUTHORIZED: Member is not active or lacks author privileges.");
    }

    // 2. Validate Command (Basic DTO validation happens before, but sanity checks here)
    if (!command.submissionId || !command.academicId) {
      throw new Error("VALIDATION_ERROR: Missing required canonical identities.");
    }

    await this.transactionManager.executeInTransaction(async () => {
      // 3. Execute Aggregate (Domain Logic)
      const author = new AuthorReference(command.memberId, command.academicId);
      const submission = Submission.submit(
        command.submissionId,
        author,
        command.files,
        command.coverLetter
      );

      // 4. Save Repository
      await this.submissionRepo.save(submission);

      // 5. Publish Events
      // In reality, Submission.submit() would generate a ManuscriptSubmitted event internally.
      const mockEvent = { eventId: 'evt_1', occurredAt: new Date(), aggregateId: submission.id };
      await this.eventPublisher.publishAll([mockEvent]);
    });

    // 6. Return Result (void)
  }
}
