import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { supabase } from "@/integrations/supabase/client";

type ErrorType = "FORMAT" | "CONTENT" | "UNKNOWN";

interface WineAnalysisResult {
  vin: string;
  producent: string;
  druvor: string;
  land_region: string;
  årgång: string;
  typ: string;
  färgtyp: string;
  klassificering: string;
  alkoholhalt: string;
  volym: string;
  karaktär: string;
  smak: string;
  servering: string;
  passar_till: string[];
  meters?: {
    sötma: number | null;
    fyllighet: number | null;
    fruktighet: number | null;
    fruktsyra: number | null;
  };
  evidence?: {
    etiketttext: string;
    webbträffar: string[];
  };
}

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

const DEV_LOG = import.meta.env.VITE_DEV_LOG === "true";

async function analyzeWineImage(imageBase64: string): Promise<WineAnalysisResult> {
  const { data, error } = await supabase.functions.invoke("wine-vision", {
    body: { imageBase64 },
  });

  if (error) {
    console.error("Wine vision error:", error);
    throw new Error(`Analys misslyckades: ${error.message}`);
  }

  if (!data?.ok || !data?.data) {
    throw new Error("Analys misslyckades: Inget data returnerades");
  }

  return data.data as WineAnalysisResult;
}

type IconProps = { className?: string };

const WineBottleIcon = ({ className = "w-6 h-6" }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M8 22h8" />
    <path d="M7 10h10" />
    <path d="M12 10v12" />
    <path d="M12 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
  </svg>
);

const GrapeIcon = ({ className = "w-6 h-6" }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M22 5V2l-5.89 5.89" />
    <circle cx="16.6" cy="15.8" r="1.6" />
    <circle cx="12.2" cy="11.4" r="1.6" />
    <circle cx="12.2" cy="15.8" r="1.6" />
    <circle cx="16.6" cy="11.4" r="1.6" />
    <circle cx="14.4" cy="13.6" r="1.6" />
    <circle cx="9.9" cy="13.6" r="1.6" />
    <path d="M10.43 21.94a1.6 1.6 0 0 1-2.82 0c-.5-1.93 0-4.37 1.41-5.78s3.85-2.12 5.78-1.41a1.6 1.6 0 0 1 0 2.82c-1.93.5-4.37 0-5.78-1.41s-2.12-3.85-1.41-5.78a1.6 1.6 0 0 1 2.82 0" />
  </svg>
);

const FoodIcon = ({ className = "w-6 h-6" }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
    <path d="M17 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
    <path d="M7 2v20" />
    <path d="M17 2v20" />
  </svg>
);

const MapPinIcon = ({ className = "w-6 h-6" }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const TastingIcon = ({ className = "w-6 h-6" }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M12 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-4" />
    <path d="m18 12 4-4" />
    <path d="m14 16 4 4" />
    <path d="M22 8l-4.5 4.5" />
  </svg>
);

const CameraIcon = ({ className = "w-6 h-6" }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18A2.25 2.25 0 0 0 4.5 20.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175A2.31 2.31 0 0 1 17.174 6.175l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0zM18.75 10.5h.008v.008h-.008V10.5z"
    />
  </svg>
);

const UploadIcon = ({ className = "w-6 h-6" }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
    />
  </svg>
);

const SparklesIcon = ({ className = "w-6 h-6" }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09zM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456zM16.898 20.562 16.25 22.5l-.648-1.938a3.375 3.375 0 0 0-2.672-2.672L11.25 18l1.938-.648a3.375 3.375 0 0 0 2.672-2.672L16.25 13.5l.648 1.938a3.375 3.375 0 0 0 2.672 2.672L21 18l-1.938.648a3.375 3.375 0 0 0-2.672 2.672z"
    />
  </svg>
);

const SendIcon = ({ className = "w-6 h-6" }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M3.478 2.405a.75.75 0 0 0-.926.94l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.405z" />
  </svg>
);

const LoadingSpinner = () => (
  <svg className="h-10 w-10 animate-spin text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

const ResultCard = ({
  title,
  icon,
  children,
}: {
  title: string;
  icon: JSX.Element;
  children: ReactNode;
}) => (
  <div className="h-full rounded-lg border border-gray-700 bg-gray-800/70 p-6 shadow-md backdrop-blur-sm">
    <div className="mb-4 flex items-center">
      <div className="mr-3 text-cyan-400">{icon}</div>
      <h3 className="text-xl font-semibold text-white">{title}</h3>
    </div>
    <div>{children}</div>
  </div>
);

const WineAnalysisDisplay = ({ result }: { result: WineAnalysisResult }) => (
  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
    <div className="lg:col-span-2">
      <ResultCard title={`${result.vin} (${result.årgång})`} icon={<WineBottleIcon />}>
        <p className="text-lg text-gray-300">
          av <span className="font-semibold">{result.producent}</span>
        </p>
      </ResultCard>
    </div>
    <ResultCard title="Druvor" icon={<GrapeIcon />}>
      <div className="flex flex-wrap gap-2">
        {result.druvor.split(',').map((grape, idx) => (
          <span
            key={`${grape}-${idx}`}
            className="rounded-full bg-gray-900/50 px-3 py-1 font-mono text-sm text-cyan-400"
          >
            {grape.trim()}
          </span>
        ))}
      </div>
    </ResultCard>
    <ResultCard title="Ursprung" icon={<MapPinIcon />}>
      <p className="text-gray-300">{result.land_region}</p>
    </ResultCard>
    <div className="lg:col-span-2">
      <ResultCard title="Karaktär & Smak" icon={<TastingIcon />}>
        <p className="text-gray-300 mb-2"><strong>Karaktär:</strong> {result.karaktär}</p>
        <p className="text-gray-300">{result.smak}</p>
        <div className="mt-3 text-xs uppercase tracking-wide text-cyan-400">AI-genererad analys</div>
      </ResultCard>
    </div>
    <div className="lg:col-span-2">
      <ResultCard title="Matförslag" icon={<FoodIcon />}>
        <ul className="space-y-3">
          {result.passar_till.map((pair, idx) => (
            <li key={`${pair}-${idx}`} className="flex items-start">
              <span className="mr-3 mt-1 text-cyan-400">&#10148;</span>
              <span className="text-gray-300">{pair}</span>
            </li>
          ))}
        </ul>
      </ResultCard>
    </div>
  </div>
);

const ImageInputForm = ({
  onAnalyze,
  isLoading,
  exposeOpen,
}: {
  onAnalyze: (data: string, mime: string) => void;
  isLoading: boolean;
  exposeOpen?: (fn: () => void) => void;
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (exposeOpen) {
      exposeOpen(() => {
        fileInputRef.current?.click();
      });
    }
  }, [exposeOpen]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(",")[1];
        onAnalyze(base64String, file.type);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl rounded-lg border border-gray-700 bg-gray-800/50 p-4">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleFileChange}
        disabled={isLoading}
      />
      <div className="flex flex-col justify-center gap-4 sm:flex-row">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className="flex flex-1 items-center justify-center gap-3 rounded-md bg-cyan-600 px-6 py-3 text-lg font-semibold text-white transition-colors duration-300 hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-gray-600"
        >
          <UploadIcon className="h-6 w-6" />
          Ladda upp bild
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className="flex flex-1 items-center justify-center gap-3 rounded-md bg-gray-700 px-6 py-3 text-lg font-semibold text-white transition-colors duration-300 hover:bg-gray-600 disabled:cursor-not-allowed disabled:bg-gray-600"
        >
          <CameraIcon className="h-6 w-6" />
          Använd kamera
        </button>
      </div>
    </div>
  );
};

const ChatInterface = ({
  messages,
  onSendMessage,
  isLoading,
}: {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
}) => {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput("");
      setTimeout(() => scrollToBottom(false), 0);
    }
  };

  return (
    <div className="flex min-h-[420px] max-h-[720px] h-[60vh] flex-col rounded-lg border border-gray-700 bg-gray-800/70 shadow-md backdrop-blur-sm">
      <div className="flex flex-shrink-0 items-center border-b border-gray-700 p-4">
        <SparklesIcon className="mr-3 h-6 w-6 text-yellow-400" />
        <h3 className="text-xl font-semibold text-white">Fråga om vinet</h3>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite" aria-busy={isLoading}>
        {messages.map((msg, index) => (
          <div key={`${msg.role}-${index}`} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-xl rounded-lg p-3 ${
                msg.role === "user" ? "bg-cyan-900/50 text-white" : "bg-gray-700/50 text-gray-300"
              }`}
            >
              <div className="whitespace-pre-wrap break-words">{msg.text}</div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-xl rounded-lg bg-gray-700/50 p-3 text-gray-300">
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 animate-bounce rounded-full bg-cyan-400" style={{ animationDelay: "0s" }} />
                <div className="h-2 w-2 animate-bounce rounded-full bg-cyan-400" style={{ animationDelay: "0.2s" }} />
                <div className="h-2 w-2 animate-bounce rounded-full bg-cyan-400" style={{ animationDelay: "0.4s" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="flex-shrink-0 border-t border-gray-700 p-4">
        <form onSubmit={handleSubmit}>
          <div className="flex items-center rounded-lg border-2 border-gray-700 bg-gray-900/50 p-2 transition-all duration-300 focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-500/50">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ställ en fråga…"
              className="w-full bg-transparent px-2 text-lg text-gray-200 placeholder-gray-500 focus:outline-none"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="flex items-center justify-center rounded-md bg-cyan-600 p-3 font-semibold text-white transition-colors duration-300 hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-gray-600"
              aria-label="Skicka meddelande"
            >
              <SendIcon className="h-5 w-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const WineSnap = () => {
  const [analysis, setAnalysis] = useState<WineAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<ErrorType | null>(null);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [lastAnalyzedImage, setLastAnalyzedImage] = useState<{ data: string; mime: string } | null>(null);

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isChatLoading] = useState(false);

  const [openPicker, setOpenPicker] = useState<(() => void) | null>(null);

  const classifyError = useCallback((msg: string): ErrorType => {
    if (msg.includes("CONTENT_UNREADABLE") || msg.includes("Ingen text hittades")) return "CONTENT";
    if (msg.toLowerCase().includes("json") || msg.includes("FORMAT")) {
      return "FORMAT";
    }
    return "UNKNOWN";
  }, []);

  const handleImageAnalysis = useCallback(
    async (imageData: string, mimeType: string) => {
      setIsLoading(true);
      setError(null);
      setErrorType(null);
      setAnalysis(null);
      setChatHistory([]);
      setLastAnalyzedImage({ data: imageData, mime: mimeType });

      try {
        setLoadingMessage("Analyserar vinet…");
        const result = await analyzeWineImage(imageData);
        setAnalysis(result);
        setChatHistory([
          { role: "assistant", text: `✅ Jag har analyserat ${result.vin}. Vad vill du veta?` },
        ]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Okänt fel vid analys.";
        const kind = classifyError(msg);
        setErrorType(kind);
        setError(`Kunde inte slutföra analysen: ${msg}`);
        if (DEV_LOG) console.error("[DEV_LOG] Analysis error:", err);
      } finally {
        setIsLoading(false);
        setLoadingMessage("");
      }
    },
    [classifyError],
  );

  const retrySameImage = useCallback(() => {
    if (!lastAnalyzedImage || isLoading) return;
    if (DEV_LOG) console.log("[DEV_LOG] RETRY with same image");
    handleImageAnalysis(lastAnalyzedImage.data, lastAnalyzedImage.mime);
  }, [lastAnalyzedImage, isLoading, handleImageAnalysis]);

  const handleSendMessage = async (message: string) => {
    // Chat functionality disabled for now - wine-vision doesn't support chat yet
    console.log("Chat message:", message);
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-gray-900 p-4 text-gray-200 sm:p-6 lg:p-8">
      <div className="w-full max-w-4xl">
        <header className="mb-8 text-center">
          <div className="mb-2 flex items-center justify-center gap-4">
            <WineBottleIcon className="h-12 w-12 text-white" />
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">WineSnap Etikett-analys</h1>
          </div>
          <p className="flex items-center justify-center gap-2 text-lg text-gray-400">
            Din personliga sommelier <SparklesIcon className="h-5 w-5 text-yellow-400" />
          </p>
        </header>

        <main>
          <ImageInputForm onAnalyze={handleImageAnalysis} isLoading={isLoading} exposeOpen={setOpenPicker} />

          <div className="mt-8">
            {isLoading && (
              <div className="flex flex-col items-center justify-center rounded-lg border border-gray-700 bg-gray-800/50 p-8 text-center">
                <LoadingSpinner />
                <p className="mt-4 text-lg font-medium text-gray-300">{loadingMessage}</p>
                <p className="text-gray-400">Vänligen vänta…</p>
              </div>
            )}

            {error && !isLoading && (
              <div
                className="space-y-3 rounded-lg border border-red-700 bg-red-900/50 px-4 py-4 text-center text-red-300"
                role="alert"
              >
                <strong className="block font-bold">Tyvärr!</strong>
                <span className="block">{error}</span>

                <div className="mt-3 flex flex-col justify-center gap-3 sm:flex-row">
                  {(errorType === "FORMAT" || errorType === "UNKNOWN") && lastAnalyzedImage && (
                    <button
                      onClick={retrySameImage}
                      className="rounded bg-cyan-600 px-4 py-2 font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-cyan-600"
                      disabled={isLoading}
                    >
                      🔁 Försök igen med samma bild
                    </button>
                  )}

                  {(errorType === "CONTENT" || errorType === "UNKNOWN") && (
                    <button
                      onClick={() => openPicker?.()}
                      className="rounded bg-gray-700 px-4 py-2 font-semibold text-white hover:bg-gray-600 disabled:cursor-not-allowed disabled:bg-gray-600"
                      disabled={isLoading}
                    >
                      📸 Ta nytt foto
                    </button>
                  )}
                </div>

                {errorType === "CONTENT" && (
                  <p className="mt-2 text-sm text-gray-400">
                    Tips: undvik blänk, fyll rutan med etiketten, vrid flaskan rakt.
                  </p>
                )}
              </div>
            )}

            {analysis && !isLoading && !error && (
              <div className="space-y-8 animate-fade-in">
                <WineAnalysisDisplay result={analysis} />
                <ChatInterface messages={chatHistory} onSendMessage={handleSendMessage} isLoading={isChatLoading} />
              </div>
            )}

            {!analysis && !isLoading && !error && (
              <div className="rounded-lg border border-dashed border-gray-700 bg-gray-800/50 p-8 text-center">
                <h2 className="text-xl font-medium text-gray-300">Redo att skanna</h2>
                <p className="mt-2 text-gray-400">Använd kameran eller ladda upp en bild på en vin-etikett.</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default WineSnap;
