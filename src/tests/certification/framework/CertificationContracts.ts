export interface ResourceSnapshot {
  runningTasks: number;
  queuedTasks: number;
  memoryUsageMB: number;
  totalArtifacts: number;
  totalKnowledgeNodes: number;
}

export interface SuiteResult {
  suite: string;
  status: "PASS" | "FAIL" | "TIMEOUT";
  durationMs: number;
  metrics: Record<string, any>;
  evidence: any[];
  error?: string;
}

export interface CertificationManifest {
  milestone: string;
  description: string;
  tests: string[];
}

export interface ICertificationSuite {
  readonly name: string;
  readonly timeoutMs: number;
  execute(seed: string): Promise<SuiteResult>;
}
