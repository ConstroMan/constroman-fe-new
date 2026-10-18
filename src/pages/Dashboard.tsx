import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useChartData, useDashboardCharts, useDashboardLayout, useDeleteChart, useProject, useSaveLayout, useUnpinChart } from "../api/hooks";
import type { Chart } from "../api/types";
import { ChartView } from "../components/charts";
import { Permission } from "../api/types";
import { can, useMe } from "../auth";
import { EmptyState, Icon, NoPermission, Spinner, ago, paths } from "../components/ui";

/** Re-runs the stored query on the API (no model call) and draws the result by chart type. */
function TileBody({ chart, projectId, canPin }: { chart: Chart; projectId: string; canPin: boolean }) {
  const data = useChartData(chart.id, true);
  const unpin = useUnpinChart(projectId);
  const remove = useDeleteChart(projectId);

  if (data.isPending) return <div className="skel" style={{ height: 180 }} aria-busy="true" />;
  if (data.error)
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <p role="alert" className="error"><Icon d={paths.warn} size={16} />{data.error.message}</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn ghost sm" type="button" onClick={() => data.refetch()}>Retry</button>
          {canPin && (
            <>
              <button className="btn ghost sm" type="button" disabled={unpin.isPending} onClick={() => unpin.mutate(chart.id)}>Unpin</button>
              <button className="btn ghost sm" type="button" disabled={remove.isPending} onClick={() => window.confirm(`Delete ${chart.name}?`) && remove.mutate(chart.id)}>Delete</button>
            </>
          )}
        </div>
      </div>
    );
  return (
    <>
      <ChartView chart={data.data} />
      <p className="foot-note" style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <span>{data.isFetching ? "Updating…" : `Updated ${ago(data.data.refreshed_at)}`}</span>
      </p>
    </>
  );
}

export function Dashboard() {
  const { projectId = "" } = useParams();
  const me = useMe();
  const allowed = can(me, Permission.viewAnalytics);
  const project = useProject(projectId);
  const charts = useDashboardCharts(projectId, allowed);
  const unpin = useUnpinChart(projectId);
  const layout = useDashboardLayout(projectId, allowed);
  const saveLayout = useSaveLayout(projectId);
  const queryClient = useQueryClient();
  const refreshing = useIsFetching({ queryKey: ["chart-data"] }) > 0;
  const [draft, setDraft] = useState<string[] | null>(null);
  const editing = draft !== null;

  const ordered = useMemo(() => {
    const saved = draft ?? layout.data?.order ?? [];
    const rank = (id: string) => {
      const at = saved.indexOf(id);
      return at === -1 ? saved.length : at;
    };
    return [...(charts.data ?? [])].sort((a, b) => rank(a.id) - rank(b.id));
  }, [charts.data, layout.data, draft]);

  function move(index: number, by: number) {
    const ids = ordered.map((chart) => chart.id);
    const [id] = ids.splice(index, 1);
    ids.splice(index + by, 0, id);
    setDraft(ids);
  }

  function toggleEdit() {
    if (!editing) return setDraft(ordered.map((chart) => chart.id));
    saveLayout.mutate({ ...layout.data, order: draft }, { onSuccess: () => setDraft(null) });
  }

  if (!allowed) return <NoPermission what="Dashboards" />;

  return (
    <>
      <header className="page-head rise">
        <div>
          <p className="crumb"><Link to="/">Projects</Link> / {project.data?.name ?? "…"}</p>
          <h1 className="title">Dashboard</h1>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {charts.data && charts.data.length > 0 && (
          <button className="btn ghost sm" type="button" disabled={refreshing} onClick={() => queryClient.invalidateQueries({ queryKey: ["chart-data"] })}>
            {refreshing ? <Spinner size={14} /> : <Icon d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5" size={14} stroke={2} />}Refresh all
          </button>
        )}
        {charts.data && charts.data.length > 1 && (
          <button className={`btn ghost sm${editing ? " on" : ""}`} type="button" aria-pressed={editing} disabled={saveLayout.isPending} onClick={toggleEdit}>
            {saveLayout.isPending ? <Spinner size={14} /> : editing ? "Done" : "Edit layout"}
          </button>
        )}
        </div>
      </header>
      {saveLayout.error && <p role="alert" className="error">{saveLayout.error.message}</p>}
      <p className="foot-note rise" style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Icon d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5" size={15} stroke={2} style={{ color: "var(--green)" }} />
        Pinned charts keep their query and show the latest ready file versions each time they load.
      </p>

      {charts.isPending && <div className="skel" style={{ height: 260, borderRadius: 22 }} aria-busy="true" />}
      {charts.error && <p role="alert" className="error">{charts.error.message}</p>}

      {charts.data?.length === 0 && (
        <EmptyState title="Nothing pinned yet" body="Ask a question, then pin the answer's chart to keep it here.">
          {can(me, Permission.useChat) && <Link className="btn" to={`/projects/${projectId}/ask`}>Go to Ask</Link>}
        </EmptyState>
      )}

      {charts.data && charts.data.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))", gap: 16 }}>
          {ordered.map((chart, index) => (
            <section key={chart.id} className={`panel rise${editing ? " editing" : ""}`} aria-label={chart.name} style={{ animationDelay: `${0.08 * index}s` }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{chart.name}</h2>
                {editing && (
                  <div style={{ display: "flex", gap: 2 }}>
                    <button className="icon-btn" type="button" aria-label={`Move ${chart.name} earlier`} disabled={index === 0} onClick={() => move(index, -1)}>
                      <Icon d="M6 15l6-6 6 6" size={16} stroke={2} />
                    </button>
                    <button className="icon-btn" type="button" aria-label={`Move ${chart.name} later`} disabled={index === ordered.length - 1} onClick={() => move(index, 1)}>
                      <Icon d="M6 9l6 6 6-6" size={16} stroke={2} />
                    </button>
                  </div>
                )}
                {!editing && can(me, Permission.pinCharts) && (
                  <button className="icon-btn" type="button" aria-label={`Unpin ${chart.name}`} disabled={unpin.isPending} onClick={() => unpin.mutate(chart.id)}>
                    <Icon d={paths.close} size={16} stroke={2} />
                  </button>
                )}
              </div>
              <TileBody chart={chart} projectId={projectId} canPin={can(me, Permission.pinCharts)} />
            </section>
          ))}
        </div>
      )}
    </>
  );
}
