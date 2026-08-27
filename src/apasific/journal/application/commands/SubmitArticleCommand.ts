export class SubmitArticleCommand {
  constructor(
    public readonly submissionId: string,
    public readonly memberId: string,
    public readonly academicId: string,
    public readonly files: string[],
    public readonly coverLetter: string,
    public readonly requesterRoles: string[],
    public readonly requesterStatus: string
  ) {}
}
