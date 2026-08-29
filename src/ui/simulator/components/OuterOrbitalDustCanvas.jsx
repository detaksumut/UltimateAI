import React, { useRef, useEffect } from 'react';

export default function OuterOrbitalDustCanvas({ colorHex = '#00f2fe' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animId;

    // Handle high DPI
    const size = 260;
    canvas.width = size * window.devicePixelRatio;
    canvas.height = size * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const centerX = size / 2;
    const centerY = size / 2;

    // Generate 36 outer orbital dust particles with various 3D orbital planes
    const particleCount = 36;
    const particles = Array.from({ length: particleCount }).map((_, i) => {
      return {
        angle: (i / particleCount) * Math.PI * 2 + Math.random() * 0.5,
        speed: 0.012 + (i % 3) * 0.006 + Math.random() * 0.005,
        rx: 105 + (i % 4) * 8 + Math.random() * 10, // Orbit radius X
        ry: 60 + (i % 3) * 12 + Math.random() * 8,  // Orbit radius Y (elliptical)
        tilt: 0.45 + (i % 3) * 0.35,                // 3D Orbital tilt angle
        size: 1.5 + (i % 3) * 1.2,
        isWhite: i % 4 === 0,                       // 25% are bright white quantum sparks
        trailLength: 4 + (i % 3) * 3,
        trail: []
      };
    });

    const render = () => {
      ctx.clearRect(0, 0, size, size);

      particles.forEach((p) => {
        p.angle += p.speed;

        // Calculate 3D orbital projection
        const cosA = Math.cos(p.angle);
        const sinA = Math.sin(p.angle);

        const x3d = cosA * p.rx;
        const y3d = sinA * p.ry;
        const z3d = -sinA * (p.rx * 0.4); // Depth coordinate

        // Rotate by tilt angle
        const screenX = centerX + x3d * Math.cos(p.tilt) - y3d * Math.sin(p.tilt);
        const screenY = centerY + x3d * Math.sin(p.tilt) + y3d * Math.cos(p.tilt);

        // Depth scale & opacity (brighter & larger when in front of orb)
        const depthNorm = (z3d + 60) / 120; // 0 (back) to 1 (front)
        const alpha = Math.max(0.2, Math.min(0.95, 0.3 + depthNorm * 0.65));
        const currentSize = Math.max(1.0, p.size * (0.7 + depthNorm * 0.6));

        // Save trail history
        p.trail.push({ x: screenX, y: screenY, alpha });
        if (p.trail.length > p.trailLength) {
          p.trail.shift();
        }

        // Draw particle motion trail
        if (p.trail.length > 1) {
          ctx.beginPath();
          ctx.moveTo(p.trail[0].x, p.trail[0].y);
          for (let t = 1; t < p.trail.length; t++) {
            ctx.lineTo(p.trail[t].x, p.trail[t].y);
          }
          ctx.strokeStyle = p.isWhite ? `rgba(255, 255, 255, ${alpha * 0.4})` : `${colorHex}${Math.round(alpha * 70).toString(16).padStart(2, '0')}`;
          ctx.lineWidth = currentSize * 0.6;
          ctx.stroke();
        }

        // Draw glowing particle spark
        const sparkGrad = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, currentSize * 2.5);
        if (p.isWhite) {
          sparkGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
          sparkGrad.addColorStop(0.4, `rgba(255, 255, 255, ${alpha * 0.8})`);
          sparkGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        } else {
          sparkGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
          sparkGrad.addColorStop(0.35, `${colorHex}${Math.round(alpha * 220).toString(16).padStart(2, '0')}`);
          sparkGrad.addColorStop(1, `${colorHex}00`);
        }

        ctx.fillStyle = sparkGrad;
        ctx.beginPath();
        ctx.arc(screenX, screenY, currentSize * 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Core bright dot
        ctx.fillStyle = p.isWhite ? `rgba(255, 255, 255, ${alpha})` : `rgba(255, 255, 255, ${alpha * 0.9})`;
        ctx.beginPath();
        ctx.arc(screenX, screenY, currentSize * 0.7, 0, Math.PI * 2);
        ctx.fill();
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [colorHex]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-[-28px] w-[calc(100%+56px)] h-[calc(100%+56px)] pointer-events-none z-20"
      style={{ width: '260px', height: '260px' }}
    />
  );
}
