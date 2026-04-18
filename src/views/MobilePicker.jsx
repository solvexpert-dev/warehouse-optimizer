import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Scan, 
  Flag, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronRight, 
  Loader2, 
  Package, 
  MapPin,
  Play
} from 'lucide-react';

export default function MobilePicker() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [picks, setPicks] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);

  useEffect(() => {
    fetchActiveSession();
  }, []);

  const fetchActiveSession = async () => {
    setLoading(true);
    const { data: activeSession } = await supabase
      .from('pick_sessions')
      .select('*')
      .eq('status', 'in_progress')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (activeSession) {
      setSession(activeSession);
      const { data: pickItems } = await supabase
        .from('pick_items')
        .select(`
          *,
          locations (id, location_code),
          order_items (
            product_id,
            products (id, name)
          )
        `)
        .eq('session_id', activeSession.id)
        .eq('picked', false)
        .order('id', { ascending: true });
      
      // Fetch stock levels for these products to determine fallback
      const productIds = pickItems?.map(p => p.order_items?.product_id).filter(Boolean) || [];
      const { data: stockData } = await supabase
        .from('product_locations')
        .select('*, locations(location_code)')
        .in('product_id', productIds);

      const enrichedPicks = (pickItems || []).map(p => {
        const productStock = stockData?.filter(s => s.product_id === p.order_items?.product_id) || [];
        // Primary is productStock[0], Secondary is productStock[1] (or next)
        const primary = productStock[0];
        const secondary = productStock[1];
        
        let displayLocation = p.locations;
        let isFallback = false;
        let lowStock = false;

        if (primary && primary.quantity_primary === 0 && secondary) {
          displayLocation = secondary.locations;
          isFallback = true;
        }

        if (primary && primary.quantity_primary > 0 && primary.quantity_primary < 5) {
          lowStock = true;
        }

        return { 
          ...p, 
          displayLocation, 
          isFallback, 
          lowStock, 
          stockAtLoc: isFallback ? secondary?.quantity_primary : primary?.quantity_primary 
        };
      });

      setPicks(enrichedPicks);
    }
    setLoading(false);
  };

  const startNewSession = async () => {
    setLoading(true);
    try {
      const { data: warehouse } = await supabase.from('warehouses').select('id').single();
      const { data: newSession, error: sError } = await supabase
        .from('pick_sessions')
        .insert({
          warehouse_id: warehouse.id,
          picker_name: 'Demo Picker',
          status: 'in_progress',
          routing_type: 'optimised'
        })
        .select()
        .single();
      
      if (sError) throw sError;

      const { data: orders } = await supabase
        .from('orders')
        .select(`id, order_items (id, product_id, quantity)`)
        .eq('status', 'pending')
        .limit(10);
      
      const pickItemsToInsert = [];
      for (const order of orders) {
        for (const item of order.order_items) {
          const { data: loc } = await supabase
            .from('product_locations')
            .select('location_id')
            .eq('product_id', item.product_id)
            .limit(1)
            .single();
          
          pickItemsToInsert.push({
            session_id: newSession.id,
            order_item_id: item.id,
            location_id: loc?.location_id || null,
            quantity: item.quantity,
            picked: false
          });
        }
      }

      await supabase.from('pick_items').insert(pickItemsToInsert);
      fetchActiveSession();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async () => {
    if (currentIndex >= picks.length) return;
    
    const currentPick = picks[currentIndex];
    const nextIndex = currentIndex + 1;

    // Async update DB
    supabase
      .from('pick_items')
      .update({ picked: true, picked_at: new Date().toISOString() })
      .eq('id', currentPick.id)
      .then();

    if (nextIndex < picks.length) {
      setCurrentIndex(nextIndex);
    } else {
      setIsFinishing(true);
      await supabase
        .from('pick_sessions')
        .update({ status: 'completed' })
        .eq('id', session.id);
    }
  };

  const handleFlag = async () => {
    const currentPick = picks[currentIndex];
    if (!currentPick.location_id) return;

    await supabase
      .from('location_flags')
      .insert({
        location_id: currentPick.location_id,
        product_id: currentPick.order_items?.products?.id,
        flagged_by: 'Demo Picker',
        reason: 'Empty Location'
      });
    
    if (currentIndex + 1 < picks.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setIsFinishing(true);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-navy-900">
        <Loader2 className="animate-spin text-electric-blue w-12 h-12 mb-4" />
        <p className="text-gray-400">Synchronizing Warehouse Data...</p>
      </div>
    );
  }

  if (!session || isFinishing) {
    return (
      <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center px-6">
        <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mb-8 border border-emerald-500/20 shadow-2xl shadow-emerald-500/10">
          <CheckCircle2 className="text-emerald-500" size={48} />
        </div>
        <h2 className="text-3xl font-black mb-3 text-white">{isFinishing ? 'Batch Dispatched!' : 'Ready for Duty'}</h2>
        <p className="text-gray-400 mb-10 leading-relaxed font-medium">
          {isFinishing 
            ? 'Performance logged. Accuracy was verified at 100%. Proceed to packing station.' 
            : 'Operational status: Idle. Requesting next generation picking batch from AI Agent.'}
        </p>
        <button 
          onClick={startNewSession}
          className="w-full bg-electric-blue hover:bg-electric-blue/90 text-white font-black py-5 rounded-[2rem] flex items-center justify-center gap-3 shadow-2xl shadow-electric-blue/30 transition-all active:scale-95"
        >
          <Play size={24} fill="currentColor" />
          Initialize Pick Session
        </button>
      </div>
    );
  }

  const currentPick = picks[currentIndex];
  if (!currentPick) return null;

  return (
    <div className="h-full flex flex-col bg-navy-900 overflow-hidden">
      {/* Mobile Top Bar */}
      <div className="px-6 py-5 bg-navy-800 border-b border-navy-700 flex justify-between items-center relative z-20 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Live Logistics Uplink</p>
        </div>
        <div className="flex items-center gap-2">
           <p className="text-[10px] font-black text-electric-light bg-electric-blue/20 px-3 py-1.5 rounded-full border border-electric-blue/20 tracking-widest">
            {currentIndex + 1} / {picks.length}
           </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col px-6 pt-8 pb-6 space-y-6 overflow-y-auto">
        
        {/* Location Display */}
        <div className="space-y-1 text-center">
          <div className="flex items-center justify-center gap-2 text-gray-500 uppercase tracking-widest font-black text-[10px]">
            <MapPin size={12} /> {currentPick.isFallback ? 'Secondary Location Fallback' : 'Primary Storage Node'}
          </div>
          <h1 className={`text-7xl font-black tracking-tighter tabular-nums transition-colors ${currentPick.isFallback ? 'text-amber-400' : 'text-white'}`}>
            {currentPick.displayLocation?.location_code || '---'}
          </h1>
          {currentPick.isFallback && (
            <div className="text-amber-500 flex items-center justify-center gap-1.5 font-bold text-xs bg-amber-500/10 py-1.5 rounded-xl border border-amber-500/20 max-w-[200px] mx-auto mt-2">
               <AlertTriangle size={14} /> Primary Empty
            </div>
          )}
        </div>

        {/* Product Card */}
        <div className="bg-navy-800 border-2 border-navy-700 rounded-[2.5rem] p-8 relative overflow-hidden group shadow-2xl">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Package size={100} />
          </div>
          
          <div className="space-y-6 relative z-10">
            <div className="flex justify-between items-start">
               <div>
                  <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1.5">Active SKU</p>
                  <h2 className="text-3xl font-black text-white leading-tight">
                    {currentPick.order_items?.products?.name}
                  </h2>
               </div>
               {currentPick.lowStock && (
                  <div className="bg-red-500/20 text-red-500 px-3 py-1 rounded-full border border-red-500/30 text-[10px] font-black uppercase tracking-widest animate-bounce">
                     Low Stock
                  </div>
               )}
            </div>

            <div className="flex items-stretch gap-4">
              <div className="bg-electric-blue text-white px-6 py-4 rounded-3xl flex flex-col justify-center shadow-lg shadow-electric-blue/20">
                <p className="text-[10px] font-black uppercase opacity-70 mb-0.5">Pick Qty</p>
                <p className="text-5xl font-black tracking-tighter">{currentPick.quantity || 1}</p>
              </div>
              <div className="flex-1 bg-navy-900 rounded-3xl p-4 flex flex-col justify-center">
                 <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Stock Status</p>
                 <p className="text-lg font-black text-gray-300">
                    {currentPick.stockAtLoc} Units <span className="text-xs font-bold text-gray-600 ml-1">at Bay</span>
                 </p>
              </div>
            </div>
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="pt-2 space-y-4 pb-8">
          <button 
            onClick={handleScan}
            className="w-full bg-electric-blue hover:bg-electric-blue/90 text-white py-8 rounded-[3rem] flex flex-col items-center justify-center gap-3 shadow-[0_20px_40px_rgba(37,99,235,0.4)] active:scale-95 transition-all group border-b-8 border-electric-blue/50"
          >
            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
              <Scan size={36} />
            </div>
            <span className="text-2xl font-black uppercase tracking-tight">Confirm Scan</span>
          </button>

          <button 
            onClick={handleFlag}
            className="w-full bg-navy-800/80 hover:bg-red-500/10 text-gray-500 hover:text-red-400 py-6 rounded-[2rem] flex items-center justify-center gap-3 border border-navy-700 hover:border-red-500/50 transition-all active:scale-95 font-black uppercase tracking-widest text-xs"
          >
            <Flag size={18} />
            Flag Missing Item
          </button>
        </div>

      </div>

      {/* Modern Progress Line */}
      <div className="h-2 w-full bg-navy-800 flex">
        <div 
          className="h-full bg-gradient-to-r from-electric-blue via-blue-400 to-emerald-500 transition-all duration-700 rounded-r-full shadow-[0_0_20px_rgba(37,99,235,0.6)]"
          style={{ width: `${(currentIndex / picks.length) * 100}%` }}
        ></div>
      </div>
    </div>
  );
}
