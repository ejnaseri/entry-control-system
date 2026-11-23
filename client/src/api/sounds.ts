import { api } from "./client";

export type SoundAsset = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  durationMs: number;
  createdAt: string;
};

export type SoundSettings = {
  id: string;
  enabled: boolean;
  accessAllowedSoundId?: string | null;
  accessDeniedSoundId?: string | null;
  alertSoundId?: string | null;
  accessAllowedVolume: number;
  accessDeniedVolume: number;
  alertVolume: number;
};

export async function listSoundAssets() {
  const res = await api.get<SoundAsset[]>("/api/v1/sounds");
  return res.data;
}

export async function uploadSoundAsset(file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await api.post<SoundAsset>("/api/v1/sounds/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function deleteSoundAsset(id: string) {
  const res = await api.delete<SoundAsset>(`/api/v1/sounds/${id}`);
  return res.data;
}

export async function getSoundSettings() {
  const res = await api.get<SoundSettings>("/api/v1/sounds/settings");
  return res.data;
}

export async function updateSoundSettings(payload: Partial<SoundSettings>) {
  const res = await api.put<SoundSettings>("/api/v1/sounds/settings", payload);
  return res.data;
}

export function getSoundAssetUrl(id: string) {
  const base = api.defaults.baseURL ?? window.location.origin;
  return new URL(`/api/v1/sounds/${id}`, base).toString();
}
