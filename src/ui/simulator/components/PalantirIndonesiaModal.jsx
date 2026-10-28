/**
 * PalantirIndonesiaModal.jsx
 * JINI — PalantirIndonesia Intelligence
 * Enterprise Geospatial Intelligence & Territorial Reconnaissance Center
 */
import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  INDONESIA_CENTER,
  DEFAULT_ZOOM,
  REGIONS,
  MAP_STYLES,
  PROVINCES_DATA,
  STRATEGIC_NODES,
  MARITIME_CHOKEPOINTS,
  matchProvince,
} from '../../../services/geospatial/indonesiaGeoData.js';
import { conversationControllerInstance } from '../../../services/conversation/ConversationController.js';

export default function PalantirIndonesiaModal({ open, onClose }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState('ALL');
  const [activeStyle, setActiveStyle] = useState('DARK_INTELLIGENCE');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvince, setSelectedProvince] = useState(null);
  const [hoveredProvinceName, setHoveredProvinceName] = useState(null);
  const [cursorCoords, setCursorCoords] = useState({ lon: 118.0149, lat: -2.5489 });
  const [geoFeaturesCount, setGeoFeaturesCount] = useState(0);
  const [geoLoaded, setGeoLoaded] = useState(false);
  const [geoError, setGeoError] = useState(null);
  const [quickAiBrief, setQuickAiBrief] = useState(null);

  // Layer switches
  const [layers, setLayers] = useState({
    provinces: true,
    nodes: true,
    alki: true,
  });

  // Handle ESC key to close
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // Initialize MapLibre
  useEffect(() => {
    if (!open || !mapContainerRef.current) return;

    // Destroy existing map instance if any
    if (mapRef.current) {
      try {
        mapRef.current.remove();
      } catch (_) {}
      mapRef.current = null;
    }

    const styleDefinition = MAP_STYLES[activeStyle] || MAP_STYLES.DARK_INTELLIGENCE;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: styleDefinition,
      center: INDONESIA_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: 3.5,
      maxZoom: 16,
      attributionControl: false,
    });

    mapRef.current = map;

    // Controls
    map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    // Mouse coordinates tracking
    map.on('mousemove', (e) => {
      setCursorCoords({
        lon: Number(e.lngLat.lng.toFixed(4)),
        lat: Number(e.lngLat.lat.toFixed(4)),
      });
    });

    // When map finishes loading base style
    map.on('load', async () => {
      try {
        // Load Indonesia Provinces GeoJSON
        const res = await fetch('/data/indonesia-prov.geojson');
        if (!res.ok) throw new Error(`HTTP ${res.status} saat memuat data batas provinsi`);
        const geojsonData = await res.json();

        setGeoFeaturesCount(geojsonData.features?.length || 0);
        setGeoLoaded(true);

        // Add GeoJSON source
        if (!map.getSource('indonesia-provinces')) {
          map.addSource('indonesia-provinces', {
            type: 'geojson',
            data: geojsonData,
          });

          // Fill layer
          map.addLayer({
            id: 'indonesia-provinces-fill',
            type: 'fill',
            source: 'indonesia-provinces',
            layout: { visibility: layers.provinces ? 'visible' : 'none' },
            paint: {
              'fill-color': [
                'case',
                ['boolean', ['feature-state', 'selected'], false],
                'rgba(16, 185, 129, 0.45)', // Emerald selected
                ['boolean', ['feature-state', 'hover'], false],
                'rgba(0, 229, 255, 0.35)', // Cyan hovered
                'rgba(0, 229, 255, 0.08)', // Ambient cyan
              ],
              'fill-opacity': 0.85,
            },
          });

          // Border layer
          map.addLayer({
            id: 'indonesia-provinces-border',
            type: 'line',
            source: 'indonesia-provinces',
            layout: { visibility: layers.provinces ? 'visible' : 'none' },
            paint: {
              'line-color': [
                'case',
                ['boolean', ['feature-state', 'selected'], false],
                '#10b981',
                ['boolean', ['feature-state', 'hover'], false],
                '#00e5ff',
                'rgba(0, 229, 255, 0.45)',
              ],
              'line-width': [
                'case',
                ['boolean', ['feature-state', 'selected'], false],
                2.5,
                ['boolean', ['feature-state', 'hover'], false],
                2.0,
                0.9,
              ],
            },
          });
        }

        // ALKI LineString sources & layers
        const alkiGeoJSON = {
          type: 'FeatureCollection',
          features: MARITIME_CHOKEPOINTS.map((m, idx) => ({
            type: 'Feature',
            id: idx + 1,
            properties: { name: m.name },
            geometry: {
              type: 'LineString',
              coordinates: m.path,
            },
          })),
        };

        if (!map.getSource('indonesia-alki')) {
          map.addSource('indonesia-alki', {
            type: 'geojson',
            data: alkiGeoJSON,
          });

          map.addLayer({
            id: 'indonesia-alki-line',
            type: 'line',
            source: 'indonesia-alki',
            layout: { visibility: layers.alki ? 'visible' : 'none' },
            paint: {
              'line-color': '#f59e0b',
              'line-width': 2,
              'line-dasharray': [3, 2],
              'line-opacity': 0.85,
            },
          });
        }

        // Interactivity: Hover & Click
        let hoveredFeatureId = null;

        map.on('mousemove', 'indonesia-provinces-fill', (e) => {
          if (e.features.length > 0) {
            map.getCanvas().style.cursor = 'pointer';
            const f = e.features[0];
            const name = f.properties.Propinsi || f.properties.NAME_1 || f.properties.name || '';
            setHoveredProvinceName(name);

            if (hoveredFeatureId !== null) {
              map.setFeatureState(
                { source: 'indonesia-provinces', id: hoveredFeatureId },
                { hover: false }
              );
            }
            hoveredFeatureId = f.id ?? f.properties.ID ?? f.properties.kode ?? name;
            try {
              map.setFeatureState(
                { source: 'indonesia-provinces', id: hoveredFeatureId },
                { hover: true }
              );
            } catch (_) {}
          }
        });

        map.on('mouseleave', 'indonesia-provinces-fill', () => {
          map.getCanvas().style.cursor = '';
          setHoveredProvinceName(null);
          if (hoveredFeatureId !== null) {
            try {
              map.setFeatureState(
                { source: 'indonesia-provinces', id: hoveredFeatureId },
                { hover: false }
              );
            } catch (_) {}
            hoveredFeatureId = null;
          }
        });

        // Click on province
        map.on('click', 'indonesia-provinces-fill', (e) => {
          if (e.features.length > 0) {
            const f = e.features[0];
            const meta = matchProvince(f.properties);
            setSelectedProvince(meta);
            setQuickAiBrief(null);

            if (meta?.coordinates) {
              map.flyTo({
                center: meta.coordinates,
                zoom: meta.zoom || 7.5,
                duration: 1200,
                essential: true,
              });
            }
          }
        });

        // Add Tactical Pins for Strategic Nodes
        updatePinsOnMap(map);
      } catch (err) {
        console.error('[Palantir] Gagal memuat GeoJSON:', err);
        setGeoError(err.message || 'Gagal memuat batas provinsi');
      }
    });

    return () => {
      try {
        clearMarkers();
        map.remove();
      } catch (_) {}
      mapRef.current = null;
    };
  }, [open, activeStyle]);

  // Update layer visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    if (map.getLayer('indonesia-provinces-fill')) {
      map.setLayoutProperty('indonesia-provinces-fill', 'visibility', layers.provinces ? 'visible' : 'none');
    }
    if (map.getLayer('indonesia-provinces-border')) {
      map.setLayoutProperty('indonesia-provinces-border', 'visibility', layers.provinces ? 'visible' : 'none');
    }
    if (map.getLayer('indonesia-alki-line')) {
      map.setLayoutProperty('indonesia-alki-line', 'visibility', layers.alki ? 'visible' : 'none');
    }

    if (layers.nodes) {
      updatePinsOnMap(map);
    } else {
      clearMarkers();
    }
  }, [layers]);

  // Marker helper
  const clearMarkers = () => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
  };

  const updatePinsOnMap = (map) => {
    clearMarkers();
    if (!layers.nodes || !map) return;

    STRATEGIC_NODES.forEach((node) => {
      const el = document.createElement('div');
      el.className = 'palantir-node-marker';
      el.style.width = '14px';
      el.style.height = '14px';
      el.style.borderRadius = '999px';
      el.style.background = node.color;
      el.style.border = '2px solid #ffffff';
      el.style.boxShadow = `0 0 12px ${node.color}, 0 0 20px ${node.color}`;
      el.style.cursor = 'pointer';
      el.title = `${node.name} [${node.type}]`;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        map.flyTo({ center: node.coords, zoom: 9, duration: 1000 });
        // Find matching province
        for (const prov of Object.values(PROVINCES_DATA)) {
          if (prov.strategicProjects?.some((p) => p.toLowerCase().includes(node.name.toLowerCase()))) {
            setSelectedProvince(prov);
            break;
          }
        }
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(node.coords)
        .addTo(map);

      markersRef.current.push(marker);
    });
  };

  // Region Jump
  const handleRegionSelect = (regId) => {
    setSelectedRegion(regId);
    const reg = REGIONS.find((r) => r.id === regId);
    if (reg && mapRef.current) {
      mapRef.current.flyTo({
        center: reg.center,
        zoom: reg.zoom,
        duration: 1500,
        essential: true,
      });
    }
  };

  // Fly to province from list or search
  const handleSelectProvinceByName = (prov) => {
    setSelectedProvince(prov);
    setQuickAiBrief(null);
    if (mapRef.current && prov.coordinates) {
      mapRef.current.flyTo({
        center: prov.coordinates,
        zoom: prov.zoom || 7.5,
        duration: 1400,
        essential: true,
      });
    }
  };

  // AI Integration: send to JINI chat
  const handleSendToJiniChat = (prov) => {
    if (!prov) return;
    const prompt = `Analisis strategis intelijen geospasial untuk Provinsi ${prov.name} (${prov.code}):
PDRB: ${prov.grdp} (${prov.grdpShare})
Komoditas Utama: ${prov.commodities.map((c) => c.name).join(', ')}
Proyek Strategis Nasional: ${prov.strategicProjects.join(', ')}
Status Keamanan: ${prov.securityLevel}
Bagaimana evaluasi risiko investasi, geopolitik maritim, dan rekomendasi aksi kebijakan untuk wilayah ini?`;

    conversationControllerInstance.sendMessage(prompt);
    onClose?.();
  };

  // Instant In-Modal AI Brief
  const handleGenerateInModalBrief = (prov) => {
    if (!prov) return;
    setQuickAiBrief(
      `[JINI STRATEGIC DOSSIER // CLASSIFIED]\n` +
      `Wilayah: ${prov.name.toUpperCase()} (${prov.code})\n` +
      `Status Wilayah: ${prov.securityLevel}\n\n` +
      `1. ASESMEN KAPABILITAS EKONOMI:\n` +
      `Menyumbang ${prov.grdpShare} terhadap total perekonomian RI dengan nilai PDRB ${prov.grdp}. ` +
      `Pertumbuhan tercatat ${prov.growth} didorong oleh komoditas unggulan: ${prov.commodities.map((c) => c.name).join(' & ')}.\n\n` +
      `2. PROFIL STRATEGIS & INFRASTRUKTUR:\n` +
      `Terdapat ${prov.strategicProjects.length} proyek strategis nasional utama yang dipantau, termasuk ${prov.strategicProjects[0] || 'sentra konektivitas'}. ` +
      `Konektivitas maritim terhubung langsung dengan ${prov.infrastructure[0] || 'pelabuhan regional'}.\n\n` +
      `3. REKOMENDASI TAKTIS:\n` +
      `Tingkatkan mitigasi kerawanan rantai pasok dan akselerasi integrasi hilirisasi industri bernilai tambah tinggi.`
    );
  };

  if (!open) return null;

  // Filter provinces list for search
  const filteredProvinces = Object.values(PROVINCES_DATA).filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      p.capital.toLowerCase().includes(q) ||
      p.region.toLowerCase().includes(q) ||
      p.commodities.some((c) => c.name.toLowerCase().includes(q))
    );
  });

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(2, 6, 17, 0.85)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #050a14 0%, #081326 60%, #030812 100%)',
          border: '1px solid rgba(0, 229, 255, 0.35)',
          borderRadius: isFullscreen ? 0 : 14,
          boxShadow: '0 0 70px rgba(0, 229, 255, 0.2), 0 30px 90px rgba(0,0,0,0.95)',
          overflow: 'hidden',
          width: isFullscreen ? '100vw' : '96vw',
          maxWidth: isFullscreen ? '100vw' : '1500px',
          height: isFullscreen ? '100vh' : '92vh',
          transition: 'all 0.25s ease-out',
        }}
      >
        {/* ═══ HEADER BAR ═══ */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 18px',
            background: 'linear-gradient(90deg, rgba(0, 229, 255, 0.12) 0%, rgba(16, 185, 129, 0.05) 50%, rgba(0,0,0,0) 100%)',
            borderBottom: '1px solid rgba(0, 229, 255, 0.25)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'rgba(0, 229, 255, 0.15)',
                border: '1px solid #00e5ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 14px rgba(0, 229, 255, 0.4)',
                fontSize: 16,
              }}
            >
              🇮🇩
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: '0.15em', color: '#00e5ff', fontFamily: 'monospace' }}>
                  JINI // PALANTIR INDONESIA INTELLIGENCE
                </span>
                <span
                  style={{
                    fontSize: 8.5,
                    fontFamily: 'monospace',
                    fontWeight: 800,
                    padding: '1px 6px',
                    borderRadius: 4,
                    background: 'rgba(16, 185, 129, 0.2)',
                    color: '#34d399',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    letterSpacing: '0.08em',
                  }}
                >
                  LIVE OPERATIONAL
                </span>
              </div>
              <div style={{ fontSize: 9.5, color: 'rgba(148, 163, 184, 0.75)', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                NATIONAL GEOSPATIAL RECONNAISSANCE & TERRITORIAL ANALYTICS SYSTEM
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Coordinates HUD */}
            <div
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(0, 229, 255, 0.2)',
                fontFamily: 'monospace',
                fontSize: 9.5,
                color: '#38bdf8',
                display: 'none',
                smDisplay: 'block',
              }}
              className="hidden sm:block"
            >
              LAT: {cursorCoords.lat}° | LON: {cursorCoords.lon}° | WGS 84
            </div>

            {/* Fullscreen Toggle */}
            <button
              onClick={() => {
                setIsFullscreen(!isFullscreen);
                setTimeout(() => mapRef.current?.resize(), 260);
              }}
              style={{
                background: 'rgba(0, 229, 255, 0.1)',
                border: '1px solid rgba(0, 229, 255, 0.3)',
                color: '#00e5ff',
                borderRadius: 6,
                padding: '5px 10px',
                fontSize: 10,
                fontFamily: 'monospace',
                cursor: 'pointer',
              }}
              title={isFullscreen ? 'Restore' : 'Fullscreen'}
            >
              {isFullscreen ? '❐ RESTORE' : '⛶ EXPAND'}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#f87171',
                borderRadius: 6,
                padding: '5px 12px',
                fontSize: 12,
                fontWeight: 900,
                cursor: 'pointer',
              }}
              title="Tutup (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ═══ TOP CONTROL & FILTER BAR ═══ */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 16px',
            background: 'rgba(5, 12, 26, 0.9)',
            borderBottom: '1px solid rgba(0, 229, 255, 0.15)',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          {/* Quick Island Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#94a3b8', marginRight: 4 }}>
              PULAU:
            </span>
            {REGIONS.map((r) => (
              <button
                key={r.id}
                onClick={() => handleRegionSelect(r.id)}
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  fontFamily: 'monospace',
                  padding: '4px 8px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  border: `1px solid ${selectedRegion === r.id ? '#00e5ff' : 'rgba(255,255,255,0.1)'}`,
                  background: selectedRegion === r.id ? 'rgba(0, 229, 255, 0.2)' : 'rgba(0,0,0,0.3)',
                  color: selectedRegion === r.id ? '#00e5ff' : '#94a3b8',
                  boxShadow: selectedRegion === r.id ? '0 0 10px rgba(0, 229, 255, 0.3)' : 'none',
                }}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Search Box & Style Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Cari provinsi / kota / komoditas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  fontSize: 10,
                  fontFamily: 'monospace',
                  padding: '4px 10px 4px 26px',
                  borderRadius: 6,
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(0, 229, 255, 0.3)',
                  color: '#ffffff',
                  width: 220,
                  outline: 'none',
                }}
              />
              <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#00e5ff' }}>
                🔍
              </span>
            </div>

            {/* Map Style Toggle */}
            <div style={{ display: 'flex', border: '1px solid rgba(0,229,255,0.25)', borderRadius: 6, overflow: 'hidden' }}>
              <button
                onClick={() => setActiveStyle('DARK_INTELLIGENCE')}
                style={{
                  fontSize: 8.5,
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  padding: '4px 8px',
                  background: activeStyle === 'DARK_INTELLIGENCE' ? 'rgba(0, 229, 255, 0.25)' : 'rgba(0,0,0,0.4)',
                  color: activeStyle === 'DARK_INTELLIGENCE' ? '#00e5ff' : '#64748b',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                TACTICAL DARK
              </button>
              <button
                onClick={() => setActiveStyle('SATELLITE')}
                style={{
                  fontSize: 8.5,
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  padding: '4px 8px',
                  background: activeStyle === 'SATELLITE' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(0,0,0,0.4)',
                  color: activeStyle === 'SATELLITE' ? '#34d399' : '#64748b',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                SATELLITE
              </button>
            </div>

            {/* Layer Toggles */}
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => setLayers((s) => ({ ...s, provinces: !s.provinces }))}
                style={{
                  fontSize: 8.5,
                  fontFamily: 'monospace',
                  padding: '4px 6px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  border: `1px solid ${layers.provinces ? '#00e5ff' : '#475569'}`,
                  background: layers.provinces ? 'rgba(0,229,255,0.15)' : 'transparent',
                  color: layers.provinces ? '#00e5ff' : '#64748b',
                }}
                title="Toggle Batas Provinsi"
              >
                PROV
              </button>
              <button
                onClick={() => setLayers((s) => ({ ...s, nodes: !s.nodes }))}
                style={{
                  fontSize: 8.5,
                  fontFamily: 'monospace',
                  padding: '4px 6px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  border: `1px solid ${layers.nodes ? '#10b981' : '#475569'}`,
                  background: layers.nodes ? 'rgba(16,185,129,0.15)' : 'transparent',
                  color: layers.nodes ? '#34d399' : '#64748b',
                }}
                title="Toggle Titik Strategis"
              >
                NODES
              </button>
              <button
                onClick={() => setLayers((s) => ({ ...s, alki: !s.alki }))}
                style={{
                  fontSize: 8.5,
                  fontFamily: 'monospace',
                  padding: '4px 6px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  border: `1px solid ${layers.alki ? '#f59e0b' : '#475569'}`,
                  background: layers.alki ? 'rgba(245,158,11,0.15)' : 'transparent',
                  color: layers.alki ? '#fbbf24' : '#64748b',
                }}
                title="Toggle Alur Laut Kepulauan Indonesia (ALKI)"
              >
                ALKI
              </button>
            </div>
          </div>
        </div>

        {/* ═══ MAIN WORKSPACE (LEFT PANEL, MAP, RIGHT DOSSIER) ═══ */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>
          {/* ── LEFT TACTICAL LIST PANEL ── */}
          <div
            style={{
              width: 260,
              flexShrink: 0,
              background: 'rgba(5, 10, 20, 0.95)',
              borderRight: '1px solid rgba(0, 229, 255, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
            }}
          >
            {/* Quick Territorial Summary */}
            <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(0,229,255,0.12)' }}>
              <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#00e5ff', fontWeight: 800, letterSpacing: '0.08em', marginBottom: 6 }}>
                TERRITORIAL RECONNAISSANCE
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <div style={{ background: 'rgba(15,23,42,0.6)', padding: '6px 8px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: 8, color: '#94a3b8' }}>TOTAL PROVINSI</div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: '#38bdf8', fontFamily: 'monospace' }}>
                    {geoFeaturesCount || 34}
                  </div>
                </div>
                <div style={{ background: 'rgba(15,23,42,0.6)', padding: '6px 8px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: 8, color: '#94a3b8' }}>STRATEGIC NODES</div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: '#34d399', fontFamily: 'monospace' }}>
                    {STRATEGIC_NODES.length}
                  </div>
                </div>
              </div>
            </div>

            {/* Hot Strategic Zones */}
            <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(0,229,255,0.12)' }}>
              <div style={{ fontSize: 8.5, fontFamily: 'monospace', color: '#f59e0b', fontWeight: 800, letterSpacing: '0.08em', marginBottom: 6 }}>
                🔥 KORIDOR STRATEGIS PRIORITAS
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[
                  { name: 'IKN Nusantara (Kaltim)', key: 'KALIMANTAN TIMUR', tag: 'POLITICAL' },
                  { name: 'IMIP Morowali (Sulteng)', key: 'SULAWESI TENGAH', tag: 'NICKEL EV' },
                  { name: 'IWIP Weda Bay (Malut)', key: 'MALUKU UTARA', tag: 'SMELTER' },
                  { name: 'Grasberg (Papua)', key: 'PAPUA', tag: 'COPPER/GOLD' },
                  { name: 'Batam & Natuna (Kepri)', key: 'KEPULAUAN RIAU', tag: 'DEFENSE/DATA' },
                  { name: 'Blok Rokan (Riau)', key: 'RIAU', tag: 'OIL RESERVE' },
                ].map((item) => (
                  <button
                    key={item.name}
                    onClick={() => {
                      const prov = PROVINCES_DATA[item.key];
                      if (prov) handleSelectProvinceByName(prov);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '4px 6px',
                      borderRadius: 4,
                      background: 'rgba(15,23,42,0.5)',
                      border: '1px solid rgba(0,229,255,0.15)',
                      color: '#e2e8f0',
                      fontSize: 9.5,
                      fontFamily: 'monospace',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span>{item.name}</span>
                    <span style={{ fontSize: 7.5, color: '#00e5ff', padding: '1px 4px', background: 'rgba(0,229,255,0.1)', borderRadius: 2 }}>
                      {item.tag}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* All Provinces Directory */}
            <div style={{ flex: 1, padding: '10px 12px', overflowY: 'auto' }}>
              <div style={{ fontSize: 8.5, fontFamily: 'monospace', color: '#94a3b8', fontWeight: 700, marginBottom: 6 }}>
                DAFTAR WILAYAH ({filteredProvinces.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {filteredProvinces.map((prov) => {
                  const isSelected = selectedProvince?.code === prov.code;
                  return (
                    <button
                      key={prov.code}
                      onClick={() => handleSelectProvinceByName(prov)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '5px 8px',
                        borderRadius: 4,
                        background: isSelected ? 'rgba(0,229,255,0.2)' : 'rgba(15,23,42,0.3)',
                        border: `1px solid ${isSelected ? '#00e5ff' : 'rgba(255,255,255,0.05)'}`,
                        color: isSelected ? '#00e5ff' : '#cbd5e1',
                        fontSize: 9.5,
                        fontFamily: 'monospace',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700 }}>{prov.name}</div>
                        <div style={{ fontSize: 8, color: '#64748b' }}>{prov.capital}</div>
                      </div>
                      <span style={{ fontSize: 8, fontFamily: 'monospace', color: '#38bdf8' }}>
                        {prov.code}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── CENTER MAP CONTAINER ── */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

            {/* Hover Tooltip Overlay */}
            {hoveredProvinceName && (
              <div
                style={{
                  position: 'absolute',
                  top: 14,
                  left: 14,
                  padding: '6px 12px',
                  borderRadius: 6,
                  background: 'rgba(3, 7, 18, 0.85)',
                  border: '1px solid #00e5ff',
                  boxShadow: '0 0 16px rgba(0,229,255,0.35)',
                  pointerEvents: 'none',
                  zIndex: 20,
                  fontFamily: 'monospace',
                }}
              >
                <div style={{ fontSize: 8, color: '#94a3b8', letterSpacing: '0.1em' }}>TARGET IDENTIFIED:</div>
                <div style={{ fontSize: 12, fontWeight: 900, color: '#00e5ff' }}>
                  {hoveredProvinceName}
                </div>
              </div>
            )}

            {/* Map Legend Overlay */}
            <div
              style={{
                position: 'absolute',
                bottom: 14,
                right: 14,
                padding: '8px 12px',
                borderRadius: 6,
                background: 'rgba(3, 7, 18, 0.85)',
                border: '1px solid rgba(0,229,255,0.2)',
                fontFamily: 'monospace',
                fontSize: 8.5,
                color: '#cbd5e1',
                zIndex: 20,
                pointerEvents: 'none',
              }}
            >
              <div style={{ fontWeight: 800, color: '#00e5ff', marginBottom: 4, letterSpacing: '0.08em' }}>
                TACTICAL OVERLAY
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(0,229,255,0.35)', border: '1px solid #00e5ff' }} />
                  <span>Batas Administratif Provinsi</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
                  <span>Titik Strategis Mineral / EV</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: '#f59e0b', boxShadow: '0 0 6px #f59e0b' }} />
                  <span>Cadangan Migas & Tambang Masif</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 12, height: 2, background: '#f59e0b' }} />
                  <span>ALKI Sea Lanes (Alur Maritim)</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT TERRITORIAL INTELLIGENCE DOSSIER ── */}
          <div
            style={{
              width: 360,
              flexShrink: 0,
              background: 'rgba(5, 10, 22, 0.96)',
              borderLeft: '1px solid rgba(0, 229, 255, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
            }}
          >
            {selectedProvince ? (
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Dossier Header */}
                <div style={{ borderBottom: '1px solid rgba(0,229,255,0.18)', paddingBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#00e5ff', fontWeight: 900 }}>
                      TERRITORIAL DOSSIER // {selectedProvince.code}
                    </span>
                    <span
                      style={{
                        fontSize: 8,
                        fontFamily: 'monospace',
                        padding: '1px 6px',
                        borderRadius: 3,
                        background: 'rgba(16,185,129,0.15)',
                        color: '#34d399',
                        border: '1px solid rgba(16,185,129,0.3)',
                      }}
                    >
                      {selectedProvince.region}
                    </span>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#ffffff', marginTop: 4 }}>
                    {selectedProvince.name}
                  </div>
                  <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>
                    Ibu Kota: <strong style={{ color: '#e2e8f0' }}>{selectedProvince.capital}</strong>
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 8,
                      fontFamily: 'monospace',
                      padding: '3px 6px',
                      borderRadius: 4,
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#f87171',
                    }}
                  >
                    STATUS: {selectedProvince.securityLevel}
                  </div>
                </div>

                {/* Macro Intelligence Metrics */}
                <div>
                  <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#38bdf8', fontWeight: 800, marginBottom: 6 }}>
                    INDIKATOR MAKRO & KONTRIBUSI PDB
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <div style={{ background: 'rgba(15,23,42,0.6)', padding: '6px 8px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: 8, color: '#94a3b8' }}>PDRB (HARGA BERLAKU)</div>
                      <div style={{ fontSize: 12, fontWeight: 900, color: '#38bdf8', fontFamily: 'monospace' }}>
                        {selectedProvince.grdp}
                      </div>
                      <div style={{ fontSize: 8, color: '#64748b' }}>{selectedProvince.grdpShare}</div>
                    </div>
                    <div style={{ background: 'rgba(15,23,42,0.6)', padding: '6px 8px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: 8, color: '#94a3b8' }}>LAJU PERTUMBUHAN</div>
                      <div style={{ fontSize: 12, fontWeight: 900, color: '#34d399', fontFamily: 'monospace' }}>
                        {selectedProvince.growth}
                      </div>
                      <div style={{ fontSize: 8, color: '#64748b' }}>YoY Real Growth</div>
                    </div>
                    <div style={{ background: 'rgba(15,23,42,0.6)', padding: '6px 8px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: 8, color: '#94a3b8' }}>POPULASI</div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#e2e8f0', fontFamily: 'monospace' }}>
                        {selectedProvince.population}
                      </div>
                    </div>
                    <div style={{ background: 'rgba(15,23,42,0.6)', padding: '6px 8px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: 8, color: '#94a3b8' }}>IPM (HUMAN DEV)</div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#e2e8f0', fontFamily: 'monospace' }}>
                        {selectedProvince.hdi}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Strategic Commodities */}
                <div>
                  <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#10b981', fontWeight: 800, marginBottom: 6 }}>
                    KOMODITAS & SUMBER DAYA KRITIS
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {selectedProvince.commodities.map((c, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '4px 8px',
                          borderRadius: 4,
                          background: 'rgba(16,185,129,0.08)',
                          border: '1px solid rgba(16,185,129,0.2)',
                          fontSize: 9.5,
                          fontFamily: 'monospace',
                        }}
                      >
                        <span style={{ color: '#e2e8f0' }}>{c.name}</span>
                        <span style={{ fontSize: 8, color: '#34d399', fontWeight: 700 }}>
                          {c.level}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Strategic National Projects (PSN) */}
                <div>
                  <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#f59e0b', fontWeight: 800, marginBottom: 6 }}>
                    PROYEK STRATEGIS NASIONAL (PSN)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {selectedProvince.strategicProjects.map((p, idx) => (
                      <div
                        key={idx}
                        style={{
                          fontSize: 9,
                          fontFamily: 'monospace',
                          padding: '4px 6px',
                          background: 'rgba(245,158,11,0.06)',
                          borderLeft: '2px solid #f59e0b',
                          color: '#e2e8f0',
                        }}
                      >
                        {p}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Brief Intelligence Summary */}
                <div style={{ background: 'rgba(15,23,42,0.8)', padding: '10px', borderRadius: 6, border: '1px solid rgba(0,229,255,0.2)' }}>
                  <div style={{ fontSize: 8.5, fontFamily: 'monospace', color: '#00e5ff', fontWeight: 800, marginBottom: 4 }}>
                    TACTICAL SUMMARY
                  </div>
                  <div style={{ fontSize: 9.5, color: '#cbd5e1', lineHeight: 1.4 }}>
                    {selectedProvince.brief}
                  </div>
                </div>

                {/* In-Modal AI Brief Output (if generated) */}
                {quickAiBrief && (
                  <div
                    style={{
                      background: 'rgba(6, 18, 38, 0.9)',
                      border: '1px solid #10b981',
                      borderRadius: 6,
                      padding: '10px',
                      fontFamily: 'monospace',
                      fontSize: 9,
                      color: '#a7f3d0',
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.4,
                      boxShadow: '0 0 16px rgba(16,185,129,0.2)',
                    }}
                  >
                    {quickAiBrief}
                  </div>
                )}

                {/* Action Buttons: JINI AI Integration */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                  <button
                    onClick={() => handleGenerateInModalBrief(selectedProvince)}
                    style={{
                      padding: '8px',
                      borderRadius: 6,
                      background: 'rgba(16,185,129,0.2)',
                      border: '1px solid #10b981',
                      color: '#34d399',
                      fontSize: 10,
                      fontWeight: 800,
                      fontFamily: 'monospace',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      boxShadow: '0 0 10px rgba(16,185,129,0.25)',
                    }}
                  >
                    <span>⚡</span>
                    <span>QUICK TACTICAL AI BRIEF</span>
                  </button>

                  <button
                    onClick={() => handleSendToJiniChat(selectedProvince)}
                    style={{
                      padding: '8px',
                      borderRadius: 6,
                      background: 'rgba(0,229,255,0.2)',
                      border: '1px solid #00e5ff',
                      color: '#00e5ff',
                      fontSize: 10,
                      fontWeight: 800,
                      fontFamily: 'monospace',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      boxShadow: '0 0 12px rgba(0,229,255,0.25)',
                    }}
                  >
                    <span>💬</span>
                    <span>TANYAKAN KE JINI AI CHAT</span>
                  </button>
                </div>
              </div>
            ) : (
              /* When no province is selected */
              <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ borderBottom: '1px solid rgba(0,229,255,0.18)', paddingBottom: 10 }}>
                  <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#00e5ff', fontWeight: 900 }}>
                    NATIONAL OVERVIEW // KEDAULATAN NKRI
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#ffffff', marginTop: 4 }}>
                    Republik Indonesia
                  </div>
                  <div style={{ fontSize: 9.5, color: '#94a3b8', fontFamily: 'monospace' }}>
                    17.500+ Pulau | 1.905.000 km² Daratan | ALKI I, II, III
                  </div>
                </div>

                <div style={{ background: 'rgba(15,23,42,0.7)', padding: '10px', borderRadius: 6, border: '1px solid rgba(0,229,255,0.15)' }}>
                  <div style={{ fontSize: 8.5, fontFamily: 'monospace', color: '#00e5ff', fontWeight: 800, marginBottom: 4 }}>
                    INSTRUKSI OPERASI:
                  </div>
                  <div style={{ fontSize: 9.5, color: '#cbd5e1', lineHeight: 1.4 }}>
                    Klik pada area peta provinsi atau pilih dari direktori sebelah kiri untuk membuka berkas intelijen terperinci, indikator ekonomi makro, cadangan sumber daya, dan proyek strategis nasional.
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#f59e0b', fontWeight: 800, marginBottom: 6 }}>
                    ALUR LAUT KEPULAUAN INDONESIA (ALKI)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ background: 'rgba(15,23,42,0.5)', padding: '6px 8px', borderRadius: 4, borderLeft: '2px solid #f59e0b' }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#e2e8f0' }}>ALKI I</div>
                      <div style={{ fontSize: 8, color: '#94a3b8' }}>Selat Sunda - Selat Karimata - Laut Natuna Utara</div>
                    </div>
                    <div style={{ background: 'rgba(15,23,42,0.5)', padding: '6px 8px', borderRadius: 4, borderLeft: '2px solid #f59e0b' }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#e2e8f0' }}>ALKI II</div>
                      <div style={{ fontSize: 8, color: '#94a3b8' }}>Selat Lombok - Selat Makassar - Laut Sulawesi</div>
                    </div>
                    <div style={{ background: 'rgba(15,23,42,0.5)', padding: '6px 8px', borderRadius: 4, borderLeft: '2px solid #f59e0b' }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#e2e8f0' }}>ALKI III</div>
                      <div style={{ fontSize: 8, color: '#94a3b8' }}>Laut Sawu/Banda - Laut Maluku - Samudera Pasifik</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ FOOTER HUD STATUS BAR ═══ */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 16px',
            background: 'rgba(2, 6, 17, 0.95)',
            borderTop: '1px solid rgba(0, 229, 255, 0.2)',
            fontSize: 8.5,
            fontFamily: 'monospace',
            color: '#64748b',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: geoLoaded ? '#34d399' : '#f87171' }}>
              ● {geoLoaded ? `GEOJSON: ${geoFeaturesCount} FEATURES SYNCHRONIZED` : geoError ? `ERROR: ${geoError}` : 'LOADING BOUNDARIES...'}
            </span>
            <span>|</span>
            <span>STYLE: {activeStyle}</span>
            <span>|</span>
            <span>PROJECTION: MERCATOR WGS 84</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: '#00e5ff' }}>JINI PALANTIR CORE v1.0</span>
            <span>|</span>
            <span>LATENCY: 14ms</span>
          </div>
        </div>
      </div>
    </div>
  );
}
