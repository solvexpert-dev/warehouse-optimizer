import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { seedDatabase } from '../utils/seeder';
import { 
  Building2, 
  Plus, 
  Database, 
  MapPin, 
  Package, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Trash2,
  Zap
} from 'lucide-react';

export default function AdminSetup() {
  const [loading, setLoading] = useState(false);
  const [warehouse, setWarehouse] = useState(null);
  const [stats, setStats] = useState({ aisles: 0, locations: 0, products: 0 });
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [stockQty, setStockQty] = useState(10);
  const [newWarehouseName, setNewWarehouseName] = useState('');
  const [newProductName, setNewProductName] = useState('');
  const [newProductSku, setNewProductSku] = useState('');
  const [msg, setMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchWarehouse();
  }, []);

  useEffect(() => {
    if (warehouse) {
      fetchStats();
    }
  }, [warehouse]);

  const fetchWarehouse = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('warehouses')
      .select('*')
      .limit(1)
      .single();

    if (data) setWarehouse(data);
    setLoading(false);
  };

  const fetchStats = async () => {
    const { count: aislesCount } = await supabase
      .from('aisles')
      .select('*', { count: 'exact', head: true })
      .eq('warehouse_id', warehouse.id);

    const { count: productsCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('warehouse_id', warehouse.id);

    // Locations need a join to verify they belong to this warehouse's aisles
    const { count: locationsCount } = await supabase
      .from('locations')
      .select('*, aisles!inner(*)', { count: 'exact', head: true })
      .eq('aisles.warehouse_id', warehouse.id);

    setStats({ 
      aisles: aislesCount || 0, 
      locations: locationsCount || 0, 
      products: productsCount || 0 
    });

    // Fetch lists for the assignment dropdowns
    const { data: productsData } = await supabase
      .from('products')
      .select('id, name, sku')
      .eq('warehouse_id', warehouse.id);
    
    setProducts(productsData || []);

    const { data: locationsData } = await supabase
      .from('locations')
      .select('id, location_code, aisle_id, aisles!inner(warehouse_id)')
      .eq('aisles.warehouse_id', warehouse.id)
      .order('location_code');
    
    setLocations(locationsData || []);
  };

  const handleCreateWarehouse = async (e) => {
    e.preventDefault();
    if (!newWarehouseName) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('warehouses')
      .insert([{ name: newWarehouseName }])
      .select()
      .single();

    if (error) {
      setMsg({ type: 'error', text: error.message });
    } else {
      setWarehouse(data);
      setMsg({ type: 'success', text: 'Warehouse created successfully!' });
    }
    setLoading(false);
  };

  const handleBulkGenerateLayout = async () => {
    if (!warehouse) return;
    setLoading(true);
    setMsg({ type: 'info', text: 'Generating layout... please wait.' });

    try {
      const aisleNumbers = ['13', '14', '15', '16'];
      const sections = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'];
      const shelves = ['01', '02', '03'];

      // 1. Create Aisles
      for (const num of aisleNumbers) {
        const { data: aisle, error: aError } = await supabase
          .from('aisles')
          .insert([{ warehouse_id: warehouse.id, aisle_number: num }])
          .select()
          .single();

        if (aError) throw aError;

        // 2. Create Locations for each Aisle
        const locationsToInsert = [];
        for (const sec of sections) {
          for (const shelf of shelves) {
            locationsToInsert.push({
              aisle_id: aisle.id,
              section: sec,
              shelf: shelf,
              location_code: `${num}.${sec}.${shelf}`
            });
          }
        }
        
        const { error: lError } = await supabase
          .from('locations')
          .insert(locationsToInsert);
        
        if (lError) throw lError;
      }

      setMsg({ type: 'success', text: 'Full warehouse layout generated successfully!' });
      fetchStats();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleAssignStock = async (e) => {
    e.preventDefault();
    if (!selectedProduct || !selectedLocation) return;
    setLoading(true);
    
    const { error } = await supabase
      .from('product_locations')
      .upsert([{ 
        product_id: selectedProduct, 
        location_id: selectedLocation, 
        quantity_primary: stockQty 
      }]); // On conflict is handled by unique constraint or omitted if upsert handles it

    if (error) {
      setMsg({ type: 'error', text: error.message });
    } else {
      setMsg({ type: 'success', text: 'Stock level assigned to location.' });
    }
    setLoading(false);
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!newProductName || !newProductSku) return;
    setLoading(true);
    const { error } = await supabase
      .from('products')
      .insert([{ 
        warehouse_id: warehouse.id, 
        name: newProductName, 
        sku: newProductSku 
      }]);

    if (error) {
      setMsg({ type: 'error', text: error.message });
    } else {
      setNewProductName('');
      setNewProductSku('');
      setMsg({ type: 'success', text: 'Product added to catalog.' });
      fetchStats();
    }
    setLoading(false);
  };

  const handleSeedData = async () => {
    setLoading(true);
    setMsg({ type: 'info', text: 'Seeding demo data... this takes a moment.' });
    const result = await seedDatabase();
    if (result.success) {
      setMsg({ type: 'success', text: 'Database seeded with 50 orders, products, and full layout!' });
      fetchWarehouse(); // Refresh warehouse state
    } else {
      setMsg({ type: 'error', text: result.error });
    }
    setLoading(false);
  };

  if (loading && !warehouse) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="animate-spin text-electric-blue w-12 h-12 mb-4" />
        <p className="text-gray-400">Loading Configuration...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Admin Setup</h1>
          <p className="text-gray-400 mt-1">Configure your warehouse infrastructure and product catalog.</p>
        </div>
        <button 
          onClick={handleSeedData}
          disabled={loading}
          className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-bold transition-all shadow-lg hover:scale-105 disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} />}
          Seed Full Demo Data
        </button>
      </div>

      {msg.text && (
        <div className={`p-4 rounded-lg flex items-start gap-3 border ${
          msg.type === 'error' ? 'bg-red-500/10 border-red-500/50 text-red-500' : 
          msg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500' :
          'bg-blue-500/10 border-blue-500/50 text-blue-400'
        }`}>
          {msg.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <p className="text-sm font-medium">{msg.text}</p>
        </div>
      )}

      {!warehouse ? (
        <div className="bg-navy-800 border border-navy-700 rounded-xl p-8 shadow-xl">
          <div className="max-w-md">
            <div className="w-12 h-12 bg-electric-blue/10 rounded-lg flex items-center justify-center mb-6">
              <Building2 className="text-electric-blue" />
            </div>
            <h2 className="text-xl font-bold mb-2">Initialize Warehouse</h2>
            <p className="text-gray-400 mb-6 text-sm">You haven't set up a warehouse yet. Enter a name to get started.</p>
            
            <form onSubmit={handleCreateWarehouse} className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-gray-500 font-bold mb-2">Warehouse Name</label>
                <input 
                  type="text" 
                  value={newWarehouseName}
                  onChange={(e) => setNewWarehouseName(e.target.value)}
                  placeholder="e.g. Manchester Central DC"
                  className="w-full bg-navy-900 border border-navy-700 rounded-lg px-4 py-2 focus:border-electric-blue outline-none transition-colors"
                />
              </div>
              <button 
                type="submit"
                disabled={loading}
                className="bg-electric-blue hover:bg-electric-blue/90 text-white font-bold py-2 px-6 rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                Create Warehouse
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Warehouse Overview */}
          <div className="bg-navy-800 border border-navy-700 rounded-xl p-6 shadow-xl space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-electric-light px-2 py-1 bg-electric-blue/10 rounded inline-block mb-3">Active Warehouse</span>
                <h2 className="text-2xl font-bold">{warehouse.name}</h2>
              </div>
              <div className="p-3 bg-navy-900 rounded-lg border border-navy-700">
                <Database className="text-gray-500" size={24} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-navy-900 rounded-lg border border-navy-700">
                <p className="text-xs text-gray-500 uppercase font-bold text-center mb-1">Aisles</p>
                <p className="text-xl font-bold text-center">{stats.aisles}</p>
              </div>
              <div className="p-4 bg-navy-900 rounded-lg border border-navy-700">
                <p className="text-xs text-gray-500 uppercase font-bold text-center mb-1">Locations</p>
                <p className="text-xl font-bold text-center">{stats.locations}</p>
              </div>
              <div className="p-4 bg-navy-900 rounded-lg border border-navy-700">
                <p className="text-xs text-gray-500 uppercase font-bold text-center mb-1">Products</p>
                <p className="text-xl font-bold text-center">{stats.products}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-navy-700">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-2">
                <MapPin size={16} /> Layout Configuration
              </h3>
              
              {stats.aisles === 0 ? (
                <div className="p-4 bg-amber-500/10 border border-amber-500/50 rounded-lg">
                  <p className="text-sm text-amber-500 mb-4">No layout has been generated yet. Use the tool below to generate the demo configuration (Aisles 13-16).</p>
                  <button 
                    onClick={handleBulkGenerateLayout}
                    disabled={loading}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                    Bulk Generate Demo Layout
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-lg flex items-center gap-3">
                  <CheckCircle2 className="text-emerald-500" size={20} />
                  <p className="text-sm text-emerald-500/80 font-medium">Layout generated and active.</p>
                </div>
              )}
            </div>
          </div>

          {/* Product Catalog */}
          <div className="bg-navy-800 border border-navy-700 rounded-xl p-6 shadow-xl space-y-6">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Package className="text-electric-blue" size={24} /> Product Catalog
            </h3>
            
            <form onSubmit={handleAddProduct} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase text-gray-500 font-bold mb-2">Product Name</label>
                  <input 
                    type="text" 
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    placeholder="e.g. WD40"
                    className="w-full bg-navy-900 border border-navy-700 rounded-lg px-4 py-2 focus:border-electric-blue outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase text-gray-500 font-bold mb-2">SKU / Code</label>
                  <input 
                    type="text" 
                    value={newProductSku}
                    onChange={(e) => setNewProductSku(e.target.value)}
                    placeholder="e.g. WD-400-X"
                    className="w-full bg-navy-900 border border-navy-700 rounded-lg px-4 py-2 focus:border-electric-blue outline-none transition-colors"
                  />
                </div>
              </div>
              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-navy-700 hover:bg-navy-600 border border-navy-600 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                Register Product
              </button>
            </form>

            <div className="pt-4 border-t border-navy-700">
               <p className="text-xs text-gray-500 italic">This manages the master catalog. Inventory placement (mapping products to locations) is the next step.</p>
            </div>
          </div>

          {/* Inventory Placement */}
          <div className="bg-navy-800 border border-navy-700 rounded-xl p-6 shadow-xl space-y-6 md:col-span-2">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <MapPin className="text-electric-blue" size={24} /> Inventory Placement (Stock Mapping)
            </h3>
            
            <form onSubmit={handleAssignStock} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-xs uppercase text-gray-500 font-bold mb-2">Select Product</label>
                <select 
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  className="w-full bg-navy-900 border border-navy-700 rounded-lg px-4 py-2 focus:border-electric-blue outline-none transition-colors"
                >
                  <option value="">-- Choose Product --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs uppercase text-gray-500 font-bold mb-2">Select Location</label>
                <select 
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="w-full bg-navy-900 border border-navy-700 rounded-lg px-4 py-2 focus:border-electric-blue outline-none transition-colors"
                >
                  <option value="">-- Choose Location --</option>
                  {locations.map(l => (
                    <option key={l.id} value={l.id}>{l.location_code}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs uppercase text-gray-500 font-bold mb-2">Initial Qty</label>
                <input 
                  type="number" 
                  value={stockQty}
                  onChange={(e) => setStockQty(parseInt(e.target.value))}
                  className="w-full bg-navy-900 border border-navy-700 rounded-lg px-4 py-2 focus:border-electric-blue outline-none transition-colors"
                />
              </div>
              <button 
                type="submit"
                disabled={loading || !selectedProduct || !selectedLocation}
                className="bg-electric-blue hover:bg-electric-blue/90 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                Assign Stock
              </button>
            </form>
          </div>

        </div>
      )}
    </div>
  );
}
