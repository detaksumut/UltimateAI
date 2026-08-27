import { AuthorizationPolicy } from '../policies/AuthorizationPolicy';
import { CommandResult } from '../commands/CommandResult';
import { ITransactionManager, IManuscriptRepository, IDomainEventPublisher } from '../ports/JournalPorts';

export class RetractArticleCommand {
  constructor(
    public readonly traceId: string,
    public readonly correlationId: string,
    public readonly manuscriptId: string,
    public readonly editorMemberId: string,
    public readonly retractionDecisionId: string,
    public readonly requesterRoles: string[]
  ) {}
}

export class RetractArticleHandler {
  constructor(
    private readonly manuscriptRepo: IManuscriptRepository,
    private readonly eventPublisher: IDomainEventPublisher,
    private readonly transactionManager: ITransactionManager
  ) {}

  public async execute(command: RetractArticleCommand): Promise<CommandResult<void>> {
    // 1. Authorization: Only Chief Editor
    if (!command.requesterRoles.includes('CHIEF_EDITOR')) {
      return CommandResult.fail("UNAUTHORIZED: Only Chief Editor can retract articles.", command.correlationId, command.traceId);
    }

    try {
      await this.transactionManager.executeInTransaction(async () => {
        // 2. Load Aggregate
        const manuscript = await this.manuscriptRepo.findById(command.manuscriptId);
        if (!manuscript) throw new Error("Manuscript not found");

        // 3. Execute Aggregate (The domain asserts if it is PUBLISHED)
        manuscript.retract(command.editorMemberId, command.retractionDecisionId);

        // 4. Save
        await this.manuscriptRepo.save(manuscript);

        // 5. Outbox Publish
        const mockEvent = { eventId: `evt_${Date.now()}`, occurredAt: new Date(), aggregateId: manuscript.id };
        await this.eventPublisher.publishAll([mockEvent]);
      });

      return CommandResult.ok(command.manuscriptId, command.correlationId, command.traceId, 1); // Bumps version logically
    } catch (error: any) {
      return CommandResult.fail(`SYSTEM_ERROR: ${error.message}`, command.correlationId, command.traceId);
    }
  }
}
