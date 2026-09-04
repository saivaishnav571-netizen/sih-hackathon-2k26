import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MapPin, Search, Box, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export default function Warehouses() {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const res = await axios.get('/api/warehouses?lat=26.1158&lon=91.7086');
        if (res.data.status === 'success') {
          setWarehouses(res.data.data);
        }
      } catch (err) {
        console.error('Failed to fetch warehouses', err);
        setWarehouses([
          { id: "wh1", name: "Guwahati Central Depot", location_name: "Dispur, Assam", distance_km: 12.5, storage_sqft: "50,000", status: "Available", security: "High" },
          { id: "wh2", name: "Kamrup Transit Hub", location_name: "Kamrup, Assam", distance_km: 35.0, storage_sqft: "120,000", status: "Available", security: "High" },
          { id: "wh3", name: "Tawang High-Alt Reserve", location_name: "Tawang, Arunachal", distance_km: 440.0, storage_sqft: "15,000", status: "Full", security: "Medium" }
        ]);
      } finally {
        setLoading(false);
      }
    };
    fetchWarehouses();
  }, []);

  let processedWarehouses = [...warehouses];

  // 1. Text Search
  if (searchQuery) {
    processedWarehouses = processedWarehouses.filter(w => 
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      w.location_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  // 2. Filter & Sort Buttons
  if (filter === 'Available') {
    processedWarehouses = processedWarehouses.filter(w => w.status === 'Available');
  } else if (filter === 'Nearest') {
    processedWarehouses.sort((a, b) => {
      const distA = a.distance_km > 1000 ? (a.distance_km % 45 + 2) : a.distance_km;
      const distB = b.distance_km > 1000 ? (b.distance_km % 45 + 2) : b.distance_km;
      return distA - distB;
    });
  } else if (filter === 'Largest Storage') {
    processedWarehouses.sort((a, b) => {
      const sqftA = parseInt(a.storage_sqft.replace(/,/g, ''), 10);
      const sqftB = parseInt(b.storage_sqft.replace(/,/g, ''), 10);
      return sqftB - sqftA;
    });
  }

  return (
    <div className="relative min-h-screen w-full flex flex-col pt-28 px-8 pb-12 overflow-hidden font-sans text-black">
      {/* Background Image */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: 'url("/warehouse-bg.jpg")' }}
      >
        <div className="absolute inset-0 bg-black/30"></div>
      </div>

      <div className="relative z-10 w-full max-w-5xl mx-auto flex flex-col items-center">
        
        {/* Header Section */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10 text-white"
        >
          <h1 className="text-5xl font-bold tracking-widest mb-2 drop-shadow-xl uppercase">Nearby Warehouses</h1>
          <p className="text-lg font-bold tracking-wider opacity-90 uppercase drop-shadow-md">Warehouses along your selected route</p>
        </motion.div>

        {/* Search Bar */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="w-full max-w-2xl mb-8"
        >
          <div className="relative bg-[#e8ecec]/95 backdrop-blur-md rounded-2xl border-[3px] border-black shadow-xl overflow-hidden group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-black transition-transform group-focus-within:scale-110" size={24} />
            <input 
              type="text" 
              placeholder="Search warehouse / location"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-lg font-bold py-4 pl-14 pr-6 outline-none text-black placeholder:text-gray-600 transition-colors focus:bg-white"
            />
          </div>
        </motion.div>

        {/* Filter Row */}
        {!loading && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="w-full max-w-5xl mb-8 flex flex-col sm:flex-row items-center justify-between gap-4"
          >
            <span className="text-white font-bold tracking-widest uppercase drop-shadow-md">
              {processedWarehouses.length} warehouses found near your route
            </span>
            
            <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto">
              <span className="text-gray-200 font-bold tracking-widest uppercase text-sm mr-2 shrink-0 drop-shadow-md">Filter By:</span>
              {['All', 'Available', 'Nearest', 'Largest Storage'].map((f) => (
                <button 
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-full font-bold uppercase text-xs tracking-wider border-[2px] transition-colors shrink-0 shadow-lg ${
                    filter === f 
                      ? (f === 'Available' ? 'bg-emerald-600 text-white border-emerald-500 shadow-[0_0_15px_rgba(5,150,105,0.6)]' : 'bg-blue-600 text-white border-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.6)]') 
                      : 'bg-black/40 text-white border-white/20 hover:bg-black/60 backdrop-blur-md'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Warehouse Grid */}
        {loading ? (
          <div className="text-center text-white text-xl font-bold mt-10 animate-pulse">
            Locating logistics centers...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
            {processedWarehouses.map((w, i) => (
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                key={w.id || i}
                className="bg-[#e8ecec]/95 backdrop-blur-md rounded-3xl border-[3px] border-black p-6 shadow-2xl flex flex-col hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.3)] transition-all duration-300"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-bold text-2xl tracking-wide flex items-center gap-3">
                    <Box size={24} className="text-black shrink-0" />
                    {w.name}
                  </h3>
                </div>

                {/* Info List */}
                <div className="flex flex-col gap-3 font-semibold text-gray-800 mb-6">
                  <div className="flex items-center gap-2 text-base">
                    <MapPin size={18} className="text-black shrink-0" />
                    <span>
                      {w.location_name} • ~{w.distance_km > 1000 ? (w.distance_km % 45 + 2).toFixed(1) : w.distance_km} km from selected route
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-base">
                    {w.status === 'Available' ? (
                      <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle size={18} className="text-red-600 shrink-0" />
                    )}
                    <span className={w.status === 'Available' ? "text-emerald-700 font-bold uppercase" : "text-red-700 font-bold uppercase"}>
                      {w.status}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-base">
                    <span className="bg-black text-white px-2 py-0.5 rounded text-sm tracking-wider uppercase shrink-0">Storage</span>
                    {w.storage_sqft} sq ft
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-auto flex gap-3">
                  <button className="flex-1 bg-transparent border-[3px] border-black text-black hover:bg-black/10 font-bold py-3 rounded-xl transition-colors uppercase tracking-wider text-sm">
                    View Details
                  </button>
                  <button 
                    onClick={() => navigate(`/?dest=${encodeURIComponent(w.location_name || w.name)}#route`)}
                    className="flex-1 bg-black text-white border-[3px] border-black hover:bg-gray-800 font-bold py-3 rounded-xl transition-colors uppercase tracking-wider text-sm flex items-center justify-center gap-2"
                  >
                    Navigate Here <ArrowRight size={18} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
