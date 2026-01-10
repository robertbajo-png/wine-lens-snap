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
      "rounded-3xl border border-[hsl(var(--color-border)/0.6)] bg-[hsl(var(--color-surface-alt)/0.9)] px-6 py-8 shadow-theme-card backdrop-blur sm:px-10 sm:py-12",
    title: "text-3xl font-semibold text-theme-primary sm:text-4xl",
    subtitle: "max-w-2xl text-sm text-theme-secondary/80 sm:text-base",
    layout: "gap-6 sm:flex-row sm:items-start sm:justify-between",
  },
  compact: {
    container: "border-b border-theme-border/80 bg-theme-canvas px-4 py-4 sm:px-6",
    title: "text-2xl font-semibold text-theme-primary",
    subtitle: "text-sm text-theme-secondary",
    layout: "gap-4 sm:flex-row sm:items-center sm:justify-between",
  },
};

export const AppHeader = ({ title, subtitle, rightActions, variant }: AppHeaderProps) => {
  const styles = variantStyles[variant];

  return (
    <header className={cn("w-full", styles.container)}>
      <div className={cn("flex w-full flex-col", styles.layout)}>
        <div className="space-y-2">
          {title && <h1 className={styles.title}>{title}</h1>}
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {rightActions && <div className="flex flex-wrap items-center gap-3 sm:justify-end">{rightActions}</div>}
      </div>
    </header>
  );
};
