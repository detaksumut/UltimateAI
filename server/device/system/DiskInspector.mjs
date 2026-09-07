/**
 * DiskInspector.mjs
 * Detailed per-drive inspection (label, filesystem, capacity) — LOCAL ONLY.
 * Thin wrapper around the snapshot collector + a label enrichment probe.
 */

import { runPowershell } from '../platform/PlatformProbe.mjs';
import { systemSnapshotCollectorInstance as snapshot } from './SystemSnapshotCollector.mjs';

export class DiskInspector {
  async getDiskDetails() {
    const { disks, errors } = await snapshot.getDisks();

    let meta = [];
    if (process.platform === 'win32') {
      const rows = await runPowershell(
        `Get-Volume -ErrorAction SilentlyContinue | ` +
        `Where-Object { $_.DriveLetter } | ` +
        `ForEach-Object { [pscustomobject]@{ Drive = $_.DriveLetter; Label = $_.FileSystemLabel; FileSystem = $_.FileSystem; Health = $_.HealthStatus } } | ConvertTo-Json -Compress`
      );
      if (Array.isArray(rows)) {
        const m = new Map(rows.map(r => [String(r.Drive).toUpperCase(), r]));
        meta = m;
      }
    }

    const result = disks.map(d => {
      const info = meta instanceof Map ? meta.get(d.drive) : null;
      return {
        ...d,
        label: info?.Label || null,
        fileSystem: info?.FileSystem || null,
        health: info?.Health || null
      };
    });

    return { drives: result, errors };
  }
}

export const diskInspectorInstance = new DiskInspector();
export default diskInspectorInstance;