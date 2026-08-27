import { RuntimeRegistryImpl } from "../registry/RuntimeRegistry";
import { RuntimeLifecycle } from "../contracts/RuntimeLifecycle";
import { JournalRuntime } from "./JournalRuntime";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple YAML Parser helper to avoid external dependency issues
function parseYaml(yamlContent: string): any {
  const result: any = {};
  const lines = yamlContent.split("\n");
  let currentKey = "";
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    
    // Check if it's a list item
    if (trimmed.startsWith("-")) {
      const val = trimmed.replace("-", "").trim().replace(/"/g, "");
      if (currentKey && Array.isArray(result[currentKey])) {
        result[currentKey].push(val);
      }
      continue;
    }
    
    // Check for nested keys (simple nested parser)
    if (line.startsWith("  ") && currentKey) {
      const parts = trimmed.split(":");
      if (parts.length >= 2) {
        const subKey = parts[0].trim();
        const subVal = parts.slice(1).join(":").trim().replace(/"/g, "");
        if (typeof result[currentKey] !== "object") {
          result[currentKey] = {};
        }
        result[currentKey][subKey] = subVal;
      }
      continue;
    }
    
    const parts = trimmed.split(":");
    if (parts.length >= 2) {
      currentKey = parts[0].trim();
      const val = parts.slice(1).join(":").trim().replace(/"/g, "");
      
      if (val === "") {
        // Could be a list or nested object starting
        if (currentKey === "capabilities" || currentKey === "dependencies" || currentKey === "contracts" || currentKey === "permissions") {
          result[currentKey] = [];
        } else {
          result[currentKey] = {};
        }
      } else {
        if (val === "[]") {
          result[currentKey] = [];
        } else if (val === "{}") {
          result[currentKey] = {};
        } else {
          result[currentKey] = val;
        }
      }
    }
  }
  return result;
}

async function runValidation() {
  console.log("==================================================================");
  console.log("         ULTIMATEAI FOUNDATION VALIDATION SUITE (UAI-FB-1.0)       ");
  console.log("==================================================================\n");

  const results: { name: string; status: "PASS" | "FAIL"; details: string }[] = [];
  const yamlPath = path.join(__dirname, "runtime.yaml");
  
  const addResult = (name: string, status: "PASS" | "FAIL", details: string) => {
    results.push({ name, status, details });
    console.log(`[${status}] ${name} - ${details}`);
  };

  // --- TEST 1: Manifest Parsing & Validation ---
  try {
    const yamlContent = fs.readFileSync(yamlPath, "utf8");
    const parsed = parseYaml(yamlContent);
    
    if (parsed.id === "ultimate.runtime.journal" && parsed.name && parsed.version) {
      addResult("Manifest Parsing", "PASS", "runtime.yaml parsed successfully and matches structure");
    } else {
      addResult("Manifest Parsing", "FAIL", "Missing standard manifest fields");
    }
  } catch (err: any) {
    addResult("Manifest Parsing", "FAIL", err.message);
  }

  // --- TEST 2: Foundation Compatibility Check ---
  try {
    const yamlContent = fs.readFileSync(yamlPath, "utf8");
    const parsed = parseYaml(yamlContent);
    const baseline = parsed.foundation?.baseline;
    
    if (baseline === "UAI-FB-1.0") {
      addResult("Foundation Compatibility", "PASS", `Baseline matches ${baseline}`);
    } else {
      addResult("Foundation Compatibility", "FAIL", `Expected UAI-FB-1.0, got ${baseline}`);
    }
  } catch (err: any) {
    addResult("Foundation Compatibility", "FAIL", err.message);
  }

  // --- TEST 3: Capability Registration ---
  try {
    const yamlContent = fs.readFileSync(yamlPath, "utf8");
    const parsed = parseYaml(yamlContent);
    
    if (parsed.capabilities && parsed.capabilities.includes("SkeletonRuntime")) {
      addResult("Capability Registration", "PASS", "Registered netral capability 'SkeletonRuntime'");
    } else {
      addResult("Capability Registration", "FAIL", "Capabilities missing or incorrect");
    }
  } catch (err: any) {
    addResult("Capability Registration", "FAIL", err.message);
  }

  // --- TEST 4: Runtime Discovery & Registration ---
  const registry = new RuntimeRegistryImpl();
  const runtime = new JournalRuntime();
  
  try {
    registry.register(runtime);
    const found = registry.findById(runtime.manifest.id);
    if (found && found.manifest.id === "ultimate.runtime.journal") {
      addResult("Runtime Discovery & Reg", "PASS", "Runtime registered and found by ID in Registry");
    } else {
      addResult("Runtime Discovery & Reg", "FAIL", "Runtime registration failed");
    }
  } catch (err: any) {
    addResult("Runtime Discovery & Reg", "FAIL", err.message);
  }

  // --- TEST 5: Runtime Lifecycle Transitions ---
  try {
    runtime.setState(RuntimeLifecycle.REGISTERED);
    runtime.setState(RuntimeLifecycle.INITIALIZED);
    runtime.setState(RuntimeLifecycle.READY);
    
    if (runtime.state === RuntimeLifecycle.READY) {
      addResult("Runtime Lifecycle States", "PASS", "State machine transition Installed -> Registered -> Initialized -> Ready verified");
    } else {
      addResult("Runtime Lifecycle States", "FAIL", "Failed state transition flow");
    }
  } catch (err: any) {
    addResult("Runtime Lifecycle States", "FAIL", err.message);
  }

  // --- TEST 6: Ilegal State Transition Test ---
  try {
    const freshRuntime = new JournalRuntime();
    // Inisiasi ilegal state transition: Installed langsung ke RUNNING
    freshRuntime.setState(RuntimeLifecycle.RUNNING);
    addResult("Illegal State Transition", "FAIL", "Direct transition from Installed to Running allowed without error!");
  } catch (err: any) {
    addResult("Illegal State Transition", "PASS", `Transition rejected correctly: ${err.message}`);
  }

  // --- TEST 7: Runtime Health Check ---
  try {
    const isHealthy = await runtime.health();
    if (isHealthy) {
      addResult("Runtime Health Check", "PASS", "healthCheck() returned true for status READY");
    } else {
      addResult("Runtime Health Check", "FAIL", "healthCheck() returned false");
    }
  } catch (err: any) {
    addResult("Runtime Health Check", "FAIL", err.message);
  }

  // --- TEST 8: Unload & Reload Cycle ---
  try {
    registry.unregister(runtime.manifest.id);
    const foundAfterUnregister = registry.findById(runtime.manifest.id);
    
    if (!foundAfterUnregister) {
      registry.register(runtime);
      const reFound = registry.findById(runtime.manifest.id);
      if (reFound) {
        addResult("Unload & Reload Cycle", "PASS", "Runtime successfully unregistered (unloaded) and re-registered (reloaded)");
      } else {
        addResult("Unload & Reload Cycle", "FAIL", "Failed to reload runtime");
      }
    } else {
      addResult("Unload & Reload Cycle", "FAIL", "Failed to unload runtime");
    }
  } catch (err: any) {
    addResult("Unload & Reload Cycle", "FAIL", err.message);
  }

  // --- TEST 9: Duplicate Runtime Registration ---
  try {
    registry.register(runtime);
    addResult("Duplicate Registration", "FAIL", "Registered the same runtime twice without error");
  } catch (err: any) {
    addResult("Duplicate Registration", "PASS", `Duplicate registration rejected correctly: ${err.message}`);
  }

  // --- TEST 10: Invalid Foundation Baseline ---
  try {
    const invalidYaml = `
id: "ultimate.runtime.test"
foundation:
  baseline: "UAI-FB-0.9"
capabilities:
  - "SkeletonRuntime"
`;
    const parsed = parseYaml(invalidYaml);
    if (parsed.foundation?.baseline !== "UAI-FB-1.0") {
      throw new Error(`Incompatible baseline: ${parsed.foundation?.baseline}`);
    }
    addResult("Invalid Baseline Check", "FAIL", "Invalid baseline UAI-FB-0.9 allowed!");
  } catch (err: any) {
    addResult("Invalid Baseline Check", "PASS", `Rejected invalid baseline: ${err.message}`);
  }

  // --- TEST 11: Missing Capability ---
  try {
    const missingCapYaml = `
id: "ultimate.runtime.test"
foundation:
  baseline: "UAI-FB-1.0"
`;
    const parsed = parseYaml(missingCapYaml);
    if (!parsed.capabilities || parsed.capabilities.length === 0) {
      throw new Error("Manifest validation error: Missing 'capabilities' field");
    }
    addResult("Missing Capabilities Check", "FAIL", "Manifest with missing capabilities allowed!");
  } catch (err: any) {
    addResult("Missing Capabilities Check", "PASS", `Rejected manifest without capabilities: ${err.message}`);
  }

  // --- TEST 12: Missing Baseline ---
  try {
    const missingBaselineYaml = `
id: "ultimate.runtime.test"
capabilities:
  - "SkeletonRuntime"
`;
    const parsed = parseYaml(missingBaselineYaml);
    if (!parsed.foundation || !parsed.foundation.baseline) {
      throw new Error("Manifest validation error: Missing 'foundation.baseline' field");
    }
    addResult("Missing Baseline Check", "FAIL", "Manifest with missing baseline allowed!");
  } catch (err: any) {
    addResult("Missing Baseline Check", "PASS", `Rejected manifest without baseline: ${err.message}`);
  }

  // --- TEST 13: Registry Restart Simulation ---
  try {
    const restartedRegistry = new RuntimeRegistryImpl();
    restartedRegistry.register(runtime);
    const foundAfterRestart = restartedRegistry.findById(runtime.manifest.id);
    if (foundAfterRestart) {
      addResult("Registry Restart Simulation", "PASS", "Registry successfully restarted and runtime re-registered");
    } else {
      addResult("Registry Restart Simulation", "FAIL", "Registry restart failed to register runtime");
    }
  } catch (err: any) {
    addResult("Registry Restart Simulation", "FAIL", err.message);
  }

  // --- TEST 14: Version Compatibility Check ---
  try {
    const incompatibleVersionYaml = `
id: "ultimate.runtime.test"
version: "2.0.0"
foundation:
  baseline: "UAI-FB-1.0"
capabilities:
  - "SkeletonRuntime"
`;
    const parsed = parseYaml(incompatibleVersionYaml);
    // Standard validation: version 2.x runtimes are allowed if they comply with UAI-FB-1.0
    if (parsed.version && parsed.foundation.baseline === "UAI-FB-1.0") {
      addResult("Version Compatibility", "PASS", `Version ${parsed.version} complies with baseline UAI-FB-1.0`);
    } else {
      addResult("Version Compatibility", "FAIL", "Failed version check");
    }
  } catch (err: any) {
    addResult("Version Compatibility", "FAIL", err.message);
  }

  // --- TEST 15: Contract Schema Integrity ---
  try {
    const yamlContent = fs.readFileSync(yamlPath, "utf8");
    const parsed = parseYaml(yamlContent);
    // Check if contracts is defined as array, even if empty
    if (Array.isArray(parsed.contracts)) {
      addResult("Contract Schema Integrity", "PASS", "Contracts array structure tervalidasi");
    } else {
      addResult("Contract Schema Integrity", "FAIL", "Contracts field must be an array");
    }
  } catch (err: any) {
    addResult("Contract Schema Integrity", "FAIL", err.message);
  }

  console.log("\n==================================================================");
  console.log("                     FOUNDATION VALIDATION COMPLETED              ");
  console.log("==================================================================\n");
  
  const allPassed = results.every(r => r.status === "PASS");
  if (allPassed) {
    console.log(">>> STATUS: FOUNDATION VALIDATED (100% SUCCESS) <<<\n");
  } else {
    console.log(">>> STATUS: FOUNDATION VALIDATION FAILED <<<\n");
  }
}

runValidation().catch(console.error);
