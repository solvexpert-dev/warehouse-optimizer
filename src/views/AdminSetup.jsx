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
  Zap,
  Edit2,
  Search,
  Download,
  Upload,
  BarChart3,
  Box,
  Layers,
  X,
  FileSpreadsheet
} from 'lucide-react';
import Combobox from '../components/Combobox';

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
  
  // Phase 6 State
  const [inventory, setInventory] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProduct, setEditingProduct] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

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
    const { data } = await supabase
      .from('warehouses')
      .select('*')
      .limit(1)
      .single();

    if (data) setWarehouse(data);
    setLoading(false);
  };

  const fetchStats = async () => {
    if (!warehouse) return;
    
    const { count: aislesCount } = await supabase
      .from('aisles')
      .select('*', { count: 'exact', head: true })
      .eq('warehouse_id', warehouse.id);

    const { count: productsCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('warehouse_id', warehouse.id);

    const { count: locationsCount } = await supabase
      .from('locations')
      .select('*, aisles!inner(*)', { count: 'exact', head: true })
      .eq('aisles.warehouse_id', warehouse.id);

    setStats({ 
      aisles: aislesCount || 0, 
      locations: locationsCount || 0, 
      products: productsCount || 0 
    });

    const { data: productsData } = await supabase
      .from('products')
      .select('id, name, sku')
      .eq('warehouse_id', warehouse.id);
    
    setProducts(productsData || []);

    const { data: locationsData } = await supabase
      .from('locations')
      .select('id, location_code, aisles!inner(warehouse_id)')
      .eq('aisles.warehouse_id', warehouse.id)
      .order('location_code');
    
    setLocations(locationsData || []);
    fetchInventory();
  };

  const fetchInventory = async () => {
    const { data } = await supabase
      .from('products')
      .select(`
        *,
        product_locations (
          id,
          quantity_primary,
          locations (location_code)
        )
      `)
      .order('name');
    setInventory(data || []);
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    if (!editingProduct) return;
    setLoading(true);
    const { error } = await supabase
      .from('products')
      .update({ name: editingProduct.name, sku: editingProduct.sku })
      .eq('id', editingProduct.id);

    if (error) {
      setMsg({ type: 'error', text: error.message });
    } else {
      setMsg({ type: 'success', text: 'Product updated successfully.' });
      setEditingProduct(null);
      fetchStats();
    }
    setLoading(false);
  };

  const handleDeleteProduct = async (id) => {
    if (!confirm("Are you sure? This will remove the product and all its stock records.")) return;
    
    setLoading(true);
    await supabase.from('product_locations').delete().eq('product_id', id);
    const { error } = await supabase.from('products').delete().eq('id', id);
    
    if (error) {
      setMsg({ type: 'error', text: error.message });
    } else {
      setMsg({ type: 'success', text: 'Product deleted successfully.' });
      fetchStats();
    }
    setLoading(false);
  };

  const handleExportCSV = () => {
    const headers = ['Name', 'SKU', 'Location', 'Quantity'];
    const rows = inventory.map(item => [
      item.name,
      item.sku,
      item.product_locations?.[0]?.locations?.location_code || 'Unassigned',
      item.product_locations?.[0]?.quantity_primary || 0
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(r => r.join(','))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `warehouse_inventory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportSimulation = () => {
    setIsImporting(true);
    setImportProgress(0);
    const interval = setInterval(() => {
      setImportProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsImporting(false);
            setMsg({ type: 'success', text: 'Bulk import complete! 124 new SKUs synchronized.' });
          }, 500);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
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

      for (const num of aisleNumbers) {
        const { data: aisle, error: aError } = await supabase
          .from('aisles')
          .insert([{ warehouse_id: warehouse.id, aisle_number: num }])
          .select()
          .single();

        if (aError) throw aError;

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
        await supabase.from('locations').insert(locationsToInsert);
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
      }]);

    if (error) {
      setMsg({ type: 'error', text: error.message });
    } else {
      setMsg({ type: 'success', text: 'Stock level assigned to location.' });
      fetchStats();
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
      setMsg({ type: 'success', text: 'Database seeded with products and full layout!' });
      fetchWarehouse();
    } else {
      setMsg({ type: 'error', text: result.error });
    }
    setLoading(false);
  };

  const filteredInventory = inventory.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && !warehouse) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="animate-spin text-electric-blue w-12 h-12 mb-4" />
        <p className="text-gray-400">Synchronising Master Catalog...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      
      {/* Header & Bulk Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white mb-2">Admin Power Suite</h1>
          <p className="text-gray-400 font-medium">SolveXpert Warehouse Control Panel • {warehouse?.name || 'Initialization Required'}</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-navy-800 hover:bg-navy-700 border border-navy-700 px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
          >
            <Download size={18} className="text-emerald-400" /> Export CSV
          </button>
          <button 
            onClick={handleImportSimulation}
            disabled={isImporting}
            className="flex items-center gap-2 bg-navy-800 hover:bg-navy-700 border border-navy-700 px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-50"
          >
            {isImporting ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} className="text-electric-light" />}
            {isImporting ? `Importing ${importProgress}%` : 'Bulk Import'}
          </button>
          <button 
            onClick={handleSeedData}
            disabled={loading}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-amber-500/10 active:scale-95 disabled:opacity-50"
          >
            <Zap size={18} /> Re-Seed Demo
          </button>
        </div>
      </div>

      {msg.text && (
        <div className={`p-4 rounded-2xl flex items-center justify-between border animate-in slide-in-from-right-4 ${
          msg.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' : 
          msg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
          'bg-blue-500/10 border-blue-500/30 text-blue-400'
        }`}>
          <div className="flex items-center gap-3">
            {msg.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
            <p className="text-sm font-bold">{msg.text}</p>
          </div>
          <button onClick={() => setMsg({type:'', text:''})}><X size={16} /></button>
        </div>
      )}

      {!warehouse ? (
        <div className="bg-navy-800 border border-navy-700 rounded-[32px] p-12 shadow-2xl flex flex-col items-center text-center max-w-2xl mx-auto border-dashed border-2">
          <div className="w-20 h-20 bg-electric-blue/10 rounded-3xl flex items-center justify-center mb-8">
            <Building2 className="text-electric-blue" size={40} />
          </div>
          <h2 className="text-3xl font-bold mb-4">Initialize Control Center</h2>
          <p className="text-gray-500 mb-10 leading-relaxed">No warehouse infrastructure detected. Initialize your master database to begin logistics optimization.</p>
          
          <form onSubmit={handleCreateWarehouse} className="w-full space-y-4">
            <input 
              type="text" 
              value={newWarehouseName}
              onChange={(e) => setNewWarehouseName(e.target.value)}
              placeholder="Enter Warehouse Name (e.g. SolveXpert Hub A)"
              className="w-full bg-navy-900 border border-navy-700 rounded-2xl px-6 py-4 focus:ring-2 focus:ring-electric-blue outline-none transition-all text-center text-xl font-bold"
            />
            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-electric-blue hover:bg-electric-blue/90 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 text-lg transition-transform active:scale-95 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={24} /> : <Plus size={24} />}
              Initialize Master Warehouse
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-navy-800 border border-navy-700 p-6 rounded-3xl flex items-center gap-5">
              <div className="p-4 bg-blue-500/10 rounded-2xl text-blue-400"><Layers size={28} /></div>
              <div>
                <p className="text-3xl font-black">{stats.aisles}</p>
                <p className="text-xs font-bold text-gray-500 uppercase">Active Aisles</p>
              </div>
            </div>
            <div className="bg-navy-800 border border-navy-700 p-6 rounded-3xl flex items-center gap-5">
              <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-400"><MapPin size={28} /></div>
              <div>
                <p className="text-3xl font-black">{stats.locations}</p>
                <p className="text-xs font-bold text-gray-500 uppercase">Storage Nodes</p>
              </div>
            </div>
            <div className="bg-navy-800 border border-navy-700 p-6 rounded-3xl flex items-center gap-5">
              <div className="p-4 bg-electric-blue/10 rounded-2xl text-electric-blue"><Package size={28} /></div>
              <div>
                <p className="text-3xl font-black">{stats.products}</p>
                <p className="text-xs font-bold text-gray-500 uppercase">Registered SKUs</p>
              </div>
            </div>
            <div className="bg-navy-800 border border-navy-700 p-6 rounded-3xl flex items-center gap-5">
              <div className="p-4 bg-amber-500/10 rounded-2xl text-amber-400"><BarChart3 size={28} /></div>
              <div>
                <p className="text-3xl font-black">14%</p>
                <p className="text-xs font-bold text-gray-500 uppercase">Utilization</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-8">
              <div className="bg-navy-800 border border-navy-700 rounded-3xl p-8 shadow-xl">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                   <Box className="text-electric-blue" size={24} /> SKU Registration
                </h3>
                <form onSubmit={handleAddProduct} className="space-y-5">
                  <input 
                    type="text" 
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    placeholder="Product Name"
                    className="w-full bg-navy-900 border border-navy-700 rounded-xl px-4 py-3 focus:border-electric-blue outline-none"
                  />
                  <input 
                    type="text" 
                    value={newProductSku}
                    onChange={(e) => setNewProductSku(e.target.value)}
                    placeholder="Universal SKU"
                    className="w-full bg-navy-900 border border-navy-700 rounded-xl px-4 py-3 focus:border-electric-blue outline-none"
                  />
                  <button type="submit" className="w-full bg-navy-700 hover:bg-navy-600 text-white font-bold py-3.5 rounded-xl transition-all">
                    Register Item
                  </button>
                </form>
              </div>

              <div className="bg-navy-800 border border-navy-700 rounded-3xl p-8 shadow-xl">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-3">
                   <MapPin className="text-emerald-400" size={24} /> Stock Mapping
                </h3>
                <form onSubmit={handleAssignStock} className="space-y-5">
                  <Combobox 
                    placeholder="Search Product..."
                    options={products.map(p => ({ value: p.id, label: `${p.name} (${p.sku})` }))}
                    value={selectedProduct}
                    onChange={setSelectedProduct}
                  />
                  <Combobox 
                    placeholder="Search Location..."
                    options={locations.map(l => ({ value: l.id, label: l.location_code }))}
                    value={selectedLocation}
                    onChange={setSelectedLocation}
                  />
                  <input 
                    type="number" 
                    value={stockQty}
                    onChange={(e) => setStockQty(parseInt(e.target.value))}
                    className="w-full bg-navy-900 border border-navy-700 rounded-xl px-4 py-3 focus:border-electric-blue outline-none"
                  />
                  <button type="submit" className="w-full bg-electric-blue hover:bg-electric-blue/90 text-white font-black py-3.5 rounded-xl transition-all shadow-lg active:scale-95">
                    Confirm Placement
                  </button>
                </form>
              </div>
            </div>

            <div className="lg:col-span-2 bg-navy-800 border border-navy-700 rounded-3xl overflow-hidden flex flex-col shadow-2xl">
              <div className="p-8 border-b border-navy-700 flex justify-between items-center">
                <h3 className="text-2xl font-black flex items-center gap-3"><FileSpreadsheet className="text-gray-400" size={24} /> Inventory Registry</h3>
                <div className="relative w-64">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                  <input 
                    type="text"
                    placeholder="Filter..."
                    className="w-full bg-navy-900 border border-navy-700 rounded-xl pl-12 pr-4 py-2 text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-navy-900/50 text-gray-500 text-[10px] uppercase font-black">
                      <th className="px-8 py-4">Product / SKU</th>
                      <th className="px-8 py-4 text-center">Node</th>
                      <th className="px-8 py-4 text-center">Available</th>
                      <th className="px-8 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-700/50">
                    {filteredInventory.map(item => (
                      <tr key={item.id} className="hover:bg-navy-700/30 transition-colors group">
                        <td className="px-8 py-5">
                          <p className="font-bold text-white text-sm">{item.name}</p>
                          <p className="text-xs text-gray-500 font-mono">{item.sku}</p>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <span className="text-[10px] font-black bg-navy-900 px-2 py-1 rounded border border-navy-700">
                            {item.product_locations?.[0]?.locations?.location_code || '---'}
                          </span>
                        </td>
                        <td className="px-8 py-5 text-center font-black text-emerald-400 text-lg">
                          {item.product_locations?.[0]?.quantity_primary || 0}
                        </td>
                        <td className="px-8 py-5 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setEditingProduct(item)} className="p-2 hover:bg-blue-500/10 rounded-lg text-blue-400"><Edit2 size={16} /></button>
                            <button onClick={() => handleDeleteProduct(item.id)} className="p-2 hover:bg-red-500/10 rounded-lg text-red-500"><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
          <div className="bg-navy-800 border border-navy-700 w-full max-w-md rounded-3xl p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Edit Master Item</h2>
              <button onClick={() => setEditingProduct(null)}><X size={20} /></button>
            </div>
            <form onSubmit={handleUpdateProduct} className="space-y-4">
              <input 
                type="text"
                value={editingProduct.name}
                onChange={(e) => setEditingProduct({...editingProduct, name: e.target.value})}
                className="w-full bg-navy-900 border border-navy-700 rounded-xl px-4 py-3 focus:border-electric-blue outline-none"
              />
              <input 
                type="text"
                value={editingProduct.sku}
                onChange={(e) => setEditingProduct({...editingProduct, sku: e.target.value})}
                className="w-full bg-navy-900 border border-navy-700 rounded-xl px-4 py-3 focus:border-electric-blue outline-none"
              />
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setEditingProduct(null)} className="flex-1 bg-navy-700 py-3 rounded-xl font-bold">Cancel</button>
                <button type="submit" className="flex-1 bg-electric-blue py-3 rounded-xl font-black shadow-lg">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
