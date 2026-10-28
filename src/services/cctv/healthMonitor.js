/**
 * healthMonitor.js
 * JINI — PalantirIndonesia Intelligence
 * Protocol-Aware CCTV Connectivity & Playability Diagnostics
 */
import {
  cctvRegistryInstance,
  STREAM_STATUSES,
  ACCESS_STATUSES,
  SOURCE_REACHABILITY,
  STREAM_PLAYABILITY,
  LOCATION_VERIFICATION,
} from './cctvRegistry.js';
import { isSafeUrl } from './discoveryEngine.js';

class CCTVHealthMonitor {
  constructor() {
    this.isProbing = false;
    this.probeResults = new Map();
  }

  /**
   * Probe a single camera with safety timeout, protocol inspection, and SSRF check
   */
  async probeCamera(camera) {
    const nowIso = new Date().toISOString();

    // Case 1: Gated feeds that require internal network / credentials
    if (camera.access_status === ACCESS_STATUSES.REQUIRES_ACCESS) {
      const accessReason = camera.failure_reason
        ? `AKSES TERBATAS: ${camera.failure_reason}`
        : 'AKSES TERBATAS: Memerlukan otorisasi/VPN jaringan internal instansi';
      const result = {
        camera_id: camera.camera_id,
        status: STREAM_STATUSES.OFFLINE,
        reachability: SOURCE_REACHABILITY.UNREACHABLE,
        playability: STREAM_PLAYABILITY.UNPLAYABLE,
        location: LOCATION_VERIFICATION.UNVERIFIED_LOCATION,
        failure_reason: accessReason,
        latency_ms: 0,
        last_checked: nowIso,
      };
      this.probeResults.set(camera.camera_id, result);
      cctvRegistryInstance.addOrUpdate({
        camera_id: camera.camera_id,
        stream_status: STREAM_STATUSES.OFFLINE,
        source_reachability: SOURCE_REACHABILITY.UNREACHABLE,
        stream_playability: STREAM_PLAYABILITY.UNPLAYABLE,
        failure_reason: result.failure_reason,
        last_checked_at: nowIso,
      });
      return result;
    }

    // Case 2: No source URL configured
    if (!camera.source_url) {
      const result = {
        camera_id: camera.camera_id,
        status: STREAM_STATUSES.UNVERIFIED,
        reachability: SOURCE_REACHABILITY.UNKNOWN,
        playability: STREAM_PLAYABILITY.UNTESTED,
        location: LOCATION_VERIFICATION.UNVERIFIED_LOCATION,
        failure_reason: camera.failure_reason || 'Belum ada URL feed resmi yang terdaftar',
        latency_ms: 0,
        last_checked: nowIso,
      };
      this.probeResults.set(camera.camera_id, result);
      cctvRegistryInstance.addOrUpdate({
        camera_id: camera.camera_id,
        stream_status: STREAM_STATUSES.UNVERIFIED,
        source_reachability: SOURCE_REACHABILITY.UNKNOWN,
        stream_playability: STREAM_PLAYABILITY.UNTESTED,
        last_checked_at: nowIso,
      });
      return result;
    }

    // Case 3: SSRF Guardrail
    if (!isSafeUrl(camera.source_url)) {
      const result = {
        camera_id: camera.camera_id,
        status: STREAM_STATUSES.OFFLINE,
        reachability: SOURCE_REACHABILITY.UNREACHABLE,
        playability: STREAM_PLAYABILITY.UNPLAYABLE,
        location: LOCATION_VERIFICATION.UNVERIFIED_LOCATION,
        failure_reason: 'DIBLOKIR: URL melanggar kebijakan keamanan jaringan internal (SSRF)',
        latency_ms: 0,
        last_checked: nowIso,
      };
      this.probeResults.set(camera.camera_id, result);
      cctvRegistryInstance.addOrUpdate({
        camera_id: camera.camera_id,
        stream_status: STREAM_STATUSES.OFFLINE,
        source_reachability: SOURCE_REACHABILITY.UNREACHABLE,
        stream_playability: STREAM_PLAYABILITY.UNPLAYABLE,
        failure_reason: result.failure_reason,
        last_checked_at: nowIso,
      });
      return result;
    }

    // Case 4: Public endpoint probing
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const start = Date.now();

    try {
      // Protocol-aware check:
      // For HLS streams, fetch first 1KB of manifest to confirm valid M3U8 content
      let playability = STREAM_PLAYABILITY.UNTESTED;
      let reachability = SOURCE_REACHABILITY.REACHABLE;

      if (camera.stream_protocol === 'HLS') {
        const res = await fetch(camera.source_url, {
          method: 'GET',
          signal: controller.signal,
          headers: { Range: 'bytes=0-1024' },
        });
        clearTimeout(timeout);
        const text = await res.text();
        if (text.includes('#EXTM3U')) {
          reachability = SOURCE_REACHABILITY.REACHABLE;
          playability = STREAM_PLAYABILITY.PLAYABLE;
        } else {
          reachability = SOURCE_REACHABILITY.REACHABLE;
          playability = STREAM_PLAYABILITY.UNPLAYABLE;
        }
      } else if (camera.stream_protocol === 'MP4_STREAM') {
        const res = await fetch(camera.source_url, {
          method: 'GET',
          signal: controller.signal,
          headers: { Range: 'bytes=0-2048' },
        });
        clearTimeout(timeout);
        const ctype = res.headers.get('content-type') || '';
        reachability = res.ok ? SOURCE_REACHABILITY.REACHABLE : SOURCE_REACHABILITY.UNREACHABLE;
        playability = (res.ok && (ctype.includes('video') || ctype.includes('octet-stream')))
          ? STREAM_PLAYABILITY.PLAYABLE
          : STREAM_PLAYABILITY.UNTESTED;
      } else {
        // Embed portals / Web catalog: HTTP HEAD proves network reachability only, NOT stream playability
        await fetch(camera.source_url, {
          method: 'HEAD',
          signal: controller.signal,
          mode: 'no-cors',
        });
        clearTimeout(timeout);
        reachability = SOURCE_REACHABILITY.REACHABLE;
        playability = STREAM_PLAYABILITY.UNTESTED;
      }

      const latency = Date.now() - start;

      // Strict Integrity Enforcement:
      // 1. Network probe CANNOT verify physical location; preserve or default to UNVERIFIED_LOCATION
      const verifiedLocation = camera.location_verification === LOCATION_VERIFICATION.VERIFIED_LOCATION
        ? LOCATION_VERIFICATION.VERIFIED_LOCATION
        : LOCATION_VERIFICATION.UNVERIFIED_LOCATION;

      // 2. Stream can ONLY be ONLINE (LIVE) if both playable AND physically verified
      const isGenuinelyLive = playability === STREAM_PLAYABILITY.PLAYABLE && verifiedLocation === LOCATION_VERIFICATION.VERIFIED_LOCATION;
      const derivedStatus = isGenuinelyLive
        ? STREAM_STATUSES.ONLINE
        : playability === STREAM_PLAYABILITY.PLAYABLE
        ? STREAM_STATUSES.UNVERIFIED
        : STREAM_STATUSES.DEGRADED;

      const failureReason = !isGenuinelyLive && verifiedLocation !== LOCATION_VERIFICATION.VERIFIED_LOCATION
        ? 'Sumber dapat dijangkau namun lokasi fisik belum diverifikasi (Audit Integrity Hold)'
        : null;

      const result = {
        camera_id: camera.camera_id,
        status: derivedStatus,
        reachability,
        playability,
        location: verifiedLocation,
        latency_ms: latency,
        last_checked: nowIso,
        failure_reason: failureReason,
      };

      this.probeResults.set(camera.camera_id, result);
      cctvRegistryInstance.addOrUpdate({
        camera_id: camera.camera_id,
        stream_status: derivedStatus,
        source_reachability: reachability,
        stream_playability: playability,
        location_verification: verifiedLocation,
        last_checked_at: nowIso,
        last_success_at: reachability === SOURCE_REACHABILITY.REACHABLE ? nowIso : null,
        failure_reason: failureReason,
      });

      return result;
    } catch (err) {
      clearTimeout(timeout);
      const latency = Date.now() - start;
      const isTimeout = err.name === 'AbortError';

      const result = {
        camera_id: camera.camera_id,
        status: STREAM_STATUSES.OFFLINE,
        reachability: SOURCE_REACHABILITY.UNREACHABLE,
        playability: STREAM_PLAYABILITY.UNPLAYABLE,
        location: LOCATION_VERIFICATION.UNVERIFIED_LOCATION,
        failure_reason: isTimeout ? 'Koneksi timeout (>4000ms)' : `Gagal menghubungi sumber: ${err.message}`,
        latency_ms: latency,
        last_checked: nowIso,
      };

      this.probeResults.set(camera.camera_id, result);
      cctvRegistryInstance.addOrUpdate({
        camera_id: camera.camera_id,
        stream_status: STREAM_STATUSES.OFFLINE,
        source_reachability: SOURCE_REACHABILITY.UNREACHABLE,
        stream_playability: STREAM_PLAYABILITY.UNPLAYABLE,
        failure_reason: result.failure_reason,
        last_checked_at: nowIso,
      });

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
        await new Promise((r) => setTimeout(r, 150));
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
