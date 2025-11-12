import type { WineSearchResult, WineSummary } from "./types.ts";

// Gemini API client via Lovable AI Gateway

const MODEL = "google/gemini-2.5-flash";

type GeminiTextContent = {
  type: "text";
  text: string;
};

type GeminiImageContent = {
  type: "image_url";
  image_url: { url: string };
};

type GeminiMessageContent = GeminiTextContent | GeminiImageContent;

type GeminiUserMessage = string | GeminiMessageContent[];

interface GeminiChoice {
  message?: {
    content?: string;
  };
}

interface GeminiResponse {
  choices?: GeminiChoice[];
}

function parseJsonObject(payload: string): Record<string, unknown> {
  const parsed = JSON.parse(payload) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected JSON object");
  }
  return parsed as Record<string, unknown>;
}

export async function callGeminiJSON<T extends Record<string, unknown>>(
  systemPrompt: string,
  userMessage: GeminiUserMessage,
  apiKey: string,
  timeoutMs = 20000
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.1,
        max_tokens: 2000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      
      if (response.status === 429) {
        throw new Error("rate_limit_exceeded");
      }
      if (response.status === 402) {
        throw new Error("payment_required");
      }
      
      throw new Error(`Gemini HTTP ${response.status}: ${errText}`);
    }

    const json = (await response.json()) as GeminiResponse;
    const content = json?.choices?.[0]?.message?.content || "{}";

    try {
      // Remove markdown code blocks if present
      const clean = content.trim().replace(/^```json|```$/g, "").replace(/^```|```$/g, "");
      return parseJsonObject(clean) as T;
    } catch {
      throw new Error("Gemini returnerade inte giltig JSON");
    }

  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && (error.message.includes("abort") || error.message.includes("timeout"))) {
      throw new Error("gemini_timeout");
    }
    throw error;
  }
}

// OCR with Gemini (vision capabilities)
export async function ocrWithGemini(
  imageBase64: string,
  apiKey: string
): Promise<string> {
  const systemPrompt = `Du är en OCR-expert. Läs all text från vinflasketiketten. Returnera ENDAST texten, ingen analys.`;
  
  const userMessage: GeminiMessageContent[] = [
    {
      type: "image_url" as const,
      image_url: {
        url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`
      }
    },
    {
      type: "text" as const,
      text: "Läs all text från etiketten."
    }
  ];

  const result = await callGeminiJSON<{ text?: string }>(systemPrompt, userMessage, apiKey);
  return result.text ?? "";
}

// Summarize wine with Gemini
export async function summarizeWithGemini(
  ocrText: string,
  webData: WineSearchResult | null,
  webSources: string[],
  imageBase64: string | undefined,
  apiKey: string
): Promise<WineSummary> {
  const systemPrompt = `DU ÄR: En faktagranskande AI-sommelier med visuell expertis. Du får OCR-text från etiketten, eventuellt en bild av flaskan, och ett JSON-objekt med webbfakta ("WEB_JSON"). Du ska returnera ENDAST ett giltigt JSON-objekt i Systembolaget-stil. Inga påhitt.

ARBETSGÅNG:
1) OM DU FÅR EN BILD: Använd chain-of-thought reasoning. Titta metodiskt på etiketten och observera:
   
   LETA SPECIFIKT EFTER (ofta i små tryck längst ner eller på sidorna):
   - Klassificering: AOP, AOC, DOC, DOCG, DOCG Classico, IGT, VdP, IGP, Denominación de Origen, DO, DOCa, Qualitätswein, Prädikatswein, AVA
   - Alkoholhalt: siffror följt av "% vol", "% alc/vol", "% VOL", "% ALC" (exempel: "12.5% vol", "13% vol", "14.5% alc/vol")
   - Volym: siffror följt av "ml", "ML", "cl", "CL", "L" eller "e" (exempel: "750 ml", "75 cl", "0,75 L", "750ml e")
   - Årgång: fyrsiffrigt årtal mellan 1900-2030 (exempel: 2020, 2021, 2023)
   
   OBSERVERA: Dessa uppgifter kan vara placerade:
   - I små tryck längst ner på etiketten
   - På sidorna av huvudetiketten
   - På ryggetiketten (om synlig)
   - Nära varumärket eller producentens namn
   
   Scanna HELA etiketten metodiskt från topp till botten.

2) Använd etikettens OCR_TEXT för att komplettera namn, producent och övrig information.

3) Använd WEB_JSON för att fylla verifierade fakta (producent, druvor, land/region, ev. stiltyp etc).

4) Vid konflikt: lita främst på Systembolaget, därefter nordiska monopol, därefter producenten, därefter Vivino/Wine-Searcher/CellarTracker, därefter proffsmagasin. Om du ser värden tydligt på bilden men de inte finns i WEB_JSON, använd värdena från bilden.

5) Hitta inte på något som inte står i etikett, bild eller WEB_JSON. Om fält saknas efter noggrann titt: "-".

6) Svara endast med EN (1) giltig JSON enligt schema nedan (svenska, ingen markdown, ingen extra text).

SCHEMA:
{
  "vin": "",
  "land_region": "",
  "producent": "",
  "druvor": "",
  "årgång": "",
  "typ": "",
  "färgtyp": "",
  "klassificering": "",
  "alkoholhalt": "",
  "volym": "",
  "karaktär": "",
  "smak": "",
  "passar_till": [],
  "servering": "",
  "källa": "",
  "meters": {
    "sötma": null,
    "fyllighet": null,
    "fruktighet": null,
    "fruktsyra": null
  },
  "evidence": {
    "etiketttext": "",
    "webbträffar": []
  }
}

REGLER:
- Typ/färg: härled bara från tydliga ord (Prosecco/Cava/Champagne/Spumante/Frizzante => mousserande; Rosé/Rosato/Rosado => rosé; Bianco/Blanc/White => vitt; Rosso/Rouge/Red => rött). Annars lämna tomt.
- Mousserande sötma (får mappas utan webbcitat om klassificering står): 
  Brut Nature/Pas Dosé/Dosage Zéro=0; Extra Brut=0.5; Brut=1; Extra Dry=1.5; Dry/Sec=2.2; Demi-Sec/Semi-Seco=3.4; Dolce/Sweet=4.5.
- meters.fyllighet/fruktighet/fruktsyra: fyll ENDAST om källa uttryckligen anger värden/stilskala; annars null.
- "källa": välj den viktigaste URL:en från WEB_JSON.källor (helst Systembolaget, annars nordiska monopol, annars producent, annars retailer, annars proffsmagasin). 
- "evidence": etiketttext (kortad) = OCR_TEXT (max 200 tecken). "webbträffar" = upp till tre URL:er från WEB_JSON.källor.`;

  const webJson = webData
    ? {
        text: JSON.stringify(webData),
        källor: webSources,
        fallback_mode: false,
      }
    : {
        text: "(Ingen verifierad källa hittades. Baserat endast på etikett.)",
        källor: [],
        fallback_mode: true,
      };

  const context = webJson.fallback_mode
    ? `DATA:
OCR_TEXT:
${ocrText || "(ingen text)"}

ETIKETT-LÄGE: Webbsökning misslyckades. Du har en bild av flaskan och OCR-text från etiketten. 

INSTRUKTION: Titta EXTRA noga på bilden för att hitta:
- Klassificering (små tryck som "AOP", "AOC", "DOC", "DOCG" etc)
- Alkoholhalt (siffror följt av "% vol" eller "% alc/vol")
- Volym (siffror följt av "ml", "cl" eller "L")
- Årgång (fyrsiffrigt årtal)

Sätt källa: "gemini-vision". För fält som verkligen inte syns efter noggrann analys: "-".

Analysera vinet baserat på bilden och OCR_TEXT och returnera JSON enligt schemat.`
    : `DATA:
OCR_TEXT:
${ocrText || "(ingen text)"}

WEB_JSON:
${JSON.stringify(webJson, null, 2)}

Vid konflikt mellan källor: prioritera Systembolaget > nordiska monopol > producent > retailer > proffsmagasin. Analysera vinet och returnera ENDAST JSON enligt schemat.`;

  const userMessage: GeminiUserMessage = imageBase64
    ? [
        {
          type: "image_url" as const,
          image_url: {
            url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`,
          },
        },
        {
          type: "text" as const,
          text: context,
        },
      ]
    : context;

  return await callGeminiJSON<WineSummary>(systemPrompt, userMessage, apiKey);
}
