import axios from 'axios';

// Interfaces based on our api_reference.md

export interface LanguageProfile {
  id?: number;
  character_id?: string;
  language_code: string;
  is_native?: boolean;
  accent_description?: string;
}

export interface Character {
  id: string;
  name: string;
  alias?: string | null;
  voice_id: string;
  prompt_style?: string;
  pitch_override?: string;
  gender?: 'male' | 'female';
  age_category?: 'child' | 'young' | 'adult' | 'elderly';
  sample_audio_url?: string;
  sample_prompt_hash?: string;
  language_profiles?: LanguageProfile[];
}

export interface VoiceDefinition {
  id: string;
  gender: 'male' | 'female';
  sample_audio_url?: string;
}

export interface DiscoveredCharacter {
  discovered_name: string;
  traits: string;
  gender: string;
  age_category: string;
  action: 'use_existing' | 'create_new';
  existing_character_id?: string;
  suggested_voice_id?: string;
  suggested_pitch_override?: string;
}

export interface Project {
  id?: string;
  title: string;
  language_code?: string;
  tts_model?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
  total_scenes?: number;
  completed_scenes?: number;
}

export interface LineAudioTake {
  id: number;
  audio_url: string;
  take_number: number;
  created_at: string;
}

export interface SceneLine {
  id?: number;
  scene_id?: string;
  character_id?: string | null;
  text: string;
  phonetic_text?: string | null;
  prompt_override?: string;
  language_override?: string;
  is_manual_phonetics?: boolean;
  audio_url?: string;
  audio_takes?: LineAudioTake[];
  order_index?: number;
}

export interface Scene {
  id?: string;
  project_id: string;
  title: string;
  raw_text?: string;
  script_json?: unknown; // Represents the breakdown of dialogues
  status?: 'draft' | 'processing' | 'extracted' | 'completed' | 'error';
  lines?: SceneLine[];
  audio_url?: string;
  created_at?: string;
  updated_at?: string;
}

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';

// Axios instance configured to point to our backend API
export const api = axios.create({
  baseURL: `${BACKEND_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
});

export class ApiError extends Error {
  status?: number;
  detail?: any;

  constructor(message: string, status?: number, detail?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

// #16: Global response interceptor — normalise all API errors into a clean
// ApiError object so callers don't have to inspect axios internals.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const detail = error.response?.data?.detail;
    const message: string =
      (typeof detail === 'string' ? detail : error.response?.data?.message) ??
      error.message ??
      'Unknown error';
    return Promise.reject(new ApiError(message, status, detail));
  },
);

export function getAudioUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return '';
  const parts = pathOrUrl.split('?');
  const cleanPath = parts[0];
  const queryParams = parts.length > 1 ? `&${parts[1]}` : '';

  if (cleanPath.startsWith('/static/')) {
    return BACKEND_URL + cleanPath + (parts.length > 1 ? `?${parts[1]}` : '');
  }
  return `${BACKEND_URL}/api/v1/projects/stream-audio?path=${encodeURIComponent(cleanPath)}${queryParams}`;
}

// Helper services for clean React Query integration
export const projectService = {
  getProjects: () => api.get<Project[]>('/projects').then((res) => res.data),
  getProject: (id: string) =>
    api.get<Project>(`/projects/${id}`).then((res) => res.data),
  createProject: (data: Partial<Project>) =>
    api.post<Project>('/projects', data).then((res) => res.data),
  updateProject: (id: string, data: Partial<Project>) =>
    api.put<Project>(`/projects/${id}`, data).then((res) => res.data),
  deleteProject: (id: string) =>
    api.delete(`/projects/${id}`).then((res) => res.data),

  uploadBook: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api
      .post(`/projects/${id}/upload-book`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((res) => res.data);
  },

  getProjectCharacters: (id: string) =>
    api.get<Character[]>(`/projects/${id}/characters`).then((res) => res.data),
  linkCharacter: (projectId: string, characterId: string) =>
    api
      .post(`/projects/${projectId}/characters/${characterId}`)
      .then((res) => res.data),
  updateCharacterAlias: (
    projectId: string,
    characterId: string,
    alias: string,
  ) =>
    api
      .put(`/projects/${projectId}/characters/${characterId}/alias`, { alias })
      .then((res) => res.data),
  swapCharacter: (
    projectId: string,
    oldCharacterId: string,
    newCharacterId: string,
  ) =>
    api
      .post(`/projects/${projectId}/characters/swap`, {
        old_character_id: oldCharacterId,
        new_character_id: newCharacterId,
      })
      .then((res) => res.data),
  unlinkCharacter: (projectId: string, characterId: string) =>
    api
      .delete(`/projects/${projectId}/characters/${characterId}`)
      .then((res) => res.data),
  discoverCharacters: (projectId: string, rawText: string) =>
    api
      .post<
        DiscoveredCharacter[]
      >(`/projects/${projectId}/characters/discover`, { raw_text: rawText })
      .then((res) => res.data),
  batchSaveCharacters: (
    projectId: string,
    suggestions: DiscoveredCharacter[],
  ) =>
    api
      .post(`/projects/${projectId}/characters/batch`, { suggestions })
      .then((res) => res.data),
};

export const characterService = {
  getCharacters: () =>
    api.get<Character[]>('/characters').then((res) => res.data),
  getCharacter: (id: string) =>
    api.get<Character>(`/characters/${id}`).then((res) => res.data),
  createCharacter: (data: Character) =>
    api.post<Character>('/characters', data).then((res) => res.data),
  updateCharacter: (id: string, data: Partial<Character>) =>
    api.put<Character>(`/characters/${id}`, data).then((res) => res.data),
  deleteCharacter: (id: string) =>
    api.delete(`/characters/${id}`).then((res) => res.data),

  createLanguageProfile: (characterId: string, data: LanguageProfile) =>
    api
      .post<LanguageProfile>(
        `/characters/${characterId}/language-profiles/`,
        data,
      )
      .then((res) => res.data),
  updateLanguageProfile: (
    characterId: string,
    profileId: number,
    data: Partial<LanguageProfile>,
  ) =>
    api
      .put<LanguageProfile>(
        `/characters/${characterId}/language-profiles/${profileId}`,
        data,
      )
      .then((res) => res.data),
  deleteLanguageProfile: (characterId: string, profileId: number) =>
    api
      .delete(`/characters/${characterId}/language-profiles/${profileId}`)
      .then((res) => res.data),
  generateSample: (characterId: string) =>
    api
      .post<Character>(`/characters/${characterId}/generate-sample`)
      .then((res) => res.data),
  getVoices: () =>
    api.get<VoiceDefinition[]>('/characters/voices').then((res) => res.data),
};

export const sceneService = {
  getScenes: (projectId: string) =>
    api.get<Scene[]>(`/projects/${projectId}/scenes`).then((res) => res.data),
  getScene: (id: string) =>
    api.get<Scene>(`/scenes/${id}`).then((res) => res.data),
  createScene: (projectId: string, data: Partial<Scene>) =>
    api
      .post<Scene>(`/projects/${projectId}/scenes`, data)
      .then((res) => res.data),
  updateScene: (id: string, data: Partial<Scene>) =>
    api.put<Scene>(`/scenes/${id}`, data).then((res) => res.data),
  deleteScene: (id: string) =>
    api.delete(`/scenes/${id}`).then((res) => res.data),
  extractScript: (id: string) =>
    api.post(`/scenes/${id}/extract`).then((res) => res.data),
  generateAudio: (id: string) =>
    api.post(`/scenes/${id}/generate-audio`).then((res) => res.data),
  stitchScene: (
    id: string,
    lines?: { id: number; audio_url: string | null }[],
  ) => api.post(`/scenes/${id}/stitch`, { lines }).then((res) => res.data),
  generateLineAudio: (sceneId: string, lineId: number) =>
    api
      .post(`/scenes/${sceneId}/lines/${lineId}/generate-audio`)
      .then((res) => res.data),
  generateChunkAudio: (sceneId: string, lineId: number) =>
    api
      .post(`/scenes/${sceneId}/lines/${lineId}/generate-chunk-audio`)
      .then((res) => res.data),
};

export const processingService = {
  preprocessLines: (projectId: string, lines: SceneLine[]) =>
    api
      .post(`/processing/preprocess-only`, { project_id: projectId, lines })
      .then((res) => res.data),
};

export interface DictionaryEntry {
  id?: number;
  language: string;
  word: string;
  phonetic_replacement: string;
  entry_type?: 'word' | 'name' | 'place';
}

export const dictionaryService = {
  getEntries: (language?: string) =>
    api
      .get<DictionaryEntry[]>('/dictionary', { params: { language } })
      .then((res) => res.data),
  createEntry: (data: DictionaryEntry) =>
    api.post<DictionaryEntry>('/dictionary', data).then((res) => res.data),
  updateEntry: (id: number, data: DictionaryEntry) =>
    api.put<DictionaryEntry>(`/dictionary/${id}`, data).then((res) => res.data),
  deleteEntry: (id: number) =>
    api.delete(`/dictionary/${id}`).then((res) => res.data),
};
export interface APIKey {
  id: number;
  name: string;
  is_exhausted: boolean;
  is_active: boolean;
}

export interface APIKeyCreate {
  name: string;
  key_value: string;
}

export interface Settings {
  id: number;
  active_api_key_id: number | null;
}

export const settingsService = {
  getSettings: () => api.get<Settings>('/settings').then((res) => res.data),
  getApiKeys: () =>
    api.get<APIKey[]>('/settings/api-keys').then((res) => res.data),
  addApiKey: (data: APIKeyCreate) =>
    api.post('/settings/api-keys', data).then((res) => res.data),
  deleteApiKey: (id: number) =>
    api.delete(`/settings/api-keys/${id}`).then((res) => res.data),
  activateApiKey: (id: number) =>
    api.post(`/settings/api-keys/${id}/activate`).then((res) => res.data),
};

export interface SystemStorageConfig {
  root_path: string;
}

export const systemService = {
  getStorageConfig: () =>
    api.get<SystemStorageConfig>('/system/storage').then((res) => res.data),
  updateStorageConfig: (data: SystemStorageConfig) =>
    api
      .post<{ success: boolean; message: string }>('/system/storage', data)
      .then((res) => res.data),
};

export const LANGUAGE_DISPLAY_NAMES: Record<string, string> = {
  'ru-RU': 'Русский',
  'en-US': 'English (US)',
  'en-GB': 'English (GB)',
  'he-IL': 'עברית (Hebrew)',
  'es-ES': 'Español',
  'fr-FR': 'Français',
  'de-DE': 'Deutsch',
  'ro-RO': 'Română',
};

export function getLanguageDisplayName(code?: string): string {
  if (!code) return 'Unknown';
  return LANGUAGE_DISPLAY_NAMES[code] || code;
}
