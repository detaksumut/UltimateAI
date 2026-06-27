export interface IIdGenerator {
  /**
   * Return a new unique identifier string.
   */
  generate(): string;
}
