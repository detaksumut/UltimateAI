/**
 * DrawingToolsOverlay.jsx
 * Professional Interactive SVG Drawing Layer for Lightweight Charts v5.
 *
 * Implements:
 * 1. Trendline (diagonal ray / line with anchor handles)
 * 2. Horizontal Line (full-width guide with price label)
 * 3. Rectangle (custom range / area box)
 * 4. Supply & Demand Zones (Manual & Auto-detected overlay)
 * 5. Fibonacci Retracement (Standard 0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0 with price labels)
 * 6. Select, Move, Edit, and Delete (Keyboard Delete/Backspace, Drag Handles, Color Picker)
 * 7. Step-by-step Tool Guidance Banner (Point 1 -> Point 2)
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Trash2, X } from 'lucide-react';

const FIB_LEVELS = [
  { level: 0.0, color: '#787b86', label: '0.0 (0%)' },
  { level: 0.236, color: '#f23645', label: '0.236 (23.6%)' },
  { level: 0.382, color: '#ff9800', label: '0.382 (38.2%)' },
  { level: 0.5, color: '#4caf50', label: '0.500 (50.0%)' },
  { level: 0.618, color: '#089981', label: '0.618 (Golden Pocket)' },
  { level: 0.786, color: '#2962ff', label: '0.786 (78.6%)' },
  { level: 1.0, color: '#787b86', label: '1.0 (100%)' },
];

const PRESET_COLORS = ['#38bdf8', '#089981', '#f23645', '#eab308', '#c084fc', '#ffffff'];

export default function DrawingToolsOverlay({
  chart,
  candleSeries,
  drawings = [],
  activeTool = 'cursor',
  selectedId = null,
  onSelectDrawing = () => {},
  onUpdateDrawing = () => {},
  onDeleteDrawing = () => {},
  onCreateDrawing = () => {},
  onFinishTool = () => {},
  autoSdZones = null,
  showAutoSdZones = true,
  containerRef,
  lwcCandles = [],
}) {
  const [viewVersion, setViewVersion] = useState(0);
  const [draftDrawing, setDraftDrawing] = useState(null);
  const [dragState, setDragState] = useState(null); // { id, handle: 'p1'|'p2'|'body', startCoords, origDrawing }
  const lastEventTimeRef = useRef(0);

  // Force re-render whenever chart pans, scales, or resizes
  useEffect(() => {
    if (!chart) return;
    const triggerUpdate = () => setViewVersion(v => (v + 1) % 100000);

    const timeScale = chart.timeScale();
    try {
      timeScale.subscribeVisibleLogicalRangeChange(triggerUpdate);
      timeScale.subscribeVisibleTimeRangeChange(triggerUpdate);
    } catch (_) {}

    return () => {
      try {
        timeScale.unsubscribeVisibleLogicalRangeChange(triggerUpdate);
        timeScale.unsubscribeVisibleTimeRangeChange(triggerUpdate);
      } catch (_) {}
    };
  }, [chart]);

  // Safe time resolution from coordinate X
  const getSafeTime = useCallback((timeScale, x) => {
    let t = timeScale.coordinateToTime(x);
    if (t !== null && t !== undefined) return t;

    // Fallback: map logical coordinate to closest candle timestamp
    const logical = timeScale.coordinateToLogical(x);
    if (logical !== null && lwcCandles && lwcCandles.length > 0) {
      const idx = Math.max(0, Math.min(lwcCandles.length - 1, Math.round(logical)));
      return lwcCandles[idx]?.time || null;
    }
    return null;
  }, [lwcCandles]);

  // Coordinate projection helpers
  const projectCoords = useCallback((time, logical, price) => {
    if (!chart || !candleSeries) return null;
    let x = null;
    const timeScale = chart.timeScale();

    if (time !== null && time !== undefined) {
      x = timeScale.timeToCoordinate(time);
    }
    if ((x === null || !Number.isFinite(x)) && logical !== null && logical !== undefined) {
      x = timeScale.logicalToCoordinate(logical);
    }
    const y = candleSeries.priceToCoordinate(price);

    if (x === null || y === null || !Number.isFinite(x) || !Number.isFinite(y)) {
      return null;
    }
    return { x, y };
  }, [chart, candleSeries]);

  const screenToWorld = useCallback((clientX, clientY) => {
    if (!containerRef?.current || !chart || !candleSeries) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const timeScale = chart.timeScale();
    const logical = timeScale.coordinateToLogical(x);
    const time = getSafeTime(timeScale, x);
    const price = candleSeries.coordinateToPrice(y);

    if (price === null || !Number.isFinite(price)) return null;

    return {
      x,
      y,
      time: time ?? null,
      logical: logical ?? null,
      price: Number(price.toFixed(2)),
    };
  }, [containerRef, chart, candleSeries, getSafeTime]);

  // Keyboard shortcut: Delete or Backspace to remove selected drawing
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (selectedId && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        onDeleteDrawing(selectedId);
      } else if (e.key === 'Escape') {
        if (draftDrawing) setDraftDrawing(null);
        onFinishTool();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, draftDrawing, onDeleteDrawing, onFinishTool]);

  // User click / pointer down handler
  const handleUserClick = (e) => {
    if (e.button !== 0) return; // only left click
    const now = Date.now();
    if (now - lastEventTimeRef.current < 60) return; // debounce double events
    lastEventTimeRef.current = now;

    const coords = screenToWorld(e.clientX, e.clientY);
    if (!coords) return;

    // 1. Drawing creation mode
    if (activeTool !== 'cursor') {
      e.stopPropagation();

      if (activeTool === 'horizontal') {
        // Horizontal line requires only 1 click
        const newDrawing = {
          id: `h_${Date.now()}`,
          type: 'horizontal',
          price: coords.price,
          color: '#eab308',
          width: 1.5,
          style: 'dashed',
          label: `H-Line $${coords.price.toFixed(2)}`,
        };
        onCreateDrawing(newDrawing);
        onFinishTool();
        return;
      }

      if (!draftDrawing) {
        // First click: anchor point 1
        const draft = {
          id: `d_${Date.now()}`,
          type: activeTool,
          time1: coords.time,
          logical1: coords.logical,
          price1: coords.price,
          time2: coords.time,
          logical2: coords.logical,
          price2: coords.price,
          color: activeTool === 'sd_supply' ? '#f23645'
            : activeTool === 'sd_demand' ? '#089981'
            : activeTool === 'rectangle' ? '#c084fc'
            : activeTool === 'fibonacci' ? '#38bdf8'
            : '#38bdf8',
          fillColor: activeTool === 'sd_supply' ? 'rgba(242, 54, 69, 0.2)'
            : activeTool === 'sd_demand' ? 'rgba(8, 153, 129, 0.2)'
            : activeTool === 'rectangle' ? 'rgba(192, 132, 252, 0.15)'
            : undefined,
          label: activeTool === 'sd_supply' ? 'SUPPLY ZONE'
            : activeTool === 'sd_demand' ? 'DEMAND ZONE'
            : undefined,
        };
        setDraftDrawing(draft);
      } else {
        // Second click: finalize drawing
        const finalDrawing = {
          ...draftDrawing,
          time2: coords.time,
          logical2: coords.logical,
          price2: coords.price,
        };
        onCreateDrawing(finalDrawing);
        setDraftDrawing(null);
        onFinishTool();
      }
      return;
    }

    // 2. Cursor mode: if clicked empty space, deselect
    if (selectedId && !dragState) {
      onSelectDrawing(null);
    }
  };

  const handlePointerMove = (e) => {
    const coords = screenToWorld(e.clientX, e.clientY);
    if (!coords) return;

    // Update draft preview
    if (draftDrawing) {
      setDraftDrawing(prev => ({
        ...prev,
        time2: coords.time,
        logical2: coords.logical,
        price2: coords.price,
      }));
      return;
    }

    // Handle dragging of existing drawing
    if (dragState) {
      e.stopPropagation();
      const { id, handle, startCoords, origDrawing } = dragState;
      const target = drawings.find(d => d.id === id);
      if (!target) return;

      const deltaPrice = coords.price - startCoords.price;
      const deltaLogical = (coords.logical ?? 0) - (startCoords.logical ?? 0);

      if (target.type === 'horizontal') {
        onUpdateDrawing({ ...target, price: Number(coords.price.toFixed(2)) });
        return;
      }

      if (handle === 'p1') {
        onUpdateDrawing({
          ...target,
          time1: coords.time ?? target.time1,
          logical1: coords.logical ?? target.logical1,
          price1: Number(coords.price.toFixed(2)),
        });
      } else if (handle === 'p2') {
        onUpdateDrawing({
          ...target,
          time2: coords.time ?? target.time2,
          logical2: coords.logical ?? target.logical2,
          price2: Number(coords.price.toFixed(2)),
        });
      } else if (handle === 'body') {
        onUpdateDrawing({
          ...target,
          logical1: (origDrawing.logical1 ?? 0) + deltaLogical,
          logical2: (origDrawing.logical2 ?? 0) + deltaLogical,
          price1: Number((origDrawing.price1 + deltaPrice).toFixed(2)),
          price2: Number((origDrawing.price2 + deltaPrice).toFixed(2)),
        });
      }
    }
  };

  const handlePointerUp = () => {
    if (dragState) {
      setDragState(null);
    }
  };

  // Start dragging a handle
  const startDragHandle = (e, drawing, handle) => {
    e.stopPropagation();
    const coords = screenToWorld(e.clientX, e.clientY);
    if (!coords) return;
    onSelectDrawing(drawing.id);
    setDragState({
      id: drawing.id,
      handle,
      startCoords: coords,
      origDrawing: { ...drawing },
    });
  };

  // Selected drawing floating action pill position
  const selectedDrawing = useMemo(() => drawings.find(d => d.id === selectedId), [drawings, selectedId]);
  const actionPillPos = useMemo(() => {
    if (!selectedDrawing) return null;
    if (selectedDrawing.type === 'horizontal') {
      const y = candleSeries?.priceToCoordinate(selectedDrawing.price);
      return y !== null && Number.isFinite(y) ? { x: 80, y: Math.max(10, y - 36) } : null;
    }
    const pt1 = projectCoords(selectedDrawing.time1, selectedDrawing.logical1, selectedDrawing.price1);
    const pt2 = projectCoords(selectedDrawing.time2, selectedDrawing.logical2, selectedDrawing.price2);
    if (!pt1 && !pt2) return null;
    const x = pt1 && pt2 ? (pt1.x + pt2.x) / 2 : (pt1 ? pt1.x : pt2.x);
    const y = pt1 && pt2 ? Math.min(pt1.y, pt2.y) : (pt1 ? pt1.y : pt2.y);
    return { x: Math.max(50, x - 60), y: Math.max(10, y - 40) };
  }, [selectedDrawing, projectCoords, candleSeries, viewVersion]);

  // RENDER DRAWING ITEMS
  const renderDrawing = (drawing, isDraft = false) => {
    const isSelected = selectedId === drawing.id;

    // HORIZONTAL LINE
    if (drawing.type === 'horizontal') {
      const y = candleSeries?.priceToCoordinate(drawing.price);
      if (y === null || !Number.isFinite(y)) return null;

      return (
        <g key={drawing.id} className="drawing-item">
          <line
            x1="0"
            y1={y}
            x2="100%"
            y2={y}
            stroke={drawing.color || '#eab308'}
            strokeWidth={isSelected ? 2.5 : drawing.width || 1.5}
            strokeDasharray={drawing.style === 'dashed' ? '5,5' : undefined}
            style={{ cursor: activeTool === 'cursor' ? 'ns-resize' : 'crosshair' }}
            pointerEvents="stroke"
            onPointerDown={(e) => startDragHandle(e, drawing, 'body')}
          />
          {/* Label badge */}
          <rect
            x={10}
            y={y - 10}
            width={90}
            height={18}
            rx={3}
            fill="#1e222d"
            stroke={drawing.color || '#eab308'}
            strokeWidth={1}
            pointerEvents="none"
          />
          <text
            x={15}
            y={y + 3}
            fill="#e2e8f0"
            fontSize={10}
            fontFamily="monospace"
            fontWeight="bold"
            pointerEvents="none"
          >
            ${drawing.price.toFixed(2)}
          </text>
        </g>
      );
    }

    // TWO-POINT DRAWINGS
    const pt1 = projectCoords(drawing.time1, drawing.logical1, drawing.price1);
    const pt2 = projectCoords(drawing.time2, drawing.logical2, drawing.price2);
    if (!pt1 || !pt2) return null;

    // 1. TRENDLINE
    if (drawing.type === 'trendline') {
      return (
        <g key={drawing.id} className="drawing-item">
          {/* Wide transparent hover stroke for easy clicking */}
          <line
            x1={pt1.x}
            y1={pt1.y}
            x2={pt2.x}
            y2={pt2.y}
            stroke="transparent"
            strokeWidth={16}
            pointerEvents="stroke"
            style={{ cursor: activeTool === 'cursor' ? 'grab' : 'crosshair' }}
            onPointerDown={(e) => startDragHandle(e, drawing, 'body')}
          />
          <line
            x1={pt1.x}
            y1={pt1.y}
            x2={pt2.x}
            y2={pt2.y}
            stroke={drawing.color || '#38bdf8'}
            strokeWidth={isSelected ? 3 : 2}
            pointerEvents="none"
          />
          {/* Endpoint Handles */}
          {(isSelected || isDraft) && (
            <>
              <circle
                cx={pt1.x}
                cy={pt1.y}
                r={6}
                fill="#ffffff"
                stroke={drawing.color || '#38bdf8'}
                strokeWidth={2}
                pointerEvents="all"
                style={{ cursor: 'move' }}
                onPointerDown={(e) => startDragHandle(e, drawing, 'p1')}
              />
              <circle
                cx={pt2.x}
                cy={pt2.y}
                r={6}
                fill="#ffffff"
                stroke={drawing.color || '#38bdf8'}
                strokeWidth={2}
                pointerEvents="all"
                style={{ cursor: 'move' }}
                onPointerDown={(e) => startDragHandle(e, drawing, 'p2')}
              />
            </>
          )}
        </g>
      );
    }

    // 2. RECTANGLE OR S&D ZONE
    if (drawing.type === 'rectangle' || drawing.type === 'sd_zone' || drawing.type === 'sd_supply' || drawing.type === 'sd_demand') {
      const rx = Math.min(pt1.x, pt2.x);
      const ry = Math.min(pt1.y, pt2.y);
      const rw = Math.max(8, Math.abs(pt2.x - pt1.x));
      const rh = Math.max(6, Math.abs(pt2.y - pt1.y));
      const isSupply = drawing.kind === 'supply' || drawing.type === 'sd_supply';
      const isDemand = drawing.kind === 'demand' || drawing.type === 'sd_demand';
      const strokeColor = drawing.color || (isSupply ? '#f23645' : isDemand ? '#089981' : '#c084fc');
      const fillColor = drawing.fillColor || (isSupply ? 'rgba(242, 54, 69, 0.18)' : isDemand ? 'rgba(8, 153, 129, 0.18)' : 'rgba(192, 132, 252, 0.15)');

      return (
        <g key={drawing.id} className="drawing-item">
          <rect
            x={rx}
            y={ry}
            width={rw}
            height={rh}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={isSelected ? 2 : 1}
            pointerEvents="all"
            style={{ cursor: activeTool === 'cursor' ? 'move' : 'crosshair' }}
            onPointerDown={(e) => startDragHandle(e, drawing, 'body')}
          />
          {drawing.label && (
            <text
              x={rx + 6}
              y={ry + 14}
              fill={strokeColor}
              fontSize={10}
              fontFamily="sans-serif"
              fontWeight="bold"
              pointerEvents="none"
            >
              {drawing.label}
            </text>
          )}
          {/* Handles */}
          {(isSelected || isDraft) && (
            <>
              <circle
                cx={pt1.x}
                cy={pt1.y}
                r={6}
                fill="#fff"
                stroke={strokeColor}
                strokeWidth={2}
                pointerEvents="all"
                style={{ cursor: 'nwse-resize' }}
                onPointerDown={(e) => startDragHandle(e, drawing, 'p1')}
              />
              <circle
                cx={pt2.x}
                cy={pt2.y}
                r={6}
                fill="#fff"
                stroke={strokeColor}
                strokeWidth={2}
                pointerEvents="all"
                style={{ cursor: 'nwse-resize' }}
                onPointerDown={(e) => startDragHandle(e, drawing, 'p2')}
              />
            </>
          )}
        </g>
      );
    }

    // 3. FIBONACCI RETRACEMENT
    if (drawing.type === 'fibonacci') {
      const minX = Math.min(pt1.x, pt2.x);
      const maxX = Math.max(pt1.x, pt2.x);
      const p1 = drawing.price1;
      const p2 = drawing.price2;
      const diff = p2 - p1;

      return (
        <g key={drawing.id} className="drawing-item">
          {/* Base trend ray */}
          <line
            x1={pt1.x}
            y1={pt1.y}
            x2={pt2.x}
            y2={pt2.y}
            stroke="rgba(255, 255, 255, 0.3)"
            strokeDasharray="3,3"
            strokeWidth={1}
            pointerEvents="none"
          />

          {/* Fibonacci horizontal levels */}
          {FIB_LEVELS.map(({ level, color, label }) => {
            const levelPrice = p1 + diff * level;
            const y = candleSeries?.priceToCoordinate(levelPrice);
            if (y === null || !Number.isFinite(y)) return null;

            return (
              <g key={level}>
                <line
                  x1={minX}
                  y1={y}
                  x2={maxX + 120}
                  y2={y}
                  stroke={color}
                  strokeWidth={level === 0.618 ? 2 : 1}
                  strokeDasharray={level === 0.618 ? undefined : '2,2'}
                  pointerEvents="none"
                />
                <text
                  x={maxX + 10}
                  y={y - 3}
                  fill={color}
                  fontSize={9}
                  fontFamily="monospace"
                  fontWeight="bold"
                  pointerEvents="none"
                >
                  {label} ${levelPrice.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* Transparent hit area */}
          <rect
            x={minX}
            y={Math.min(pt1.y, pt2.y)}
            width={Math.max(20, maxX - minX + 120)}
            height={Math.max(20, Math.abs(pt2.y - pt1.y))}
            fill="transparent"
            pointerEvents="all"
            style={{ cursor: activeTool === 'cursor' ? 'move' : 'crosshair' }}
            onPointerDown={(e) => startDragHandle(e, drawing, 'body')}
          />

          {/* Anchors */}
          {(isSelected || isDraft) && (
            <>
              <circle
                cx={pt1.x}
                cy={pt1.y}
                r={6}
                fill="#fff"
                stroke="#38bdf8"
                strokeWidth={2}
                pointerEvents="all"
                style={{ cursor: 'move' }}
                onPointerDown={(e) => startDragHandle(e, drawing, 'p1')}
              />
              <circle
                cx={pt2.x}
                cy={pt2.y}
                r={6}
                fill="#fff"
                stroke="#38bdf8"
                strokeWidth={2}
                pointerEvents="all"
                style={{ cursor: 'move' }}
                onPointerDown={(e) => startDragHandle(e, drawing, 'p2')}
              />
            </>
          )}
        </g>
      );
    }

    return null;
  };

  // AUTO-DETECTED S&D ZONES (from SupplyDemandDetector.js)
  const renderAutoSdZones = () => {
    if (!showAutoSdZones || !autoSdZones || !candleSeries) return null;

    return (
      <g className="auto-sd-zones" pointerEvents="none">
        {/* Supply Zones */}
        {(autoSdZones.supply || []).map((zone, idx) => {
          const yTop = candleSeries.priceToCoordinate(zone.high);
          const yBottom = candleSeries.priceToCoordinate(zone.low);
          if (yTop === null || yBottom === null) return null;
          const y = Math.min(yTop, yBottom);
          const h = Math.max(4, Math.abs(yBottom - yTop));

          return (
            <g key={`auto_sup_${idx}`}>
              <rect
                x="0"
                y={y}
                width="100%"
                height={h}
                fill="rgba(242, 54, 69, 0.12)"
                stroke="rgba(242, 54, 69, 0.6)"
                strokeWidth={1}
                strokeDasharray="4,4"
              />
              <text
                x="12"
                y={y + 12}
                fill="#fca5a5"
                fontSize={9.5}
                fontFamily="sans-serif"
                fontWeight="bold"
              >
                {zone.testCount > 0 ? `TESTED SUPPLY (${zone.testCount}x)` : 'FRESH SUPPLY'}{' '}
                [${zone.low?.toFixed(2)} - ${zone.high?.toFixed(2)}]
              </text>
            </g>
          );
        })}

        {/* Demand Zones */}
        {(autoSdZones.demand || []).map((zone, idx) => {
          const yTop = candleSeries.priceToCoordinate(zone.high);
          const yBottom = candleSeries.priceToCoordinate(zone.low);
          if (yTop === null || yBottom === null) return null;
          const y = Math.min(yTop, yBottom);
          const h = Math.max(4, Math.abs(yBottom - yTop));

          return (
            <g key={`auto_dem_${idx}`}>
              <rect
                x="0"
                y={y}
                width="100%"
                height={h}
                fill="rgba(8, 153, 129, 0.12)"
                stroke="rgba(8, 153, 129, 0.6)"
                strokeWidth={1}
                strokeDasharray="4,4"
              />
              <text
                x="12"
                y={y + 12}
                fill="#86efac"
                fontSize={9.5}
                fontFamily="sans-serif"
                fontWeight="bold"
              >
                {zone.testCount > 0 ? `TESTED DEMAND (${zone.testCount}x)` : 'FRESH DEMAND'}{' '}
                [${zone.low?.toFixed(2)} - ${zone.high?.toFixed(2)}]
              </text>
            </g>
          );
        })}
      </g>
    );
  };

  const isInteracting = activeTool !== 'cursor' || Boolean(draftDrawing) || Boolean(dragState);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: isInteracting ? 'auto' : 'none',
        zIndex: 15,
        overflow: 'hidden',
      }}
    >
      {/* ── Floating Tool Guidance Banner ── */}
      {activeTool !== 'cursor' && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.94)',
            border: '1px solid #38bdf8',
            borderRadius: 6,
            padding: '5px 12px',
            color: '#38bdf8',
            fontSize: 11,
            fontWeight: 800,
            boxShadow: '0 4px 20px rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            zIndex: 30,
            pointerEvents: 'auto',
          }}
        >
          <span>
            {activeTool === 'trendline' && (draftDrawing ? '📍 Klik Titik 2 untuk menyelesaikan Garis Trend' : '📍 Klik Titik 1 pada Chart')}
            {activeTool === 'horizontal' && '📍 Klik Level Harga pada Chart untuk memasang Garis Horizontal'}
            {activeTool === 'rectangle' && (draftDrawing ? '📍 Klik Sudut 2 untuk menyelesaikan Kotak' : '📍 Klik Sudut 1 pada Chart')}
            {activeTool === 'fibonacci' && (draftDrawing ? '📍 Klik Titik 2 (Swing End)' : '📍 Klik Titik 1 (Swing Start)')}
            {activeTool === 'sd_supply' && (draftDrawing ? '📍 Klik Sudut 2 untuk menyelesaikan Zona Supply' : '📍 Klik Sudut 1 Zona Supply')}
            {activeTool === 'sd_demand' && (draftDrawing ? '📍 Klik Sudut 2 untuk menyelesaikan Zona Demand' : '📍 Klik Sudut 1 Zona Demand')}
          </span>
          <button
            onClick={() => {
              setDraftDrawing(null);
              onFinishTool();
            }}
            style={{
              background: 'rgba(239, 68, 68, 0.25)',
              border: '1px solid rgba(239, 68, 68, 0.5)',
              color: '#fca5a5',
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 10,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Batal (Esc)
          </button>
        </div>
      )}

      <svg
        style={{
          width: '100%',
          height: '100%',
          pointerEvents: isInteracting ? 'auto' : 'none',
          cursor: activeTool === 'cursor' ? 'default' : 'crosshair',
        }}
        onPointerDown={handleUserClick}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* 1. Auto S&D Zones */}
        {renderAutoSdZones()}

        {/* 2. Committed User Drawings */}
        {drawings.map(d => renderDrawing(d, false))}

        {/* 3. In-progress Draft Drawing */}
        {draftDrawing && renderDrawing(draftDrawing, true)}
      </svg>

      {/* 4. Floating Action Toolbar for Selected Drawing */}
      {selectedDrawing && actionPillPos && activeTool === 'cursor' && (
        <div
          style={{
            position: 'absolute',
            left: actionPillPos.x,
            top: actionPillPos.y,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: '#1e222d',
            border: '1px solid #38bdf8',
            borderRadius: 6,
            padding: '4px 8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.7)',
            pointerEvents: 'auto',
            zIndex: 20,
          }}
        >
          {/* Color presets */}
          <div style={{ display: 'flex', gap: 3 }}>
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateDrawing({ ...selectedDrawing, color: c });
                }}
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: c,
                  border: selectedDrawing.color === c ? '2px solid #fff' : '1px solid rgba(0,0,0,0.4)',
                  cursor: 'pointer',
                  padding: 0,
                }}
              />
            ))}
          </div>

          <div style={{ width: 1, height: 16, background: '#334155' }} />

          {/* Delete button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteDrawing(selectedDrawing.id);
            }}
            title="Delete drawing (Del)"
            style={{
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#f87171',
              borderRadius: 4,
              padding: '2px 5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            <Trash2 size={12} />
            Hapus
          </button>

          {/* Close selection */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelectDrawing(null);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: 1,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
