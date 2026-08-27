import { RequirementInterpreter } from "./RequirementInterpreter";
import { BlueprintPlanner } from "./BlueprintPlanner";
import { PolicyEngine } from "./PolicyEngine";
import { KnowledgeBase } from "./KnowledgeBase";
import { DecisionEngine } from "./DecisionEngine";
import { SolutionArchitect } from "./SolutionArchitect";
import { DagGeneratorPlanner } from "./DagGeneratorPlanner";
import { GeneratorRegistry } from "./GeneratorRegistry";

async function runSprintE4Validation() {
  console.log("==================================================================");
  console.log("   ULTIMATEAI GENERATION ENGINE - SPRINT E4 VALIDATION (USGEC)   ");
  console.log("==================================================================\n");

  const results: { name: string; status: "PASS" | "FAIL"; details: string }[] = [];
  const addResult = (name: string, status: "PASS" | "FAIL", details: string) => {
    results.push({ name, status, details });
    console.log(`[${status}] ${name} - ${details}`);
  };

  // Setup full pipeline
  const interpreter = new RequirementInterpreter();
  const planner = new BlueprintPlanner();
  const decisionEngine = new DecisionEngine(new PolicyEngine(), new KnowledgeBase());
  const architect = new SolutionArchitect();
  const dagPlanner = new DagGeneratorPlanner();
  const registry = new GeneratorRegistry();

  const query = "Bangunkan sistem OJS nasional dengan reviewer, DOI, ORCID, Crossref, dashboard editor, dashboard reviewer, Docker deployment.";
  const reqModel = interpreter.interpret(query);
  const blueprint = planner.plan(reqModel);
  const strategy = decisionEngine.decide(reqModel);
  const architecture = architect.design(strategy);
  const dag = dagPlanner.plan(architecture);

  // Test 1: DAG tasks generated for all services
  try {
    const taskCount = dag.tasks.length;
    const serviceCount = architecture.services.length;
    if (taskCount === serviceCount) {
      addResult("DAG Task Generation", "PASS", `Observed: ${taskCount} DAG tasks generated for ${serviceCount} services`);
    } else {
      addResult("DAG Task Generation", "FAIL", `Tasks: ${taskCount} vs Services: ${serviceCount}`);
    }
  } catch (err: any) {
    addResult("DAG Task Generation", "FAIL", err.message);
  }

  // Test 2: Topological execution order (DB must precede Backend)
  try {
    let dbLevel = -1, backendLevel = -1;
    dag.executionOrder.forEach((level, idx) => {
      level.forEach(task => {
        if (task.targetServiceId === "svc-db") dbLevel = idx;
        if (task.targetServiceId === "svc-backend") backendLevel = idx;
      });
    });
    if (dbLevel < backendLevel) {
      addResult("DAG Topological Ordering", "PASS", `Observed: DB at level [${dbLevel}] precedes Backend at level [${backendLevel}]`);
    } else {
      addResult("DAG Topological Ordering", "FAIL", `DB[${dbLevel}] should be before Backend[${backendLevel}]`);
    }
  } catch (err: any) {
    addResult("DAG Topological Ordering", "FAIL", err.message);
  }

  // Test 3: Generator Registry has all built-in generators
  try {
    const generators = registry.listAll();
    const required = ["GEN-NEST", "GEN-REACT", "GEN-POSTGRES", "GEN-REDIS", "GEN-KAFKA"];
    const allPresent = required.every(g => generators.includes(g));
    if (allPresent) {
      addResult("Generator Registry (Built-in)", "PASS", `Observed: All ${required.length} built-in generators registered (${generators.join(", ")})`);
    } else {
      addResult("Generator Registry (Built-in)", "FAIL", `Missing generators. Found: ${generators.join(", ")}`);
    }
  } catch (err: any) {
    addResult("Generator Registry (Built-in)", "FAIL", err.message);
  }

  // Test 4: Registry executes generation task and returns artifact
  try {
    const backendTask = dag.tasks.find(t => t.targetServiceId === "svc-backend");
    if (!backendTask) throw new Error("No backend task found in DAG");
    const artifact = registry.execute(backendTask);
    if (artifact.content.length > 0 && artifact.generatorId === "GEN-NEST") {
      addResult("Generator Registry (Execution)", "PASS", `Observed: NestJS artifact generated for backend task (${artifact.outputType})`);
    } else {
      addResult("Generator Registry (Execution)", "FAIL", `Unexpected artifact: ${JSON.stringify({ type: artifact.outputType, gen: artifact.generatorId })}`);
    }
  } catch (err: any) {
    addResult("Generator Registry (Execution)", "FAIL", err.message);
  }

  // Test 5: Execute full DAG (all tasks)
  try {
    const artifacts = dag.tasks.map(task => registry.execute(task));
    if (artifacts.length === dag.tasks.length && artifacts.every(a => a.content.length > 0)) {
      addResult("Full DAG Execution", "PASS", `Observed: All ${artifacts.length} tasks executed, artifacts generated successfully`);
    } else {
      addResult("Full DAG Execution", "FAIL", `Failed to execute all DAG tasks`);
    }
  } catch (err: any) {
    addResult("Full DAG Execution", "FAIL", err.message);
  }

  // Test 6: Full E1 → E4 Pipeline
  try {
    if (blueprint.blueprintHash && strategy.pattern && architecture.architectureHash && dag.tasks.length > 0) {
      addResult("Full Pipeline E1 → E4", "PASS", "Observed: Language → Blueprint → Strategy → Architecture → DAG pipeline complete");
    } else {
      addResult("Full Pipeline E1 → E4", "FAIL", "Pipeline incomplete");
    }
  } catch (err: any) {
    addResult("Full Pipeline E1 → E4", "FAIL", err.message);
  }

  console.log("\n==================================================================");
  console.log("                       VALIDATION SUMMARY                         ");
  console.log("==================================================================\n");

  const allPassed = results.every(r => r.status === "PASS");
  if (allPassed) {
    console.log(">>> STATUS: SPRINT E4 VALIDATED (100% SUCCESS) <<<\n");
    console.log("--------------------------------------------------");
    console.log("          USGEC SPRINT E4 CERTIFICATE GENERATED  ");
    console.log("--------------------------------------------------");
    console.log("Certificate ID: UAI-USGEC-E4-9942");
    console.log("Status: VALIDATED");
    console.log("Scope: DAG Generator Planner & Generator Registry");
    console.log("Platform Baseline: UAI-FB-1.0");
    console.log("--------------------------------------------------\n");
  } else {
    const failed = results.filter(r => r.status === "FAIL");
    console.log(">>> STATUS: VALIDATION FAILED <<<");
    failed.forEach(f => console.log(`  - ${f.name}: ${f.details}`));
  }
}

runSprintE4Validation().catch(console.error);
