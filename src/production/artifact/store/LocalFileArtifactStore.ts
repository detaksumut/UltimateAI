import { IArtifactStore } from "./IArtifactStore";
import { IArtifact } from "../contracts/IArtifact";
import * as fs from "fs";
import * as path from "path";

export class LocalFileArtifactStore implements IArtifactStore {
  private readonly baseDir: string;

  constructor(baseDir: string = path.join(process.cwd(), "reports", "artifacts")) {
    this.baseDir = baseDir;
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private getFilePath(id: string, version: number): string {
    return path.join(this.baseDir, `artifact_${id}_v${version}.json`);
  }

  async save(artifact: IArtifact): Promise<void> {
    const { id, version } = artifact.identity;
    const filePath = this.getFilePath(id, version);
    
    fs.writeFileSync(filePath, JSON.stringify(artifact, null, 2), "utf-8");
  }

  async get(id: string, version: number): Promise<IArtifact | undefined> {
    const filePath = this.getFilePath(id, version);
    
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(data) as IArtifact;
    }
    
    return undefined;
  }

  async getLatest(id: string): Promise<IArtifact | undefined> {
    // This is inefficient on filesystem but sufficient for the initial implementation phase
    if (!fs.existsSync(this.baseDir)) return undefined;
    
    const files = fs.readdirSync(this.baseDir);
    const artifactFiles = files.filter(f => f.startsWith(`artifact_${id}_v`));
    
    if (artifactFiles.length === 0) return undefined;
    
    let highestVersion = -1;
    for (const file of artifactFiles) {
      const match = file.match(/_v(\d+)\.json$/);
      if (match) {
        const v = parseInt(match[1], 10);
        if (v > highestVersion) {
          highestVersion = v;
        }
      }
    }
    
    return this.get(id, highestVersion);
  }

  async findByTrace(traceId: string): Promise<IArtifact[]> {
    // Highly inefficient for filesystem, but works for local testing
    if (!fs.existsSync(this.baseDir)) return [];
    
    const results: IArtifact[] = [];
    const files = fs.readdirSync(this.baseDir);
    
    for (const file of files) {
      if (file.endsWith(".json")) {
        const filePath = path.join(this.baseDir, file);
        try {
          const data = fs.readFileSync(filePath, "utf-8");
          const artifact = JSON.parse(data) as IArtifact;
          if (artifact.trace.traceId === traceId) {
            results.push(artifact);
          }
        } catch (e) {
          // Ignore invalid JSON files
        }
      }
    }
    
    return results;
  }
}
