import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

export default function Hologram3DCanvas({ type, colorHex, isHovered = false }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 200;
    const height = container.clientHeight || 200;

    // 1. Scene & Camera Setup (Centered & Zoomed Closer for Bolder 3D Visibility)
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0.6, 3.2);
    camera.lookAt(0, -0.05, 0);

    // 2. WebGL Renderer with full transparency & antialiasing
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // 3. Lighting System (Enhanced Neon Vibrancy)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(colorHex, 4.5, 12);
    pointLight.position.set(0, 2, 2.5);
    scene.add(pointLight);

    const baseLight = new THREE.PointLight(colorHex, 3, 6);
    baseLight.position.set(0, -1.2, 0);
    scene.add(baseLight);

    // 4. Multi-Ring 3D Holographic Pedestal (Enlarged & Centered)
    const pedestalGroup = new THREE.Group();

    // Outer Torus Ring
    const torusGeo1 = new THREE.TorusGeometry(1.85, 0.032, 16, 64);
    const torusMat1 = new THREE.MeshBasicMaterial({ color: colorHex, wireframe: true, transparent: true, opacity: 0.75 });
    const ring1 = new THREE.Mesh(torusGeo1, torusMat1);
    ring1.rotation.x = Math.PI / 2;
    ring1.position.y = -1.05;
    pedestalGroup.add(ring1);

    // Middle Ring
    const torusGeo2 = new THREE.TorusGeometry(1.45, 0.025, 16, 48);
    const ring2 = new THREE.Mesh(torusGeo2, torusMat1);
    ring2.rotation.x = Math.PI / 2;
    ring2.position.y = -1.0;
    pedestalGroup.add(ring2);

    // Inner Solid Glow Disc
    const cylinderGeo = new THREE.CylinderGeometry(1.1, 1.1, 0.04, 32);
    const cylinderMat = new THREE.MeshStandardMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.25,
      roughness: 0.3
    });
    const disc = new THREE.Mesh(cylinderGeo, cylinderMat);
    disc.position.y = -1.02;
    pedestalGroup.add(disc);

    scene.add(pedestalGroup);

    // 5. Floating 3D Main Object Group (Significantly Enlarged & Centered)
    const modelGroup = new THREE.Group();

    // Construct specialized 3D geometry per app type
    if (type === 'IMAGE_STUDIO') {
      // 3D Poly Mountain / Crystal Peak (Enlarged)
      const coneGeo = new THREE.ConeGeometry(1.35, 1.9, 7, 3);
      const wireMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        wireframe: true,
        emissive: colorHex,
        emissiveIntensity: 0.65
      });
      const cone = new THREE.Mesh(coneGeo, wireMat);
      cone.position.y = 0.15;
      modelGroup.add(cone);

      const innerConeGeo = new THREE.ConeGeometry(0.85, 1.4, 5, 2);
      const innerMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        wireframe: true,
        transparent: true,
        opacity: 0.65
      });
      const innerCone = new THREE.Mesh(innerConeGeo, innerMat);
      innerCone.position.y = 0.05;
      modelGroup.add(innerCone);
    } else if (type === 'DOCUMENT_STUDIO') {
      // 3D Floating Clipboard & Stylus (Enlarged)
      const boxGeo = new THREE.BoxGeometry(1.35, 1.8, 0.09);
      const docMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        wireframe: true,
        emissive: colorHex,
        emissiveIntensity: 0.75
      });
      const doc = new THREE.Mesh(boxGeo, docMat);
      doc.rotation.x = -0.2;
      doc.rotation.y = 0.25;
      doc.position.y = 0.05;
      modelGroup.add(doc);

      // 3D Stylus Pen
      const penGeo = new THREE.CylinderGeometry(0.05, 0.025, 1.4, 12);
      const penMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const pen = new THREE.Mesh(penGeo, penMat);
      pen.position.set(0.7, 0.15, 0.45);
      pen.rotation.z = -Math.PI / 4;
      pen.rotation.x = 0.2;
      modelGroup.add(pen);
    } else if (type === 'DATA_LAB') {
      // 3D Bar Columns + Floating Torus (Enlarged)
      const bar1Geo = new THREE.BoxGeometry(0.28, 1.0, 0.28);
      const bar2Geo = new THREE.BoxGeometry(0.28, 1.6, 0.28);
      const bar3Geo = new THREE.BoxGeometry(0.28, 1.25, 0.28);
      const bar4Geo = new THREE.BoxGeometry(0.28, 1.85, 0.28);

      const mat = new THREE.MeshStandardMaterial({ color: colorHex, wireframe: true, emissive: colorHex, emissiveIntensity: 0.85 });
      
      const b1 = new THREE.Mesh(bar1Geo, mat); b1.position.set(-0.6, -0.45, 0); modelGroup.add(b1);
      const b2 = new THREE.Mesh(bar2Geo, mat); b2.position.set(-0.2, -0.15, 0); modelGroup.add(b2);
      const b3 = new THREE.Mesh(bar3Geo, mat); b3.position.set(0.2, -0.32, 0); modelGroup.add(b3);
      const b4 = new THREE.Mesh(bar4Geo, mat); b4.position.set(0.6, -0.02, 0); modelGroup.add(b4);

      // Floating 3D Pie Ring
      const pieGeo = new THREE.TorusGeometry(0.42, 0.09, 12, 24, Math.PI * 1.5);
      const pieMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const pie = new THREE.Mesh(pieGeo, pieMat);
      pie.position.set(0.5, 0.95, 0.25);
      pie.rotation.x = Math.PI / 3;
      modelGroup.add(pie);
    } else if (type === 'CODE_LAB') {
      // 3D Isometric Code Window with Tag (Enlarged)
      const winGeo = new THREE.BoxGeometry(1.7, 1.2, 0.08);
      const winMat = new THREE.MeshStandardMaterial({ color: colorHex, wireframe: true, emissive: colorHex, emissiveIntensity: 0.75 });
      const win = new THREE.Mesh(winGeo, winMat);
      win.rotation.x = -0.18;
      win.rotation.y = 0.3;
      win.position.y = 0.05;
      modelGroup.add(win);

      // 3D Floating Wireframe Octahedron
      const octGeo = new THREE.OctahedronGeometry(0.48);
      const octMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
      const oct = new THREE.Mesh(octGeo, octMat);
      oct.position.set(0.6, -0.2, 0.45);
      modelGroup.add(oct);
    } else if (type === 'MEDIA_STUDIO') {
      // 3D Spinning Film Reel (Enlarged)
      const reelGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.12, 24);
      const reelMat = new THREE.MeshStandardMaterial({ color: colorHex, wireframe: true, emissive: colorHex, emissiveIntensity: 0.9 });
      const reel = new THREE.Mesh(reelGeo, reelMat);
      reel.rotation.x = Math.PI / 2.5;
      reel.position.set(-0.25, 0.15, 0);
      modelGroup.add(reel);

      // 3D Play Cone/Triangle
      const triGeo = new THREE.ConeGeometry(0.42, 0.6, 3);
      const triMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
      const tri = new THREE.Mesh(triGeo, triMat);
      tri.rotation.z = -Math.PI / 2;
      tri.position.set(0.6, -0.2, 0.35);
      modelGroup.add(tri);
    } else if (type === 'KNOWLEDGE_LAB') {
      // 3D Tesseract / Neural Cube (Enlarged)
      const outerBoxGeo = new THREE.BoxGeometry(1.25, 1.25, 1.25);
      const outerBoxMat = new THREE.MeshStandardMaterial({ color: colorHex, wireframe: true, emissive: colorHex, emissiveIntensity: 0.9 });
      const outerBox = new THREE.Mesh(outerBoxGeo, outerBoxMat);
      modelGroup.add(outerBox);

      const innerBoxGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
      const innerBoxMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
      const innerBox = new THREE.Mesh(innerBoxGeo, innerBoxMat);
      modelGroup.add(innerBox);

      const centerSphereGeo = new THREE.SphereGeometry(0.22, 14, 14);
      const centerSphereMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const centerSphere = new THREE.Mesh(centerSphereGeo, centerSphereMat);
      modelGroup.add(centerSphere);
    }

    scene.add(modelGroup);

    // 6. Enhanced Luminous Cyber Sparks System
    // Generate custom glowing circular spark texture
    const sparkCanvas = document.createElement('canvas');
    sparkCanvas.width = 32;
    sparkCanvas.height = 32;
    const ctx = sparkCanvas.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
    grad.addColorStop(0.7, 'rgba(0, 242, 254, 0.4)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(16, 16, 16, 0, Math.PI * 2);
    ctx.fill();

    const sparkTexture = new THREE.CanvasTexture(sparkCanvas);

    // Primary Neon Cyber Sparks (Swirling around the 3D model)
    const particleCount = 75;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSpeeds = new Float32Array(particleCount);
    const particleRadii = new Float32Array(particleCount);
    const particleAngles = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      particleRadii[i] = 0.4 + Math.random() * 1.3;
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
      size: 0.14,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // Secondary Quantum White Sparks (Fast floating micro-sparks)
    const whiteCount = 35;
    const whiteGeo = new THREE.BufferGeometry();
    const whitePositions = new Float32Array(whiteCount * 3);

    for (let i = 0; i < whiteCount * 3; i += 3) {
      whitePositions[i] = (Math.random() - 0.5) * 2.4;
      whitePositions[i + 1] = Math.random() * 2.4 - 1.2;
      whitePositions[i + 2] = (Math.random() - 0.5) * 2.4;
    }

    whiteGeo.setAttribute('position', new THREE.BufferAttribute(whitePositions, 3));
    const whiteMat = new THREE.PointsMaterial({
      color: 0xffffff,
      map: sparkTexture,
      size: 0.08,
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
    let targetRotationX = 0;
    let targetRotationY = 0;

    const handleMouseMove = (e) => {
      const rect = container.getBoundingClientRect();
      mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      targetRotationY = mouseX * 0.4;
      targetRotationX = mouseY * 0.3;
    };

    container.addEventListener('mousemove', handleMouseMove);

    // 8. 60 FPS Render Loop with dynamic 3D rotations & swirling cyber sparks
    let animId;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Continuous 3D rotation & hover elevation
      modelGroup.rotation.y += 0.012;
      modelGroup.rotation.x += 0.004;
      modelGroup.position.y = Math.sin(elapsedTime * 2.0) * 0.06;

      // Pedestal counter rotation
      ring1.rotation.z += 0.008;
      ring2.rotation.z -= 0.012;

      // 1. Swirling Primary Cyber Sparks Animation
      const pos = particleGeo.attributes.position.array;
      for (let i = 0; i < particleCount; i++) {
        particleAngles[i] += particleSpeeds[i];
        const idx = i * 3;
        pos[idx] = Math.cos(particleAngles[i]) * particleRadii[i];
        pos[idx + 1] += 0.012; // Rise upwards
        pos[idx + 2] = Math.sin(particleAngles[i]) * particleRadii[i];

        if (pos[idx + 1] > 1.3) {
          pos[idx + 1] = -1.1;
          particleRadii[i] = 0.4 + Math.random() * 1.3;
        }
      }
      particleGeo.attributes.position.needsUpdate = true;

      // 2. Rising Secondary Quantum White Sparks Animation
      const whitePos = whiteGeo.attributes.position.array;
      for (let i = 1; i < whiteCount * 3; i += 3) {
        whitePos[i] += 0.015;
        if (whitePos[i] > 1.4) whitePos[i] = -1.2;
      }
      whiteGeo.attributes.position.needsUpdate = true;

      // Mouse Parallax Smooth Interpolation
      camera.position.x += (mouseX * 0.4 - camera.position.x) * 0.08;
      camera.position.y += (0.6 + mouseY * 0.25 - camera.position.y) * 0.08;
      camera.lookAt(0, -0.05, 0);

      renderer.render(scene, camera);
    };

    animate();

    // 9. Resize Observer
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 240;
      const h = container.clientHeight || 150;
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
      className="w-full h-full flex items-center justify-center relative cursor-grab active:cursor-grabbing select-none"
    />
  );
}
