// Mirrors constroman-api/app/api/schemas.
export interface Me {
  id: string;
  email: string;
  name: string | null;
  company_id: string;
  role: string;
  permissions: string[];
}

export interface Project {
  id: string;
  name: string;
  created_at: string;
}

export type ProcessingStatus = "queued" | "processing" | "ready" | "needs_review" | "failed";

export interface FileVersion {
  id: string;
  version_no: number;
  original_name: string;
  size_bytes: number;
  sha256: string | null;
  status: "pending_upload" | "uploaded";
  processing_status: ProcessingStatus | null;
  created_at: string;
}

export interface ProjectFile {
  id: string;
  name: string;
  kind: string;
  current_version: FileVersion;
}

export interface StartUpload {
  file_id: string;
  version_id: string;
  upload_url: string;
}

export interface Chart {
  id: string;
  name: string;
  sql: string;
  spec: Record<string, unknown>;
  pinned: boolean;
}

export interface SavedPrompt {
  id: string;
  content: string;
  tags: string[];
  created_at: string;
}

// Permission names from constroman-api/app/core/permissions.py.
export const Permission = {
  manageFiles: "manage_files",
  viewFiles: "view_files",
  useChat: "use_chat",
  manageProjects: "manage_projects",
  manageTeam: "manage_team",
  manageRoles: "manage_roles",
  viewAnalytics: "view_analytics",
  pinCharts: "pin_charts",
} as const;

export interface AccessMember {
  id: string;
  name: string | null;
  email: string;
  designation: string | null;
}

/** The API stores the layout as free-form JSON; the web app keeps the chart order in it. */
export interface DashboardLayout {
  order?: string[];
}

export interface SheetResult {
  name: string;
  hidden: boolean;
  role: string | null;
  note: string | null;
  checks: Record<string, unknown>[];
  loaded: unknown[];
}

export interface VersionResult {
  status: ProcessingStatus | null;
  error: string | null;
  sheets: SheetResult[];
  datasets: { id: string; name: string; table_name: string }[];
}

export interface Member {
  id: string;
  email: string;
  name: string | null;
  designation: string | null;
  role_id: string;
  is_active: boolean;
}

export interface Invitation {
  id: string;
  email: string;
  role_id: string;
  status: string;
  created_at: string;
}

export interface Role {
  id: string;
  name: string;
  permissions: string[];
}

export type ExchangeStatus = "answered" | "needs_input" | "unanswerable" | "failed";

/** Shared by an answer's chart and a dashboard tile; each chart type fills only its own series. */
export interface ChartData {
  type: string;
  title: string;
  x_label: string | null;
  y_label: string | null;
  y2_label: string | null;
  x: (string | number)[] | null;
  y: (number | null)[] | null;
  y2: (number | null)[] | null;
  labels: string[] | null;
  values: (number | null)[] | null;
  columns: string[];
  rows: unknown[][];
  truncated: boolean;
  refreshed_at: string;
}

export interface TileData extends ChartData {
  id: string;
  name: string;
}

export interface Exchange {
  id: string;
  conversation_id: string;
  question: string;
  status: ExchangeStatus;
  answer: string;
  sql: string | null;
  columns: string[];
  rows: unknown[][];
  truncated: boolean;
  sources: { file: string; sheet: string }[];
  chart: ChartData | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
}

export interface ConversationDetail extends Conversation {
  exchanges: Exchange[];
}
