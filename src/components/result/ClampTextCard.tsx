import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKey } from "@/lib/translations";

type ClampTextCardProps = {
  titleKey: TranslationKey;
  text?: string;
  lines?: 2 | 3 | 4 | 5 | 6;
  variant?: "card" | "embedded";
  titleClassName?: string;
};

const clampClassMap: Record<NonNullable<ClampTextCardProps["lines"]>, string> = {
  2: "line-clamp-2",
  3: "line-clamp-3",
  4: "line-clamp-4",
  5: "line-clamp-5",
  6: "line-clamp-6",
};

export default function ClampTextCard({
  titleKey,
  text,
  lines = 4,
  variant = "card",
  titleClassName,
}: ClampTextCardProps) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const textRef = React.useRef<HTMLParagraphElement>(null);
  const [isOverflowing, setIsOverflowing] = React.useState(false);

  React.useEffect(() => {
    if (textRef.current) {
      setIsOverflowing(textRef.current.scrollHeight > textRef.current.clientHeight);
    }
  }, [text]);

  if (!text || text === "–") return null;

  const isEmbedded = variant === "embedded";

  return (
    <section
      className={
        isEmbedded
          ? "space-y-3"
          : "rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
      }
    >
      <h3
        className={
          titleClassName ??
          (isEmbedded
            ? "border-b border-theme-card/60 pb-3 text-xs font-semibold uppercase tracking-wide text-theme-primary"
            : "text-sm font-semibold text-white/60")
        }
      >
        {t(titleKey)}
      </h3>
      <p 
        ref={textRef}
        className={`mt-2 text-sm text-white ${open ? "" : clampClassMap[lines] ?? clampClassMap[4]}`}
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
              {t("clampText.showLess")}
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              {t("clampText.showMore")}
            </>
          )}
        </button>
      )}
    </section>
  );
}
