import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

type ClampTextCardProps = {
  title: string;
  text?: string;
  lines?: 2 | 3 | 4 | 5 | 6;
  icon?: React.ReactNode;
};

const clampClassMap: Record<NonNullable<ClampTextCardProps["lines"]>, string> = {
  2: "line-clamp-2",
  3: "line-clamp-3",
  4: "line-clamp-4",
  5: "line-clamp-5",
  6: "line-clamp-6",
};

export default function ClampTextCard({ title, text, lines = 4, icon }: ClampTextCardProps) {
  const [open, setOpen] = React.useState(false);
  const textRef = React.useRef<HTMLParagraphElement>(null);
  const [isOverflowing, setIsOverflowing] = React.useState(false);

  React.useEffect(() => {
    if (textRef.current) {
      setIsOverflowing(textRef.current.scrollHeight > textRef.current.clientHeight);
    }
  }, [text]);

  if (!text || text === "–") return null;

  return (
    <section className="group rounded-2xl border border-theme-card bg-gradient-to-br from-theme-elevated via-theme-elevated/90 to-theme-elevated/70 p-4 transition-all duration-300 hover:border-accent-primary/20 hover:shadow-theme-elevated animate-fade-in">
      <div className="mb-2 flex items-center gap-2">
        {icon && (
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-primary/10 text-accent-primary">
            {icon}
          </div>
        )}
        <h3 className="text-sm font-semibold text-theme-primary">{title}</h3>
      </div>
      
      <p 
        ref={textRef}
        className={`text-sm leading-relaxed text-theme-secondary transition-all duration-300 ${open ? "" : clampClassMap[lines] ?? clampClassMap[4]}`}
      >
        {text}
      </p>
      
      {(isOverflowing || open) && (
        <button
          type="button"
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent-primary transition-colors hover:text-accent-glow"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <>
              <ChevronUp className="h-3 w-3" />
              Visa mindre
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              Visa mer
            </>
          )}
        </button>
      )}
    </section>
  );
}

