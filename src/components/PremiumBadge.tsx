import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type PremiumBadgeProps = {
  message: string;
  className?: string;
};

export const PremiumBadge = ({ message, className }: PremiumBadgeProps) => {
  return (
    <TooltipProvider delayDuration={0} skipDelayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            className={cn(
              "gap-1 border-amber-200 bg-amber-100 text-amber-800 shadow-sm transition hover:border-amber-300 hover:bg-amber-100/90 dark:border-amber-400/40 dark:bg-amber-500/20 dark:text-amber-100",
              className,
            )}
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Premium
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-sm text-theme-primary" side="top">
          <p>{message}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

