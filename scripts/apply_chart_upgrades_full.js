import fs from 'fs';

const filePath = 'd:/Users/ultimateai/src/components/platform-trader/ProfessionalCandlestickChart.jsx';
let code = fs.readFileSync(filePath, 'utf8');

// 1. Add interactive states for price scale stretch/compress, auto-scale, and window dimensions
const oldStates = `  // ── Viewport & Interactive State ──
  const [visibleBars, setVisibleBars] = useState(75); // zoom: 20 to 220
  const [panOffset, setPanOffset] = useState(0); // pan bars offset
  const [chartType, setChartType] = useState('candles'); // 'candles' | 'line'
  const [hoverData, setHoverData] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartOffset, setDragStartOffset] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);`;

const newStates = `  // ── Viewport & Interactive State ──
  const [visibleBars, setVisibleBars] = useState(75); // zoom: 20 to 220
  const [panOffset, setPanOffset] = useState(0); // pan bars offset
  const [chartType, setChartType] = useState('candles'); // 'candles' | 'line'
  const [hoverData, setHoverData] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [windowDimensions, setWindowDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800
  });

  // ── Price Scale Stretch & Compress State (TradingView Style) ──
  const [priceScaleFactor, setPriceScaleFactor] = useState(1.0); // >1: dirapatkan (compressed), <1: direnggangkan (stretched)
  const [pricePanOffset, setPricePanOffset] = useState(0); // vertical pan offset
  const [isAutoScaled, setIsAutoScaled] = useState(true); // true = auto fit, false = custom user stretched
  const [dragMode, setDragMode] = useState(null); // null | 'pan' | 'priceScale' | 'timeScale'
  const [cursorStyle, setCursorStyle] = useState('crosshair');

  const dragStartRef = useRef({
    x: 0,
    y: 0,
    panOffset: 0,
    scaleFactor: 1.0,
    pricePan: 0,
    visibleBars: 75
  });

  const resetPriceScale = useCallback(() => {
    setPriceScaleFactor(1.0);
    setPricePanOffset(0);
    setIsAutoScaled(true);
  }, []);

  // Listen to window resize for dynamic fullscreen/expand recalculations
  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined') {
        setWindowDimensions({
          width: window.innerWidth,
          height: window.innerHeight
        });
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Listen to Escape key to exit fullscreen/expand
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);`;

if (code.includes(oldStates)) {
  code = code.replace(oldStates, newStates);
  console.log('States updated successfully.');
} else {
  console.error('Could not find oldStates');
}

// 2. Update price scale calculation and TradingView clean round interval grid
const oldScaleAndGrid = `    const candleSpan = maxPrice - minPrice;
    const padding = Math.max(0.5, candleSpan * 0.12);
    minPrice -= padding;
    maxPrice += padding;
    const priceRange = maxPrice - minPrice || 1;

    const getY = (val) => pricePlotHeight - ((val - minPrice) / priceRange) * pricePlotHeight;
    const barSlot = plotWidth / displayCandles.length;
    const candleWidth = Math.max(2, Math.min(18, Math.floor(barSlot * 0.72)));

    // ── 5. Grid Lines (Thin TradingView style) ──
    ctx.strokeStyle = '#1e222d';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);

    // Horizontal Price Grid
    const priceGridSteps = 7;
    for (let i = 0; i <= priceGridSteps; i++) {
      const p = minPrice + (priceRange / priceGridSteps) * i;
      const y = getY(p);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(plotWidth, y);
      ctx.stroke();

      // Right axis price label
      ctx.fillStyle = '#787b86';
      ctx.font = '10px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.toFixed(2), plotWidth + 8, y + 3.5);
    }`;

const newScaleAndGrid = `    const candleSpan = maxPrice - minPrice;
    const baseCenter = (minPrice + maxPrice) / 2;
    const padding = Math.max(0.5, candleSpan * 0.12);
    const autoMin = minPrice - padding;
    const autoMax = maxPrice + padding;
    const autoSpan = autoMax - autoMin || 1;

    // Apply interactive price scale stretch/compress & vertical pan
    const scaledSpan = autoSpan * priceScaleFactor;
    const center = baseCenter + pricePanOffset;

    minPrice = center - scaledSpan / 2;
    maxPrice = center + scaledSpan / 2;
    const priceRange = maxPrice - minPrice || 1;

    const getY = (val) => pricePlotHeight - ((val - minPrice) / priceRange) * pricePlotHeight;
    const barSlot = plotWidth / displayCandles.length;
    const candleWidth = Math.max(2, Math.min(18, Math.floor(barSlot * 0.72)));

    // ── 5. Grid Lines (TradingView Exact Nice Round Steps) ──
    ctx.strokeStyle = '#1e222d';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);

    // TradingView exact nice round price step (e.g. 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50)
    const targetPriceSteps = Math.max(4, Math.min(14, Math.floor(pricePlotHeight / 48)));
    const priceStep = calculateTradingViewStep(priceRange, targetPriceSteps);
    const firstGridPrice = Math.ceil(minPrice / priceStep) * priceStep;

    const formatPriceLabel = (p) => {
      if (!Number.isFinite(p)) return '';
      const decimals = priceStep < 0.1 ? 3 : (priceStep < 1 ? 2 : (priceStep % 1 !== 0 ? 1 : 2));
      return p.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    };

    // Draw horizontal grid lines at clean multiples of priceStep
    for (let p = firstGridPrice; p <= maxPrice; p += priceStep) {
      const y = getY(p);
      if (y < 0 || y > pricePlotHeight) continue;

      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(plotWidth, y);
      ctx.stroke();

      // Right axis price label
      ctx.fillStyle = '#787b86';
      ctx.font = '10px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(formatPriceLabel(p), plotWidth + 8, y + 3.5);
    }`;

if (code.includes(oldScaleAndGrid)) {
  code = code.replace(oldScaleAndGrid, newScaleAndGrid);
  console.log('Scale and grid updated successfully.');
} else {
  console.error('Could not find oldScaleAndGrid');
}

// 3. Update useEffect dependencies to include priceScaleFactor, pricePanOffset, isFullscreen
const oldDeps = `  }, [
    validCandles,
    currentPrice,
    visibleBars,
    panOffset,
    chartType,
    showIndicators,
    showEma20,
    showEma50,
    showEma200,
    showVolume,
    activeSubPane,
    showZones,
    instrument,
    timeframe,
    zones,
    openPositions,
    hoverData,
    userDrawings
  ]);`;

const newDeps = `  }, [
    validCandles,
    currentPrice,
    visibleBars,
    panOffset,
    chartType,
    showIndicators,
    showEma20,
    showEma50,
    showEma200,
    showVolume,
    activeSubPane,
    showZones,
    instrument,
    timeframe,
    zones,
    openPositions,
    hoverData,
    userDrawings,
    priceScaleFactor,
    pricePanOffset,
    isFullscreen,
    windowDimensions
  ]);`;

if (code.includes(oldDeps)) {
  code = code.replace(oldDeps, newDeps);
  console.log('Dependencies updated successfully.');
} else {
  console.error('Could not find oldDeps');
}

// 4. Update mouse handlers: handleMouseDown, handleMouseMove, handleMouseUp, handleDoubleClick
const oldMouseHandlers = `  // ── Mouse & Touch Handlers for Crosshair, Pan & Zoom ──
  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !validCandles.length) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDragging) {
      const deltaX = x - dragStartX;
      const barSlot = (rect.width - 80) / visibleBars;
      const barsMoved = Math.round(deltaX / barSlot);
      setPanOffset(Math.max(0, dragStartOffset + barsMoved));
    } else {
      const plotWidth = rect.width - 80;
      const barSlot = plotWidth / Math.min(validCandles.length, visibleBars);
      const hoverIdx = Math.min(validCandles.length - 1, Math.max(0, Math.floor(x / barSlot)));
      setHoverData({ x, y, candle: validCandles[hoverIdx] });
    }
  };

  const handleMouseDown = (e) => {
    if (activeDrawingTool === 'horizontal') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const pricePlotHeight = rect.height - 28 - (activeSubPane !== 'none' ? 95 : 0) - (showVolume ? 45 : 0);
      const lastCandle = validCandles[validCandles.length - 1];
      const approxPrice = lastCandle ? lastCandle.close : 2740;
      setUserDrawings(prev => [...prev, { type: 'horizontal', price: approxPrice }]);
      setActiveDrawingTool('crosshair');
      return;
    }

    setIsDragging(true);
    setDragStartX(e.clientX - canvasRef.current.getBoundingClientRect().left);
    setDragStartOffset(panOffset);
  };

  const handleMouseUp = () => setIsDragging(false);
  const handleMouseLeave = () => {
    setIsDragging(false);
    setHoverData(null);
  };`;

const newMouseHandlers = `  // ── Mouse & Touch Handlers: Drag Price Scale (Stretch/Compress), Time Scale & Pan ──
  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const plotWidth = rect.width - 80;
    const timeAxisHeight = 28;
    const subPaneHeight = activeSubPane !== 'none' ? 95 : 0;
    const volumeHeight = showVolume ? 45 : 0;
    const pricePlotHeight = rect.height - timeAxisHeight - subPaneHeight - volumeHeight;

    if (activeDrawingTool === 'horizontal') {
      const lastCandle = validCandles[validCandles.length - 1];
      const approxPrice = lastCandle ? lastCandle.close : 2740;
      setUserDrawings(prev => [...prev, { type: 'horizontal', price: approxPrice }]);
      setActiveDrawingTool('crosshair');
      return;
    }

    if (x >= plotWidth && y <= pricePlotHeight) {
      // 1. Right Price Scale Drag -> Stretch & Compress Price Intervals
      setDragMode('priceScale');
      setIsAutoScaled(false);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        scaleFactor: priceScaleFactor,
        pricePan: pricePanOffset,
        visibleBars,
        panOffset,
      };
    } else if (y >= rect.height - timeAxisHeight && x <= plotWidth) {
      // 2. Bottom Time Scale Drag -> Stretch & Compress Candle Bar Spacing
      setDragMode('timeScale');
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        visibleBars,
        panOffset,
      };
    } else {
      // 3. Main Chart Canvas Drag -> Horizontal & Vertical Pan
      setDragMode('pan');
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        panOffset,
        pricePan: pricePanOffset,
      };
    }
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !validCandles.length) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const plotWidth = rect.width - 80;
    const timeAxisHeight = 28;
    const subPaneHeight = activeSubPane !== 'none' ? 95 : 0;
    const volumeHeight = showVolume ? 45 : 0;
    const pricePlotHeight = rect.height - timeAxisHeight - subPaneHeight - volumeHeight;

    if (dragMode === 'priceScale') {
      // Dragging downward (deltaY > 0) compresses price intervals (dirapatkan)
      // Dragging upward (deltaY < 0) stretches price intervals (direnggangkan)
      const deltaY = e.clientY - dragStartRef.current.y;
      const scaleMultiplier = Math.pow(1.006, deltaY);
      const newFactor = Math.max(0.08, Math.min(15.0, dragStartRef.current.scaleFactor * scaleMultiplier));
      setPriceScaleFactor(newFactor);
      setIsAutoScaled(false);
      return;
    }

    if (dragMode === 'timeScale') {
      const deltaX = e.clientX - dragStartRef.current.x;
      const barChange = Math.round(deltaX / 6);
      setVisibleBars(Math.max(15, Math.min(220, dragStartRef.current.visibleBars - barChange)));
      return;
    }

    if (dragMode === 'pan') {
      const deltaX = e.clientX - dragStartRef.current.x;
      const barSlot = plotWidth / visibleBars;
      const barsMoved = Math.round(deltaX / barSlot);
      setPanOffset(Math.max(0, dragStartRef.current.panOffset + barsMoved));

      // Vertical pan when manual scale is active
      if (!isAutoScaled) {
        const deltaY = e.clientY - dragStartRef.current.y;
        const priceShift = (deltaY / Math.max(10, pricePlotHeight)) * 20 * priceScaleFactor;
        setPricePanOffset(dragStartRef.current.pricePan + priceShift);
      }
      return;
    }

    // Hover mode: update cursor & crosshair
    if (x >= plotWidth && y <= pricePlotHeight) {
      setCursorStyle('ns-resize');
    } else if (y >= rect.height - timeAxisHeight && x <= plotWidth) {
      setCursorStyle('ew-resize');
    } else {
      setCursorStyle(activeDrawingTool === 'crosshair' ? 'crosshair' : 'pointer');
    }

    const barSlot = plotWidth / Math.min(validCandles.length, visibleBars);
    const hoverIdx = Math.min(validCandles.length - 1, Math.max(0, Math.floor(x / barSlot)));
    setHoverData({ x, y, candle: validCandles[hoverIdx] });
  };

  const handleDoubleClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const plotWidth = rect.width - 80;

    // Reset price scale and auto fit
    resetPriceScale();
    if (x < plotWidth) {
      setVisibleBars(75);
      setPanOffset(0);
    }
  };

  const handleMouseUp = () => setDragMode(null);
  const handleMouseLeave = () => {
    setDragMode(null);
    setHoverData(null);
  };`;

if (code.includes(oldMouseHandlers)) {
  code = code.replace(oldMouseHandlers, newMouseHandlers);
  console.log('Mouse handlers updated successfully.');
} else {
  console.error('Could not find oldMouseHandlers');
}

// 5. Update Root Container style for Expand / Fullscreen
const oldContainerStyle = `    <div
      ref={containerRef}
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #2a2e39',
        borderRadius: 8,
        background: '#131722',
        overflow: 'hidden',
        boxShadow: '0 10px 35px rgba(0,0,0,0.7)',
        userSelect: 'none',
        position: 'relative',
      }}
    >`;

const newContainerStyle = `    <div
      ref={containerRef}
      style={{
        width: isFullscreen ? '100vw' : '100%',
        height: isFullscreen ? '100vh' : 'auto',
        display: 'flex',
        flexDirection: 'column',
        border: isFullscreen ? 'none' : '1px solid #2a2e39',
        borderRadius: isFullscreen ? 0 : 8,
        background: '#131722',
        overflow: 'hidden',
        boxShadow: isFullscreen ? 'none' : '0 10px 35px rgba(0,0,0,0.7)',
        userSelect: 'none',
        position: isFullscreen ? 'fixed' : 'relative',
        top: isFullscreen ? 0 : 'auto',
        left: isFullscreen ? 0 : 'auto',
        right: isFullscreen ? 0 : 'auto',
        bottom: isFullscreen ? 0 : 'auto',
        zIndex: isFullscreen ? 99999 : 1,
        margin: 0,
        boxSizing: 'border-box',
      }}
    >`;

if (code.includes(oldContainerStyle)) {
  code = code.replace(oldContainerStyle, newContainerStyle);
  console.log('Container style updated successfully.');
} else {
  console.error('Could not find oldContainerStyle');
}

// 6. Update Top Toolbar with Reset Skala and Fullscreen Expand button
const oldToolbarReset = `          {/* Reset Zoom & Pan */}
          <button
            onClick={() => {
              setVisibleBars(75);
              setPanOffset(0);
            }}
            title="Reset Zoom & Pan ke Posisi Semula"
            style={{
              padding: '3px 7px',
              borderRadius: 4,
              fontSize: 9.5,
              fontWeight: 800,
              cursor: 'pointer',
              border: '1px solid #2a2e39',
              background: 'transparent',
              color: '#94a3b8',
            }}
          >
            ⟲ Reset
          </button>`;

const newToolbarReset = `          {/* Reset Zoom, Pan & Price Scale */}
          <button
            onClick={() => {
              setVisibleBars(75);
              setPanOffset(0);
              resetPriceScale();
            }}
            title="Reset Zoom, Pan & Skala Harga ke Standar"
            style={{
              padding: '3px 8px',
              borderRadius: 4,
              fontSize: 9.5,
              fontWeight: 800,
              cursor: 'pointer',
              border: !isAutoScaled ? '1px solid rgba(234, 179, 8, 0.5)' : '1px solid #2a2e39',
              background: !isAutoScaled ? 'rgba(234, 179, 8, 0.15)' : 'transparent',
              color: !isAutoScaled ? '#eab308' : '#94a3b8',
            }}
          >
            {!isAutoScaled ? '⟲ Reset Skala' : '⟲ Reset'}
          </button>

          {/* Fullscreen Expand Toggle Button */}
          <button
            onClick={() => setIsFullscreen(prev => !prev)}
            title={isFullscreen ? "Perkecil Tampilan Chart (Esc)" : "Perbesar Chart Penuh Layar (Expand / Fullscreen)"}
            style={{
              padding: '3px 9px',
              borderRadius: 4,
              fontSize: 9.5,
              fontWeight: 900,
              cursor: 'pointer',
              border: isFullscreen ? '1px solid #2962ff' : '1px solid #3b82f6',
              background: isFullscreen ? 'rgba(41, 98, 255, 0.35)' : 'rgba(59, 130, 246, 0.18)',
              color: isFullscreen ? '#93c5fd' : '#60a5fa',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span>{isFullscreen ? '🗗' : '⛶'}</span>
            <span>{isFullscreen ? 'KECILKAN' : 'EXPAND'}</span>
          </button>`;

if (code.includes(oldToolbarReset)) {
  code = code.replace(oldToolbarReset, newToolbarReset);
  console.log('Toolbar reset updated successfully.');
} else {
  console.error('Could not find oldToolbarReset');
}

// 7. Update Canvas element with dynamic height, cursorStyle, onDoubleClick, and bottom-right Auto & Expand badges
const oldCanvasElement = `          {/* Canvas Element with full-height interactive plotting */}
          <canvas
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            style={{
              width: '100%',
              height: activeSubPane !== 'none' ? 490 : 430,
              display: 'block',
              cursor: isDragging ? 'grabbing' : activeDrawingTool === 'crosshair' ? 'crosshair' : 'pointer',
            }}
          />`;

const newCanvasElement = `          {/* Bottom Right TradingView Axis Controls: Auto-Scale & Expand */}
          <div
            style={{
              position: 'absolute',
              bottom: 4,
              right: 6,
              zIndex: 25,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <button
              onClick={resetPriceScale}
              title={isAutoScaled ? "Skala Harga Otomatis Aktif" : "Klik untuk Reset Skala Harga (Auto-fit)"}
              style={{
                padding: '2px 6px',
                fontSize: 9,
                fontWeight: 900,
                borderRadius: 3,
                border: isAutoScaled ? '1px solid rgba(41, 98, 255, 0.4)' : '1px solid rgba(234, 179, 8, 0.6)',
                background: isAutoScaled ? 'rgba(41, 98, 255, 0.25)' : 'rgba(234, 179, 8, 0.25)',
                color: isAutoScaled ? '#38bdf8' : '#eab308',
                cursor: 'pointer',
                fontFamily: 'monospace',
              }}
            >
              {isAutoScaled ? 'Auto' : '⟲ Auto'}
            </button>

            <button
              onClick={() => setIsFullscreen(prev => !prev)}
              title={isFullscreen ? "Keluar Fullscreen (Esc)" : "Expand Chart Fullscreen"}
              style={{
                padding: '2px 6px',
                fontSize: 10,
                fontWeight: 900,
                borderRadius: 3,
                border: '1px solid #2a2e39',
                background: 'rgba(30, 34, 45, 0.85)',
                color: '#94a3b8',
                cursor: 'pointer',
              }}
            >
              {isFullscreen ? '🗗' : '⛶'}
            </button>
          </div>

          {/* Canvas Element with full-height interactive plotting */}
          <canvas
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onDoubleClick={handleDoubleClick}
            style={{
              width: '100%',
              height: isFullscreen
                ? Math.max(300, windowDimensions.height - 95 - (activeSubPane !== 'none' ? 95 : 0))
                : (activeSubPane !== 'none' ? 490 : 430),
              display: 'block',
              cursor: dragMode === 'priceScale' ? 'ns-resize' : dragMode === 'timeScale' ? 'ew-resize' : dragMode === 'pan' ? 'grabbing' : cursorStyle,
            }}
          />`;

if (code.includes(oldCanvasElement)) {
  code = code.replace(oldCanvasElement, newCanvasElement);
  console.log('Canvas element updated successfully.');
} else {
  console.error('Could not find oldCanvasElement');
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('All upgrades applied successfully.');

