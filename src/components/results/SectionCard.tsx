import { ReactNode, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  title: string;
  text?: string | null;
  clampLines?: number;
  children?: ReactNode;
  className?: string;
}

function prepareText(text?: string | null): { value: string; isMissing: boolean } {
  if (typeof text !== "string") {
    return { value: "–", isMissing: true };
  }
  const trimmed = text.trim();
  if (!trimmed || trimmed === "-" || trimmed === "–") {
    return { value: "–", isMissing: true };
  }
  return { value: text, isMissing: false };
}

export function SectionCard({ title, text, clampLines = 0, children, className }: SectionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const prepared = useMemo(() => prepareText(text), [text]);

  const showToggle = Boolean(
    !prepared.isMissing && clampLines > 0 && prepared.value.length > 200
  );

  return (
    <section
      className={cn(
        "rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-lg",
        className
      )}
    >
      <header className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {showToggle && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="text-xs font-semibold uppercase tracking-widest text-purple-200 hover:text-purple-100"
            aria-expanded={expanded}
          >
            {expanded ? "Visa mindre" : "Visa mer"}
          </button>
        )}
      </header>
      {typeof text === "string" ? (
        <p
          className={cn(
            "text-sm leading-7",
            prepared.isMissing ? "text-slate-400" : "text-white"
          )}
          style={
            !expanded && showToggle && clampLines
              ? {
                  display: "-webkit-box",
                  WebkitLineClamp: clampLines,
                  WebkitBoxOrient: "vertical" as const,
                  overflow: "hidden",
                }
              : undefined
          }
        >
          {prepared.value}
        </p>
      ) : (
        children
      )}
    </section>
  );
}
