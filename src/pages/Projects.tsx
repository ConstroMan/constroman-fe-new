import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useCreateProject, useProjectAccess, useProjects } from "../api/hooks";
import { Permission } from "../api/types";
import { can, useMe } from "../auth";
import { EmptyState, Icon, Spinner, initials, paths } from "../components/ui";

const tints = [
  { bg: "#fff3db", fg: "#b26b00" },
  { bg: "#eaf0ff", fg: "#2f5bea" },
  { bg: "#e6f6ec", fg: "#0e7a3d" },
];

const created = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/** Needs manage_projects on the API, so team members simply see no avatars. */
function Members({ projectId, enabled }: { projectId: string; enabled: boolean }) {
  const access = useProjectAccess(projectId, enabled);
  const members = access.data ?? [];
  if (members.length === 0) return null;
  return (
    <div className="avatars" aria-label={`${members.length} members`}>
      {members.slice(0, 3).map((member) => (
        <span key={member.id} className="avatar" title={member.name ?? member.email}>{initials(member.name ?? member.email)}</span>
      ))}
      {members.length > 3 && <span className="avatar more">+{members.length - 3}</span>}
    </div>
  );
}

export function Projects() {
  const me = useMe();
  const projects = useProjects();
  const create = useCreateProject();
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const canManage = can(me, Permission.manageProjects);

  const shown = useMemo(
    () => (projects.data ?? []).filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase())),
    [projects.data, query],
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    await create.mutateAsync(name.trim());
    setName("");
    setAdding(false);
  }

  return (
    <>
      <header className="page-head rise">
        <div>
          <p className="crumb">{me.role}</p>
          <h1 className="title" style={{ fontSize: 36 }}>Projects</h1>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <div className="search">
            <label htmlFor="q" className="sr-only">Search projects</label>
            <Icon d={paths.search} size={16} stroke={2} style={{ color: "var(--faint)" }} />
            <input id="q" type="search" placeholder="Search projects" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          {canManage && (
            <button className="btn" type="button" onClick={() => setAdding(true)}>
              <Icon d={paths.plus} size={16} stroke={2.2} />New project
            </button>
          )}
        </div>
      </header>

      {adding && (
        <form className="panel rise" onSubmit={submit} style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="field" style={{ flex: "1 1 260px" }}>
            <label htmlFor="project-name">Project name</label>
            <input id="project-name" className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <button className="btn" type="submit" disabled={create.isPending}>{create.isPending ? <Spinner /> : "Create project"}</button>
          <button className="btn ghost" type="button" onClick={() => setAdding(false)}>Cancel</button>
          {create.error && <p role="alert" className="error" style={{ flexBasis: "100%" }}>{create.error.message}</p>}
        </form>
      )}

      {projects.isPending && (
        <div className="card-grid" aria-busy="true">
          {[0, 1, 2].map((i) => <div key={i} className="skel" style={{ height: 150, borderRadius: 20 }} />)}
        </div>
      )}
      {projects.error && <p role="alert" className="error">{projects.error.message}</p>}

      {projects.data && projects.data.length === 0 && (
        <EmptyState
          title={canManage ? "Create your first project" : "No projects assigned yet"}
          body={canManage ? "A project holds the spreadsheets you will ask questions about." : "Your company owner can give you access to a project."}
        >
          {canManage && <button className="btn" type="button" onClick={() => setAdding(true)}>New project</button>}
        </EmptyState>
      )}

      {shown.length > 0 && (
        <div className="card-grid">
          {shown.map((project, index) => {
            const tint = tints[index % tints.length];
            return (
              <Link key={project.id} to={`/projects/${project.id}/files`} className="pcard rise" style={{ animationDelay: `${0.08 * (index + 1)}s` }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ display: "flex", gap: 14, alignItems: "center", minWidth: 0 }}>
                    <span className="tile-icon" style={{ background: tint.bg, color: tint.fg, fontWeight: 600, fontSize: 15 }}>{initials(project.name)}</span>
                    <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                      <span style={{ fontWeight: 600, fontSize: 18, letterSpacing: "-0.02em" }}>{project.name}</span>
                      <span style={{ fontSize: 13, color: "var(--faint)" }}>Created {created(project.created_at)}</span>
                    </span>
                  </div>
                  <span className="go"><Icon d={paths.arrow} size={16} stroke={2} /></span>
                </div>
                {canManage && <Members projectId={project.id} enabled={canManage} />}
              </Link>
            );
          })}
        </div>
      )}
      {projects.data && projects.data.length > 0 && shown.length === 0 && (
        <p className="foot-note">No projects match “{query}”.</p>
      )}
      <p className="foot-note rise" style={{ animationDelay: ".4s" }}>Team members see only the projects they are assigned to.</p>
    </>
  );
}
