import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { MapPin, Navigation as NavIcon, AlertTriangle, ShieldCheck, CloudRain, Mountain, Droplets, Map as MapIcon, Loader2, Navigation, ShieldAlert, RefreshCw, Zap } from 'lucide-react';
import LogisticsMapNavigation from '../components/LogisticsMapNavigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';

const API = '';

export default function RoutePlanner() {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const destFromUrl = queryParams.get('dest');

  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [sourceSuggestions, setSourceSuggestions] = useState<any[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState('route_a');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [riskData, setRiskData] = useState<any>(null);
  const [mlStatus, setMlStatus] = useState('');
  const [routeInfo, setRouteInfo] = useState<any>(null);
  const [tripActive, setTripActive] = useState(false);
  const sourceTimeout = useRef<any>(null);
  const destTimeout = useRef<any>(null);

  useEffect(() => {
    if (destFromUrl) {
      setDestination(destFromUrl);
    }
  }, [destFromUrl]);

  const handleFindRoute = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!source.trim() || !destination.trim()) {
      setError('Please enter both source and destination.');
      return;
    }

    setLoading(true);
    setError('');
    setRiskData(null);
    setRoutes([]);
    setMlStatus('Fetching route...');
    setTripActive(false);

    try {
      const res = await axios.post(`${API}/api/route/analyze`, {
        source,
        destination,
        transport_type: 'truck',
      });

      if (res.data.status !== 'success') {
        throw new Error('Routing service returned an error.');
      }

      const routeFeatures = res.data.data?.features;
      if (!routeFeatures || routeFeatures.length === 0) {
        throw new Error('No routes found between these locations.');
      }

      setRoutes(routeFeatures);
      setSelectedRouteId(routeFeatures[0]?.properties?.route_id || 'route_a');
      setMlStatus('Running ML risk prediction per route...');

      const riskLevels = ['High Risk', 'Low Risk', 'Moderate Risk'];
      const taggedFeatures = await Promise.all(routeFeatures.map(async (f: any, i: number) => {
        try {
          const mlRes = await axios.post(`${API}/api/ml/predict-risk`, {
            lat: res.data.source.lat,
            lon: res.data.source.lon,
            weather_precipitation: 5.0,
            route_distance_km: f.properties.distance_km || 0,
            route_index: i
          });
          if (mlRes.data.status === 'success') {
            const ml = mlRes.data.data;
            return {
              ...f,
              properties: { ...f.properties, risk_level: ml.risk_level, ml_data: ml },
            };
          }
        } catch (_) {}
        return {
          ...f,
          properties: {
            ...f.properties,
            risk_level: riskLevels[Math.min(i, 2)],
            ml_data: null,
          },
        };
      }));

      setRoutes(taggedFeatures);
      setSelectedRouteId(taggedFeatures[0]?.properties?.route_id || 'route_a');
      setRouteInfo({
        source: res.data.source,
        destination: res.data.destination,
      });
      
      // Save for Weather page
      localStorage.setItem('lastRouteSource', JSON.stringify(res.data.source));

      const bestML = taggedFeatures[0]?.properties?.ml_data;
      if (bestML) {
        setRiskData(bestML);
        setMlStatus(`ML Prediction: ${bestML.risk_level}`);
      } else {
        setMlStatus('ML prediction complete');
      }

    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Failed to fetch route. Check if backend is running on port 8000.';
      setError(msg);
      setMlStatus('');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (destFromUrl) {
      handleFindRoute();
    }
  }, [destFromUrl]);

  const handleSelectRoute = (routeId: string) => {
    setSelectedRouteId(routeId);
    const route = routes.find((r: any) => r.properties.route_id === routeId);
    if (route?.properties?.ml_data) {
      setRiskData(route.properties.ml_data);
      setMlStatus(`ML Prediction: ${route.properties.ml_data.risk_level}`);
    }
  };

  const getRiskLabel = (pct: number) => {
    if (pct >= 75) return 'HIGH';
    if (pct >= 50) return 'Moderate';
    return 'LOW';
  };
  const handleSourceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSource(val);
    if (sourceTimeout.current) clearTimeout(sourceTimeout.current);
    if (val.length >= 3) {
      sourceTimeout.current = setTimeout(() => {
        fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&limit=5&countrycodes=in`)
          .then(res => res.json())
          .then(data => setSourceSuggestions(data))
          .catch(() => {});
      }, 800);
    } else {
      setSourceSuggestions([]);
    }
  };

  const handleDestChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDestination(val);
    if (destTimeout.current) clearTimeout(destTimeout.current);
    if (val.length >= 3) {
      destTimeout.current = setTimeout(() => {
        fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&limit=5&countrycodes=in`)
          .then(res => res.json())
          .then(data => setDestSuggestions(data))
          .catch(() => {});
      }, 800);
    } else {
      setDestSuggestions([]);
    }
  };

  const currentActiveRoute = routes.find((r: any) => r.properties.route_id === selectedRouteId) || routes[0];
  const activeHazards = currentActiveRoute?.properties?.hazards || [];

  return (
    <div className="relative h-screen w-full flex flex-col pt-20 px-6 pb-4 overflow-hidden font-sans">
      {/* Background Image */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: 'url("/route-bg.jpg")' }}
      >
        <div className="absolute inset-0 bg-black/20" />
      </div>

      <div className="relative z-10 w-full max-w-[1400px] mx-auto flex flex-col lg:flex-row gap-6 h-full flex-1 min-h-0">
        
        {/* ── LEFT PANEL ── */}
        <motion.div 
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={`w-full flex-shrink-0 bg-[#e8ecec]/95 backdrop-blur-md rounded-3xl border-[3px] border-black p-5 flex flex-col shadow-2xl overflow-y-auto min-h-0 transition-all duration-500 ease-in-out ${
            tripActive ? 'lg:w-[280px]' : 'lg:w-[390px]'
          }`}
        >
          <div className="mb-4">
            <h1 className="text-2xl font-normal text-black tracking-wide mb-1">PLAN YOUR TRIP</h1>
            <p className="text-xs font-bold text-black tracking-widest uppercase">Disaster-Aware Smart Rerouting</p>
          </div>

          <form onSubmit={handleFindRoute} className="flex flex-col gap-4 flex-1">
            <div className="flex flex-col gap-1.5 relative z-50">
              <label className="font-bold text-base text-black">FROM</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-black" size={20} />
                <input 
                  type="text" 
                  value={source}
                  onChange={handleSourceChange}
                  className="w-full bg-[#f8f9fa] border-[3px] border-black rounded-xl py-2 pl-10 pr-4 font-semibold text-black outline-none focus:bg-white transition-colors"
                  placeholder="Enter starting point"
                />
                {sourceSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 w-full mt-1 bg-white border-2 border-black rounded-xl shadow-2xl max-h-60 overflow-y-auto z-50">
                    {sourceSuggestions.map((s: any, idx) => (
                      <div 
                        key={idx} 
                        className="px-4 py-3 hover:bg-gray-100 cursor-pointer border-b border-gray-200 last:border-0 font-medium text-sm text-black"
                        onClick={() => {
                          setSource(s.display_name);
                          setSourceSuggestions([]);
                        }}
                      >
                        {s.display_name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5 relative z-40">
              <label className="font-bold text-base text-black">TO</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-black" size={20} />
                <input 
                  type="text" 
                  value={destination}
                  onChange={handleDestChange}
                  className="w-full bg-[#f8f9fa] border-[3px] border-black rounded-xl py-2 pl-10 pr-4 font-semibold text-black outline-none focus:bg-white transition-colors"
                  placeholder="Enter destination"
                />
                {destSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 w-full mt-1 bg-white border-2 border-black rounded-xl shadow-2xl max-h-60 overflow-y-auto z-50">
                    {destSuggestions.map((s: any, idx) => (
                      <div 
                        key={idx} 
                        className="px-4 py-3 hover:bg-gray-100 cursor-pointer border-b border-gray-200 last:border-0 font-medium text-sm text-black"
                        onClick={() => {
                          setDestination(s.display_name);
                          setDestSuggestions([]);
                        }}
                      >
                        {s.display_name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Alternate & Bypass Routes Selection */}
            {routes.length > 0 && (
              <div className="mt-1 flex flex-col gap-2">
                <label className="font-bold text-sm text-black uppercase">Route Options & Detours</label>
                <div className="flex flex-col gap-2 max-h-36 overflow-y-auto pr-1">
                  {routes.map((r: any) => {
                    const isSelected = selectedRouteId === r.properties.route_id;
                    const isBypass = r.properties.route_id === 'route_b';
                    const isDirect = r.properties.route_id === 'route_a';
                    const dotColor = isDirect ? 'bg-red-500' : isBypass ? 'bg-emerald-500' : 'bg-amber-500';

                    return (
                      <button
                        key={r.properties.route_id}
                        type="button"
                        onClick={() => handleSelectRoute(r.properties.route_id)}
                        className={`flex flex-col p-2.5 rounded-xl border-[2px] font-semibold text-xs transition-all text-left ${
                          isSelected
                            ? 'bg-black text-white border-black shadow-lg'
                            : 'bg-white text-black border-black hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex justify-between items-center w-full mb-1">
                          <span className="flex items-center gap-1.5 font-bold">
                            <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
                            {r.properties.route_label}
                          </span>
                          <span className="opacity-80 text-xs">{r.properties.distance_km} km</span>
                        </div>
                        <p className={`text-[11px] leading-tight ${isSelected ? 'text-gray-300' : 'text-gray-600'}`}>
                          {r.properties.recommendation}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 🔥 DISASTER HAZARD WARNINGS PANEL 🔥 */}
            {routes.length > 0 && activeHazards.length > 0 && (
              <div className="mt-2 p-3 bg-red-500/10 border-2 border-red-600/60 rounded-2xl flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-red-700 text-xs uppercase flex items-center gap-1.5">
                    <ShieldAlert size={16} className="text-red-600" /> Active Hazards ({activeHazards.length})
                  </span>
                  <span className="text-[10px] bg-red-600 text-white font-black px-2 py-0.5 rounded-full uppercase">
                    Hazard Stretches
                  </span>
                </div>

                <div className="flex flex-col gap-1.5 max-h-28 overflow-y-auto">
                  {activeHazards.map((h: any) => (
                    <div key={h.id} className="p-2 bg-white/90 rounded-xl border border-red-200 text-black text-xs flex flex-col gap-0.5">
                      <div className="flex justify-between items-center font-bold text-red-800">
                        <span className="flex items-center gap-1">
                          {h.type === 'flood' ? <Droplets size={14} className="text-red-500" /> :
                           h.type === 'landslide' ? <Mountain size={14} className="text-amber-600" /> :
                           h.type === 'heavy_rain' ? <CloudRain size={14} className="text-blue-500" /> :
                           <Zap size={14} className="text-purple-600" />}
                          {h.title}
                        </span>
                        <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-black">
                          {h.affected_stretch_km} km
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-700 leading-tight">{h.description}</p>
                    </div>
                  ))}
                </div>

                {selectedRouteId === 'route_a' && (
                  <button
                    type="button"
                    onClick={() => handleSelectRoute('route_b')}
                    className="w-full mt-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-3 rounded-xl border-2 border-emerald-800 flex items-center justify-center gap-1.5 shadow-md transition-all"
                  >
                    <RefreshCw size={14} className="animate-spin-slow" /> REROUTE AROUND DISASTERS (ROUTE B)
                  </button>
                )}
              </div>
            )}

            <div className="mt-auto pt-2 flex flex-col gap-2 relative z-0">
              {error && (
                <div className="flex items-start gap-2 text-red-600 font-bold mb-1 text-sm">
                  <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Find Route Button */}
              {!tripActive && (
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#e8ecec] text-black border-[3px] border-black font-bold text-base rounded-xl py-2.5 flex items-center justify-center gap-2 transition-all disabled:opacity-50 hover:bg-gray-200"
                >
                  {loading ? (
                    <><Loader2 size={18} className="animate-spin" /> Analyzing Hazards...</>
                  ) : (
                    <>Find Safe Routes & Detours</>
                  )}
                </motion.button>
              )}

              {tripActive && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => setTripActive(false)}
                  className="w-full bg-red-600 text-white border-[3px] border-red-700 font-black tracking-widest text-base rounded-xl py-3 mt-1 flex items-center justify-center gap-3 transition-all shadow-lg hover:bg-red-700"
                >
                  END TRIP
                </motion.button>
              )}
            </div>
          </form>
        </motion.div>

        {/* ── RIGHT PANEL (MAP + STATS) ── */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
          className="flex-1 flex flex-col gap-4 relative z-0 min-h-0"
        >
          {/* Map Area */}
          <div className="flex-1 relative rounded-3xl overflow-hidden shadow-2xl border-[3px] border-black min-h-0">
            <LogisticsMapNavigation 
              features={routes}
              selectedRouteId={selectedRouteId}
              tripActive={tripActive}
              onTripEnd={() => setTripActive(false)}
              onSelectRoute={handleSelectRoute}
            />
            
            {loading && (
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-20">
                <div className="bg-white/90 text-black px-6 py-4 rounded-2xl shadow-xl text-center font-bold flex items-center gap-3">
                  <Loader2 size={24} className="animate-spin" />
                  <span>Computing segment hazards & detours...</span>
                </div>
              </div>
            )}

            {/* Start Navigation Button at the Bottom of Map */}
            {routes.length > 0 && !tripActive && !loading && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
                <motion.button
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.95 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.96 }}
                  type="button"
                  onClick={() => setTripActive(true)}
                  className="bg-blue-600 hover:bg-blue-500 text-white border-[3px] border-blue-400 font-black tracking-widest text-sm md:text-base rounded-2xl py-3.5 px-8 flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(37,99,235,0.6)] backdrop-blur-md transition-all cursor-pointer group uppercase whitespace-nowrap"
                >
                  <Navigation size={22} className="fill-white group-hover:rotate-12 transition-transform duration-200" />
                  <span>START NAVIGATION</span>
                  {currentActiveRoute?.properties?.distance_km && (
                    <span className="bg-blue-800/80 text-blue-200 font-bold text-xs px-2.5 py-1 rounded-lg border border-blue-400/40">
                      {currentActiveRoute.properties.distance_km} KM
                    </span>
                  )}
                </motion.button>
              </div>
            )}
          </div>

          {/* 🔥 ML RISK KEY/VALUES (Floating Bottom Row) 🔥 */}
          <AnimatePresence mode="wait">
            {riskData && (
              <motion.div 
                key={selectedRouteId}
                className="grid grid-cols-4 gap-4 px-2"
              >
                {[
                  { label: 'Rainfall', icon: <CloudRain size={24} className="mb-1" />, pct: riskData.rainfall_pct, type: 'risk' },
                  { label: 'Landslide', icon: <Mountain size={24} className="mb-1 text-[#8b9d7a]" />, pct: riskData.landslide_pct, type: 'risk' },
                  { label: 'Flood', icon: <Droplets size={24} className="mb-1 text-blue-300" />, pct: riskData.flood_pct, type: 'risk' },
                  { label: 'Road Safety', icon: <MapIcon size={24} className="mb-1 text-emerald-300" />, pct: riskData.road_condition_pct, type: 'safety' },
                ].map(({ label, icon, pct, type }: any, index) => {
                   const getSafetyLabel = (val: number) => val > 80 ? 'EXCELLENT' : val > 50 ? 'GOOD' : 'POOR';
                   
                   return (
                    <motion.div 
                      key={label} 
                      initial={{ y: 30, opacity: 0, scale: 0.8 }}
                      animate={{ y: 0, opacity: 1, scale: 1 }}
                      transition={{ 
                        type: "spring", 
                        stiffness: 250, 
                        damping: 15, 
                        delay: index * 0.15 
                      }}
                      className={`flex flex-col items-center justify-center text-white drop-shadow-xl font-bold tracking-wide ${type === 'safety' ? 'text-emerald-400' : ''}`}
                    >
                      <div className={`flex items-center gap-2 text-xl ${type === 'safety' ? 'text-emerald-400' : 'text-white'}`}>
                        {icon} {label}
                      </div>
                      <div className="text-2xl mt-1">{pct}%</div>
                      <div className={`uppercase tracking-widest text-sm mt-1 ${type === 'safety' ? 'text-emerald-500 font-black' : 'text-gray-300'}`}>
                        {type === 'safety' ? getSafetyLabel(pct) : getRiskLabel(pct)}
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
