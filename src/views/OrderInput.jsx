import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ShoppingBag, Loader2, Package, Clock, CheckCircle2, ChevronRight, Filter } from 'lucide-react';

export default function OrderInput() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState('All');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    // Fetch channels
    const { data: channelsData } = await supabase
      .from('channels')
      .select('*');
    setChannels(channelsData || []);

    // Fetch orders with channel and items
    const { data: ordersData } = await supabase
      .from('orders')
      .select(`
        *,
        channels (name),
        order_items (
          id,
          products (name)
        )
      `)
      .order('created_at', { ascending: false });
    
    setOrders(ordersData || []);
    setLoading(false);
  };

  const filteredOrders = selectedChannel === 'All' 
    ? orders 
    : orders.filter(o => o.channels?.name === selectedChannel);

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    picked: orders.filter(o => o.status === 'picked').length,
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="animate-spin text-electric-blue w-12 h-12 mb-4" />
        <p className="text-gray-400">Fetching Incoming Orders...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold">Order Pipeline</h1>
          <p className="text-gray-400 mt-1">Consolidated view of orders across all connected stores.</p>
        </div>
        
        <div className="flex items-center gap-4 bg-navy-800 p-1 rounded-xl border border-navy-700">
          <button 
            onClick={() => setSelectedChannel('All')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${selectedChannel === 'All' ? 'bg-electric-blue text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            All Channels
          </button>
          {channels.map(ch => (
            <button 
              key={ch.id}
              onClick={() => setSelectedChannel(ch.name)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${selectedChannel === ch.name ? 'bg-electric-blue text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
            >
              {ch.name}
            </button>
          ))}
        </div>
      </div>

      {/* Pipeline Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-navy-800 border border-navy-700 p-6 rounded-2xl shadow-xl flex items-center gap-6">
          <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20">
            <ShoppingBag className="text-blue-400" size={30} />
          </div>
          <div>
            <p className="text-gray-400 text-sm font-bold uppercase tracking-wider">Total Volume</p>
            <p className="text-3xl font-bold">{stats.total}</p>
          </div>
        </div>
        <div className="bg-navy-800 border border-navy-700 p-6 rounded-2xl shadow-xl flex items-center gap-6">
          <div className="w-14 h-14 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20">
            <Clock className="text-amber-400" size={30} />
          </div>
          <div>
            <p className="text-gray-400 text-sm font-bold uppercase tracking-wider">Pending Picking</p>
            <p className="text-3xl font-bold">{stats.pending}</p>
          </div>
        </div>
        <div className="bg-navy-800 border border-navy-700 p-6 rounded-2xl shadow-xl flex items-center gap-6">
          <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20">
            <CheckCircle2 className="text-emerald-400" size={30} />
          </div>
          <div>
            <p className="text-gray-400 text-sm font-bold uppercase tracking-wider">Ready for Dispatch</p>
            <p className="text-3xl font-bold">{stats.picked}</p>
          </div>
        </div>
      </div>

      {/* Orders Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredOrders.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-navy-800/50 border-2 border-dashed border-navy-700 rounded-3xl">
            <Package className="mx-auto text-gray-700 mb-4" size={48} />
            <p className="text-gray-500 font-medium">No orders found for this filter.</p>
          </div>
        ) : (
          filteredOrders.map(order => (
            <div key={order.id} className="bg-navy-800 border border-navy-700 rounded-2xl overflow-hidden shadow-lg hover:border-electric-blue/50 transition-all group">
              <div className="p-5 border-b border-navy-700 flex justify-between items-center bg-navy-900/50">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${order.status === 'pending' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`}></div>
                  <span className="font-mono text-white font-bold">{order.order_reference}</span>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded ${
                  order.channels?.name === 'Amazon' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                  order.channels?.name === 'Shopify' ? 'bg-lime-500/20 text-lime-400 border border-lime-500/30' :
                  'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                }`}>
                  {order.channels?.name}
                </span>
              </div>
              
              <div className="p-5 space-y-4">
                <div className="space-y-2">
                  {order.order_items.map((item, idx) => (
                    <div key={item.id} className="flex justify-between items-center bg-navy-900/40 p-3 rounded-xl border border-navy-700/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-navy-700 flex items-center justify-center text-xs font-bold text-gray-400">
                          {idx + 1}
                        </div>
                        <p className="text-sm font-medium text-gray-200">{item.products?.name}</p>
                      </div>
                      <span className="text-xs font-bold text-electric-light bg-electric-blue/10 px-2 py-1 rounded">x{item.quantity || 1}</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-2">
                  <p className="text-xs text-gray-500">Received {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  <button className="flex items-center gap-1 text-xs font-bold text-electric-light hover:text-white transition-colors">
                    View full details <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
