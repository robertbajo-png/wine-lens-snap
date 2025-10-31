// Singleton Tesseract worker med EU-språk och förladdning.
// Kräver tesseract.js installerad i projektet.

import { createWorker } from "tesseract.js";

// Kärnspråk för EU-vinetiketter. Kan utökas vid behov.
export const OCR_LANGS = [
  "eng", // English
  "swe", // Swedish
  "fra", // French
  "ita", // Italian
  "spa", // Spanish
  "deu", // German
  "por", // Portuguese
  "nld", // Dutch
  "hun", // Hungarian
  "pol"  // Polish
] as const;
export type OcrLang = typeof OCR_LANGS[number];

function mapUiToTess(uiLang: string): OcrLang {
  const l = (uiLang || "sv-SE").toLowerCase();
  if (l.startsWith("sv")) return "swe";
  if (l.startsWith("fr")) return "fra";
  if (l.startsWith("it")) return "ita";
  if (l.startsWith("es")) return "spa";
  if (l.startsWith("de")) return "deu";
  if (l.startsWith("pt")) return "por";
  if (l.startsWith("nl")) return "nld";
  if (l.startsWith("hu")) return "hun";
  if (l.startsWith("pl")) return "pol";
  return "eng";
}

let workerPromise: Promise<import("tesseract.js").Worker> | null = null;
let currentLang: OcrLang | null = null;

async function getWorker(lang: OcrLang) {
  if (!workerPromise) {
    workerPromise = createWorker();
  }
  const worker = await workerPromise;
  // Ladda språk endast om nytt
  if (currentLang !== lang) {
    // Ladda + initiera valt språk
    // @ts-ignore - tesseract typings allows string
    await worker.loadLanguage(lang);
    // @ts-ignore
    await worker.initialize(lang);
    currentLang = lang;
  }
  return worker;
}

/** Förladda worker vid sida/komponents initialisering */
export async function prewarmOcr(uiLang: string) {
  const lang = mapUiToTess(uiLang);
  await getWorker(lang);
}

/** Kör OCR på redan preprocessad bild (dataURL/base64) */
export async function ocrRecognize(preprocessedDataUrl: string, uiLang: string) {
  const lang = mapUiToTess(uiLang);
  const worker = await getWorker(lang);
  const { data: { text } } = await worker.recognize(preprocessedDataUrl);
  return (text || "").normalize("NFC").replace(/\s{2,}/g, " ").trim();
}

/** Byt språk i bakgrunden (kan kallas om heuristik pekar på annat) */
export async function switchOcrLanguage(nextLang: OcrLang) {
  const worker = await getWorker(nextLang);
  return worker; // redan initierad
}
