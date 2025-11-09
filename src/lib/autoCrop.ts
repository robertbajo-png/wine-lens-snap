import { runPipelineOnMain, type PipelineOptions } from "./imagePipelineCore";

export interface AutoCropOptions {
  downscaleMax?: number;
  edgeThreshold?: number;
  minFillRatio?: number;
  paddingRatio?: number;
  fallbackCropPct?: number;
}

export async function autoCropLabel(dataUrl: string, opts: AutoCropOptions = {}): Promise<string> {
  if (typeof window === "undefined") return dataUrl;
  const options: PipelineOptions = {
    autoCrop: { ...opts },
    preprocess: null,
  };
  const { base64 } = await runPipelineOnMain(dataUrl, options);
  return base64;
}
