import { StudioFacade } from "../../studio/StudioFacade";
import { StudioHealthCheck } from "../../studio/StudioHealthCheck";
import { CliFormatter } from "./CliFormatter";

/**
 * CLI Exit Codes (ADR-009 documented):
 *   0 — Success
 *   1 — Validation error (missing argument, bad format)
 *   2 — Generation failed / FAILED status
 *   3 — Cancelled
 *   4 — Timeout / resource budget exceeded
 *   5 — Internal / unexpected error
 */
export const EXIT_CODES = {
  SUCCESS:    0,
  VALIDATION: 1,
  FAILED:     2,
  CANCELLED:  3,
  TIMEOUT:    4,
  INTERNAL:   5
} as const;

/**
 * UltimateCLI — Command-line delivery channel for UltimateAI Studio.
 *
 * ADR-009: All commands use StudioFacade exclusively.
 *
 * Usage:
 *   npx tsx UltimateCLI.ts generate "<requirement>"
 *   npx tsx UltimateCLI.ts preview  "<requirement>"
 *   npx tsx UltimateCLI.ts status   <requestId>
 *   npx tsx UltimateCLI.ts cancel   <requestId>
 *   npx tsx UltimateCLI.ts metrics
 *   npx tsx UltimateCLI.ts health
 *   npx tsx UltimateCLI.ts capabilities
 *   npx tsx UltimateCLI.ts export   <requestId> <format>
 *   npx tsx UltimateCLI.ts replay   <requestId> <asOf>
 *   npx tsx UltimateCLI.ts help
 */
export class UltimateCLI {
  private readonly studio: StudioFacade;
  private readonly health: StudioHealthCheck;

  constructor() {
    this.studio = new StudioFacade();
    this.health = new StudioHealthCheck();
  }

  async run(argv: string[]): Promise<number> {
    const [command, ...args] = argv;

    try {
      switch (command) {
        case "generate": return await this.cmdGenerate(args);
        case "preview":  return await this.cmdPreview(args);
        case "status":   return await this.cmdStatus(args);
        case "cancel":   return await this.cmdCancel(args);
        case "metrics":  return await this.cmdMetrics();
        case "health":   return await this.cmdHealth();
        case "capabilities": return await this.cmdCapabilities();
        case "export":   return await this.cmdExport(args);
        case "replay":   return await this.cmdReplay(args);
        case "help":
        case undefined:  this.cmdHelp(); return EXIT_CODES.SUCCESS;
        default:
          CliFormatter.error(`Unknown command: '${command}'. Run 'help' for usage.`);
          return EXIT_CODES.VALIDATION;
      }
    } catch (err: any) {
      CliFormatter.error(`Unexpected error: ${err.message}`);
      return EXIT_CODES.INTERNAL;
    }
  }

  // ─── Commands ──────────────────────────────────────────────────────────────

  private async cmdGenerate(args: string[]): Promise<number> {
    const nl = args[0];
    if (!nl) {
      CliFormatter.error("Usage: generate \"<requirement>\"");
      return EXIT_CODES.VALIDATION;
    }

    CliFormatter.header("UltimateAI — Generate");
    CliFormatter.info(`Requirement: ${nl}`);
    const stop = CliFormatter.spinner("Running pipeline…");

    const result = await this.studio.submit({ naturalLanguage: nl });
    stop();

    console.log(`\n  Status     ${CliFormatter.badge(result.status)}`);
    CliFormatter.kv("Request ID",    result.requestId);
    CliFormatter.kv("Certificate",   result.certificateId ?? "—");
    CliFormatter.kv("Artifacts",     result.artifactCount);
    CliFormatter.kv("Repairs",       result.repairCount);
    CliFormatter.kv("Duration",      `${result.trace.totalDurationMs}ms`);
    CliFormatter.kv("Cached",        result.cached ? "yes (idempotency)" : "no");

    if (result.explanation?.pattern) {
      CliFormatter.separator();
      CliFormatter.info("Decision Explanation");
      CliFormatter.kv("Pattern",   result.explanation.pattern.selected);
      CliFormatter.kv("Database",  result.explanation.database.selected);
      CliFormatter.kv("Deployment",result.explanation.deployment.selected);
      result.explanation.pattern.reasons.forEach(r =>
        CliFormatter.kv(`  [${r.source}]`, r.detail));
    }

    switch (result.status) {
      case "SUCCESS":   CliFormatter.success("Generation complete."); return EXIT_CODES.SUCCESS;
      case "FAILED":    CliFormatter.error("Generation failed.");     return EXIT_CODES.FAILED;
      case "CANCELLED": CliFormatter.warn("Generation cancelled.");   return EXIT_CODES.CANCELLED;
      default:          return EXIT_CODES.FAILED;
    }
  }

  private async cmdPreview(args: string[]): Promise<number> {
    const nl = args[0];
    if (!nl) { CliFormatter.error("Usage: preview \"<requirement>\""); return EXIT_CODES.VALIDATION; }

    CliFormatter.header("UltimateAI — Preview");
    const stop = CliFormatter.spinner("Analyzing requirement…");
    const preview = await this.studio.preview({ naturalLanguage: nl });
    stop();

    CliFormatter.kv("Pattern",  preview.explanation.pattern.selected);
    CliFormatter.kv("Database", preview.explanation.database.selected);
    CliFormatter.kv("Estimated artifacts", preview.estimatedArtifactCount);
    CliFormatter.kv("Services", preview.architecture.services.map(s => s.name).join(", "));
    CliFormatter.kv("Boot order", preview.architecture.deploymentTopology.join(" → "));
    CliFormatter.success("Preview complete (no artifacts generated).");
    return EXIT_CODES.SUCCESS;
  }

  private async cmdStatus(args: string[]): Promise<number> {
    const id = args[0];
    if (!id) { CliFormatter.error("Usage: status <requestId>"); return EXIT_CODES.VALIDATION; }
    const state = this.studio.getStatus(id);
    if (!state) { CliFormatter.error(`Request not found: ${id}`); return EXIT_CODES.VALIDATION; }

    CliFormatter.header("UltimateAI — Status");
    CliFormatter.kv("Request ID", state.requestId);
    console.log(`  Status                 ${CliFormatter.badge(state.status)}`);
    CliFormatter.kv("Attempt", state.attempt);
    CliFormatter.kv("Updated", state.updatedAt);
    if (state.failureReason) CliFormatter.kv("Failure", state.failureReason);
    return EXIT_CODES.SUCCESS;
  }

  private async cmdCancel(args: string[]): Promise<number> {
    const id = args[0];
    if (!id) { CliFormatter.error("Usage: cancel <requestId>"); return EXIT_CODES.VALIDATION; }
    const ok = this.studio.cancel(id);
    ok ? CliFormatter.warn(`Cancelled: ${id}`) : CliFormatter.error(`Could not cancel: ${id}`);
    return EXIT_CODES.SUCCESS;
  }

  private async cmdMetrics(): Promise<number> {
    CliFormatter.header("UltimateAI — Metrics");
    const m = this.studio.getMetrics();
    CliFormatter.table(
      ["Metric", "Value"],
      [
        ["Total Requests",   String(m.totalRequests)],
        ["Success",          String(m.successCount)],
        ["Failed",           String(m.failedCount)],
        ["Cancelled",        String(m.cancelledCount)],
        ["Success Rate",     `${(m.successRate * 100).toFixed(1)}%`],
        ["Avg Duration",     `${m.averageDurationMs}ms`],
        ["Total Repairs",    String(m.totalRepairs)],
        ["Retries",          String(m.retryCount)],
        ["Timeouts",         String(m.timeoutCount)]
      ]
    );
    return EXIT_CODES.SUCCESS;
  }

  private async cmdHealth(): Promise<number> {
    CliFormatter.header("UltimateAI — Health");
    const report = this.health.check();
    console.log(`  Overall: ${CliFormatter.badge(report.status)}\n`);
    CliFormatter.table(
      ["Component", "Status", "Detail"],
      report.components.map(c => [c.name, c.status, c.detail ?? ""])
    );
    return report.status === "unhealthy" ? EXIT_CODES.FAILED : EXIT_CODES.SUCCESS;
  }

  private async cmdCapabilities(): Promise<number> {
    CliFormatter.header("UltimateAI — Generator Capability Matrix");
    const matrix = this.studio.getCapabilityMatrix();
    CliFormatter.table(
      ["Generator ID", "Name", "Produces", "Patterns", "Maturity"],
      matrix.map(m => [
        m.generatorId,
        m.displayName,
        m.produces.join(", "),
        m.supportedPatterns.join(", "),
        m.maturity
      ])
    );
    return EXIT_CODES.SUCCESS;
  }

  private async cmdExport(args: string[]): Promise<number> {
    const [requestId, format = "json"] = args;
    if (!requestId) { CliFormatter.error("Usage: export <requestId> <format>"); return EXIT_CODES.VALIDATION; }
    try {
      const bundle = this.studio.export(requestId, format as any);
      console.log(bundle.content);
      CliFormatter.success(`Exported as ${format} (${bundle.content.length} bytes)`);
      return EXIT_CODES.SUCCESS;
    } catch (e: any) {
      CliFormatter.error(e.message);
      return EXIT_CODES.FAILED;
    }
  }

  private async cmdReplay(args: string[]): Promise<number> {
    const [requestId, asOf] = args;
    if (!requestId || !asOf) { CliFormatter.error("Usage: replay <requestId> <asOf>"); return EXIT_CODES.VALIDATION; }
    CliFormatter.header("UltimateAI — Replay");
    CliFormatter.info(`Replaying ${requestId} with policy asOf=${asOf}`);
    const stop = CliFormatter.spinner("Replaying…");
    const result = await this.studio.replay(requestId, asOf);
    stop();
    console.log(`\n  Status  ${CliFormatter.badge(result.status)}`);
    CliFormatter.kv("New Request ID", result.requestId);
    CliFormatter.kv("Certificate",   result.certificateId ?? "—");
    return result.status === "SUCCESS" ? EXIT_CODES.SUCCESS : EXIT_CODES.FAILED;
  }

  private cmdHelp(): void {
    CliFormatter.header("UltimateAI CLI — Help");
    CliFormatter.table(
      ["Command", "Arguments", "Description"],
      [
        ["generate",     "\"<requirement>\"",        "Submit full generation pipeline"],
        ["preview",      "\"<requirement>\"",        "Preview blueprint + architecture only"],
        ["status",       "<requestId>",              "Get request execution status"],
        ["cancel",       "<requestId>",              "Cancel running request"],
        ["metrics",      "",                         "Show aggregated metrics"],
        ["health",       "",                         "Show system health report"],
        ["capabilities", "",                         "Show generator capability matrix"],
        ["export",       "<requestId> <format>",     "Export result (json/yaml/markdown)"],
        ["replay",       "<requestId> <asOf>",       "Replay with historical policy"],
        ["help",         "",                         "Show this help"]
      ]
    );
    CliFormatter.separator();
    CliFormatter.table(
      ["Exit Code", "Meaning"],
      [["0","Success"],["1","Validation error"],["2","Generation failed"],["3","Cancelled"],["4","Timeout"],["5","Internal error"]]
    );
  }
}

// ─── Standalone entry point ───────────────────────────────────────────────────

import { fileURLToPath as _ftu } from "url";
if (process.argv[1] === _ftu(import.meta.url)) {
  const cli = new UltimateCLI();
  cli.run(process.argv.slice(2)).then(code => process.exit(code));
}
