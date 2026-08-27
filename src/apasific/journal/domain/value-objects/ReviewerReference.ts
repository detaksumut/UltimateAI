export class ReviewerReference {
  constructor(
    public readonly memberId: string,
    public readonly academicId: string
  ) {
    if (!memberId || !academicId) {
      throw new Error("ReviewerReference requires both MemberID and AcademicID");
    }
  }
}

export enum BlindReviewMode {
  SINGLE = 'SINGLE',
  DOUBLE = 'DOUBLE',
  OPEN = 'OPEN'
}
