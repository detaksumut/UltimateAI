import { RequirementInterpreter } from "./RequirementInterpreter";
import { BlueprintPlanner } from "./BlueprintPlanner";
import { BlueprintValidator } from "../foundation/blueprint/BlueprintValidator";

async function runSprintE1Validation() {
  console.log("==================================================================");
  console.log("          ULTIMATEAI GENERATION ENGINE - SPRINT E1 VALIDATION     ");
  console.log("==================================================================\n");

  const results: { name: string; status: "PASS" | "FAIL"; details: string }[] = [];
  const addResult = (name: string, status: "PASS" | "FAIL", details: string) => {
    results.push({ name, status, details });
    console.log(`[${status}] ${name} - ${details}`);
  };

  const interpreter = new RequirementInterpreter();
  const planner = new BlueprintPlanner();

  // Test Case 1: National OJS journal system
  try {
    const query = "Bangunkan sistem OJS nasional dengan reviewer, DOI, ORCID, Crossref, dashboard editor, dashboard reviewer, Docker deployment.";
    const reqModel = interpreter.interpret(query);

    if (
      reqModel.domain === "journal" &&
      reqModel.scale === "enterprise" &&
      reqModel.features.includes("reviewer-management") &&
      reqModel.features.includes("doi-registration") &&
      reqModel.features.includes("orcid-integration") &&
      reqModel.features.includes("crossref-indexing") &&
      reqModel.features.includes("docker-deployment")
    ) {
      addResult("Requirement Interpreter", "PASS", "Observed: Successfully parsed domain, scale, and feature arrays from natural query");
    } else {
      addResult("Requirement Interpreter", "FAIL", `Mismatched RequirementModel: ${JSON.stringify(reqModel)}`);
    }

    // Blueprint Generation
    const blueprint = planner.plan(reqModel);
    const validator = new BlueprintValidator();
    const report = validator.validate(blueprint);

    const isAgnostic = !JSON.stringify(blueprint.specification).includes("class ") && !JSON.stringify(blueprint.specification).includes("import ");

    if (report.isValid && report.metrics.hashMatches && isAgnostic) {
      addResult("Blueprint Planner", "PASS", "Observed: Blueprint is structurally valid, technology-agnostic, and hashes correctly");
    } else {
      addResult("Blueprint Planner", "FAIL", `Report: ${JSON.stringify(report.issues)}`);
    }

  } catch (err: any) {
    addResult("Sprint E1 Execution", "FAIL", err.message);
  }

  console.log("\n==================================================================");
  console.log("                       VALIDATION SUMMARY                         ");
  console.log("==================================================================\n");

  const allPassed = results.every(r => r.status === "PASS");
  if (allPassed) {
    console.log(">>> STATUS: SPRINT E1 VALIDATED (100% SUCCESS) <<<\n");
    console.log("--------------------------------------------------");
    console.log("          USGEC SPRINT E1 CERTIFICATE GENERATED  ");
    console.log("--------------------------------------------------");
    console.log("Certificate ID: UAI-USGEC-E1-4903");
    console.log("Status: VALIDATED");
    console.log("Scope: Requirement Interpretation & Blueprint Planning");
    console.log("Platform Baseline: UAI-FB-1.0");
    console.log("--------------------------------------------------\n");
  } else {
    console.log(">>> STATUS: VALIDATION FAILED <<<\n");
  }
}

runSprintE1Validation().catch(console.error);
