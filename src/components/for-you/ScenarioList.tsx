import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ForYouScenarioMode } from "@/services/forYouAIService";

type ScenarioItem = {
  key: ForYouScenarioMode;
  label: string;
  description: string;
  icon: ReactNode;
};

type ScenarioListProps = {
  scenarios: ScenarioItem[];
  onSelect: (scenario: ForYouScenarioMode) => void;
};

export const ScenarioList = ({ scenarios, onSelect }: ScenarioListProps) => (
  <TooltipProvider delayDuration={200}>
    <div className="flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-[repeat(auto-fit,minmax(180px,1fr))] sm:overflow-visible">
      {scenarios.map((scenario) => (
        <Tooltip key={scenario.key}>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              className="group flex h-full w-[75%] shrink-0 items-center justify-between gap-3 rounded-2xl border-theme-card/60 bg-surface-card px-4 py-3 text-left transition duration-150 ease-out hover:border-theme-primary/60 hover:bg-surface-card active:scale-[0.98] sm:w-auto"
              onClick={() => onSelect(scenario.key)}
            >
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-theme-accent/15 text-theme-primary">
                  {scenario.icon}
                </span>
                <span className="text-sm font-semibold leading-snug text-theme-primary">{scenario.label}</span>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 transition group-hover:translate-x-1" aria-hidden="true" />
              <span className="sr-only">{scenario.description}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[220px] text-xs leading-relaxed">
            {scenario.description}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  </TooltipProvider>
);
