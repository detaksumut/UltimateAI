export class GetEditorAuditTrailQuery {
  constructor(
    public readonly manuscriptId: string,
    public readonly requesterRoles: string[]
  ) {}
}

/**
 * Note: Query Models do NOT mutate state and bypass Repositories to read directly from Read Models.
 */
export class GetEditorAuditTrailQueryHandler {
  constructor(private readonly readDatabaseConnection: any) {}

  public async query(query: GetEditorAuditTrailQuery): Promise<any> {
    if (!query.requesterRoles.includes('EDITOR') && !query.requesterRoles.includes('CHIEF_EDITOR')) {
      throw new Error("UNAUTHORIZED: Only Editors can view the internal Audit Trail.");
    }

    // Direct Read Model projection query (e.g. executing a raw SQL or optimized NoSQL fetch)
    const auditTrail = await this.readDatabaseConnection.query(
      `SELECT * FROM read_model_audit_trail WHERE manuscript_id = ? ORDER BY timestamp ASC`,
      [query.manuscriptId]
    );

    return auditTrail;
  }
}
