import { RequirementInterpreter } from "./RequirementInterpreter";
import { BlueprintPlanner } from "./BlueprintPlanner";
import { PolicyEngine } from "./PolicyEngine";
import { KnowledgeBase } from "./KnowledgeBase";
import { DecisionEngine } from "./DecisionEngine";
import { SolutionArchitect } from "./SolutionArchitect";
import { DagGeneratorPlanner } from "./DagGeneratorPlanner";
import { GeneratorRegistry, ArtifactResult } from "./GeneratorRegistry";
import { ArtifactComposer } from "./ArtifactComposer";
import { CertificationLayer } from "./CertificationLayer";

async function runSprintE5Validation() {
  console.log("==================================================================");
  console.log("   ULTIMATEAI GENERATION ENGINE - SPRINT E5 VALIDATION (USGEC)   ");
  console.log("==================================================================\n");

  const results: { name: string; status: "PASS" | "FAIL"; details: string }[] = [];
  const addResult = (name: string, status: "PASS" | "FAIL", details: string) => {
    results.push({ name, status, details });
    console.log(`[${status}] ${name} - ${details}`);
  };

  // Full pipeline setup
  const interpreter = new RequirementInterpreter();
  const planner = new BlueprintPlanner();
  const decisionEngine = new DecisionEngine(new PolicyEngine(), new KnowledgeBase());
  const architect = new SolutionArchitect();
  const dagPlanner = new DagGeneratorPlanner();
  const registry = new GeneratorRegistry();
  const composer = new ArtifactComposer();
  const certifier = new CertificationLayer();

  const query = "Bangunkan sistem OJS nasional dengan reviewer, DOI, ORCID, Crossref, dashboard editor, dashboard reviewer, Docker deployment.";
  const reqModel = interpreter.interpret(query);
  const blueprint = planner.plan(reqModel);
  const strategy = decisionEngine.decide(reqModel);
  const architecture = architect.design(strategy);
  const dag = dagPlanner.plan(architecture);
  const rawArtifacts: ArtifactResult[] = dag.tasks.map(task => registry.execute(task));

  // Test 1: Artifact Composer – composition
  try {
    const composition = composer.compose(rawArtifacts);
    if (composition.compositionHash.length === 64 && composition.totalArtifacts === rawArtifacts.length) {
      addResult("Artifact Composer (Composition)", "PASS", `Observed: ${composition.totalArtifacts} artifacts composed, hash=${composition.compositionHash.substring(0, 12)}...`);
    } else {
      addResult("Artifact Composer (Composition)", "FAIL", `hash.length=${composition.compositionHash.length} total=${composition.totalArtifacts}`);
    }
  } catch (err: any) {
    addResult("Artifact Composer (Composition)", "FAIL", err.message);
  }

  // Test 2: Auto-repair triggers on empty content
  try {
    const brokenArtifact: ArtifactResult = {
      artifactId: "art-broken",
      taskId: "task-broken",
      generatorId: "GEN-TEST",
      outputType: "test/broken",
      content: "",
      metadata: {}
    };
    const composition = composer.compose([brokenArtifact]);
    const repaired = composition.artifacts[0];
    if (repaired.content.length > 0 && composition.repairLog.length > 0) {
      addResult("Artifact Composer (Auto-Repair)", "PASS", `Observed: Empty content auto-repaired. Repair log: "${composition.repairLog[0]}"`);
    } else {
      addResult("Artifact Composer (Auto-Repair)", "FAIL", "Auto-repair did not trigger");
    }
  } catch (err: any) {
    addResult("Artifact Composer (Auto-Repair)", "FAIL", err.message);
  }

  // Test 3: Certification Layer – valid composition
  try {
    const composition = composer.compose(rawArtifacts);
    const certificate = certifier.certify(composition);
    if (certificate.status === "CERTIFIED" && certificate.certificateId.startsWith("UAI-USGEC-CERT-")) {
      addResult("Certification Layer (Valid Composition)", "PASS", `Observed: Certificate issued — ID:${certificate.certificateId} Status:${certificate.status}`);
    } else {
      addResult("Certification Layer (Valid Composition)", "FAIL", `Status:${certificate.status} Findings:${JSON.stringify(certificate.findings)}`);
    }
  } catch (err: any) {
    addResult("Certification Layer (Valid Composition)", "FAIL", err.message);
  }

  // Test 4: Certification Layer – rejects invalid composition
  try {
    const badComposition = {
      compositionId: "bad",
      compositionHash: "short-hash",  // too short, gate should fail
      artifacts: [],
      repairLog: [],
      totalArtifacts: 3, // mismatch with empty artifacts
      composedAt: new Date().toISOString()
    };
    const certificate = certifier.certify(badComposition);
    if (certificate.status === "REJECTED") {
      addResult("Certification Layer (Rejection)", "PASS", `Observed: Malformed composition correctly REJECTED — Findings: ${certificate.findings.filter(f => f.startsWith("GATE")).join("; ")}`);
    } else {
      addResult("Certification Layer (Rejection)", "FAIL", "Expected REJECTED but got CERTIFIED");
    }
  } catch (err: any) {
    addResult("Certification Layer (Rejection)", "FAIL", err.message);
  }

  // Test 5: Full E1 → E5 Pipeline
  try {
    const composition = composer.compose(rawArtifacts);
    const certificate = certifier.certify(composition);
    if (
      blueprint.blueprintHash &&
      strategy.pattern &&
      architecture.architectureHash &&
      dag.tasks.length > 0 &&
      composition.compositionHash &&
      certificate.status === "CERTIFIED"
    ) {
      addResult("Full Pipeline E1 → E5", "PASS", "Observed: Language → Blueprint → Strategy → Architecture → DAG → Composition → Certificate pipeline complete");
    } else {
      addResult("Full Pipeline E1 → E5", "FAIL", "Pipeline incomplete");
    }
  } catch (err: any) {
    addResult("Full Pipeline E1 → E5", "FAIL", err.message);
  }

  console.log("\n==================================================================");
  console.log("                       VALIDATION SUMMARY                         ");
  console.log("==================================================================\n");

  const allPassed = results.every(r => r.status === "PASS");
  if (allPassed) {
    console.log(">>> STATUS: SPRINT E5 VALIDATED (100% SUCCESS) <<<\n");
    console.log("--------------------------------------------------");
    console.log("          USGEC SPRINT E5 CERTIFICATE GENERATED  ");
    console.log("--------------------------------------------------");
    console.log("Certificate ID: UAI-USGEC-E5-5513");
    console.log("Status: VALIDATED");
    console.log("Scope: Artifact Composer & Certification Layer");
    console.log("Platform Baseline: UAI-FB-1.0");
    console.log("--------------------------------------------------\n");
  } else {
    const failed = results.filter(r => r.status === "FAIL");
    console.log(">>> STATUS: VALIDATION FAILED <<<");
    failed.forEach(f => console.log(`  - ${f.name}: ${f.details}`));
  }
}

runSprintE5Validation().catch(console.error);
