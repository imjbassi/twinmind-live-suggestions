import { DEFAULT_SUGGESTION_PROMPT, DEFAULT_CHAT_PROMPT } from './prompts'

export interface AppSettings {
  groqApiKey: string
  suggestionPrompt: string
  chatPrompt: string
  suggestionContextSize: number
  chatContextSize: number
  chatModel: string
  transcriptionModel: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  groqApiKey: '',
  suggestionPrompt: DEFAULT_SUGGESTION_PROMPT,
  chatPrompt: DEFAULT_CHAT_PROMPT,
  suggestionContextSize: 4000,
  chatContextSize: 8000,
  chatModel: 'openai/gpt-oss-120b',
  transcriptionModel: 'whisper-large-v3',
}

const SETTINGS_KEY = 'twinmind_settings'

// NOTE: getSettings is a client-side helper — it reads localStorage and falls
// back to DEFAULT_SETTINGS (with an empty API key) during SSR. Do NOT call this
// from a Server Component or Route Handler: it will silently return a blank
// key. All current call sites are in 'use client' files invoked from event
// handlers, which is safe.
export function getSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const stored = localStorage.getItem(SETTINGS_KEY)
    if (!stored) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(partial: Partial<AppSettings>): void {
  if (typeof window === 'undefined') return
  const current = getSettings()
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...partial }))
}

export function getApiKey(): string {
  return getSettings().groqApiKey
}
