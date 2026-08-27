export enum DecisionType {
  DESK_REJECT = 'DESK_REJECT',
  REVISION_REQUIRED = 'REVISION_REQUIRED',
  ACCEPT = 'ACCEPT',
  REJECT = 'REJECT',
  RETRACTION = 'RETRACTION'
}

export class EditorReference {
  constructor(
    public readonly memberId: string,
    public readonly academicId: string
  ) {}
}

/**
 * EditorialDecision Aggregate Root
 * A Governance Record representing an immutable scientific decision.
 */
export class EditorialDecision {
  private constructor(
    public readonly id: string,
    public readonly manuscriptId: string,
    public readonly editor: EditorReference,
    public readonly roundNumber: number,
    public readonly decisionType: DecisionType,
    public readonly basis: string,
    public readonly referencedReviewIds: string[],
    public readonly previousDecisionId: string | null,
    public readonly effectiveDate: Date,
    public readonly integrityHash: string
  ) {}

  public static record(
    id: string,
    manuscriptId: string,
    editor: EditorReference,
    roundNumber: number,
    decisionType: DecisionType,
    basis: string,
    referencedReviewIds: string[],
    previousDecisionId: string | null
  ): EditorialDecision {
    const effectiveDate = new Date();
    // Simulate cryptographic hashing to detect tampering outside the application layer
    const hashPayload = `${id}|${manuscriptId}|${decisionType}|${basis}|${effectiveDate.getTime()}`;
    const integrityHash = `hash_${Buffer.from(hashPayload).toString('base64')}`;

    return new EditorialDecision(
      id,
      manuscriptId,
      editor,
      roundNumber,
      decisionType,
      basis,
      referencedReviewIds,
      previousDecisionId,
      effectiveDate,
      integrityHash
    );
  }

  // INVARIANT: APPEND-ONLY GOVERNANCE RECORD
  // There are intentionally no edit(), changeDecision(), or update() methods.
}
