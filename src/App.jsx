import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import DemoDashboard from './views/DemoDashboard';
import AdminSetup from './views/AdminSetup';
import OrderInput from './views/OrderInput';
import MobilePicker from './views/MobilePicker';
import LocationFlags from './views/LocationFlags';

// Temporary placeholder components for routes not yet implemented
const Placeholder = ({ title }) => (
  <div className="flex items-center justify-center h-full border-2 border-dashed border-[#1F2937] rounded-xl bg-navy-800/50">
    <div className="text-center">
      <h2 className="text-2xl font-bold text-gray-300">{title}</h2>
      <p className="text-gray-500 mt-2">Coming soon in Phase 3</p>
    </div>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-[#0A0F1E] text-white font-sans overflow-hidden">
        
        {/* Persistent Global Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto w-full h-screen relative">
          <div className="p-8 max-w-[1600px] mx-auto min-h-full">
            <Routes>
              <Route path="/" element={<DemoDashboard />} />
              <Route path="/admin" element={<AdminSetup />} />
              <Route path="/orders" element={<OrderInput />} />
              <Route path="/session" element={<Placeholder title="Pick Session UI" />} />
              <Route path="/picker" element={<MobilePicker />} />
              <Route path="/flags" element={<LocationFlags />} />
            </Routes>
          </div>
          
          <footer className="absolute bottom-4 right-8 text-right text-gray-600 text-xs mt-12 bg-[#0A0F1E]">
            <p>Built for SolveXpert AI Automation Agency Demo Portfolio.</p>
          </footer>
        </main>
        
      </div>
    </BrowserRouter>
  );
}

export default App;
