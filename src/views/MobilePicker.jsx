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
          locations (location_code),
          order_items (
            quantity,
            products (name)
          )
        `)
        .eq('session_id', activeSession.id)
        .eq('picked', false)
        .order('id', { ascending: true }); // In a real app, this would follow the optimised path sort order
      
      setPicks(pickItems || []);
    }
    setLoading(false);
  };

  const startNewSession = async () => {
    setLoading(true);
    try {
      // 1. Get a warehouse
      const { data: warehouse } = await supabase.from('warehouses').select('id').single();
      
      // 2. Create session
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

      // 3. Get some pending orders to pick
      const { data: orders } = await supabase
        .from('orders')
        .select(`
          id,
          order_items (
            id,
            product_id
          )
        `)
        .eq('status', 'pending')
        .limit(10); // Batch of 10 for demo
      
      // 4. Create pick items
      const pickItemsToInsert = [];
      for (const order of orders) {
        for (const item of order.order_items) {
          // Find a location for this product
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
        flagged_by: 'Demo Picker',
        reason: 'Empty Location'
      });
    
    // Auto move to next item even if not picked
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
        <p className="text-gray-400">Loading Picker Interface...</p>
      </div>
    );
  }

  if (!session || isFinishing) {
    return (
      <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center px-6">
        <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 border border-emerald-500/20">
          <CheckCircle2 className="text-emerald-500" size={40} />
        </div>
        <h2 className="text-2xl font-bold mb-2">{isFinishing ? 'Batch Completed!' : 'No Active Session'}</h2>
        <p className="text-gray-400 mb-8">
          {isFinishing 
            ? 'Great work! All items in this batch have been processed.' 
            : 'Ready to start your shift? Generate a new optimised picking path.'}
        </p>
        <button 
          onClick={startNewSession}
          className="w-full bg-electric-blue hover:bg-electric-blue/90 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-electric-blue/20 transition-transform active:scale-95"
        >
          <Play size={24} fill="currentColor" />
          Start New Pick Batch
        </button>
      </div>
    );
  }

  const currentPick = picks[currentIndex];
  if (!currentPick) return null;

  return (
    <div className="h-full flex flex-col bg-navy-900 overflow-hidden">
      {/* Mobile Top Bar */}
      <div className="p-4 bg-navy-800 border-b border-navy-700 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Live Session</p>
        </div>
        <p className="text-xs font-bold text-electric-light bg-electric-blue/10 px-3 py-1 rounded-full border border-electric-blue/20">
          {currentIndex + 1} / {picks.length} Items
        </p>
      </div>

      <div className="flex-1 flex flex-col px-6 pt-10 pb-6 space-y-8 overflow-y-auto">
        
        {/* Location Display */}
        <div className="space-y-2 text-center">
          <div className="inline-flex items-center gap-2 text-gray-500 uppercase tracking-widest font-bold text-xs">
            <MapPin size={14} /> Bay Location
          </div>
          <h1 className="text-7xl font-black text-white tracking-tight tabular-nums">
            {currentPick.locations?.location_code || 'N/A'}
          </h1>
        </div>

        {/* Product Card */}
        <div className="bg-navy-800 border-2 border-navy-700 rounded-3xl p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Package size={80} />
          </div>
          
          <div className="space-y-6 relative z-10">
            <div>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-1">Pick Product</p>
              <h2 className="text-3xl font-bold text-white leading-tight">
                {currentPick.order_items?.products?.name}
              </h2>
            </div>

            <div className="flex items-center gap-4">
              <div className="bg-electric-blue text-white px-6 py-3 rounded-2xl">
                <p className="text-xs font-bold uppercase opacity-70 mb-1">Quantity</p>
                <p className="text-4xl font-black">{currentPick.order_items?.quantity}</p>
              </div>
              <div className="flex-1 text-gray-400 text-sm italic py-2">
                Scan barcode on the item to confirm.
              </div>
            </div>
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="pt-4 space-y-4 pb-10">
          <button 
            onClick={handleScan}
            className="w-full bg-electric-blue hover:bg-electric-blue/90 text-white py-8 rounded-[40px] flex flex-col items-center justify-center gap-3 shadow-2xl shadow-electric-blue/30 active:scale-95 transition-all group"
          >
            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
              <Scan size={32} />
            </div>
            <span className="text-2xl font-black uppercase tracking-tighter">Confirm Scan</span>
          </button>

          <button 
            onClick={handleFlag}
            className="w-full bg-navy-800/50 hover:bg-red-500/10 text-gray-500 hover:text-red-400 py-6 rounded-3xl flex items-center justify-center gap-3 border border-navy-700 hover:border-red-500/50 transition-all active:scale-95"
          >
            <Flag size={20} />
            <span className="font-bold uppercase tracking-wider text-sm">Flag Empty Location</span>
          </button>
        </div>

      </div>

      {/* Persistent Progress Bar */}
      <div className="h-2 w-full bg-navy-800">
        <div 
          className="h-full bg-gradient-to-r from-electric-blue to-emerald-500 transition-all duration-500 rounded-r-full shadow-[0_0_15px_rgba(37,99,235,0.5)]"
          style={{ width: `${((currentIndex) / picks.length) * 100}%` }}
        ></div>
      </div>
    </div>
  );
}
