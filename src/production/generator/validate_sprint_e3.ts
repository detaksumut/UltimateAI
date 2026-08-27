import { RequirementInterpreter } from "./RequirementInterpreter";
import { BlueprintPlanner } from "./BlueprintPlanner";
import { PolicyEngine } from "./PolicyEngine";
import { KnowledgeBase } from "./KnowledgeBase";
import { DecisionEngine } from "./DecisionEngine";
import { SolutionArchitect } from "./SolutionArchitect";

async function runSprintE3Validation() {
  console.log("==================================================================");
  console.log("   ULTIMATEAI GENERATION ENGINE - SPRINT E3 VALIDATION (USGEC)   ");
  console.log("==================================================================\n");

  const results: { name: string; status: "PASS" | "FAIL"; details: string }[] = [];
  const addResult = (name: string, status: "PASS" | "FAIL", details: string) => {
    results.push({ name, status, details });
    console.log(`[${status}] ${name} - ${details}`);
  };

  const interpreter = new RequirementInterpreter();
  const planner = new BlueprintPlanner();
  const decisionEngine = new DecisionEngine(new PolicyEngine(), new KnowledgeBase());
  const architect = new SolutionArchitect();

  const query = "Bangunkan sistem OJS nasional dengan reviewer, DOI, ORCID, Crossref, dashboard editor, dashboard reviewer, Docker deployment.";
  const reqModel = interpreter.interpret(query);
  const blueprint = planner.plan(reqModel);
  const strategy = decisionEngine.decide(reqModel);
  const architecture = architect.design(strategy);

  // Test 1: Service Topology
  try {
    const serviceIds = architecture.services.map(s => s.serviceId);
    if (serviceIds.includes("svc-backend") && serviceIds.includes("svc-db") && serviceIds.includes("svc-frontend")) {
      addResult("Service Topology", "PASS", `Observed: ${architecture.services.length} services designed — ${serviceIds.join(", ")}`);
    } else {
      addResult("Service Topology", "FAIL", `Missing core services: ${JSON.stringify(serviceIds)}`);
    }
  } catch (err: any) {
    addResult("Service Topology", "FAIL", err.message);
  }

  // Test 2: Dependency Graph completeness
  try {
    const backendDeps = architecture.dependencyGraph["svc-backend"] ?? [];
    if (backendDeps.includes("svc-db")) {
      addResult("Dependency Graph", "PASS", "Observed: Backend correctly depends on database in dependency graph");
    } else {
      addResult("Dependency Graph", "FAIL", `Backend deps: ${JSON.stringify(backendDeps)}`);
    }
  } catch (err: any) {
    addResult("Dependency Graph", "FAIL", err.message);
  }

  // Test 3: Deployment topology ordering (DB must boot before backend)
  try {
    const dbIndex = architecture.deploymentTopology.indexOf("svc-db");
    const backendIndex = architecture.deploymentTopology.indexOf("svc-backend");
    if (dbIndex < backendIndex) {
      addResult("Deployment Topology Ordering", "PASS", `Observed: Boot sequence correct — DB[${dbIndex}] → Backend[${backendIndex}]`);
    } else {
      addResult("Deployment Topology Ordering", "FAIL", "Database must boot before backend");
    }
  } catch (err: any) {
    addResult("Deployment Topology Ordering", "FAIL", err.message);
  }

  // Test 4: Architecture hash determinism
  try {
    const arch2 = architect.design(strategy);
    if (architecture.architectureHash === arch2.architectureHash) {
      addResult("Architecture Hash Determinism", "PASS", "Observed: Same strategy produces identical architecture hash");
    } else {
      addResult("Architecture Hash Determinism", "FAIL", "Non-deterministic architecture hash");
    }
  } catch (err: any) {
    addResult("Architecture Hash Determinism", "FAIL", err.message);
  }

  // Test 5: Full E1 → E2 → E3 pipeline
  try {
    if (blueprint.blueprintHash && strategy.pattern && architecture.architectureHash) {
      addResult("Full Pipeline E1 → E3", "PASS", "Observed: Language → Blueprint → Strategy → Architecture pipeline complete");
    } else {
      addResult("Full Pipeline E1 → E3", "FAIL", "Pipeline incomplete");
    }
  } catch (err: any) {
    addResult("Full Pipeline E1 → E3", "FAIL", err.message);
  }

  console.log("\n==================================================================");
  console.log("                       VALIDATION SUMMARY                         ");
  console.log("==================================================================\n");

  const allPassed = results.every(r => r.status === "PASS");
  if (allPassed) {
    console.log(">>> STATUS: SPRINT E3 VALIDATED (100% SUCCESS) <<<\n");
    console.log("--------------------------------------------------");
    console.log("          USGEC SPRINT E3 CERTIFICATE GENERATED  ");
    console.log("--------------------------------------------------");
    console.log("Certificate ID: UAI-USGEC-E3-2281");
    console.log("Status: VALIDATED");
    console.log("Scope: Solution Architect Layer");
    console.log("Platform Baseline: UAI-FB-1.0");
    console.log("--------------------------------------------------\n");
  } else {
    const failed = results.filter(r => r.status === "FAIL");
    console.log(">>> STATUS: VALIDATION FAILED <<<");
    failed.forEach(f => console.log(`  - ${f.name}: ${f.details}`));
  }
}

runSprintE3Validation().catch(console.error);
