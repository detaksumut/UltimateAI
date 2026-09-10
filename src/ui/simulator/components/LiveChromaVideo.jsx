import React, { useRef, useEffect } from 'react';

/**
 * LiveChromaVideo
 * Hardware-independent real-time alpha chroma-key canvas for video.
 * Bypasses Windows/Chromium DirectComposition video overlay limitations by
 * extracting video frames into a 2D canvas buffer and setting black background pixels
 * to true alpha transparency (rgba(0,0,0,0)).
 */
export default function LiveChromaVideo({
  src,
  isPlaying,
  isMuted = true,
  isLoop = true,
  isNodding = false,
  onEnded,
  className = '',
  style = {}
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  // Sync video play/pause state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.currentTime = 0;
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('[LiveChromaVideo] Autoplay prevented:', err);
        });
      }
    } else {
      video.pause();
      try {
        video.currentTime = 0;
      } catch (_) {}
    }
  }, [isPlaying, src]);

  // Real-time Chroma Key Canvas Loop
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let isCancelled = false;

    const processCurrentVideoFrame = () => {
      if (video.readyState >= 2) {
        const width = video.videoWidth || 352;
        const height = video.videoHeight || 416;

        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }

        ctx.drawImage(video, 0, 0, width, height);

        try {
          const imgData = ctx.getImageData(0, 0, width, height);
          const data = imgData.data;
          const total = data.length;

          // Process each pixel: key out pure and near-black background
          for (let i = 0; i < total; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Perceptual brightness
            const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

            if (brightness < 28) {
              // 100% Transparent
              data[i + 3] = 0;
            } else if (brightness < 55) {
              // Soft anti-aliased edge
              const factor = (brightness - 28) / 27;
              data[i + 3] = Math.round(factor * 255);
            }

            // Soft mist fade at the very bottom waist (last 12% of height)
            const y = Math.floor(i / 4 / width);
            if (y > height * 0.88 && data[i + 3] > 0) {
              const bottomFactor = (height - y) / (height * 0.12);
              data[i + 3] = Math.min(data[i + 3], Math.round(bottomFactor * 255));
            }
          }

          ctx.putImageData(imgData, 0, 0);
        } catch (e) {
          // Fallback if cross-origin taint or canvas read error
        }
      }
    };

    const renderFrame = () => {
      if (isCancelled) return;
      if (video.readyState >= 2 && !video.paused && !video.ended) {
        processCurrentVideoFrame();
      }
      animFrameRef.current = requestAnimationFrame(renderFrame);
    };

    animFrameRef.current = requestAnimationFrame(renderFrame);

    // Also draw frame 0 whenever video rewinds back to start
    const handleSeeked = () => {
      processCurrentVideoFrame();
    };
    video.addEventListener('seeked', handleSeeked);

    return () => {
      isCancelled = true;
      video.removeEventListener('seeked', handleSeeked);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  return (
    <div className={`relative w-full h-full flex items-center justify-center ${className}`}>
      {/* Hidden native video source */}
      <video
        ref={videoRef}
        src={src}
        playsInline
        muted={isMuted}
        loop={isLoop}
        onEnded={onEnded}
        style={{ display: 'none' }}
      />

      {/* Visible transparent Canvas with True Alpha Background */}
      <canvas
        ref={canvasRef}
        className={`w-full h-full object-contain select-none pointer-events-none transition-all duration-300 ${
          isNodding ? 'jeannie-head-nod' : ''
        }`}
        style={{
          filter:
            'drop-shadow(0 0 18px rgba(244, 63, 94, 0.95)) drop-shadow(0 0 38px rgba(0, 229, 255, 0.75)) brightness(1.08)',
          ...style
        }}
      />
    </div>
  );
}
