/**
 * ArtifactRunner.ts
 *
 * Saves pipeline outputs into Reference Assets (Golden Snapshots).
 * Writes prompt.md, intent.json, workflow.yaml, compilation-artifact.json, execution-snapshot.json, observability-report.json.
 */

import * as fs from 'fs';
import * as path from 'path';

export class ArtifactRunner {
  constructor(private baseDir: string) {}
  
  public saveAsset(domain: string, filename: string, content: string | object): void {
    const dir = path.join(this.baseDir, 'reference-implementations', domain);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const filePath = path.join(dir, filename);
    const data = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    
    fs.writeFileSync(filePath, data, 'utf-8');
  }
  
  public saveGoldenSnapshot(domain: string, phase: string, snapshotData: any): void {
    const dir = path.join(this.baseDir, 'reference-implementations', domain, 'golden-snapshot');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(path.join(dir, `snapshot_${phase}.json`), JSON.stringify(snapshotData, null, 2), 'utf-8');
  }
}
