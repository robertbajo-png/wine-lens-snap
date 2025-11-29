import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

type ClampTextCardProps = {
  title: string;
  text?: string;
  lines?: 2 | 3 | 4 | 5 | 6;
};

const clampClassMap: Record<NonNullable<ClampTextCardProps["lines"]>, string> = {
  2: "line-clamp-2",
  3: "line-clamp-3",
  4: "line-clamp-4",
  5: "line-clamp-5",
  6: "line-clamp-6",
};

export default function ClampTextCard({ title, text, lines = 4 }: ClampTextCardProps) {
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
    <section className="rounded-2xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p 
        ref={textRef}
        className={`mt-2 text-sm text-muted-foreground ${open ? "" : clampClassMap[lines] ?? clampClassMap[4]}`}
      >
        {text}
      </p>
      {(isOverflowing || open) && (
        <button
          type="button"
          className="mt-2 inline-flex items-center gap-1 text-xs text-primary underline transition hover:text-primary/80"
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