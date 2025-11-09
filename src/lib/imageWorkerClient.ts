import type { AutoCropOptions } from "./autoCrop";
import type { PreprocessOptions } from "./preprocess";

type WorkerTaskType = "fixOrientation" | "autoCrop" | "preprocess" | "pipeline";

type WorkerPayloads = {
  fixOrientation: { dataUrl: string };
  autoCrop: { dataUrl: string; options?: AutoCropOptions & { fallbackCropPct?: number } };
  preprocess: { dataUrl: string; options?: PreprocessOptions };
  pipeline: {
    dataUrl: string;
    options?: {
      autoCrop?: AutoCropOptions & { fallbackCropPct?: number };
      preprocess?: PreprocessOptions;
    };
  };
};

export interface ImageWorkerResult {
  base64: string;
  width: number;
  height: number;
}

export interface ImageWorkerProgress {
  progress: number;
  stage?: string;
  note?: string;
}

type WorkerResponse =
  | ({ id: number; done: false } & ImageWorkerProgress)
  | ({ id: number; done: true; ok: boolean; data?: ImageWorkerResult; error?: string });

type PendingTask = {
  resolve: (value: ImageWorkerResult) => void;
  reject: (reason: Error) => void;
  onProgress?: (update: ImageWorkerProgress) => void;
};

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, PendingTask>();

function ensureWorker() {
  if (typeof window === "undefined") {
    throw new Error("Image worker is only available in the browser");
  }
  if (worker) return worker;
  worker = new Worker(new URL("../workers/imageWorker.ts", import.meta.url), { type: "module" });
  worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
    const message = event.data;
    if (!message) return;
    const entry = pending.get((message as any).id);
    if (!entry) return;

    if (!("done" in message)) return;

    if (message.done === false) {
      entry.onProgress?.({ progress: clampProgress(message.progress), stage: message.stage, note: message.note });
      return;
    }

    pending.delete(message.id);

    if (!message.ok) {
      const error = new Error(message.error || "Image worker failed");
      entry.reject(error);
      return;
    }

    if (!message.data) {
      entry.reject(new Error("Image worker returned no data"));
      return;
    }

    entry.resolve(message.data);
  });
  return worker;
}

function clampProgress(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

async function callWorker<T extends WorkerTaskType>(
  type: T,
  payload: WorkerPayloads[T],
  onProgress?: (update: ImageWorkerProgress) => void,
): Promise<ImageWorkerResult> {
  const instance = ensureWorker();
  return new Promise<ImageWorkerResult>((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject, onProgress });
    instance.postMessage({ id, type, payload });
  });
}

export function terminateImageWorker() {
  worker?.terminate();
  worker = null;
  pending.clear();
}

export function runFixOrientation(
  dataUrl: string,
  onProgress?: (update: ImageWorkerProgress) => void,
) {
  return callWorker("fixOrientation", { dataUrl }, onProgress);
}

export function runAutoCrop(
  dataUrl: string,
  options?: AutoCropOptions & { fallbackCropPct?: number },
  onProgress?: (update: ImageWorkerProgress) => void,
) {
  return callWorker("autoCrop", { dataUrl, options }, onProgress);
}

export function runPreprocess(
  dataUrl: string,
  options?: PreprocessOptions,
  onProgress?: (update: ImageWorkerProgress) => void,
) {
  return callWorker("preprocess", { dataUrl, options }, onProgress);
}

export interface PipelineOptions {
  autoCrop?: AutoCropOptions & { fallbackCropPct?: number };
  preprocess?: PreprocessOptions;
}

export function runImagePipeline(
  dataUrl: string,
  options?: PipelineOptions,
  onProgress?: (update: ImageWorkerProgress) => void,
) {
  return callWorker("pipeline", { dataUrl, options }, onProgress);
}
