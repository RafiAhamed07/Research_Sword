"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/* -------------------------------------------------------------------------- */
/*  Config & types                                                            */
/* -------------------------------------------------------------------------- */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
const TOP_K = 5;
const THEME_KEY = "research-sword-theme";

type Theme = "light" | "dark";
const MAX_UPLOAD_MB = 50;

interface DocumentItem {
  document_id: string;
  project_id: string;
  filename: string;
  total_pages: number;
  total_chunks: number;
  uploaded_at: string;
}

interface Citation {
  source_id: string;
  document_id: string;
  page_number: number;
  distance: number;
  passage: string;
}

interface Timing {
  retrieval_ms: number;
  llm_ms: number;
  total_ms: number;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
  citations?: Citation[];
  timing_ms?: Timing;
}

interface Notice {
  id: number;
  tone: "error" | "success";
  text: string;
}

const SUGGESTIONS = [
  "What methods does this paper use?",
  "Which datasets were evaluated, and how large are they?",
  "What are the main limitations the authors acknowledge?",
];

/* -------------------------------------------------------------------------- */
/*  API helpers                                                               */
/* -------------------------------------------------------------------------- */

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") return body.detail;
  } catch {
    /* response had no JSON body */
  }
  return fallback;
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

/* -------------------------------------------------------------------------- */
/*  Small presentational pieces                                               */
/* -------------------------------------------------------------------------- */

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** Renders answer text and turns [S1]-style markers into buttons. */
function AnswerText({
  text,
  citations,
  onCite,
}: {
  text: string;
  citations: Citation[];
  onCite: (sourceId: string) => void;
}) {
  const known = useMemo(() => new Set(citations.map((c) => c.source_id)), [citations]);
  const parts = text.split(/(\[[^\]]+\])/g);

  return (
    <p className="whitespace-pre-wrap text-[15px] leading-7 text-neutral-800 [.dark_&]:text-neutral-200">
      {parts.map((part, i) => {
        const match = part.match(/^\[([^\]]+)\]$/);
        if (match && known.has(match[1])) {
          return (
            <button
              key={i}
              type="button"
              onClick={() => onCite(match[1])}
              className="mx-0.5 rounded bg-indigo-50 [.dark_&]:bg-indigo-500/10 px-1.5 py-0.5 align-baseline text-xs font-semibold text-indigo-700 [.dark_&]:text-indigo-300 ring-1 ring-inset ring-indigo-200 [.dark_&]:ring-indigo-500/30 hover:bg-indigo-100 [.dark_&]:hover:bg-indigo-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              {match[1]}
            </button>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </p>
  );
}

function EvidenceList({
  citations,
  openId,
  setOpenId,
  getDocName,
}: {
  citations: Citation[];
  openId: string | null;
  setOpenId: (id: string | null) => void;
  getDocName: (id: string) => string;
}) {
  return (
    <div className="mt-5 border-t border-neutral-200 [.dark_&]:border-neutral-800 pt-4">
      <h3 className="text-sm font-semibold text-neutral-900 [.dark_&]:text-neutral-100">
        Evidence <span className="font-normal text-neutral-500 [.dark_&]:text-neutral-400">({citations.length} passages)</span>
      </h3>
      <ul className="mt-3 space-y-2">
        {citations.map((cit) => {
          const open = openId === cit.source_id;
          return (
            <li
              key={cit.source_id}
              id={`evidence-${cit.source_id}`}
              className={`rounded-lg border bg-white [.dark_&]:bg-neutral-900 transition-colors ${
                open ? "border-indigo-300 [.dark_&]:border-indigo-500/60" : "border-neutral-200 [.dark_&]:border-neutral-800"
              }`}
            >
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : cit.source_id)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg"
              >
                <span className="rounded bg-indigo-50 [.dark_&]:bg-indigo-500/10 px-1.5 py-0.5 text-xs font-semibold text-indigo-700 [.dark_&]:text-indigo-300">
                  {cit.source_id}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-neutral-800 [.dark_&]:text-neutral-200">
                  {getDocName(cit.document_id)}
                </span>
                <span className="shrink-0 text-xs text-neutral-500 [.dark_&]:text-neutral-400">p. {cit.page_number}</span>
                <span
                  className="shrink-0 text-xs tabular-nums text-neutral-400 [.dark_&]:text-neutral-500"
                  title="Match distance (lower is closer)"
                >
                  d {Number(cit.distance).toFixed(3)}
                </span>
                <svg
                  className={`h-4 w-4 shrink-0 text-neutral-400 [.dark_&]:text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M5.2 7.5 10 12.3l4.8-4.8-1-1L10 10.3 6.2 6.5z" />
                </svg>
              </button>
              {open && (
                <blockquote className="mx-3 mb-3 border-l-2 border-indigo-200 [.dark_&]:border-indigo-500/40 pl-3 text-sm leading-6 text-neutral-600 [.dark_&]:text-neutral-300 whitespace-pre-wrap">
                  {cit.passage}
                </blockquote>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AssistantMessage({
  msg,
  getDocName,
}: {
  msg: ChatMessage;
  getDocName: (id: string) => string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const citations = msg.citations ?? [];

  const handleCite = (id: string) => {
    setOpenId(id);
    requestAnimationFrame(() =>
      document
        .getElementById(`evidence-${id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    );
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  if (msg.isError) {
    return (
      <div
        role="alert"
        className="max-w-3xl rounded-xl border border-red-200 [.dark_&]:border-red-900 bg-red-50 [.dark_&]:bg-red-950/50 px-4 py-3 text-sm text-red-800 [.dark_&]:text-red-200"
      >
        {msg.content}
      </div>
    );
  }

  return (
    <div className="max-w-3xl rounded-xl border border-neutral-200 [.dark_&]:border-neutral-800 bg-white [.dark_&]:bg-neutral-900 px-5 py-4 shadow-sm">
      <AnswerText text={msg.content} citations={citations} onCite={handleCite} />

      {citations.length > 0 && (
        <EvidenceList
          citations={citations}
          openId={openId}
          setOpenId={setOpenId}
          getDocName={getDocName}
        />
      )}

      <div className="mt-4 flex items-center justify-between text-xs text-neutral-500 [.dark_&]:text-neutral-400">
        {msg.timing_ms ? (
          <span className="tabular-nums">
            Search {msg.timing_ms.retrieval_ms} ms · Answer {msg.timing_ms.llm_ms} ms · Total{" "}
            {msg.timing_ms.total_ms} ms
          </span>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={copy}
          className="rounded px-2 py-1 font-medium text-neutral-600 [.dark_&]:text-neutral-300 hover:bg-neutral-100 [.dark_&]:hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          {copied ? "Copied" : "Copy answer"}
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main component                                                            */
/* -------------------------------------------------------------------------- */

export default function ResearchWorkspace() {
  const [projectInput, setProjectInput] = useState("research-project-001");
  const [projectId, setProjectId] = useState("research-project-001");
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const [query, setQuery] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [notices, setNotices] = useState<Notice[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {
      /* storage unavailable: keep default */
    }
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* storage unavailable: preference lasts for this session only */
    }
  };

  const feedRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatAbort = useRef<AbortController | null>(null);

  /* ---- notices --------------------------------------------------------- */

  const notify = useCallback((tone: Notice["tone"], text: string) => {
    const id = Date.now() + Math.random();
    setNotices((prev) => [...prev, { id, tone, text }]);
    setTimeout(() => setNotices((prev) => prev.filter((n) => n.id !== id)), 5000);
  }, []);

  /* ---- project id (debounced) ------------------------------------------ */

  useEffect(() => {
    const trimmed = projectInput.trim();
    if (!trimmed || trimmed === projectId) return;
    const t = setTimeout(() => {
      setProjectId(trimmed);
      setSelectedDocId(null);
      setMessages([]);
    }, 500);
    return () => clearTimeout(t);
  }, [projectInput, projectId]);

  /* ---- documents ------------------------------------------------------- */

  const fetchDocuments = useCallback(
    async (projId: string) => {
      setLoadingDocs(true);
      try {
        const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(projId)}/documents`);
        if (!res.ok) throw new Error(await readError(res, "Could not load papers."));
        const data = await res.json();
        setDocuments(data.documents ?? []);
      } catch (err) {
        setDocuments([]);
        notify("error", err instanceof Error ? err.message : "Could not load papers.");
      } finally {
        setLoadingDocs(false);
      }
    },
    [notify]
  );

  useEffect(() => {
    fetchDocuments(projectId);
  }, [projectId, fetchDocuments]);

  const uploadFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      notify("error", "Only PDF files are supported.");
      return;
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      notify("error", `${file.name} is larger than ${MAX_UPLOAD_MB} MB.`);
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("project_id", projectId);

    try {
      const res = await fetch(`${API_BASE}/documents/upload`, { method: "POST", body: formData });
      if (!res.ok) throw new Error(await readError(res, "Upload failed."));
      await fetchDocuments(projectId);
      notify("success", `${file.name} was indexed.`);
    } catch (err) {
      notify(
        "error",
        err instanceof TypeError
          ? "Could not reach the server. Check your connection and try again."
          : err instanceof Error
          ? err.message
          : "Upload failed."
      );
    } finally {
      setUploading(false);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) await uploadFile(file);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file && !uploading) await uploadFile(file);
  };

  const deleteDocument = async (docId: string) => {
    setConfirmDeleteId(null);
    try {
      const res = await fetch(
        `${API_BASE}/projects/${encodeURIComponent(projectId)}/documents/${docId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(await readError(res, "Could not delete paper."));
      if (selectedDocId === docId) setSelectedDocId(null);
      await fetchDocuments(projectId);
      notify("success", "Paper deleted.");
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Could not delete paper.");
    }
  };

  /* ---- chat ------------------------------------------------------------ */

  const sendQuery = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (!text || loadingChat) return;

      setQuery("");
      setMessages((prev) => [...prev, { id: uid(), role: "user", content: text }]);
      setLoadingChat(true);

      const controller = new AbortController();
      chatAbort.current = controller;

      try {
        const res = await fetch(`${API_BASE}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: projectId,
            query: text,
            top_k: TOP_K,
            document_id: selectedDocId,
          }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(await readError(res, "The assistant could not answer."));
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: "assistant",
            content: data.answer,
            citations: data.citations ?? [],
            timing_ms: data.timing_ms,
          },
        ]);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: "assistant",
            isError: true,
            content:
              err instanceof TypeError
                ? "Could not reach the server. Check your connection and try again."
                : err instanceof Error
                ? err.message
                : "Something went wrong.",
          },
        ]);
      } finally {
        setLoadingChat(false);
        chatAbort.current = null;
      }
    },
    [loadingChat, projectId, selectedDocId]
  );

  const cancelQuery = () => chatAbort.current?.abort();

  useEffect(() => () => chatAbort.current?.abort(), []);

  /* ---- UX niceties ----------------------------------------------------- */

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loadingChat]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendQuery(query);
    }
  };

  const docNameById = useMemo(
    () => new Map(documents.map((d) => [d.document_id, d.filename])),
    [documents]
  );
  const getDocName = useCallback(
    (id: string) => docNameById.get(id) ?? `Document ${id.slice(0, 8)}`,
    [docNameById]
  );

  const scopeLabel = selectedDocId ? getDocName(selectedDocId) : "All papers in this project";

  /* ---- render ---------------------------------------------------------- */

  const sidebar = (
    <aside className="flex h-full w-80 flex-col border-r border-neutral-200 [.dark_&]:border-neutral-800 bg-white [.dark_&]:bg-neutral-900">
      <div className="border-b border-neutral-200 [.dark_&]:border-neutral-800 p-5">
        <h1 className="text-base font-semibold text-neutral-900 [.dark_&]:text-neutral-100">Research Sword</h1>
        <p className="mt-0.5 text-sm text-neutral-500 [.dark_&]:text-neutral-400">Your personal AI research assistant</p>

        <label htmlFor="project-id" className="mt-5 block text-sm font-medium text-neutral-700 [.dark_&]:text-neutral-300">
          Project
        </label>
        <input
          id="project-id"
          type="text"
          value={projectInput}
          onChange={(e) => setProjectInput(e.target.value)}
          spellCheck={false}
          className="mt-1.5 w-full rounded-lg border border-neutral-300 [.dark_&]:border-neutral-700 bg-white [.dark_&]:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 [.dark_&]:text-neutral-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
      </div>

      <div className="p-5 pb-3">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-5 text-center text-sm transition-colors focus-within:ring-2 focus-within:ring-indigo-500 ${
            dragActive
              ? "border-indigo-500 bg-indigo-50 [.dark_&]:bg-indigo-500/10"
              : "border-neutral-300 [.dark_&]:border-neutral-700 bg-neutral-50 [.dark_&]:bg-neutral-950 hover:bg-neutral-100 [.dark_&]:hover:bg-neutral-800"
          } ${uploading ? "pointer-events-none opacity-70" : ""}`}
        >
          {uploading ? (
            <span className="flex items-center gap-2 font-medium text-neutral-700 [.dark_&]:text-neutral-300">
              <Spinner /> Indexing paper…
            </span>
          ) : (
            <>
              <span className="font-medium text-neutral-800 [.dark_&]:text-neutral-200">Upload a PDF</span>
              <span className="mt-0.5 text-xs text-neutral-500 [.dark_&]:text-neutral-400">
                Drop a file here or click to browse (up to {MAX_UPLOAD_MB} MB)
              </span>
            </>
          )}
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={handleFileInput}
            disabled={uploading}
            className="sr-only"
          />
        </label>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-700 [.dark_&]:text-neutral-300">Papers ({documents.length})</h2>
          {selectedDocId && (
            <button
              type="button"
              onClick={() => setSelectedDocId(null)}
              className="text-xs font-medium text-indigo-700 [.dark_&]:text-indigo-300 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
            >
              Search all
            </button>
          )}
        </div>

        <ul className="space-y-1.5">
          <li>
            <button
              type="button"
              aria-pressed={selectedDocId === null}
              onClick={() => setSelectedDocId(null)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                selectedDocId === null
                  ? "bg-indigo-50 [.dark_&]:bg-indigo-500/10 font-medium text-indigo-800 [.dark_&]:text-indigo-200"
                  : "text-neutral-700 [.dark_&]:text-neutral-300 hover:bg-neutral-100 [.dark_&]:hover:bg-neutral-800"
              }`}
            >
              All papers in project
            </button>
          </li>

          {loadingDocs && documents.length === 0 && (
            <li className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-500 [.dark_&]:text-neutral-400">
              <Spinner /> Loading papers…
            </li>
          )}

          {!loadingDocs && documents.length === 0 && (
            <li className="px-3 py-2 text-sm text-neutral-500 [.dark_&]:text-neutral-400">
              No papers yet. Upload a PDF to start asking questions.
            </li>
          )}

          {documents.map((doc) => {
            const active = selectedDocId === doc.document_id;
            const confirming = confirmDeleteId === doc.document_id;
            return (
              <li
                key={doc.document_id}
                className={`group rounded-lg border transition-colors ${
                  active ? "border-indigo-300 [.dark_&]:border-indigo-500/60 bg-indigo-50 [.dark_&]:bg-indigo-500/10" : "border-transparent hover:bg-neutral-100 [.dark_&]:hover:bg-neutral-800"
                }`}
              >
                {confirming ? (
                  <div className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
                    <span className="text-neutral-700 [.dark_&]:text-neutral-300">Delete this paper?</span>
                    <span className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => deleteDocument(doc.document_id)}
                        className="rounded px-2 py-1 text-xs font-medium text-red-700 [.dark_&]:text-red-300 hover:bg-red-50 [.dark_&]:hover:bg-red-950/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded px-2 py-1 text-xs font-medium text-neutral-600 [.dark_&]:text-neutral-300 hover:bg-neutral-200 [.dark_&]:hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                      >
                        Cancel
                      </button>
                    </span>
                  </div>
                ) : (
                  <div className="flex items-start">
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSelectedDocId(doc.document_id)}
                      className="min-w-0 flex-1 rounded-lg px-3 py-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    >
                      <span
                        className={`block truncate text-sm ${
                          active ? "font-medium text-indigo-900 [.dark_&]:text-indigo-100" : "text-neutral-800 [.dark_&]:text-neutral-200"
                        }`}
                        title={doc.filename}
                      >
                        {doc.filename}
                      </span>
                      <span className="mt-0.5 block text-xs text-neutral-500 [.dark_&]:text-neutral-400">
                        {doc.total_pages} pages · {doc.total_chunks} passages
                        {formatDate(doc.uploaded_at) && ` · ${formatDate(doc.uploaded_at)}`}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(doc.document_id)}
                      aria-label={`Delete ${doc.filename}`}
                      className="m-1.5 rounded p-1.5 text-neutral-400 [.dark_&]:text-neutral-500 opacity-0 hover:bg-white [.dark_&]:hover:bg-neutral-800 hover:text-red-600 [.dark_&]:hover:text-red-400 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 group-hover:opacity-100"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                        <path d="M8 2a1 1 0 0 0-1 1v1H4v2h12V4h-3V3a1 1 0 0 0-1-1H8ZM5 7l.7 9a2 2 0 0 0 2 1.8h4.6a2 2 0 0 0 2-1.8L15 7H5Z" />
                      </svg>
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );

  return (
    <div className={theme === "dark" ? "dark" : ""} style={{ colorScheme: theme }}>
    <div className="flex h-screen bg-neutral-50 [.dark_&]:bg-neutral-950 text-neutral-900 [.dark_&]:text-neutral-100 antialiased">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">{sidebar}</div>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="shadow-xl">{sidebar}</div>
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={() => setSidebarOpen(false)}
            className="flex-1 bg-neutral-900/40 [.dark_&]:bg-black/60"
          />
        </div>
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-neutral-200 [.dark_&]:border-neutral-800 bg-white [.dark_&]:bg-neutral-900 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Open sidebar"
              onClick={() => setSidebarOpen(true)}
              className="rounded p-1.5 text-neutral-600 [.dark_&]:text-neutral-300 hover:bg-neutral-100 [.dark_&]:hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 lg:hidden"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path d="M3 5h14v1.5H3V5Zm0 4.25h14v1.5H3v-1.5ZM3 13.5h14V15H3v-1.5Z" />
              </svg>
            </button>
            <p className="truncate text-sm">
              <span className="text-neutral-500 [.dark_&]:text-neutral-400">Searching: </span>
              <span className="font-medium text-neutral-900 [.dark_&]:text-neutral-100">{scopeLabel}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            className="shrink-0 rounded-lg p-2 text-neutral-600 [.dark_&]:text-neutral-300 hover:bg-neutral-100 [.dark_&]:hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            {theme === "dark" ? (
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path d="M10 14a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-12.5a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 1.5Zm0 13.5a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 15ZM1.5 10a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5A.75.75 0 0 1 1.5 10Zm13.5 0a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5A.75.75 0 0 1 15 10ZM4.2 4.2a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 0 1-1.06 1.06L4.2 5.26a.75.75 0 0 1 0-1.06Zm9.48 9.48a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 1 1-1.06 1.06l-1.06-1.06a.75.75 0 0 1 0-1.06ZM15.8 4.2a.75.75 0 0 1 0 1.06l-1.06 1.06a.75.75 0 1 1-1.06-1.06l1.06-1.06a.75.75 0 0 1 1.06 0ZM6.32 13.68a.75.75 0 0 1 0 1.06L5.26 15.8a.75.75 0 1 1-1.06-1.06l1.06-1.06a.75.75 0 0 1 1.06 0Z" />
              </svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path d="M17.3 12.4A7.5 7.5 0 0 1 7.6 2.7a.75.75 0 0 0-.95-.95A8.5 8.5 0 1 0 18.25 13.35a.75.75 0 0 0-.95-.95Z" />
              </svg>
            )}
          </button>
        </header>

        <div ref={feedRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-6" aria-live="polite">
          {messages.length === 0 ? (
            <div className="mx-auto mt-16 max-w-xl">
              <h2 className="text-xl font-semibold text-neutral-900 [.dark_&]:text-neutral-100">
                Ask a question about your papers
              </h2>
              <p className="mt-2 text-sm leading-6 text-neutral-600 [.dark_&]:text-neutral-300">
                Each answer cites the passages it came from, with page numbers, so you can check
                every claim against the source.
              </p>
              <ul className="mt-6 space-y-2">
                {SUGGESTIONS.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      disabled={documents.length === 0}
                      onClick={() => sendQuery(s)}
                      className="w-full rounded-lg border border-neutral-200 [.dark_&]:border-neutral-800 bg-white [.dark_&]:bg-neutral-900 px-4 py-3 text-left text-sm text-neutral-800 [.dark_&]:text-neutral-200 hover:border-indigo-300 [.dark_&]:hover:border-indigo-500/60 hover:bg-indigo-50/40 [.dark_&]:hover:bg-indigo-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
              {documents.length === 0 && (
                <p className="mt-4 text-sm text-neutral-500 [.dark_&]:text-neutral-400">Upload a paper to enable questions.</p>
              )}
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-5">
              {messages.map((msg) =>
                msg.role === "user" ? (
                  <div key={msg.id} className="flex justify-end">
                    <div className="max-w-xl whitespace-pre-wrap rounded-xl bg-indigo-700 [.dark_&]:bg-indigo-600 px-4 py-2.5 text-sm leading-6 text-white">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div key={msg.id} className="flex justify-start">
                    <AssistantMessage msg={msg} getDocName={getDocName} />
                  </div>
                )
              )}

              {loadingChat && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-xl border border-neutral-200 [.dark_&]:border-neutral-800 bg-white [.dark_&]:bg-neutral-900 px-4 py-3 text-sm text-neutral-600 [.dark_&]:text-neutral-300">
                    <Spinner /> Searching passages and writing an answer…
                    <button
                      type="button"
                      onClick={cancelQuery}
                      className="ml-2 rounded px-2 py-0.5 text-xs font-medium text-indigo-700 [.dark_&]:text-indigo-300 hover:bg-indigo-50 [.dark_&]:hover:bg-indigo-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendQuery(query);
          }}
          className="border-t border-neutral-200 [.dark_&]:border-neutral-800 bg-white [.dark_&]:bg-neutral-900 px-4 py-4 sm:px-6"
        >
          <div className="mx-auto flex max-w-3xl items-end gap-3">
            <label htmlFor="question" className="sr-only">
              Your question
            </label>
            <textarea
              id="question"
              ref={textareaRef}
              rows={1}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about methods, datasets, results, or limitations"
              className="max-h-40 flex-1 resize-none rounded-lg border border-neutral-300 [.dark_&]:border-neutral-700 bg-white [.dark_&]:bg-neutral-900 px-3.5 py-2.5 text-sm text-neutral-900 [.dark_&]:text-neutral-100 placeholder:text-neutral-400 [.dark_&]:placeholder:text-neutral-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            <button
              type="submit"
              disabled={loadingChat || !query.trim()}
              className="rounded-lg bg-indigo-700 [.dark_&]:bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-800 [.dark_&]:hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 [.dark_&]:focus-visible:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Ask
            </button>
          </div>
          <p className="mx-auto mt-2 max-w-3xl text-xs text-neutral-500 [.dark_&]:text-neutral-400">
            Press Enter to send, Shift+Enter for a new line.
          </p>
        </form>
      </main>

      {/* Notices */}
      <div className="pointer-events-none fixed bottom-6 right-6 z-50 space-y-2" role="status">
        {notices.map((n) => (
          <div
            key={n.id}
            className={`pointer-events-auto max-w-sm rounded-lg px-4 py-3 text-sm shadow-lg ${
              n.tone === "error"
                ? "border border-red-200 [.dark_&]:border-red-900 bg-red-50 [.dark_&]:bg-red-950/50 text-red-800 [.dark_&]:text-red-200"
                : "border border-emerald-200 [.dark_&]:border-emerald-900 bg-emerald-50 [.dark_&]:bg-emerald-950/60 text-emerald-800 [.dark_&]:text-emerald-200"
            }`}
          >
            {n.text}
          </div>
        ))}
      </div>
    </div>
    </div>
  );
}