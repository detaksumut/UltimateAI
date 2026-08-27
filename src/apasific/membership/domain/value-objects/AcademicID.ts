export class AcademicID {
  constructor(public readonly value: string) {
    if (!value.startsWith('APA-ID-')) {
      throw new Error('Invalid AcademicID format. Must start with APA-ID-');
    }
  }
}
