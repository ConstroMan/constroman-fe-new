import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type DragEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { downloadVersion, uploadFile, useAcceptVersion, useDeleteFile, useReprocessVersion, useProject, useProjectFiles, useVersionResult } from "../api/hooks";
import { Permission, type FileVersion, type ProcessingStatus } from "../api/types";
import { can, useMe } from "../auth";
import { EmptyState, Icon, NoPermission, Spinner, paths } from "../components/ui";

interface Upload {
  key: string;
  name: string;
  size: number;
  fraction: number;
  error?: string;
}

const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

type Group = "all" | "processing" | "attention" | "ready";
const groupOf = (status: ProcessingStatus | null): Exclude<Group, "all"> =>
  status === "queued" || status === "processing" ? "processing" : status === "needs_review" || status === "failed" ? "attention" : "ready";
const groups: [Group, string][] = [["all", "All"], ["processing", "Processing"], ["attention", "Needs attention"], ["ready", "Ready"]];

function StatusCell({ version, projectId, canManage }: { version: FileVersion; projectId: string; canManage: boolean }) {
  const status = version.processing_status;
  const review = status === "failed" || status === "needs_review";
  const result = useVersionResult(version.id, review);
  const accept = useAcceptVersion(projectId);
  const reprocess = useReprocessVersion(projectId);
  const sheets = result.data?.sheets ?? [];
  const visible = sheets.filter((sheet) => !sheet.hidden);
  const loadedCount = sheets.filter((sheet) => sheet.loaded.length > 0).length;
  // Sheets that did not load and have something to say; hidden or untouched ones are not worth listing.
  const skipped = sheets.filter((sheet) => !sheet.hidden && sheet.loaded.length === 0 && (sheet.note || sheet.checks.length > 0));
  const pill = (bg: string, fg: string, label: string, icon: string) => (
    <span className="status" style={{ alignSelf: "flex-start", gap: 6, color: fg, background: bg, padding: "3px 10px 3px 8px", borderRadius: 999 }}>
      <Icon d={icon} size={14} stroke={2} />{label}
    </span>
  );
  const note = (text: string) => <span style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.45 }}>{text}</span>;
  const actions = (acceptable: boolean) =>
    canManage && (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {acceptable && (
          <button className="btn sm" type="button" disabled={accept.isPending || reprocess.isPending} onClick={() => accept.mutate(version.id)}>
            {accept.isPending ? <Spinner size={14} /> : "Use the sheets that loaded"}
          </button>
        )}
        <button className="btn ghost sm" type="button" disabled={accept.isPending || reprocess.isPending} onClick={() => reprocess.mutate(version.id)}>
          {reprocess.isPending ? <Spinner size={14} /> : <><Icon d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5" size={14} stroke={2} />Try again</>}
        </button>
      </div>
    );
  const failure = accept.error ?? reprocess.error;

  if (status === "queued")
    return <span className="status" style={{ color: "#4a5060" }}><Icon d={["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 7v5l3 2"]} size={14} stroke={2} />Queued</span>;
  if (status === "processing")
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span className="status busy"><Spinner size={14} />Processing</span>
        <div className="progress bar" style={{ height: 5, maxWidth: 280 }}><div style={{ width: "60%" }} /></div>
      </div>
    );
  if (status === "failed")
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {pill("var(--red-soft)", "var(--red-ink)", "Failed", "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15 9l-6 6M9 9l6 6")}
        {note(result.data?.error ?? "Processing failed.")}
        {actions(false)}
        {failure && <p role="alert" className="error" style={{ fontSize: 12 }}>{failure.message}</p>}
      </div>
    );
  if (status === "needs_review")
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {pill("var(--amber-soft)", "var(--amber-ink)", "Needs review", paths.warn)}
        {result.isPending ? (
          note("Checking what loaded…")
        ) : (
          <>
            {note(
              loadedCount > 0
                ? `${loadedCount} of ${visible.length} sheets loaded. Using them leaves the skipped sheets out of answers and dashboards.`
                : "Nothing loaded from this file, so there is nothing to use yet.",
            )}
            {skipped.length > 0 && (
              <ul style={{ margin: 0, padding: "0 0 0 16px", display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--ink-3)", lineHeight: 1.45 }}>
                {skipped.map((sheet) => (
                  <li key={sheet.name}><span style={{ fontWeight: 500 }}>{sheet.name}</span>: {sheet.note ?? "A check failed, so nothing from this sheet was loaded."}</li>
                ))}
              </ul>
            )}
          </>
        )}
        {actions(loadedCount > 0)}
        {failure && <p role="alert" className="error" style={{ fontSize: 12 }}>{failure.message}</p>}
      </div>
    );
  return (
    <span className="status ok">
      <span style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--green-soft)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        <Icon d={paths.check} size={11} stroke={3} />
      </span>
      {status === "ready" ? "Ready" : "Uploaded"}
    </span>
  );
}

export function Files() {
  const { projectId = "" } = useParams();
  const me = useMe();
  const canView = can(me, Permission.viewFiles);
  const canManage = can(me, Permission.manageFiles);
  const project = useProject(projectId);
  const files = useProjectFiles(projectId, canView);
  const remove = useDeleteFile(projectId);
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [over, setOver] = useState(false);
  const [group, setGroup] = useState<Group>("all");

  if (!canView) return <NoPermission what="Files" />;

  const all = files.data ?? [];
  const shown = all.filter((f) => group === "all" || groupOf(f.current_version.processing_status) === group);

  function patch(key: string, change: Partial<Upload>) {
    setUploads((current) => current.map((u) => (u.key === key ? { ...u, ...change } : u)));
  }

  async function start(list: FileList | File[]) {
    for (const file of Array.from(list)) {
      const key = `${file.name}-${crypto.randomUUID()}`;
      setUploads((current) => [...current, { key, name: file.name, size: file.size, fraction: 0 }]);
      // A file with the same name becomes a new version of the existing one.
      const existing = files.data?.find((f) => f.name === file.name);
      try {
        await uploadFile(projectId, file, (fraction) => patch(key, { fraction }), existing?.id);
        setUploads((current) => current.filter((u) => u.key !== key));
        await queryClient.invalidateQueries({ queryKey: ["files", projectId] });
      } catch (failure) {
        patch(key, { error: failure instanceof Error ? failure.message : "Upload failed" });
      }
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setOver(false);
    if (canManage) void start(event.dataTransfer.files);
  }

  return (
    <>
      <header className="page-head rise">
        <div>
          <p className="crumb"><Link to="/">Projects</Link> / {project.data?.name ?? "…"}</p>
          <h1 className="title">Files</h1>
        </div>
        {canManage && (
          <button className="btn" type="button" onClick={() => input.current?.click()}>
            <Icon d={paths.upload} size={16} stroke={2} />Upload files
          </button>
        )}
      </header>

      {canManage && (
        <section aria-label="Upload" className="rise" style={{ animationDelay: ".06s", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))", gap: 16 }}>
          <label
            className={`drop${over ? " over" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
          >
            <span style={{ width: 52, height: 52, borderRadius: 16, background: "#fff", boxShadow: "0 6px 16px rgba(47,91,234,.18)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", color: "var(--blue)" }}>
              <Icon d={paths.upload} size={24} stroke={2} />
            </span>
            <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontWeight: 600, fontSize: 16 }}>Drop Excel files here</span>
              <span style={{ fontSize: 14, color: "var(--muted)" }}>.xlsx, .xls or .csv, up to 50 MB. Upload a file with the same name to add a new version.</span>
            </span>
            <input ref={input} className="sr-only" type="file" accept=".xlsx,.xls,.csv" multiple onChange={(e) => { if (e.target.files) void start(e.target.files); e.target.value = ""; }} />
          </label>
          {uploads.length > 0 && (
            <div style={{ border: "1px solid var(--line)", borderRadius: 20, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
              {uploads.map((u) => (
                <div key={u.key} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                      <span className="xls">XLS</span>
                      <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                        <span style={{ fontWeight: 500, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis" }}>{u.name}</span>
                        <span className="mono" style={{ fontSize: 13, color: u.error ? "var(--red-ink)" : "var(--faint)" }}>
                          {u.error ?? `${megabytes(u.size * u.fraction)} of ${megabytes(u.size)} · ${Math.round(u.fraction * 100)}%`}
                        </span>
                      </span>
                    </span>
                    {u.error && (
                      <button className="icon-btn" type="button" aria-label="Dismiss" onClick={() => setUploads((c) => c.filter((x) => x.key !== u.key))}>
                        <Icon d={paths.close} size={16} stroke={2} />
                      </button>
                    )}
                  </div>
                  {!u.error && (
                    <div className="progress bar"><div style={{ width: `${u.fraction * 100}%` }} /></div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {files.isPending && <div className="skel" style={{ height: 220, borderRadius: 20 }} aria-busy="true" />}
      {files.error && <p role="alert" className="error">{files.error.message}</p>}

      {files.data?.length === 0 && uploads.length === 0 && (
        <EmptyState
          title="Start with one spreadsheet"
          body="A BOQ or purchase order register is enough to start asking questions."
        >
          {canManage && (
            <button className="btn" type="button" onClick={() => input.current?.click()}>
              <Icon d={paths.upload} size={16} stroke={2} />Upload Excel files
            </button>
          )}
        </EmptyState>
      )}

      {all.length > 0 && (
        <div role="group" aria-label="Filter by status" className="rise" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {groups.map(([id, label]) => (
            <button key={id} type="button" className="pill" aria-pressed={group === id} onClick={() => setGroup(id)}>
              {label}
              <span className="mono" style={{ fontSize: 12, opacity: 0.7 }}>
                {id === "all" ? all.length : all.filter((f) => groupOf(f.current_version.processing_status) === id).length}
              </span>
            </button>
          ))}
        </div>
      )}

      {files.data && files.data.length > 0 && (
        <div className="table-wrap rise" style={{ animationDelay: ".12s" }}>
          <table className="files">
            <thead>
              <tr>
                <th scope="col">File</th>
                <th scope="col">Version</th>
                <th scope="col">Added</th>
                <th scope="col">Status</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((file) => (
                <tr key={file.id}>
                  <td>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <span className="xls">{file.name.split(".").pop()?.slice(0, 3).toUpperCase()}</span>
                      <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                        <span style={{ fontWeight: 500 }}>{file.name}</span>
                        <span style={{ fontSize: 12, color: "var(--faint)" }}>{megabytes(file.current_version.size_bytes)}</span>
                      </span>
                    </div>
                  </td>
                  <td className="mono" style={{ fontSize: 13, color: "var(--ink-3)", whiteSpace: "nowrap" }}>v{file.current_version.version_no}</td>
                  <td style={{ color: "var(--ink-3)" }}>{when(file.current_version.created_at)}</td>
                  <td>
                    <StatusCell version={file.current_version} projectId={projectId} canManage={canManage} />
                  </td>
                  <td>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
                      <button className="icon-btn" type="button" aria-label={`Download ${file.name}`} onClick={() => downloadVersion(file.current_version.id)}>
                        <Icon d={paths.download} size={17} />
                      </button>
                      {canManage && (
                        <button
                          className="icon-btn"
                          type="button"
                          aria-label={`Remove ${file.name} from this project`}
                          disabled={remove.isPending}
                          onClick={() => window.confirm(`Remove ${file.name} from this project?`) && remove.mutate(file.id)}
                        >
                          <Icon d={paths.trash} size={17} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="foot-note">A new version only replaces the old one once it is ready. Until then, answers and dashboards keep using the current version.</p>
    </>
  );
}
