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
  const [animationComplete, setAnimationComplete] = useState(false);
  
  // Animate from 0 to target value on mount/change
  useEffect(() => {
    if (targetValue === null) {
      setAnimatedValue(0);
      setAnimationComplete(false);
      return;
    }
    
    // Start from 0
    setAnimatedValue(0);
    setAnimationComplete(false);
    
    // Small delay then animate to target
    const animateTimeout = setTimeout(() => {
      setAnimatedValue(targetValue);
    }, 100 + delay);
    
    // Mark animation as complete after the transition duration
    const completeTimeout = setTimeout(() => {
      setAnimationComplete(true);
    }, 1200 + delay);
    
    return () => {
      clearTimeout(animateTimeout);
      clearTimeout(completeTimeout);
    };
  }, [targetValue, delay]);

  const size = 64;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * (animatedValue / 5);
  const gap = c - dash;

  return (
    <div 
      className="flex flex-col items-center gap-2"
      style={{
        opacity: 0,
        animation: `fade-in 0.4s ease-out ${delay}ms forwards`
      }}
    >
      <div 
        className={`relative ${animationComplete ? 'animate-pulse-glow' : ''}`}
        style={{
          filter: targetValue !== null ? 'drop-shadow(0 0 12px hsl(var(--primary) / 0.4))' : undefined
        }}
      >
        <svg 
          width={size} 
          height={size} 
          aria-label={`${label} ${targetValue ?? "–"} av 5`}
          className="transform -rotate-90"
        >
          {/* Background track */}
          <circle 
            cx={size/2} 
            cy={size/2} 
            r={r} 
            strokeWidth={stroke} 
            stroke="hsl(var(--muted) / 0.3)" 
            fill="none"
          />
          
          {/* Animated progress arc */}
          {targetValue !== null && (
            <circle 
              cx={size/2} 
              cy={size/2} 
              r={r} 
              strokeWidth={stroke}
              stroke={estimated ? "hsl(var(--primary) / 0.7)" : "hsl(var(--primary))"}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${gap}`}
              className="transition-all duration-1000 ease-out"
            />
          )}
        </svg>
        
        {/* Center content */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-background/90 backdrop-blur-sm shadow-inner">
            {targetValue === null ? (
              <span className="text-sm font-medium text-muted-foreground">–</span>
            ) : (
              <span className={`text-base font-bold ${estimated ? "text-white/80" : "text-white"}`}>
                {estimated && <span className="text-xs">≈</span>}
                {targetValue}
              </span>
            )}
          </div>
        </div>
      </div>
      <span className="text-[11px] font-medium uppercase tracking-wide text-white/70">{label}</span>
    </div>
  );
}