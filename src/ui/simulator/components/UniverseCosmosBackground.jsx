import React, { useRef, useEffect } from 'react';

export default function UniverseCosmosBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    let animId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    let mouseX = width / 2;
    let mouseY = height / 2;
    let targetMouseX = mouseX;
    let targetMouseY = mouseY;

    const handleMouseMove = (e) => {
      targetMouseX = e.clientX;
      targetMouseY = e.clientY;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize, { passive: true });

    // 1. Starfield Generation (Optimized 70 stars for CPU/iGPU smoothness)
    const starCount = 70;
    const stars = Array.from({ length: starCount }).map(() => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 1.5 + 0.5,
      depth: Math.random() * 0.7 + 0.3,
      alpha: Math.random() * 0.7 + 0.3,
      twinkleSpeed: Math.random() * 0.02 + 0.01,
      twinklePhase: Math.random() * Math.PI * 2,
      color:
        Math.random() > 0.75
          ? '#38bdf8'
          : Math.random() > 0.5
          ? '#c084fc'
          : '#ffffff'
    }));

    // 2. Deep Space Shooting Stars / Meteors System
    const meteors = [];
    const spawnMeteor = () => {
      const startX = Math.random() * width * 0.8;
      const startY = Math.random() * (height * 0.4);
      const angle = (Math.PI / 4) + (Math.random() - 0.5) * 0.3; // ~45 deg downward
      const speed = Math.random() * 8 + 12;
      const length = Math.random() * 120 + 80;

      meteors.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        length,
        alpha: 1.0,
        color: Math.random() > 0.5 ? '#00f2fe' : '#ffffff'
      });
    };

    // Spawn meteor every 4.5 seconds
    let meteorTimer = setInterval(spawnMeteor, 4500);

    // 3. Rotating Andromeda Spiral Galaxy (Optimized 75 particles)
    const galaxy = {
      x: width * 0.82,
      y: height * 0.28,
      rotation: 0,
      rotationSpeed: 0.0015,
      radius: 180,
      particleCount: 75
    };

    const galaxyParticles = Array.from({ length: galaxy.particleCount }).map((_, i) => {
      const arm = i % 2; // 2 spiral arms
      const dist = (i / galaxy.particleCount) * galaxy.radius + Math.random() * 15;
      const armOffset = arm * Math.PI;
      const spiralAngle = dist * 0.04 + armOffset;

      return {
        dist,
        angle: spiralAngle,
        size: Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.6 + 0.3,
        color: Math.random() > 0.6 ? '#38bdf8' : Math.random() > 0.3 ? '#c084fc' : '#ffffff'
      };
    });

    // 4. Distant Orbiting Gas Giant Celestial Planet with Rings
    const planet = {
      x: width * 0.15,
      y: height * 0.72,
      radius: 38,
      angle: 0,
      ringTilt: -0.35
    };

    // 5. Optimized 30 FPS Render Loop (CPU & iGPU Friendly)
    let lastRenderTime = 0;
    const frameInterval = 1000 / 30; // 30 FPS target for background saves 50% CPU

    const render = (currentTime) => {
      animId = requestAnimationFrame(render);

      // Pause when tab is backgrounded
      if (document.hidden) return;

      const elapsed = currentTime - lastRenderTime;
      if (elapsed < frameInterval) return;
      lastRenderTime = currentTime - (elapsed % frameInterval);

      ctx.clearRect(0, 0, width, height);

      // Smooth mouse parallax interpolation
      mouseX += (targetMouseX - mouseX) * 0.05;
      mouseY += (targetMouseY - mouseY) * 0.05;
      const offsetX = (mouseX - width / 2) * 0.025;
      const offsetY = (mouseY - height / 2) * 0.025;

      // A. Deep Universe Space Gradient Base
      const universeGrad = ctx.createLinearGradient(0, 0, width, height);
      universeGrad.addColorStop(0, '#040711');
      // B. Space Background Clear
      ctx.fillStyle = '#040711';
      ctx.fillRect(0, 0, width, height);

      // C. Rotating Andromeda Spiral Galaxy
      galaxy.rotation += galaxy.rotationSpeed;
      const gCenterX = galaxy.x + offsetX * 0.8;
      const gCenterY = galaxy.y + offsetY * 0.8;

      // Galaxy Core Glow
      const gCore = ctx.createRadialGradient(gCenterX, gCenterY, 0, gCenterX, gCenterY, 40);
      gCore.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
      gCore.addColorStop(0.3, 'rgba(0, 242, 254, 0.45)');
      gCore.addColorStop(0.7, 'rgba(168, 85, 247, 0.2)');
      gCore.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gCore;
      ctx.beginPath();
      ctx.arc(gCenterX, gCenterY, 40, 0, Math.PI * 2);
      ctx.fill();

      // Galaxy Spiral Arms Particles
      galaxyParticles.forEach((gp) => {
        const curAngle = gp.angle + galaxy.rotation;
        const px = gCenterX + Math.cos(curAngle) * gp.dist;
        const py = gCenterY + Math.sin(curAngle) * (gp.dist * 0.55); // Isometric elliptical squash

        ctx.fillStyle = gp.color;
        ctx.globalAlpha = gp.alpha;
        ctx.beginPath();
        ctx.arc(px, py, gp.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      });

      // D. Gas Giant Celestial Planet with Rings
      const pX = planet.x - offsetX * 0.6;
      const pY = planet.y - offsetY * 0.6;

      // Back Ring segment
      ctx.save();
      ctx.translate(pX, pY);
      ctx.rotate(planet.ringTilt);
      ctx.beginPath();
      ctx.ellipse(0, 0, 75, 18, 0, Math.PI, Math.PI * 2); // Top/Back half
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.35)';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();

      // Planet Body Sphere with Spherical Atmospheric Gradient
      const planetGrad = ctx.createRadialGradient(
        pX - planet.radius * 0.35,
        pY - planet.radius * 0.35,
        2,
        pX,
        pY,
        planet.radius
      );
      planetGrad.addColorStop(0, '#e0e7ff');
      planetGrad.addColorStop(0.4, '#6366f1');
      planetGrad.addColorStop(0.8, '#312e81');
      planetGrad.addColorStop(1, '#090d16');

      ctx.fillStyle = planetGrad;
      ctx.beginPath();
      ctx.arc(pX, pY, planet.radius, 0, Math.PI * 2);
      ctx.fill();

      // Front Ring segment (passing in front of planet)
      ctx.save();
      ctx.translate(pX, pY);
      ctx.rotate(planet.ringTilt);
      ctx.beginPath();
      ctx.ellipse(0, 0, 75, 18, 0, 0, Math.PI); // Bottom/Front half
      ctx.strokeStyle = 'rgba(192, 132, 252, 0.7)';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Second thin outer ring
      ctx.beginPath();
      ctx.ellipse(0, 0, 86, 21, 0, 0, Math.PI);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      // Atmospheric Corona Glow around Planet
      const pCorona = ctx.createRadialGradient(pX, pY, planet.radius * 0.9, pX, pY, planet.radius * 1.5);
      pCorona.addColorStop(0, 'rgba(99, 102, 241, 0.3)');
      pCorona.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = pCorona;
      ctx.beginPath();
      ctx.arc(pX, pY, planet.radius * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // E. Render Multi-Depth Starfield
      stars.forEach((s) => {
        s.twinklePhase += s.twinkleSpeed;
        const currentAlpha = Math.max(0.15, Math.min(1.0, s.alpha + Math.sin(s.twinklePhase) * 0.35));

        const sx = s.baseX + offsetX * s.depth;
        const sy = s.baseY + offsetY * s.depth;

        ctx.fillStyle = s.color;
        ctx.globalAlpha = currentAlpha;
        ctx.beginPath();
        ctx.arc(sx, sy, s.size, 0, Math.PI * 2);
        ctx.fill();

        // Cross diffraction spikes for bright pulsar stars
        if (s.size > 1.8 && currentAlpha > 0.8) {
          ctx.strokeStyle = s.color;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(sx - 4, sy);
          ctx.lineTo(sx + 4, sy);
          ctx.moveTo(sx, sy - 4);
          ctx.lineTo(sx, sy + 4);
          ctx.stroke();
        }

        ctx.globalAlpha = 1.0;
      });

      // F. Render Animated Shooting Stars / Meteors
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        m.x += m.vx;
        m.y += m.vy;
        m.alpha -= 0.022; // Fade out

        if (m.alpha <= 0 || m.x > width || m.y > height) {
          meteors.splice(i, 1);
          continue;
        }

        // Calculate tail start
        const tailX = m.x - (m.vx / Math.hypot(m.vx, m.vy)) * m.length;
        const tailY = m.y - (m.vy / Math.hypot(m.vx, m.vy)) * m.length;

        const meteorGrad = ctx.createLinearGradient(tailX, tailY, m.x, m.y);
        meteorGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        meteorGrad.addColorStop(0.7, `${m.color}${Math.round(m.alpha * 120).toString(16).padStart(2, '0')}`);
        meteorGrad.addColorStop(1, `rgba(255, 255, 255, ${m.alpha})`);

        ctx.strokeStyle = meteorGrad;
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(m.x, m.y);
        ctx.stroke();

        // Meteor Head Spark
        ctx.fillStyle = `rgba(255, 255, 255, ${m.alpha})`;
        ctx.beginPath();
        ctx.arc(m.x, m.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      clearInterval(meteorTimer);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
      style={{ background: '#040711' }}
    />
  );
}
