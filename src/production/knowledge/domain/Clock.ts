export interface Clock {
  /** Returns the current timestamp in milliseconds since epoch */
  now(): number;
}
