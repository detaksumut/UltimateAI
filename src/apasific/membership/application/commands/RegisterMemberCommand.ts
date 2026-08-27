/**
 * RegisterMemberCommand
 * Pure DTO representing the intent to register a new member.
 */
export class RegisterMemberCommand {
  constructor(
    public readonly memberIdStr: string,
    public readonly emailStr: string
  ) {}
}
