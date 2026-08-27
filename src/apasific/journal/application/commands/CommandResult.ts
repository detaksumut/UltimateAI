/**
 * Standardized Command Result to improve observability without leaking domain logic.
 */
export class CommandResult<T> {
  private constructor(
    public readonly success: boolean,
    public readonly aggregateId: string | null,
    public readonly correlationId: string,
    public readonly traceId: string,
    public readonly version: number,
    public readonly executedAt: Date,
    public readonly error?: string
  ) {}

  public static ok(aggregateId: string, correlationId: string, traceId: string, version: number = 1): CommandResult<void> {
    return new CommandResult(true, aggregateId, correlationId, traceId, version, new Date());
  }

  public static fail(error: string, correlationId: string, traceId: string): CommandResult<void> {
    return new CommandResult(false, null, correlationId, traceId, 0, new Date(), error);
  }
}
