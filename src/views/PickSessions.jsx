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
        .select('id, order_items(id, product_id)')
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
          picker_name: 'AI Batch Agent',
          status: 'in_progress',
          routing_type: 'optimised'
        })
        .select()
        .single();
      
      if (sError) throw sError;

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
            picked: false
          });
        }
        await supabase.from('orders').update({ status: 'picking' }).eq('id', order.id);
      }

      await supabase.from('pick_items').insert(pickItemsToInsert);
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
          <h1 className="text-3xl font-bold">Pick Sessions</h1>
          <p className="text-gray-400 mt-1">Real-time operational tracking of warehouse batches.</p>
        </div>
        <button 
          onClick={startNewBatch}
          disabled={isCreating}
          className="bg-electric-blue hover:bg-electric-blue/90 text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2 shadow-lg shadow-electric-blue/20 transition-all active:scale-95 disabled:opacity-50"
        >
          {isCreating ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
          New Optimised Batch
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {sessions.map(s => (
          <div key={s.id} className="bg-navy-800 border border-navy-700 rounded-2xl overflow-hidden shadow-xl flex flex-col hover:border-electric-blue/30 transition-all group">
            <div className="p-6 space-y-4 flex-1">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                    <Clock size={12} /> {new Date(s.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </div>
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <User size={18} className="text-electric-blue" /> {s.picker_name}
                  </h3>
                </div>
                <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-tighter ${
                  s.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400 animate-pulse'
                }`}>
                  {s.status}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <p className="text-xs font-bold text-gray-400 capitalize">{s.routing_type} Routing</p>
                  <p className="text-sm font-black text-white">{Math.round(s.progress || 0)}%</p>
                </div>
                <div className="h-2 w-full bg-navy-900 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 ${s.status === 'completed' ? 'bg-emerald-500' : 'bg-electric-blue'}`} 
                    style={{ width: `${s.progress || 0}%` }}
                  ></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-navy-900/50 p-3 rounded-xl border border-navy-700/50">
                  <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Time Saved</p>
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <TrendingDown size={14} />
                    <span className="font-bold">{s.metrics?.timeSavedMinutes || 0}m</span>
                  </div>
                </div>
                <div className="bg-navy-900/50 p-3 rounded-xl border border-navy-700/50">
                  <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Items</p>
                  <div className="flex items-center gap-1.5 text-blue-400">
                    <Package size={14} />
                    <span className="font-bold">{s.picked}/{s.total}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-navy-900/50 border-t border-navy-700 flex justify-between items-center group-hover:bg-navy-900/80 transition-colors">
               <span className="text-xs text-gray-500 font-bold group-hover:text-gray-300">Live Operation Feed</span>
               <ChevronRight size={14} className="text-gray-600 group-hover:text-electric-light transition-colors" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
