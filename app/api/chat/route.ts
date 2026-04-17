import { NextRequest } from 'next/server'
import Groq from 'groq-sdk'
import { createGroqClient, CHAT_MODEL } from '@/lib/groq'
import { DEFAULT_CHAT_PROMPT } from '@/lib/prompts'

export const dynamic = 'force-dynamic'

interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
}

interface RequestBody {
  messages: ChatMsg[]
  transcript: string
  prompt?: string
  model?: string
  contextSize?: number
}

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function friendlyMessage(err: InstanceType<typeof Groq.APIError>): string {
  const status = err.status ?? 500
  if (status === 401) return 'Invalid or missing Groq API key.'
  if (status === 429) return 'Groq rate limit reached. Please wait and try again.'
  return err.message
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-groq-api-key')
  if (!apiKey) return errorResponse('Missing API key', 401)

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return errorResponse('Invalid JSON body', 400)
  }

  const { messages, transcript, prompt, model, contextSize = 8000 } = body

  if (!messages?.length) return errorResponse('Messages are required', 400)

  // replaceAll so multiple {{TRANSCRIPT}} placeholders all get filled.
  const systemContent = (prompt ?? DEFAULT_CHAT_PROMPT).replaceAll(
    '{{TRANSCRIPT}}',
    transcript ? transcript.slice(-contextSize) : '(no transcript yet)',
  )

  try {
    const groq = createGroqClient(apiKey)

    const stream = await groq.chat.completions.create({
      model: model ?? CHAT_MODEL,
      messages: [{ role: 'system', content: systemContent }, ...messages],
      stream: true,
      temperature: 0.7,
      max_tokens: 2048,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content
            if (delta) controller.enqueue(encoder.encode(delta))
          }
          controller.close()
        } catch (err) {
          // Propagate to the client reader so the UI can surface a mid-stream
          // failure instead of seeing a silently-truncated answer. Any bytes
          // already enqueued before this point have already been flushed to the
          // client, so the partial response is preserved.
          controller.error(err)
        }
      },
    })

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (err) {
    if (err instanceof Groq.APIError) {
      return errorResponse(friendlyMessage(err), err.status ?? 500)
    }
    const message = err instanceof Error ? err.message : 'Chat failed'
    return errorResponse(message, 500)
  }
}
