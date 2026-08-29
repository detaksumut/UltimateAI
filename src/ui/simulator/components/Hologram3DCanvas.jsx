import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

export default function Hologram3DCanvas({ type, colorHex, isHovered = false }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 240;
    const height = container.clientHeight || 200;

    // 1. Scene & Camera Setup (Enlarged 3D Icons Floating Centered in Crystal Sphere)
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(0.0, 0.38, 3.2);
    camera.lookAt(0.0, 0.05, 0);

    // 2. WebGL Renderer with high performance settings
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: 'high-performance',
      precision: 'mediump'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    renderer.domElement.style.pointerEvents = 'none';
    container.appendChild(renderer.domElement);

    // 3. Lighting System
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(colorHex, 5.0, 14);
    pointLight.position.set(0.0, 2.0, 3.0);
    scene.add(pointLight);

    const baseLight = new THREE.PointLight(colorHex, 4.0, 8);
    baseLight.position.set(0.0, -0.8, 0);
    scene.add(baseLight);

    // 4. Multi-Concentric Holographic Base Pedestal (Centered)
    const pedestalGroup = new THREE.Group();
    pedestalGroup.position.set(0.0, 0, 0);

    // Outer Torus Ring (Optimized geometry)
    const torusGeo1 = new THREE.TorusGeometry(1.4, 0.028, 8, 28);
    const torusMat1 = new THREE.MeshBasicMaterial({ color: colorHex, wireframe: true, transparent: true, opacity: 0.85 });
    const ring1 = new THREE.Mesh(torusGeo1, torusMat1);
    ring1.rotation.x = Math.PI / 2;
    ring1.position.y = -0.95;
    pedestalGroup.add(ring1);

    // Middle Torus Ring
    const torusGeo2 = new THREE.TorusGeometry(1.1, 0.024, 8, 24);
    const ring2 = new THREE.Mesh(torusGeo2, torusMat1);
    ring2.rotation.x = Math.PI / 2;
    ring2.position.y = -0.88;
    pedestalGroup.add(ring2);

    // Inner Concentric Ring
    const torusGeo3 = new THREE.TorusGeometry(0.78, 0.02, 8, 20);
    const ring3 = new THREE.Mesh(torusGeo3, torusMat1);
    ring3.rotation.x = Math.PI / 2;
    ring3.position.y = -0.80;
    pedestalGroup.add(ring3);


    // Stepped Circular Cylinders
    const cylGeo1 = new THREE.CylinderGeometry(1.15, 1.3, 0.06, 32);
    const cylMat1 = new THREE.MeshStandardMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.35,
      roughness: 0.2,
      wireframe: true
    });
    const stageDisc1 = new THREE.Mesh(cylGeo1, cylMat1);
    stageDisc1.position.y = -0.92;
    pedestalGroup.add(stageDisc1);

    const cylGeo2 = new THREE.CylinderGeometry(0.82, 0.98, 0.06, 28);
    const stageDisc2 = new THREE.Mesh(cylGeo2, cylMat1);
    stageDisc2.position.y = -0.85;
    pedestalGroup.add(stageDisc2);

    // Inverted Wireframe Cone Support
    const baseConeGeo = new THREE.ConeGeometry(1.05, 0.65, 18, 3, true);
    const baseConeMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      wireframe: true,
      transparent: true,
      opacity: 0.45
    });
    const baseCone = new THREE.Mesh(baseConeGeo, baseConeMat);
    baseCone.position.y = -1.25;
    pedestalGroup.add(baseCone);

    // Holographic Vertical Light Beam
    const beamGeo = new THREE.CylinderGeometry(0.9, 0.4, 1.2, 24, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = -0.25;
    pedestalGroup.add(beam);

    scene.add(pedestalGroup);

    // 5. Floating 3D Main Object Group (Positioned above pedestal)
    const modelGroup = new THREE.Group();
    modelGroup.position.set(0.0, 0, 0);

    if (type === 'IMAGE_STUDIO') {
      // 3D Poly Mountain / Crystal Peak Terrain (Matches Image 1)
      const mountainGeo = new THREE.ConeGeometry(1.05, 1.45, 9, 5);
      const wireMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        wireframe: true,
        emissive: colorHex,
        emissiveIntensity: 0.95
      });
      const mountain = new THREE.Mesh(mountainGeo, wireMat);
      mountain.position.y = 0.12;
      modelGroup.add(mountain);

      const innerGeo = new THREE.ConeGeometry(0.68, 1.05, 7, 3);
      const innerMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        wireframe: true,
        transparent: true,
        opacity: 0.8
      });
      const innerPyramid = new THREE.Mesh(innerGeo, innerMat);
      innerPyramid.position.y = 0.05;
      modelGroup.add(innerPyramid);

      const apexGeo = new THREE.OctahedronGeometry(0.18);
      const apexMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const apex = new THREE.Mesh(apexGeo, apexMat);
      apex.position.y = 0.92;
      modelGroup.add(apex);

    } else if (type === 'DOCUMENT_STUDIO') {
      // 3D Floating Clipboard Document with lines & stylus (Matches Image 2)
      const docGeo = new THREE.BoxGeometry(1.05, 1.38, 0.06);
      const docMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        wireframe: true,
        emissive: colorHex,
        emissiveIntensity: 0.9
      });
      const doc = new THREE.Mesh(docGeo, docMat);
      doc.rotation.x = -0.2;
      doc.rotation.y = 0.2;
      doc.position.y = 0.15;
      modelGroup.add(doc);

      const clipGeo = new THREE.BoxGeometry(0.42, 0.14, 0.1);
      const clipMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
      const clip = new THREE.Mesh(clipGeo, clipMat);
      clip.position.set(-0.04, 0.8, 0.04);
      clip.rotation.x = -0.2;
      clip.rotation.y = 0.2;
      modelGroup.add(clip);

      const penGeo = new THREE.CylinderGeometry(0.035, 0.015, 1.05, 12);
      const penMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const pen = new THREE.Mesh(penGeo, penMat);
      pen.position.set(0.55, 0.2, 0.35);
      pen.rotation.z = -Math.PI / 4;
      pen.rotation.x = 0.22;
      modelGroup.add(pen);

    } else if (type === 'DATA_LAB') {
      // 3D Ascending Bar Columns + Trend Graph HUD + Donut Pie Chart (Matches Image 3)
      const bar1Geo = new THREE.BoxGeometry(0.18, 0.65, 0.18);
      const bar2Geo = new THREE.BoxGeometry(0.18, 1.15, 0.18);
      const bar3Geo = new THREE.BoxGeometry(0.18, 0.9, 0.18);
      const bar4Geo = new THREE.BoxGeometry(0.18, 1.4, 0.18);

      const mat = new THREE.MeshStandardMaterial({
        color: colorHex,
        wireframe: true,
        emissive: colorHex,
        emissiveIntensity: 0.95
      });

      const b1 = new THREE.Mesh(bar1Geo, mat); b1.position.set(-0.42, -0.25, 0); modelGroup.add(b1);
      const b2 = new THREE.Mesh(bar2Geo, mat); b2.position.set(-0.14, -0.02, 0); modelGroup.add(b2);
      const b3 = new THREE.Mesh(bar3Geo, mat); b3.position.set(0.14, -0.14, 0); modelGroup.add(b3);
      const b4 = new THREE.Mesh(bar4Geo, mat); b4.position.set(0.42, 0.1, 0); modelGroup.add(b4);

      // Line Graph HUD Box at Top Right
      const hudGeo = new THREE.BoxGeometry(0.55, 0.35, 0.03);
      const hudMat = new THREE.MeshBasicMaterial({ color: colorHex, wireframe: true });
      const hud = new THREE.Mesh(hudGeo, hudMat);
      hud.position.set(0.38, 0.82, 0.08);
      modelGroup.add(hud);

      // Floating 3D Pie Chart
      const pieGeo = new THREE.TorusGeometry(0.26, 0.06, 12, 24, Math.PI * 1.5);
      const pieMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const pie = new THREE.Mesh(pieGeo, pieMat);
      pie.position.set(-0.35, 0.65, 0.12);
      pie.rotation.x = Math.PI / 3;
      modelGroup.add(pie);

    } else if (type === 'CODE_LAB') {
      // 3D Isometric Code Window with Syntax Lines & Code Brackets (Matches Image 4)
      const winGeo = new THREE.BoxGeometry(1.3, 0.95, 0.06);
      const winMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        wireframe: true,
        emissive: colorHex,
        emissiveIntensity: 0.9
      });
      const win = new THREE.Mesh(winGeo, winMat);
      win.rotation.x = -0.16;
      win.rotation.y = 0.25;
      win.position.y = 0.15;
      modelGroup.add(win);

      // 3D Code Symbol `< / >`
      const tagGeo = new THREE.OctahedronGeometry(0.38);
      const tagMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
      const tag = new THREE.Mesh(tagGeo, tagMat);
      tag.position.set(0.48, -0.08, 0.35);
      modelGroup.add(tag);

    } else if (type === 'MEDIA_STUDIO') {
      // 3D Holographic Film Reel + Play Triangle + Track Scrubber (Matches Image 5)
      const reelGeo = new THREE.CylinderGeometry(0.68, 0.68, 0.1, 24);
      const reelMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        wireframe: true,
        emissive: colorHex,
        emissiveIntensity: 0.95
      });
      const reel = new THREE.Mesh(reelGeo, reelMat);
      reel.rotation.x = Math.PI / 2.3;
      reel.position.set(-0.15, 0.2, 0);
      modelGroup.add(reel);

      const playGeo = new THREE.ConeGeometry(0.32, 0.44, 3);
      const playMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
      const play = new THREE.Mesh(playGeo, playMat);
      play.rotation.z = -Math.PI / 2;
      play.position.set(0.44, -0.05, 0.28);
      modelGroup.add(play);

      const waveGeo = new THREE.BoxGeometry(0.72, 0.16, 0.04);
      const waveMat = new THREE.MeshBasicMaterial({ color: colorHex, wireframe: true });
      const wave = new THREE.Mesh(waveGeo, waveMat);
      wave.position.set(0.08, -0.32, 0.16);
      modelGroup.add(wave);

    } else if (type === 'KNOWLEDGE_LAB') {
      // 3D Holographic Quantum Cube with glowing '?' Question Node (Matches Image 6)
      const outerBoxGeo = new THREE.BoxGeometry(1.05, 1.05, 1.05);
      const outerBoxMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        wireframe: true,
        emissive: colorHex,
        emissiveIntensity: 0.95
      });
      const outerBox = new THREE.Mesh(outerBoxGeo, outerBoxMat);
      outerBox.position.y = 0.18;
      modelGroup.add(outerBox);

      const innerBoxGeo = new THREE.BoxGeometry(0.62, 0.62, 0.62);
      const innerMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
      const innerBox = new THREE.Mesh(innerBoxGeo, innerMat);
      innerBox.position.y = 0.18;
      modelGroup.add(innerBox);

      // Glowing Question Node Sphere
      const centerSphereGeo = new THREE.SphereGeometry(0.24, 16, 16);
      const centerSphereMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const centerSphere = new THREE.Mesh(centerSphereGeo, centerSphereMat);
      centerSphere.position.y = 0.18;
      modelGroup.add(centerSphere);
    }

    scene.add(modelGroup);

    // 6. Luminous Cyber Sparks System
    const sparkCanvas = document.createElement('canvas');
    sparkCanvas.width = 32;
    sparkCanvas.height = 32;
    const ctx = sparkCanvas.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.85)');
    grad.addColorStop(0.7, 'rgba(0, 242, 254, 0.4)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(16, 16, 16, 0, Math.PI * 2);
    ctx.fill();

    const sparkTexture = new THREE.CanvasTexture(sparkCanvas);

    // Primary Neon Sparks
    const particleCount = 65;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSpeeds = new Float32Array(particleCount);
    const particleRadii = new Float32Array(particleCount);
    const particleAngles = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      particleRadii[i] = 0.35 + Math.random() * 1.25;
      particleAngles[i] = Math.random() * Math.PI * 2;
      particleSpeeds[i] = 0.015 + Math.random() * 0.025;

      const idx = i * 3;
      particlePositions[idx] = Math.cos(particleAngles[i]) * particleRadii[i];
      particlePositions[idx + 1] = (Math.random() - 0.5) * 2.2;
      particlePositions[idx + 2] = Math.sin(particleAngles[i]) * particleRadii[i];
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: colorHex,
      map: sparkTexture,
      size: 0.15,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // Secondary Quantum White Sparks
    const whiteCount = 30;
    const whiteGeo = new THREE.BufferGeometry();
    const whitePositions = new Float32Array(whiteCount * 3);

    for (let i = 0; i < whiteCount * 3; i += 3) {
      whitePositions[i] = (Math.random() - 0.5) * 2.2;
      whitePositions[i + 1] = Math.random() * 2.2 - 1.1;
      whitePositions[i + 2] = (Math.random() - 0.5) * 2.2;
    }

    whiteGeo.setAttribute('position', new THREE.BufferAttribute(whitePositions, 3));
    const whiteMat = new THREE.PointsMaterial({
      color: 0xffffff,
      map: sparkTexture,
      size: 0.09,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const whiteSparks = new THREE.Points(whiteGeo, whiteMat);
    scene.add(whiteSparks);

    // 7. Mouse Parallax Tracking
    let mouseX = 0;
    let mouseY = 0;

    const handleMouseMove = (e) => {
      const rect = container.getBoundingClientRect();
      mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    };

    container.addEventListener('mousemove', handleMouseMove);

    // 8. 60 FPS Render Loop
    let animId;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Continuous 3D rotation & hover elevation
      modelGroup.rotation.y += 0.012;
      modelGroup.rotation.x = Math.sin(elapsedTime * 1.5) * 0.06;
      modelGroup.position.y = Math.sin(elapsedTime * 2.0) * 0.07;

      // Pedestal counter rotation & beam pulsing
      ring1.rotation.z += 0.008;
      ring2.rotation.z -= 0.012;
      ring3.rotation.z += 0.016;
      beam.material.opacity = 0.10 + Math.sin(elapsedTime * 3) * 0.04;

      // Swirling Sparks Animation
      const pos = particleGeo.attributes.position.array;
      for (let i = 0; i < particleCount; i++) {
        particleAngles[i] += particleSpeeds[i];
        const idx = i * 3;
        pos[idx] = Math.cos(particleAngles[i]) * particleRadii[i];
        pos[idx + 1] += 0.012; // Rise upwards
        pos[idx + 2] = Math.sin(particleAngles[i]) * particleRadii[i];

        if (pos[idx + 1] > 1.35) {
          pos[idx + 1] = -1.1;
          particleRadii[i] = 0.35 + Math.random() * 1.25;
        }
      }
      particleGeo.attributes.position.needsUpdate = true;

      // Rising White Sparks
      const whitePos = whiteGeo.attributes.position.array;
      for (let i = 1; i < whiteCount * 3; i += 3) {
        whitePos[i] += 0.015;
        if (whitePos[i] > 1.4) whitePos[i] = -1.2;
      }
      whiteGeo.attributes.position.needsUpdate = true;

      // Mouse Parallax Smooth Interpolation
      camera.position.x += (mouseX * 0.35 - camera.position.x) * 0.08;
      camera.position.y += (0.8 + mouseY * 0.2 - camera.position.y) * 0.08;
      camera.lookAt(0, 0.1, 0);

      renderer.render(scene, camera);
    };

    animate();

    // 9. Resize Observer
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 240;
      const h = container.clientHeight || 200;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousemove', handleMouseMove);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [type, colorHex]);

  return (
    <div
      ref={mountRef}
      className="w-full h-full flex items-center justify-center relative pointer-events-none select-none"
    />
  );
}
