import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { createGroqClient, CHAT_MODEL } from '@/lib/groq'
import { DEFAULT_SUGGESTION_PROMPT } from '@/lib/prompts'
import { Suggestion, SuggestionType } from '@/lib/types'

export const dynamic = 'force-dynamic'

const ALLOWED_TYPES: readonly SuggestionType[] = [
  'question',
  'talking_point',
  'answer',
  'fact_check',
  'clarification',
]

interface RequestBody {
  transcript: string
  prompt?: string
  model?: string
}

function parseSuggestions(content: string): Suggestion[] {
  try {
    const parsed: unknown = JSON.parse(content)

    let raw: unknown[]
    if (Array.isArray(parsed)) {
      raw = parsed
    } else if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'suggestions' in parsed &&
      Array.isArray((parsed as { suggestions: unknown }).suggestions)
    ) {
      raw = (parsed as { suggestions: unknown[] }).suggestions
    } else {
      return []
    }

    return raw
      .filter((s): s is Suggestion => {
        if (typeof s !== 'object' || s === null) return false
        const obj = s as Record<string, unknown>
        return (
          typeof obj.type === 'string' &&
          (ALLOWED_TYPES as readonly string[]).includes(obj.type) &&
          typeof obj.preview === 'string' &&
          typeof obj.fullContext === 'string'
        )
      })
      .slice(0, 3)
  } catch {
    return []
  }
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-groq-api-key')
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing API key' }, { status: 401 })
  }

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { transcript, prompt, model } = body

  if (!transcript?.trim()) {
    return NextResponse.json({ error: 'Transcript is required' }, { status: 400 })
  }

  try {
    const groq = createGroqClient(apiKey)

    const completion = await groq.chat.completions.create({
      model: model ?? CHAT_MODEL,
      messages: [
        {
          role: 'system',
          content: prompt ?? DEFAULT_SUGGESTION_PROMPT,
        },
        {
          role: 'user',
          content: `Here is the recent meeting transcript:\n\n${transcript}`,
        },
      ],
      response_format: { type: 'json_object' },
      // JSON mode is more reliable at lower temperatures.
      temperature: 0.4,
      max_tokens: 1024,
    })

    const content = completion.choices[0]?.message?.content ?? '{}'
    const suggestions = parseSuggestions(content)

    return NextResponse.json({ suggestions })
  } catch (err) {
    if (err instanceof Groq.APIError) {
      const status = err.status ?? 500
      const message =
        status === 401
          ? 'Invalid or missing Groq API key.'
          : status === 429
            ? 'Groq rate limit reached. Please wait and try again.'
            : err.message
      return NextResponse.json({ error: message }, { status })
    }
    const message = err instanceof Error ? err.message : 'Failed to generate suggestions'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
