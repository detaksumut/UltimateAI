import { AuthorizationPolicy } from '../policies/AuthorizationPolicy';
import { CommandResult } from '../commands/CommandResult';
import { EditorialDecision, DecisionType, EditorReference } from '../../domain/aggregates/EditorialDecision';
import { ITransactionManager, IDomainEventPublisher } from '../ports/JournalPorts';

export class RecordDecisionCommand {
  constructor(
    public readonly traceId: string,
    public readonly correlationId: string,
    public readonly decisionId: string,
    public readonly manuscriptId: string,
    public readonly editorMemberId: string,
    public readonly editorAcademicId: string,
    public readonly roundNumber: number,
    public readonly decisionType: DecisionType,
    public readonly basis: string,
    public readonly referencedReviewIds: string[],
    public readonly previousDecisionId: string | null,
    public readonly requesterRoles: string[]
  ) {}
}

export interface IEditorialDecisionRepository {
  save(decision: EditorialDecision): Promise<void>;
}

export class RecordDecisionHandler {
  constructor(
    private readonly decisionRepo: IEditorialDecisionRepository,
    private readonly eventPublisher: IDomainEventPublisher,
    private readonly transactionManager: ITransactionManager
  ) {}

  public async execute(command: RecordDecisionCommand): Promise<CommandResult<void>> {
    if (!AuthorizationPolicy.canRecordDecision(command.requesterRoles)) {
      return CommandResult.fail("UNAUTHORIZED: Only Chief or Section Editors can record decisions.", command.correlationId, command.traceId);
    }

    try {
      await this.transactionManager.executeInTransaction(async () => {
        const editor = new EditorReference(command.editorMemberId, command.editorAcademicId);
        
        // Factory Execution (Immutable Record)
        const decision = EditorialDecision.record(
          command.decisionId,
          command.manuscriptId,
          editor,
          command.roundNumber,
          command.decisionType,
          command.basis,
          command.referencedReviewIds,
          command.previousDecisionId
        );

        // Transactional Boundaries applied here (Repository + Outbox)
        await this.decisionRepo.save(decision);

        const mockEvent = { eventId: `evt_${Date.now()}`, occurredAt: new Date(), aggregateId: decision.id };
        await this.eventPublisher.publishAll([mockEvent]);
      });

      return CommandResult.ok(command.decisionId, command.correlationId, command.traceId, 1);
    } catch (error: any) {
      return CommandResult.fail(`SYSTEM_ERROR: ${error.message}`, command.correlationId, command.traceId);
    }
  }
}
