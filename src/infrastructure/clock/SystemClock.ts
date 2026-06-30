import { IClock } from "../../production/contracts/clock/IClock";

/**
 * SystemClock — Infrastructure implementation of IClock.
 *
 * Uses the real system clock. This is the only place in the
 * codebase where Date.now() is called for production time.
 */
export class SystemClock implements IClock {
  now(): number {
    return Date.now();
  }
}
