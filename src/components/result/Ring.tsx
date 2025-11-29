import React, { useEffect, useState } from "react";

interface RingProps {
  label: string;
  value?: number | null;
  estimated?: boolean;
  delay?: number;
}

export function Ring({ label, value, estimated, delay = 0 }: RingProps) {
  const targetValue = typeof value === "number" ? Math.max(0, Math.min(5, value)) : null;
  const [animatedValue, setAnimatedValue] = useState(0);
  const [visible, setVisible] = useState(false);
  
  useEffect(() => {
    if (targetValue === null) {
      setAnimatedValue(0);
      return;
    }
    
    setAnimatedValue(0);
    
    const visibleTimeout = setTimeout(() => {
      setVisible(true);
    }, delay);
    
    const animateTimeout = setTimeout(() => {
      setAnimatedValue(targetValue);
    }, 100 + delay);
    
    return () => {
      clearTimeout(visibleTimeout);
      clearTimeout(animateTimeout);
    };
  }, [targetValue, delay]);

  const size = 48;
  const cx = size / 2;
  const cy = size / 2;
  const r = 20;

  // Calculate pie slice path
  const angle = (animatedValue / 5) * 360;
  const rad = ((angle - 90) * Math.PI) / 180;
  const x = cx + r * Math.cos(rad);
  const y = cy + r * Math.sin(rad);
  const largeArc = angle > 180 ? 1 : 0;

  // Create pie path (from center, up, arc, back to center)
  const piePath = angle > 0
    ? `M ${cx},${cy} L ${cx},${cy - r} A ${r},${r} 0 ${largeArc} 1 ${x},${y} Z`
    : "";

  return (
    <div 
      className={`flex flex-col items-center transition-all duration-500 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      {/* Label above */}
      <span className="mb-2 text-[10px] font-medium uppercase tracking-widest text-white/60">
        {label}
      </span>
      
      {/* Pie chart circle */}
      <div className="relative">
        <svg 
          width={size} 
          height={size} 
          aria-label={`${label} ${targetValue ?? "–"} av 5`}
        >
          {/* Background circle */}
          <circle 
            cx={cx} 
            cy={cy} 
            r={r} 
            fill="rgba(255,255,255,0.08)"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth={1}
          />
          
          {/* Filled pie slice */}
          {targetValue !== null && (
            <path 
              d={piePath}
              fill={estimated ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.85)"}
              className="transition-all duration-700 ease-out"
            />
          )}
          
          {/* Center dot for empty state */}
          {targetValue === null && (
            <circle 
              cx={cx} 
              cy={cy} 
              r={2} 
              fill="rgba(255,255,255,0.3)"
            />
          )}
        </svg>
        
        {/* Estimated indicator */}
        {estimated && (
          <span className="absolute -right-1 -top-1 text-[8px] text-white/50">≈</span>
        )}
      </div>
    </div>
  );
}
