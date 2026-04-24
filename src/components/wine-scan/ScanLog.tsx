import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clipboard,
  ScrollText,
} from "lucide-react";
import type { ScanLogEntry, ScanLogLevel, ScanStage } from "@/services/scanPipelineService";
import { cn } from "@/lib/utils";

interface ScanLogProps {
  logs: ScanLogEntry[];
  hasError?: boolean;
  className?: string;
}

const stageLabel: Record<ScanStage | "pipeline", string> = {
  pipeline: "Pipeline",
  prep: "Bild",
  ocr: "OCR",
  analysis: "Analys",
  network: "Nätverk",
};

const levelClasses: Record<ScanLogLevel, string> = {
  info: "text-theme-secondary",
  warn: "text-amber-300",
  error: "text-red-300",
};

const formatTime = (ts: number) => {
  const d = new Date(ts);
  const pad = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
};

const LevelIcon = ({ level }: { level: ScanLogLevel }) => {
  if (level === "error") return <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-300" />;
  if (level === "warn") return <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-300" />;
  return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-300/80" />;
};

export const ScanLog = ({ logs, hasError = false, className }: ScanLogProps) => {
  const [open, setOpen] = useState(hasError);
  const { toast } = useToast();

  const enriched = useMemo(() => {
    let prev: number | null = null;
    return logs.map((entry) => {
      const delta = prev === null ? 0 : entry.timestamp - prev;
      prev = entry.timestamp;
      return { entry, delta };
    });
  }, [logs]);

  const handleCopy = async () => {
    const text = logs
      .map((entry) => {
        const base = `[${formatTime(entry.timestamp)}] (${stageLabel[entry.stage]}) ${entry.level.toUpperCase()}: ${entry.message}`;
        return entry.data ? `${base}\n  ${JSON.stringify(entry.data)}` : base;
      })
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Loggen kopierad", description: `${logs.length} rader i urklipp.` });
    } catch {
      toast({
        title: "Kunde inte kopiera",
        description: "Markera och kopiera manuellt.",
        variant: "destructive",
      });
    }
  };

  if (logs.length === 0) return null;

  const errorCount = logs.filter((l) => l.level === "error").length;
  const warnCount = logs.filter((l) => l.level === "warn").length;

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn("w-full rounded-2xl border border-theme-card bg-theme-elevated", className)}
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm text-theme-secondary transition-colors hover:text-theme-primary"
          aria-expanded={open}
        >
          <span className="flex items-center gap-2">
            <ScrollText className="h-4 w-4" />
            <span className="font-medium">Skanningslogg</span>
            <span className="text-xs text-theme-secondary/70">
              {logs.length} steg
              {errorCount > 0 && <span className="ml-1 text-red-300">· {errorCount} fel</span>}
              {warnCount > 0 && <span className="ml-1 text-amber-300">· {warnCount} varn.</span>}
            </span>
          </span>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="border-t border-theme-card px-2 pb-3 pt-2">
          <div className="mb-2 flex justify-end px-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-7 gap-1.5 text-xs text-theme-secondary hover:text-theme-primary"
            >
              <Clipboard className="h-3.5 w-3.5" />
              Kopiera logg
            </Button>
          </div>
          <ScrollArea className="max-h-60 w-full">
            <ol className="space-y-1.5 px-2 font-mono text-[11px] leading-snug">
              {enriched.map(({ entry, delta }) => (
                <li
                  key={entry.id}
                  className={cn(
                    "rounded-md border border-theme-card/60 bg-black/30 p-2",
                    levelClasses[entry.level],
                  )}
                >
                  <div className="flex items-start gap-2">
                    <LevelIcon level={entry.level} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[10px] text-theme-secondary/70">
                        <span>{formatTime(entry.timestamp)}</span>
                        {delta > 0 && <span>+{delta} ms</span>}
                        <span className="rounded bg-theme-card/60 px-1.5 py-0.5 uppercase tracking-wide text-theme-primary">
                          {stageLabel[entry.stage]}
                        </span>
                      </div>
                      <p className="mt-1 break-words text-xs">{entry.message}</p>
                      {entry.data && Object.keys(entry.data).length > 0 && (
                        <pre className="mt-1.5 overflow-x-auto rounded bg-black/40 p-1.5 text-[10px] text-theme-secondary/80">
                          {JSON.stringify(entry.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </ScrollArea>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default ScanLog;
