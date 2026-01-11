import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export const typography = {
  h1: "text-2xl font-semibold leading-tight text-theme-primary text-wrap-balance text-avoid-break sm:text-3xl md:text-4xl",
  h2: "text-xl font-semibold leading-tight text-theme-primary text-wrap-balance text-avoid-break sm:text-2xl md:text-3xl",
  label: "text-[11px] font-semibold uppercase tracking-[0.24em] text-theme-secondary/70 text-avoid-break sm:text-xs sm:tracking-[0.26em]",
  body: "text-sm text-theme-secondary/90 text-avoid-break sm:text-base",
  muted: "text-xs text-theme-secondary/70 text-avoid-break sm:text-sm",
};

type TypographyHeadingProps = React.HTMLAttributes<HTMLHeadingElement> & { asChild?: boolean };

type TypographyTextProps = React.HTMLAttributes<HTMLParagraphElement> & { asChild?: boolean };

const H1 = React.forwardRef<HTMLHeadingElement, TypographyHeadingProps>(
  ({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "h1";
    return <Comp ref={ref} className={cn(typography.h1, className)} {...props} />;
  },
);
H1.displayName = "H1";

const H2 = React.forwardRef<HTMLHeadingElement, TypographyHeadingProps>(
  ({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "h2";
    return <Comp ref={ref} className={cn(typography.h2, className)} {...props} />;
  },
);
H2.displayName = "H2";

const Label = React.forwardRef<HTMLParagraphElement, TypographyTextProps>(
  ({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "p";
    return <Comp ref={ref} className={cn(typography.label, className)} {...props} />;
  },
);
Label.displayName = "Label";

const Body = React.forwardRef<HTMLParagraphElement, TypographyTextProps>(
  ({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "p";
    return <Comp ref={ref} className={cn(typography.body, className)} {...props} />;
  },
);
Body.displayName = "Body";

const Muted = React.forwardRef<HTMLParagraphElement, TypographyTextProps>(
  ({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "p";
    return <Comp ref={ref} className={cn(typography.muted, className)} {...props} />;
  },
);
Muted.displayName = "Muted";

export { H1, H2, Label, Body, Muted };
