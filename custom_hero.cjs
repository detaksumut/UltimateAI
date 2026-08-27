const fs = require('fs');
const path = 'src/infrastructure/server/server.ts';
let code = fs.readFileSync(path, 'utf8');

// 1. Replace SVG with PNG
const svgLogo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20M4 19.5V3a1 1 0 0 1 1-1h15v20H5a1 1 0 0 1-1-1z"/></svg>`;
const pngLogo = `<img src="/logo-ultimateAI-transparent.png" alt="Logo" style="width:100%;height:100%;object-fit:contain;border-radius:8px;" />`;
code = code.replace(svgLogo, pngLogo);

// 2. Add CSS classes for hero backgrounds
const heroCssMarker = `      flex-direction: column;
      align-items: center;
    }`;
const heroStyles = `      flex-direction: column;
      align-items: center;
    }
    .public-hero.hero-emerald {
      background: linear-gradient(135deg, rgba(6, 78, 59, 0.95) 0%, rgba(2, 44, 34, 0.98) 100%);
    }
    .public-hero.hero-crimson {
      background: linear-gradient(135deg, rgba(136, 19, 55, 0.95) 0%, rgba(76, 5, 25, 0.98) 100%);
    }`;
code = code.replace(heroCssMarker, heroStyles);

// 3. Update btnGenerate logic
const oldLogic = `      // Customize Hero styles
      const heroEl = document.querySelector('.public-hero');
      if (heroEl) {
        heroEl.className = 'public-hero'; // Reset classes
        if (heroBg === 'light-clean') heroEl.classList.add('hero-light');
        else if (heroBg === 'crimson-vel') heroEl.classList.add('hero-crimson');
        if (heroAlign === 'left') heroEl.classList.add('hero-left');
      }`;

const newLogic = `      // Customize Hero styles
      const heroEl = document.querySelector('.public-hero');
      if (heroEl) {
        heroEl.className = 'public-hero'; // Reset classes
        if (colorTheme === 'emerald') heroEl.classList.add('hero-emerald');
        else if (colorTheme === 'crimson') heroEl.classList.add('hero-crimson');
      }`;
code = code.replace(oldLogic, newLogic);

fs.writeFileSync(path, code, 'utf8');
console.log('Applied custom hero features!');
