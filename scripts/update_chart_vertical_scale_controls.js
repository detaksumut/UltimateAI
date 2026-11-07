import fs from 'fs';

const filePath = 'd:/Users/ultimateai/src/components/platform-trader/ProfessionalCandlestickChart.jsx';
let code = fs.readFileSync(filePath, 'utf8');

// 1. Update handleWheel & add zoom in / zoom out / reset normal callbacks
const oldWheelSection = `  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? -6 : 6;
    setVisibleBars(prev => Math.min(220, Math.max(20, prev + delta)));
  }, []);`;

const newWheelSection = `  // ── Vertical & Horizontal Zoom via Mouse Wheel ──
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const plotWidth = rect.width - 80;

    if (x >= plotWidth) {
      // Mouse is over Price Scale -> VERTICAL ZOOM ONLY (Do not touch visibleBars!)
      const zoomMultiplier = e.deltaY < 0 ? 0.90 : 1.10;
      setPriceScaleFactor(prev => Math.max(0.08, Math.min(15.0, prev * zoomMultiplier)));
      setIsAutoScaled(false);
    } else {
      // Mouse is over Main Chart -> HORIZONTAL ZOOM ONLY
      const delta = e.deltaY < 0 ? -6 : 6;
      setVisibleBars(prev => Math.min(220, Math.max(20, prev + delta)));
    }
  }, []);

  const handleVerticalZoomIn = useCallback(() => {
    setPriceScaleFactor(prev => Math.max(0.08, prev * 0.85));
    setIsAutoScaled(false);
  }, []);

  const handleVerticalZoomOut = useCallback(() => {
    setPriceScaleFactor(prev => Math.min(15.0, prev * 1.15));
    setIsAutoScaled(false);
  }, []);

  const handleResetNormal = useCallback(() => {
    setPriceScaleFactor(1.0);
    setPricePanOffset(0);
    setVisibleBars(75);
    setPanOffset(0);
    setIsAutoScaled(true);
  }, []);`;

if (code.includes(oldWheelSection)) {
  code = code.replace(oldWheelSection, newWheelSection);
  console.log('handleWheel and vertical zoom handlers added.');
} else {
  console.error('Could not find oldWheelSection');
}

// 2. Add Floating Vertical Price Scale HUD Controls (+, −, AUTO, RESET) right beside the price scale
const oldCanvasArea = `          {/* Canvas Element with full-height interactive plotting */}
          <canvas`;

const newControls = `          {/* Floating Vertical Price Scale HUD Controls (+, −, AUTO, RESET) */}
          <div
            style={{
              position: 'absolute',
              top: 36,
              right: 6,
              zIndex: 30,
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              background: 'rgba(19, 23, 34, 0.92)',
              padding: '3px',
              borderRadius: 5,
              border: '1px solid #2a2e39',
              boxShadow: '0 4px 14px rgba(0,0,0,0.6)',
              backdropFilter: 'blur(6px)',
            }}
          >
            <button
              onClick={handleVerticalZoomIn}
              title="Zoom In Vertikal (+) — Renggangkan Skala Harga"
              style={{
                width: 22,
                height: 22,
                fontSize: 14,
                fontWeight: 900,
                borderRadius: 3,
                border: '1px solid #2a2e39',
                background: '#1e222d',
                color: '#f8fafc',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                transition: 'all 0.1s ease',
              }}
            >
              +
            </button>
            <button
              onClick={handleVerticalZoomOut}
              title="Zoom Out Vertikal (−) — Rapatkan Skala Harga"
              style={{
                width: 22,
                height: 22,
                fontSize: 14,
                fontWeight: 900,
                borderRadius: 3,
                border: '1px solid #2a2e39',
                background: '#1e222d',
                color: '#f8fafc',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                transition: 'all 0.1s ease',
              }}
            >
              −
            </button>
            <button
              onClick={resetPriceScale}
              title={isAutoScaled ? "Skala Harga Otomatis (AUTO) Aktif" : "Kembalikan ke Skala Harga Otomatis (AUTO)"}
              style={{
                height: 18,
                fontSize: 8,
                fontWeight: 900,
                borderRadius: 3,
                border: isAutoScaled ? '1px solid #2962ff' : '1px solid rgba(234, 179, 8, 0.6)',
                background: isAutoScaled ? 'rgba(41, 98, 255, 0.25)' : 'rgba(234, 179, 8, 0.25)',
                color: isAutoScaled ? '#38bdf8' : '#eab308',
                cursor: 'pointer',
                padding: '0 3px',
                fontFamily: 'monospace',
              }}
            >
              AUTO
            </button>
            <button
              onClick={handleResetNormal}
              title="Reset Skala Normal & Posisi Awal"
              style={{
                height: 18,
                fontSize: 7.5,
                fontWeight: 800,
                borderRadius: 3,
                border: '1px solid #2a2e39',
                background: '#1e222d',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '0 3px',
                fontFamily: 'monospace',
              }}
            >
              RESET
            </button>
          </div>

          {/* Canvas Element with full-height interactive plotting */}
          <canvas`;

if (code.includes(oldCanvasArea)) {
  code = code.replace(oldCanvasArea, newControls);
  console.log('Floating Price Scale Controls added successfully.');
} else {
  console.error('Could not find oldCanvasArea');
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('Vertical price scale controls update complete.');

