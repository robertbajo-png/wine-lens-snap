import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type AppHeaderProps = {
  title?: string;
  subtitle?: string;
  rightActions?: ReactNode;
  variant: "compact" | "hero";
};

export const AppHeader = ({ title, subtitle, rightActions, variant }: AppHeaderProps) => {
  const isHero = variant === "hero";

  return (
    <header
      className={cn(
        "w-full",
        isHero
          ? "rounded-3xl border border-[hsl(var(--color-border)/0.6)] bg-[hsl(var(--color-surface-alt)/0.9)] shadow-theme-card backdrop-blur"
          : "border-b border-theme-border bg-theme-canvas/80",
      )}
    >
      <div
        className={cn(
          "flex w-full flex-col gap-4",
          isHero
            ? "px-6 py-8 text-center sm:px-10 sm:py-12 sm:text-left"
            : "px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6",
        )}
      >
        <div className={cn("space-y-2", isHero ? "sm:max-w-2xl" : "")}>
          {title ? (
            <h1
              className={cn(
                "font-semibold text-theme-primary",
                isHero ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl",
              )}
            >
              {title}
            </h1>
          ) : null}
          {subtitle ? (
            <p className={cn("text-sm text-theme-secondary/80", isHero ? "sm:text-base" : "")}>{subtitle}</p>
          ) : null}
        </div>
        {rightActions ? (
          <div
            className={cn(
              "flex flex-wrap items-center gap-3",
              isHero ? "justify-center sm:justify-start" : "justify-start sm:justify-end",
            )}
          >
            {rightActions}
          </div>
        ) : null}
      </div>
    </header>
  );
};
