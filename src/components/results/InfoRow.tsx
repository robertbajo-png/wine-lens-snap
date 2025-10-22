import { ReactNode } from "react";
import { cn } from "@/lib/utils";

function normalizeValue(value?: string | null): { display: string; isMissing: boolean } {
  if (typeof value !== "string") {
    return { display: "–", isMissing: true };
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed === "-" || trimmed === "–") {
    return { display: "–", isMissing: true };
  }

  return { display: value, isMissing: false };
}

export interface InfoRowProps {
  label: string;
  value?: string | null;
  children?: ReactNode;
  className?: string;
}

export function InfoRow({ label, value, children, className }: InfoRowProps) {
  const { display, isMissing } = normalizeValue(value);
  const content: ReactNode = children ?? display;

  return (
    <div className={cn("grid grid-cols-[minmax(0,160px)_1fr] gap-4 py-3", className)}>
      <span className="text-xs font-semibold uppercase tracking-widest text-slate-300">
        {label}
      </span>
      <span
        className={cn(
          "text-sm leading-6",
          isMissing && !children ? "text-slate-400" : "text-white font-medium"
        )}
      >
        {content}
      </span>
    </div>
  );
}
