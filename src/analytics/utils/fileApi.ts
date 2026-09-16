import { apiFetch } from '../../config';

export type AnalyticsCloudFile = {
  id: string;
  filename: string;
  size: number;
  createdAt: number;
  updatedAt: number;
};

async function readError(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({}));
  return body.error || `HTTP ${res.status}`;
}

export async function listAnalyticsFiles(): Promise<AnalyticsCloudFile[]> {
  const res = await apiFetch('/api/analytics/files');
  if (!res.ok) throw new Error(await readError(res));
  const json = await res.json();
  return Array.isArray(json.files) ? json.files : [];
}

export async function uploadAnalyticsFile(file: File): Promise<AnalyticsCloudFile> {
  const form = new FormData();
  form.append('file', file);
  const res = await apiFetch('/api/analytics/files', { method: 'POST', body: form });
  if (!res.ok) throw new Error(await readError(res));
  const json = await res.json();
  return json.file as AnalyticsCloudFile;
}

export async function renameAnalyticsFile(id: string, filename: string): Promise<AnalyticsCloudFile> {
  const res = await apiFetch(`/api/analytics/files/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename })
  });
  if (!res.ok) throw new Error(await readError(res));
  const json = await res.json();
  return json.file as AnalyticsCloudFile;
}

export async function downloadAnalyticsFile(id: string): Promise<ArrayBuffer> {
  const res = await apiFetch(`/api/analytics/files/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(await readError(res));
  return res.arrayBuffer();
}
