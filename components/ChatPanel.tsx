'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { ChatMessage } from '@/lib/types'
import { getApiKey, getSettings } from '@/lib/settings'

interface Props {
  messages: ChatMessage[]
  onMessagesChange: (updater: (prev: ChatMessage[]) => ChatMessage[]) => void
  transcript: string
  pendingSuggestion: { text: string; preview: string } | null
  onPendingSuggestionHandled: () => void
}

export default function ChatPanel({
  messages,
  onMessagesChange,
  transcript,
  pendingSuggestion,
  onPendingSuggestionHandled,
}: Props) {
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Stable refs so sendMessage doesn't capture stale values
  const messagesRef = useRef(messages)
  messagesRef.current = messages
  const transcriptRef = useRef(transcript)
  transcriptRef.current = transcript

  const resetTextareaHeight = useCallback(() => {
    const el = inputRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = '40px'
    }
  }, [])

  const sendMessage = useCallback(
    async (text: string, displayText?: string) => {
      const apiKey = getApiKey()
      if (!apiKey) {
        setError('No API key configured. Go to Settings to add your Groq API key.')
        return
      }
      if (isStreaming) return

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text,                         // full context → AI
        display: displayText ?? undefined,     // short preview → UI bubble
        timestamp: Date.now(),
      }
      const assistantId = crypto.randomUUID()
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      }

      onMessagesChange((prev) => [...prev, userMessage, assistantMessage])
      setIsStreaming(true)
      setError(null)

      const settings = getSettings()
      const controller = new AbortController()
      abortRef.current = controller

      // A `displayText` argument means this came from a suggestion-card click,
      // which has its own longer-form prompt + context window. Typed questions
      // use the free-form chat prompt/context.
      const isSuggestionClick = displayText !== undefined
      const prompt = isSuggestionClick ? settings.detailedAnswerPrompt : settings.chatPrompt
      const contextSize = isSuggestionClick
        ? settings.detailedAnswerContextSize
        : settings.chatContextSize

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-groq-api-key': apiKey,
          },
          body: JSON.stringify({
            messages: [...messagesRef.current, userMessage].map((m) => ({
              role: m.role,
              content: m.content,
            })),
            transcript: transcriptRef.current,
            prompt,
            model: settings.chatModel,
            contextSize,
          }),
          signal: controller.signal,
        })

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? `Chat failed (${res.status})`)
        }

        const reader = res.body?.getReader()
        if (!reader) throw new Error('No response body')

        const decoder = new TextDecoder()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          onMessagesChange((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + chunk } : m,
            ),
          )
        }
      } catch (err) {
        // Ignore user-initiated aborts (e.g. page unmount).
        if ((err as { name?: string })?.name === 'AbortError') return

        const msg = err instanceof Error ? err.message : 'Chat failed'
        setError(msg)
        // Keep any partial assistant content so the user can see what streamed
        // before the failure; strip the assistant bubble only if nothing arrived.
        onMessagesChange((prev) => {
          const existing = prev.find((m) => m.id === assistantId)
          if (!existing || existing.content === '') {
            return prev.filter((m) => m.id !== assistantId)
          }
          return prev
        })
      } finally {
        abortRef.current = null
        setIsStreaming(false)
      }
    },
    [isStreaming, onMessagesChange],
  )

  // Handle suggestion click routed from parent.
  // Use a ref to sendMessage so this effect only re-fires when the suggestion
  // itself changes (not every time isStreaming toggles and gives sendMessage a
  // new identity).
  const sendMessageRef = useRef(sendMessage)
  sendMessageRef.current = sendMessage
  useEffect(() => {
    if (!pendingSuggestion) return
    const { text, preview } = pendingSuggestion
    onPendingSuggestionHandled()
    sendMessageRef.current(text, preview)
  }, [pendingSuggestion, onPendingSuggestionHandled])

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Cancel any in-flight chat stream if the component unmounts.
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const text = input.trim()
    if (!text || isStreaming) return
    setInput('')
    resetTextareaHeight()
    await sendMessage(text)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSubmit()
    }
  }

  return (
    <div className="flex flex-col w-96 min-w-[24rem] bg-gray-900">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-100">Chat</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Click a suggestion or type a question
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="text-3xl mb-3">💬</div>
            <p className="text-sm text-gray-500">No messages yet</p>
            <p className="text-xs text-gray-600 mt-2">
              Click a suggestion card or type below
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-gray-800 text-gray-200 rounded-bl-sm border border-gray-700'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <div className="prose-sm prose-invert max-w-none">
                    {msg.content ? (
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    ) : (
                      <span className="animate-pulse text-gray-500">Thinking…</span>
                    )}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.display ?? msg.content}</p>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-2 p-2 rounded-lg bg-red-900/30 border border-red-800 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-gray-800">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question… (Enter to send)"
            rows={1}
            disabled={isStreaming}
            className="flex-1 resize-none bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-50 transition-colors max-h-32"
            style={{ height: 'auto', minHeight: '40px' }}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 128) + 'px'
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isStreaming ? '…' : '↑'}
          </button>
        </div>
      </form>
    </div>
  )
}
