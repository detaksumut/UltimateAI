import { ReviewerReference, BlindReviewMode } from '../value-objects/ReviewerReference';

export enum AssignmentStatus {
  INVITED = 'INVITED',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  EXPIRED = 'EXPIRED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED'
}

/**
 * ReviewAssignment Aggregate Root
 * Strictly models the lifecycle of a reviewer's employment relationship to a manuscript.
 * Does NOT store the actual review content.
 */
export class ReviewAssignment {
  private constructor(
    public readonly id: string,
    public readonly manuscriptId: string,
    public readonly reviewer: ReviewerReference,
    public readonly blindMode: BlindReviewMode,
    public status: AssignmentStatus,
    public readonly invitedAt: Date,
    public readonly responseDeadline: Date,
    public readonly reviewDeadline: Date
  ) {}

  public static invite(
    id: string,
    manuscriptId: string,
    reviewer: ReviewerReference,
    blindMode: BlindReviewMode,
    responseDeadline: Date,
    reviewDeadline: Date
  ): ReviewAssignment {
    return new ReviewAssignment(
      id,
      manuscriptId,
      reviewer,
      blindMode,
      AssignmentStatus.INVITED,
      new Date(),
      responseDeadline,
      reviewDeadline
    );
  }

  public accept(): void {
    if (this.status !== AssignmentStatus.INVITED) {
      throw new Error("Cannot accept an assignment that is not in INVITED state.");
    }
    this.status = AssignmentStatus.ACCEPTED;
  }

  public decline(): void {
    if (this.status !== AssignmentStatus.INVITED) {
      throw new Error("Cannot decline an assignment that is not in INVITED state.");
    }
    this.status = AssignmentStatus.DECLINED;
  }

  public expire(): void {
    if (this.status !== AssignmentStatus.INVITED) {
      throw new Error("Only INVITED assignments can expire.");
    }
    this.status = AssignmentStatus.EXPIRED;
  }

  public markInProgress(): void {
    if (this.status !== AssignmentStatus.ACCEPTED) {
      throw new Error("Cannot start review without accepting first.");
    }
    this.status = AssignmentStatus.IN_PROGRESS;
  }

  public complete(): void {
    if (this.status !== AssignmentStatus.IN_PROGRESS && this.status !== AssignmentStatus.ACCEPTED) {
      throw new Error("Cannot complete an unstarted review.");
    }
    this.status = AssignmentStatus.COMPLETED;
  }
}
