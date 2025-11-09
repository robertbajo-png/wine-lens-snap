/// <reference lib="webworker" />

import { readExifOrientation } from "../lib/exif";
import type { AutoCropOptions } from "../lib/autoCrop";
import type { PreprocessOptions } from "../lib/preprocess";

interface WorkerRequest {
  id: number;
  type: "fixOrientation" | "autoCrop" | "preprocess" | "pipeline";
  payload: any;
}

interface WorkerResponseBase {
  id: number;
}

interface WorkerProgressResponse extends WorkerResponseBase {
  done: false;
  progress: number;
  stage?: string;
  note?: string;
}

interface WorkerFinalResponse extends WorkerResponseBase {
  done: true;
  ok: boolean;
  data?: { base64: string; width: number; height: number };
  error?: string;
}

type WorkerResponse = WorkerProgressResponse | WorkerFinalResponse;

declare const self: DedicatedWorkerGlobalScope;

self.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  if (!message) return;
  handleMessage(message).catch((error) => {
    postFinal({ id: message.id, done: true, ok: false, error: error instanceof Error ? error.message : String(error) });
  });
});

async function handleMessage(message: WorkerRequest) {
  const { id, type, payload } = message;

  switch (type) {
    case "fixOrientation": {
      const result = await handleFixOrientation(payload?.dataUrl);
      postFinal({ id, done: true, ok: true, data: result });
      break;
    }
    case "autoCrop": {
      const result = await handleAutoCrop(payload?.dataUrl, payload?.options);
      postFinal({ id, done: true, ok: true, data: result });
      break;
    }
    case "preprocess": {
      const result = await handlePreprocess(payload?.dataUrl, payload?.options);
      postFinal({ id, done: true, ok: true, data: result });
      break;
    }
    case "pipeline": {
      const result = await handlePipeline(payload?.dataUrl, payload?.options, id);
      postFinal({ id, done: true, ok: true, data: result });
      break;
    }
    default:
      throw new Error(`Unknown worker task: ${type}`);
  }
}

function postProgress(message: WorkerProgressResponse) {
  self.postMessage(message);
}

function postFinal(message: WorkerFinalResponse) {
  self.postMessage(message);
}

async function handlePipeline(
  dataUrl: string,
  options: {
    autoCrop?: AutoCropOptions & { fallbackCropPct?: number };
    preprocess?: PreprocessOptions;
  } | undefined,
  id: number,
) {
  if (!dataUrl) throw new Error("Pipeline requires dataUrl");

  postProgress({ id, done: false, progress: 5, stage: "orientation", note: "Rättar orientering" });
  const decoded = await decodeSource(dataUrl);
  const oriented = await fixOrientation(decoded);

  postProgress({ id, done: false, progress: 35, stage: "crop", note: "Beskär etiketten" });
  const cropped = await autoCrop(oriented.canvas, options?.autoCrop, oriented.base64);

  postProgress({ id, done: false, progress: 70, stage: "preprocess", note: "Förbättrar kontrast" });
  const preprocessed = await preprocess(cropped.canvas, options?.preprocess);

  postProgress({ id, done: false, progress: 90, stage: "preprocess", note: "Finjusterar" });

  return preprocessed;
}

async function handleFixOrientation(dataUrl: string | undefined) {
  if (!dataUrl) throw new Error("Missing dataUrl");
  const decoded = await decodeSource(dataUrl);
  const oriented = await fixOrientation(decoded);
  return oriented;
}

async function handleAutoCrop(
  dataUrl: string | undefined,
  options?: AutoCropOptions & { fallbackCropPct?: number },
) {
  if (!dataUrl) throw new Error("Missing dataUrl");
  const decoded = await decodeSource(dataUrl);
  const oriented = await fixOrientation(decoded);
  const cropped = await autoCrop(oriented.canvas, options, oriented.base64);
  return cropped;
}

async function handlePreprocess(dataUrl: string | undefined, options?: PreprocessOptions) {
  if (!dataUrl) throw new Error("Missing dataUrl");
  const decoded = await decodeSource(dataUrl);
  const oriented = await fixOrientation(decoded);
  const processed = await preprocess(oriented.canvas, options);
  return processed;
}

interface DecodedSource {
  bitmap: ImageBitmap;
  buffer: ArrayBuffer;
}

async function decodeSource(dataUrl: string): Promise<DecodedSource> {
  const blob = await dataUrlToBlob(dataUrl);
  const buffer = await blob.arrayBuffer();
  const bitmap = await createImageBitmap(blob);
  return { bitmap, buffer };
}

interface CanvasResult {
  canvas: OffscreenCanvas;
  base64: string;
  width: number;
  height: number;
}

async function fixOrientation(source: DecodedSource): Promise<CanvasResult> {
  const orientation = readExifOrientation(source.buffer) ?? 1;
  const swap = orientation >= 5 && orientation <= 8;
  const width = swap ? source.bitmap.height : source.bitmap.width;
  const height = swap ? source.bitmap.width : source.bitmap.height;

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Failed to acquire canvas context");

  applyOrientationTransform(ctx, orientation, source.bitmap.width, source.bitmap.height);
  ctx.drawImage(source.bitmap, 0, 0);
  source.bitmap.close();

  const base64 = await canvasToDataUrl(canvas, 0.95);

  return { canvas, base64, width: canvas.width, height: canvas.height };
}

async function autoCrop(
  canvas: OffscreenCanvas,
  options: (AutoCropOptions & { fallbackCropPct?: number }) | undefined,
  fallbackBase64: string,
): Promise<CanvasResult> {
  const {
    downscaleMax = 800,
    edgeThreshold = 28,
    minFillRatio = 0.035,
    paddingRatio = 0.06,
    fallbackCropPct = 0.1,
  } = options || {};

  const scaled = fit(canvas.width, canvas.height, downscaleMax);
  const analysisCanvas = new OffscreenCanvas(scaled.w, scaled.h);
  const analysisCtx = analysisCanvas.getContext("2d", { alpha: false });
  if (!analysisCtx) throw new Error("Failed to acquire analysis context");

  analysisCtx.drawImage(canvas, 0, 0, scaled.w, scaled.h);
  const { data } = analysisCtx.getImageData(0, 0, scaled.w, scaled.h);
  const gray = toGray(data);
  const edges = edgeMap(gray, scaled.w, scaled.h);
  const bbox = findDenseBox(edges, scaled.w, scaled.h, edgeThreshold, minFillRatio);

  let cropX = 0;
  let cropY = 0;
  let cropW = canvas.width;
  let cropH = canvas.height;

  if (bbox) {
    const scaleX = canvas.width / scaled.w;
    const scaleY = canvas.height / scaled.h;
    cropX = Math.floor(bbox.x * scaleX);
    cropY = Math.floor(bbox.y * scaleY);
    cropW = Math.ceil(bbox.w * scaleX);
    cropH = Math.ceil(bbox.h * scaleY);
    const pad = Math.round(Math.max(cropW, cropH) * paddingRatio);
    cropX = Math.max(0, cropX - pad);
    cropY = Math.max(0, cropY - pad);
    cropW = Math.min(canvas.width - cropX, cropW + pad * 2);
    cropH = Math.min(canvas.height - cropY, cropH + pad * 2);
  } else if (fallbackCropPct > 0) {
    const marginX = Math.round(canvas.width * fallbackCropPct);
    const marginY = Math.round(canvas.height * fallbackCropPct);
    cropX = marginX;
    cropY = marginY;
    cropW = Math.max(1, canvas.width - marginX * 2);
    cropH = Math.max(1, canvas.height - marginY * 2);
  }

  if (cropW !== canvas.width || cropH !== canvas.height || cropX !== 0 || cropY !== 0) {
    const cropCanvas = new OffscreenCanvas(cropW, cropH);
    const cropCtx = cropCanvas.getContext("2d", { alpha: false });
    if (!cropCtx) throw new Error("Failed to acquire crop context");
    cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    const base64 = await canvasToDataUrl(cropCanvas, 0.9);
    return { canvas: cropCanvas, base64, width: cropW, height: cropH };
  }

  // No crop applied; reuse original orientation canvas/base64 to avoid re-encoding.
  return { canvas, base64: fallbackBase64, width: canvas.width, height: canvas.height };
}

async function preprocess(
  canvas: OffscreenCanvas,
  options: PreprocessOptions | undefined,
): Promise<CanvasResult> {
  const {
    maxSide = 1200,
    quality = 0.68,
    grayscale = true,
    contrast = 1.12,
  } = options || {};

  const target = fit(canvas.width, canvas.height, maxSide);
  const output = new OffscreenCanvas(target.w, target.h);
  const ctx = output.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Failed to acquire preprocess context");

  ctx.drawImage(canvas, 0, 0, target.w, target.h);

  if (grayscale || contrast !== 1) {
    const imgData = ctx.getImageData(0, 0, target.w, target.h);
    const data = imgData.data;
    const c = contrast;
    const intercept = 128 * (1 - c);

    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      const r = grayscale ? gray : data[i];
      const g = grayscale ? gray : data[i + 1];
      const b = grayscale ? gray : data[i + 2];
      data[i] = clamp255(r * c + intercept);
      data[i + 1] = clamp255(g * c + intercept);
      data[i + 2] = clamp255(b * c + intercept);
    }

    ctx.putImageData(imgData, 0, 0);
  }

  const base64 = await canvasToDataUrl(output, quality);
  return { canvas: output, base64, width: target.w, height: target.h };
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  if (!response.ok) throw new Error("Failed to fetch data URL");
  return await response.blob();
}

async function canvasToDataUrl(canvas: OffscreenCanvas, quality = 0.92): Promise<string> {
  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
  const buffer = await blob.arrayBuffer();
  return `data:image/jpeg;base64,${arrayBufferToBase64(buffer)}`;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, i + chunk);
    parts.push(String.fromCharCode(...sub));
  }
  return btoa(parts.join(""));
}

function applyOrientationTransform(
  ctx: OffscreenCanvasRenderingContext2D,
  orientation: number,
  width: number,
  height: number,
) {
  switch (orientation) {
    case 2:
      ctx.transform(-1, 0, 0, 1, width, 0);
      break;
    case 3:
      ctx.transform(-1, 0, 0, -1, width, height);
      break;
    case 4:
      ctx.transform(1, 0, 0, -1, 0, height);
      break;
    case 5:
      ctx.transform(0, 1, 1, 0, 0, 0);
      break;
    case 6:
      ctx.transform(0, 1, -1, 0, height, 0);
      break;
    case 7:
      ctx.transform(0, -1, -1, 0, height, width);
      break;
    case 8:
      ctx.transform(0, -1, 1, 0, 0, width);
      break;
    default:
      break;
  }
}

function fit(w: number, h: number, maxSide: number) {
  if (Math.max(w, h) <= maxSide) return { w, h };
  const s = maxSide / Math.max(w, h);
  return { w: Math.round(w * s), h: Math.round(h * s) };
}

function toGray(rgba: Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba.length / 4);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
    out[j] = Math.round(rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114);
  }
  return out;
}

function edgeMap(gray: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(gray.length);
  const idx = (x: number, y: number) => y * w + x;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const tl = gray[idx(x - 1, y - 1)];
      const tc = gray[idx(x, y - 1)];
      const tr = gray[idx(x + 1, y - 1)];
      const ml = gray[idx(x - 1, y)];
      const mr = gray[idx(x + 1, y)];
      const bl = gray[idx(x - 1, y + 1)];
      const bc = gray[idx(x, y + 1)];
      const br = gray[idx(x + 1, y + 1)];
      const gx = -tl - 2 * ml - bl + tr + 2 * mr + br;
      const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
      const mag = Math.min(255, Math.abs(gx) + Math.abs(gy));
      out[idx(x, y)] = mag;
    }
  }
  return out;
}

function findDenseBox(
  edges: Uint8ClampedArray,
  w: number,
  h: number,
  thr: number,
  minFillRatio: number,
) {
  const sizes = [
    { rw: 0.85, rh: 0.45 },
    { rw: 0.7, rh: 0.5 },
    { rw: 0.6, rh: 0.6 },
  ];

  let best = { score: 0, x: 0, y: 0, w: 0, h: 0 };

  for (const size of sizes) {
    const bw = Math.round(w * size.rw);
    const bh = Math.round(h * size.rh);
    const stepX = Math.max(8, Math.round(w * 0.05));
    const stepY = Math.max(8, Math.round(h * 0.05));

    for (let y0 = 0; y0 + bh <= h; y0 += stepY) {
      for (let x0 = 0; x0 + bw <= w; x0 += stepX) {
        let cnt = 0;
        for (let y1 = y0; y1 < y0 + bh; y1 += 2) {
          const row = y1 * w;
          for (let x1 = x0; x1 < x0 + bw; x1 += 2) {
            if (edges[row + x1] >= thr) cnt++;
          }
        }
        const area = Math.ceil(bw / 2) * Math.ceil(bh / 2);
        const fill = cnt / Math.max(1, area);
        const score = Math.round(fill * 1000);
        if (fill >= minFillRatio && score > best.score) {
          best = { score, x: x0, y: y0, w: bw, h: bh };
        }
      }
    }
  }

  if (best.score === 0) return null;
  return { x: best.x, y: best.y, w: best.w, h: best.h };
}

function clamp255(value: number) {
  if (value < 0) return 0;
  if (value > 255) return 255;
  return value;
}
