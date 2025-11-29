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

  const size = 40;
  const cx = size / 2;
  const cy = size / 2;
  const r = 16;

  // Calculate pie slice path - starts from top (12 o'clock)
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
      className={`group flex flex-col items-center transition-all duration-500 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      {/* Label above - Systembolaget style */}
      <span className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-white/50 transition-colors duration-200 group-hover:text-white/70">
        {label}
      </span>
      
      {/* Pie chart circle with hover effect */}
      <svg 
        width={size} 
        height={size} 
        aria-label={`${label} ${targetValue ?? "–"} av 5`}
        className="cursor-pointer transition-transform duration-200 ease-out group-hover:scale-110"
        style={{
          filter: 'drop-shadow(0 0 0 transparent)',
          transition: 'transform 0.2s ease-out, filter 0.2s ease-out',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.filter = 'drop-shadow(0 0 8px rgba(255,255,255,0.3))';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.filter = 'drop-shadow(0 0 0 transparent)';
        }}
      >
        {/* Background circle with border */}
        <circle 
          cx={cx} 
          cy={cy} 
          r={r} 
          fill="rgba(255,255,255,0.04)"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth={1}
          className="transition-all duration-200 group-hover:fill-white/10 group-hover:stroke-white/40"
        />
        
        {/* Filled pie slice - solid white like Systembolaget */}
        {targetValue !== null && (
          <path 
            d={piePath}
            fill={estimated ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.9)"}
            className="transition-all duration-700 ease-out"
          />
        )}
        
        {/* Empty state indicator */}
        {targetValue === null && (
          <text 
            x={cx} 
            y={cy} 
            textAnchor="middle" 
            dominantBaseline="central"
            fill="rgba(255,255,255,0.3)"
            fontSize="12"
            fontWeight="500"
          >
            –
          </text>
        )}
      </svg>
      
      {/* Estimated indicator below */}
      {estimated && (
        <span className="mt-0.5 text-[8px] text-white/40">uppsk.</span>
      )}
    </div>
  );
}
