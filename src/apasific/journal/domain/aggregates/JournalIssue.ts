export enum PublicationStatus {
  PLANNED = 'PLANNED',
  IN_PRODUCTION = 'IN_PRODUCTION',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED'
}

/**
 * JournalIssue Aggregate Root
 * A Publication Aggregate managing the lifecycle of an entire issue.
 */
export class JournalIssue {
  private constructor(
    public readonly id: string,
    public readonly volume: number,
    public readonly issueNumber: number,
    public readonly year: number,
    public status: PublicationStatus,
    public publicationDate: Date | null,
    public readonly publishedManuscriptIds: string[]
  ) {}

  public static planIssue(
    id: string,
    volume: number,
    issueNumber: number,
    year: number
  ): JournalIssue {
    return new JournalIssue(
      id,
      volume,
      issueNumber,
      year,
      PublicationStatus.PLANNED,
      null,
      []
    );
  }

  public assignManuscript(manuscriptId: string): void {
    if (this.status === PublicationStatus.PUBLISHED || this.status === PublicationStatus.ARCHIVED) {
      throw new Error("Cannot assign manuscripts to an issue that has already been published.");
    }
    if (!this.publishedManuscriptIds.includes(manuscriptId)) {
      this.publishedManuscriptIds.push(manuscriptId);
    }
  }

  public beginProduction(): void {
    if (this.status !== PublicationStatus.PLANNED) {
      throw new Error("Invalid state transition to IN_PRODUCTION.");
    }
    if (this.publishedManuscriptIds.length === 0) {
      throw new Error("Cannot begin production on an empty issue.");
    }
    this.status = PublicationStatus.IN_PRODUCTION;
  }

  public publish(): void {
    if (this.status !== PublicationStatus.IN_PRODUCTION) {
      throw new Error("Only issues IN_PRODUCTION can be published.");
    }
    this.status = PublicationStatus.PUBLISHED;
    this.publicationDate = new Date();
  }
}
