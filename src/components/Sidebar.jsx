import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { LayoutDashboard, Settings, ShoppingCart, Map, Smartphone, Flag } from 'lucide-react';

const Sidebar = () => {
  const [flagCount, setFlagCount] = useState(0);

  useEffect(() => {
    fetchFlagCount();
    
    // Subscribe to REALTIME flag changes
    const channel = supabase
      .channel('sidebar-flags')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'location_flags' },
        () => {
          fetchFlagCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchFlagCount = async () => {
    const { count } = await supabase
      .from('location_flags')
      .select('*', { count: 'exact', head: true })
      .eq('resolved', false);
    
    setFlagCount(count || 0);
  };

  const links = [
    { to: "/", label: "Demo & Dashboard", icon: <LayoutDashboard size={20} /> },
    { to: "/admin", label: "Admin Setup", icon: <Settings size={20} /> },
    { to: "/orders", label: "Order Input", icon: <ShoppingCart size={20} /> },
    { to: "/session", label: "Pick Sessions", icon: <Map size={20} /> },
    { to: "/picker", label: "Mobile Picker", icon: <Smartphone size={20} /> },
    { to: "/flags", label: "Location Flags", icon: <Flag size={20} />, badge: flagCount > 0 ? flagCount : null },
  ];

  return (
    <div className="w-64 bg-navy-900 border-r border-[#1F2937] flex flex-col h-screen shrink-0 sticky top-0 left-0">
      <div className="p-6">
         <div className="flex items-center gap-3">
            <div className="bg-electric-blue text-white p-2 rounded-lg font-bold text-xl leading-none shadow-lg">SX</div>
            <h1 className="text-2xl font-extrabold tracking-tight">Solve<span className="text-electric-light">Xpert</span></h1>
          </div>
      </div>
      
      <nav className="flex-1 px-4 space-y-2 mt-4">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => 
              `flex items-center justify-between px-4 py-3 rounded-lg font-medium transition-colors ${
                isActive 
                  ? "bg-[#1E293B] text-electric-light border border-[#334155]/50 shadow-inner" 
                  : "text-gray-400 hover:text-white hover:bg-[#111827]"
              }`
            }
          >
            <div className="flex items-center gap-3">
              {link.icon}
              {link.label}
            </div>
            {link.badge && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg shadow-red-500/20 animate-pulse">
                {link.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-[#1F2937]">
        <div className="flex items-center gap-3 p-3 bg-[#111827] rounded-lg">
          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-bold text-navy-900">
            ON
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">Supabase DB</p>
            <p className="text-xs text-emerald-400">Connected</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
