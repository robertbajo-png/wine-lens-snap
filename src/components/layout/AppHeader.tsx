import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

type AppHeaderVariant = "compact" | "hero";

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  rightActions?: ReactNode;
  variant: AppHeaderVariant;
}

const variantStyles: Record<AppHeaderVariant, { container: string; title: string; subtitle: string; layout: string }> = {
  hero: {
    container:
      "relative overflow-hidden rounded-3xl border border-border bg-card/70 px-6 py-8 shadow-elegant backdrop-blur sm:px-10 sm:py-10",
    title: "font-display break-words text-4xl font-semibold text-foreground sm:text-5xl",
    subtitle: "max-w-2xl break-words text-sm text-muted-foreground sm:text-base",
    layout: "gap-6 sm:gap-8 sm:flex-row sm:items-start sm:justify-between",
  },
  compact: {
    container: "border-b border-border/80 bg-background px-4 py-5 sm:px-6",
    title: "font-display break-words text-3xl font-semibold text-foreground",
    subtitle: "break-words text-sm text-muted-foreground",
    layout: "gap-4 sm:flex-row sm:items-center sm:justify-between",
  },
};

export const AppHeader = ({ title, subtitle, rightActions, variant }: AppHeaderProps) => {
  const styles = variantStyles[variant];

  return (
    <header className={cn("w-full", styles.container)}>
      {variant === "hero" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,transparent,hsl(var(--gold)/0.18))]" />
      )}
      <div className={cn("flex w-full flex-col", styles.layout)}>
        <div className="min-w-0 space-y-2">
          {title && <h1 className={styles.title}>{title}</h1>}
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {rightActions && <div className="flex flex-wrap items-center gap-3 sm:justify-end">{rightActions}</div>}
      </div>
    </header>
  );
};
