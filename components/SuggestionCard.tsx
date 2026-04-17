'use client'

import { Suggestion, SuggestionType } from '@/lib/types'

interface Props {
  suggestion: Suggestion
  onClick: (text: string, preview: string) => void
}

const TYPE_STYLES: Record<SuggestionType, { badge: string; label: string }> = {
  question: { badge: 'bg-blue-900/60 text-blue-300 border-blue-700', label: 'Question' },
  talking_point: { badge: 'bg-emerald-900/60 text-emerald-300 border-emerald-700', label: 'Talking Point' },
  answer: { badge: 'bg-violet-900/60 text-violet-300 border-violet-700', label: 'Answer' },
  fact_check: { badge: 'bg-rose-900/60 text-rose-300 border-rose-700', label: 'Fact Check' },
  clarification: { badge: 'bg-amber-900/60 text-amber-300 border-amber-700', label: 'Clarification' },
}

export default function SuggestionCard({ suggestion, onClick }: Props) {
  const style = TYPE_STYLES[suggestion.type] ?? TYPE_STYLES.clarification

  return (
    <button
      className="w-full text-left p-4 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-blue-500 transition-all duration-150 group"
      onClick={() => onClick(suggestion.fullContext, suggestion.preview)}
    >
      <span
        className={`inline-block text-xs font-semibold px-2 py-0.5 rounded border ${style.badge}`}
      >
        {style.label}
      </span>
      <p className="mt-2 text-sm text-gray-200 leading-relaxed group-hover:text-white transition-colors">
        {suggestion.preview}
      </p>
      <p className="mt-1.5 text-xs text-gray-500 group-hover:text-gray-400 transition-colors">
        Click to ask in chat →
      </p>
    </button>
  )
}
