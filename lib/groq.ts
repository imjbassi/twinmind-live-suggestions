import Groq from 'groq-sdk'

export function createGroqClient(apiKey: string): Groq {
  return new Groq({ apiKey })
}

export const TRANSCRIPTION_MODEL = 'whisper-large-v3'
export const CHAT_MODEL = 'openai/gpt-oss-120b'
