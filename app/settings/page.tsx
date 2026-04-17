'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { AppSettings, getSettings, saveSettings, DEFAULT_SETTINGS } from '@/lib/settings'

type FieldConfig = {
  key: keyof AppSettings
  label: string
  description: string
  type: 'text' | 'password' | 'number' | 'textarea'
  placeholder?: string
}

const FIELDS: FieldConfig[] = [
  {
    key: 'groqApiKey',
    label: 'Groq API Key',
    description: 'Get yours at console.groq.com — stored only in your browser localStorage.',
    type: 'password',
    placeholder: 'gsk_...',
  },
  {
    key: 'chatModel',
    label: 'Chat / Suggestion Model',
    description: 'Groq model ID used for suggestions and chat responses.',
    type: 'text',
    placeholder: 'llama-3.3-70b-versatile',
  },
  {
    key: 'transcriptionModel',
    label: 'Transcription Model',
    description: 'Groq Whisper model ID for audio transcription.',
    type: 'text',
    placeholder: 'whisper-large-v3',
  },
  {
    key: 'suggestionContextSize',
    label: 'Suggestion Context Window (chars)',
    description: 'How many characters of recent transcript to send when generating the 3 live suggestion cards.',
    type: 'number',
    placeholder: '4000',
  },
  {
    key: 'detailedAnswerContextSize',
    label: 'Detailed Answer Context Window (chars)',
    description: 'Transcript window sent when the user clicks a suggestion card to get a detailed expanded answer.',
    type: 'number',
    placeholder: '6000',
  },
  {
    key: 'chatContextSize',
    label: 'Chat Context Window (chars)',
    description: 'Transcript window sent when the user types a free-form question into the chat.',
    type: 'number',
    placeholder: '8000',
  },
  {
    key: 'suggestionPrompt',
    label: 'Live Suggestion System Prompt',
    description: 'Instructs the model how to generate the 3 suggestion cards. Must produce JSON with { suggestions: [{type, preview, fullContext}] }.',
    type: 'textarea',
  },
  {
    key: 'detailedAnswerPrompt',
    label: 'Detailed Answer (On-Click) System Prompt',
    description: 'Instructs the model when the user clicks a suggestion — should produce a longer, structured answer grounded in the transcript. Use {{TRANSCRIPT}} as a placeholder.',
    type: 'textarea',
  },
  {
    key: 'chatPrompt',
    label: 'Chat System Prompt (Typed Questions)',
    description: 'Instructs the model for free-form typed chat questions. Use {{TRANSCRIPT}} as a placeholder for the transcript.',
    type: 'textarea',
  },
]

const MIN_CONTEXT_CHARS = 500

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [saved, setSaved] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  useEffect(() => {
    setSettings(getSettings())
  }, [])

  if (!settings) return null

  const update = (key: keyof AppSettings, value: string | number) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))
    setSaved(false)
    setValidationError(null)
  }

  const handleSave = () => {
    if (!settings) return
    // The chat system prompt must contain {{TRANSCRIPT}} or chat answers lose
    // all meeting context silently.
    if (!settings.chatPrompt.includes('{{TRANSCRIPT}}')) {
      setValidationError(
        'Chat System Prompt must contain the {{TRANSCRIPT}} placeholder so the meeting transcript can be injected.',
      )
      return
    }
    if (!settings.detailedAnswerPrompt.includes('{{TRANSCRIPT}}')) {
      setValidationError(
        'Detailed Answer System Prompt must contain the {{TRANSCRIPT}} placeholder so the meeting transcript can be injected.',
      )
      return
    }
    if (settings.suggestionContextSize < MIN_CONTEXT_CHARS) {
      setValidationError(`Suggestion context window must be at least ${MIN_CONTEXT_CHARS} characters.`)
      return
    }
    if (settings.detailedAnswerContextSize < MIN_CONTEXT_CHARS) {
      setValidationError(`Detailed answer context window must be at least ${MIN_CONTEXT_CHARS} characters.`)
      return
    }
    if (settings.chatContextSize < MIN_CONTEXT_CHARS) {
      setValidationError(`Chat context window must be at least ${MIN_CONTEXT_CHARS} characters.`)
      return
    }
    setValidationError(null)
    saveSettings(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS)
    setSaved(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-800 bg-gray-900">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-xs px-3 py-1.5 rounded-md bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 hover:text-white transition-all"
          >
            ← Back
          </Link>
          <h1 className="text-base font-semibold text-white">Settings</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="text-xs px-3 py-1.5 rounded-md bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 hover:text-white transition-all"
          >
            Reset Defaults
          </button>
          <button
            onClick={handleSave}
            className={`text-xs px-4 py-1.5 rounded-md font-medium transition-all ${
              saved
                ? 'bg-green-700 border-green-600 text-green-100 border'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {saved ? '✓ Saved' : 'Save Settings'}
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <div className="p-4 rounded-lg bg-blue-900/20 border border-blue-800 text-sm text-blue-300">
          Settings are stored in your browser&apos;s localStorage. They persist across sessions but are
          local to this browser — never sent to any server except as part of API requests to Groq.
        </div>

        {validationError && (
          <div className="p-3 rounded-lg bg-red-900/30 border border-red-800 text-sm text-red-400">
            {validationError}
          </div>
        )}

        {FIELDS.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-200">{field.label}</label>
            <p className="text-xs text-gray-500">{field.description}</p>

            {field.type === 'textarea' ? (
              <textarea
                value={String(settings[field.key])}
                onChange={(e) => update(field.key, e.target.value)}
                rows={8}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 font-mono focus:outline-none focus:border-blue-500 transition-colors resize-y"
              />
            ) : field.type === 'password' ? (
              <div className="flex gap-2">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={String(settings[field.key])}
                  onChange={(e) => update(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  autoComplete="off"
                  spellCheck={false}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500 transition-colors font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="text-xs px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white transition-all"
                >
                  {showKey ? 'Hide' : 'Show'}
                </button>
              </div>
            ) : field.type === 'number' ? (
              <input
                type="number"
                min={MIN_CONTEXT_CHARS}
                value={Number(settings[field.key])}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10)
                  // While typing, allow any non-negative number; final clamp
                  // happens in handleSave. An empty input is held as
                  // MIN_CONTEXT_CHARS rather than 0 so we never silently ship
                  // an empty transcript to the model.
                  update(
                    field.key,
                    Number.isFinite(n) && n > 0 ? n : MIN_CONTEXT_CHARS,
                  )
                }}
                placeholder={field.placeholder}
                className="w-40 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500 transition-colors"
              />
            ) : (
              <input
                type="text"
                value={String(settings[field.key])}
                onChange={(e) => update(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500 transition-colors"
              />
            )}
          </div>
        ))}

        <div className="pt-4 border-t border-gray-800 flex justify-end">
          <button
            onClick={handleSave}
            className={`text-sm px-6 py-2 rounded-lg font-medium transition-all ${
              saved
                ? 'bg-green-700 border-green-600 text-green-100 border'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {saved ? '✓ Settings Saved' : 'Save Settings'}
          </button>
        </div>
      </main>
    </div>
  )
}
