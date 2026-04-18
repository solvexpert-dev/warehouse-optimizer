import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Flag, 
  MapPin, 
  Package, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  Loader2,
  RefreshCw,
  User
} from 'lucide-react';

export default function LocationFlags() {
  const [loading, setLoading] = useState(true);
  const [flags, setFlags] = useState([]);
  const [msg, setMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchFlags();
    
    // Subscribe to real-time updates for auto-refreshing dashboard
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'location_flags' },
        () => {
          fetchFlags();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchFlags = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('location_flags')
      .select(`
        *,
        locations (location_code),
        products (name, sku)
      `)
      .eq('resolved', false)
      .order('created_at', { ascending: false });
    
    setFlags(data || []);
    setLoading(false);
  };

  const handleResolve = async (id) => {
    const { error } = await supabase
      .from('location_flags')
      .update({ resolved: true })
      .eq('id', id);

    if (error) {
      setMsg({ type: 'error', text: error.message });
    } else {
      setMsg({ type: 'success', text: 'Location outage resolved and cleared.' });
      setTimeout(() => setMsg({ type: '', text: '' }), 3000);
      fetchFlags();
    }
  };

  if (loading && flags.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="animate-spin text-electric-blue w-12 h-12 mb-4" />
        <p className="text-gray-400">Scanning for Location Outages...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Flag className="text-red-500" size={32} /> Location Flags
          </h1>
          <p className="text-gray-400 mt-1">Manage active stock outages reported by mobile pickers.</p>
        </div>
        <button 
          onClick={fetchFlags}
          className="p-2 border border-navy-700 bg-navy-800 hover:bg-navy-700 rounded-lg transition-colors text-gray-400"
        >
          <RefreshCw size={20} />
        </button>
      </div>

      {msg.text && (
        <div className={`p-4 rounded-lg flex items-start gap-3 border ${
          msg.type === 'error' ? 'bg-red-500/10 border-red-500/50 text-red-500' : 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500'
        }`}>
          <CheckCircle2 size={20} />
          <p className="text-sm font-medium">{msg.text}</p>
        </div>
      )}

      {flags.length === 0 ? (
        <div className="bg-navy-800/50 border-2 border-dashed border-navy-700 rounded-3xl py-24 text-center">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="text-emerald-500" size={32} />
          </div>
          <h2 className="text-xl font-bold text-white">All Clear!</h2>
          <p className="text-gray-500 mt-2">There are currently no reported location flags in the system.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {flags.map((flag) => (
            <div key={flag.id} className="bg-navy-800 border border-navy-700 rounded-2xl overflow-hidden shadow-xl hover:border-red-500/30 transition-all border-l-4 border-l-red-500">
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Flagged Location</p>
                    <h3 className="text-4xl font-black text-white">{flag.locations?.location_code}</h3>
                  </div>
                  <div className="bg-red-500/10 text-red-400 px-3 py-1 rounded-full border border-red-500/20 text-xs font-bold flex items-center gap-1">
                    <AlertTriangle size={12} /> Empty Location
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 pt-2">
                  <div className="bg-navy-900/50 p-3 rounded-xl border border-navy-700/50 flex items-center gap-3">
                    <Package className="text-electric-blue" size={20} />
                    <div>
                      <p className="text-xs text-gray-500">Target Product</p>
                      <p className="text-sm font-bold">{flag.products?.name} <span className="text-xs font-normal text-gray-400">({flag.products?.sku})</span></p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-gray-400">
                      <User size={14} />
                      <span className="text-xs">{flag.flagged_by}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-500">
                      <Clock size={14} />
                      <span className="text-xs">{new Date(flag.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => handleResolve(flag.id)}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 mt-2"
                >
                  <CheckCircle2 size={18} />
                  MARK AS RESOLVED
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
