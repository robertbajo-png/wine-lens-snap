import { runPipelineOnMain, type PipelineOptions } from "./imagePipelineCore";

/**
 * Canvas-based image preprocessing utilities tailored for OCR.
 */

export interface PreprocessOptions {
  maxSide?: number;
  quality?: number;
  grayscale?: boolean;
  contrast?: number;
}

/**
 * Preprocesses an image by resizing, optionally grayscaling, and adjusting contrast.
 * Returns a JPEG data URL optimised for OCR ingestion.
 */
export async function preprocessImage(
  dataUrl: string,
  opts: PreprocessOptions = {},
): Promise<string> {
  if (typeof window === "undefined") return dataUrl;
  const options: PipelineOptions = {
    autoCrop: null,
    preprocess: { ...opts },
  };
  const { base64 } = await runPipelineOnMain(dataUrl, options);
  return base64;
}

export async function fixOrientation(imageData: string): Promise<string> {
  if (typeof window === "undefined") return imageData;
  const options: PipelineOptions = { autoCrop: null, preprocess: null };
  const { base64 } = await runPipelineOnMain(imageData, options);
  return base64;
}
