import type { ChartData } from "../api/types";

const COLORS = ["#2f5bea", "#ffb020", "#0e1116", "#9db3ff", "#d5d9e0", "#12a150", "#e07a00", "#6d3fd8"];
const GRID = "#eef0f3";
const AXIS = "#c9ced8";
const TEXT = "#3a404d";
const FAINT = "#6b7180";

const grouped = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });

/** Row cells can arrive as numeric strings ("1250000.50"); chart series are already numbers. */
export function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && /^-?(0|[1-9]\d*)(\.\d+)?$/.test(value.trim())) return Number(value);
  return null;
}

export const formatNumber = (value: number) => grouped.format(value);

const ISO_DATE = /^\d{4}-\d{2}(-\d{2})?/;

function label(value: unknown): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const date = new Date(value.slice(0, 10));
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });
  }
  return String(value ?? "");
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

function niceStep(raw: number): number {
  const power = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / power;
  return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power;
}

function makeScale(series: (number | null)[][], includeZero: boolean) {
  const flat = series.flat().filter((v): v is number => v !== null);
  let lo = flat.length ? Math.min(...flat) : 0;
  let hi = flat.length ? Math.max(...flat) : 1;
  if (includeZero) {
    lo = Math.min(0, lo);
    hi = Math.max(0, hi);
  }
  if (lo === hi) hi = lo + 1;
  const step = niceStep((hi - lo) / 4);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toFixed(10)));
  return { lo, hi, ticks };
}

interface Series {
  name: string;
  values: (number | null)[];
  color: string;
}

const W = 640;
const H = 270;
const M = { left: 58, right: 16, top: 26, bottom: 48 };

function Legend({ series }: { series: Series[] }) {
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: "var(--muted)" }}>
      {series.map((s) => (
        <span key={s.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
          {s.name}
        </span>
      ))}
    </div>
  );
}

function Cartesian({ kind, chart, series, x }: { kind: "bar" | "line"; chart: ChartData; series: Series[]; x: unknown[] }) {
  const n = x.length;
  if (n === 0) return <EmptyChart />;
  const scale = makeScale(series.map((s) => s.values), kind === "bar");
  const innerW = W - M.left - M.right;
  const innerH = H - M.top - M.bottom;
  const y = (v: number) => M.top + innerH - ((v - scale.lo) / (scale.hi - scale.lo)) * innerH;
  const zero = y(Math.max(scale.lo, Math.min(0, scale.hi)));
  const slot = innerW / n;
  const cx = (i: number) => (kind === "bar" || n === 1 ? M.left + slot * (i + 0.5) : M.left + (innerW * i) / (n - 1));
  const every = Math.ceil(n / 10);
  const tilt = n > 6;

  return (
    <svg
      role="img"
      aria-label={`${chart.title}. ${kind === "bar" ? "Bar" : "Line"} chart of ${series.map((s) => s.name).join(" and ")} across ${n} points.`}
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: "auto" }}
    >
      {chart.y_label && <text x={M.left} y={12} fontSize={11} fill={FAINT}>{chart.y_label}</text>}
      {scale.ticks.map((tick) => (
        <g key={tick}>
          <path d={`M${M.left} ${y(tick)}H${W - M.right}`} stroke={GRID} />
          <text x={M.left - 8} y={y(tick) + 4} fontSize={11} fill={FAINT} textAnchor="end" fontFamily="var(--mono)">{compact.format(tick)}</text>
        </g>
      ))}
      <path d={`M${M.left} ${zero}H${W - M.right}`} stroke={AXIS} />

      {kind === "bar" &&
        series.map((s, si) => {
          const barW = Math.min(44, (slot * 0.72) / series.length);
          return s.values.map((v, i) => {
            if (v === null) return null;
            const left = cx(i) - (barW * series.length) / 2 + si * barW;
            const top = Math.min(y(v), zero);
            return (
              <rect key={`${si}-${i}`} x={left + 1} y={top} width={Math.max(barW - 2, 1)} height={Math.max(Math.abs(y(v) - zero), 1)} rx={4} fill={s.color}>
                <title>{`${label(x[i])}, ${s.name}: ${formatNumber(v)}`}</title>
              </rect>
            );
          });
        })}

      {kind === "line" &&
        series.map((s) => {
          const segments: string[] = [];
          let open = false;
          s.values.forEach((v, i) => {
            if (v === null) {
              open = false;
              return;
            }
            segments.push(`${open ? "L" : "M"}${cx(i).toFixed(1)} ${y(v).toFixed(1)}`);
            open = true;
          });
          return (
            <g key={s.name}>
              <path d={segments.join("")} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              {n <= 40 &&
                s.values.map((v, i) =>
                  v === null ? null : (
                    <circle key={i} cx={cx(i)} cy={y(v)} r={3.5} fill="#fff" stroke={s.color} strokeWidth={2}>
                      <title>{`${label(x[i])}, ${s.name}: ${formatNumber(v)}`}</title>
                    </circle>
                  ),
                )}
            </g>
          );
        })}

      {x.map((value, i) =>
        i % every === 0 ? (
          <text
            key={i}
            x={cx(i)}
            y={H - M.bottom + 18}
            fontSize={11}
            fill={TEXT}
            textAnchor={tilt ? "end" : "middle"}
            transform={tilt ? `rotate(-35 ${cx(i)} ${H - M.bottom + 18})` : undefined}
          >
            {clip(label(value), 12)}
          </text>
        ) : null,
      )}
      {chart.x_label && <text x={W - M.right} y={H - 4} fontSize={11} fill={FAINT} textAnchor="end">{chart.x_label}</text>}
    </svg>
  );
}

function Pie({ chart }: { chart: ChartData }) {
  const labels = chart.labels ?? [];
  const values = (chart.values ?? []).map((v) => Math.max(v ?? 0, 0));
  const total = values.reduce((a, b) => a + b, 0);
  if (labels.length === 0 || total === 0) return <EmptyChart />;
  let offset = 0;
  return (
    <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
      <svg
        role="img"
        aria-label={`${chart.title}. ${labels.map((l, i) => `${l} ${Math.round((values[i] / total) * 100)}%`).join(", ")}`}
        width={160}
        height={160}
        viewBox="0 0 160 160"
      >
        <g transform="rotate(-90 80 80)" fill="none" strokeWidth={22}>
          {values.map((v, i) => {
            const share = (v / total) * 100;
            const circle = (
              <circle key={i} cx={80} cy={80} r={58} pathLength={100} stroke={COLORS[i % COLORS.length]} strokeDasharray={`${share} ${100 - share}`} strokeDashoffset={-offset}>
                <title>{`${labels[i]}: ${formatNumber(v)}`}</title>
              </circle>
            );
            offset += share;
            return circle;
          })}
        </g>
        <text x={80} y={78} textAnchor="middle" fontSize={20} fontWeight={600} fill="#0e1116">{compact.format(total)}</text>
        <text x={80} y={96} textAnchor="middle" fontSize={11} fill={FAINT}>{chart.y_label ?? "total"}</text>
      </svg>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8, fontSize: 13, flex: 1, minWidth: 140 }}>
        {labels.map((l, i) => (
          <li key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: COLORS[i % COLORS.length], flex: "none" }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{l}</span>
            <span className="mono" style={{ marginLeft: "auto" }}>{Math.round((values[i] / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmptyChart() {
  return <p className="foot-note">There is nothing to draw for this chart.</p>;
}

export function ResultTable({ columns, rows, truncated }: { columns: string[]; rows: unknown[][]; truncated: boolean }) {
  if (columns.length === 0) return <EmptyChart />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div className="table-wrap" style={{ maxHeight: 320, overflow: "auto", borderRadius: 14 }}>
        <table className="files" style={{ minWidth: 0 }}>
          <thead>
            <tr>
              {columns.map((c) => <th key={c} scope="col" style={{ position: "sticky", top: 0, background: "#fff" }}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {columns.map((c, i) => {
                  const cell = row[i];
                  const num = toNumber(cell);
                  return (
                    <td key={c} className={num === null ? undefined : "mono"} style={{ padding: "10px 12px", textAlign: num === null ? "left" : "right", whiteSpace: "nowrap" }}>
                      {cell === null || cell === undefined ? "—" : num === null ? String(cell) : formatNumber(num)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {truncated && <p className="foot-note">Showing the first 200 rows.</p>}
    </div>
  );
}

/** Pairs x with its series and orders by x when x is a date or a number, since query order is not guaranteed. */
function ordered(x: (string | number)[], ...series: ((number | null)[] | null)[]) {
  const index = x.map((_, i) => i);
  if (x.every((v) => typeof v === "number" || (typeof v === "string" && ISO_DATE.test(v)))) {
    index.sort((a, b) => (x[a] < x[b] ? -1 : x[a] > x[b] ? 1 : 0));
  }
  return { x: index.map((i) => x[i]), series: series.map((s) => (s ? index.map((i) => s[i] ?? null) : null)) };
}

export function ChartView({ chart }: { chart: ChartData }) {
  const yName = chart.y_label ?? "Value";
  switch (chart.type) {
    case "BarChart":
    case "LineChart": {
      const { x, series } = ordered(chart.x ?? [], chart.y);
      return <Cartesian kind={chart.type === "BarChart" ? "bar" : "line"} chart={chart} x={x} series={[{ name: yName, values: series[0] ?? [], color: COLORS[0] }]} />;
    }
    case "DoubleBarChart":
    case "DualLineChart": {
      const { x, series } = ordered(chart.x ?? [], chart.y, chart.y2);
      const list: Series[] = [
        { name: chart.y_label ?? "First", values: series[0] ?? [], color: COLORS[0] },
        { name: chart.y2_label ?? "Second", values: series[1] ?? [], color: COLORS[1] },
      ];
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Legend series={list} />
          <Cartesian kind={chart.type === "DoubleBarChart" ? "bar" : "line"} chart={chart} x={x} series={list} />
        </div>
      );
    }
    case "PieChart":
      return <Pie chart={chart} />;
    default:
      return <ResultTable columns={chart.columns} rows={chart.rows} truncated={chart.truncated} />;
  }
}
