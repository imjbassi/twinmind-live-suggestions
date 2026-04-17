'use client'

import { SuggestionBatch } from '@/lib/types'
import SuggestionCard from './SuggestionCard'

interface Props {
  batches: SuggestionBatch[]
  isLoading: boolean
  error: string | null
  onRefresh: () => void
  onSuggestionClick: (text: string, preview: string) => void
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function SuggestionsPanel({
  batches,
  isLoading,
  error,
  onRefresh,
  onSuggestionClick,
}: Props) {
  return (
    <div className="flex flex-col flex-1 border-r border-gray-800 bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div>
          <h2 className="text-sm font-semibold text-gray-100">Live Suggestions</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {batches.length > 0
              ? `${batches.length} batch${batches.length !== 1 ? 'es' : ''} · auto-refreshes every 30s`
              : 'auto-refreshes every 30s while recording'}
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 text-gray-300 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <span className={isLoading ? 'animate-spin' : ''}>↻</span>
          {isLoading ? 'Generating…' : 'Refresh'}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-6">
        {error && (
          <div className="p-3 rounded-lg bg-red-900/30 border border-red-800 text-xs text-red-400">
            {error}
          </div>
        )}

        {batches.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="text-3xl mb-3">💡</div>
            <p className="text-sm text-gray-500">Suggestions will appear here</p>
            <p className="text-xs text-gray-600 mt-2">
              Start recording, or click Refresh with existing transcript
            </p>
          </div>
        ) : (
          <>
            {isLoading && (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={`skeleton-top-${i}`}
                    className="h-24 rounded-lg bg-gray-800 border border-gray-700 animate-pulse"
                  />
                ))}
              </div>
            )}
            {batches.map((batch, batchIndex) => (
              <div key={batch.id}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-600">{formatTime(batch.timestamp)}</span>
                  {batchIndex === 0 && !isLoading && (
                    <span className="text-xs bg-blue-900/50 text-blue-400 border border-blue-800 px-1.5 py-0.5 rounded">
                      Latest
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {batch.suggestions.map((suggestion, i) => (
                    <SuggestionCard
                      key={`${batch.id}-${i}`}
                      suggestion={suggestion}
                      onClick={onSuggestionClick}
                    />
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {isLoading && batches.length === 0 && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-24 rounded-lg bg-gray-800 border border-gray-700 animate-pulse"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
