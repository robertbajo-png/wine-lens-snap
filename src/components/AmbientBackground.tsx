import { cn } from "@/lib/utils";

type AmbientBackgroundProps = {
  className?: string;
};

export const AmbientBackground = ({ className }: AmbientBackgroundProps) => (
  <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
    <div
      className="absolute -left-40 top-16 h-96 w-96 rounded-full blur-[160px]"
      style={{ background: "radial-gradient(circle, hsl(var(--accent-primary) / 0.28) 0%, transparent 70%)" }}
    />
    <div
      className="absolute right-[-120px] bottom-8 h-[28rem] w-[28rem] rounded-full blur-[180px]"
      style={{ background: "radial-gradient(circle, hsl(var(--accent-primary) / 0.16) 0%, transparent 70%)" }}
    />
    <div
      className="absolute inset-x-0 top-0 h-72"
      style={{ background: "linear-gradient(to bottom, hsl(var(--bg-surface) / 0.7), transparent)" }}
    />
    <div
      className="absolute inset-x-0 bottom-0 h-48"
      style={{ background: "linear-gradient(to top, hsl(var(--bg-surface) / 0.65), transparent)" }}
    />
  </div>
);
