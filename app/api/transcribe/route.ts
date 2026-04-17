import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { createGroqClient, TRANSCRIPTION_MODEL } from '@/lib/groq'

// Whisper handles audio via multipart/form-data — keep this on the Node runtime
// so Vercel doesn't silently deploy it to Edge where FormData + Blob behavior
// around File constructors can differ.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function extensionForMime(mime: string): string {
  if (mime.includes('mp4')) return 'mp4'
  if (mime.includes('ogg')) return 'ogg'
  if (mime.includes('wav')) return 'wav'
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3'
  return 'webm'
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-groq-api-key')
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing API key' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const audio = formData.get('audio')
  const model = (formData.get('model') as string | null) ?? TRANSCRIPTION_MODEL

  if (!audio || !(audio instanceof Blob)) {
    return NextResponse.json({ error: 'Audio file required' }, { status: 400 })
  }

  try {
    const groq = createGroqClient(apiKey)
    const mime = audio.type || 'audio/webm'
    const filename = `audio.${extensionForMime(mime)}`
    const file = new File([audio], filename, { type: mime })

    const transcription = await groq.audio.transcriptions.create({
      file,
      model,
      response_format: 'json',
    })

    return NextResponse.json({ text: transcription.text })
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
    const message = err instanceof Error ? err.message : 'Transcription failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
