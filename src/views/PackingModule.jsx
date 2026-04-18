import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Scan, 
  Package, 
  Printer, 
  CheckCircle2, 
  Loader2, 
  Tractor,
  Boxes,
  ArrowRight
} from 'lucide-react';

export default function PackingModule() {
  const [step, setStep] = useState('SCAN_TROLLEY'); // SCAN_TROLLEY, SCAN_PRODUCT, SCAN_LABEL
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    fetchActiveTrolleys();
  }, []);

  const fetchActiveTrolleys = async () => {
    // A "Trolley" is a completed or in-progress pick session
    const { data } = await supabase
      .from('pick_sessions')
      .select('*, pick_items(*)')
      .eq('status', 'in_progress')
      .order('created_at', { ascending: false });
    
    setSessions(data || []);
  };

  const handleScanTrolley = (session) => {
    setLoading(true);
    setCurrentSession(session);
    
    // Find first order in this session that hasn't been packed
    // We'll join with order_items and orders
    supabase
      .from('pick_items')
      .select('*, order_items(*, orders(*), products(*))')
      .eq('session_id', session.id)
      .eq('picked', true) // Only pack what's picked
      .then(({ data }) => {
        // Find orders that are not yet 'shipped'
        const pendingOrders = [];
        data.forEach(item => {
          const order = item.order_items.orders;
          if (order && order.status !== 'shipped' && !pendingOrders.find(o => o.id === order.id)) {
            pendingOrders.push({
              ...order,
              items: data.filter(i => i.order_items.order_id === order.id)
            });
          }
        });

        if (pendingOrders.length > 0) {
          setCurrentOrder(pendingOrders[0]);
          setStep('SCAN_PRODUCT');
        } else {
          setMsg("All orders in this trolley have been packed!");
        }
        setLoading(false);
      });
  };

  const handleScanProduct = async () => {
    setScanning(true);
    // Simulation: mark order as 'packed' locally, then move to label
    setTimeout(() => {
      setStep('SCAN_LABEL');
      setScanning(false);
    }, 600); // 600ms scan delay for "wow" effect
  };

  const handleScanLabel = async () => {
    setScanning(true);
    // Simulation: print label and move to next order
    setTimeout(async () => {
      // Update DB: mark order as shipped
      await supabase
        .from('orders')
        .update({ status: 'shipped' })
        .eq('id', currentOrder.id);

      setMsg(`Label Printed for ${currentOrder.order_reference}`);
      
      // Auto-load next order from the same session
      handleScanTrolley(currentSession);
      setScanning(false);
      
      setTimeout(() => setMsg(null), 2000);
    }, 800);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="animate-spin text-electric-blue w-12 h-12 mb-4" />
        <p className="text-gray-400">Loading Order Data...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col pt-6">
      
      <div className="flex justify-between items-center mb-8 px-4">
        <div>
          <h1 className="text-3xl font-bold">Packing Station</h1>
          <p className="text-gray-400">SolveXpert High-Speed Dispatch Line</p>
        </div>
        <div className="flex gap-2">
           <div className={`w-3 h-3 rounded-full ${step === 'SCAN_TROLLEY' ? 'bg-electric-blue shadow-[0_0_10px_#2563EB]' : 'bg-navy-700'}`}></div>
           <div className={`w-3 h-3 rounded-full ${step === 'SCAN_PRODUCT' ? 'bg-electric-blue shadow-[0_0_10px_#2563EB]' : 'bg-navy-700'}`}></div>
           <div className={`w-3 h-3 rounded-full ${step === 'SCAN_LABEL' ? 'bg-electric-blue shadow-[0_0_10px_#2563EB]' : 'bg-navy-700'}`}></div>
        </div>
      </div>

      <div className="flex-1 bg-navy-800 rounded-[40px] border border-navy-700 shadow-2xl overflow-hidden flex flex-col relative">
        
        {scanning && (
          <div className="absolute inset-0 bg-electric-blue/10 backdrop-blur-[2px] z-50 flex items-center justify-center">
             <div className="w-64 h-1 bg-electric-blue animate-scan shadow-[0_0_20px_#2563EB]"></div>
          </div>
        )}

        {step === 'SCAN_TROLLEY' ? (
          <div className="flex-1 flex flex-col p-10 items-center justify-center text-center space-y-8">
            <div className="w-24 h-24 bg-navy-900 rounded-3xl flex items-center justify-center border border-navy-700 text-gray-400">
               <Tractor size={48} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white">Select Incoming Trolley</h2>
              <p className="text-gray-500 max-w-xs mx-auto">Scan the barcode on the picking trolley to begin the packing sequence.</p>
            </div>
            <div className="w-full max-w-md space-y-3">
              {sessions.map(s => (
                <button 
                  key={s.id}
                  onClick={() => handleScanTrolley(s)}
                  className="w-full bg-navy-900/50 hover:bg-navy-700 border border-navy-700 p-6 rounded-2xl flex items-center justify-between group transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-electric-blue/10 flex items-center justify-center text-electric-blue">
                      <Scan size={20} />
                    </div>
                    <div className="text-left">
                       <p className="text-sm font-bold text-white leading-none mb-1">{s.picker_name}'s Batch</p>
                       <p className="text-[10px] text-gray-500 uppercase tracking-widest">{s.pick_items.length} Items ready</p>
                    </div>
                  </div>
                  <ArrowRight size={20} className="text-gray-600 group-hover:translate-x-1 transition-transform" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
            <div className="p-8 bg-navy-900/50 border-b border-navy-700 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-500/10 text-emerald-400 p-2 rounded-lg"><Package size={20} /></div>
                <h3 className="text-lg font-bold text-white">{currentOrder?.order_reference}</h3>
              </div>
              <span className="text-xs font-bold text-gray-500 bg-navy-900 px-3 py-1 rounded-full border border-navy-700">Trolley: {currentSession?.picker_name}</span>
            </div>

            <div className="flex-1 p-10 flex flex-col items-center justify-center space-y-12">
               
               <div className="text-center space-y-2">
                  <p className="text-xs font-bold text-electric-light uppercase tracking-[0.2em] mb-4">
                    {step === 'SCAN_PRODUCT' ? 'Step 1: Process Product' : 'Step 2: Shipping Label'}
                  </p>
                  <h2 className="text-5xl font-black text-white px-10">
                    {step === 'SCAN_PRODUCT' ? currentOrder?.items[0]?.order_items?.products?.name : 'TOWG-SH-09384-LABEL'}
                  </h2>
               </div>

               <button 
                onClick={step === 'SCAN_PRODUCT' ? handleScanProduct : handleScanLabel}
                className={`w-64 h-64 rounded-full flex flex-col items-center justify-center gap-4 transition-all active:scale-95 shadow-2xl relative group ${
                 step === 'SCAN_PRODUCT' 
                 ? 'bg-electric-blue shadow-electric-blue/20' 
                 : 'bg-emerald-500 shadow-emerald-500/20'
                }`}
               >
                 <div className="absolute inset-0 rounded-full border-4 border-white/10 animate-ping opacity-20"></div>
                 {step === 'SCAN_PRODUCT' ? <Scan size={60} className="text-white" /> : <Printer size={60} className="text-white" />}
                 <span className="text-sm font-bold uppercase tracking-widest text-white/80">
                   {step === 'SCAN_PRODUCT' ? 'Scan Product' : 'Print & Scan Label'}
                 </span>
               </button>

               <div className="w-full max-w-sm grid grid-cols-2 gap-4">
                  <div className="bg-navy-900/40 p-4 rounded-2xl border border-navy-700/50 text-center">
                    <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Quantity</p>
                    <p className="text-2xl font-black text-white">x{currentOrder?.items[0]?.order_items?.quantity || 1}</p>
                  </div>
                  <div className="bg-navy-900/40 p-4 rounded-2xl border border-navy-700/50 text-center text-emerald-400">
                    <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Status</p>
                    <p className="text-sm font-bold flex items-center justify-center gap-1"><CheckCircle2 size={14} /> Verified</p>
                  </div>
               </div>
            </div>
          </div>
        )}

        {msg && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-emerald-500 text-white font-bold px-8 py-3 rounded-2xl shadow-2xl animate-bounce z-50 flex items-center gap-2">
            <CheckCircle2 size={20} />
            {msg}
          </div>
        )}
      </div>

      <div className="p-8 text-center text-gray-500 text-xs font-medium">
         TIP: Use a wireless Bluetooth scanner for maximum throughput (140+ orders/hr)
      </div>
    </div>
  );
}
