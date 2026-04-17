export interface TranscriptEntry {
  id: string
  text: string
  timestamp: number
}

export type SuggestionType =
  | 'question'
  | 'talking_point'
  | 'answer'
  | 'fact_check'
  | 'clarification'

export interface Suggestion {
  type: SuggestionType
  preview: string
  fullContext: string
}

export interface SuggestionBatch {
  id: string
  timestamp: number
  suggestions: Suggestion[]
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string      // sent to the AI API
  display?: string     // shown in the chat UI (user bubbles only, falls back to content)
  timestamp: number
}
