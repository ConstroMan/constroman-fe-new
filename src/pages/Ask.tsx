import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  useAsk,
  useConversation,
  useConversations,
  usePinExchange,
  useProject,
  useProjectFiles,
  useSavePrompt,
  useDeletePrompt,
  useSavedPrompts,
} from "../api/hooks";
import { ApiError } from "../api/client";
import { Permission, type Exchange } from "../api/types";
import { can, useMe } from "../auth";
import { ChartView, ResultTable } from "../components/charts";
import { Icon, NoPermission, Spinner, paths } from "../components/ui";

const MAX = 2000;

function PinButton({ projectId, exchange }: { projectId: string; exchange: Exchange }) {
  const pin = usePinExchange(projectId);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(exchange.chart?.title ?? "");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    await pin.mutateAsync({ exchangeId: exchange.id, name: name.trim() });
    setOpen(false);
  }

  if (pin.isSuccess)
    return (
      <span role="status" className="status ok" style={{ fontSize: 13 }}>
        <Icon d={paths.check} size={14} stroke={2.4} />Pinned. <Link to={`/projects/${projectId}/dashboard`}>View dashboard</Link>
      </span>
    );
  if (!open)
    return (
      <button className="pill" type="button" onClick={() => setOpen(true)}>
        <Icon d={paths.pin} size={14} />Pin to dashboard
      </button>
    );
  return (
    <form onSubmit={submit} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <label className="sr-only" htmlFor={`pin-${exchange.id}`}>Chart name</label>
      <input id={`pin-${exchange.id}`} className="input" style={{ height: 36, fontSize: 14, minWidth: 220 }} autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      <button className="btn sm" type="submit" disabled={pin.isPending || !name.trim()}>{pin.isPending ? <Spinner size={14} /> : "Pin"}</button>
      <button className="btn ghost sm" type="button" onClick={() => setOpen(false)}>Cancel</button>
      {pin.error && <span role="alert" className="error" style={{ flexBasis: "100%", fontSize: 13 }}>{pin.error.message}</span>}
    </form>
  );
}

function ExchangeView({
  projectId,
  exchange,
  canPin,
  canRetry,
  onRetry,
  onSavePrompt,
}: {
  projectId: string;
  exchange: Exchange;
  canPin: boolean;
  canRetry: boolean;
  onRetry: (question: string) => void;
  onSavePrompt: (question: string) => void;
}) {
  const [table, setTable] = useState(false);
  const [saved, setSaved] = useState(false);
  const answered = exchange.status === "answered";
  return (
    <div className="rise" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ alignSelf: "flex-end", maxWidth: "min(560px, 90%)", display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
        <p style={{ margin: 0, padding: "12px 16px", borderRadius: "18px 18px 4px 18px", background: "var(--ink)", color: "#fff", fontSize: 15, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
          {exchange.question}
        </p>
        <button
          type="button"
          className="pill"
          style={{ height: 28, fontSize: 12 }}
          disabled={saved}
          onClick={() => { onSavePrompt(exchange.question); setSaved(true); }}
        >
          {saved ? "Prompt saved" : "Save prompt"}
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 760 }}>
        <p
          style={{
            margin: 0, fontSize: 15, lineHeight: 1.6, whiteSpace: "pre-wrap",
            ...(exchange.status === "answered"
              ? {}
              : { padding: "12px 16px", borderRadius: 14, background: exchange.status === "failed" ? "var(--red-soft)" : exchange.status === "unanswerable" ? "var(--amber-soft)" : "#f3f6ff", color: exchange.status === "failed" ? "var(--red-ink)" : "var(--ink-2)" }),
          }}
        >
          {exchange.answer}
        </p>

        {exchange.status === "needs_input" && <p className="foot-note">Reply in the box below to continue this chat.</p>}
        {exchange.status === "unanswerable" && (
          <p className="foot-note">
            Upload a file that has this data, or rephrase the question. <Link to={`/projects/${projectId}/files`}>Go to files</Link>
          </p>
        )}
        {exchange.status === "failed" && canRetry && (
          <div>
            <button className="btn ghost sm" type="button" onClick={() => onRetry(exchange.question)}>Try again</button>
          </div>
        )}

        {answered && exchange.chart && (
          <section className="panel" aria-label={exchange.chart.title}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{exchange.chart.title}</h3>
            <ChartView chart={exchange.chart} />
          </section>
        )}

        {answered && exchange.columns.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button className="pill" type="button" aria-pressed={table} style={{ alignSelf: "flex-start" }} onClick={() => setTable(!table)}>
              {table ? "Hide table" : "Show table"}
            </button>
            {table && <ResultTable columns={exchange.columns} rows={exchange.rows} truncated={exchange.truncated} />}
          </div>
        )}

        {answered && exchange.sources.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--faint)" }}>Sources</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {exchange.sources.map((source) => (
                <span key={`${source.file}/${source.sheet}`} className="mono" style={{ fontSize: 12, color: "var(--ink-2)", background: "var(--fill)", borderRadius: 999, padding: "5px 10px" }}>
                  {source.file} · {source.sheet}
                </span>
              ))}
            </div>
          </div>
        )}

        {answered && exchange.chart && canPin && <PinButton projectId={projectId} exchange={exchange} />}
      </div>
    </div>
  );
}

export function Ask() {
  const { projectId = "" } = useParams();
  const me = useMe();
  const allowed = can(me, Permission.useChat);
  const canPin = can(me, Permission.pinCharts);
  const [params, setParams] = useSearchParams();
  const conversationId = params.get("c");

  const project = useProject(projectId);
  const files = useProjectFiles(projectId, can(me, Permission.viewFiles));
  const prompts = useSavedPrompts(projectId);
  const savePrompt = useSavePrompt(projectId);
  const deletePrompt = useDeletePrompt(projectId);
  const conversations = useConversations(projectId, allowed);
  const conversation = useConversation(conversationId);
  const ask = useAsk(projectId);

  const [text, setText] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);

  const exchanges = conversation.data?.exchanges ?? [];
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [exchanges.length, pending]);

  if (!allowed) return <NoPermission what="Questions" />;
  const name = project.data?.name ?? "this project";

  const fileList = files.data;
  const noneReady = fileList !== undefined && !fileList.some((f) => f.current_version.processing_status === "ready");
  const processing = fileList?.filter((f) => ["queued", "processing"].includes(f.current_version.processing_status ?? "")) ?? [];
  const waiting = exchanges.at(-1)?.status === "needs_input";

  async function send(question: string) {
    const q = question.trim();
    if (!q || pending) return;
    setPending(q);
    setText("");
    try {
      const exchange = await ask.mutateAsync({ question: q, conversation_id: conversationId ?? undefined });
      if (exchange.conversation_id !== conversationId) setParams({ c: exchange.conversation_id });
    } catch {
      setText(q); // keep the question so it can be edited and sent again
    } finally {
      setPending(null);
    }
  }

  function onKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send(text);
    }
  }

  const notFound = conversationId !== null && conversation.error instanceof ApiError && conversation.error.status === 404;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
      <section aria-label="Conversation" style={{ flex: "999 1 480px", minWidth: 0, display: "flex", flexDirection: "column", gap: 24 }}>
        {noneReady && (
          <p role="status" className="note rise" style={{ background: "#f3f6ff", border: "1px solid #dce5ff" }}>
            <Icon d={paths.info} size={16} stroke={2} style={{ flex: "none", marginTop: 2, color: "var(--blue)" }} />
            <span>
              No file is ready to answer questions yet.
              {processing.length > 0 && ` Still processing: ${processing.map((f) => f.name).join(", ")}.`}{" "}
              <Link to={`/projects/${projectId}/files`}>Check files</Link>
            </span>
          </p>
        )}

        {conversationId !== null && conversation.isPending && <div className="skel" style={{ height: 160, borderRadius: 20 }} aria-busy="true" />}
        {notFound && <p role="alert" className="error">This chat was not found. It may belong to someone else.</p>}
        {conversation.error && !notFound && <p role="alert" className="error">{conversation.error.message}</p>}

        {exchanges.length === 0 && !pending && !conversation.isPending && !notFound && (
          <div className="rise" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <h1 className="title" style={{ fontSize: 28 }}>Ask about {name}</h1>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 15 }}>Answers come from your ready spreadsheets, with the sheets they used.</p>
          </div>
        )}

        {exchanges.map((exchange, index) => (
          <ExchangeView
            key={exchange.id}
            projectId={projectId}
            exchange={exchange}
            canPin={canPin}
            canRetry={index === exchanges.length - 1 && !pending}
            onRetry={(question) => void send(question)}
            onSavePrompt={(question) => savePrompt.mutate(question)}
          />
        ))}

        {pending && (
          <div className="rise" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ alignSelf: "flex-end", maxWidth: "min(560px, 90%)", margin: 0, padding: "12px 16px", borderRadius: "18px 18px 4px 18px", background: "var(--ink)", color: "#fff", fontSize: 15, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{pending}</p>
            <p role="status" className="status busy" style={{ margin: 0 }}><Spinner size={14} />Working on it…</p>
          </div>
        )}

        <form className="composer" onSubmit={(e) => { e.preventDefault(); void send(text); }}>
          <label htmlFor="ask" className="sr-only">Ask about {name}</label>
          <textarea
            id="ask"
            ref={box}
            rows={2}
            maxLength={MAX}
            placeholder={waiting ? "Reply to the question above…" : `Ask about ${name}…`}
            value={text}
            disabled={noneReady || pending !== null}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <span className="foot-note" style={{ color: text.length > MAX - 200 ? "var(--red-ink)" : undefined }}>
              {text.length > MAX - 200 ? `${text.length} / ${MAX}` : "Enter to send, Shift+Enter for a new line"}
            </span>
            <button type="submit" aria-label="Send" className="btn" disabled={noneReady || pending !== null || !text.trim()} style={{ width: 40, height: 40, padding: 0, background: "var(--amber)", color: "#0b0d12" }}>
              {pending ? <Spinner size={16} /> : <Icon d="M12 19V5M5 12l7-7 7 7" stroke={2.2} />}
            </button>
          </div>
        </form>
        {ask.error && <p role="alert" className="error" style={{ marginTop: -12 }}><Icon d={paths.warn} size={16} />{ask.error.message}</p>}
        <div ref={end} />
      </section>

      <aside aria-label="Chats and saved prompts" style={{ flex: "1 1 280px", display: "flex", flexDirection: "column", gap: 28 }}>
        <section style={{ display: "flex", flexDirection: "column", gap: 10 }} aria-label="Recent chats">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Recent chats</h2>
            <button className="btn ghost sm" type="button" disabled={conversationId === null && exchanges.length === 0} onClick={() => { setParams({}); setText(""); }}>
              <Icon d={paths.plus} size={14} stroke={2.2} />New chat
            </button>
          </div>
          {conversations.isPending && <div className="skel" style={{ height: 56 }} aria-busy="true" />}
          {conversations.error && <p role="alert" className="error">{conversations.error.message}</p>}
          {conversations.data?.length === 0 && <p className="foot-note">No chats yet.</p>}
          {conversations.data?.map((chat) => (
            <button
              key={chat.id}
              type="button"
              className="prompt-card"
              aria-current={chat.id === conversationId ? "true" : undefined}
              style={chat.id === conversationId ? { borderColor: "var(--ink)" } : undefined}
              onClick={() => setParams({ c: chat.id })}
            >
              <span style={{ fontSize: 14, lineHeight: 1.4 }}>{chat.title}</span>
              <span style={{ fontSize: 12, color: "var(--faint)" }}>{new Date(chat.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
            </button>
          ))}
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: 10 }} aria-label="Saved prompts">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Saved prompts</h2>
            <span style={{ fontSize: 12, color: "var(--faint)" }}>{name}</span>
          </div>
          {prompts.isPending && <div className="skel" style={{ height: 70 }} aria-busy="true" />}
          {prompts.error && <p role="alert" className="error">{prompts.error.message}</p>}
          {prompts.data?.length === 0 && <p className="foot-note">Use “Save prompt” under a question to keep it here.</p>}
          {prompts.data?.map((prompt) => (
            <div key={prompt.id} className="prompt-card" style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
              <button
                type="button"
                onClick={() => { setText(prompt.content); box.current?.focus(); }}
                style={{ background: "none", border: 0, padding: 0, color: "inherit", textAlign: "left", cursor: "pointer", fontSize: 14, lineHeight: 1.4, flex: 1, minWidth: 0 }}
              >
                {prompt.content}
              </button>
              <button className="icon-btn" type="button" aria-label="Delete saved prompt" disabled={deletePrompt.isPending} onClick={() => deletePrompt.mutate(prompt.id)} style={{ width: 28, height: 28, flex: "none" }}>
                <Icon d={paths.close} size={14} stroke={2} />
              </button>
            </div>
          ))}
        </section>
      </aside>
    </div>
  );
}
