'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import TranscriptPanel from '@/components/TranscriptPanel'
import SuggestionsPanel from '@/components/SuggestionsPanel'
import ChatPanel from '@/components/ChatPanel'
import { useRecorder } from '@/hooks/useRecorder'
import { useSuggestions } from '@/hooks/useSuggestions'
import { ChatMessage } from '@/lib/types'
import { exportSession } from '@/lib/export'

interface PendingSuggestion {
  text: string
  preview: string
}

export default function Home() {
  const recorder = useRecorder()
  const suggestions = useSuggestions(recorder.entries, recorder.isRecording)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [pendingSuggestion, setPendingSuggestion] = useState<PendingSuggestion | null>(null)

  const handleSuggestionClick = useCallback((text: string, preview: string) => {
    setPendingSuggestion({ text, preview })
  }, [])

  const handlePendingSuggestionHandled = useCallback(() => {
    setPendingSuggestion(null)
  }, [])

  const handleMessagesChange = useCallback(
    (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
      setChatMessages(updater)
    },
    [],
  )

  const handleExport = () => {
    exportSession({
      entries: recorder.entries,
      batches: suggestions.batches,
      chatMessages,
    })
  }

  const transcriptText = recorder.entries.map((e) => e.text).join(' ')

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-800 bg-gray-900 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-lg">🧠</span>
          <h1 className="text-base font-semibold text-white tracking-tight">
            TwinMind Live Suggestions
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={
              recorder.entries.length === 0 &&
              suggestions.batches.length === 0 &&
              chatMessages.length === 0
            }
            className="text-xs px-3 py-1.5 rounded-md bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 text-gray-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            ↓ Export JSON
          </button>
          <Link
            href="/settings"
            className="text-xs px-3 py-1.5 rounded-md bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 text-gray-300 hover:text-white transition-all"
          >
            ⚙ Settings
          </Link>
        </div>
      </header>

      {/* 3-column body */}
      <div className="flex flex-1 overflow-hidden">
        <TranscriptPanel
          entries={recorder.entries}
          isRecording={recorder.isRecording}
          isTranscribing={recorder.isTranscribing}
          error={recorder.error}
          onStart={recorder.startRecording}
          onStop={recorder.stopRecording}
        />
        <SuggestionsPanel
          batches={suggestions.batches}
          isLoading={suggestions.isLoading}
          error={suggestions.error}
          onRefresh={suggestions.refresh}
          onSuggestionClick={handleSuggestionClick}
        />
        <ChatPanel
          messages={chatMessages}
          onMessagesChange={handleMessagesChange}
          transcript={transcriptText}
          pendingSuggestion={pendingSuggestion}
          onPendingSuggestionHandled={handlePendingSuggestionHandled}
        />
      </div>
    </div>
  )
}
