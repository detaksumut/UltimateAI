import React, { useRef, useEffect } from 'react';

export default function OuterOrbitalDustCanvas({ colorHex = '#00f2fe' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animId;

    const w = canvas.offsetWidth || 240;
    const h = canvas.offsetHeight || 160;

    canvas.width = w * window.devicePixelRatio;
    canvas.height = h * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const centerX = w / 2;
    const centerY = h / 2 + 10;

    // Generate 14 outer orbital dust particles (optimized for 60fps)
    const particleCount = 14;
    const particles = Array.from({ length: particleCount }).map((_, i) => {
      return {
        angle: (i / particleCount) * Math.PI * 2 + Math.random() * 0.5,
        speed: 0.012 + (i % 2) * 0.006,
        rx: (w * 0.38) + (i % 3) * 6,
        ry: (h * 0.28) + (i % 2) * 8,
        tilt: 0.45 + (i % 2) * 0.35,
        size: 1.4 + (i % 2) * 1.0,
        isWhite: i % 3 === 0,
        trailLength: 4,
        trail: []
      };
    });

    let lastRenderTime = 0;
    const frameInterval = 1000 / 30; // 30 FPS throttle

    const render = (currentTime) => {
      animId = requestAnimationFrame(render);
      if (document.hidden) return;

      const elapsed = currentTime - lastRenderTime;
      if (elapsed < frameInterval) return;
      lastRenderTime = currentTime - (elapsed % frameInterval);

      ctx.clearRect(0, 0, w, h);

      particles.forEach((p) => {
        p.angle += p.speed;

        // Calculate 3D orbital projection
        const cosA = Math.cos(p.angle);
        const sinA = Math.sin(p.angle);

        const x3d = cosA * p.rx;
        const y3d = sinA * p.ry;
        const z3d = -sinA * (p.rx * 0.35); // Depth coordinate

        // Rotate by tilt angle
        const screenX = centerX + x3d * Math.cos(p.tilt) - y3d * Math.sin(p.tilt);
        const screenY = centerY + x3d * Math.sin(p.tilt) + y3d * Math.cos(p.tilt);

        // Depth scale & opacity
        const depthNorm = (z3d + 50) / 100;
        const alpha = Math.max(0.15, Math.min(0.85, 0.25 + depthNorm * 0.6));
        const currentSize = Math.max(1.0, p.size * (0.7 + depthNorm * 0.5));

        // Save trail history
        if (!p.trail) p.trail = [];
        p.trail.push({ x: screenX, y: screenY, alpha });
        if (p.trail.length > (p.trailLength || 4)) {
          p.trail.shift();
        }

        // Draw particle motion trail
        if (p.trail.length > 1) {
          ctx.beginPath();
          ctx.moveTo(p.trail[0].x, p.trail[0].y);
          for (let t = 1; t < p.trail.length; t++) {
            ctx.lineTo(p.trail[t].x, p.trail[t].y);
          }
          ctx.strokeStyle = p.isWhite ? `rgba(255, 255, 255, ${alpha * 0.35})` : `${colorHex}${Math.round(alpha * 60).toString(16).padStart(2, '0')}`;
          ctx.lineWidth = currentSize * 0.5;
          ctx.stroke();
        }

        // Draw glowing particle spark
        const sparkGrad = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, currentSize * 2.2);
        if (p.isWhite) {
          sparkGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
          sparkGrad.addColorStop(0.4, `rgba(255, 255, 255, ${alpha * 0.7})`);
          sparkGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        } else {
          sparkGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
          sparkGrad.addColorStop(0.35, `${colorHex}${Math.round(alpha * 200).toString(16).padStart(2, '0')}`);
          sparkGrad.addColorStop(1, `${colorHex}00`);
        }

        ctx.fillStyle = sparkGrad;
        ctx.beginPath();
        ctx.arc(screenX, screenY, currentSize * 2.2, 0, Math.PI * 2);
        ctx.fill();

        // Core bright dot
        ctx.fillStyle = p.isWhite ? `rgba(255, 255, 255, ${alpha})` : `rgba(255, 255, 255, ${alpha * 0.9})`;
        ctx.beginPath();
        ctx.arc(screenX, screenY, currentSize * 0.6, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [colorHex]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-20"
    />
  );
}
