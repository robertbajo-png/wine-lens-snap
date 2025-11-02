import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { GoogleGenAI, Type, type Chat } from "@google/genai";
import { marked } from "marked";
import DOMPurify from "dompurify";

interface AnalysisResult {
  summary: string;
  technologies: string[];
  nextSteps: string[];
  keyFiles: string[];
  gitCommands: GitCommand[];
}

interface GithubRepoData {
  readme: string | null;
  fileTree: string[];
  languages: Record<string, number>;
  description: string | null;
}

interface GithubTreeItem {
  path: string;
  type: "blob" | "tree" | string;
}

interface GithubTreeResponse {
  tree?: GithubTreeItem[];
}

interface GitCommand {
  command: string;
  description: string;
}

interface ChatMessage {
  role: "user" | "model";
  text: string;
}

const GITHUB_API_BASE = "https://api.github.com";
const USER_AGENT = "GitHub-Project-Connector/1.0";

function b64decode(b64: string): string {
  try {
    return atob(b64);
  } catch (error) {
    console.error("Failed to decode base64 string", error);
    return "";
  }
}

function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  try {
    const parsed = new URL(url.trim());
    if (parsed.hostname !== "github.com") return null;
    const parts = parsed.pathname.replace(/\.git$/i, "").split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const [owner, repo] = parts;
    return { owner, repo };
  } catch {
    return null;
  }
}

type GhFetchOptions = {
  accept?: string;
  raw?: boolean;
  timeoutMs?: number;
};

async function ghFetch(endpoint: string, opts: GhFetchOptions = {}) {
  const accept = opts.raw ? "application/vnd.github.raw" : "application/vnd.github.v3+json";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15000);

  try {
    const res = await fetch(`${GITHUB_API_BASE}${endpoint}`, {
      headers: {
        Accept: accept,
        "User-Agent": USER_AGENT,
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const msg = text || res.statusText;
      if (res.status === 404) throw new Error(`GitHub 404: Resource not found at ${endpoint}`);
      if (res.status === 403 && /rate limit/i.test(msg)) {
        throw new Error("GitHub rate limit exceeded. Please wait and try again.");
      }
      throw new Error(`GitHub API error ${res.status}: ${msg}`);
    }

    if (opts.raw) return await res.text();
    const contentType = res.headers.get("content-type") || "";
    return contentType.includes("application/json") ? await res.json() : await res.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchLanguages(url: string): Promise<Record<string, number>> {
  try {
    const json = await ghFetch(new URL(url).pathname);
    return json && typeof json === "object" ? json : {};
  } catch (error) {
    console.warn("Failed to fetch languages", error);
    return {};
  }
}

async function fetchTree(owner: string, repo: string, defaultBranch: string): Promise<GithubTreeResponse> {
  return ghFetch(`/repos/${owner}/${repo}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`) as Promise<GithubTreeResponse>;
}

async function fetchRootContents(owner: string, repo: string): Promise<string[]> {
  const arr = await ghFetch(`/repos/${owner}/${repo}/contents`);
  if (!Array.isArray(arr)) return [];
  return arr.map((item: { name: string; type: string }) => `${item.name}${item.type === "dir" ? "/" : ""}`);
}

async function fetchReadme(owner: string, repo: string): Promise<string> {
  try {
    const raw = await ghFetch(`/repos/${owner}/${repo}/readme`, { raw: true, timeoutMs: 12000 });
    if (typeof raw === "string" && raw.trim()) return raw;
  } catch (error) {
    console.warn("Primary README fetch failed", error);
  }

  try {
    const meta = await ghFetch(`/repos/${owner}/${repo}/readme`);
    if (meta?.content) return b64decode(meta.content);
    if (meta?.download_url) {
      const raw = await ghFetch(new URL(meta.download_url).pathname, { raw: true });
      return typeof raw === "string" ? raw : "";
    }
  } catch (error) {
    console.warn("Fallback README fetch failed", error);
  }
  return "No README file found.";
}

const fetchRepoData = async (repoUrl: string): Promise<GithubRepoData> => {
  const repoInfo = parseRepoUrl(repoUrl);
  if (!repoInfo) throw new Error("Invalid GitHub repository URL");
  const { owner, repo } = repoInfo;

  try {
    const repoDetails = await ghFetch(`/repos/${owner}/${repo}`);

    const [languages, readme, treeOrNull] = await Promise.all([
      repoDetails.languages_url ? fetchLanguages(repoDetails.languages_url) : Promise.resolve<Record<string, number>>({}),
      fetchReadme(owner, repo),
      (async () => {
        try {
          return await fetchTree(owner, repo, repoDetails.default_branch || "main");
        } catch (fetchError) {
          console.warn("Failed to fetch full tree; falling back to root contents", fetchError);
          return null;
        }
      })(),
    ]);

    let fileTree: string[] = [];
    if (treeOrNull?.tree && Array.isArray(treeOrNull.tree)) {
      fileTree = treeOrNull.tree.map((n: { path: string; type: string }) => (n.type === "tree" ? `${n.path}/` : n.path));
    } else {
      fileTree = await fetchRootContents(owner, repo);
    }

    return {
      readme,
      fileTree,
      languages,
      description: repoDetails.description ?? "",
    };
  } catch (error) {
    console.error("Error fetching data from GitHub:", error);
    if (error instanceof Error) {
      if (error.message.includes("404")) {
        throw new Error("Repository not found. Please check the URL.");
      }
      throw new Error(`Could not retrieve repository data. ${error.message}`);
    }
    throw new Error("Could not retrieve repository data from GitHub.");
  }
};

const gitCommandSchema = {
  type: Type.OBJECT,
  properties: {
    command: { type: Type.STRING },
    description: { type: Type.STRING },
  },
  required: ["command", "description"],
};

const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description: "A concise, one-paragraph summary of the project's purpose and functionality based on its README and code.",
    },
    technologies: {
      type: Type.ARRAY,
      description:
        "Key technologies, frameworks, and libraries used (e.g., 'React', 'Node.js', 'Vite', 'TypeScript').",
      items: { type: Type.STRING },
    },
    nextSteps: {
      type: Type.ARRAY,
      description:
        "3–5 concrete, actionable next steps for a new developer joining the project, based on the project's current state.",
      items: { type: Type.STRING },
    },
    keyFiles: {
      type: Type.ARRAY,
      description:
        "3–5 key files or directories a new contributor should examine first, chosen from the provided file list.",
      items: { type: Type.STRING },
    },
    gitCommands: {
      type: Type.ARRAY,
      description:
        "Git commands to get started. MUST include 'git clone <repo>' and 'git checkout -b <branch-name>' based on one of the nextSteps.",
      items: gitCommandSchema,
    },
  },
  required: ["summary", "technologies", "nextSteps", "keyFiles", "gitCommands"],
} as const;

function truncate(s: string | undefined | null, max = 14000) {
  if (!s) return "";
  return s.length > max ? `${s.slice(0, max)}\n\n...[truncated]...` : s;
}

function toJsonSafe(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/m) || text.match(/\[[\s\S]*\]/m);
    if (match && match[0]) {
      try {
        return JSON.parse(match[0]);
      } catch (error) {
        console.warn("Failed to parse nested JSON", error);
      }
    }
    throw new Error("Gemini did not return valid JSON");
  }
}

function getApiKey() {
  const apiKey =
    import.meta.env.VITE_GOOGLE_GENAI_API_KEY ||
    import.meta.env.VITE_GEMINI_API_KEY ||
    import.meta.env.VITE_API_KEY;
  if (!apiKey) throw new Error("Missing Gemini API key. Set VITE_GOOGLE_GENAI_API_KEY in your environment.");
  return apiKey;
}

async function analyzeGitHubRepo(repoUrl: string, repoData: GithubRepoData): Promise<AnalysisResult> {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });

  const languageList = Object.keys(repoData.languages || {}).join(", ");
  const prompt = `Analyze this GitHub repository and return ONLY JSON following the provided schema.

Repo URL: ${repoUrl}
Description: ${repoData.description || "Not provided."}
Languages detected: ${languageList || "Not detected."}

Root Directory Contents:
${truncate((repoData.fileTree || []).join("\n"), 6000)}

README.md:
---
${truncate(repoData.readme, 7000)}
---

Return only JSON (no preface, no markdown).`.trim();

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
        temperature: 0.2,
      },
    });

    const rawText = response.text?.trim();
    if (!rawText) throw new Error("Empty response from Gemini");

    const parsed = toJsonSafe(rawText);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Analysis JSON missing required fields");
    }

    const json = parsed as Record<string, unknown>;

    const summary = typeof json.summary === "string" ? json.summary : null;
    const technologies = Array.isArray(json.technologies) ? json.technologies.filter((item): item is string => typeof item === "string") : null;
    const nextSteps = Array.isArray(json.nextSteps) ? json.nextSteps.filter((item): item is string => typeof item === "string") : null;
    const keyFiles = Array.isArray(json.keyFiles) ? json.keyFiles.filter((item): item is string => typeof item === "string") : null;
    const gitCommands = Array.isArray(json.gitCommands)
      ? json.gitCommands.filter((item): item is GitCommand =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as Record<string, unknown>).command === "string" &&
          typeof (item as Record<string, unknown>).description === "string"
        )
      : null;

    if (!summary || !technologies || !nextSteps || !keyFiles || !gitCommands) {
      throw new Error("Analysis JSON missing required fields");
    }

    return {
      summary,
      technologies,
      nextSteps,
      keyFiles,
      gitCommands,
    };
  } catch (error) {
    console.error("Error in analyzeGitHubRepo:", error);
    throw error;
  }
}

function createChat(repoUrl: string, repoData: GithubRepoData, analysis: AnalysisResult): Chat {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });

  const contextPrompt = `You are an expert software developer and project manager. You are now in a chat session assisting a user with a specific GitHub repository.

Repo URL: ${repoUrl}
Repo Description: ${repoData.description || "Not provided"}
Key Technologies: ${(analysis.technologies || []).join(", ")}
Project Summary: ${analysis.summary}
Key Files: ${(analysis.keyFiles || []).join(", ")}

You will answer the user's questions about this repository. Be helpful, concise, and provide code examples when asked. Assume all questions relate to this specific repository.`.trim();

  return ai.chats.create({
    model: "gemini-2.5-flash",
    config: {
      systemInstruction: contextPrompt,
      temperature: 0.7,
    },
  });
}

async function sendChatMessageStream(chat: Chat, message: string) {
  const stream = await chat.sendMessageStream({ message });
  return stream;
}

type IconProps = { className?: string };

const GithubIcon = ({ className = "w-6 h-6" }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path
      fillRule="evenodd"
      d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.168 6.839 9.492.5.092.682-.217.682-.482 0-.237-.009-.868-.014-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.031-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.03 1.595 1.03 2.688 0 3.848-2.338 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.001 10.001 0 0022 12c0-5.523-4.477-10-10-10z"
      clipRule="evenodd"
    />
  </svg>
);

const SearchIcon = ({ className = "w-6 h-6" }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
  </svg>
);

const SummaryIcon = ({ className = "w-6 h-6" }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
  </svg>
);

const ChipIcon = ({ className = "w-6 h-6" }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M14.25 9.75 16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0 0 20.25 18V5.75A2.25 2.25 0 0 0 18 3.5H6A2.25 2.25 0 0 0 3.75 5.75v12.5A2.25 2.25 0 0 0 6 20.25Z"
    />
  </svg>
);

const ListIcon = ({ className = "w-6 h-6" }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
    />
  </svg>
);

const FileIcon = ({ className = "w-6 h-6" }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
    />
  </svg>
);

const SparklesIcon = ({ className = "w-6 h-6" }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.898 20.562L16.25 22.5l-.648-1.938a3.375 3.375 0 00-2.672-2.672L11.25 18l1.938-.648a3.375 3.375 0 002.672-2.672L16.25 13.5l.648 1.938a3.375 3.375 0 002.672 2.672L21 18l-1.938.648a3.375 3.375 0 00-2.672 2.672z"
    />
  </svg>
);

const TerminalIcon = ({ className = "w-6 h-6" }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6.429 9.75 2.25 12l4.179 2.25m0-4.5 5.571 3 5.571-3m-11.142 0L12 15.25l5.571-3M3 4.5h18A2.25 2.25 0 0 1 23.25 6.75v10.5A2.25 2.25 0 0 1 21 19.5H3A2.25 2.25 0 0 1 .75 17.25V6.75A2.25 2.25 0 0 1 3 4.5Z"
    />
  </svg>
);

const ClipboardIcon = ({ className = "w-6 h-6" }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a2.25 2.25 0 0 1-2.25 2.25H9.75A2.25 2.25 0 0 1 7.5 4.5v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184"
    />
  </svg>
);

const CheckIcon = ({ className = "w-6 h-6" }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
  </svg>
);

const SendIcon = ({ className = "w-6 h-6" }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
  </svg>
);

const LoadingSpinner = () => (
  <svg className="h-10 w-10 animate-spin text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    ></path>
  </svg>
);

interface ResultCardProps {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}

const ResultCard = ({ title, icon, children }: ResultCardProps) => (
  <div className="h-full rounded-lg border border-gray-700 bg-gray-800/70 p-6 shadow-md backdrop-blur-sm">
    <div className="mb-4 flex items-center">
      <div className="mr-3 text-cyan-400">{icon}</div>
      <h3 className="text-xl font-semibold text-white">{title}</h3>
    </div>
    <div>{children}</div>
  </div>
);

interface GitCommandProps {
  command: string;
  description: string;
}

const GitCommandDisplay = ({ command, description }: GitCommandProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="rounded-lg bg-gray-900/70 p-4">
      <p className="mb-2 text-sm text-gray-400">{description}</p>
      <div className="flex items-center justify-between rounded-md bg-gray-950 p-3 font-mono text-gray-300">
        <span className="break-all">$ {command}</span>
        <button
          onClick={handleCopy}
          className="ml-4 flex-shrink-0 rounded-md p-2 transition-colors duration-200 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          aria-label="Copy command"
        >
          {copied ? <CheckIcon className="h-5 w-5 text-green-400" /> : <ClipboardIcon className="h-5 w-5 text-gray-400" />}
        </button>
      </div>
    </div>
  );
};

interface AnalysisDisplayProps {
  result: AnalysisResult;
}

const AnalysisDisplay = ({ result }: AnalysisDisplayProps) => (
  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
    <div className="lg:col-span-2">
      <ResultCard title="Project Summary" icon={<SummaryIcon />}>
        <p className="text-gray-300">{result.summary}</p>
      </ResultCard>
    </div>

    <ResultCard title="Technologies Used" icon={<ChipIcon />}>
      <div className="flex flex-wrap gap-2">
        {result.technologies.map((tech, index) => (
          <span key={index} className="rounded-full bg-gray-900/50 px-3 py-1 text-sm font-mono text-cyan-400">
            {tech}
          </span>
        ))}
      </div>
    </ResultCard>

    <ResultCard title="Suggested Next Steps" icon={<ListIcon />}>
      <ul className="space-y-3">
        {result.nextSteps.map((step, index) => (
          <li key={index} className="flex items-start">
            <span className="mr-3 mt-1 text-cyan-400">➤</span>
            <span className="text-gray-300">{step}</span>
          </li>
        ))}
      </ul>
    </ResultCard>

    <div className="lg:col-span-2">
      <ResultCard title="Key Files & Directories" icon={<FileIcon />}>
        <ul className="space-y-3 font-mono">
          {result.keyFiles.map((file, index) => (
            <li key={index} className="flex items-start rounded-md bg-gray-900/50 p-3">
              <FileIcon className="mr-3 mt-0.5 h-5 w-5 flex-shrink-0 text-gray-400" />
              <span className="text-gray-300">{file}</span>
            </li>
          ))}
        </ul>
      </ResultCard>
    </div>

    <div className="lg:col-span-2">
      <ResultCard title="Get Started with Git" icon={<TerminalIcon />}>
        <div className="space-y-4">
          {result.gitCommands.map((cmd, index) => (
            <GitCommandDisplay key={index} command={cmd.command} description={cmd.description} />
          ))}
        </div>
      </ResultCard>
    </div>
  </div>
);

interface GithubInputFormProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
}

const EXAMPLE_REPO_URL = "https://github.com/google-gemini/project-connector-demo";

const GithubInputForm = ({ onSubmit, isLoading }: GithubInputFormProps) => {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (!url.trim()) {
      setError("Please enter a GitHub repository URL.");
      return;
    }

    if (!url.startsWith("https://github.com/")) {
      setError("Please enter a valid GitHub repository URL.");
      return;
    }
    setError(null);
    onSubmit(url);
  };

  const handleAnalyzeExample = () => {
    if (isLoading) return;
    setUrl(EXAMPLE_REPO_URL);
    onSubmit(EXAMPLE_REPO_URL);
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <form onSubmit={handleSubmit}>
        <div className="flex items-center rounded-lg border-2 border-gray-700 bg-gray-800 p-2 shadow-lg transition-all duration-300 focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-500/50">
          <GithubIcon className="mx-3 h-6 w-6 text-gray-400" />
          <input
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) setError(null);
            }}
            placeholder="e.g., https://github.com/facebook/react"
            className="w-full bg-transparent text-lg text-gray-200 placeholder-gray-500 focus:outline-none"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !url}
            className="flex items-center justify-center gap-2 rounded-md bg-cyan-600 px-4 py-2 font-semibold text-white transition-colors duration-300 hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 disabled:cursor-not-allowed disabled:bg-gray-600 sm:px-6"
          >
            <SearchIcon className="h-5 w-5" />
            <span className="hidden sm:inline">{isLoading ? "Analyzing..." : "Analyze"}</span>
          </button>
        </div>
      </form>
      {error && <p className="mt-2 text-center text-red-400">{error}</p>}

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={handleAnalyzeExample}
          disabled={isLoading}
          className="mx-auto flex items-center justify-center gap-2 text-sm text-gray-400 transition-colors duration-300 hover:text-cyan-400 disabled:cursor-not-allowed disabled:text-gray-600"
        >
          <SparklesIcon className="h-4 w-4" />
          <span>Or analyze our example project.</span>
        </button>
      </div>
    </div>
  );
};

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
}

const ChatInterface = ({ messages, onSendMessage, isLoading }: ChatInterfaceProps) => {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput("");
      setTimeout(() => scrollToBottom(false), 0);
    }
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !isLoading) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const renderModelMessage = (text: string) => {
    try {
      const html = marked.parse(text, { breaks: true, gfm: true });
      const safeHtml = DOMPurify.sanitize(html);
      return (
        <div
          className="prose prose-invert prose-sm max-w-none prose-pre:rounded-md prose-pre:bg-gray-900/70 prose-pre:p-3"
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
      );
    } catch (error) {
      console.error("Error parsing markdown:", error);
    }
    return <div className="break-words whitespace-pre-wrap">{text}</div>;
  };

  return (
    <div className="flex h-[60vh] min-h-[420px] max-h-[720px] flex-col rounded-lg border border-gray-700 bg-gray-800/70 shadow-md backdrop-blur-sm">
      <div className="flex flex-shrink-0 items-center border-b border-gray-700 p-4">
        <SparklesIcon className="mr-3 h-6 w-6 text-yellow-400" />
        <h3 className="text-xl font-semibold text-white">Chat about this repo</h3>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite" aria-busy={isLoading ? "true" : "false"}>
        {messages.map((msg, index) => (
          <div key={`${msg.role}-${index}-${msg.text.length}`} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-xl rounded-lg p-3 ${msg.role === "user" ? "bg-cyan-900/50 text-white" : "bg-gray-700/50 text-gray-300"}`}
            >
              {msg.role === "model" ? renderModelMessage(msg.text) : (
                <p className="break-words whitespace-pre-wrap">{msg.text}</p>
              )}
            </div>
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role === "user" && (
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
              onKeyDown={handleKeyDown}
              placeholder="Ask a follow-up question…"
              className="w-full bg-transparent px-2 text-lg text-gray-200 placeholder-gray-500 focus:outline-none"
              disabled={isLoading}
              aria-label="Ask a follow-up question about the repository"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="flex items-center justify-center rounded-md bg-cyan-600 p-3 font-semibold text-white transition-colors duration-300 hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 disabled:cursor-not-allowed disabled:bg-gray-600"
              aria-label="Send message"
              title="Send message"
            >
              <SendIcon className="h-5 w-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const GithubConnector = () => {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentRepoUrl, setCurrentRepoUrl] = useState("");
  const [loadingMessage, setLoadingMessage] = useState("");

  const [chat, setChat] = useState<Chat | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const getRepoName = (url: string) => {
    try {
      const path = new URL(url).pathname.replace(/^\/+/, "");
      return path || "repository";
    } catch {
      return "repository";
    }
  };

  const handleAnalyze = useCallback(async (repoUrl: string) => {
    setIsLoading(true);
    setError(null);
    setAnalysis(null);
    setChatHistory([]);
    setChat(null);
    setCurrentRepoUrl(repoUrl);

    try {
      setLoadingMessage(`Fetching data for ${getRepoName(repoUrl)}...`);
      const repoData = await fetchRepoData(repoUrl);

      setLoadingMessage("Analyzing repository with Gemini...");
      const result = await analyzeGitHubRepo(repoUrl, repoData);

      setLoadingMessage("Initializing chat session...");
      const newChat = createChat(repoUrl, repoData, result);

      setAnalysis(result);
      setChat(newChat);
      setChatHistory([
        {
          role: "model",
          text: `✅ Analysis complete for **${getRepoName(repoUrl)}**. I'm ready to help! What would you like to know?`,
        },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(`Failed to analyze repository: ${msg}`);
      console.error("Analysis error:", err);
    } finally {
      setIsLoading(false);
      setLoadingMessage("");
    }
  }, []);

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || !chat) return;

    const newUserMessage: ChatMessage = { role: "user", text: message };
    setChatHistory((prev) => [...prev, newUserMessage]);
    setIsChatLoading(true);

    try {
      setChatHistory((prev) => [...prev, { role: "model", text: "" }]);
      const stream = await sendChatMessageStream(chat, message);
      let accumulatedText = "";

      for await (const chunk of stream) {
        const piece = chunk.text;
        if (piece) {
          accumulatedText += piece;
          setChatHistory((prev) => {
            const newHistory = [...prev];
            newHistory[newHistory.length - 1] = { role: "model", text: accumulatedText };
            return newHistory;
          });
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      setChatHistory((prev) => {
        const newHistory = [...prev];
        const lastMessage = newHistory[newHistory.length - 1];
        if (lastMessage.role === "model") {
          lastMessage.text = `Sorry, I ran into an error. ${errorMessage}`;
        } else {
          newHistory.push({ role: "model", text: `Sorry, I ran into an error. ${errorMessage}` });
        }
        return newHistory;
      });
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-gray-900 p-4 text-gray-200 sm:p-6 lg:p-8">
      <div className="w-full max-w-4xl">
        <header className="mb-8 text-center">
          <div className="mb-2 flex items-center justify-center gap-4">
            <GithubIcon className="h-12 w-12 text-white" />
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">GitHub Project Connector</h1>
          </div>
          <p className="flex items-center justify-center gap-2 text-lg text-gray-400">
            Analyze repositories with Gemini <SparklesIcon className="h-5 w-5 text-yellow-400" />
          </p>
        </header>

        <main>
          <GithubInputForm onSubmit={handleAnalyze} isLoading={isLoading} />

          <div className="mt-8">
            {isLoading && (
              <div className="flex flex-col items-center justify-center rounded-lg border border-gray-700 bg-gray-800/50 p-8 text-center">
                <LoadingSpinner />
                <p className="mt-4 text-lg font-medium text-gray-300">
                  {loadingMessage || `Analyzing ${getRepoName(currentRepoUrl)}...`}
                </p>
                <p className="text-gray-400">Please wait a moment.</p>
              </div>
            )}

            {error && (
              <div
                className="relative rounded-lg border border-red-700 bg-red-900/50 px-4 py-3 text-center text-red-300"
                role="alert"
              >
                <strong className="font-bold">Oh no!</strong>
                <span className="ml-2 block sm:inline">{error}</span>
                {currentRepoUrl && (
                  <div className="mt-3">
                    <button
                      onClick={() => handleAnalyze(currentRepoUrl)}
                      className="rounded bg-red-700/40 px-4 py-2 text-sm transition hover:bg-red-600/50"
                    >
                      Try Again
                    </button>
                  </div>
                )}
              </div>
            )}

            {analysis && !isLoading && (
              <div className="space-y-8 animate-fade-in">
                <div>
                  <h2 className="mb-4 text-center text-2xl font-semibold">
                    Analysis for <span className="font-mono text-cyan-400">{getRepoName(currentRepoUrl)}</span>
                  </h2>
                  <AnalysisDisplay result={analysis} />
                </div>
                <div>
                  <ChatInterface messages={chatHistory} onSendMessage={handleSendMessage} isLoading={isChatLoading} />
                </div>
              </div>
            )}

            {!analysis && !isLoading && !error && (
              <div className="rounded-lg border border-dashed border-gray-700 bg-gray-800/50 p-8 text-center">
                <h2 className="text-xl font-medium text-gray-300">Ready to Start</h2>
                <p className="mt-2 text-gray-400">Enter a public GitHub repository URL above to get started.</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default GithubConnector;
