import { TranscriptEntry, SuggestionBatch, ChatMessage } from './types'

interface ExportPayload {
  entries: TranscriptEntry[]
  batches: SuggestionBatch[]
  chatMessages: ChatMessage[]
}

export function exportSession({ entries, batches, chatMessages }: ExportPayload): void {
  const data = {
    exportedAt: new Date().toISOString(),
    transcript: entries.map((e) => ({
      id: e.id,
      text: e.text,
      timestamp: new Date(e.timestamp).toISOString(),
    })),
    suggestionBatches: batches.map((b) => ({
      id: b.id,
      timestamp: new Date(b.timestamp).toISOString(),
      suggestions: b.suggestions,
    })),
    chatHistory: chatMessages.map((m) => ({
      id: m.id,
      role: m.role,
      display: m.display ?? m.content,
      content: m.content,
      timestamp: new Date(m.timestamp).toISOString(),
    })),
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `twinmind-export-${Date.now()}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}
