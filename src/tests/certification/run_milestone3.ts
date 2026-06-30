import { CertificationRunner } from "./framework/CertificationRunner";
import * as path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(new Function('return import.meta.url')());
const __dirname = path.dirname(__filename);

async function main() {
  console.log("==================================================");
  console.log("🚀 ULTIMATEAI KERNEL CERTIFICATION (PHASE 3A) 🚀");
  console.log("   MILESTONE 3: KNOWLEDGE CERTIFICATION");
  console.log("==================================================\n");

  const runner = new CertificationRunner("3", "knowledge-seed-2026");
  
  const manifestPath = path.join(__dirname, "milestone3.manifest.json");
  const testDir = path.join(__dirname, "milestone3");
  const reportDir = path.join(__dirname, "../../../reports/certification/milestone3");
  
  try {
    await runner.discover(manifestPath, testDir);
    await runner.executeAll(reportDir);
  } catch (error) {
    console.error("Critical failure in certification runner:", error);
    process.exit(1);
  }
}

main();
