import { CertificationManifest, SuiteResult, ICertificationSuite, ResourceSnapshot } from "./CertificationContracts";
import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "url";
import { ArtifactRepository } from "../../../production/artifact/repository/ArtifactRepository";
import { LocalFileArtifactStore } from "../../../production/artifact/store/LocalFileArtifactStore";
import { RuntimeEventBusImpl } from "../../../production/runtime/events/RuntimeEventBus";
import { ArtifactStatus } from "../../../production/artifact/contracts/IArtifact";
import * as crypto from "crypto";

export class CertificationRunner {
  private suites: ICertificationSuite[] = [];

  constructor(
    private readonly milestone: string,
    private readonly seed: string
  ) {}

  async discover(manifestPath: string, testDir: string): Promise<void> {
    console.log(`[CertificationRunner] Discovering suites for milestone ${this.milestone}...`);
    const manifestRaw = fs.readFileSync(manifestPath, "utf-8");
    const manifest: CertificationManifest = JSON.parse(manifestRaw);

    for (const testName of manifest.tests) {
      const modulePath = path.join(testDir, testName + ".ts");
      const moduleUrl = pathToFileURL(modulePath).toString();
      try {
        const module = await import(moduleUrl);
        if (module.default) {
          this.suites.push(new module.default());
        }
      } catch (err) {
        console.error(`[CertificationRunner] Failed to load suite ${testName}:`, err);
        throw err;
      }
    }
    console.log(`[CertificationRunner] Discovered ${this.suites.length} suites.`);
  }

  async executeAll(reportDir: string): Promise<void> {
    console.log(`[CertificationRunner] Starting execution with seed: ${this.seed}\n`);
    
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const overallResults: SuiteResult[] = [];
    let allPassed = true;
    let totalDuration = 0;

    for (const suite of this.suites) {
      console.log(`=========================================`);
      console.log(`[Running Suite] ${suite.name}`);
      console.log(`=========================================`);
      
      const beforeSnapshot = this.captureSnapshot();
      
      const timeoutPromise = new Promise<SuiteResult>((resolve) => {
        setTimeout(() => {
          resolve({
            suite: suite.name,
            status: "TIMEOUT",
            durationMs: suite.timeoutMs,
            metrics: {},
            evidence: ["Suite exceeded maxDuration"],
            error: `Timeout after ${suite.timeoutMs}ms`
          });
        }, suite.timeoutMs);
      });

      const start = Date.now();
      let result: SuiteResult;
      
      try {
        result = await Promise.race([
          suite.execute(this.seed),
          timeoutPromise
        ]);
      } catch (e: any) {
        result = {
          suite: suite.name,
          status: "FAIL",
          durationMs: Date.now() - start,
          metrics: {},
          evidence: ["Unhandled exception"],
          error: e.stack || e.message
        };
      }
      
      const afterSnapshot = this.captureSnapshot();
      this.validateResourceLeaks(result, beforeSnapshot, afterSnapshot);

      overallResults.push(result);
      totalDuration += result.durationMs;

      // Export individual artifact
      const artifactPath = path.join(reportDir, `${suite.name}.json`);
      fs.writeFileSync(artifactPath, JSON.stringify(result, null, 2));

      console.log(`[Result] ${suite.name} -> ${result.status} (${result.durationMs}ms)\n`);

      if (result.status !== "PASS") {
        allPassed = false;
        console.error(`[Failure Details] ${result.error}`);
        break; // Stop execution on first failure
      }
    }

    this.summarize(overallResults, allPassed, totalDuration, reportDir);
    
    // Save to ArtifactRepository
    try {
      const eventBus = new RuntimeEventBusImpl();
      const store = new LocalFileArtifactStore();
      const artifactRepo = new ArtifactRepository(store, eventBus);
      
      const payloadString = JSON.stringify(overallResults);
      const contentHash = crypto.createHash("sha256").update(payloadString).digest("hex");
      
      const reportArtifact = {
        identity: {
          id: `cert-report-milestone-${this.milestone}`,
          type: "CERTIFICATION_REPORT" as any,
          version: 1,
          timestamp: Date.now(),
          contentHash
        },
        status: ArtifactStatus.FINAL,
        trace: {
          traceId: `cert-trace-${this.seed}-${Date.now()}`
        },
        lineage: {
          parentIds: [],
          derivedArtifactIds: []
        },
        provenance: {
          creatorCapability: "CERTIFICATION_RUNNER"
        },
        metadata: {
          createdAt: Date.now(),
          updatedAt: Date.now(),
          labels: ["certification", `milestone-${this.milestone}`],
          tags: { milestone: this.milestone, seed: this.seed, status: allPassed ? "PASS" : "FAIL" },
          custom: {}
        },
        payload: overallResults
      };
      
      await artifactRepo.save(reportArtifact);
      console.log(`[CertificationRunner] Saved certification report to Artifact Repository as: cert-report-milestone-${this.milestone}`);
    } catch (e: any) {
      console.error(`[CertificationRunner] Failed to save certification report to Artifact Repository:`, e.message);
    }
    
    if (!allPassed) {
      process.exit(1);
    }
  }

  private captureSnapshot(): ResourceSnapshot {
    // In a real system, this would query the DB, MemoryStore, and Scheduler registries
    return {
      runningTasks: 0, // Mocked for now, suites will provide real metrics
      queuedTasks: 0,
      memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      totalArtifacts: 0,
      totalKnowledgeNodes: 0
    };
  }

  private validateResourceLeaks(result: SuiteResult, before: ResourceSnapshot, after: ResourceSnapshot) {
    if (result.status !== "PASS") return;
    
    if (after.runningTasks > 0) {
      result.status = "FAIL";
      result.error = `Resource Leak: ${after.runningTasks} running tasks remain after suite completion.`;
    }
  }

  private summarize(results: SuiteResult[], allPassed: boolean, totalDuration: number, reportDir: string) {
    console.log(`\n=========================================`);
    console.log(`Milestone ${this.milestone} SUMMARY`);
    console.log(`=========================================`);
    
    for (const r of results) {
      console.log(`${r.suite.padEnd(30)} ${r.status}`);
    }
    
    console.log(`=========================================`);
    console.log(`Overall Status: ${allPassed ? "PASS" : "FAIL"}`);
    console.log(`Total Duration: ${totalDuration}ms`);
    console.log(`Reports saved to: ${reportDir}`);
  }
}
