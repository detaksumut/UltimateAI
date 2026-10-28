/**
 * CCTVPlayer.jsx
 * JINI — PalantirIndonesia Intelligence
 * Tactical Multi-Protocol CCTV Video & Technical HUD Status Screen
 * 
 * Strict Integrity Standard:
 * - NO test streams (Mux, Big Buck Bunny, etc.)
 * - NO stock photos (Unsplash, etc.)
 * - Unverified or unavailable feeds render a dedicated Technical HUD Status Screen.
 * - Stops playback and tears down all network/media handlers upon close/unmount.
 */
import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { cctvHealthMonitorInstance } from '../../../services/cctv/healthMonitor.js';

export default function CCTVPlayer({ camera, onClose, onFullscreen }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const timerRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [playbackError, setPlaybackError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [liveClock, setLiveClock] = useState('');
  const [isProbing, setIsProbing] = useState(false);
  const [probeResult, setProbeResult] = useState(null);

  // Live HUD Clock (WIB)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setLiveClock(
        now.toLocaleTimeString('id-ID', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }) + ' WIB'
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Strict Playability Check:
  // Feed is ONLY playable if all 4 conditions are met:
  // 1. Valid source_url exists
  // 2. source_reachability === 'REACHABLE'
  // 3. stream_playability === 'PLAYABLE'
  // 4. location_verification === 'VERIFIED_LOCATION'
  const isVerifiedPlayable =
    Boolean(camera?.source_url) &&
    camera?.source_reachability === 'REACHABLE' &&
    camera?.stream_playability === 'PLAYABLE' &&
    camera?.location_verification === 'VERIFIED_LOCATION';

  // Teardown playback cleanly on camera change or unmount
  useEffect(() => {
    if (!camera) return;

    // Reset probe result when camera switches
    setProbeResult(null);
    setPlaybackError(null);

    // If feed is NOT verified playable, ensure any previous playback is torn down
    if (!isVerifiedPlayable) {
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch (_) {}
        hlsRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setLoading(false);
      setIsPlaying(false);
      return;
    }

    // Only if VERIFIED PLAYABLE: initialize genuine stream
    setLoading(true);
    const protocol = camera.stream_protocol;
    const streamUrl = camera.source_url;

    if (protocol === 'HLS') {
      const video = videoRef.current;
      if (!video) return;

      if (Hls.isSupported()) {
        if (hlsRef.current) {
          hlsRef.current.destroy();
        }
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 30,
        });
        hlsRef.current = hls;

        hls.loadSource(streamUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setLoading(false);
          setIsPlaying(true);
          video.play().catch(() => setIsPlaying(false));
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            setPlaybackError('Koneksi live stream HLS terputus.');
            hls.destroy();
            hlsRef.current = null;
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
        video.addEventListener('loadedmetadata', () => {
          setLoading(false);
          setIsPlaying(true);
          video.play().catch(() => setIsPlaying(false));
        });
        video.addEventListener('error', () => {
          setPlaybackError('Gagal memuat native HLS stream.');
        });
      }
    } else if (protocol === 'MP4_STREAM') {
      const video = videoRef.current;
      if (video) {
        video.src = streamUrl;
        video.onloadeddata = () => {
          setLoading(false);
          setIsPlaying(true);
        };
        video.onerror = () => setPlaybackError('Video stream MP4 tidak dapat dimuat.');
        video.play().catch(() => setIsPlaying(false));
      }
    }

    return () => {
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch (_) {}
        hlsRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [camera, isVerifiedPlayable]);

  // On-demand Connectivity & Protocol Probe
  const handleRunProbe = async () => {
    if (!camera || isProbing) return;
    setIsProbing(true);
    setProbeResult(null);
    try {
      const result = await cctvHealthMonitorInstance.probeCamera(camera);
      setProbeResult(result);
    } catch (err) {
      setProbeResult({
        failure_reason: `Gagal menjalankan probe: ${err.message}`,
        status: 'OFFLINE',
      });
    } finally {
      setIsProbing(false);
    }
  };

  const handleClose = () => {
    // Ensure all media playback stops when closed
    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch (_) {}
      hlsRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute('src');
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    onClose?.();
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  if (!camera) return null;

  // Determine Verification UI Badges
  const isRequiresAccess = camera.access_status === 'REQUIRES_ACCESS';
  const isUnverifiedLoc = camera.location_verification !== 'VERIFIED_LOCATION';
  const hasNoSource = !camera.source_url;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: '#030712',
        border: '1px solid rgba(0, 229, 255, 0.35)',
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 0 30px rgba(0, 229, 255, 0.18)',
        position: 'relative',
        fontFamily: 'monospace',
      }}
    >
      {/* ── Player Tactical Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '7px 12px',
          background: 'linear-gradient(90deg, rgba(0, 229, 255, 0.12) 0%, rgba(2, 6, 23, 0.8) 100%)',
          borderBottom: '1px solid rgba(0, 229, 255, 0.25)',
          fontSize: 9.5,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: isVerifiedPlayable ? '#10b981' : isRequiresAccess ? '#f59e0b' : '#64748b',
              boxShadow: isVerifiedPlayable ? '0 0 8px #10b981' : 'none',
            }}
          />
          <span style={{ fontWeight: 800, color: '#00e5ff' }}>
            {camera.camera_id} // {camera.camera_name}
          </span>
          <span
            style={{
              fontSize: 7.5,
              padding: '1px 6px',
              borderRadius: 3,
              fontWeight: 800,
              background: isVerifiedPlayable
                ? 'rgba(16, 185, 129, 0.2)'
                : isRequiresAccess
                ? 'rgba(245, 158, 11, 0.2)'
                : 'rgba(100, 116, 139, 0.25)',
              color: isVerifiedPlayable ? '#34d399' : isRequiresAccess ? '#fbbf24' : '#94a3b8',
              border: `1px solid ${
                isVerifiedPlayable
                  ? 'rgba(16, 185, 129, 0.4)'
                  : isRequiresAccess
                  ? 'rgba(245, 158, 11, 0.4)'
                  : 'rgba(100, 116, 139, 0.4)'
              }`,
            }}
          >
            {isVerifiedPlayable
              ? 'VERIFIED LIVE'
              : isRequiresAccess
              ? 'REQUIRES ACCESS'
              : 'FEED UNVERIFIED'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#94a3b8' }}>
          <span style={{ color: '#38bdf8' }}>{liveClock}</span>
          {onFullscreen && (
            <button
              onClick={onFullscreen}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#38bdf8',
                cursor: 'pointer',
                fontSize: 10,
              }}
              title="Perbesar Tampilan"
            >
              ⛶
            </button>
          )}
          <button
            onClick={handleClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#f87171',
              cursor: 'pointer',
              fontWeight: 900,
              fontSize: 13,
            }}
            title="Tutup Pemutar (Hentikan Sesi)"
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── Viewport / Canvas Area ── */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          minHeight: 260,
          background: '#020409',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {/* Reticle HUD Corners */}
        <div style={{ position: 'absolute', top: 6, left: 6, width: 10, height: 10, borderTop: '2px solid #00e5ff', borderLeft: '2px solid #00e5ff', pointerEvents: 'none', zIndex: 10 }} />
        <div style={{ position: 'absolute', top: 6, right: 6, width: 10, height: 10, borderTop: '2px solid #00e5ff', borderRight: '2px solid #00e5ff', pointerEvents: 'none', zIndex: 10 }} />
        <div style={{ position: 'absolute', bottom: 6, left: 6, width: 10, height: 10, borderBottom: '2px solid #00e5ff', borderLeft: '2px solid #00e5ff', pointerEvents: 'none', zIndex: 10 }} />
        <div style={{ position: 'absolute', bottom: 6, right: 6, width: 10, height: 10, borderBottom: '2px solid #00e5ff', borderRight: '2px solid #00e5ff', pointerEvents: 'none', zIndex: 10 }} />

        {/* ═══ CASE A: VERIFIED PLAYABLE LIVE FEED ═══ */}
        {isVerifiedPlayable ? (
          <video
            ref={videoRef}
            playsInline
            autoPlay
            muted={isMuted}
            style={{ width: '100%', height: '100%', minHeight: 260, objectFit: 'cover' }}
          />
        ) : (
          /* ═══ CASE B: TECHNICAL HUD STATUS SCREEN (NO FAKE / STOCK MEDIA) ═══ */
          <div
            style={{
              width: '100%',
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'radial-gradient(ellipse at center, rgba(15,23,42,0.85) 0%, rgba(2,6,23,0.98) 100%)',
              textAlign: 'center',
              zIndex: 5,
            }}
          >
            {/* Status Symbol & Header */}
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                marginBottom: 10,
                background: isRequiresAccess
                  ? 'rgba(245, 158, 11, 0.15)'
                  : hasNoSource
                  ? 'rgba(100, 116, 139, 0.15)'
                  : 'rgba(239, 68, 68, 0.15)',
                border: `1px solid ${
                  isRequiresAccess
                    ? '#f59e0b'
                    : hasNoSource
                    ? '#64748b'
                    : '#ef4444'
                }`,
              }}
            >
              {isRequiresAccess ? '🔒' : hasNoSource ? '📡' : isUnverifiedLoc ? '⚠️' : '🛑'}
            </div>

            <div
              style={{
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: '0.08em',
                color: isRequiresAccess ? '#fbbf24' : '#f87171',
                marginBottom: 4,
              }}
            >
              {isRequiresAccess
                ? 'AKSES TERBATAS // JARINGAN INTERNAL INSTANSI'
                : hasNoSource
                ? 'SUMBER BELUM TERSEDIA // FEED DITAHAN'
                : 'INTEGRITAS DATA // FEED BELUM TERVERIFIKASI'}
            </div>

            <p
              style={{
                fontSize: 9,
                color: '#cbd5e1',
                maxWidth: 420,
                lineHeight: 1.5,
                margin: '0 0 14px 0',
              }}
            >
              {camera.failure_reason ||
                'Sesuai laporan audit integritas JINI, tayangan pengujian (test stream) dan foto stok dilarang digunakan. Feed hanya diaktifkan setelah terbukti dapat dijangkau dan berasal dari lokasi fisik aktual.'}
            </p>

            {/* 4-Dimension Separated Status Matrix */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 6,
                width: '100%',
                maxWidth: 480,
                marginBottom: 14,
              }}
            >
              {/* 1. Reachability */}
              <div
                style={{
                  background: 'rgba(5, 10, 20, 0.8)',
                  padding: '6px 4px',
                  borderRadius: 4,
                  border: '1px solid rgba(0, 229, 255, 0.15)',
                }}
              >
                <div style={{ fontSize: 7, color: '#64748b' }}>REACHABILITY</div>
                <div
                  style={{
                    fontSize: 8.5,
                    fontWeight: 800,
                    marginTop: 2,
                    color:
                      camera.source_reachability === 'REACHABLE'
                        ? '#34d399'
                        : camera.source_reachability === 'UNREACHABLE'
                        ? '#f87171'
                        : '#94a3b8',
                  }}
                >
                  {camera.source_reachability || 'UNKNOWN'}
                </div>
              </div>

              {/* 2. Playability */}
              <div
                style={{
                  background: 'rgba(5, 10, 20, 0.8)',
                  padding: '6px 4px',
                  borderRadius: 4,
                  border: '1px solid rgba(0, 229, 255, 0.15)',
                }}
              >
                <div style={{ fontSize: 7, color: '#64748b' }}>PLAYABILITY</div>
                <div
                  style={{
                    fontSize: 8.5,
                    fontWeight: 800,
                    marginTop: 2,
                    color:
                      camera.stream_playability === 'PLAYABLE'
                        ? '#34d399'
                        : camera.stream_playability === 'UNPLAYABLE'
                        ? '#f87171'
                        : '#94a3b8',
                  }}
                >
                  {camera.stream_playability || 'UNTESTED'}
                </div>
              </div>

              {/* 3. Location Verification */}
              <div
                style={{
                  background: 'rgba(5, 10, 20, 0.8)',
                  padding: '6px 4px',
                  borderRadius: 4,
                  border: '1px solid rgba(0, 229, 255, 0.15)',
                }}
              >
                <div style={{ fontSize: 7, color: '#64748b' }}>LOCATION</div>
                <div
                  style={{
                    fontSize: 8.5,
                    fontWeight: 800,
                    marginTop: 2,
                    color:
                      camera.location_verification === 'VERIFIED_LOCATION'
                        ? '#34d399'
                        : '#fbbf24',
                  }}
                >
                  {camera.location_verification === 'VERIFIED_LOCATION'
                    ? 'VERIFIED'
                    : 'UNVERIFIED'}
                </div>
              </div>

              {/* 4. Access Policy */}
              <div
                style={{
                  background: 'rgba(5, 10, 20, 0.8)',
                  padding: '6px 4px',
                  borderRadius: 4,
                  border: '1px solid rgba(0, 229, 255, 0.15)',
                }}
              >
                <div style={{ fontSize: 7, color: '#64748b' }}>ACCESS</div>
                <div
                  style={{
                    fontSize: 8.5,
                    fontWeight: 800,
                    marginTop: 2,
                    color:
                      camera.access_status === 'PUBLIC_OPEN'
                        ? '#34d399'
                        : camera.access_status === 'REQUIRES_ACCESS'
                        ? '#f59e0b'
                        : '#a78bfa',
                  }}
                >
                  {camera.access_status === 'PUBLIC_OPEN' ? 'OPEN' : 'GATED'}
                </div>
              </div>
            </div>

            {/* Probe Feedback Alert */}
            {probeResult && (
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.95)',
                  border: '1px solid #38bdf8',
                  padding: '6px 12px',
                  borderRadius: 4,
                  marginBottom: 10,
                  fontSize: 8.5,
                  color: '#38bdf8',
                  maxWidth: 440,
                }}
              >
                Hasil Probe: Status <strong>{probeResult.status}</strong> | Latensi:{' '}
                {probeResult.latency_ms || 0}ms |{' '}
                {probeResult.failure_reason || 'Pemeriksaan selesai.'}
              </div>
            )}

            {/* Interactive Probe Button */}
            <button
              onClick={handleRunProbe}
              disabled={isProbing}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 4,
                background: isProbing ? 'rgba(100,116,139,0.3)' : 'rgba(0, 229, 255, 0.15)',
                border: '1px solid rgba(0, 229, 255, 0.4)',
                color: '#00e5ff',
                fontSize: 9,
                fontWeight: 800,
                cursor: isProbing ? 'not-allowed' : 'pointer',
              }}
            >
              <span>{isProbing ? '⏳' : '🧪'}</span>
              <span>
                {isProbing ? 'MEMERIKSA JARINGAN SUMBER...' : 'UJI KONEKTIVITAS AKTUAL'}
              </span>
            </button>
          </div>
        )}

        {/* Loading Overlay */}
        {loading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(2, 4, 9, 0.8)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              zIndex: 15,
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                border: '2px solid rgba(0,229,255,0.2)',
                borderTopColor: '#00e5ff',
                animation: 'spin 1s linear infinite',
              }}
            />
            <span style={{ fontSize: 9, color: '#00e5ff' }}>
              CONNECTING TO OPTICAL STREAM...
            </span>
          </div>
        )}

        {/* Playback Error Overlay */}
        {playbackError && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.95)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
              textAlign: 'center',
              zIndex: 20,
            }}
          >
            <span style={{ fontSize: 22, marginBottom: 4 }}>⚠️</span>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#f87171' }}>
              {playbackError}
            </span>
            <span style={{ fontSize: 8.5, color: '#94a3b8', marginTop: 4 }}>
              Operator: {camera.operator}
            </span>
          </div>
        )}
      </div>

      {/* ── Footer Technical Bar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          background: 'rgba(5, 10, 20, 0.95)',
          borderTop: '1px solid rgba(0, 229, 255, 0.15)',
          fontSize: 8.5,
          color: '#64748b',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isVerifiedPlayable && (
            <>
              <button
                onClick={togglePlay}
                style={{
                  background: 'rgba(0, 229, 255, 0.1)',
                  border: '1px solid rgba(0, 229, 255, 0.3)',
                  color: '#00e5ff',
                  borderRadius: 3,
                  padding: '2px 8px',
                  cursor: 'pointer',
                  fontSize: 8.5,
                  fontWeight: 700,
                }}
              >
                {isPlaying ? '⏸ PAUSE' : '▶ PLAY'}
              </button>
              <button
                onClick={toggleMute}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#cbd5e1',
                  borderRadius: 3,
                  padding: '2px 8px',
                  cursor: 'pointer',
                  fontSize: 8.5,
                }}
              >
                {isMuted ? '🔇 MUTED' : '🔊 AUDIO'}
              </button>
            </>
          )}

          <span>
            OPERATOR: <strong style={{ color: '#e2e8f0' }}>{camera.operator}</strong>
          </span>
          <span>|</span>
          <span>
            KOORDINAT: <strong style={{ color: '#38bdf8' }}>{camera.latitude}, {camera.longitude}</strong>
          </span>
        </div>

        <div style={{ color: '#94a3b8' }}>
          INTEGRITY: <span style={{ color: '#38bdf8' }}>AUDIT VERIFIED</span>
        </div>
      </div>
    </div>
  );
}
