/**
 * healthMonitor.js
 * JINI — PalantirIndonesia Intelligence
 * Rate-Limited CCTV Connectivity Health Monitoring & Diagnostics
 */
import { cctvRegistryInstance, STREAM_STATUSES, ACCESS_STATUSES } from './cctvRegistry.js';
import { isSafeUrl } from './discoveryEngine.js';

class CCTVHealthMonitor {
  constructor() {
    this.isProbing = false;
    this.probeResults = new Map();
  }

  /**
   * Probe a single camera with safety timeout and SSRF check
   */
  async probeCamera(camera) {
    if (!isSafeUrl(camera.source_url)) {
      return {
        camera_id: camera.camera_id,
        status: STREAM_STATUSES.OFFLINE,
        access: ACCESS_STATUSES.REQUIRES_ACCESS,
        error: 'BLOCKED_BY_SSRF_POLICY',
        latency_ms: 0,
      };
    }

    // Gated feeds require internal network
    if (camera.access_status === ACCESS_STATUSES.REQUIRES_ACCESS) {
      return {
        camera_id: camera.camera_id,
        status: STREAM_STATUSES.OFFLINE,
        access: ACCESS_STATUSES.REQUIRES_ACCESS,
        error: 'AUTHENTICATION_REQUIRED',
        latency_ms: 0,
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const start = Date.now();

    try {
      // Use head or small range get
      const res = await fetch(camera.source_url, {
        method: 'HEAD',
        signal: controller.signal,
        mode: 'no-cors', // Many cameras don't have CORS headers, opaque response means reachable
      });

      clearTimeout(timeout);
      const latency = Date.now() - start;

      const result = {
        camera_id: camera.camera_id,
        status: STREAM_STATUSES.ONLINE,
        access: ACCESS_STATUSES.PUBLIC_OPEN,
        latency_ms: latency,
        last_checked: new Date().toISOString(),
      };

      this.probeResults.set(camera.camera_id, result);
      cctvRegistryInstance.addOrUpdate({
        camera_id: camera.camera_id,
        stream_status: STREAM_STATUSES.ONLINE,
        last_checked_at: new Date().toISOString(),
        last_success_at: new Date().toISOString(),
      });

      return result;
    } catch (err) {
      clearTimeout(timeout);
      const latency = Date.now() - start;
      const isTimeout = err.name === 'AbortError';

      const result = {
        camera_id: camera.camera_id,
        status: isTimeout ? STREAM_STATUSES.OFFLINE : STREAM_STATUSES.DEGRADED,
        access: camera.access_status,
        error: isTimeout ? 'TIMEOUT_3500MS' : err.message,
        latency_ms: latency,
        last_checked: new Date().toISOString(),
      };

      this.probeResults.set(camera.camera_id, result);
      return result;
    }
  }

  /**
   * Run health probe over all registered cameras with throttling
   */
  async runNationalHealthCheck(onProgress) {
    if (this.isProbing) return { status: 'IN_PROGRESS' };
    this.isProbing = true;

    const cameras = cctvRegistryInstance.getAll();
    const total = cameras.length;
    let completed = 0;
    const batchSize = 3;

    try {
      for (let i = 0; i < total; i += batchSize) {
        const batch = cameras.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (cam) => {
            await this.probeCamera(cam);
            completed++;
            if (onProgress) onProgress({ completed, total });
          })
        );
        // Small throttle sleep between batches
        await new Promise((r) => setTimeout(r, 200));
      }

      return {
        success: true,
        totalChecked: total,
        stats: cctvRegistryInstance.getStats(),
      };
    } finally {
      this.isProbing = false;
    }
  }

  getLastResult(cameraId) {
    return this.probeResults.get(cameraId) || null;
  }
}

export const cctvHealthMonitorInstance = new CCTVHealthMonitor();
