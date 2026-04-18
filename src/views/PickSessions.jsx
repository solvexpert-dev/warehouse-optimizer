import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { calculateSessionMetrics } from '../utils/data';
import { 
  Plus, 
  Map, 
  Clock, 
  CheckCircle2, 
  Loader2, 
  User, 
  TrendingDown, 
  ArrowRight,
  TrendingUp,
  Package,
  ChevronRight
} from 'lucide-react';

export default function PickSessions() {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [isCreating, setIsCreating] = useState(false);

  const fetchSessions = async () => {
    try {
      const { data: sessionsData, error } = await supabase
        .from('pick_sessions')
        .select(`
          *,
          pick_items (
            id,
            picked,
            locations (location_code)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Session Fetch Error:", error);
        return;
      }

      const processed = (sessionsData || []).map(s => {
        const items = s.pick_items || [];
        const total = items.length;
        const picked = items.filter(i => i.picked).length;
        const progress = total > 0 ? (picked / total) * 100 : 0;
        const metrics = calculateSessionMetrics(items);
        return { ...s, total, picked, progress, metrics };
      });

      setSessions(processed);
    } catch (err) {
      console.error("Runtime error in fetchSessions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    const channel = supabase
      .channel('session-progress-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pick_items' }, fetchSessions)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pick_sessions' }, fetchSessions)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const startNewBatch = async () => {
    setIsCreating(true);
    try {
      const { data: warehouse } = await supabase.from('warehouses').select('id').limit(1).single();
      if (!warehouse) throw new Error("No warehouse found. Please run seed script first.");

      const { data: orders } = await supabase
        .from('orders')
        .select('id, order_items(id, product_id, quantity)')
        .eq('status', 'pending')
        .limit(10);
      
      if (!orders || orders.length === 0) {
        alert("No pending orders found. Seed the database first!");
        return;
      }

      const { data: newSession, error: sError } = await supabase
        .from('pick_sessions')
        .insert({
          warehouse_id: warehouse.id,
          picker_name: 'AI Console Agent',
          status: 'in_progress',
          routing_type: 'optimised'
        })
        .select()
        .single();
      
      if (sError) throw sError;

      // --- Batch Consolidation Logic ---
      const productMap = {}; // productId -> { quantity, orderItemIds, locationId }
      
      for (const order of orders) {
        for (const item of order.order_items) {
          if (!productMap[item.product_id]) {
            // Find location once per product
            const { data: loc } = await supabase
              .from('product_locations')
              .select('location_id')
              .eq('product_id', item.product_id)
              .limit(1)
              .single();

            productMap[item.product_id] = {
              quantity: 0,
              orderItemIds: [],
              locationId: loc?.location_id || null
            };
          }
          
          productMap[item.product_id].quantity += item.quantity || 1;
          productMap[item.product_id].orderItemIds.push(item.id);
        }
        await supabase.from('orders').update({ status: 'picking' }).eq('id', order.id);
      }

      const pickItemsToInsert = Object.keys(productMap).map(pid => ({
        session_id: newSession.id,
        order_item_id: productMap[pid].orderItemIds[0], // Set one as primary for FK compatibility
        location_id: productMap[pid].locationId,
        quantity: productMap[pid].quantity, // New column
        fulfilled_order_item_ids: productMap[pid].orderItemIds, // New column
        picked: false
      }));

      const { error: piError } = await supabase.from('pick_items').insert(pickItemsToInsert);
      if (piError) {
        console.warn("SQL Migration check: Batch grouping columns might be missing. Falling back to single-pick mode.", piError);
        // Fallback for safety if user didn't run SQL yet
        const fallbackItems = [];
        for (const order of orders) {
          for (const item of order.order_items) {
             const { data: loc } = await supabase.from('product_locations').select('location_id').eq('product_id', item.product_id).limit(1).single();
             fallbackItems.push({
                session_id: newSession.id,
                order_item_id: item.id,
                location_id: loc?.location_id,
                picked: false
             });
          }
        }
        await supabase.from('pick_items').insert(fallbackItems);
      }

      fetchSessions();
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  if (loading && sessions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-electric-blue w-12 h-12" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white mb-2">Pick Sessions</h1>
          <p className="text-gray-400 font-medium">SolveXpert Batch Logic • {sessions.length} Active Workloads</p>
        </div>
        <button 
          onClick={startNewBatch}
          disabled={isCreating}
          className="bg-electric-blue hover:bg-electric-blue/90 text-white font-black py-4 px-8 rounded-2xl flex items-center gap-2 shadow-xl shadow-electric-blue/20 transition-all active:scale-95 disabled:opacity-50"
        >
          {isCreating ? <Loader2 className="animate-spin" size={24} /> : <Plus size={24} />}
          Generate Optimized Batch
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {sessions.map(s => (
          <div key={s.id} className="bg-navy-800 border-2 border-navy-700/50 rounded-[32px] overflow-hidden shadow-2xl flex flex-col hover:border-electric-blue/40 transition-all group relative">
            {s.metrics?.accuracy === 100 && s.status === 'completed' && (
              <div className="absolute top-6 right-6 z-10">
                 <div className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/30 text-[10px] font-black uppercase tracking-widest">Perfect Accuracy</div>
              </div>
            )}

            <div className="p-8 space-y-6 flex-1">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500">
                    <Clock size={12} className="text-electric-blue" /> Start {new Date(s.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </div>
                  <h3 className="text-2xl font-black flex items-center gap-2 text-white">
                    {s.picker_name}
                  </h3>
                </div>
                <div className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${
                  s.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse'
                }`}>
                  {s.status}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-end px-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{s.routing_type} AI Routing</p>
                  <p className="text-xl font-black text-white">{Math.round(s.progress || 0)}<span className="text-xs opacity-50 ml-0.5">%</span></p>
                </div>
                <div className="h-3 w-full bg-navy-900 rounded-full overflow-hidden border border-navy-700">
                  <div 
                    className={`h-full transition-all duration-1000 ${s.status === 'completed' ? 'bg-emerald-500' : 'bg-gradient-to-r from-electric-blue to-blue-400'}`} 
                    style={{ width: `${s.progress || 0}%` }}
                  ></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-navy-900/80 p-4 rounded-2xl border border-navy-700/50">
                  <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1.5">Efficiency</p>
                  <div className="flex items-center gap-1.5 text-white">
                    <TrendingUp size={16} className="text-emerald-400" />
                    <span className="font-black text-lg">{s.metrics?.pph || 0} <span className="text-[10px] font-bold opacity-50">PPH</span></span>
                  </div>
                </div>
                <div className="bg-navy-900/80 p-4 rounded-2xl border border-navy-700/50">
                  <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1.5">Workload</p>
                  <div className="flex items-center gap-2 text-white">
                    <Package size={16} className="text-electric-blue" />
                    <span className="font-black text-lg">{s.picked}<span className="text-gray-500 mx-1">/</span>{s.total}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between px-2 pt-2">
                 <div className="flex flex-col">
                    <span className="text-[10px] font-black text-gray-500 uppercase">Distance Saved</span>
                    <span className="text-xs font-bold text-emerald-400">-{s.metrics?.distanceSaved || 0}m Walking</span>
                 </div>
                 <div className="flex flex-col text-right">
                    <span className="text-[10px] font-black text-gray-500 uppercase">Accuracy Rate</span>
                    <span className="text-xs font-bold text-white">{s.metrics?.accuracy || 100}% Hit</span>
                 </div>
              </div>
            </div>

            <div className="px-8 py-5 bg-navy-900 border-t border-navy-700/50 flex justify-between items-center group-hover:bg-navy-900/50 transition-colors">
               <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-electric-blue/10 rounded-lg flex items-center justify-center">
                     <Map size={16} className="text-electric-blue" />
                  </div>
                  <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">Active Intelligence Feed</span>
               </div>
               <ArrowRight size={18} className="text-gray-600 group-hover:text-electric-light transition-transform group-hover:translate-x-1" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
