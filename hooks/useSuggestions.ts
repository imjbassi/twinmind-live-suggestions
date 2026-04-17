'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { TranscriptEntry, SuggestionBatch, Suggestion } from '@/lib/types'
import { getApiKey, getSettings } from '@/lib/settings'

const AUTO_REFRESH_MS = 30_000

export interface UseSuggestionsReturn {
  batches: SuggestionBatch[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useSuggestions(
  entries: TranscriptEntry[],
  isRecording: boolean,
): UseSuggestionsReturn {
  const [batches, setBatches] = useState<SuggestionBatch[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Stable ref so the interval callback always reads the latest entries
  const entriesRef = useRef(entries)
  entriesRef.current = entries

  const refresh = useCallback(async () => {
    const apiKey = getApiKey()
    const currentEntries = entriesRef.current

    if (!apiKey) {
      setError('No API key set. Go to Settings to add your Groq API key.')
      return
    }
    if (currentEntries.length === 0) {
      setError('Record some audio first — no transcript to summarize yet.')
      return
    }

    const settings = getSettings()
    const recentText = currentEntries
      .map((e) => e.text)
      .join(' ')
      .slice(-settings.suggestionContextSize)

    if (!recentText.trim()) {
      setError('Transcript is empty — wait for a chunk to transcribe, then retry.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-groq-api-key': apiKey,
        },
        body: JSON.stringify({
          transcript: recentText,
          prompt: settings.suggestionPrompt,
          model: settings.chatModel,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Suggestions failed (${res.status})`)
      }

      const { suggestions } = (await res.json()) as { suggestions: Suggestion[] }

      setBatches((prev) => [
        {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          suggestions: suggestions.slice(0, 3),
        },
        ...prev,
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate suggestions')
    } finally {
      setIsLoading(false)
    }
  }, []) // intentionally empty — reads latest state via ref

  // Auto-refresh every 30s while recording.
  // `refresh` has an empty dep array (reads latest state via entriesRef), so its
  // identity is stable and this interval is NOT recreated on every render. If
  // anyone ever adds a dep to `refresh`, re-think this effect — otherwise the
  // interval will reset each render and the next 30s tick will be delayed.
  useEffect(() => {
    if (!isRecording) return
    const id = setInterval(refresh, AUTO_REFRESH_MS)
    return () => clearInterval(id)
  }, [isRecording, refresh])

  return { batches, isLoading, error, refresh }
}
