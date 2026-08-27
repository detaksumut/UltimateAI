export enum ManuscriptStatus {
  IN_REVIEW = 'IN_REVIEW',
  REVISION_REQUIRED = 'REVISION_REQUIRED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  PUBLISHED = 'PUBLISHED',
  RETRACTED = 'RETRACTED'
}

/**
 * Manuscript Aggregate Root
 * The core scientific document lifecycle. 
 * Enforces "Manuscript Never Dies" and "Chain of Custody" invariants.
 */
export class Manuscript {
  private constructor(
    public readonly id: string,
    public readonly submissionId: string,
    public readonly title: string,
    public version: number,
    public status: ManuscriptStatus,
    public doi: string | null,
    private chainOfCustody: any[] // In reality, strongly typed ChainOfCustodyRecord[]
  ) {}

  public static initializeFromSubmission(
    id: string,
    submissionId: string,
    title: string,
    editorId: string // The actor enforcing the transition
  ): Manuscript {
    const initialCustody = {
      actor: editorId,
      timestamp: new Date(),
      command: 'ExecuteDeskReviewCommand',
      previousState: null,
      newState: ManuscriptStatus.IN_REVIEW,
      reference: 'Desk Review Approval'
    };

    return new Manuscript(
      id,
      submissionId,
      title,
      1,
      ManuscriptStatus.IN_REVIEW,
      null,
      [initialCustody]
    );
  }

  /**
   * Internal helper to enforce ADR-011: Chain of Custody
   */
  private appendCustodyRecord(actor: string, command: string, newState: ManuscriptStatus, reference: string) {
    this.chainOfCustody.push({
      actor,
      timestamp: new Date(),
      command,
      previousState: this.status,
      newState,
      reference
    });
    this.status = newState;
  }

  public registerDOI(doi: string, actor: string): void {
    if (this.doi) {
      throw new Error("DOI is already registered. Immutability enforced.");
    }
    this.doi = doi;
    this.appendCustodyRecord(actor, 'RegisterDOICommand', this.status, doi);
  }

  public publish(actor: string): void {
    if (this.status !== ManuscriptStatus.ACCEPTED) {
      throw new Error("Only ACCEPTED manuscripts can be published.");
    }
    if (!this.doi) {
      throw new Error("DOI must be registered prior to publication.");
    }
    this.appendCustodyRecord(actor, 'PublishIssueCommand', ManuscriptStatus.PUBLISHED, 'Issue Publication');
  }

  public retract(actor: string, decisionId: string): void {
    if (this.status !== ManuscriptStatus.PUBLISHED) {
      throw new Error("Only PUBLISHED manuscripts can be retracted.");
    }
    // "Manuscript Never Dies" - Status changes, aggregate remains
    this.appendCustodyRecord(actor, 'RequestRetractionCommand', ManuscriptStatus.RETRACTED, decisionId);
  }
}
