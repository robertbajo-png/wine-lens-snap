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
  opts: PreprocessOptions = {}
): Promise<string> {
  const {
    maxSide = 1200,
    quality = 0.68,
    grayscale = true,
    contrast = 1.12
  } = opts;

  const oriented = await fixOrientation(dataUrl);
  const img = await loadImage(oriented);
  const { w, h } = fit(img.width, img.height, maxSide);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Failed to acquire 2D context");

  ctx.drawImage(img, 0, 0, w, h);

  if (grayscale || contrast !== 1) {
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const c = contrast;
    const intercept = 128 * (1 - c);

    for (let i = 0; i < data.length; i += 4) {
      const gray =
        data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      const r = grayscale ? gray : data[i];
      const g = grayscale ? gray : data[i + 1];
      const b = grayscale ? gray : data[i + 2];
      data[i] = clamp255(r * c + intercept);
      data[i + 1] = clamp255(g * c + intercept);
      data[i + 2] = clamp255(b * c + intercept);
    }

    ctx.putImageData(imgData, 0, 0);
  }

  return canvas.toDataURL("image/jpeg", quality);
}

export async function fixOrientation(imageData: string): Promise<string> {
  // Modern browsers handle EXIF orientation for data URLs automatically.
  return imageData;
}

function clamp255(value: number) {
  if (value < 0) return 0;
  if (value > 255) return 255;
  return value;
}

function fit(w: number, h: number, maxSide: number) {
  if (Math.max(w, h) <= maxSide) return { w, h };
  const scale = maxSide / Math.max(w, h);
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img as HTMLImageElement);
    img.onerror = reject;
    img.src = dataUrl;
  });
}
