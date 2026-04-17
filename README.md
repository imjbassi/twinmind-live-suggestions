# TwinMind Live Suggestions

A real-time meeting copilot: listens to live mic audio, transcribes in 30-second chunks, and continuously surfaces 3 contextually-useful suggestion cards. Clicking a card opens a detailed, transcript-grounded answer in a streaming chat panel. Free-form typed questions are supported too.

Built for the TwinMind take-home. Runs entirely client-side for state (no DB, no auth) — the user pastes their own Groq API key in Settings.

---

## Live demo

> Add your Vercel URL here after deploying.

1. Open the URL
2. Go to **Settings** → paste your Groq API key (get one at [console.groq.com](https://console.groq.com))
3. Come back, click the mic, and start talking

---

## Local setup

```bash
npm install
npm run dev
```

Then [http://localhost:3000](http://localhost:3000) → Settings → paste API key → back to home.

Requires Node 18+.

---

## Stack

| Choice | Why |
|---|---|
| **Next.js 14 (App Router)** | Collocated API routes = no separate backend. Route handlers proxy the Groq calls so the key header lives on the server edge of the request, not in pre-rendered HTML. |
| **Groq + `openai/gpt-oss-120b`** | Fastest inference available for a 120B-class model — latency is the entire UX here. Same model for suggestions and chat as the brief requires. |
| **Whisper Large V3 (via Groq)** | Best open-source ASR; Groq hardware makes 30-second chunks transcribe in well under a second. |
| **`MediaRecorder` API** | Native, no deps, produces `audio/webm;codecs=opus` which Whisper accepts directly. Safari falls back to `audio/mp4`. |
| **Streaming via `ReadableStream`** | Chat responses stream token-by-token; first token lands within ~200ms of the request completing. |
| **Tailwind CSS** | Utility-first, keeps styles co-located with components. Single-session app doesn't need design-system scaffolding. |
| **`react-markdown` v9** | Safe markdown rendering for AI responses, no `dangerouslySetInnerHTML`. |
| **`localStorage` for settings** | Meets the "no database, no persistence on reload" requirement while keeping the API key across sessions in the same browser. |

---

## Prompt strategy

There are **three** distinct prompts, each tuned for a different job. This is the core of the submission — the brief weighs prompt quality above everything else.

### 1. Live suggestion prompt

Fires every 30s against the tail of the transcript. System prompt instructs the model to:

1. **Classify the conversation state** — question just asked? claim made? topic shift? technical deep-dive? small talk?
2. **Pick a mix of 3 suggestions** from 5 types: `question`, `talking_point`, `answer`, `fact_check`, `clarification`. The model is told explicitly *not* to always return the same mix.
3. **Emit strict JSON** via `response_format: { type: 'json_object' }` with `{ suggestions: [{type, preview, fullContext}] }`.

Two-field design: **`preview`** is a standalone 1–2 sentence insight (the brief: "the preview alone should already deliver value even if not clicked"). **`fullContext`** is the richer payload fed into the detailed-answer prompt when the user taps the card.

`temperature: 0.4` for JSON-mode reliability — Groq's structured outputs are more deterministic at lower temperatures.

### 2. Detailed-answer prompt (on-click expansion)

Separate from the typed-chat prompt because a suggestion click is a **different task**: the model already knows what to say (the `fullContext`), it just needs to expand it into a scannable, grounded answer the user can read in 15 seconds mid-conversation.

Structured response rules:
- **Lead with the payload** — first sentence is the actual answer, no preamble
- **Ground in the transcript** — quote the specific line that triggered the suggestion
- **Match the suggestion type** — `fact_check` gets a claim-vs-reality split; `talking_point` gets phrasings to say aloud; `answer` gets a TL;DR + backup; etc.
- **End with a concrete next move** — one line on what to say in the next 10 seconds
- **Flag uncertainty explicitly** rather than fabricating

Gets a **larger** context window than suggestions (6k chars default vs. 4k) because deep expansions need more grounding, but **smaller** than free-form chat (8k) because the task is focused.

### 3. Chat prompt (typed questions)

Free-form questions have a different shape: the user may ask about anything, including things not in the transcript. This prompt is more general — structured markdown, quote the transcript when relevant, flag possibly-inaccurate claims, fall back to general knowledge with a note. Gets the largest context window (8k).

---

## Tradeoffs and decisions to defend

**30-second chunks, not continuous streaming.**  
Whisper via Groq is fast enough that we could send shorter chunks (e.g. 10s) for faster first-transcript feedback, but shorter chunks hurt Whisper's accuracy on conversational speech — it loses sentence-boundary context. 30s matches the assignment spec and is the sweet spot empirically.

**Chained `onstop` loop, not `setInterval(stop + start)`.**  
Original implementation used `setInterval` to call `recorder.stop()` then immediately `startChunk()`. That creates a race: `recorder.stop()` is async (fires `onstop` on the next tick), so by the time `onstop` runs, `recorderRef.current` has already been overwritten by the new recorder. In some browsers the new recorder's `onstop` fires for the old recorder's blobs. Fixed by chaining: `setTimeout` → `recorder.stop()` → `onstop` transcribes the blob AND starts the next chunk. Guarantees no overlap.

**Client-side API key.**  
The Groq key lives in `localStorage` and is forwarded as an `x-groq-api-key` header. Yes, it's visible in browser devtools. Alternative would be server-side env vars + auth, which violates the "no DB, no auth" requirement. The tradeoff is explicit: zero infra vs. key exposure in your own browser.

**Suggestion batches prepend, never replace.**  
Each 30s refresh adds a new batch *above* the previous one. Users can scroll back and see how the suggestions tracked the conversation. More useful than a single rolling window.

**Groq-typed errors, not string sniffing.**  
All three API routes use `instanceof Groq.APIError` with `.status` instead of `message.includes('401')`. Maps `401` and `429` to user-friendly strings; everything else passes the SDK message through.

**Mid-stream errors propagate via `controller.error()`.**  
When the Groq stream fails partway through a chat response, the server calls `controller.error(err)` on the `ReadableStream`, which makes the client's `reader.read()` reject. The client preserves whatever partial content streamed before the failure and shows the error inline — rather than silently truncating.

**Suggestions don't stream.**  
They need the full JSON blob before parsing into 3 cards, so streaming buys nothing. ~1s wait is fine given the 30s cadence.

**No persistence on reload.**  
React state only. This is explicit in the brief and keeps the submission clean — a single-session app doesn't need IndexedDB/Supabase.

---

## What's editable in Settings

- Groq API key
- Chat model ID (default: `openai/gpt-oss-120b`)
- Transcription model ID (default: `whisper-large-v3`)
- **Three** context windows: suggestion / detailed-answer / chat
- **Three** system prompts: suggestion / detailed-answer / chat

Validation: prompts containing `{{TRANSCRIPT}}` must keep the placeholder; context windows clamp to a 500-char minimum.

---

## Deploying to Vercel

Push to GitHub, then [vercel.com](https://vercel.com) → Add New → import the repo → Deploy. Framework auto-detects as Next.js.

**No environment variables needed** — the app has no server-side secrets. Users supply their own Groq key via the Settings page.

`app/api/transcribe/route.ts` is pinned to `runtime = 'nodejs'` so Vercel doesn't deploy it to Edge (FormData + File constructor behavior differs on Edge).

---

## File structure

```
app/
  page.tsx              # 3-column layout coordinator
  layout.tsx            # Root HTML, fonts
  globals.css           # Tailwind + prose styles
  settings/page.tsx     # Settings form (localStorage)
  api/
    transcribe/route.ts # POST audio → Groq Whisper → text
    suggestions/route.ts# POST transcript → 3 suggestion cards (JSON mode)
    chat/route.ts       # POST messages → streaming markdown

components/
  TranscriptPanel.tsx   # Left: mic controls + transcript
  SuggestionsPanel.tsx  # Middle: suggestion batches
  SuggestionCard.tsx    # Individual card
  ChatPanel.tsx         # Right: streaming chat

hooks/
  useRecorder.ts        # MediaRecorder lifecycle + chunked transcription
  useSuggestions.ts     # 30s auto-refresh loop

lib/
  types.ts              # Shared TS interfaces
  prompts.ts            # DEFAULT_SUGGESTION_PROMPT,
                        # DEFAULT_DETAILED_ANSWER_PROMPT,
                        # DEFAULT_CHAT_PROMPT
  settings.ts           # localStorage read/write
  groq.ts               # Client factory + model constants
  export.ts             # Session JSON download
```

---

## Export format

The "Export JSON" button downloads a single file containing:

```json
{
  "exportedAt": "2026-04-17T...",
  "transcript":        [ { id, text, timestamp (ISO) }, ... ],
  "suggestionBatches": [ { id, timestamp, suggestions: [...] }, ... ],
  "chatHistory":       [ { id, role, display, content, timestamp }, ... ]
}
```

`display` is the short preview shown in the UI bubble for suggestion clicks; `content` is the full prompt payload the model received. Both are included so reviewers can see exactly what was sent.
