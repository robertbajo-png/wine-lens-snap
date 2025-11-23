import { readExifOrientation } from "./exif";
import type { AutoCropOptions } from "./autoCrop";
import type { PreprocessOptions } from "./preprocess";

export interface PipelineOptions {
  autoCrop?: (AutoCropOptions & { fallbackCropPct?: number }) | null;
  preprocess?: PreprocessOptions | null;
}

export interface PipelineProgress {
  value: number;
  stage?: string;
  note?: string;
}

export interface PipelineResult {
  base64: string;
  width: number;
  height: number;
  bitmap?: ImageBitmap;
}

export interface PipelineEnvironment {
  createCanvas: (width: number, height: number) => CanvasLike;
  exportCanvas: (canvas: CanvasLike, quality: number) => Promise<CanvasExportResult>;
  createImageBitmapFromCanvas: (
    canvas: CanvasLike,
    exported?: CanvasExportResult,
  ) => Promise<ImageBitmap>;
}

export interface CanvasExportResult {
  dataUrl: string;
  blob: Blob;
}

type CanvasLike = OffscreenCanvas | HTMLCanvasElement;
type CanvasCtx = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

let offscreenSupport: boolean | null = null;

export function supportsOffscreenCanvas() {
  if (offscreenSupport !== null) {
    return offscreenSupport;
  }

  offscreenSupport = false;

  if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") {
    return offscreenSupport;
  }

  try {
    const canvas = new OffscreenCanvas(1, 1);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return offscreenSupport;
    }

    if (typeof canvas.convertToBlob !== "function" || typeof canvas.transferToImageBitmap !== "function") {
      return offscreenSupport;
    }

    const bitmap = canvas.transferToImageBitmap();
    bitmap.close();

    offscreenSupport = true;
  } catch (error) {
    offscreenSupport = false;
  }

  return offscreenSupport;
}

export async function runPipelineWithEnv(
  source: { bitmap: ImageBitmap; buffer?: ArrayBuffer; orientation?: number },
  options: PipelineOptions | undefined,
  env: PipelineEnvironment,
  onProgress?: (progress: PipelineProgress) => void,
): Promise<PipelineResult> {
  const orientation =
    typeof source.orientation === "number"
      ? source.orientation || 1
      : source.buffer
      ? readExifOrientation(source.buffer) ?? 1
      : 1;

  onProgress?.({ value: 20, stage: "orientation", note: "Rättar orientering" });
  const oriented = await fixOrientation(source.bitmap, orientation, env);

  onProgress?.({ value: 35, stage: "crop", note: "Beskär etiketten" });
  const cropped =
    options?.autoCrop === null
      ? oriented
      : await autoCrop(oriented, options?.autoCrop ?? undefined, env);

  onProgress?.({ value: 60, stage: "preprocess", note: "Förbehandlar" });
  const preprocessed =
    options?.preprocess === null
      ? await exportOriginal(cropped, env)
      : await preprocess(cropped, options?.preprocess ?? undefined, env);

  onProgress?.({ value: 80, stage: "encode", note: "Förbereder resultat" });
  const bitmap = await env.createImageBitmapFromCanvas(preprocessed.canvas, preprocessed.exported);

  onProgress?.({ value: 100, stage: "done", note: "Klart" });
  return {
    base64: preprocessed.exported.dataUrl,
    width: preprocessed.width,
    height: preprocessed.height,
    bitmap,
  };
}

export async function runPipelineOnMain(
  dataUrl: string,
  options: PipelineOptions | undefined,
  onProgress?: (progress: PipelineProgress) => void,
): Promise<PipelineResult> {
  const response = await fetch(dataUrl);
  if (!response.ok) {
    throw new Error("Kunde inte läsa bilddata");
  }
  const blob = await response.blob();
  const buffer = await blob.arrayBuffer();
  const bitmap = await createImageBitmap(blob);

  const env = createDomPipelineEnvironment();
  const result = await runPipelineWithEnv({ bitmap, buffer }, options, env, onProgress);
  // runPipelineWithEnv stänger bitmap genom fixOrientation, så endast resultatets bitmap används
  return result;
}

export function createWorkerPipelineEnvironment(): PipelineEnvironment {
  return {
    createCanvas(width, height) {
      return new OffscreenCanvas(width, height);
    },
    async exportCanvas(canvas, quality) {
      const offscreen = canvas as OffscreenCanvas;
      const blob = await offscreen.convertToBlob({ type: "image/jpeg", quality });
      const dataUrl = await blobToDataUrl(blob);
      return { dataUrl, blob };
    },
    async createImageBitmapFromCanvas(canvas, exported) {
      // Använd redan exporterad blob om den finns för att undvika OffscreenCanvas-referenser
      if (exported) {
        return await createImageBitmap(exported.blob);
      }
      // Konvertera OffscreenCanvas till blob först, sedan till ImageBitmap
      // Detta bryter referensen till OffscreenCanvas och förhindrar postMessage-fel
      const offscreen = canvas as OffscreenCanvas;
      const blob = await offscreen.convertToBlob({ type: "image/jpeg", quality: 0.92 });
      return await createImageBitmap(blob);
    },
  };
}

export function createDomPipelineEnvironment(): PipelineEnvironment {
  return {
    createCanvas(width, height) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      return canvas;
    },
    async exportCanvas(canvas, quality) {
      const html = canvas as HTMLCanvasElement;
      const blob = await canvasToBlob(html, quality);
      const dataUrl = await blobToDataUrl(blob);
      return { dataUrl, blob };
    },
    async createImageBitmapFromCanvas(canvas, exported) {
      if (typeof createImageBitmap !== "function") {
        throw new Error("createImageBitmap saknas i denna miljö");
      }
      if (exported) {
        return await createImageBitmap(exported.blob);
      }
      const html = canvas as HTMLCanvasElement;
      const blob = await canvasToBlob(html, 0.92);
      return await createImageBitmap(blob);
    },
  };
}

async function fixOrientation(
  bitmap: ImageBitmap,
  orientation: number,
  env: PipelineEnvironment,
): Promise<CanvasLike> {
  const swap = orientation >= 5 && orientation <= 8;
  const width = swap ? bitmap.height : bitmap.width;
  const height = swap ? bitmap.width : bitmap.height;

  const canvas = env.createCanvas(width, height);
  const ctx = getContext2D(canvas);

  applyOrientationTransform(ctx, orientation, bitmap.width, bitmap.height);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  return canvas;
}

async function autoCrop(
  canvas: CanvasLike,
  options: (AutoCropOptions & { fallbackCropPct?: number }) | undefined,
  env: PipelineEnvironment,
): Promise<CanvasLike> {
  const {
    downscaleMax = 800,
    edgeThreshold = 28,
    minFillRatio = 0.035,
    paddingRatio = 0.06,
    fallbackCropPct = 0.1,
  } = options || {};

  const scaled = fit(canvas.width, canvas.height, downscaleMax);
  const analysisCanvas = env.createCanvas(scaled.w, scaled.h);
  const analysisCtx = getContext2D(analysisCanvas);

  analysisCtx.drawImage(canvas, 0, 0, scaled.w, scaled.h);
  const { data } = analysisCtx.getImageData(0, 0, scaled.w, scaled.h);
  const gray = toGray(data);
  const edges = edgeMap(gray, scaled.w, scaled.h);
  const bbox = findDenseBox(edges, scaled.w, scaled.h, edgeThreshold, minFillRatio);

  if (!bbox && fallbackCropPct <= 0) {
    return canvas;
  }

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
  } else {
    const marginX = Math.round(canvas.width * fallbackCropPct);
    const marginY = Math.round(canvas.height * fallbackCropPct);
    cropX = marginX;
    cropY = marginY;
    cropW = Math.max(1, canvas.width - marginX * 2);
    cropH = Math.max(1, canvas.height - marginY * 2);
  }

  if (cropW === canvas.width && cropH === canvas.height && cropX === 0 && cropY === 0) {
    return canvas;
  }

  const cropCanvas = env.createCanvas(cropW, cropH);
  const cropCtx = getContext2D(cropCanvas);
  cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  return cropCanvas;
}

async function exportOriginal(
  canvas: CanvasLike,
  env: PipelineEnvironment,
): Promise<{ canvas: CanvasLike; exported: CanvasExportResult; width: number; height: number }> {
  const exported = await env.exportCanvas(canvas, 0.92);
  return { canvas, exported, width: canvas.width, height: canvas.height };
}

async function preprocess(
  canvas: CanvasLike,
  options: PreprocessOptions | undefined,
  env: PipelineEnvironment,
): Promise<{ canvas: CanvasLike; exported: CanvasExportResult; width: number; height: number }> {
  const {
    maxSide = 2048,
    quality = 0.9,
    grayscale = true,
    contrast = 1.12,
  } = options || {};

  const target = fit(canvas.width, canvas.height, maxSide);
  const output = env.createCanvas(target.w, target.h);
  const ctx = getContext2D(output);

  ctx.drawImage(canvas, 0, 0, target.w, target.h);

  if (grayscale || contrast !== 1) {
    const imgData = ctx.getImageData(0, 0, target.w, target.h);
    const data = imgData.data;
    const intercept = 128 * (1 - contrast);

    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      const r = grayscale ? gray : data[i];
      const g = grayscale ? gray : data[i + 1];
      const b = grayscale ? gray : data[i + 2];
      data[i] = clamp255(r * contrast + intercept);
      data[i + 1] = clamp255(g * contrast + intercept);
      data[i + 2] = clamp255(b * contrast + intercept);
    }

    ctx.putImageData(imgData, 0, 0);
  }

  const exported = await env.exportCanvas(output, quality);
  return { canvas: output, exported, width: target.w, height: target.h };
}

function getContext2D(canvas: CanvasLike): CanvasCtx {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    throw new Error("Misslyckades med att läsa 2D-context");
  }
  return ctx as CanvasCtx;
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

function applyOrientationTransform(
  ctx: CanvasCtx,
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

async function blobToDataUrl(blob: Blob) {
  const buffer = await blob.arrayBuffer();
  return `data:image/jpeg;base64,${arrayBufferToBase64(buffer)}`;
}

async function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Kunde inte konvertera canvas till blob"));
        }
      },
      "image/jpeg",
      quality,
    );
  });
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
