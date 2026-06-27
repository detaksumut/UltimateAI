import { ICancellationManager } from '../interfaces';

/** Simple CancellationManager using AbortController */
export class CancellationManager implements ICancellationManager {
  public readonly signal: AbortSignal;
  private controller: AbortController;

  constructor() {
    this.controller = new AbortController();
    this.signal = this.controller.signal;
  }

  abort(): void {
    this.controller.abort();
  }
}
