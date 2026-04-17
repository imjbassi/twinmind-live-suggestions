'use client'

import { useEffect, useRef } from 'react'
import { TranscriptEntry } from '@/lib/types'

interface Props {
  entries: TranscriptEntry[]
  isRecording: boolean
  isTranscribing: boolean
  error: string | null
  onStart: () => Promise<void>
  onStop: () => void
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function TranscriptPanel({
  entries,
  isRecording,
  isTranscribing,
  error,
  onStart,
  onStop,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries])

  const handleToggle = () => {
    if (isRecording) onStop()
    else onStart()
  }

  return (
    <div className="flex flex-col w-72 min-w-[18rem] border-r border-gray-800 bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div>
          <h2 className="text-sm font-semibold text-gray-100">Transcript</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {entries.length} segment{entries.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isTranscribing && (
            <span className="text-xs text-blue-400 animate-pulse">transcribing…</span>
          )}
          {isRecording && (
            <span className="flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 py-3 border-b border-gray-800">
        <button
          onClick={handleToggle}
          className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-all duration-150 ${
            isRecording
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {isRecording ? '⏹ Stop Recording' : '🎙 Start Recording'}
        </button>
        {error && (
          <p className="mt-2 text-xs text-red-400 leading-snug">{error}</p>
        )}
      </div>

      {/* Transcript entries */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="text-3xl mb-3">🎙</div>
            <p className="text-sm text-gray-500">
              Press Start Recording to begin capturing audio
            </p>
            <p className="text-xs text-gray-600 mt-2">
              Transcripts appear here every ~30 seconds
            </p>
          </div>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="group">
              <p className="text-xs text-gray-600 mb-1">{formatTime(entry.timestamp)}</p>
              <p className="text-sm text-gray-300 leading-relaxed">{entry.text}</p>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
