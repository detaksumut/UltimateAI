export class MemberID {
  constructor(public readonly value: string) {
    if (!value.startsWith('APA-')) {
      throw new Error('Invalid MemberID format. Must start with APA-');
    }
  }
}
