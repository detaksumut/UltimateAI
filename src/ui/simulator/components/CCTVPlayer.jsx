/**
 * CCTVPlayer.jsx
 * JINI — PalantirIndonesia Intelligence
 * Tactical Multi-Protocol CCTV Video & Image Stream Player
 */
import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

export default function CCTVPlayer({ camera, onClose, onFullscreen }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const timerRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [playbackError, setPlaybackError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liveClock, setLiveClock] = useState('');
  const [snapshotCount, setSnapshotCount] = useState(0);
  const [imageTimestamp, setImageTimestamp] = useState(Date.now());
  const [countdown, setCountdown] = useState(camera?.refresh_interval_sec || 3);

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

  // Stream Player Setup (HLS / MP4 / Image Refresh)
  useEffect(() => {
    if (!camera) return;
    setPlaybackError(null);
    setLoading(true);

    const protocol = camera.stream_protocol;
    const streamUrl = camera.source_url;

    // Mode 1: HLS Stream (.m3u8)
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
          backBufferLength: 60,
        });
        hlsRef.current = hls;

        hls.loadSource(streamUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setLoading(false);
          video.play().catch(() => {});
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                setPlaybackError('Koneksi jaringan stream HLS terputus.');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                setPlaybackError('Media buffer error, mencoba pemulihan...');
                hls.recoverMediaError();
                break;
              default:
                setPlaybackError('Stream HLS tidak dapat dimuat atau offline.');
                hls.destroy();
                break;
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native Safari/iOS support
        video.src = streamUrl;
        video.addEventListener('loadedmetadata', () => {
          setLoading(false);
          video.play().catch(() => {});
        });
        video.addEventListener('error', () => {
          setPlaybackError('Gagal memuat native stream HLS.');
        });
      } else {
        setPlaybackError('Browser tidak mendukung pemutaran HLS live stream.');
      }
    }

    // Mode 2: Direct MP4 / WebM Video
    else if (protocol === 'MP4_STREAM') {
      const video = videoRef.current;
      if (video) {
        video.src = streamUrl;
        video.onloadeddata = () => setLoading(false);
        video.onerror = () => setPlaybackError('Video stream MP4 tidak dapat diakses.');
        video.play().catch(() => {});
      }
    }

    // Mode 3: Image Polling (Periodic Snapshot Refresh)
    else if (protocol === 'IMAGE_REFRESH') {
      setLoading(false);
      const intervalSec = camera.refresh_interval_sec || 3;
      setCountdown(intervalSec);

      if (timerRef.current) clearInterval(timerRef.current);

      timerRef.current = setInterval(() => {
        setImageTimestamp(Date.now());
        setSnapshotCount((c) => c + 1);
      }, intervalSec * 1000);
    }

    // Mode 4: Gated or requires internal authorization
    else if (camera.access_status === 'REQUIRES_ACCESS') {
      setLoading(false);
      setPlaybackError('AKSES TERBATAS: Kamera berada dalam jaringan tertutup / VPN instansi.');
    } else {
      setLoading(false);
    }

    return () => {
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch (_) {}
        hlsRef.current = null;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [camera]);

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

  const handleManualRefresh = () => {
    setImageTimestamp(Date.now());
    setSnapshotCount((c) => c + 1);
  };

  if (!camera) return null;

  const isImagePolling = camera.stream_protocol === 'IMAGE_REFRESH';
  const isEmbedPortal = camera.stream_protocol === 'EMBED_PORTAL';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: '#040812',
        border: '1px solid rgba(0, 229, 255, 0.3)',
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 0 24px rgba(0, 229, 255, 0.15)',
        position: 'relative',
      }}
    >
      {/* ── Player Header Bar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          background: 'linear-gradient(90deg, rgba(0, 229, 255, 0.1) 0%, rgba(0,0,0,0) 100%)',
          borderBottom: '1px solid rgba(0, 229, 255, 0.2)',
          fontFamily: 'monospace',
          fontSize: 9.5,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: camera.stream_status === 'ONLINE' ? '#10b981' : '#ef4444',
              boxShadow: camera.stream_status === 'ONLINE' ? '0 0 8px #10b981' : 'none',
            }}
          />
          <span style={{ fontWeight: 800, color: '#00e5ff' }}>
            {camera.camera_id} // {camera.camera_name}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8' }}>
          <span style={{ color: '#38bdf8' }}>{liveClock}</span>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#f87171',
                cursor: 'pointer',
                fontWeight: 900,
                fontSize: 12,
              }}
              title="Tutup Pemutar"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Screen Canvas / Viewport ── */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 220,
          background: '#020409',
          display: 'flex',
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

        {/* Video Element for HLS / MP4 */}
        {!isImagePolling && !isEmbedPortal && (
          <video
            ref={videoRef}
            playsInline
            autoPlay
            muted={isMuted}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}

        {/* Image Refresh Polling */}
        {isImagePolling && (
          <img
            src={`${camera.source_url}?_t=${imageTimestamp}`}
            alt={camera.camera_name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={() => setPlaybackError('Snapshot gagal dimuat.')}
          />
        )}

        {/* Embed Portal / Iframe */}
        {isEmbedPortal && (
          <iframe
            src={camera.source_url}
            title={camera.camera_name}
            sandbox="allow-scripts allow-same-origin allow-forms"
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        )}

        {/* Loading Spinner */}
        {loading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(2, 4, 9, 0.75)',
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
                width: 24,
                height: 24,
                borderRadius: '50%',
                border: '2px solid rgba(0,229,255,0.2)',
                borderTopColor: '#00e5ff',
                animation: 'spin 1s linear infinite',
              }}
            />
            <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#00e5ff' }}>
              CONNECTING TO OPTICAL STREAM...
            </span>
          </div>
        )}

        {/* Error / Offline Alert */}
        {playbackError && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.92)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
              textAlign: 'center',
              zIndex: 20,
            }}
          >
            <span style={{ fontSize: 24, marginBottom: 4 }}>⚠️</span>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#f87171', fontFamily: 'monospace' }}>
              {playbackError}
            </span>
            <span style={{ fontSize: 8.5, color: '#94a3b8', marginTop: 4, fontFamily: 'monospace' }}>
              Operator: {camera.operator}
            </span>
          </div>
        )}

        {/* Top-Right HUD Badge */}
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 12,
            padding: '2px 6px',
            borderRadius: 3,
            background: 'rgba(0,0,0,0.65)',
            border: '1px solid rgba(0,229,255,0.3)',
            fontFamily: 'monospace',
            fontSize: 8,
            color: '#34d399',
            zIndex: 12,
            letterSpacing: '0.05em',
          }}
        >
          {isImagePolling ? `SNAPSHOT #${snapshotCount}` : `${camera.fps || 25} FPS // ${camera.resolution || '720p'}`}
        </div>
      </div>

      {/* ── Player Control & Attribution Strip ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          background: 'rgba(5, 10, 20, 0.9)',
          borderTop: '1px solid rgba(0, 229, 255, 0.15)',
          fontFamily: 'monospace',
          fontSize: 9,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {!isImagePolling && !isEmbedPortal && (
            <>
              <button
                onClick={togglePlay}
                style={{
                  background: 'rgba(0, 229, 255, 0.1)',
                  border: '1px solid rgba(0, 229, 255, 0.3)',
                  color: '#00e5ff',
                  borderRadius: 4,
                  padding: '2px 8px',
                  cursor: 'pointer',
                  fontSize: 9,
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
                  borderRadius: 4,
                  padding: '2px 8px',
                  cursor: 'pointer',
                  fontSize: 9,
                }}
              >
                {isMuted ? '🔇 MUTED' : '🔊 AUDIO'}
              </button>
            </>
          )}

          {isImagePolling && (
            <button
              onClick={handleManualRefresh}
              style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid #10b981',
                color: '#34d399',
                borderRadius: 4,
                padding: '2px 8px',
                cursor: 'pointer',
                fontSize: 8.5,
                fontWeight: 700,
              }}
            >
              🔄 REFRESH ({camera.refresh_interval_sec || 3}s)
            </button>
          )}

          <span style={{ color: '#64748b', fontSize: 8 }}>
            PROTOKOL: <strong style={{ color: '#38bdf8' }}>{camera.stream_protocol}</strong>
          </span>
        </div>

        <div style={{ color: '#94a3b8', fontSize: 8 }}>
          SUMBER: {camera.source_attribution || camera.operator}
        </div>
      </div>
    </div>
  );
}
