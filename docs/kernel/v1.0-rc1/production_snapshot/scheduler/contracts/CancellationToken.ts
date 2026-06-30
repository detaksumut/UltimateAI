export class CancellationToken {
  private isCancelled: boolean = false;
  private reason?: string;
  private listeners: ((reason?: string) => void)[] = [];

  cancel(reason?: string) {
    if (this.isCancelled) return;
    this.isCancelled = true;
    this.reason = reason;
    for (const listener of this.listeners) {
      listener(reason);
    }
  }

  get isCancellationRequested(): boolean {
    return this.isCancelled;
  }

  get cancellationReason(): string | undefined {
    return this.reason;
  }

  onCancel(listener: (reason?: string) => void) {
    if (this.isCancelled) {
      listener(this.reason);
    } else {
      this.listeners.push(listener);
    }
  }

  throwIfCancelled() {
    if (this.isCancelled) {
      throw new Error(`Execution cancelled: ${this.reason || "No reason provided"}`);
    }
  }
}
