import { ReviewerReference, BlindReviewMode } from '../value-objects/ReviewerReference';
import { createHash } from 'crypto';

export enum ReviewRecommendation {
  ACCEPT = 'ACCEPT',
  MINOR_REVISION = 'MINOR_REVISION',
  MAJOR_REVISION = 'MAJOR_REVISION',
  REJECT = 'REJECT'
}

/**
 * Review Aggregate Root
 * An immutable Scientific Record representing a submitted peer review.
 */
export class Review {
  public readonly hash: string;

  private constructor(
    public readonly id: string,
    public readonly assignmentId: string,
    public readonly manuscriptId: string,
    public readonly roundNumber: number,
    public readonly recommendation: ReviewRecommendation,
    public readonly publicComments: string,
    public readonly confidentialNotes: string,
    private readonly reviewer: ReviewerReference,
    private readonly blindMode: BlindReviewMode,
    public readonly submittedAt: Date
  ) {
    // Generate an anti-tamper hash upon instantiation
    this.hash = this.generateHash();
  }

  public static submit(
    id: string,
    assignmentId: string,
    manuscriptId: string,
    roundNumber: number,
    recommendation: ReviewRecommendation,
    publicComments: string,
    confidentialNotes: string,
    reviewer: ReviewerReference,
    blindMode: BlindReviewMode
  ): Review {
    return new Review(
      id,
      assignmentId,
      manuscriptId,
      roundNumber,
      recommendation,
      publicComments,
      confidentialNotes,
      reviewer,
      blindMode,
      new Date()
    );
  }

  /**
   * Domain Invariant: Blind Review Enforcement
   * Mathematically masks the reviewer identity based on the Blind Mode before allowing any external component to read it.
   */
  public getMaskedReviewerReference(requesterRole: 'AUTHOR' | 'EDITOR'): ReviewerReference | null {
    if (requesterRole === 'EDITOR') {
      return this.reviewer; // Editor always sees identity
    }
    
    if (requesterRole === 'AUTHOR') {
      if (this.blindMode === BlindReviewMode.DOUBLE || this.blindMode === BlindReviewMode.SINGLE) {
        return null; // Identity is strictly masked
      }
      return this.reviewer; // OPEN mode
    }
    
    return null;
  }

  /**
   * Generates a cryptographic hash of the scientific record to prove immutability.
   */
  private generateHash(): string {
    const payload = `${this.id}|${this.assignmentId}|${this.roundNumber}|${this.recommendation}|${this.publicComments}|${this.submittedAt.toISOString()}`;
    return createHash('sha256').update(payload).digest('hex');
  }

  // NOTE: No edit() or update() methods exist. This aggregate is mathematically immutable.
}
