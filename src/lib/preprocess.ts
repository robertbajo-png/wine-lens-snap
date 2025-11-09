import { runFixOrientation, runPreprocess } from "./imageWorkerClient";

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
  const { base64 } = await runPreprocess(dataUrl, opts);
  return base64;
}

export async function fixOrientation(imageData: string): Promise<string> {
  if (typeof window === "undefined") return imageData;
  const { base64 } = await runFixOrientation(imageData);
  return base64;
}
