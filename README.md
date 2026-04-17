# TwinMind Live Suggestions

A real-time meeting copilot that listens to live audio, transcribes it, and surfaces contextual AI suggestions — all in a clean 3-column interface.

---

## Setup

### Prerequisites
- Node.js 18+
- A [Groq API key](https://console.groq.com)

### Install & run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Set your API key

1. Click **Settings** (top-right)
2. Paste your Groq API key in the first field
3. Click **Save Settings**

Your key is stored in `localStorage` — never hardcoded, never sent to any server other than Groq's API directly through Next.js API routes.

---

## How to get a Groq API key

1. Go to [console.groq.com](https://console.groq.com)
2. Sign up / log in
3. Navigate to **API Keys** → **Create API Key**
4. Copy the key (starts with `gsk_...`)

---

## Stack choices and why

| Choice | Why |
|--------|-----|
| **Next.js 14 App Router** | Collocated API routes eliminate a separate backend. Server Components keep sensitive API calls server-side even though the key comes from the client header. |
| **Groq SDK** | Groq provides the fastest LLM inference available, critical for a real-time UX where 30-second refresh cycles need sub-second generation times. |
| **Whisper Large V3** | Best open-source ASR model — handles accents, technical vocabulary, and background noise well. Groq's hardware makes it near-instant. |
| **llama-3.3-70b-versatile** | Strong instruction-following and JSON output fidelity at Groq speeds. Configurable in Settings if a newer model is preferred. |
| **MediaRecorder API** | Native browser API — no extra dependencies, works cross-browser, produces `audio/webm` which Whisper accepts directly. |
| **Tailwind CSS** | Utility-first CSS keeps styles co-located with components and avoids stylesheet sprawl for a single-session app like this. |
| **react-markdown** | Clean, safe markdown rendering for AI responses without `dangerouslySetInnerHTML`. |
| **localStorage for settings** | Meets the "no database, no auth" requirement while persisting the API key across sessions within the same browser. |

---

## Prompt strategy

### Live Suggestion Prompt

The system prompt instructs the model to act as a **meeting copilot**. Given the last N characters of transcript, it:

1. **Classifies context** — determines if a question was asked, a claim made, a topic shifted, etc.
2. **Returns exactly 3 suggestions** as a JSON object with `{ suggestions: [{type, preview, fullContext}] }`

The `type` field is one of: `question`, `talking_point`, `answer`, `fact_check`, `clarification`. The model chooses the mix based on what's actually happening in the conversation.

The `preview` is designed to be **immediately valuable on its own** — a complete insight in 1-2 sentences. The `fullContext` provides supporting detail sent to the AI when the user clicks the card.

`response_format: { type: 'json_object' }` is used to guarantee valid JSON output and avoid parse failures.

### Chat Prompt

The system prompt includes `{{TRANSCRIPT}}` as a placeholder, replaced at request time with the last N characters of transcript. It instructs the model to:
- Answer with structured markdown (headers, bullets, bold)
- Quote or reference the transcript directly
- Flag potentially inaccurate claims made in the meeting
- Answer from general knowledge when the topic isn't in the transcript

Streaming is used for all chat responses via `ReadableStream` so the first tokens appear within ~200ms.

---

## Key tradeoffs

**30-second chunking for transcription**  
Audio is chopped every 30s to balance latency vs. accuracy. Shorter chunks = faster feedback but worse context for Whisper. 30s is a sweet spot for conversational speech. The first chunk only fires after the full 30s, so there's an inherent delay before the first transcript appears.

**Client → server API key forwarding**  
The Groq API key lives in `localStorage` and is sent as an `x-groq-api-key` header to Next.js API routes, which then call Groq. This means the key is exposed in browser network requests. For a production app, server-side key storage (env vars + auth) would be preferred. For this take-home the tradeoff is explicit: zero-infra simplicity vs. key exposure in devtools.

**No streaming for suggestions**  
Suggestions use a standard request/response (not streaming) because the JSON structure needs to be complete before it can be parsed into 3 cards. The ~1-2s wait for suggestions is acceptable given they auto-refresh every 30s.

**Single-session, no persistence**  
All state (transcript, suggestions, chat) lives in React state. Refreshing the page clears everything. This is by design — the assignment specifies no database and no persistence on reload.

**Suggestion batches prepend, not replace**  
Each 30s refresh prepends a new batch of 3 cards above older ones. This lets users scroll back and compare how context evolved over the meeting. An alternative would be to replace suggestions, but keeping history is more useful for post-meeting review.

---

## Deploying to Vercel

```bash
# Install Vercel CLI (optional)
npm i -g vercel

# Deploy
vercel
```

Or connect your GitHub repo to [vercel.com](https://vercel.com) and it deploys automatically on push.

**No environment variables required** — the API key is managed client-side via Settings.

The app is stateless and edge-compatible. The API routes use Node.js runtime features (`formData`, streaming) which Vercel supports on the default serverless runtime.

---

## File structure

```
app/
  page.tsx              # Main 3-column layout (coordinator)
  layout.tsx            # Root HTML, fonts, metadata
  globals.css           # Tailwind + markdown prose styles
  settings/page.tsx     # Settings form (localStorage)
  api/
    transcribe/route.ts # POST audio → Groq Whisper → text
    suggestions/route.ts# POST transcript → 3 suggestion cards
    chat/route.ts       # POST messages → streaming response

components/
  TranscriptPanel.tsx   # Left panel: mic controls + transcript
  SuggestionsPanel.tsx  # Middle panel: suggestion batches
  SuggestionCard.tsx    # Individual suggestion card
  ChatPanel.tsx         # Right panel: chat + streaming

hooks/
  useRecorder.ts        # MediaRecorder lifecycle + transcription loop
  useSuggestions.ts     # 30s suggestion refresh loop

lib/
  types.ts              # Shared TypeScript interfaces
  prompts.ts            # Default system prompts
  settings.ts           # localStorage read/write helpers
  groq.ts               # Groq client factory + model constants
  export.ts             # JSON export download helper
```
