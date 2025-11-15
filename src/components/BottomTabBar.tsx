import { NavLink } from "react-router-dom";
import { Compass, Scan, Sparkles, Users, Wine } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  {
    path: "/for-you",
    label: "För dig",
    icon: Sparkles,
    ariaLabel: "Gå till För dig",
  },
  {
    path: "/explore",
    label: "Utforska",
    icon: Compass,
    ariaLabel: "Gå till Utforska",
  },
  {
    path: "/scan",
    label: "Skanna",
    icon: Scan,
    ariaLabel: "Starta skanning",
    isCenter: true,
  },
  {
    path: "/following",
    label: "Följer",
    icon: Users,
    ariaLabel: "Gå till Följer",
  },
  {
    path: "/me/wines",
    label: "Mina viner",
    icon: Wine,
    ariaLabel: "Gå till Mina viner",
  },
] as const;

export const BottomTabBar = () => {
  const triggerHaptics = () => {
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(8);
    }
  };

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-theme-card/60 bg-[hsla(var(--surface-elevated)/0.65)] backdrop-blur-xl"
      role="navigation"
      aria-label="Huvudnavigering"
    >
      <div className="mx-auto flex w-full max-w-3xl justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2">
        <ul className="grid w-full grid-cols-5 items-end gap-2">
          {tabs.map(({ path, label, icon: Icon, ariaLabel, isCenter }) => (
            <li key={path} className="flex justify-center">
              <NavLink
                to={path}
                aria-label={ariaLabel}
                className={({ isActive }) =>
                  cn(
                    "relative flex min-h-[3.5rem] flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 text-xs font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-primary/60",
                    isActive ? "text-theme-primary" : "text-theme-secondary/70",
                    isCenter
                      ? "-translate-y-5 h-16 w-16 rounded-full border border-theme-card/70 bg-gradient-to-br from-[#7B3FE4] via-[#8451ED] to-[#B095FF] text-theme-primary shadow-[0_18px_45px_-20px_rgba(123,63,228,1)]"
                      : "bg-transparent"
                  )
                }
                onClick={triggerHaptics}
              >
                <Icon className={cn(isCenter ? "h-6 w-6" : "h-5 w-5")} aria-hidden="true" />
                {!isCenter ? <span>{label}</span> : <span className="sr-only">{label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
};

export default BottomTabBar;
