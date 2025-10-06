// Perplexity API client - JSON in -> JSON out
export async function queryPerplexityJSON(prompt: string, apiKey: string) {
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "sonar",
      temperature: 0.0,
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Perplexity HTTP ${res.status}: ${errText}`);
  }
  
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content ?? "{}";
  
  try { 
    return JSON.parse(text); 
  } catch { 
    throw new Error("Perplexity gav inte giltig JSON"); 
  }
}

// Enhanced Perplexity search with domain whitelist and diacritic normalization
export async function searchWineWithPerplexity(
  ocrText: string, 
  apiKey: string,
  timeoutMs = 12000
): Promise<{ data: any; sources: string[] }> {
  
  // Normalize diacritics in OCR text for better matching
  const normalizedOcr = ocrText.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "sonar",
        temperature: 0.0,
        max_tokens: 600,
        search_depth: "basic",
        focus: "internet",
        messages: [{
          role: "user",
          content: `Hitta fakta om detta vin från etiketten: "${ocrText.slice(0, 250)}"

Sök i följande ordning:
1. Systembolaget.se (svensk vinmonopol)
2. Producentens officiella webbplats
3. Alko.fi, Vinmonopolet.no, Vinbudin.is (nordiska monopol)
4. Seriösa återförsäljare (vivino.com, wine-searcher.com, cellartracker.com)
5. Proffsmagasin (wine-spectator.com, decanter.com, robertparker.com)

Returnera ENDAST JSON:
{
  "vin": "vinets namn",
  "producent": "producent",
  "druvor": "druvsort(er)",
  "land_region": "land, region",
  "årgång": "årgång",
  "alkoholhalt": "X%",
  "volym": "Xml",
  "klassificering": "t.ex. DOC, Reserva",
  "karaktär": "kort beskrivning",
  "smak": "smaker och dofter",
  "servering": "temperatur",
  "passar_till": ["maträtt1", "maträtt2", "maträtt3"]
}

Om ett fält saknas: använd "-". Max 3 passar_till-maträtter.`
        }],
        search_domain_filter: [
          "systembolaget.se",
          "alko.fi",
          "vinmonopolet.no", 
          "vinbudin.is",
          "vivino.com",
          "wine-searcher.com",
          "cellartracker.com",
          "wine-spectator.com",
          "decanter.com",
          "robertparker.com"
        ],
        return_images: false,
        return_related_questions: false
      })
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Perplexity HTTP ${res.status}: ${errText}`);
    }

    const resData = await res.json();
    const rawText = resData?.choices?.[0]?.message?.content || "";
    const citations = resData?.citations || [];

    // Parse JSON response
    let parsedData: any = null;
    try {
      const cleanJson = rawText.trim().replace(/^```json\s*|```$/g, "");
      parsedData = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error("Perplexity JSON parse error:", parseError);
      console.error("Raw Perplexity response (first 500 chars):", rawText.substring(0, 500));
      console.error("Full response length:", rawText.length);
      throw new Error("Perplexity did not return valid JSON");
    }

    // Prioritize sources: Systembolaget > Nordic monopolies > Producer > Retailers > Professional magazines
    const systembolagetSources = citations.filter((url: string) => url.includes("systembolaget.se"));
    const nordicMonopolSources = citations.filter((url: string) => 
      url.includes("alko.fi") || url.includes("vinmonopolet.no") || url.includes("vinbudin.is")
    );
    const producerSources = citations.filter((url: string) => 
      !url.includes("systembolaget.se") && 
      !url.includes("alko.fi") && 
      !url.includes("vinmonopolet.no") && 
      !url.includes("vinbudin.is") &&
      (url.includes("winery") || url.includes("bodega") || url.includes("vineyard") || url.includes("chateau"))
    );
    const retailerSources = citations.filter((url: string) =>
      url.includes("vivino.com") || url.includes("wine-searcher.com") || url.includes("cellartracker.com")
    );
    const magazineSources = citations.filter((url: string) =>
      url.includes("wine-spectator.com") || url.includes("decanter.com") || url.includes("robertparker.com")
    );

    const prioritizedSources = [
      ...systembolagetSources.slice(0, 1),
      ...nordicMonopolSources.slice(0, 1),
      ...producerSources.slice(0, 1),
      ...retailerSources.slice(0, 1),
      ...magazineSources.slice(0, 1)
    ].slice(0, 3); // Max 3 sources

    return {
      data: parsedData || { text: rawText },
      sources: prioritizedSources
    };

  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && (error.message.includes("abort") || error.message.includes("timeout"))) {
      throw new Error("perplexity_timeout");
    }
    throw error;
  }
}
