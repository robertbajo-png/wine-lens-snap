import { useCallback, useRef, useState } from "react";
import type { WineAnalysisResult } from "@/lib/wineCache";
import {
  ANALYSIS_TIMEOUT_MS,
  runFullScanPipeline,
  terminateScanWorker,
  type PipelineSource,
  type ProgressKey,
  type ScanLogEntry,
  type ScanPipelineProgress,
  type ScanPipelineResult,
  type ScanStatus,
} from "@/services/scanPipelineService";

export type StartScanOptions = {
  source: PipelineSource;
  uiLang: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  allowFullAnalysis?: boolean;
};

export type ScanPipelineState = {
  results: WineAnalysisResult | null;
  scanStatus: ScanStatus;
  isProcessing: boolean;
  progressStep: ProgressKey;
  progressNote: string | null;
  progressPercent: number | null;
  progressLabel: string | null;
  currentCacheKey: string | null;
  currentOcrText: string | null;
  remoteScanId: string | null;
  error: string | null;
  logs: ScanLogEntry[];
};

let logIdCounter = 0;
const nextLogId = () => {
  logIdCounter += 1;
  return `log-${Date.now()}-${logIdCounter}`;
};

export const useScanPipeline = () => {
  const [results, setResults] = useState<WineAnalysisResult | null>(null);
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStep, setProgressStep] = useState<ProgressKey>(null);
  const [progressNote, setProgressNote] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState<number | null>(null);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [currentCacheKey, setCurrentCacheKey] = useState<string | null>(null);
  const [currentOcrText, setCurrentOcrText] = useState<string | null>(null);
  const [remoteScanId, setRemoteScanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<ScanLogEntry[]>([]);
  const scanStartTimeRef = useRef<number | null>(null);
  const lastResponseTimeRef = useRef<number | undefined>(undefined);

  const getResponseTimeMs = useCallback(() => {
    if (scanStartTimeRef.current === null) {
      return lastResponseTimeRef.current;
    }

    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const elapsed = Math.round(now - scanStartTimeRef.current);
    return elapsed >= 0 ? elapsed : undefined;
  }, []);

  const appendLog = useCallback((entry: Omit<ScanLogEntry, "id" | "timestamp">) => {
    const fullEntry: ScanLogEntry = {
      ...entry,
      id: nextLogId(),
      timestamp: Date.now(),
    };
    setLogs((prev) => [...prev, fullEntry]);
  }, []);

  const reset = useCallback(() => {
    setResults(null);
    setScanStatus("idle");
    setIsProcessing(false);
    setProgressStep(null);
    setProgressNote(null);
    setProgressPercent(null);
    setProgressLabel(null);
    setCurrentCacheKey(null);
    setCurrentOcrText(null);
    setRemoteScanId(null);
    setError(null);
    setLogs([]);
  }, []);

  const startScan = useCallback(
    async ({ source, uiLang, supabaseUrl, supabaseAnonKey, allowFullAnalysis = true }: StartScanOptions) => {
      scanStartTimeRef.current = typeof performance !== "undefined" ? performance.now() : Date.now();
      setLogs([]);
      setScanStatus("processing");
      setIsProcessing(true);
      setError(null);
      setProgressStep("prep");
      setProgressNote("Komprimerar bilden (max 2048px, 90% JPG)…");
      setProgressPercent(5);
      setProgressLabel("Förbereder…");
      appendLog({
        stage: "pipeline",
        level: "info",
        message: "Skanning startad",
        data: { allowFullAnalysis, uiLang },
      });

      try {
        const pipelineResult = await runFullScanPipeline({
          source,
          uiLang,
          supabaseUrl,
          supabaseAnonKey,
          allowFullAnalysis,
          onProgress: (progress: ScanPipelineProgress) => {
            setProgressStep(progress.step);
            setProgressPercent(progress.percent);
            setProgressLabel(progress.label);
            setProgressNote(progress.note);
          },
          onLogEvent: appendLog,
        });

        setResults(pipelineResult.result);
        setCurrentCacheKey(pipelineResult.cacheKey);
        setCurrentOcrText(pipelineResult.rawOcrValue ?? pipelineResult.cacheLookupKey);
        setRemoteScanId(pipelineResult.remoteScanId ?? null);
        setScanStatus("success");
        setProgressStep("done");
        setProgressLabel("Analysen klar");
        setProgressPercent(100);
        appendLog({
          stage: "pipeline",
          level: "info",
          message: `Skanning klar (${pipelineResult.fromCache ? "cache" : pipelineResult.analysisMode})`,
          data: {
            fromCache: pipelineResult.fromCache,
            analysisMode: pipelineResult.analysisMode,
            responseTimeMs: getResponseTimeMs(),
          },
        });

        return { ...pipelineResult, responseTimeMs: getResponseTimeMs() } as ScanPipelineResult & {
          responseTimeMs?: number;
        };
      } catch (err) {
        setScanStatus("error");
        setProgressStep("error");
        setProgressLabel("Skanning misslyckades");
        setError(err instanceof Error ? err.message : "Kunde inte analysera bilden – försök igen i bättre ljus.");
        appendLog({
          stage: "pipeline",
          level: "error",
          message: err instanceof Error ? err.message : "Skanning misslyckades",
          data: { responseTimeMs: getResponseTimeMs() },
        });
        throw err;
      } finally {
        lastResponseTimeRef.current = getResponseTimeMs();
        setIsProcessing(false);
        scanStartTimeRef.current = null;
      }
    },
    [appendLog, getResponseTimeMs],
  );

  return {
    state: {
      results,
      scanStatus,
      isProcessing,
      progressStep,
      progressNote,
      progressPercent,
      progressLabel,
      currentCacheKey,
      currentOcrText,
      remoteScanId,
      error,
      logs,
    } satisfies ScanPipelineState,
    startScan,
    reset,
    setResults,
    setCurrentCacheKey,
    setCurrentOcrText,
    setRemoteScanId,
    setProgressNote,
    setProgressLabel,
    setProgressPercent,
    setProgressStep,
    setScanStatus,
    setIsProcessing,
    appendLog,
    terminateWorker: terminateScanWorker,
    responseTimeoutMs: ANALYSIS_TIMEOUT_MS,
    getResponseTimeMs,
  };
};
