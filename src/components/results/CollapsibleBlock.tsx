import { ReactNode, useId, useState } from "react";
import { cn } from "@/lib/utils";

interface CollapsibleBlockProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export function CollapsibleBlock({ title, children, defaultOpen = false, className }: CollapsibleBlockProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <section className={cn("rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-lg", className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
        aria-controls={contentId}
        aria-label={title}
      >
        <span className="text-base font-semibold text-white">{title}</span>
        <span
          aria-hidden="true"
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/20 text-xs font-semibold text-white",
            open ? "bg-white/20" : "bg-white/10"
          )}
        >
          {open ? "–" : "+"}
        </span>
      </button>
      <div
        id={contentId}
        className={cn(
          "mt-4 space-y-3 text-sm text-slate-200 transition-all",
          open ? "opacity-100" : "max-h-0 overflow-hidden opacity-0"
        )}
        role="region"
        aria-live="polite"
      >
        {children}
      </div>
    </section>
  );
}
