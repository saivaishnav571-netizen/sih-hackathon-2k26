import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './LogisticsMapNavigation.css';
import {
  CornerUpRight,
  CornerUpLeft,
  ArrowUp,
  RotateCcw,
  MapPin,
  Navigation as NavIcon,
  AlertTriangle,
  Droplets,
  Mountain,
  CloudRain,
  ShieldAlert,
  X as CloseIcon,
} from 'lucide-react';

export interface RouteStep {
  instruction: string;
  distance_km: number;
  distance_m: number;
  duration_min: number;
  type: string;
  modifier: string;
  location: [number, number];
}

export interface RouteHazard {
  id: string;
  type: 'flood' | 'landslide' | 'heavy_rain' | 'earthquake' | string;
  title: string;
  severity: 'High Risk' | 'Moderate Risk' | string;
  location: [number, number];
  affected_stretch_km: number;
  description: string;
  icon?: string;
}

export interface RouteSegment {
  coordinates: number[][];
  risk_level: string;
  color: string;
  label: string;
  hazard_id: string | null;
}

export interface RouteFeature {
  type: 'Feature';
  geometry: { type: 'LineString'; coordinates: number[][] };
  properties: {
    route_id: string;
    route_label: string;
    route_name: string;
    is_best_route: boolean;
    color: string;
    distance_km: number;
    eta_hrs: number;
    delay_risk: string;
    accessibility_score: number;
    waypoints: string[];
    recommendation: string;
    steps?: RouteStep[];
    hazards?: RouteHazard[];
    segments?: RouteSegment[];
    risk_level?: string;    // 'Low Risk' | 'Moderate Risk' | 'High Risk'
    risk_color?: string;    // hex color from ML prediction
  };
}

export interface LogisticsMapProps {
  features: RouteFeature[];
  selectedRouteId: string;
  tripActive?: boolean;
  onTripEnd?: () => void;
  onSelectRoute?: (routeId: string) => void;
}

const getRiskLineColor = (riskLevel?: string): { main: string; glow: string } => {
  if (riskLevel === 'High Risk')     return { main: '#ef4444', glow: '#f87171' };
  if (riskLevel === 'Moderate Risk') return { main: '#f59e0b', glow: '#fbbf24' };
  return { main: '#10b981', glow: '#34d399' }; // Low Risk (default)
};

const calculateBearing = (lng1: number, lat1: number, lng2: number, lat2: number): number => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};

const interpolateCoords = (rawCoords: number[][], samplesPerSegment = 6): number[][] => {
  if (rawCoords.length < 2) return rawCoords;
  const pts: number[][] = [];
  for (let i = 0; i < rawCoords.length - 1; i++) {
    const [lng1, lat1] = rawCoords[i];
    const [lng2, lat2] = rawCoords[i + 1];
    for (let s = 0; s < samplesPerSegment; s++) {
      const t = s / samplesPerSegment;
      pts.push([lng1 + (lng2 - lng1) * t, lat1 + (lat2 - lat1) * t]);
    }
  }
  pts.push(rawCoords[rawCoords.length - 1]);
  return pts;
};

const getDistanceMeters = (c1: [number, number], c2: [number, number]): number => {
  const R = 6371e3;
  const rad = Math.PI / 180;
  const dLat = (c2[1] - c1[1]) * rad;
  const dLng = (c2[0] - c1[0]) * rad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(c1[1] * rad) * Math.cos(c2[1] * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const getTurnIcon = (type?: string, modifier?: string) => {
  const mod = (modifier || '').toLowerCase();
  const t = (type || '').toLowerCase();

  if (t === 'arrive' || t.includes('destination') || t.includes('arrived')) {
    return <MapPin size={24} className="text-white" />;
  }
  if (mod.includes('slight right') || mod.includes('bear right') || (t.includes('fork') && mod.includes('right'))) {
    return <CornerUpRight size={24} className="text-white" />;
  }
  if (mod.includes('slight left') || mod.includes('bear left') || (t.includes('fork') && mod.includes('left'))) {
    return <CornerUpLeft size={24} className="text-white" />;
  }
  if (mod.includes('right') || t.includes('right')) {
    return <CornerUpRight size={24} className="text-white" />;
  }
  if (mod.includes('left') || t.includes('left')) {
    return <CornerUpLeft size={24} className="text-white" />;
  }
  if (mod.includes('u-turn') || t.includes('uturn')) {
    return <RotateCcw size={24} className="text-white" />;
  }
  if (mod.includes('straight') || t === 'continue' || t === 'depart' || t === 'new name') {
    return <ArrowUp size={24} className="text-white" />;
  }
  return <NavIcon size={24} className="text-white" />;
};

const getHazardIcon = (type?: string) => {
  const t = (type || '').toLowerCase();
  if (t === 'flood') return <Droplets size={22} className="text-blue-400 animate-pulse" />;
  if (t === 'landslide') return <Mountain size={22} className="text-amber-500 animate-pulse" />;
  if (t === 'heavy_rain') return <CloudRain size={22} className="text-cyan-300 animate-pulse" />;
  return <AlertTriangle size={22} className="text-red-500 animate-pulse" />;
};

const SPEED_CONFIG: Record<number, { ms: number; step: number }> = {
  1: { ms: 140, step: 1 },
  2: { ms: 100, step: 2 },
  4: { ms: 75, step: 3 },
  8: { ms: 50, step: 5 },
  10: { ms: 35, step: 8 },
};

const SPEED_STAGES = [1, 2, 4, 8, 10];

export const LogisticsMapNavigation: React.FC<LogisticsMapProps> = ({
  features,
  selectedRouteId,
  tripActive = false,
  onTripEnd,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const mapReady = useRef(false);

  const featuresRef = useRef<RouteFeature[]>([]);
  const selectedRouteIdRef = useRef<string>(selectedRouteId);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const addedLayersRef = useRef<Set<string>>(new Set());
  const addedSourcesRef = useRef<Set<string>>(new Set());

  const vehicleMarkerRef = useRef<maplibregl.Marker | null>(null);
  const animIntervalRef = useRef<number | null>(null);
  const coordIdxRef = useRef<number>(0);
  const interpolatedCoordsRef = useRef<number[][]>([]);
  const stepIndicesRef = useRef<number[]>([]);
  const tripActiveRef = useRef<boolean>(false);
  const followRef = useRef<boolean>(true);

  const [activeHazardAlert, setActiveHazardAlert] = useState<RouteHazard | null>(null);
  const triggeredHazardIdsRef = useRef<Set<string>>(new Set());
  const hazardAlertTimeoutRef = useRef<number | null>(null);

  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [currentStep, setCurrentStep] = useState<RouteStep | null>(null);
  const [turnDistanceM, setTurnDistanceM] = useState<number>(0);
  const [remainingDistKm, setRemainingDistKm] = useState<number>(0);
  const [remainingEtaHrs, setRemainingEtaHrs] = useState<number>(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simSpeed, setSimSpeed] = useState(1);
  const [currentBearing, setCurrentBearing] = useState(0);
  const [isFollowing, setIsFollowing] = useState(true);

  const activeRoute = features.find(f => f.properties.route_id === selectedRouteId) || features[0];

  const effectiveSteps = useMemo(() => {
    const rawSteps = activeRoute?.properties.steps;
    if (rawSteps && rawSteps.length > 1) {
      return rawSteps;
    }
    if (!activeRoute?.geometry?.coordinates || activeRoute.geometry.coordinates.length < 2) return [];
    const coords = activeRoute.geometry.coordinates;
    const totalKm = activeRoute.properties.distance_km || 10;
    const count = Math.min(8, Math.max(3, Math.floor(coords.length / 15)));
    const generated: RouteStep[] = [];

    generated.push({
      instruction: 'Head towards destination',
      distance_km: 0.5,
      distance_m: 500,
      duration_min: 1,
      type: 'depart',
      modifier: 'straight',
      location: coords[0] as [number, number],
    });

    for (let i = 1; i < count; i++) {
      const idx = Math.floor((i / count) * (coords.length - 1));
      const prev = coords[Math.max(0, idx - 2)];
      const curr = coords[idx];
      const next = coords[Math.min(coords.length - 1, idx + 2)];
      const b1 = calculateBearing(prev[0], prev[1], curr[0], curr[1]);
      const b2 = calculateBearing(curr[0], curr[1], next[0], next[1]);
      let diff = b2 - b1;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;

      let instruction = 'Continue on highway';
      let type = 'continue';
      let modifier = 'straight';

      if (diff > 25) {
        instruction = 'Turn right onto connector';
        type = 'turn';
        modifier = 'right';
      } else if (diff > 10) {
        instruction = 'Bear slightly right';
        type = 'turn';
        modifier = 'slight right';
      } else if (diff < -25) {
        instruction = 'Turn left onto expressway';
        type = 'turn';
        modifier = 'left';
      } else if (diff < -10) {
        instruction = 'Bear slightly left';
        type = 'turn';
        modifier = 'slight left';
      }

      generated.push({
        instruction,
        distance_km: Math.round((totalKm / count) * 10) / 10,
        distance_m: Math.round((totalKm / count) * 1000),
        duration_min: 2,
        type,
        modifier,
        location: curr as [number, number],
      });
    }

    generated.push({
      instruction: 'Arrive at destination',
      distance_km: 0,
      distance_m: 0,
      duration_min: 0,
      type: 'arrive',
      modifier: '',
      location: coords[coords.length - 1] as [number, number],
    });

    return generated;
  }, [activeRoute]);

  featuresRef.current = features;
  selectedRouteIdRef.current = selectedRouteId;
  tripActiveRef.current = tripActive;

  // ── MAP INIT (runs only once) ──
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const m = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap Contributors',
            maxzoom: 19,
          },
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
      },
      center: [91.7362, 26.1445],
      zoom: 7.5,
      pitch: 20,
      antialias: true,
    });

    m.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.current = m;

    m.on('dragstart', () => {
      if (tripActiveRef.current) {
        followRef.current = false;
        setIsFollowing(false);
      }
    });

    m.on('load', () => {
      mapReady.current = true;
      if (featuresRef.current.length > 0) {
        drawRoutes(m, featuresRef.current, selectedRouteIdRef.current);
      }
    });

    return () => {
      mapReady.current = false;
      m.remove();
      map.current = null;
    };
  }, []);

  // ── RE-DRAW when features or selectedRouteId change ──
  useEffect(() => {
    const m = map.current;
    if (!m || !mapReady.current) return;
    if (features.length === 0) return;
    drawRoutes(m, features, selectedRouteId);
  }, [features, selectedRouteId]);

  const drawRoutes = (m: maplibregl.Map, routeFeatures: RouteFeature[], activeId: string) => {
    // Remove old markers
    markersRef.current.forEach(mk => mk.remove());
    markersRef.current = [];

    // Keep track of layers/sources we touch during this render
    const touchedLayers = new Set<string>();
    const touchedSources = new Set<string>();

    // Draw each route
    routeFeatures.forEach(feature => {
      const id = feature.properties.route_id;
      const isActive = id === activeId;
      const segments = feature.properties.segments;

      if (segments && segments.length > 0) {
        // Draw individual risk segments (Green for safe, Red for flood/landslide)
        segments.forEach((seg, sIdx) => {
          const segSourceId = `${id}_seg_${sIdx}`;
          const segGlowId = `${segSourceId}_glow`;
          const segLineId = `${segSourceId}_line`;
          const isHighRisk = seg.risk_level === 'High Risk';
          const isModRisk = seg.risk_level === 'Moderate Risk';

          const mainColor = seg.color || (isHighRisk ? '#ef4444' : isModRisk ? '#f59e0b' : '#10b981');
          const glowColor = isHighRisk ? '#f87171' : isModRisk ? '#fbbf24' : '#34d399';

          const geoData = {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: seg.coordinates },
            properties: { route_id: id, label: seg.label || '', risk_level: seg.risk_level || '' },
          };

          try {
            if (m.getSource(segSourceId)) {
              (m.getSource(segSourceId) as maplibregl.GeoJSONSource).setData(geoData as any);
            } else {
              m.addSource(segSourceId, {
                type: 'geojson',
                data: geoData as any,
              });
            }
            touchedSources.add(segSourceId);

            // Outer glow
            if (!m.getLayer(segGlowId)) {
              m.addLayer({
                id: segGlowId,
                type: 'line',
                source: segSourceId,
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: {
                  'line-color': glowColor,
                  'line-width': isActive ? (isHighRisk ? 22 : 16) : 8,
                  'line-opacity': isActive ? (isHighRisk ? 0.65 : 0.35) : 0.15,
                  'line-blur': 6,
                },
              });
            } else {
              m.setPaintProperty(segGlowId, 'line-color', glowColor);
              m.setPaintProperty(segGlowId, 'line-width', isActive ? (isHighRisk ? 22 : 16) : 8);
              m.setPaintProperty(segGlowId, 'line-opacity', isActive ? (isHighRisk ? 0.65 : 0.35) : 0.15);
            }
            touchedLayers.add(segGlowId);

            // Main segment line
            if (!m.getLayer(segLineId)) {
              m.addLayer({
                id: segLineId,
                type: 'line',
                source: segSourceId,
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: {
                  'line-color': mainColor,
                  'line-width': isActive ? (isHighRisk ? 8 : 6) : 4,
                  'line-opacity': isActive ? 1 : 0.6,
                },
              });
            } else {
              m.setPaintProperty(segLineId, 'line-color', mainColor);
              m.setPaintProperty(segLineId, 'line-width', isActive ? (isHighRisk ? 8 : 6) : 4);
              m.setPaintProperty(segLineId, 'line-opacity', isActive ? 1 : 0.6);
            }
            touchedLayers.add(segLineId);
          } catch (err) {
            console.error('Failed to add segment layer:', segSourceId, err);
          }
        });
      } else {
        // Fallback single line
        const colors = getRiskLineColor(feature.properties.risk_level);
        const glowId = `${id}-glow`;
        const lineId = `${id}-line`;
        const geoData = {
          type: 'Feature',
          geometry: feature.geometry,
          properties: { route_id: id, risk_level: feature.properties.risk_level || '' },
        };

        try {
          if (m.getSource(id)) {
            (m.getSource(id) as maplibregl.GeoJSONSource).setData(geoData as any);
          } else {
            m.addSource(id, {
              type: 'geojson',
              data: geoData as any,
            });
          }
          touchedSources.add(id);

          if (!m.getLayer(glowId)) {
            m.addLayer({
              id: glowId,
              type: 'line',
              source: id,
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: {
                'line-color': colors.glow,
                'line-width': isActive ? 20 : 8,
                'line-opacity': isActive ? 0.5 : 0.15,
                'line-blur': 8,
              },
            });
          } else {
            m.setPaintProperty(glowId, 'line-color', colors.glow);
            m.setPaintProperty(glowId, 'line-width', isActive ? 20 : 8);
            m.setPaintProperty(glowId, 'line-opacity', isActive ? 0.5 : 0.15);
          }
          touchedLayers.add(glowId);

          if (!m.getLayer(lineId)) {
            m.addLayer({
              id: lineId,
              type: 'line',
              source: id,
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: {
                'line-color': colors.main,
                'line-width': isActive ? 7 : 3,
                'line-opacity': isActive ? 1 : 0.5,
              },
            });
          } else {
            m.setPaintProperty(lineId, 'line-color', colors.main);
            m.setPaintProperty(lineId, 'line-width', isActive ? 7 : 3);
            m.setPaintProperty(lineId, 'line-opacity', isActive ? 1 : 0.5);
          }
          touchedLayers.add(lineId);
        } catch (err) {
          console.error('Failed to add route layer:', id, err);
        }
      }
    });

    // Cleanup stale layers
    addedLayersRef.current.forEach(layerId => {
      if (!touchedLayers.has(layerId)) {
        try { if (m.getLayer(layerId)) m.removeLayer(layerId); } catch (e) {}
      }
    });
    addedLayersRef.current = touchedLayers;

    // Cleanup stale sources
    addedSourcesRef.current.forEach(sourceId => {
      if (!touchedSources.has(sourceId)) {
        try { if (m.getSource(sourceId)) m.removeSource(sourceId); } catch (e) {}
      }
    });
    addedSourcesRef.current = touchedSources;

    try {
      m.triggerRepaint();
    } catch (e) {}

    // Add Start/End markers for active route
    const activeFeat = routeFeatures.find(f => f.properties.route_id === activeId) || routeFeatures[0];
    if (activeFeat && activeFeat.geometry.coordinates.length >= 2) {
      const coords = activeFeat.geometry.coordinates;
      const wp = activeFeat.properties.waypoints || [];

      const makeMarkerEl = (cls: string, label: string) => {
        const el = document.createElement('div');
        el.className = `custom-marker ${cls}`;
        el.innerHTML = `<span>${label}</span>`;
        return el;
      };

      markersRef.current.push(
        new maplibregl.Marker({ element: makeMarkerEl('start-marker', `🟢 ${wp[0] || 'Start'}`) })
          .setLngLat(coords[0] as [number, number])
          .addTo(m)
      );
      markersRef.current.push(
        new maplibregl.Marker({ element: makeMarkerEl('end-marker', `🚩 ${wp[wp.length - 1] || 'End'}`) })
          .setLngLat(coords[coords.length - 1] as [number, number])
          .addTo(m)
      );
    }

    // Fit map bounds
    if (activeFeat && activeFeat.geometry.coordinates.length > 1 && !tripActive) {
      const coords = activeFeat.geometry.coordinates;
      const bounds = coords.reduce(
        (b: maplibregl.LngLatBounds, c: number[]) => b.extend(c as [number, number]),
        new maplibregl.LngLatBounds(coords[0] as [number, number], coords[0] as [number, number])
      );
      m.fitBounds(bounds, { padding: 60, pitch: 20, duration: 1200 });
    }
  };

  // ── POV NAVIGATION ──
  const updatePovPosition = (curr: [number, number], next?: [number, number], durationMs = 140) => {
    const m = map.current;
    if (!m) return;
    const heading = next ? calculateBearing(curr[0], curr[1], next[0], next[1]) : currentBearing;
    setCurrentBearing(heading);
    if (!vehicleMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'pov-vehicle-marker';
      el.innerHTML = `<div class="google-nav-chevron"><svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M12 2L4.5 20.29C4.19 21.05 4.95 21.81 5.71 21.5L12 18.5L18.29 21.5C19.05 21.81 19.81 21.05 19.5 20.29L12 2Z" fill="#38BDF8" stroke="#FFF" stroke-width="1.8" stroke-linejoin="round"/></svg></div>`;
      vehicleMarkerRef.current = new maplibregl.Marker({ element: el }).setLngLat(curr).addTo(m);
    } else {
      vehicleMarkerRef.current.setLngLat(curr);
    }
    if (followRef.current) {
      m.easeTo({ center: curr, bearing: heading, pitch: 55, zoom: m.getZoom(), duration: durationMs });
    }
  };

  const handleRecenter = () => {
    const m = map.current;
    if (!m || !vehicleMarkerRef.current) return;
    followRef.current = true;
    setIsFollowing(true);
    m.easeTo({
      center: vehicleMarkerRef.current.getLngLat(),
      bearing: currentBearing,
      pitch: 55,
      zoom: Math.max(m.getZoom(), 15),
      duration: 600,
    });
  };

  useEffect(() => {
    if (tripActive && activeRoute) {
      setIsSimulating(true);
      setCurrentStepIdx(0);
      followRef.current = true;
      setIsFollowing(true);
      triggeredHazardIdsRef.current.clear();
      setActiveHazardAlert(null);
      if (hazardAlertTimeoutRef.current) {
        clearTimeout(hazardAlertTimeoutRef.current);
        hazardAlertTimeoutRef.current = null;
      }

      const dense = interpolateCoords(activeRoute.geometry.coordinates, 5);
      interpolatedCoordsRef.current = dense;
      coordIdxRef.current = 0;

      // Pre-calculate indices in dense for each step
      const indices: number[] = [];
      let searchStart = 0;
      effectiveSteps.forEach((st, sIdx) => {
        if (sIdx === 0) {
          indices.push(0);
          return;
        }
        if (sIdx === effectiveSteps.length - 1) {
          indices.push(dense.length - 1);
          return;
        }
        let bestIdx = searchStart;
        let minD = Infinity;
        for (let j = searchStart; j < dense.length; j++) {
          const d = (dense[j][0] - st.location[0]) ** 2 + (dense[j][1] - st.location[1]) ** 2;
          if (d < minD) {
            minD = d;
            bestIdx = j;
          }
        }
        indices.push(bestIdx);
        searchStart = bestIdx;
      });
      stepIndicesRef.current = indices;

      // Initialize stats & step instruction
      setRemainingDistKm(activeRoute.properties.distance_km || 0);
      setRemainingEtaHrs(activeRoute.properties.eta_hrs || 0);

      if (effectiveSteps.length > 0) {
        setCurrentStep(effectiveSteps[0]);
        const targetIdx = indices[1] || Math.floor(dense.length / 5);
        let initD = 0;
        for (let k = 0; k < targetIdx && k < dense.length - 1; k++) {
          initD += getDistanceMeters(dense[k] as [number, number], dense[k + 1] as [number, number]);
        }
        setTurnDistanceM(initD || effectiveSteps[0].distance_m || 300);
      }

      if (dense.length > 0) {
        const m = map.current;
        if (m) m.jumpTo({ zoom: 15 });
        updatePovPosition(dense[0] as [number, number], dense[1] as [number, number], 300);
      }
    } else {
      setIsSimulating(false);
      setActiveHazardAlert(null);
      if (hazardAlertTimeoutRef.current) {
        clearTimeout(hazardAlertTimeoutRef.current);
        hazardAlertTimeoutRef.current = null;
      }
      triggeredHazardIdsRef.current.clear();
      if (vehicleMarkerRef.current) { vehicleMarkerRef.current.remove(); vehicleMarkerRef.current = null; }
      if (map.current && features.length > 0) {
        drawRoutes(map.current, features, selectedRouteId);
      }
    }
  }, [tripActive, effectiveSteps]);

  useEffect(() => {
    if (!tripActive || !isSimulating) {
      if (animIntervalRef.current) clearInterval(animIntervalRef.current);
      return;
    }
    const speedProfile = SPEED_CONFIG[simSpeed] || { ms: 140, step: 1 };
    const ms = speedProfile.ms;
    const stepIncrement = speedProfile.step;

    animIntervalRef.current = window.setInterval(() => {
      const coords = interpolatedCoordsRef.current;
      const idx = coordIdxRef.current;
      if (idx >= coords.length - 1) {
        setIsSimulating(false);
        setRemainingDistKm(0);
        setRemainingEtaHrs(0);
        setTurnDistanceM(0);
        setCurrentStep({
          instruction: 'Arrived at destination',
          distance_km: 0,
          distance_m: 0,
          duration_min: 0,
          type: 'arrive',
          modifier: '',
          location: coords[coords.length - 1] as [number, number],
        });
        return;
      }

      const next = Math.min(coords.length - 1, idx + stepIncrement);
      coordIdxRef.current = next;
      updatePovPosition(
        coords[next] as [number, number],
        (coords[next + 1] || coords[next]) as [number, number],
        ms
      );

      // Dynamic total remaining distance & ETA
      const progressRatio = next / (coords.length - 1);
      const totalKm = activeRoute?.properties.distance_km || 0;
      const totalEta = activeRoute?.properties.eta_hrs || 0;
      setRemainingDistKm(Math.max(0, totalKm * (1 - progressRatio)));
      setRemainingEtaHrs(Math.max(0, totalEta * (1 - progressRatio)));

      // Step guidance tracking
      const indices = stepIndicesRef.current;
      if (indices.length > 0 && effectiveSteps.length > 0) {
        let currentSegIdx = 0;
        for (let k = 0; k < indices.length - 1; k++) {
          if (next >= indices[k] && next < indices[k + 1]) {
            currentSegIdx = k;
            break;
          }
          if (next >= indices[indices.length - 1]) {
            currentSegIdx = indices.length - 1;
          }
        }

        const nextManeuverIdx = Math.min(effectiveSteps.length - 1, currentSegIdx + 1);
        const targetCoordIdx = indices[nextManeuverIdx] || coords.length - 1;

        let dM = 0;
        for (let k = next; k < targetCoordIdx; k++) {
          dM += getDistanceMeters(coords[k] as [number, number], coords[k + 1] as [number, number]);
        }

        // When nearing a maneuver or moving through segments, update the instruction
        const stepToDisplay = (dM < 50 || currentSegIdx > 0)
          ? effectiveSteps[nextManeuverIdx]
          : effectiveSteps[currentSegIdx];

        setCurrentStep(stepToDisplay);
        setTurnDistanceM(dM);
        setCurrentStepIdx(nextManeuverIdx);

        // Check proximity to disaster hazards along the route (within 1.2 km)
        const hazards = activeRoute?.properties?.hazards || [];
        for (const h of hazards) {
          if (!triggeredHazardIdsRef.current.has(h.id)) {
            const distToHazard = getDistanceMeters(coords[next] as [number, number], h.location);
            if (distToHazard <= 1200) {
              triggeredHazardIdsRef.current.add(h.id);
              setActiveHazardAlert(h);
              if (hazardAlertTimeoutRef.current) {
                clearTimeout(hazardAlertTimeoutRef.current);
              }
              hazardAlertTimeoutRef.current = window.setTimeout(() => {
                setActiveHazardAlert(null);
              }, 5000);
              break;
            }
          }
        }
      }
    }, ms);

    return () => {
      if (animIntervalRef.current) clearInterval(animIntervalRef.current);
    };
  }, [tripActive, isSimulating, simSpeed, effectiveSteps, activeRoute]);

  const displayTurnDistance = useMemo(() => {
    if (turnDistanceM > 1000) {
      return `${(turnDistanceM / 1000).toFixed(1)} km`;
    }
    return `${Math.max(0, Math.round(turnDistanceM))} m`;
  }, [turnDistanceM]);

  const displayInstruction = currentStep?.instruction || 'Proceed along route';

  const displayRemainingDistance = `${remainingDistKm.toFixed(1)} km`;
  const displayRemainingEta =
    remainingEtaHrs < 0.05
      ? '< 1 min'
      : remainingEtaHrs < 1
      ? `${Math.max(1, Math.round(remainingEtaHrs * 60))} min`
      : `${remainingEtaHrs.toFixed(1)} hrs`;

  return (
    <div className="logistics-map-wrapper">
      <div ref={mapContainer} className="logistics-map-container" />

      {tripActive && (
        <>
          <div className="nav-hud-top">
            <div className="nav-turn-icon-container">
              {getTurnIcon(currentStep?.type, currentStep?.modifier)}
            </div>
            <div className="nav-turn-info">
              <div className="nav-turn-distance">{displayTurnDistance}</div>
              <div className="nav-turn-instruction">{displayInstruction}</div>
            </div>
          </div>

          {/* 5-Second Proximity Disaster Warning Popup */}
          {activeHazardAlert && (
            <div className="nav-hazard-popup" role="alert">
              <div className="hazard-timer-bar" />
              <div className="nav-hazard-icon-box">
                {getHazardIcon(activeHazardAlert.type)}
              </div>
              <div className="nav-hazard-content">
                <div className="nav-hazard-header">
                  <span className="nav-hazard-badge">
                    <ShieldAlert size={13} /> DISASTER WARNING
                  </span>
                  <button
                    className="nav-hazard-close"
                    onClick={() => {
                      if (hazardAlertTimeoutRef.current) clearTimeout(hazardAlertTimeoutRef.current);
                      setActiveHazardAlert(null);
                    }}
                    aria-label="Dismiss warning"
                  >
                    <CloseIcon size={14} />
                  </button>
                </div>
                <div className="nav-hazard-title">{activeHazardAlert.title}</div>
                <p className="nav-hazard-desc">{activeHazardAlert.description}</p>
                <div className="nav-hazard-meta">
                  <span>Stretch: {activeHazardAlert.affected_stretch_km} km</span>
                  <span>•</span>
                  <span className="nav-hazard-severity">{activeHazardAlert.severity}</span>
                </div>
              </div>
            </div>
          )}

          {!isFollowing && (
            <button className="btn-recenter" onClick={handleRecenter} aria-label="Recenter on vehicle">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L4.5 20.29C4.19 21.05 4.95 21.81 5.71 21.5L12 18.5L18.29 21.5C19.05 21.81 19.81 21.05 19.5 20.29L12 2Z" fill="#38BDF8" stroke="#FFF" strokeWidth="1.8" strokeLinejoin="round"/>
              </svg>
              Recenter
            </button>
          )}

          <div className="nav-hud-bottom">
            <div className="nav-stat">
              <span className="nav-stat-val">{displayRemainingDistance}</span>
              <span className="nav-stat-lbl">Distance</span>
            </div>
            <div className="nav-stat">
              <span className="nav-stat-val">{displayRemainingEta}</span>
              <span className="nav-stat-lbl">ETA</span>
            </div>
            <div className="nav-stat">
              <span className="nav-stat-val">{Math.round(currentBearing)}°</span>
              <span className="nav-stat-lbl">Heading</span>
            </div>
            <div className="nav-controls">
              <button
                className="btn-nav-control"
                onClick={() => setSimSpeed(s => {
                  const nextIdx = (SPEED_STAGES.indexOf(s) + 1) % SPEED_STAGES.length;
                  return SPEED_STAGES[nextIdx];
                })}
                title="Change Simulation Speed"
              >
                {simSpeed}x
              </button>
              <button className="btn-nav-control" onClick={() => setIsSimulating(p => !p)}>{isSimulating ? '⏸' : '▶'}</button>
              <button className="btn-end-trip" onClick={onTripEnd}>End Drive</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default LogisticsMapNavigation;
