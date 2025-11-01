export interface AutoCropOptions {
  downscaleMax?: number;
  edgeThreshold?: number;
  minFillRatio?: number;
  paddingRatio?: number;
}

export async function autoCropLabel(dataUrl: string, opts: AutoCropOptions = {}): Promise<string> {
  if (typeof window === "undefined") return dataUrl;
  const {
    downscaleMax = 800,
    edgeThreshold = 28,
    minFillRatio = 0.035,
    paddingRatio = 0.06,
  } = opts;

  const img = await loadImage(dataUrl);
  const { w: scaledW, h: scaledH } = fit(img.width, img.height, downscaleMax);
  const analysisCanvas = document.createElement("canvas");
  analysisCanvas.width = scaledW;
  analysisCanvas.height = scaledH;
  const analysisCtx = analysisCanvas.getContext("2d", { alpha: false });
  if (!analysisCtx) return dataUrl;

  analysisCtx.drawImage(img, 0, 0, scaledW, scaledH);
  const { data } = analysisCtx.getImageData(0, 0, scaledW, scaledH);
  const gray = toGray(data);
  const edges = edgeMap(gray, scaledW, scaledH);
  const bbox = findDenseBox(edges, scaledW, scaledH, edgeThreshold, minFillRatio);
  if (!bbox) return dataUrl;

  const scaleX = img.width / scaledW;
  const scaleY = img.height / scaledH;
  let x = Math.floor(bbox.x * scaleX);
  let y = Math.floor(bbox.y * scaleY);
  let w = Math.ceil(bbox.w * scaleX);
  let h = Math.ceil(bbox.h * scaleY);

  const pad = Math.round(Math.max(w, h) * paddingRatio);
  x = Math.max(0, x - pad);
  y = Math.max(0, y - pad);
  w = Math.min(img.width - x, w + pad * 2);
  h = Math.min(img.height - y, h + pad * 2);

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = w;
  outputCanvas.height = h;
  const outputCtx = outputCanvas.getContext("2d", { alpha: false });
  if (!outputCtx) return dataUrl;

  outputCtx.drawImage(img, x, y, w, h, 0, 0, w, h);
  return outputCanvas.toDataURL("image/jpeg", 0.9);
}

function toGray(rgba: Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba.length / 4);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
    out[j] = Math.round(
      rgba[i] * 0.299 +
      rgba[i + 1] * 0.587 +
      rgba[i + 2] * 0.114,
    );
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

function fit(w: number, h: number, maxSide: number) {
  if (Math.max(w, h) <= maxSide) return { w, h };
  const s = maxSide / Math.max(w, h);
  return { w: Math.round(w * s), h: Math.round(h * s) };
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img as HTMLImageElement);
    img.onerror = reject;
    img.src = dataUrl;
  });
}
