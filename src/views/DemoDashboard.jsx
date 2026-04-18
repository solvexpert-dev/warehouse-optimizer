import React, { useMemo, useState } from 'react';
import { generateOrders, calculateNaiveRoute, calculateOptimisedRoute } from '../utils/data';
import WarehouseGrid from '../components/WarehouseGrid';
import { Package, TrendingDown, Clock, ShieldCheck, RefreshCw } from 'lucide-react';

export default function DemoDashboard() {
  const [seed, setSeed] = useState(0);

  const { orders, naiveRoute, optimisedRoute } = useMemo(() => {
    const o = generateOrders();
    return {
      orders: o,
      naiveRoute: calculateNaiveRoute(o),
      optimisedRoute: calculateOptimisedRoute(o),
    }
  }, [seed]);

  const totalItems = orders.reduce((acc, o) => acc + o.items.length, 0);

  // Calculations
  const walkingSpeed = 1.4; // m/s
  const naiveSeconds = naiveRoute.distance / walkingSpeed;
  const optSeconds = optimisedRoute.distance / walkingSpeed;
  
  const naiveOph = Math.round(50 / (naiveSeconds / 3600));
  const optOph = Math.round(50 / (optSeconds / 3600));
  
  const timeSavedHoursBatch = (naiveSeconds - optSeconds) / 3600;
  const hoursSavedAnnual = timeSavedHoursBatch * 5000; // Assume 20 batches/day * 250 days
  const costSavingsAnnual = hoursSavedAnnual * 15; 
  const distanceSavedAnnualKm = ((naiveRoute.distance - optimisedRoute.distance) * 5000) / 1000;

  return (
    <div className="space-y-6">
      
      {/* Header Specific to Dashboard */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Pick Optimisation Demo Engine</h2>
          <p className="text-gray-400 mt-1">Mock test data visualizer (Not connected to Supabase real records yet)</p>
        </div>
        
        <button 
          onClick={() => setSeed(s => s + 1)}
          className="flex items-center gap-2 bg-[#1E293B] hover:bg-[#334155] px-4 py-2 rounded-lg transition-colors border border-[#475569] text-sm font-medium"
        >
          <RefreshCw size={16} /> Generate Mock Batch
        </button>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#111827] border border-[#1F2937] p-5 rounded-xl shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Package size={64} />
            </div>
            <p className="text-gray-400 text-sm font-medium">Items to Pick (Batch)</p>
            <p className="text-3xl font-bold mt-2">{totalItems} <span className="text-lg text-gray-500 font-normal">items</span></p>
            <div className="w-full bg-navy-800 rounded-full h-1.5 mt-3 mb-1">
              <div className="bg-electric-blue h-1.5 rounded-full" style={{ width: '100%' }}></div>
            </div>
            <p className="text-xs text-electric-light relative z-10">Across 5 channels (Amz, Shopify, etc)</p>
          </div>

          <div className="bg-[#111827] border border-[#1F2937] p-5 rounded-xl shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Clock size={64} />
            </div>
            <p className="text-gray-400 text-sm font-medium">Orders / Hour</p>
            <div className="flex items-end gap-3 mt-2">
              <p className="text-3xl font-bold text-red-400">{naiveOph}</p>
              <p className="text-gray-500 pb-1">vs</p>
              <p className="text-3xl font-bold text-emerald-400">{optOph}</p>
            </div>
            {/* Split Progress Bar */}
            <div className="w-full bg-navy-800 rounded-full h-1.5 mt-3 mb-1 flex overflow-hidden">
              <div className="bg-red-500 h-full" style={{ width: `${(naiveOph / optOph) * 100}%` }}></div>
              <div className="bg-emerald-500 h-full" style={{ flex: 1 }}></div>
            </div>
            <p className="text-xs text-emerald-500 font-medium relative z-10">+{Math.round((optOph-naiveOph)/naiveOph * 100)}% Productivity</p>
          </div>

          <div className="bg-gradient-to-br from-[#111827] to-[#1E293B] border border-electric-blue/30 p-5 rounded-xl shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-electric-blue transition-transform group-hover:scale-110">
              <TrendingDown size={64} />
            </div>
            <p className="text-gray-300 text-sm font-medium">Annual Distance Saved</p>
            <p className="text-3xl font-bold text-white mt-2">{distanceSavedAnnualKm.toLocaleString(undefined, {maximumFractionDigits:0})} <span className="text-lg text-gray-400 font-normal">km</span></p>
            
            <div className="w-full bg-navy-900 rounded-full h-1.5 mt-3 mb-1">
              <div className="bg-electric-light h-1.5 rounded-full" style={{ width: '80%' }}></div>
            </div>
            <p className="text-xs text-gray-400 relative z-10">Based on 5,000 batches / year</p>
          </div>

          <div className="bg-gradient-to-br from-[#022c22] to-[#064e3b] border border-emerald-800/50 p-5 rounded-xl shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-20 text-emerald-400 transition-transform group-hover:scale-110">
              <ShieldCheck size={64} />
            </div>
            <p className="text-emerald-100 text-sm font-medium">Est. Financial Savings / Yr</p>
            <p className="text-3xl font-bold text-white mt-2">£{costSavingsAnnual.toLocaleString(undefined, {maximumFractionDigits:0})}</p>
            
            <div className="w-full bg-[#064e3b] rounded-full h-1.5 mt-3 mb-1 shadow-inner border border-emerald-900/50">
              <div className="bg-emerald-400 h-1.5 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.8)]" style={{ width: '100%' }}></div>
            </div>
            <p className="text-xs text-emerald-200 relative z-10">Labor cost reclaimed (1 Picker)</p>
          </div>
      </div>

      {/* Grids Side by Side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 h-[700px]">
        <WarehouseGrid 
          title="Naive Routing" 
          mode="naive" 
          route={naiveRoute} 
        />
        <WarehouseGrid 
          title="Optimised Routing" 
          mode="optimised" 
          route={optimisedRoute} 
        />
      </div>

    </div>
  );
}
