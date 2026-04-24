import type { ReactNode } from "react";

interface AppShellProps {
  children: ReactNode;
  className?: string;
}

/**
 * AppShell – lyxig wrapper enligt ScentSnap-struktur, anpassad för WineSnap.
 * Ger en mjuk radial glow i toppen och centrerar innehållet i en max-w-md kolumn.
 * BottomNav renderas av BottomTabLayout, så denna komponent lägger enbart till
 * spacing och ambient background — inte själva navigationen.
 */
export function AppShell({ children, className }: AppShellProps) {
  return (
    <div className={`relative min-h-[calc(100vh-6.5rem)] bg-background ${className ?? ""}`}>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[60vh] opacity-70"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, hsl(var(--gold) / 0.18) 0%, transparent 70%)",
        }}
      />
      <main className="mx-auto w-full max-w-md px-5 pt-6">{children}</main>
    </div>
  );
}

export default AppShell;
