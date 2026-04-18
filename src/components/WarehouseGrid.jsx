import React, { useEffect, useRef, useState } from 'react';
import { AISLES, SECTIONS, getCoordinates, PRODUCTS } from '../utils/data';

const WarehouseGrid = ({ title, route, mode }) => {
  const [progress, setProgress] = useState(0);
  const containerRef = useRef(null);

  // Animate the path filling up
  useEffect(() => {
    let animationFrame;
    let start = null;
    // Calculate a consistent duration based on distance so both dots move at the same speed
    // e.g. distance * 1.5 ms -> 6000 distance = 9 seconds
    const duration = route?.distance ? route.distance * 2.5 : 5000;

    const animate = (timestamp) => {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      const currentProgress = Math.min(elapsed / duration, 1);
      setProgress(currentProgress);
      
      if (currentProgress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    setProgress(0);
    animationFrame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrame);
  }, [route, mode]);

  // Points string for SVG polyline
  const points = route?.path?.map(p => `${p.x},${p.y}`).join(' ');

  // Calculate drawing path for dash array
  // This is a rough estimation of path length, in perfectly precise implementations you'd use SVG getTotalLength()
  const pathLength = route?.distance || 10000;

  const isNaive = mode === 'naive';
  const strokeColor = isNaive ? '#ef4444' : '#10b981'; // red-500 : emerald-500

  // Current dot position based on progress
  const getCurrentPoint = () => {
    if (!route || !route.path || route.path.length === 0) return { x: 250, y: 20 };
    if (progress === 0) return route.path[0];
    if (progress === 1) return route.path[route.path.length - 1];

    const totalSegs = route.path.length - 1;
    const exactIndex = progress * totalSegs;
    const idx = Math.floor(exactIndex);
    const remainder = exactIndex - idx;

    const p1 = route.path[idx];
    const p2 = route.path[idx + 1];

    if (!p2) return p1;

    return {
      x: p1.x + (p2.x - p1.x) * remainder,
      y: p1.y + (p2.y - p1.y) * remainder
    };
  };

  const dotPos = getCurrentPoint();

  return (
    <div className="flex flex-col h-full w-full bg-navy-800 rounded-xl border border-navy-700 shadow-2xl overflow-hidden p-6 relative">
      
      <div className="flex justify-between items-center mb-6 z-10 w-full relative">
        <div className="flex-1">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${isNaive ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
            {title}
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            {isNaive ? 'Channel-by-channel sequential picking' : 'AI Batched snake-pattern picking'}
          </p>
        </div>
        
        <div className="text-right w-40">
          <div className="text-2xl font-mono font-bold text-white">{route?.distance.toLocaleString()}m</div>
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Total Walked</div>
          
          {/* Progress bar representing time spent walking */}
          <div className="w-full bg-navy-900 rounded-full h-1.5 overflow-hidden">
            <div 
              className={`h-full transition-all duration-75 ${isNaive ? 'bg-red-500' : 'bg-emerald-500'}`} 
              style={{ width: `${progress * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Warehouse Map Wrapper */}
      <div className="relative flex-1 bg-navy-900 rounded-lg border border-navy-700/50 overflow-hidden" ref={containerRef}>
        
        <svg className="absolute inset-0 w-full h-full" width="500" height="600" viewBox="0 0 500 600" preserveAspectRatio="xMidYMid meet">
          {/* Grid visual lines */}
          <line x1="120" y1="50" x2="120" y2="550" stroke="#1F2937" strokeWidth="40" strokeLinecap="round" />
          <line x1="380" y1="50" x2="380" y2="550" stroke="#1F2937" strokeWidth="40" strokeLinecap="round" />

          {/* Packing Station */}
          <rect x="200" y="5" width="100" height="30" fill="#2563EB" opacity="0.3" rx="4" />
          <text x="250" y="25" fill="#3B82F6" fontSize="12" textAnchor="middle" fontWeight="bold">PACKING STATION</text>

          {/* Aisles Text labels */}
          <text x="70" y="45" fill="#6B7280" fontSize="14" textAnchor="middle" fontWeight="bold">Aisle 13</text>
          <text x="170" y="45" fill="#6B7280" fontSize="14" textAnchor="middle" fontWeight="bold">Aisle 14</text>
          <text x="330" y="45" fill="#6B7280" fontSize="14" textAnchor="middle" fontWeight="bold">Aisle 15</text>
          <text x="430" y="45" fill="#6B7280" fontSize="14" textAnchor="middle" fontWeight="bold">Aisle 16</text>

          {/* Render Sections (Boxes) */}
          {SECTIONS.map((sec, i) => (
             <g key={`sec-${sec}`}>
               {/* Aisle 13 */}
               <rect x="60" y={80 + i * 35 - 10} width="20" height="20" fill="#111827" stroke="#1F2937" rx="2" />
               <text x="70" y={80 + i * 35 + 4} fill="#4B5563" fontSize="10" textAnchor="middle">{sec}</text>
               
               {/* Aisle 14 */}
               <rect x="160" y={80 + i * 35 - 10} width="20" height="20" fill="#111827" stroke="#1F2937" rx="2" />
               <text x="170" y={80 + i * 35 + 4} fill="#4B5563" fontSize="10" textAnchor="middle">{sec}</text>

               {/* Aisle 15 */}
               <rect x="320" y={80 + i * 35 - 10} width="20" height="20" fill="#111827" stroke="#1F2937" rx="2" />
               <text x="330" y={80 + i * 35 + 4} fill="#4B5563" fontSize="10" textAnchor="middle">{sec}</text>
               
               {/* Aisle 16 */}
               <rect x="420" y={80 + i * 35 - 10} width="20" height="20" fill="#111827" stroke="#1F2937" rx="2" />
               <text x="430" y={80 + i * 35 + 4} fill="#4B5563" fontSize="10" textAnchor="middle">{sec}</text>
             </g>
          ))}

          {/* Background full path (faint) */}
          {points && (
            <polyline 
              points={points} 
              fill="none" 
              stroke={strokeColor} 
              strokeWidth="2" 
              opacity={0.15} 
            />
          )}

          {/* Animated drawing path */}
          {/* Note: SVG strokeDasharray can't perfectly map to 'progress' like this without measuring the exact SVG node in React, 
              so we use a clipPath trick to "reveal" the line or just draw segments up to current progress */}
          <g>
            {route?.path?.map((p, i) => {
               if (i === 0) return null;
               const prevPoint = route.path[i-1];
               
               // Only draw segments that we have passed
               // exactIndex from earlier:
               const exactIndex = progress * (route.path.length - 1);
               
               if (i <= exactIndex) {
                 return (
                   <line
                     key={`line-${i}`}
                     x1={prevPoint.x}
                     y1={prevPoint.y}
                     x2={p.x}
                     y2={p.y}
                     stroke={strokeColor}
                     strokeWidth="3"
                     opacity="0.75"
                     strokeLinecap="round"
                   />
                 )
               }
               // the partial segment
               if (i > exactIndex && i - 1 <= exactIndex) {
                 return (
                   <line
                     key={`line-partial-${i}`}
                     x1={prevPoint.x}
                     y1={prevPoint.y}
                     x2={dotPos.x}
                     y2={dotPos.y}
                     stroke={strokeColor}
                     strokeWidth="3"
                     opacity="0.9"
                     strokeLinecap="round"
                   />
                 )
               }
               return null;
            })}
          </g>

          {/* The Picker Dot */}
          <g>
            <circle 
              cx={dotPos.x} 
              cy={dotPos.y} 
              r="6" 
              fill={strokeColor} 
              className="drop-shadow-lg"
            >
              <animate attributeName="r" values="6;9;6" dur="0.8s" repeatCount="indefinite" />
            </circle>
            {/* Inner dot */}
            <circle cx={dotPos.x} cy={dotPos.y} r="3" fill="#fff" />
            {progress < 1 && (
              <text x={dotPos.x + 10} y={dotPos.y - 10} textAnchor="start" fill="#fff" fontSize="10" className="font-bold drop-shadow-md">
                Picker
              </text>
            )}
            {progress === 1 && (
              <text x={dotPos.x + 10} y={dotPos.y - 10} textAnchor="start" fill={strokeColor} fontSize="12" fontWeight="bold">
                ✓ Done
              </text>
            )}
          </g>

          {/* Highlight items picked so far? */}
        </svg>
      </div>

    </div>
  );
};

export default WarehouseGrid;
