import { useEffect, useState, type FormEvent } from "react";
import {
  useInvitations,
  useInvite,
  useMembers,
  useProjectAccess,
  useProjects,
  useRemoveMember,
  useRevokeInvitation,
  useRoles,
  useSetProjectAccess,
  useUpdateMember,
} from "../api/hooks";
import { Permission, type Member, type Role } from "../api/types";
import { can, useMe } from "../auth";
import { Icon, NoPermission, Spinner, initials, paths } from "../components/ui";

const added = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function InviteForm({ roles, canPickRole }: { roles: Role[]; canPickRole: boolean }) {
  const invite = useInvite();
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const chosen = roleId || (roles.find((role) => role.name === "Member") ?? roles[0])?.id || "";

  async function submit(event: FormEvent) {
    event.preventDefault();
    await invite.mutateAsync({ email: email.trim(), role_id: chosen });
    setEmail("");
  }

  return (
    <form className="panel rise" onSubmit={submit} style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end" }}>
      <div className="field" style={{ flex: "2 1 260px" }}>
        <label htmlFor="invite-email">Email to invite</label>
        <input id="invite-email" className="input" type="email" required placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="field" style={{ flex: "1 1 180px" }}>
        <label htmlFor="invite-role">Role</label>
        <select id="invite-role" className="input" value={chosen} disabled={!canPickRole || roles.length === 0} onChange={(e) => setRoleId(e.target.value)}>
          {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
        </select>
      </div>
      <button className="btn" type="submit" disabled={invite.isPending || !chosen}>
        {invite.isPending ? <Spinner /> : <><Icon d={paths.plus} size={16} stroke={2.2} />Invite</>}
      </button>
      {invite.error && <p role="alert" className="error" style={{ flexBasis: "100%" }}>{invite.error.message}</p>}
      {!canPickRole && <p className="foot-note" style={{ flexBasis: "100%" }}>Listing roles needs the manage roles permission, so invitations cannot be created from this account.</p>}
      <p className="foot-note" style={{ flexBasis: "100%" }}>
        ConstroMan does not send an email. Tell the person to create an account with exactly this address; they join your company when they sign in.
      </p>
    </form>
  );
}

function MemberRow({ member, roles, selfId, canRole }: { member: Member; roles: Role[]; selfId: string; canRole: boolean }) {
  const update = useUpdateMember();
  const remove = useRemoveMember();
  const isSelf = member.id === selfId;
  const label = member.name ?? member.email;
  return (
    <tr>
      <td>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span className="avatar">{initials(label)}</span>
          <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span style={{ fontWeight: 500 }}>{label}{isSelf && " (you)"}</span>
            {member.name && <span style={{ fontSize: 12, color: "var(--faint)" }}>{member.email}</span>}
          </span>
        </div>
      </td>
      <td>
        <label className="sr-only" htmlFor={`role-${member.id}`}>Role of {label}</label>
        <select
          id={`role-${member.id}`}
          className="input"
          style={{ height: 40, fontSize: 14 }}
          value={member.role_id}
          disabled={!canRole || isSelf || update.isPending}
          onChange={(e) => update.mutate({ id: member.id, role_id: e.target.value })}
        >
          {roles.length === 0 && <option value={member.role_id}>…</option>}
          {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
        </select>
      </td>
      <td>
        <button
          type="button"
          className="pill"
          aria-pressed={member.is_active}
          disabled={isSelf || update.isPending}
          onClick={() => update.mutate({ id: member.id, is_active: !member.is_active })}
        >
          {member.is_active ? "Active" : "Deactivated"}
        </button>
        {update.error && <p role="alert" className="error" style={{ fontSize: 12 }}>{update.error.message}</p>}
      </td>
      <td>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            className="icon-btn"
            type="button"
            aria-label={`Remove ${label} from the company`}
            disabled={isSelf || remove.isPending}
            onClick={() => window.confirm(`Remove ${label} from the company?`) && remove.mutate(member.id)}
          >
            <Icon d={paths.trash} size={17} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function ProjectAccess({ members }: { members: Member[] }) {
  const projects = useProjects();
  const [projectId, setProjectId] = useState("");
  const current = projectId || projects.data?.[0]?.id || "";
  const access = useProjectAccess(current, current !== "");
  const save = useSetProjectAccess(current);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (access.data) setPicked(new Set(access.data.map((m) => m.id)));
  }, [access.data]);

  function toggle(id: string) {
    setPicked((now) => {
      const next = new Set(now);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  if (projects.data?.length === 0) return <p className="foot-note">Create a project to assign members to it.</p>;

  return (
    <section className="panel rise" aria-label="Project access">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Project access</h2>
        <div>
          <label className="sr-only" htmlFor="access-project">Project</label>
          <select id="access-project" className="input" style={{ height: 40, fontSize: 14 }} value={current} onChange={(e) => setProjectId(e.target.value)}>
            {projects.data?.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </div>
      </div>
      <p className="foot-note">Members with the manage projects permission see every project. Everyone else sees only the projects ticked here.</p>
      {access.isPending && current !== "" && <div className="skel" style={{ height: 80 }} aria-busy="true" />}
      {access.error && <p role="alert" className="error">{access.error.message}</p>}
      {access.data && (
        <>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
            {members.filter((m) => m.is_active).map((member) => (
              <li key={member.id}>
                <label style={{ display: "flex", gap: 10, alignItems: "center", minHeight: 40, fontSize: 14, cursor: "pointer" }}>
                  <input type="checkbox" checked={picked.has(member.id)} onChange={() => toggle(member.id)} style={{ width: 18, height: 18 }} />
                  {member.name ?? member.email}
                  {member.name && <span style={{ color: "var(--faint)", fontSize: 12 }}>{member.email}</span>}
                </label>
              </li>
            ))}
          </ul>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button className="btn sm" type="button" disabled={save.isPending} onClick={() => save.mutate([...picked])}>
              {save.isPending ? <Spinner size={14} /> : "Save access"}
            </button>
            {save.isSuccess && <span role="status" className="foot-note">Saved</span>}
            {save.error && <span role="alert" className="error">{save.error.message}</span>}
          </div>
        </>
      )}
    </section>
  );
}

export function Team() {
  const me = useMe();
  const canTeam = can(me, Permission.manageTeam);
  const canRoles = can(me, Permission.manageRoles);
  const members = useMembers(canTeam);
  const invitations = useInvitations(canTeam);
  const roles = useRoles(canTeam && canRoles);
  const revoke = useRevokeInvitation();

  if (!canTeam) return <NoPermission what="Team settings" />;

  const roleList = roles.data ?? [];
  const roleName = (id: string) => roleList.find((role) => role.id === id)?.name ?? "—";
  const pending = (invitations.data ?? []).filter((invitation) => invitation.status === "pending");

  return (
    <>
      <header className="page-head rise">
        <div>
          <p className="crumb">Company</p>
          <h1 className="title">Team</h1>
        </div>
      </header>

      <InviteForm roles={roleList} canPickRole={canRoles} />

      {members.isPending && <div className="skel" style={{ height: 180, borderRadius: 20 }} aria-busy="true" />}
      {members.error && <p role="alert" className="error">{members.error.message}</p>}
      {members.data && (
        <div className="table-wrap rise">
          <table className="files" style={{ minWidth: 640 }}>
            <thead>
              <tr>
                <th scope="col">Member</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {members.data.map((member) => (
                <MemberRow key={member.id} member={member} roles={roleList} selfId={me.id} canRole={canRoles} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section aria-label="Pending invitations" className="panel rise">
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Pending invitations</h2>
        {invitations.error && <p role="alert" className="error">{invitations.error.message}</p>}
        {invitations.data && pending.length === 0 && <p className="foot-note">No pending invitations.</p>}
        {pending.map((invitation) => (
          <div key={invitation.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontWeight: 500, fontSize: 14 }}>{invitation.email}</span>
              <span style={{ fontSize: 12, color: "var(--faint)" }}>{roleName(invitation.role_id)} · invited {added(invitation.created_at)}</span>
            </span>
            <button className="btn ghost sm" type="button" disabled={revoke.isPending} onClick={() => revoke.mutate(invitation.id)}>
              Revoke
            </button>
          </div>
        ))}
        {revoke.error && <p role="alert" className="error">{revoke.error.message}</p>}
      </section>

      {members.data && <ProjectAccess members={members.data} />}
    </>
  );
}
