import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export const typography = {
  h1: "text-3xl font-semibold text-theme-primary",
  h2: "text-2xl font-semibold text-theme-primary",
  label: "text-xs font-semibold uppercase tracking-[0.3em] text-theme-secondary/70",
  body: "text-base text-theme-secondary/90",
  muted: "text-sm text-theme-secondary/70",
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
