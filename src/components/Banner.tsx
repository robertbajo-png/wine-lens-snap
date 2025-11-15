import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BannerVariant = "info" | "success" | "warning" | "error";

type BannerProps = {
  type: BannerVariant;
  title?: string;
  text?: string;
  icon?: ReactNode;
  ctaLabel?: string;
  onCta?: () => void;
  className?: string;
};

const VARIANT_STYLES: Record<BannerVariant, {
  bg: string;
  border: string;
  iconColor: string;
  Icon: typeof Info;
}> = {
  info: {
    bg: "hsl(var(--accent-primary) / 0.14)",
    border: "hsl(var(--accent-primary) / 0.45)",
    iconColor: "hsl(var(--accent-primary))",
    Icon: Info,
  },
  success: {
    bg: "hsla(152, 76%, 62%, 0.16)",
    border: "hsla(152, 76%, 62%, 0.5)",
    iconColor: "hsl(152, 76%, 72%)",
    Icon: CheckCircle2,
  },
  warning: {
    bg: "hsla(43, 92%, 64%, 0.18)",
    border: "hsla(43, 92%, 64%, 0.55)",
    iconColor: "hsl(43, 92%, 68%)",
    Icon: AlertTriangle,
  },
  error: {
    bg: "hsla(0, 84%, 62%, 0.18)",
    border: "hsla(0, 84%, 62%, 0.55)",
    iconColor: "hsl(0, 84%, 72%)",
    Icon: XCircle,
  },
};

export const Banner = ({
  type,
  title,
  text,
  icon,
  ctaLabel,
  onCta,
  className,
}: BannerProps) => {
  const variant = VARIANT_STYLES[type];
  const DefaultIcon = variant.Icon;
  const iconElement = icon ?? <DefaultIcon className="h-5 w-5" />;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border px-4 py-3 text-sm text-theme-secondary shadow-theme-elevated transition sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
      style={{ backgroundColor: variant.bg, borderColor: variant.border }}
      role="status"
      aria-live={type === "error" ? "assertive" : "polite"}
    >
      <div className="flex flex-1 items-start gap-3">
        <span
          className="mt-0.5 grid h-7 w-7 place-items-center rounded-full"
          style={{
            color: variant.iconColor,
            backgroundColor: "hsl(var(--surface-elevated) / 0.45)",
          }}
        >
          {iconElement}
        </span>
        <div className="space-y-1">
          {title && <p className="text-sm font-semibold text-theme-primary">{title}</p>}
          {text && <p className="text-sm leading-relaxed text-theme-secondary">{text}</p>}
        </div>
      </div>
      {ctaLabel && onCta && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onCta}
          className="ml-auto inline-flex items-center justify-center rounded-full border-theme-card bg-transparent px-4 text-xs font-semibold text-theme-primary hover:bg-[hsl(var(--surface-elevated)/0.85)]"
          style={{ borderColor: variant.border, color: variant.iconColor }}
        >
          {ctaLabel}
        </Button>
      )}
    </div>
  );
};
