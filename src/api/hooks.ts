import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "./client";
import type { Conversation, ConversationDetail, Exchange, TileData, Invitation, Member, Role, ProcessingStatus, VersionResult, AccessMember, Chart, DashboardLayout, ProjectFile, Project, SavedPrompt, StartUpload } from "./types";

export const useProjects = () =>
  useQuery({ queryKey: ["projects"], queryFn: () => request<Project[]>("GET", "/projects") });

export const useProject = (projectId: string) =>
  useQuery({
    queryKey: ["projects", projectId],
    queryFn: () => request<Project>("GET", `/projects/${projectId}`),
  });

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => request<Project>("POST", "/projects", { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });
}

const inFlight: (ProcessingStatus | null)[] = ["queued", "processing"];

/** Polls every 3 s while any current version is still being processed. */
export const useProjectFiles = (projectId: string, enabled: boolean) =>
  useQuery({
    queryKey: ["files", projectId],
    queryFn: () => request<ProjectFile[]>("GET", `/projects/${projectId}/files`),
    enabled,
    refetchInterval: (query) =>
      query.state.data?.some((f) => inFlight.includes(f.current_version.processing_status)) ? 3000 : false,
  });

export const useVersionResult = (versionId: string, enabled: boolean) =>
  useQuery({
    queryKey: ["version-result", versionId],
    queryFn: () => request<VersionResult>("GET", `/file-versions/${versionId}/result`),
    enabled,
  });

export function useDeleteFile(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fileId: string) => request<void>("DELETE", `/projects/${projectId}/files/${fileId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["files", projectId] }),
  });
}

export async function downloadVersion(versionId: string): Promise<void> {
  const { url } = await request<{ url: string }>("GET", `/file-versions/${versionId}/download`);
  window.location.assign(url);
}

/** start -> PUT straight to S3 -> complete; the API hashes the object on complete. */
export async function uploadFile(
  projectId: string,
  file: File,
  onProgress: (fraction: number) => void,
  fileId?: string,
): Promise<void> {
  const started = await request<StartUpload>("POST", `/projects/${projectId}/uploads`, {
    filename: file.name,
    size_bytes: file.size,
    file_id: fileId,
  });
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", started.upload_url);
    xhr.upload.onprogress = (event) => event.lengthComputable && onProgress(event.loaded / event.total);
    xhr.onload = () =>
      xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection and try again."));
    xhr.send(file);
  });
  await request("POST", `/file-versions/${started.version_id}/complete`);
}

export const useDashboardCharts = (projectId: string, enabled: boolean) =>
  useQuery({
    queryKey: ["dashboard", projectId],
    queryFn: () => request<Chart[]>("GET", `/projects/${projectId}/dashboard/charts`),
    enabled,
  });

export function useUnpinChart(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (chartId: string) => request<Chart>("DELETE", `/charts/${chartId}/pin`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dashboard", projectId] }),
  });
}

export const useSavedPrompts = (projectId: string) =>
  useQuery({
    queryKey: ["prompts", projectId],
    queryFn: () => request<SavedPrompt[]>("GET", `/projects/${projectId}/prompts`),
  });

export function useSavePrompt(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      request<SavedPrompt>("POST", `/projects/${projectId}/prompts`, { content, tags: [] }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["prompts", projectId] }),
  });
}

export function useDeletePrompt(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (promptId: string) => request<void>("DELETE", `/projects/${projectId}/prompts/${promptId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["prompts", projectId] }),
  });
}

export const useProjectAccess = (projectId: string, enabled: boolean) =>
  useQuery({
    queryKey: ["access", projectId],
    queryFn: () => request<AccessMember[]>("GET", `/projects/${projectId}/access`),
    enabled,
  });

export const useDashboardLayout = (projectId: string, enabled: boolean) =>
  useQuery({
    queryKey: ["layout", projectId],
    queryFn: async () => (await request<{ layout: DashboardLayout }>("GET", `/projects/${projectId}/layout`)).layout,
    enabled,
  });

export function useSaveLayout(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (layout: DashboardLayout) =>
      request<{ layout: DashboardLayout }>("PUT", `/projects/${projectId}/layout`, { layout }),
    onSuccess: (saved) => queryClient.setQueryData(["layout", projectId], saved.layout),
  });
}

export const useMembers = (enabled: boolean) =>
  useQuery({ queryKey: ["members"], queryFn: () => request<Member[]>("GET", "/team/members"), enabled });

export const useInvitations = (enabled: boolean) =>
  useQuery({
    queryKey: ["invitations"],
    queryFn: () => request<Invitation[]>("GET", "/team/invitations"),
    enabled,
  });

export const useRoles = (enabled: boolean) =>
  useQuery({ queryKey: ["roles"], queryFn: () => request<Role[]>("GET", "/roles"), enabled });

export function useInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; role_id: string }) =>
      request<Invitation>("POST", "/team/invitations", body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invitations"] }),
  });
}

export function useRevokeInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request<void>("DELETE", `/team/invitations/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invitations"] }),
  });
}

export function useUpdateMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; role_id?: string; is_active?: boolean }) =>
      request<Member>("PATCH", `/team/members/${id}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["members"] }),
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request<void>("DELETE", `/team/members/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["members"] }),
  });
}

export function useSetProjectAccess(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userIds: string[]) => request<void>("PUT", `/projects/${projectId}/access`, { user_ids: userIds }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["access", projectId] }),
  });
}

export function useAsk(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { question: string; conversation_id?: string }) =>
      request<Exchange>("POST", `/projects/${projectId}/ask`, body),
    onSuccess: (exchange) => {
      // Seed the cache so the new answer shows without a second round trip.
      queryClient.setQueryData<ConversationDetail>(["conversation", exchange.conversation_id], (old) => ({
        id: exchange.conversation_id,
        title: old?.title ?? exchange.question.slice(0, 60),
        created_at: old?.created_at ?? exchange.created_at,
        exchanges: [...(old?.exchanges ?? []), exchange],
      }));
      queryClient.invalidateQueries({ queryKey: ["conversations", projectId] });
    },
  });
}

export const useConversations = (projectId: string, enabled: boolean) =>
  useQuery({
    queryKey: ["conversations", projectId],
    queryFn: () => request<Conversation[]>("GET", `/projects/${projectId}/conversations`),
    enabled,
  });

export const useConversation = (conversationId: string | null) =>
  useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () => request<ConversationDetail>("GET", `/conversations/${conversationId}`),
    enabled: conversationId !== null,
  });

export function usePinExchange(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ exchangeId, name }: { exchangeId: string; name: string }) =>
      request<Chart>("POST", `/exchanges/${exchangeId}/pin`, { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dashboard", projectId] }),
  });
}

/** Re-runs the stored query on the API; no model call. */
export const useChartData = (chartId: string, enabled: boolean) =>
  useQuery({
    queryKey: ["chart-data", chartId],
    queryFn: () => request<TileData>("GET", `/charts/${chartId}/data`),
    enabled,
    retry: false,
  });

export function useDeleteChart(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (chartId: string) => request<void>("DELETE", `/charts/${chartId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dashboard", projectId] }),
  });
}

/** After accept or reprocess the version changes status, so the files list and its result are stale. */
function useVersionAction(projectId: string, action: "accept" | "reprocess") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) => request<unknown>("POST", `/file-versions/${versionId}/${action}`),
    onSuccess: (_data, versionId) => {
      queryClient.invalidateQueries({ queryKey: ["files", projectId] });
      queryClient.invalidateQueries({ queryKey: ["version-result", versionId] });
    },
  });
}

export const useAcceptVersion = (projectId: string) => useVersionAction(projectId, "accept");
export const useReprocessVersion = (projectId: string) => useVersionAction(projectId, "reprocess");
