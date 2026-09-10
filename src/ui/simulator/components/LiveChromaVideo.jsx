import React, { useRef, useEffect } from 'react';

/**
 * LiveChromaVideo
 * Hardware-independent real-time alpha chroma-key canvas for video.
 * Bypasses Windows/Chromium DirectComposition video overlay limitations by
 * extracting video frames into a 2D canvas buffer and setting edge-connected black
 * background pixels to true alpha transparency (rgba(0,0,0,0)).
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
    if (!video || !src) return;

    let isMounted = true;

    const tryPlay = () => {
      if (!isMounted || !isPlaying) return;
      try {
        video.currentTime = 0;
      } catch (_) {}
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          // Suppress benign source loading or unmounted abort errors
          if (err.name !== 'AbortError' && err.name !== 'NotSupportedError') {
            console.warn('[LiveChromaVideo] Play deferred:', err.message);
          }
        });
      }
    };

    if (isPlaying) {
      if (video.readyState >= 2) {
        tryPlay();
      } else {
        video.addEventListener('canplay', tryPlay, { once: true });
      }
    } else {
      video.pause();
      try {
        video.currentTime = 0;
      } catch (_) {}
    }

    return () => {
      isMounted = false;
      video.removeEventListener('canplay', tryPlay);
    };
  }, [isPlaying, src]);

  // Real-time Chroma Key Canvas Loop
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let isCancelled = false;
    const isHellomaster2 = /hellomaster2\.mp4/i.test(src || '');
    const removeBackground = /hellomaster1\.mp4|hellomaster2\.mp4|jeannie/i.test(src || '');
    const backgroundBrightnessLimit = isHellomaster2 ? 24 : 150;
    const backgroundSaturationLimit = isHellomaster2 ? 0.16 : 0.42;

    const processCurrentVideoFrame = () => {
      if (video.readyState >= 2) {
        const width = video.videoWidth || 352;
        const height = video.videoHeight || 416;

        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }

        ctx.drawImage(video, 0, 0, width, height);
        if (!removeBackground) return;

        try {
          const imgData = ctx.getImageData(0, 0, width, height);
          const data = imgData.data;
          const pixelCount = width * height;
          const backgroundPixels = new Uint8Array(pixelCount);
          const pendingPixels = [];

          // Only remove dark pixels connected to the frame edge. This protects
          // dark details inside the avatar from being keyed out.
          for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
            const offset = pixelIndex * 4;
            const r = data[offset];
            const g = data[offset + 1];
            const b = data[offset + 2];
            const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
            const maxChannel = Math.max(r, g, b);
            const minChannel = Math.min(r, g, b);
            const saturation = maxChannel === 0 ? 0 : (maxChannel - minChannel) / maxChannel;
            const isBackgroundCandidate =
              brightness < backgroundBrightnessLimit && saturation < backgroundSaturationLimit;
            const pixelX = pixelIndex % width;
            const pixelY = Math.floor(pixelIndex / width);
            if (
              isBackgroundCandidate &&
              (pixelX === 0 || pixelY === 0 || pixelX === width - 1 || pixelY === height - 1)
            ) {
              backgroundPixels[pixelIndex] = 1;
              pendingPixels.push(pixelIndex);
            }
          }

          for (let cursor = 0; cursor < pendingPixels.length; cursor += 1) {
            const pixelIndex = pendingPixels[cursor];
            const pixelX = pixelIndex % width;
            const pixelY = Math.floor(pixelIndex / width);
            for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
              for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
                const neighborX = pixelX + offsetX;
                const neighborY = pixelY + offsetY;
                if (
                  neighborX < 0 ||
                  neighborY < 0 ||
                  neighborX >= width ||
                  neighborY >= height ||
                  (offsetX === 0 && offsetY === 0)
                ) {
                  continue;
                }
                const neighborIndex = neighborY * width + neighborX;
                if (backgroundPixels[neighborIndex]) continue;
                const neighborOffset = neighborIndex * 4;
                const neighborR = data[neighborOffset];
                const neighborG = data[neighborOffset + 1];
                const neighborB = data[neighborOffset + 2];
                const neighborBrightness = 0.299 * neighborR + 0.587 * neighborG + 0.114 * neighborB;
                const neighborMax = Math.max(neighborR, neighborG, neighborB);
                const neighborMin = Math.min(neighborR, neighborG, neighborB);
                const neighborSaturation =
                  neighborMax === 0 ? 0 : (neighborMax - neighborMin) / neighborMax;
                if (
                  neighborBrightness < backgroundBrightnessLimit &&
                  neighborSaturation < backgroundSaturationLimit
                ) {
                  backgroundPixels[neighborIndex] = 1;
                  pendingPixels.push(neighborIndex);
                }
              }
            }
          }

          const total = data.length;
          for (let i = 0; i < total; i += 4) {
            const pixelIndex = i / 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
            if (backgroundPixels[pixelIndex] || brightness < 20) {
              data[i + 3] = 0;
              continue;
            }

            // Soft mist fade at the very bottom waist (last 12% of height)
            const y = Math.floor(pixelIndex / width);
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
  }, [src]);

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
