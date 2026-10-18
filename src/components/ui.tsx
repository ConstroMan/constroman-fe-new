import type { ReactNode, SVGProps } from "react";
import { Link } from "react-router-dom";

type IconProps = { d: string | string[]; size?: number; stroke?: number } & Omit<
  SVGProps<SVGSVGElement>,
  "d" | "stroke"
>;

export function Icon({ d, size = 18, stroke = 1.8, ...rest }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {(Array.isArray(d) ? d : [d]).map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}

export const paths = {
  arrow: "M5 12h14M13 6l6 6-6 6",
  plus: "M12 5v14M5 12h14",
  upload: "M12 16V4M6 10l6-6 6 6M4 20h16",
  download: "M12 4v12M6 10l6 6 6-6M4 20h16",
  grid: ["M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"],
  chat: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z",
  file: ["M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z", "M14 3v5h5"],
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  search: ["M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z", "M20 20l-4-4"],
  lock: ["M5 11h14v10H5z", "M8 11V8a4 4 0 0 1 8 0v3"],
  warn: "M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  info: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 11v5M12 8h.01"],
  check: "M5 12l5 5L20 7",
  close: "M6 6l12 12M18 6L6 18",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  pin: "M12 17v5M9 3h6l-1 6 4 4H6l4-4z",
  play: "M8 5l11 7-11 7z",
  team: ["M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1", "M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z", "M21 20v-1a4 4 0 0 0-3-3.9M15.5 4.2a3.5 3.5 0 0 1 0 6.6"],
  switcher: "M8 9l4-4 4 4M8 15l4 4 4-4",
};

export function Wordmark() {
  return (
    <span className="wordmark" role="img" aria-label="ConstroMan">
      <span aria-hidden="true">CONSTR</span>
      <i aria-hidden="true" />
      <b aria-hidden="true">MAN</b>
    </span>
  );
}

export function EmptyState({
  title,
  body,
  children,
  icon,
}: {
  title: string;
  body: string;
  children?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <section className="empty rise">
      {icon}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h2>{title}</h2>
        <p>{body}</p>
      </div>
      {children}
    </section>
  );
}

export function NoPermission({ what }: { what: string }) {
  return (
    <EmptyState
      title={`${what} are not part of your role`}
      body="Ask your company owner to add it to your role."
      icon={
        <span
          style={{
            width: 84,
            height: 84,
            borderRadius: 26,
            background: "var(--fill)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon d={paths.lock} size={38} />
        </span>
      }
    >
      <Link className="btn ghost" to="/">
        Back to projects
      </Link>
    </EmptyState>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return <Icon d="M12 3a9 9 0 1 1-9 9" className="spin" size={size} stroke={2.4} />;
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

export function ago(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}
