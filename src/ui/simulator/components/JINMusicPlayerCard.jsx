/**
 * JINMusicPlayerCard.jsx
 * Interactive Futuristic Cyberpunk Online Music Player for JIN Conversation Canvas.
 * Supports curated royalty-free online streams (Lo-Fi, Synthwave Plaza, Ambient, Piano Coding)
 * and custom user-provided MP3/Audio streaming URLs with live neon equalizer visualizer.
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, 
  Music, Radio, Disc3, Link, Check, Sparkles, ExternalLink
} from 'lucide-react';

export const CURATED_PLAYLIST = [
  {
    id: 'prambors-fm',
    title: 'Prambors FM 102.2',
    artist: 'Hits Pop Indonesia & Dunia',
    genre: 'Radio Live',
    url: 'https://masima.sytes.net/prambors',
    isLive: true
  },
  {
    id: 'elshinta-fm',
    title: 'Radio Elshinta 90.0 FM',
    artist: 'Berita & Info Terkini 24 Jam',
    genre: 'News Radio',
    url: 'https://stream.elshinta.com/live',
    isLive: true
  },
  {
    id: 'rri-pro3',
    title: 'RRI Pro 3 Nasional',
    artist: 'Jaringan Berita Suara Nusantara',
    genre: 'Nasional',
    url: 'https://stream-node1.rri.co.id/streaming/33/9033/rripro3.mp3',
    isLive: true
  },
  {
    id: 'delta-fm',
    title: 'Delta FM',
    artist: '100% Lagu Enak & Relaxing',
    genre: 'Pop Hits',
    url: 'https://masima.sytes.net/delta',
    isLive: true
  },
  {
    id: 'lofi-beats',
    title: 'Lo-Fi Chillhop Study',
    artist: 'Chillout 24/7 Live Stream',
    genre: 'Lo-Fi',
    url: 'https://stream.zeno.fm/f3wvbbqmdg8uv',
    isLive: true
  },
  {
    id: 'synthwave-plaza',
    title: 'Nightwave Plaza Synth',
    artist: 'Plaza One Broadcast',
    genre: 'Synthwave',
    url: 'https://radio.plaza.one/mp3',
    isLive: true
  }
];

export default function JINMusicPlayerCard({ initialTrackIndex = 0, autoPlay = false, customUrl = '', trackTitle = '', artist = '' }) {
  const [currentTrackIdx, setCurrentTrackIdx] = useState(initialTrackIndex);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [volume, setVolume] = useState(0.75);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [customInputUrl, setCustomInputUrl] = useState(customUrl || '');
  const [activeUrl, setActiveUrl] = useState(customUrl || CURATED_PLAYLIST[initialTrackIndex]?.url);
  const [errorMsg, setErrorMsg] = useState(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [localFTracks, setLocalFTracks] = useState([]);
  const [activeSource, setActiveSource] = useState(customUrl ? 'drive_f' : 'preset');

  const audioRef = useRef(null);

  // Fetch real tracks from physical Drive F:
  const fetchLocalTracks = async () => {
    try {
      const res = await fetch('/api/media/local-tracks?folder=F:\\musik').then(r => r.json()).catch(() => null);
      if (res?.tracks && res.tracks.length > 0) {
        setLocalFTracks(res.tracks);
      }
    } catch {}
  };

  useEffect(() => {
    fetchLocalTracks();
  }, []);

  // Initialize and bind HTML5 Audio instance
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    audio.crossOrigin = 'anonymous';
    audio.volume = volume;

    const onPlay = () => {
      setIsPlaying(true);
      setIsLoading(false);
      setErrorMsg(null);
    };

    const onPause = () => {
      setIsPlaying(false);
    };

    const onWaiting = () => {
      setIsLoading(true);
    };

    const onCanPlay = () => {
      setIsLoading(false);
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (!isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const onLoadedMetadata = () => {
      if (!isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const onError = (e) => {
      setIsLoading(false);
      setIsPlaying(false);
      console.warn('[JINMusicPlayer] Audio stream warning/error:', e);
      // If live stream encounters an issue, inform user gracefully
      setErrorMsg('Koneksi audio terhambat. Anda dapat mencoba stasiun lain atau memutar link URL MP3.');
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('error', onError);

    // Initial load
    if (activeUrl) {
      audio.src = activeUrl;
      if (autoPlay) {
        audio.play().catch(() => {
          // Autoplay policy requires user gesture
          setIsPlaying(false);
        });
      }
    }

    return () => {
      audio.pause();
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('error', onError);
      audio.src = '';
    };
  }, []);

  // Update track or URL when activeUrl changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !activeUrl) return;

    audio.src = activeUrl;
    setErrorMsg(null);
    setIsLoading(true);
    if (isPlaying) {
      audio.play().catch(() => setIsPlaying(false));
    }
  }, [activeUrl]);

  // Volume & Mute handling
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      setIsLoading(true);
      setErrorMsg(null);
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        setIsPlaying(false);
        setIsLoading(false);
        setErrorMsg('Klik play kembali atau pilih track lain.');
      });
    }
  };

  const handleSelectTrack = (idx) => {
    setCurrentTrackIdx(idx);
    const track = CURATED_PLAYLIST[idx];
    if (track) {
      setActiveUrl(track.url);
      setIsPlaying(true);
      if (audioRef.current) {
        audioRef.current.src = track.url;
        audioRef.current.play().catch(() => setIsPlaying(false));
      }
    }
  };

  const handleNextTrack = () => {
    const nextIdx = (currentTrackIdx + 1) % CURATED_PLAYLIST.length;
    handleSelectTrack(nextIdx);
  };

  const handlePrevTrack = () => {
    const prevIdx = (currentTrackIdx - 1 + CURATED_PLAYLIST.length) % CURATED_PLAYLIST.length;
    handleSelectTrack(prevIdx);
  };

  const handleCustomUrlSubmit = (e) => {
    e.preventDefault();
    const clean = customInputUrl.trim();
    if (!clean) return;

    setActiveUrl(clean);
    setIsPlaying(true);
    if (audioRef.current) {
      audioRef.current.src = clean;
      audioRef.current.play().catch(() => setIsPlaying(false));
    }
    setShowUrlInput(false);
  };

  const handleSeek = (e) => {
    const target = Number(e.target.value);
    if (audioRef.current && isFinite(duration) && duration > 0) {
      audioRef.current.currentTime = target;
      setCurrentTime(target);
    }
  };

  const formatTime = (secs) => {
    if (isNaN(secs) || !isFinite(secs) || secs === 0) return '--:--';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const currentTrack = CURATED_PLAYLIST[currentTrackIdx] || {
    title: 'Custom Audio Stream',
    artist: 'Direct Online URL',
    genre: 'Stream'
  };

  return (
    <div className="jin-music-player-card my-3 p-3.5 rounded-lg border border-cyan-500/40 bg-gradient-to-b from-[#060c1d]/95 via-[#030712]/95 to-[#040817]/95 shadow-[0_4px_24px_rgba(0,229,255,0.15)] text-slate-100 font-sans relative overflow-hidden select-none">
      {/* Subtle top neon scanner glow */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#00e5ff] to-transparent animate-pulse" />

      {/* Header Bar */}
      <div className="flex items-center justify-between pb-2 border-b border-cyan-500/20 mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-cyan-400 animate-ping' : 'bg-slate-500'}`} />
          <span className="text-[11px] font-mono font-bold tracking-wider text-cyan-300 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            JIN :: NEURAL AUDIO PLAYER
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[9.5px] font-mono font-bold border border-cyan-400/30 text-cyan-300 bg-cyan-950/40">
            {currentTrack.genre || 'ONLINE STREAM'}
          </span>
          <button
            onClick={() => setShowUrlInput(!showUrlInput)}
            className="p-1 rounded text-cyan-400/70 hover:text-cyan-300 hover:bg-cyan-950/60 transition-colors"
            title="Masukkan URL audio kustom"
          >
            <Link className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {showUrlInput && (
        <form onSubmit={handleCustomUrlSubmit} className="mb-3 p-2 rounded bg-cyan-950/30 border border-cyan-500/30 flex items-center gap-2">
          <input
            type="url"
            value={customInputUrl}
            onChange={(e) => setCustomInputUrl(e.target.value)}
            placeholder="Tempel URL MP3 / stream audio (https://...)"
            className="flex-1 bg-[#02050e] border border-cyan-500/30 rounded px-2.5 py-1 text-[11px] text-cyan-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
          />
          <button
            type="submit"
            className="px-2.5 py-1 rounded bg-cyan-500 hover:bg-cyan-400 text-[#040711] font-bold text-[10.5px] font-mono transition-colors flex items-center gap-1"
          >
            <Check className="w-3 h-3" />
            <span>Putar</span>
          </button>
        </form>
      )}

      {/* Main Track Info & Visualizer Section */}
      <div className="flex items-center gap-3.5 mb-3">
        {/* Vinyl / Hologram Disc Indicator */}
        <div className="relative w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-full bg-gradient-to-tr from-cyan-950 via-slate-900 to-cyan-900 border border-cyan-400/50 shadow-[0_0_15px_rgba(0,229,255,0.25)]">
          <Disc3 className={`w-7 h-7 text-cyan-300 ${isPlaying ? 'animate-[spin_4s_linear_infinite]' : ''}`} />
          <div className="absolute w-2 h-2 rounded-full bg-cyan-400" />
        </div>

        {/* Track Title & Artist */}
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-bold text-slate-100 truncate tracking-wide flex items-center gap-1.5">
            <span>{currentTrack.title}</span>
            {currentTrack.isLive && (
              <span className="px-1.5 py-0.2 rounded text-[8.5px] font-mono font-bold bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse">
                LIVE
              </span>
            )}
          </div>
          <div className="text-[10.5px] text-cyan-400/80 font-mono truncate">
            {currentTrack.artist}
          </div>

          {/* Procedural Equalizer Waves */}
          <div className="flex items-end gap-1 h-3.5 mt-1.5">
            {[40, 75, 25, 90, 60, 100, 45, 80, 30, 95, 70, 50, 85, 35].map((defaultHeight, i) => (
              <span
                key={i}
                className="w-1 rounded-sm bg-gradient-to-t from-cyan-500 to-cyan-300 transition-all duration-150"
                style={{
                  height: isPlaying ? `${Math.max(15, (defaultHeight + ((i * 17) % 40)) % 100)}%` : '20%',
                  opacity: isPlaying ? 0.9 : 0.35,
                  boxShadow: isPlaying ? '0 0 6px rgba(0,229,255,0.6)' : 'none'
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Duration Bar (For finite audio tracks) */}
      {!currentTrack.isLive && duration > 0 && (
        <div className="mb-2">
          <div className="flex justify-between text-[9px] font-mono text-slate-400 mb-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <input
            type="range"
            min="0"
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1 bg-cyan-950 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>
      )}

      {/* Controls Bar */}
      <div className="flex items-center justify-between pt-1">
        {/* Track Switchers & Play Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevTrack}
            className="p-1.5 rounded-full text-slate-300 hover:text-cyan-300 hover:bg-cyan-950/60 transition-colors"
            title="Track Sebelumnya"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={togglePlay}
            disabled={isLoading}
            className="p-2 rounded-full bg-cyan-500 hover:bg-cyan-400 active:scale-95 text-[#040711] shadow-[0_0_12px_rgba(0,229,255,0.6)] transition-all flex items-center justify-center"
            title={isPlaying ? 'Jeda' : 'Putar'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={handleNextTrack}
            className="p-1.5 rounded-full text-slate-300 hover:text-cyan-300 hover:bg-cyan-950/60 transition-colors"
            title="Track Berikutnya"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Volume Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="text-slate-400 hover:text-cyan-300 transition-colors p-1"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-3.5 h-3.5 text-red-400" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              setVolume(Number(e.target.value));
              setIsMuted(false);
            }}
            className="w-14 h-1 bg-cyan-950 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
          />
        </div>
      </div>

      {/* Station Quick Preset Buttons */}
      <div className="mt-2.5 pt-2 border-t border-cyan-500/20 flex flex-wrap items-center gap-1.5">
        <span className="text-[9px] font-mono text-cyan-400/60 tracking-wider mr-1">STATIONS:</span>
        {CURATED_PLAYLIST.map((t, idx) => (
          <button
            key={t.id}
            onClick={() => {
              setActiveSource('preset');
              handleSelectTrack(idx);
            }}
            className={`px-2 py-0.5 rounded text-[9.5px] font-mono transition-all ${
              currentTrackIdx === idx && activeSource === 'preset'
                ? 'bg-cyan-500 text-[#040711] font-bold shadow-[0_0_8px_rgba(0,229,255,0.4)]'
                : 'bg-cyan-950/40 text-slate-300 hover:bg-cyan-900/60 hover:text-cyan-200 border border-cyan-500/20'
            }`}
          >
            {t.genre}
          </button>
        ))}

        {/* Dynamic Drive F: Physical Storage Button */}
        <button
          onClick={() => {
            fetchLocalTracks();
            if (localFTracks.length > 0) {
              const first = localFTracks[0];
              setActiveSource('drive_f');
              setActiveUrl(first.url);
              setIsPlaying(true);
              if (audioRef.current) {
                audioRef.current.src = first.url;
                audioRef.current.play().catch(() => setIsPlaying(false));
              }
            } else {
              setErrorMsg('Belum ada file musik di F:\\musik. Minta JIN untuk mengisi lagu ke F:\\musik!');
            }
          }}
          className={`px-2 py-0.5 rounded text-[9.5px] font-mono font-bold transition-all flex items-center gap-1 ${
            activeSource === 'drive_f'
              ? 'bg-emerald-500 text-[#040711] shadow-[0_0_10px_rgba(16,185,129,0.5)]'
              : 'bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60 border border-emerald-500/30'
          }`}
          title="Putar musik dari direktori fisik Drive F:\musik"
        >
          <span>DRIVE F:\</span>
          {localFTracks.length > 0 && <span className="text-[8px] px-1 rounded bg-black/40">({localFTracks.length})</span>}
        </button>
      </div>

      {/* Error / Warning Notice if stream is interrupted */}
      {errorMsg && (
        <div className="mt-2 px-2 py-1 rounded bg-red-950/40 border border-red-500/30 text-[9.5px] text-red-300 font-mono">
          {errorMsg}
        </div>
      )}
    </div>
  );
}
