/**
 * PalantirIndonesiaModal.jsx
 * JINI — PalantirIndonesia Intelligence
 * Enterprise Geospatial Intelligence, Territorial Reconnaissance & National CCTV Optical Integration
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
import {
  cctvRegistryInstance,
  CAMERA_CATEGORIES,
  NATIONAL_ADMIN_DIVISIONS,
} from '../../../services/cctv/cctvRegistry.js';
import { cctvDiscoveryEngineInstance } from '../../../services/cctv/discoveryEngine.js';
import { cctvHealthMonitorInstance } from '../../../services/cctv/healthMonitor.js';
import CCTVPlayer from './CCTVPlayer.jsx';
import { conversationControllerInstance } from '../../../services/conversation/ConversationController.js';

export default function PalantirIndonesiaModal({ open, onClose }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  // Navigation & View Modes
  const [activeTab, setActiveTab] = useState('TERRITORIAL'); // 'TERRITORIAL' | 'CCTV_RECON'
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState('ALL');
  const [activeStyle, setActiveStyle] = useState('DARK_INTELLIGENCE');
  const [searchQuery, setSearchQuery] = useState('');
  const [cursorCoords, setCursorCoords] = useState({ lon: 118.0149, lat: -2.5489 });
  const [currentZoom, setCurrentZoom] = useState(DEFAULT_ZOOM);
  const [currentPitch, setCurrentPitch] = useState(0);

  // Territorial states
  const [selectedProvince, setSelectedProvince] = useState(null);
  const [hoveredProvinceName, setHoveredProvinceName] = useState(null);
  const [geoFeaturesCount, setGeoFeaturesCount] = useState(0);
  const [geoLoaded, setGeoLoaded] = useState(false);
  const [geoError, setGeoError] = useState(null);
  const [quickAiBrief, setQuickAiBrief] = useState(null);

  // CCTV states
  const [cctvCameras, setCctvCameras] = useState(() => cctvRegistryInstance.getAll());
  const [cctvStats, setCctvStats] = useState(() => cctvRegistryInstance.getStats());
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [cctvCategory, setCctvCategory] = useState('ALL');
  const [cctvProvince, setCctvProvince] = useState('ALL');
  const [cctvPlayableOnly, setCctvPlayableOnly] = useState(false);
  const [discoveryRunning, setDiscoveryRunning] = useState(false);
  const [discoveryFeedback, setDiscoveryFeedback] = useState(null);
  const [healthProbeRunning, setHealthProbeRunning] = useState(false);
  const [probeProgress, setProbeProgress] = useState(null);

  // Layer switches
  const [layers, setLayers] = useState({
    provinces: true,
    nodes: true,
    alki: true,
    cctv: true,
    buildings: true,
  });

  // Subscribe to CCTV registry updates
  useEffect(() => {
    const unsub = cctvRegistryInstance.subscribe((cams) => {
      setCctvCameras([...cams]);
      setCctvStats(cctvRegistryInstance.getStats());
    });
    return () => unsub();
  }, []);

  // Handle ESC key to close
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // Build GeoJSON for CCTV Cameras
  const buildCctvGeoJSON = (cameras) => ({
    type: 'FeatureCollection',
    features: cameras.map((cam) => ({
      type: 'Feature',
      id: cam.camera_id,
      properties: {
        camera_id: cam.camera_id,
        camera_name: cam.camera_name,
        category: cam.category,
        operator: cam.operator,
        stream_status: cam.stream_status,
        stream_protocol: cam.stream_protocol,
        access_status: cam.access_status,
        color: CAMERA_CATEGORIES[cam.category]?.color || '#00e5ff',
      },
      geometry: {
        type: 'Point',
        coordinates: [cam.longitude, cam.latitude],
      },
    })),
  });

  // Filtered CCTV cameras
  const filteredCctvCameras = cctvRegistryInstance.filter({
    provinceCode: cctvProvince,
    category: cctvCategory,
    onlyPlayable: cctvPlayableOnly,
    query: searchQuery,
  });

  // Initialize MapLibre
  useEffect(() => {
    if (!open || !mapContainerRef.current) return;

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
      minZoom: 3.0,
      maxZoom: 20.0,
      maxPitch: 65,
      pitchWithRotate: true,
      attributionControl: false,
    });

    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    map.on('mousemove', (e) => {
      setCursorCoords({
        lon: Number(e.lngLat.lng.toFixed(4)),
        lat: Number(e.lngLat.lat.toFixed(4)),
      });
    });

    map.on('zoom', () => {
      setCurrentZoom(Number(map.getZoom().toFixed(1)));
    });

    map.on('pitch', () => {
      setCurrentPitch(Math.round(map.getPitch()));
    });

    map.on('load', async () => {
      try {
        // 1. Load Indonesia Provinces GeoJSON
        const res = await fetch('/data/indonesia-prov.geojson');
        if (!res.ok) throw new Error(`HTTP ${res.status} saat memuat data batas provinsi`);
        const geojsonData = await res.json();

        setGeoFeaturesCount(geojsonData.features?.length || 0);
        setGeoLoaded(true);

        if (!map.getSource('indonesia-provinces')) {
          map.addSource('indonesia-provinces', {
            type: 'geojson',
            data: geojsonData,
          });

          map.addLayer({
            id: 'indonesia-provinces-fill',
            type: 'fill',
            source: 'indonesia-provinces',
            layout: { visibility: layers.provinces ? 'visible' : 'none' },
            paint: {
              'fill-color': [
                'case',
                ['boolean', ['feature-state', 'selected'], false],
                'rgba(16, 185, 129, 0.45)',
                ['boolean', ['feature-state', 'hover'], false],
                'rgba(0, 229, 255, 0.35)',
                'rgba(0, 229, 255, 0.08)',
              ],
              'fill-opacity': 0.85,
            },
          });

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

        // 2. ALKI LineString sources & layers
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

        // 3. CCTV Clustered Source & Layers
        if (!map.getSource('cctv-cameras')) {
          map.addSource('cctv-cameras', {
            type: 'geojson',
            data: buildCctvGeoJSON(cctvRegistryInstance.getAll()),
            cluster: true,
            clusterMaxZoom: 14,
            clusterRadius: 50,
          });

          // Clusters Circle
          map.addLayer({
            id: 'cctv-clusters',
            type: 'circle',
            source: 'cctv-cameras',
            filter: ['has', 'point_count'],
            layout: { visibility: layers.cctv ? 'visible' : 'none' },
            paint: {
              'circle-color': [
                'step',
                ['get', 'point_count'],
                '#00e5ff',
                4,
                '#10b981',
                10,
                '#f59e0b',
              ],
              'circle-radius': [
                'step',
                ['get', 'point_count'],
                16,
                4,
                22,
                10,
                28,
              ],
              'circle-opacity': 0.85,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
            },
          });

          // Cluster count label
          map.addLayer({
            id: 'cctv-cluster-count',
            type: 'symbol',
            source: 'cctv-cameras',
            filter: ['has', 'point_count'],
            layout: {
              visibility: layers.cctv ? 'visible' : 'none',
              'text-field': '{point_count_abbreviated}',
              'text-size': 11,
              'text-allow-overlap': true,
            },
            paint: {
              'text-color': '#020617',
            },
          });

          // Unclustered single camera points
          map.addLayer({
            id: 'cctv-unclustered-point',
            type: 'circle',
            source: 'cctv-cameras',
            filter: ['!', ['has', 'point_count']],
            layout: { visibility: layers.cctv ? 'visible' : 'none' },
            paint: {
              'circle-color': ['get', 'color'],
              'circle-radius': 8,
              'circle-stroke-width': 2.5,
              'circle-stroke-color': '#ffffff',
            },
          });

          // Cluster click -> zoom in
          map.on('click', 'cctv-clusters', (e) => {
            const features = map.queryRenderedFeatures(e.point, { layers: ['cctv-clusters'] });
            const clusterId = features[0].properties.cluster_id;
            map.getSource('cctv-cameras').getClusterExpansionZoom(clusterId, (err, zoom) => {
              if (err) return;
              map.easeTo({
                center: features[0].geometry.coordinates,
                zoom: zoom,
              });
            });
          });

          // Single point click -> select camera
          map.on('click', 'cctv-unclustered-point', (e) => {
            if (e.features.length > 0) {
              const camId = e.features[0].properties.camera_id;
              const cam = cctvRegistryInstance.getById(camId);
              if (cam) {
                setSelectedCamera(cam);
                setSelectedProvince(null);
                setActiveTab('CCTV_RECON');
                map.flyTo({
                  center: [cam.longitude, cam.latitude],
                  zoom: 13,
                  duration: 1000,
                });
              }
            }
          });

          map.on('mouseenter', 'cctv-clusters', () => (map.getCanvas().style.cursor = 'pointer'));
          map.on('mouseleave', 'cctv-clusters', () => (map.getCanvas().style.cursor = ''));
          map.on('mouseenter', 'cctv-unclustered-point', () => (map.getCanvas().style.cursor = 'pointer'));
          map.on('mouseleave', 'cctv-unclustered-point', () => (map.getCanvas().style.cursor = ''));
        }

        // 4. Authentic 3D Building Extrusions (from OpenMapTiles / OpenFreeMap planet source)
        if (!map.getSource('openmaptiles-buildings')) {
          map.addSource('openmaptiles-buildings', {
            type: 'vector',
            url: 'https://tiles.openfreemap.org/planet',
          });

          map.addLayer({
            id: '3d-buildings',
            source: 'openmaptiles-buildings',
            'source-layer': 'building',
            type: 'fill-extrusion',
            minzoom: 14.0,
            layout: {
              visibility: layers.buildings ? 'visible' : 'none',
            },
            paint: {
              'fill-extrusion-color': [
                'interpolate',
                ['linear'],
                ['coalesce', ['get', 'render_height'], 15],
                0, '#0a101d',
                20, '#1e293b',
                60, '#334155',
                120, '#0284c7',
                250, '#00e5ff'
              ],
              'fill-extrusion-height': [
                'interpolate',
                ['linear'],
                ['zoom'],
                14.0, 0,
                15.0, ['coalesce', ['get', 'render_height'], 12]
              ],
              'fill-extrusion-base': [
                'interpolate',
                ['linear'],
                ['zoom'],
                14.0, 0,
                15.0, ['coalesce', ['get', 'render_min_height'], 0]
              ],
              'fill-extrusion-opacity': 0.8,
            },
          });
        }

        // Province hover & click
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

        map.on('click', 'indonesia-provinces-fill', (e) => {
          if (e.features.length > 0) {
            const f = e.features[0];
            const meta = matchProvince(f.properties);
            setSelectedProvince(meta);
            setSelectedCamera(null);
            setQuickAiBrief(null);
            setActiveTab('TERRITORIAL');

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

  // Sync CCTV Source data when cameras change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const src = map.getSource('cctv-cameras');
    if (src) {
      src.setData(buildCctvGeoJSON(filteredCctvCameras));
    }
  }, [cctvCameras, cctvProvince, cctvCategory, cctvPlayableOnly, searchQuery]);

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
    if (map.getLayer('cctv-clusters')) {
      map.setLayoutProperty('cctv-clusters', 'visibility', layers.cctv ? 'visible' : 'none');
    }
    if (map.getLayer('cctv-cluster-count')) {
      map.setLayoutProperty('cctv-cluster-count', 'visibility', layers.cctv ? 'visible' : 'none');
    }
    if (map.getLayer('cctv-unclustered-point')) {
      map.setLayoutProperty('cctv-unclustered-point', 'visibility', layers.cctv ? 'visible' : 'none');
    }
    if (map.getLayer('3d-buildings')) {
      map.setLayoutProperty('3d-buildings', 'visibility', layers.buildings ? 'visible' : 'none');
    }

    if (layers.nodes) {
      updatePinsOnMap(map);
    } else {
      clearMarkers();
    }
  }, [layers]);

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
        for (const prov of Object.values(PROVINCES_DATA)) {
          if (prov.strategicProjects?.some((p) => p.toLowerCase().includes(node.name.toLowerCase()))) {
            setSelectedProvince(prov);
            setSelectedCamera(null);
            setActiveTab('TERRITORIAL');
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

  const handleSelectProvinceByName = (prov) => {
    setSelectedProvince(prov);
    setSelectedCamera(null);
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

  const handleSelectCamera = (cam) => {
    setSelectedCamera(cam);
    setSelectedProvince(null);
    setActiveTab('CCTV_RECON');
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [cam.longitude, cam.latitude],
        zoom: 16.5,
        pitch: 45,
        duration: 1200,
        essential: true,
      });
    }
  };

  const handleZoomPreset = (preset) => {
    const map = mapRef.current;
    if (!map) return;
    if (preset === 'NATIONAL') {
      map.flyTo({ center: INDONESIA_CENTER, zoom: 4.8, pitch: 0, bearing: 0, duration: 1000 });
    } else if (preset === 'PROVINCE') {
      const center = selectedProvince ? selectedProvince.coordinates : [106.8456, -6.2088];
      map.flyTo({ center, zoom: 8.5, pitch: 0, bearing: 0, duration: 1000 });
    } else if (preset === 'CITY') {
      const center = selectedCamera ? [selectedCamera.longitude, selectedCamera.latitude] : [106.8231, -6.1951];
      map.flyTo({ center, zoom: 13.5, pitch: 20, bearing: 0, duration: 1000 });
    } else if (preset === 'BUILDINGS_3D') {
      const center = selectedCamera ? [selectedCamera.longitude, selectedCamera.latitude] : [106.8231, -6.1951];
      map.flyTo({ center, zoom: 17.5, pitch: 55, bearing: -25, duration: 1200 });
      setLayers((s) => ({ ...s, buildings: true }));
    }
  };

  // Run Discovery Connectors
  const handleTriggerDiscovery = async () => {
    setDiscoveryRunning(true);
    setDiscoveryFeedback('Scanning BPJT, Dishub ATCS, Pelindo feeds...');
    try {
      const res = await cctvDiscoveryEngineInstance.runAllConnectors();
      setDiscoveryFeedback(`Scan Berhasil: +${res.total_added} kamera terdaftar.`);
      setTimeout(() => setDiscoveryFeedback(null), 4000);
    } catch (err) {
      setDiscoveryFeedback(`Error scan: ${err.message}`);
    } finally {
      setDiscoveryRunning(false);
    }
  };

  // Run Health Probe
  const handleTriggerHealthProbe = async () => {
    setHealthProbeRunning(true);
    setProbeProgress({ completed: 0, total: cctvCameras.length });
    try {
      await cctvHealthMonitorInstance.runNationalHealthCheck((p) => {
        setProbeProgress(p);
      });
    } finally {
      setHealthProbeRunning(false);
      setProbeProgress(null);
    }
  };

  // Send to JINI Chat
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

  const handleSendCameraToJiniChat = (cam) => {
    if (!cam) return;
    const prompt = `Analisis status titik pemantauan CCTV ${cam.camera_id} (${cam.camera_name}):
Lokasi: ${cam.district_code || ''}, ${cam.province_code} [${cam.latitude}, ${cam.longitude}]
Kategori: ${cam.category}
Operator: ${cam.operator}
Status Stream: ${cam.stream_status}
Protokol: ${cam.stream_protocol}
Bagaimana analisis kerawanan pergerakan logistik/lalu lintas dan rekomendasi pengawasan taktis di titik ini?`;

    conversationControllerInstance.sendMessage(prompt);
    onClose?.();
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
          maxWidth: isFullscreen ? '100vw' : '1540px',
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
                NATIONAL GEOSPATIAL RECONNAISSANCE, TERRITORIAL ANALYTICS & CCTV INTEGRATION
              </div>
            </div>
          </div>

          {/* Submode Switcher Tabs */}
          <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.4)', padding: 3, borderRadius: 6, border: '1px solid rgba(0,229,255,0.2)' }}>
            <button
              onClick={() => setActiveTab('TERRITORIAL')}
              style={{
                padding: '4px 10px',
                borderRadius: 4,
                border: 'none',
                background: activeTab === 'TERRITORIAL' ? 'rgba(0,229,255,0.25)' : 'transparent',
                color: activeTab === 'TERRITORIAL' ? '#00e5ff' : '#94a3b8',
                fontSize: 9.5,
                fontWeight: 800,
                fontFamily: 'monospace',
                cursor: 'pointer',
              }}
            >
              🗺️ WILAYAH & STRATEGIS
            </button>
            <button
              onClick={() => setActiveTab('CCTV_RECON')}
              style={{
                padding: '4px 10px',
                borderRadius: 4,
                border: 'none',
                background: activeTab === 'CCTV_RECON' ? 'rgba(16,185,129,0.25)' : 'transparent',
                color: activeTab === 'CCTV_RECON' ? '#34d399' : '#94a3b8',
                fontSize: 9.5,
                fontWeight: 800,
                fontFamily: 'monospace',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span>📹 CCTV OPTICAL RECON</span>
              <span
                style={{
                  fontSize: 8,
                  padding: '1px 5px',
                  borderRadius: 99,
                  background: (cctvStats.verified_playable || 0) > 0 ? '#10b981' : 'rgba(100, 116, 139, 0.4)',
                  color: (cctvStats.verified_playable || 0) > 0 ? '#020617' : '#94a3b8',
                  fontWeight: 900,
                }}
              >
                {cctvStats.verified_playable || 0} VERIFIED LIVE // {cctvStats.total_registered || cctvStats.total} REG
              </span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(0, 229, 255, 0.2)',
                fontFamily: 'monospace',
                fontSize: 9.5,
                color: '#38bdf8',
              }}
              className="hidden sm:block"
            >
              LAT: {cursorCoords.lat}° | LON: {cursorCoords.lon}° | ZOOM: {currentZoom}x | PITCH: {currentPitch}°
            </div>

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
            >
              {isFullscreen ? '❐ RESTORE' : '⛶ EXPAND'}
            </button>

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
                }}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Search Box & Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder={activeTab === 'CCTV_RECON' ? 'Cari CCTV / operator / lokasi...' : 'Cari provinsi / kota / komoditas...'}
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
              >
                ALKI
              </button>
              <button
                onClick={() => setLayers((s) => ({ ...s, cctv: !s.cctv }))}
                style={{
                  fontSize: 8.5,
                  fontFamily: 'monospace',
                  padding: '4px 6px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  border: `1px solid ${layers.cctv ? '#ec4899' : '#475569'}`,
                  background: layers.cctv ? 'rgba(236,72,153,0.15)' : 'transparent',
                  color: layers.cctv ? '#f472b6' : '#64748b',
                }}
              >
                CCTV
              </button>
              <button
                onClick={() => setLayers((s) => ({ ...s, buildings: !s.buildings }))}
                style={{
                  fontSize: 8.5,
                  fontFamily: 'monospace',
                  padding: '4px 6px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  border: `1px solid ${layers.buildings ? '#38bdf8' : '#475569'}`,
                  background: layers.buildings ? 'rgba(56,189,248,0.2)' : 'transparent',
                  color: layers.buildings ? '#38bdf8' : '#64748b',
                }}
                title="Tampilkan Bentuk Gedung 3D (Zoom >= 14)"
              >
                3D GEDUNG
              </button>
            </div>

            {/* Quick Tactical Zoom Presets */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'rgba(0,0,0,0.4)', padding: '2px', borderRadius: 4, border: '1px solid rgba(0,229,255,0.2)' }}>
              <span style={{ fontSize: 7.5, fontFamily: 'monospace', color: '#94a3b8', padding: '0 4px' }}>ZOOM:</span>
              <button
                onClick={() => handleZoomPreset('NATIONAL')}
                style={{ fontSize: 7.5, fontFamily: 'monospace', padding: '2px 5px', borderRadius: 2, border: 'none', background: currentZoom < 7 ? 'rgba(0,229,255,0.25)' : 'transparent', color: currentZoom < 7 ? '#00e5ff' : '#94a3b8', cursor: 'pointer' }}
                title="Zoom Nasional (1:50M)"
              >
                NASIONAL
              </button>
              <button
                onClick={() => handleZoomPreset('PROVINCE')}
                style={{ fontSize: 7.5, fontFamily: 'monospace', padding: '2px 5px', borderRadius: 2, border: 'none', background: currentZoom >= 7 && currentZoom < 11 ? 'rgba(0,229,255,0.25)' : 'transparent', color: currentZoom >= 7 && currentZoom < 11 ? '#00e5ff' : '#94a3b8', cursor: 'pointer' }}
                title="Zoom Provinsi (1:5M)"
              >
                PROVINSI
              </button>
              <button
                onClick={() => handleZoomPreset('CITY')}
                style={{ fontSize: 7.5, fontFamily: 'monospace', padding: '2px 5px', borderRadius: 2, border: 'none', background: currentZoom >= 11 && currentZoom < 16 ? 'rgba(0,229,255,0.25)' : 'transparent', color: currentZoom >= 11 && currentZoom < 16 ? '#00e5ff' : '#94a3b8', cursor: 'pointer' }}
                title="Zoom Perkotaan (1:50k)"
              >
                KOTA
              </button>
              <button
                onClick={() => handleZoomPreset('BUILDINGS_3D')}
                style={{ fontSize: 7.5, fontFamily: 'monospace', padding: '2px 5px', borderRadius: 2, border: 'none', background: currentZoom >= 16 ? 'rgba(56,189,248,0.3)' : 'transparent', color: currentZoom >= 16 ? '#38bdf8' : '#94a3b8', cursor: 'pointer', fontWeight: 800 }}
                title="Zoom Kawasan Gedung 3D (1:5k Oblique Tilt)"
              >
                3D BLOK
              </button>
            </div>
          </div>
        </div>

        {/* ═══ MAIN WORKSPACE (LEFT PANEL, MAP, RIGHT DOSSIER) ═══ */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>
          {/* ── LEFT TACTICAL LIST PANEL ── */}
          <div
            style={{
              width: 280,
              flexShrink: 0,
              background: 'rgba(5, 10, 20, 0.95)',
              borderRight: '1px solid rgba(0, 229, 255, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
            }}
          >
            {activeTab === 'CCTV_RECON' ? (
              /* CCTV Mode Left Panel */
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Discovery & Health Actions */}
                <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(0,229,255,0.15)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={handleTriggerDiscovery}
                      disabled={discoveryRunning}
                      style={{
                        flex: 1,
                        padding: '6px',
                        borderRadius: 4,
                        background: 'rgba(0, 229, 255, 0.15)',
                        border: '1px solid #00e5ff',
                        color: '#00e5ff',
                        fontSize: 9,
                        fontWeight: 800,
                        fontFamily: 'monospace',
                        cursor: discoveryRunning ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {discoveryRunning ? 'SCANNING...' : '⚡ DISCOVERY SCAN'}
                    </button>
                    <button
                      onClick={handleTriggerHealthProbe}
                      disabled={healthProbeRunning}
                      style={{
                        flex: 1,
                        padding: '6px',
                        borderRadius: 4,
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid #10b981',
                        color: '#34d399',
                        fontSize: 9,
                        fontWeight: 800,
                        fontFamily: 'monospace',
                        cursor: healthProbeRunning ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {healthProbeRunning ? `PROBING (${probeProgress?.completed}/${probeProgress?.total})` : '🩺 DIAGNOSTIK'}
                    </button>
                  </div>
                  {discoveryFeedback && (
                    <div style={{ fontSize: 8.5, color: '#38bdf8', fontFamily: 'monospace' }}>
                      {discoveryFeedback}
                    </div>
                  )}

                  {/* Filter Dropdowns */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                    <select
                      value={cctvCategory}
                      onChange={(e) => setCctvCategory(e.target.value)}
                      style={{
                        background: 'rgba(15,23,42,0.8)',
                        border: '1px solid rgba(0,229,255,0.2)',
                        borderRadius: 4,
                        color: '#e2e8f0',
                        fontSize: 9,
                        fontFamily: 'monospace',
                        padding: '4px',
                      }}
                    >
                      <option value="ALL">SEMUA KATEGORI ({cctvCameras.length})</option>
                      {Object.values(CAMERA_CATEGORIES).map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.icon} {cat.label}
                        </option>
                      ))}
                    </select>

                    <select
                      value={cctvProvince}
                      onChange={(e) => setCctvProvince(e.target.value)}
                      style={{
                        background: 'rgba(15,23,42,0.8)',
                        border: '1px solid rgba(0,229,255,0.2)',
                        borderRadius: 4,
                        color: '#e2e8f0',
                        fontSize: 9,
                        fontFamily: 'monospace',
                        padding: '4px',
                      }}
                    >
                      <option value="ALL">SEMUA PROVINSI</option>
                      {NATIONAL_ADMIN_DIVISIONS.map((prov) => (
                        <option key={prov.code} value={prov.code}>
                          {prov.code} - {prov.name}
                        </option>
                      ))}
                    </select>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 8.5, color: '#34d399', fontFamily: 'monospace', cursor: 'pointer', marginTop: 2 }}>
                      <input
                        type="checkbox"
                        checked={cctvPlayableOnly}
                        onChange={(e) => setCctvPlayableOnly(e.target.checked)}
                      />
                      Hanya Yang Dapat Diputar (LIVE)
                    </label>
                  </div>
                </div>

                {/* CCTV Cameras List */}
                <div style={{ flex: 1, padding: '10px 12px', overflowY: 'auto' }}>
                  <div style={{ fontSize: 8.5, fontFamily: 'monospace', color: '#94a3b8', fontWeight: 700, marginBottom: 6 }}>
                    KAMERA TERDAFTAR ({filteredCctvCameras.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {filteredCctvCameras.map((cam) => {
                      const isSelected = selectedCamera?.camera_id === cam.camera_id;
                      const catInfo = CAMERA_CATEGORIES[cam.category] || {};
                      const isLive = cam.stream_status === 'ONLINE';

                      return (
                        <button
                          key={cam.camera_id}
                          onClick={() => handleSelectCamera(cam)}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2,
                            padding: '6px 8px',
                            borderRadius: 4,
                            background: isSelected ? 'rgba(0, 229, 255, 0.2)' : 'rgba(15, 23, 42, 0.4)',
                            border: `1px solid ${isSelected ? '#00e5ff' : 'rgba(255,255,255,0.06)'}`,
                            color: '#e2e8f0',
                            fontSize: 9.5,
                            fontFamily: 'monospace',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 700, color: isSelected ? '#00e5ff' : '#e2e8f0' }}>
                              {catInfo.icon || '📹'} {cam.camera_name}
                            </span>
                            <span
                              style={{
                                fontSize: 7.5,
                                padding: '1px 4px',
                                borderRadius: 2,
                                background:
                                  cam.location_verification === 'VERIFIED_LOCATION' && cam.stream_playability === 'PLAYABLE'
                                    ? 'rgba(16,185,129,0.2)'
                                    : cam.access_status === 'REQUIRES_ACCESS'
                                    ? 'rgba(245,158,11,0.2)'
                                    : 'rgba(100,116,139,0.25)',
                                color:
                                  cam.location_verification === 'VERIFIED_LOCATION' && cam.stream_playability === 'PLAYABLE'
                                    ? '#34d399'
                                    : cam.access_status === 'REQUIRES_ACCESS'
                                    ? '#fbbf24'
                                    : '#94a3b8',
                                border: `1px solid ${
                                  cam.location_verification === 'VERIFIED_LOCATION' && cam.stream_playability === 'PLAYABLE'
                                    ? 'rgba(16,185,129,0.4)'
                                    : cam.access_status === 'REQUIRES_ACCESS'
                                    ? 'rgba(245,158,11,0.4)'
                                    : 'rgba(100,116,139,0.4)'
                                }`,
                              }}
                            >
                              {cam.location_verification === 'VERIFIED_LOCATION' && cam.stream_playability === 'PLAYABLE'
                                ? 'VERIFIED LIVE'
                                : cam.access_status === 'REQUIRES_ACCESS'
                                ? 'REQUIRES ACCESS'
                                : 'UNVERIFIED'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 8, color: '#64748b' }}>
                            <span>{cam.operator}</span>
                            <span style={{ color: '#38bdf8' }}>{cam.stream_protocol}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              /* Territorial Mode Left Panel */
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
            )}
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
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: '#00e5ff', border: '1px solid #ffffff' }} />
                  <span>CCTV Kamera & Cluster Nasional</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 12, height: 2, background: '#f59e0b' }} />
                  <span>ALKI Sea Lanes (Alur Maritim)</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT TERRITORIAL OR CCTV DOSSIER ── */}
          <div
            style={{
              width: 380,
              flexShrink: 0,
              background: 'rgba(5, 10, 22, 0.96)',
              borderLeft: '1px solid rgba(0, 229, 255, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
            }}
          >
            {/* If a Camera is Selected */}
            {selectedCamera ? (
              <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,229,255,0.2)', paddingBottom: 8 }}>
                  <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#00e5ff', fontWeight: 900 }}>
                    OPTICAL SURVEILLANCE FEED // {selectedCamera.camera_id}
                  </span>
                  <button
                    onClick={() => setSelectedCamera(null)}
                    style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontWeight: 800 }}
                  >
                    ✕
                  </button>
                </div>

                {/* Video Stream Player */}
                <CCTVPlayer camera={selectedCamera} />

                {/* Camera Technical Metadata & Separated Integrity Status */}
                <div style={{ background: 'rgba(15,23,42,0.6)', padding: '10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 8.5, color: '#38bdf8', fontWeight: 800, fontFamily: 'monospace' }}>
                    AUDIT INTEGRITAS & METADATA NASIONAL
                  </div>
                  <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#cbd5e1', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>OPERATOR:</span>
                    <strong>{selectedCamera.operator}</strong>
                  </div>
                  <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#cbd5e1', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>WILAYAH:</span>
                    <span>{selectedCamera.regency_city_code || selectedCamera.district_code || ''}, {selectedCamera.province_code}</span>
                  </div>
                  <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#cbd5e1', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>KOORDINAT:</span>
                    <span style={{ color: '#34d399' }}>{selectedCamera.latitude}, {selectedCamera.longitude}</span>
                  </div>
                  <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#cbd5e1', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>REACHABILITY:</span>
                    <span style={{ color: selectedCamera.source_reachability === 'REACHABLE' ? '#34d399' : '#94a3b8' }}>
                      {selectedCamera.source_reachability || 'UNKNOWN'}
                    </span>
                  </div>
                  <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#cbd5e1', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>PLAYABILITY:</span>
                    <span style={{ color: selectedCamera.stream_playability === 'PLAYABLE' ? '#34d399' : '#94a3b8' }}>
                      {selectedCamera.stream_playability || 'UNTESTED'}
                    </span>
                  </div>
                  <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#cbd5e1', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>LOCATION:</span>
                    <span style={{ color: selectedCamera.location_verification === 'VERIFIED_LOCATION' ? '#34d399' : '#fbbf24' }}>
                      {selectedCamera.location_verification || 'UNVERIFIED_LOCATION'}
                    </span>
                  </div>
                  <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#cbd5e1', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>ACCESS STATUS:</span>
                    <span style={{ color: selectedCamera.access_status === 'PUBLIC_OPEN' ? '#34d399' : '#f59e0b' }}>
                      {selectedCamera.access_status}
                    </span>
                  </div>
                  {selectedCamera.failure_reason && (
                    <div style={{ fontSize: 8, color: '#f87171', background: 'rgba(239,68,68,0.1)', padding: '4px 6px', borderRadius: 4, borderLeft: '2px solid #ef4444', marginTop: 2 }}>
                      CATATAN AUDIT: {selectedCamera.failure_reason}
                    </div>
                  )}
                  <div style={{ fontSize: 8.5, color: '#94a3b8', marginTop: 4, lineHeight: 1.4 }}>
                    {selectedCamera.description}
                  </div>
                </div>

                <button
                  onClick={() => handleSendCameraToJiniChat(selectedCamera)}
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
                  }}
                >
                  <span>💬</span>
                  <span>ANALISIS TITIK INI DENGAN JINI AI</span>
                </button>
              </div>
            ) : selectedProvince ? (
              /* If a Province is Selected */
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
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

                {/* Macro Indicators */}
                <div>
                  <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#38bdf8', fontWeight: 800, marginBottom: 6 }}>
                    INDIKATOR MAKRO & KONTRIBUSI PDB
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <div style={{ background: 'rgba(15,23,42,0.6)', padding: '6px 8px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: 8, color: '#94a3b8' }}>PDRB</div>
                      <div style={{ fontSize: 12, fontWeight: 900, color: '#38bdf8', fontFamily: 'monospace' }}>
                        {selectedProvince.grdp}
                      </div>
                      <div style={{ fontSize: 8, color: '#64748b' }}>{selectedProvince.grdpShare}</div>
                    </div>
                    <div style={{ background: 'rgba(15,23,42,0.6)', padding: '6px 8px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: 8, color: '#94a3b8' }}>PERTUMBUHAN</div>
                      <div style={{ fontSize: 12, fontWeight: 900, color: '#34d399', fontFamily: 'monospace' }}>
                        {selectedProvince.growth}
                      </div>
                      <div style={{ fontSize: 8, color: '#64748b' }}>YoY Real</div>
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
                        <span style={{ fontSize: 8, color: '#34d399', fontWeight: 700 }}>{c.level}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CCTV Cameras in this Province */}
                <div>
                  <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#ec4899', fontWeight: 800, marginBottom: 6 }}>
                    CCTV OPTIK TERDAFTAR DI WILAYAH INI
                  </div>
                  {cctvCameras.filter((c) => c.province_code === selectedProvince.code).length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {cctvCameras
                        .filter((c) => c.province_code === selectedProvince.code)
                        .map((cam) => (
                          <button
                            key={cam.camera_id}
                            onClick={() => handleSelectCamera(cam)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '5px 8px',
                              borderRadius: 4,
                              background: 'rgba(236,72,153,0.1)',
                              border: '1px solid rgba(236,72,153,0.3)',
                              color: '#f472b6',
                              fontSize: 9,
                              fontFamily: 'monospace',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            <span>📹 {cam.camera_name}</span>
                            <span style={{ color: '#34d399' }}>{cam.stream_status}</span>
                          </button>
                        ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 8.5, color: '#94a3b8', fontStyle: 'italic', fontFamily: 'monospace' }}>
                      Belum ada feed CCTV publik terverifikasi di wilayah ini.
                    </div>
                  )}
                </div>

                {/* AI Brief Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
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
                    }}
                  >
                    <span>💬</span>
                    <span>TANYAKAN KE JINI AI CHAT</span>
                  </button>
                </div>
              </div>
            ) : (
              /* When nothing is selected -> National Overview */
              <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ borderBottom: '1px solid rgba(0,229,255,0.18)', paddingBottom: 10 }}>
                  <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#00e5ff', fontWeight: 900 }}>
                    NATIONAL OVERVIEW // PALANTIR RECONNAISSANCE
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#ffffff', marginTop: 4 }}>
                    Republik Indonesia
                  </div>
                  <div style={{ fontSize: 9.5, color: '#94a3b8', fontFamily: 'monospace' }}>
                    17.500+ Pulau | 34 Provinsi Terintegrasi | Koridor ALKI I-III
                  </div>
                </div>

                {/* CCTV Statistics Summary — 6 Separated Verification Metrics */}
                <div style={{ background: 'rgba(15,23,42,0.7)', padding: '10px', borderRadius: 6, border: '1px solid rgba(0,229,255,0.2)' }}>
                  <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#ec4899', fontWeight: 800, marginBottom: 6 }}>
                    STATUS AUDIT CCTV NASIONAL (HASIL AKTUAL)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    <div style={{ background: 'rgba(5,10,20,0.7)', padding: '6px', borderRadius: 4 }}>
                      <div style={{ fontSize: 7, color: '#94a3b8' }}>1. TERDAFTAR</div>
                      <div style={{ fontSize: 13, fontWeight: 900, color: '#38bdf8', fontFamily: 'monospace' }}>
                        {cctvStats.total_registered || cctvStats.total}
                      </div>
                    </div>
                    <div style={{ background: 'rgba(5,10,20,0.7)', padding: '6px', borderRadius: 4 }}>
                      <div style={{ fontSize: 7, color: '#94a3b8' }}>2. TERJANGKAU</div>
                      <div style={{ fontSize: 13, fontWeight: 900, color: '#34d399', fontFamily: 'monospace' }}>
                        {cctvStats.reachable_sources || 0}
                      </div>
                    </div>
                    <div style={{ background: 'rgba(5,10,20,0.7)', padding: '6px', borderRadius: 4 }}>
                      <div style={{ fontSize: 7, color: '#94a3b8' }}>3. DIPUTAR</div>
                      <div style={{ fontSize: 13, fontWeight: 900, color: '#34d399', fontFamily: 'monospace' }}>
                        {cctvStats.verified_playable || 0}
                      </div>
                    </div>
                    <div style={{ background: 'rgba(5,10,20,0.7)', padding: '6px', borderRadius: 4 }}>
                      <div style={{ fontSize: 7, color: '#94a3b8' }}>4. LOKASI VALID</div>
                      <div style={{ fontSize: 13, fontWeight: 900, color: '#34d399', fontFamily: 'monospace' }}>
                        {cctvStats.verified_locations || 0}
                      </div>
                    </div>
                    <div style={{ background: 'rgba(5,10,20,0.7)', padding: '6px', borderRadius: 4 }}>
                      <div style={{ fontSize: 7, color: '#94a3b8' }}>5. UNVERIFIED</div>
                      <div style={{ fontSize: 13, fontWeight: 900, color: '#fbbf24', fontFamily: 'monospace' }}>
                        {cctvStats.unverified_feeds || 0}
                      </div>
                    </div>
                    <div style={{ background: 'rgba(5,10,20,0.7)', padding: '6px', borderRadius: 4 }}>
                      <div style={{ fontSize: 7, color: '#94a3b8' }}>6. BUTUH AKSES</div>
                      <div style={{ fontSize: 13, fontWeight: 900, color: '#a78bfa', fontFamily: 'monospace' }}>
                        {cctvStats.requires_access || cctvStats.requiresAccess}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Honest Transparency Notice */}
                <div style={{ background: 'rgba(15,23,42,0.5)', padding: '8px 10px', borderRadius: 4, borderLeft: '2px solid #38bdf8' }}>
                  <div style={{ fontSize: 8.5, fontWeight: 800, color: '#38bdf8', marginBottom: 2 }}>
                    AUDIT KONEKTIVITAS:
                  </div>
                  <div style={{ fontSize: 8, color: '#94a3b8', lineHeight: 1.4 }}>
                    Hanya menampilkan sumber CCTV publik terverifikasi (Dishub ATCS, BPJT, Pelindo, DSDA). Wilayah tanpa portal publik terverifikasi ditandai secara jujur.
                  </div>
                </div>

                {/* Quick Hot Cameras to View */}
                <div>
                  <div style={{ fontSize: 8.5, fontFamily: 'monospace', color: '#34d399', fontWeight: 800, marginBottom: 6 }}>
                    ⭐ FEED CCTV UTAMA
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {cctvCameras.slice(0, 5).map((cam) => (
                      <button
                        key={cam.camera_id}
                        onClick={() => handleSelectCamera(cam)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '5px 8px',
                          borderRadius: 4,
                          background: 'rgba(15,23,42,0.4)',
                          border: '1px solid rgba(0,229,255,0.15)',
                          color: '#e2e8f0',
                          fontSize: 9,
                          fontFamily: 'monospace',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span>📹 {cam.camera_name}</span>
                        <span
                          style={{
                            fontSize: 7.5,
                            color:
                              cam.location_verification === 'VERIFIED_LOCATION' && cam.stream_playability === 'PLAYABLE'
                                ? '#34d399'
                                : cam.access_status === 'REQUIRES_ACCESS'
                                ? '#fbbf24'
                                : '#94a3b8',
                          }}
                        >
                          {cam.location_verification === 'VERIFIED_LOCATION' && cam.stream_playability === 'PLAYABLE'
                            ? 'LIVE'
                            : cam.access_status === 'REQUIRES_ACCESS'
                            ? 'GATED'
                            : 'UNVERIFIED'}
                        </span>
                      </button>
                    ))}
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
            <span style={{ color: '#00e5ff' }}>
              CCTV: {cctvStats.verified_playable || 0} LIVE // {cctvStats.unverified_feeds || 0} UNVERIFIED // {cctvStats.requires_access || cctvStats.requiresAccess} GATED // {cctvStats.total_registered || cctvStats.total} REG ({cctvStats.provinces_covered || cctvStats.provincesCovered} PROV)
            </span>
            <span>|</span>
            <span>ATRIBUSI: ESRI CANVAS // OPENSTREETMAP // OPENMAPTILES 3D</span>
            <span>|</span>
            <span>PROJECTION: MERCATOR WGS 84 (MAX ZOOM: 20x)</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: '#00e5ff' }}>JINI PALANTIR CORE v1.2</span>
            <span>|</span>
            <span>LATENCY: 12ms</span>
          </div>
        </div>
      </div>
    </div>
  );
}
