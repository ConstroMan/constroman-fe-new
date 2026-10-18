import { Link, NavLink, Outlet, useParams } from "react-router-dom";
import { useProject } from "../api/hooks";
import { can, useAuth, useMe } from "../auth";
import { Permission } from "../api/types";
import { Icon, Wordmark, initials, paths } from "./ui";

function ProjectNav({ projectId }: { projectId: string }) {
  const me = useMe();
  const project = useProject(projectId);
  const name = project.data?.name ?? "Project";
  const items = [
    { to: "ask", label: "Ask", icon: paths.chat, allowed: can(me, Permission.useChat) },
    { to: "files", label: "Files", icon: paths.file, allowed: can(me, Permission.viewFiles) },
    { to: "dashboard", label: "Dashboard", icon: paths.chart, allowed: can(me, Permission.viewAnalytics) },
  ];
  return (
    <>
      <Link to="/" className="switcher">
        <span
          style={{
            width: 30, height: 30, borderRadius: 9, background: "var(--amber-soft)", color: "var(--amber-ink)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600,
          }}
        >
          {initials(name)}
        </span>
        <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.25, fontSize: 14, fontWeight: 500, flex: 1, minWidth: 0 }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
          <span style={{ fontSize: 12, fontWeight: 400, color: "var(--faint)" }}>Switch project</span>
        </span>
        <Icon d={paths.switcher} size={16} stroke={2} />
      </Link>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {items
          .filter((item) => item.allowed)
          .map((item) => (
            <NavLink key={item.to} to={`/projects/${projectId}/${item.to}`} className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
              <Icon d={item.icon} />
              {item.label}
            </NavLink>
          ))}
      </div>
    </>
  );
}

export function Shell() {
  const { projectId } = useParams();
  const me = useMe();
  const { logOut } = useAuth();
  const display = me.name ?? me.email;
  return (
    <div className="shell">
      <nav className="side" aria-label="Main">
        <div className="brand">
          <img src="/logo-mark.png" alt="" />
          <Wordmark />
        </div>
        {projectId ? (
          <ProjectNav projectId={projectId} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
              <Icon d={paths.grid} />
              All projects
            </NavLink>
            {can(me, Permission.manageTeam) && (
              <NavLink to="/team" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
                <Icon d={paths.team} />
                Team
              </NavLink>
            )}
          </div>
        )}
        <div className="user-chip">
          <span className="avatar">{initials(display)}</span>
          <span style={{ display: "flex", flexDirection: "column", fontSize: 14, fontWeight: 500, lineHeight: 1.3, minWidth: 0, flex: 1 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{display}</span>
            <span style={{ fontSize: 12, fontWeight: 400, color: "var(--faint)" }}>{me.role}</span>
          </span>
          <button className="icon-btn" type="button" aria-label="Sign out" onClick={() => logOut()}>
            <Icon d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" size={16} />
          </button>
        </div>
      </nav>
      <main className="main">
        <div className="main-inner">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
