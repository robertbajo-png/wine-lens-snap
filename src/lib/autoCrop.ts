import { runAutoCrop } from "./imageWorkerClient";

export interface AutoCropOptions {
  downscaleMax?: number;
  edgeThreshold?: number;
  minFillRatio?: number;
  paddingRatio?: number;
  fallbackCropPct?: number;
}

export async function autoCropLabel(dataUrl: string, opts: AutoCropOptions = {}): Promise<string> {
  if (typeof window === "undefined") return dataUrl;
  const { base64 } = await runAutoCrop(dataUrl, opts);
  return base64;
}
