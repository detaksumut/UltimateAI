import { RequirementInterpreter } from "./RequirementInterpreter";
import { BlueprintPlanner } from "./BlueprintPlanner";
import { PolicyEngine } from "./PolicyEngine";
import { KnowledgeBase } from "./KnowledgeBase";
import { DecisionEngine } from "./DecisionEngine";

async function runSprintE2Validation() {
  console.log("==================================================================");
  console.log("   ULTIMATEAI GENERATION ENGINE - SPRINT E2 VALIDATION (USGEC)   ");
  console.log("==================================================================\n");

  const results: { name: string; status: "PASS" | "FAIL"; details: string }[] = [];
  const addResult = (name: string, status: "PASS" | "FAIL", details: string) => {
    results.push({ name, status, details });
    console.log(`[${status}] ${name} - ${details}`);
  };

  const interpreter = new RequirementInterpreter();
  const planner = new BlueprintPlanner();
  const policyEngine = new PolicyEngine();
  const knowledgeBase = new KnowledgeBase();
  const decisionEngine = new DecisionEngine(policyEngine, knowledgeBase);

  const query = "Bangunkan sistem OJS nasional dengan reviewer, DOI, ORCID, Crossref, dashboard editor, dashboard reviewer, Docker deployment.";
  const reqModel = interpreter.interpret(query);
  const blueprint = planner.plan(reqModel);

  // Test 1: Policy Engine – Enterprise Scale Policy
  try {
    const policyResult = policyEngine.evaluate(reqModel);
    const mandates = policyResult.effectiveMandates;
    if (
      policyResult.matchedPolicies.length > 0 &&
      mandates.database === "postgresql" &&
      mandates.pattern === "microservices" &&
      mandates.docker === true &&
      mandates.rbac === true
    ) {
      addResult("Policy Engine (Enterprise Mandates)", "PASS", "Observed: Enterprise policy matched, PostgreSQL+Microservices+RBAC+Docker mandated");
    } else {
      addResult("Policy Engine (Enterprise Mandates)", "FAIL", `Mandates: ${JSON.stringify(mandates)}`);
    }
  } catch (err: any) {
    addResult("Policy Engine (Enterprise Mandates)", "FAIL", err.message);
  }

  // Test 2: Policy Engine – Policy Isolation (small scale returns different mandates)
  try {
    const smallReq = interpreter.interpret("Bangun jurnal kecil sederhana lokal");
    const smallResult = policyEngine.evaluate(smallReq);
    if (smallResult.effectiveMandates.pattern === "monolith" && smallResult.effectiveMandates.database === "sqlite") {
      addResult("Policy Engine (Small Scale Isolation)", "PASS", "Observed: Small scale correctly maps to Monolith+SQLite, separate from Enterprise");
    } else {
      addResult("Policy Engine (Small Scale Isolation)", "FAIL", `Got: ${JSON.stringify(smallResult.effectiveMandates)}`);
    }
  } catch (err: any) {
    addResult("Policy Engine (Small Scale Isolation)", "FAIL", err.message);
  }

  // Test 3: Knowledge Base – Pattern Resolution
  try {
    const pattern = knowledgeBase.getPattern("microservices");
    const generators = knowledgeBase.getGeneratorsForPattern("microservices");
    if (pattern && generators.length > 0) {
      addResult("Knowledge Base (Pattern Resolution)", "PASS", `Observed: Pattern '${pattern.name}' resolved with ${generators.length} compatible generators`);
    } else {
      addResult("Knowledge Base (Pattern Resolution)", "FAIL", "Pattern or generators missing");
    }
  } catch (err: any) {
    addResult("Knowledge Base (Pattern Resolution)", "FAIL", err.message);
  }

  // Test 4: Knowledge Base – Best Practices
  try {
    const practices = knowledgeBase.getBestPractices("journal");
    if (practices.length > 0) {
      addResult("Knowledge Base (Best Practices)", "PASS", `Observed: ${practices.length} domain-specific best practices loaded for 'journal'`);
    } else {
      addResult("Knowledge Base (Best Practices)", "FAIL", "No best practices found");
    }
  } catch (err: any) {
    addResult("Knowledge Base (Best Practices)", "FAIL", err.message);
  }

  // Test 5: Decision Engine – Technology Strategy
  try {
    const strategy = decisionEngine.decide(reqModel);
    if (
      strategy.pattern === "microservices" &&
      strategy.database === "postgresql" &&
      strategy.backend === "nestjs" &&
      strategy.deployment === "docker" &&
      strategy.rationale.length > 0
    ) {
      addResult("Decision Engine (Technology Strategy)", "PASS", `Observed: Strategy resolved — Pattern:${strategy.pattern} DB:${strategy.database} Backend:${strategy.backend} Deploy:${strategy.deployment}`);
    } else {
      addResult("Decision Engine (Technology Strategy)", "FAIL", `Strategy: ${JSON.stringify({ pattern: strategy.pattern, database: strategy.database })}`);
    }
  } catch (err: any) {
    addResult("Decision Engine (Technology Strategy)", "FAIL", err.message);
  }

  // Test 6: Decision Engine – Determinism (same input = same strategy)
  try {
    const s1 = decisionEngine.decide(reqModel);
    const s2 = decisionEngine.decide(reqModel);
    const deterministicCheck =
      s1.pattern === s2.pattern &&
      s1.database === s2.database &&
      s1.backend === s2.backend &&
      s1.deployment === s2.deployment;
    if (deterministicCheck) {
      addResult("Decision Engine (Determinism)", "PASS", "Observed: Identical inputs consistently produce identical technology strategies");
    } else {
      addResult("Decision Engine (Determinism)", "FAIL", "Strategy is non-deterministic");
    }
  } catch (err: any) {
    addResult("Decision Engine (Determinism)", "FAIL", err.message);
  }

  // Test 7: Full Pipeline E1 -> E2
  try {
    const strategy = decisionEngine.decide(reqModel);
    if (blueprint.blueprintHash && strategy.pattern && strategy.rationale.length > 0) {
      addResult("Full Pipeline E1 → E2", "PASS", "Observed: Natural Language → RequirementModel → Blueprint → TechnologyStrategy pipeline complete");
    } else {
      addResult("Full Pipeline E1 → E2", "FAIL", "Pipeline incomplete");
    }
  } catch (err: any) {
    addResult("Full Pipeline E1 → E2", "FAIL", err.message);
  }

  console.log("\n==================================================================");
  console.log("                       VALIDATION SUMMARY                         ");
  console.log("==================================================================\n");

  const allPassed = results.every(r => r.status === "PASS");
  if (allPassed) {
    console.log(">>> STATUS: SPRINT E2 VALIDATED (100% SUCCESS) <<<\n");
    console.log("--------------------------------------------------");
    console.log("          USGEC SPRINT E2 CERTIFICATE GENERATED  ");
    console.log("--------------------------------------------------");
    console.log("Certificate ID: UAI-USGEC-E2-7714");
    console.log("Status: VALIDATED");
    console.log("Scope: Policy Engine, Knowledge Base & Decision Engine");
    console.log("Platform Baseline: UAI-FB-1.0");
    console.log("--------------------------------------------------\n");
  } else {
    const failed = results.filter(r => r.status === "FAIL");
    console.log(">>> STATUS: VALIDATION FAILED <<<");
    console.log("Failed tests:");
    failed.forEach(f => console.log(`  - ${f.name}: ${f.details}`));
  }
}

runSprintE2Validation().catch(console.error);
