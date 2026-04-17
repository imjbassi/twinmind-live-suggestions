'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { TranscriptEntry } from '@/lib/types'
import { getApiKey, getSettings } from '@/lib/settings'

const CHUNK_INTERVAL_MS = 30_000
const SUPPORTED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
]

function getSupportedMimeType(): string {
  return SUPPORTED_MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
}

function extensionForMime(mime: string): string {
  if (mime.includes('mp4')) return 'mp4'
  if (mime.includes('ogg')) return 'ogg'
  return 'webm'
}

export interface UseRecorderReturn {
  isRecording: boolean
  entries: TranscriptEntry[]
  isTranscribing: boolean
  error: string | null
  startRecording: () => Promise<void>
  stopRecording: () => void
}

export function useRecorder(): UseRecorderReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [entries, setEntries] = useState<TranscriptEntry[]>([])
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Whether the chunk loop should keep going. Flipped false by stopRecording/unmount
  // so onstop knows not to start a fresh chunk after the final one.
  const shouldContinueRef = useRef(false)
  // Track in-flight transcriptions so we can keep isTranscribing accurate when the
  // user hits Stop while a chunk is still being sent to Whisper.
  const inFlightRef = useRef(0)

  const transcribeBlob = useCallback(async (blob: Blob, mimeType: string) => {
    if (blob.size < 1000) return

    const apiKey = getApiKey()
    if (!apiKey) {
      setError('No API key set. Go to Settings and enter your Groq API key.')
      return
    }

    const settings = getSettings()
    inFlightRef.current += 1
    setIsTranscribing(true)
    try {
      const formData = new FormData()
      const ext = extensionForMime(mimeType)
      formData.append('audio', blob, `chunk.${ext}`)
      formData.append('model', settings.transcriptionModel)

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'x-groq-api-key': apiKey },
        body: formData,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Transcription failed (${res.status})`)
      }

      const { text } = await res.json()
      if (text?.trim()) {
        setEntries((prev) => [
          ...prev,
          { id: crypto.randomUUID(), text: text.trim(), timestamp: Date.now() },
        ])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transcription failed')
    } finally {
      inFlightRef.current -= 1
      if (inFlightRef.current <= 0) {
        inFlightRef.current = 0
        setIsTranscribing(false)
      }
    }
  }, [])

  // Starts a single chunk recorder. The next chunk is started *inside* onstop,
  // guaranteeing the previous recorder has fully flushed before recorderRef is
  // overwritten. This avoids the cross-chunk onstop/ref race the old setInterval
  // loop had.
  const startChunk = useCallback(
    (stream: MediaStream) => {
      const mimeType = getSupportedMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      const localChunks: Blob[] = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) localChunks.push(e.data)
      }

      recorder.onstop = () => {
        const actualType = mimeType || recorder.mimeType || 'audio/webm'
        const blob = new Blob(localChunks, { type: actualType })
        // Fire-and-forget — don't block the next chunk on the network round-trip.
        void transcribeBlob(blob, actualType)

        if (shouldContinueRef.current && streamRef.current) {
          startChunk(streamRef.current)
        }
      }

      recorder.start()
      recorderRef.current = recorder

      // Schedule this chunk's stop. When it fires, onstop runs and (if we're still
      // recording) starts the next chunk.
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null
        if (recorder.state === 'recording') recorder.stop()
      }, CHUNK_INTERVAL_MS)
    },
    [transcribeBlob],
  )

  const startRecording = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      shouldContinueRef.current = true
      setIsRecording(true)
      startChunk(stream)
    } catch (err) {
      shouldContinueRef.current = false
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('Microphone access denied. Please allow mic access and try again.')
        } else if (err.name === 'NotFoundError') {
          setError('No microphone found. Please connect a mic and try again.')
        } else {
          setError(err.message)
        }
      } else {
        setError('Failed to start recording')
      }
    }
  }, [startChunk])

  const stopRecording = useCallback(() => {
    shouldContinueRef.current = false
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    // onstop will still fire for the final chunk and transcribe it. We don't wait
    // here so the UI updates immediately, but the final 0–30s of audio still posts.
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setIsRecording(false)
  }, [])

  // Release the mic if the component unmounts (e.g. user navigates to /settings
  // while still recording).
  useEffect(() => {
    return () => {
      shouldContinueRef.current = false
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  return { isRecording, entries, isTranscribing, error, startRecording, stopRecording }
}
