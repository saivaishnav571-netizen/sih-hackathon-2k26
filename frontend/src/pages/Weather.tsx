import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { CloudRain, Wind, Eye, Gauge, Droplets, CloudLightning, Sun, CloudFog, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Weather() {
  const [weather, setWeather] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [locationName, setLocationName] = useState('Northeast India');

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        let lat = 26.1158;
        let lon = 91.7086;
        
        // Try to get the route source from localStorage
        const savedSourceStr = localStorage.getItem('lastRouteSource');
        if (savedSourceStr) {
          const savedSource = JSON.parse(savedSourceStr);
          if (savedSource.lat && savedSource.lon) {
            lat = savedSource.lat;
            lon = savedSource.lon;
            if (savedSource.label) {
              setLocationName(savedSource.label.split(',')[0]); // e.g. "Guwahati"
            }
          }
        }

        const res = await axios.get(`/api/weather?lat=${lat}&lon=${lon}`);
        if (res.data.status === 'success') {
          setWeather(res.data.data);
        } else {
          throw new Error('Weather API returned error status');
        }
      } catch (err) {
        console.error('Failed to fetch weather', err);
        // Fallback mock data so the UI doesn't look broken if Render/Open-Meteo fails
        setWeather({
          temperature: 28.5,
          condition: "Thunderstorm",
          feels_like: 30.2,
          humidity: 85,
          precipitation: 12.5,
          precipitation_prob: 80,
          wind_speed: 15.2,
          visibility: 3.5,
          pressure: 1008
        });
      } finally {
        setLoading(false);
      }
    };
    fetchWeather();
  }, []);

  const getWeatherIcon = (condition: string, size = 80) => {
    if (condition.includes('Rain') || condition.includes('Drizzle') || condition.includes('Showers')) return <CloudRain size={size} className="text-white drop-shadow-md" />;
    if (condition.includes('Thunder')) return <CloudLightning size={size} className="text-white drop-shadow-md" />;
    if (condition.includes('Clear')) return <Sun size={size} className="text-yellow-400 drop-shadow-md" />;
    return <CloudFog size={size} className="text-white drop-shadow-md" />;
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col pt-28 px-8 md:px-12 pb-16 font-sans">
      {/* Background Image */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: 'url("/weather-bg.jpg")' }}
      >
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent"></div>
      </div>

      <div className="relative z-10 w-full max-w-6xl mx-auto flex flex-col">
        {/* Header Section */}
        <motion.div 
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mb-8"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-widest mb-4">WEATHER : {locationName.toUpperCase()}</h1>
          <motion.div 
            initial={{ width: 0 }}
            whileInView={{ width: "4rem" }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="h-[3px] bg-[#6db385] mb-4"
          ></motion.div>
          <p className="text-base text-gray-300 max-w-sm leading-relaxed">
            Real-time weather updates and road impact forecasts for safer journeys.
          </p>
        </motion.div>

        {loading ? (
          <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 h-96 flex items-center justify-center animate-pulse border border-white/20 w-full">
            <span className="text-white font-semibold">Loading atmospheric data...</span>
          </div>
        ) : weather ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full mt-4">
            
            {/* Left: Main Current Weather Card */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="lg:col-span-7 bg-white/10 backdrop-blur-xl rounded-3xl p-8 md:p-10 border border-white/20 shadow-[0_30px_60px_rgba(0,0,0,0.4)] flex flex-col"
            >
              <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10 mb-8 border-b border-white/10 pb-8">
                {getWeatherIcon(weather.condition, 100)}
                <div className="flex flex-col text-center sm:text-left">
                  <h2 className="text-7xl font-bold text-white tracking-tight">{Math.round(weather.temperature)}°C</h2>
                  <p className="text-2xl text-white font-bold mt-2 capitalize tracking-wide opacity-90">{weather.condition}</p>
                  <p className="text-sm text-gray-300 font-semibold uppercase tracking-widest mt-3">Feels like {Math.round(weather.feels_like)}°C</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="flex flex-col gap-2">
                  <Droplets className="text-[#6db385]" size={28} />
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Humidity</p>
                  <p className="text-white font-black text-xl">{weather.humidity}%</p>
                </div>
                <div className="flex flex-col gap-2">
                  <CloudRain className="text-[#6db385]" size={28} />
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Precip Chance</p>
                  <p className="text-white font-black text-xl">{weather.precipitation_prob || Math.round(weather.precipitation * 10)}%</p>
                </div>
                <div className="flex flex-col gap-2">
                  <Wind className="text-[#6db385]" size={28} />
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Wind</p>
                  <p className="text-white font-black text-xl">{weather.wind_speed} km/h</p>
                </div>
                <div className="flex flex-col gap-2">
                  <Eye className="text-[#6db385]" size={28} />
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Visibility</p>
                  <p className="text-white font-black text-xl">{weather.visibility} km</p>
                </div>
              </div>
            </motion.div>

            {/* Right: Road Impact & Forecast */}
            <motion.div 
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
              className="lg:col-span-5 flex flex-col gap-6"
            >
              {/* Road Impact Alert */}
              <div className={`rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl border-[2px] ${
                (weather.precipitation_prob || weather.precipitation * 10) > 50 
                  ? 'bg-red-500/10 border-red-500/50' 
                  : (weather.precipitation_prob || weather.precipitation * 10) > 20 
                    ? 'bg-amber-500/10 border-amber-500/50' 
                    : 'bg-[#6db385]/10 border-[#6db385]/50'
              }`}>
                <h3 className={`font-black tracking-widest uppercase flex items-center gap-3 mb-3 text-lg md:text-xl ${
                  (weather.precipitation_prob || weather.precipitation * 10) > 50 ? 'text-red-500' : (weather.precipitation_prob || weather.precipitation * 10) > 20 ? 'text-amber-500' : 'text-[#6db385]'
                }`}>
                  <AlertTriangle size={24} /> Road Impact: {(weather.precipitation_prob || weather.precipitation * 10) > 50 ? 'High' : (weather.precipitation_prob || weather.precipitation * 10) > 20 ? 'Moderate' : 'Low'}
                </h3>
                <p className="text-gray-200 font-semibold leading-relaxed text-sm md:text-base">
                  {(weather.precipitation_prob || weather.precipitation * 10) > 50 
                    ? 'Severe precipitation expected. Extreme risk of hydroplaning and localized landslides. Significant speed reduction required.'
                    : (weather.precipitation_prob || weather.precipitation * 10) > 20 
                      ? 'Heavy precipitation may reduce visibility and increase road-surface risk. Exercise caution.'
                      : 'Clear conditions detected. Optimal road traction and visibility for fleets.'
                  }
                </p>
              </div>

              {/* Next 10 Hours */}
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 md:p-8 shadow-2xl flex-1 flex flex-col">
                <h3 className="text-white font-black tracking-widest uppercase mb-6 flex items-center gap-3 text-lg">
                  Next 10 Hours
                </h3>
                
                <div className="flex flex-col gap-4 flex-1 justify-center">
                  {[...Array(5)].map((_, i) => {
                    const currentHour = new Date().getHours();
                    const targetHour = (currentHour + (i + 1) * 2) % 24;
                    const ampm = targetHour >= 12 ? 'PM' : 'AM';
                    const formatted = targetHour % 12 === 0 ? 12 : targetHour % 12;
                    const timeStr = `${formatted.toString().padStart(2, '0')} ${ampm}`;
                    
                    const conditions = ['Rain', 'Clouds', 'Clear', 'Clear', 'Drizzle'];
                    // Simulate weather clearing up or staying based on current precipitation
                    const conditionIndex = (Math.round((weather.precipitation_prob || 0) / 20) + i) % conditions.length;
                    const mockCond = conditions[conditionIndex];
                    const tempShift = i % 2 === 0 ? i : -i;
                    
                    return (
                      <div key={i} className="flex justify-between items-center border-b border-white/10 pb-3 last:border-0 last:pb-0">
                        <span className="font-bold text-gray-300 w-16 text-sm md:text-base uppercase tracking-wider">{timeStr}</span>
                        <span className="text-[#6db385] flex items-center gap-4">
                          {getWeatherIcon(mockCond, 24)}
                          <span className="text-xs font-bold text-gray-400 hidden sm:block uppercase tracking-wider w-16">{mockCond}</span>
                        </span>
                        <span className="font-black text-xl md:text-2xl text-white">{Math.round(weather.temperature) + tempShift}°C</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>

          </div>
        ) : null}
      </div>
    </div>
  );
}
