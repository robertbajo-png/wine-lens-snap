import { Wine } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  showText?: boolean;
}

const sizeMap = {
  sm: { circle: "h-8 w-8", icon: "h-4 w-4", text: "text-lg" },
  md: { circle: "h-10 w-10", icon: "h-5 w-5", text: "text-xl" },
  lg: { circle: "h-14 w-14", icon: "h-7 w-7", text: "text-3xl" },
} as const;

/**
 * WineSnap-logo: gold-cirkel + serif-typografi enligt ScentSnap-mall.
 */
export function Logo({ size = "md", className, showText = true }: LogoProps) {
  const s = sizeMap[size];
  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      <div
        className={cn(
          "grid place-items-center rounded-full bg-gradient-gold shadow-soft ring-1 ring-gold/30",
          s.circle,
        )}
      >
        <Wine className={cn("text-primary-foreground", s.icon)} aria-hidden="true" />
      </div>
      {showText && (
        <span className={cn("font-display font-semibold tracking-tight text-foreground", s.text)}>
          Wine<span className="text-gold">Snap</span>
        </span>
      )}
    </div>
  );
}

export default Logo;
