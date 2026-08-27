export class AuthorReference {
  constructor(
    public readonly memberId: string,
    public readonly academicId: string
  ) {
    if (!memberId || !academicId) {
      throw new Error("AuthorReference requires both MemberID and AcademicID");
    }
  }
}

export enum SubmissionStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  WITHDRAWN = 'WITHDRAWN',
  REJECTED_DESK = 'REJECTED_DESK',
  IN_PEER_REVIEW = 'IN_PEER_REVIEW'
}

/**
 * Submission Aggregate Root
 * Handles the administrative lifecycle before a document becomes a formal Manuscript.
 */
export class Submission {
  private constructor(
    public readonly id: string,
    public readonly author: AuthorReference,
    public readonly submittedAt: Date,
    public status: SubmissionStatus,
    public readonly files: string[],
    public readonly coverLetter: string
  ) {}

  public static submit(
    id: string,
    author: AuthorReference,
    files: string[],
    coverLetter: string
  ): Submission {
    if (files.length === 0) {
      throw new Error("Submission must include at least one file.");
    }
    return new Submission(
      id,
      author,
      new Date(),
      SubmissionStatus.SUBMITTED,
      files,
      coverLetter
    );
  }

  public withdraw(): void {
    if (this.status !== SubmissionStatus.SUBMITTED) {
      throw new Error("Only submitted manuscripts can be withdrawn prior to desk review.");
    }
    this.status = SubmissionStatus.WITHDRAWN;
  }

  public markAsInReview(): void {
    if (this.status !== SubmissionStatus.SUBMITTED) {
      throw new Error("Invalid state transition to IN_PEER_REVIEW.");
    }
    this.status = SubmissionStatus.IN_PEER_REVIEW;
  }
}
