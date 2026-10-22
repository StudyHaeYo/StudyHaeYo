import { createClient } from "@/lib/supabase/server"

// AI 학습 도우미: the only place that talks to Claude. The key (ANTHROPIC_API_KEY) is a server-only Vercel env var.
// Signed-in users only; each request carries the page text and the chat so far (nothing is stored).

const MODEL = process.env.AI_MODEL || "claude-sonnet-5-5"
const MAX_MESSAGES = 20
const MAX_MESSAGE_CHARS = 4_000
const MAX_CONTEXT_CHARS = 20_000
const LIMIT_PER_MINUTE = 10

const SYSTEM = `너는 학습 관리 서비스 "스터디 해요"의 AI 학습 도우미다. 사용자는 대학생·자격증 준비생이다.
- <page> 안의 학습 페이지 내용을 바탕으로 답한다. 페이지에 없는 내용을 보충하면 그 문장 끝에 "(페이지 밖 내용)"이라고 표시한다.
- 한국어로, 짧고 정확하게 쓴다. 형식은 # 제목, - 목록, 일반 문단만 쓴다. 표와 굵은 글씨는 쓰지 않는다.
- 문제를 만들 때는 1. 2. 처럼 번호를 붙이고, 정답과 해설은 맨 아래 "## 정답과 해설" 아래에 모은다.
- 학습과 관계없는 요청은 정중히 학습 이야기로 돌린다.`

// Best-effort per-instance rate limit (serverless instances don't share memory).
const recent = new Map<string, number[]>()
function overLimit(userId: string) {
  const now = Date.now()
  const times = (recent.get(userId) ?? []).filter((t) => now - t < 60_000)
  times.push(now)
  recent.set(userId, times)
  return times.length > LIMIT_PER_MINUTE
}

type Message = { role: "user" | "assistant"; content: string }

function parseBody(body: unknown): { context: string; messages: Message[] } | null {
  if (!body || typeof body !== "object") return null
  const { context, messages } = body as { context?: unknown; messages?: unknown }
  if (typeof context !== "string" || !Array.isArray(messages) || messages.length === 0) return null
  const parsed: Message[] = []
  for (const m of messages.slice(-MAX_MESSAGES)) {
    if (!m || typeof m !== "object") return null
    const { role, content } = m as { role?: unknown; content?: unknown }
    if ((role !== "user" && role !== "assistant") || typeof content !== "string" || !content.trim()) return null
    parsed.push({ role, content: content.slice(0, MAX_MESSAGE_CHARS) })
  }
  while (parsed.length > 0 && parsed[0].role !== "user") parsed.shift()
  if (parsed.length === 0 || parsed[parsed.length - 1].role !== "user") return null
  return { context: context.slice(0, MAX_CONTEXT_CHARS), messages: parsed }
}

export async function POST(request: Request) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return Response.json({ error: "AI 키가 아직 설정되지 않았어요. (ANTHROPIC_API_KEY)" }, { status: 503 })

  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) return Response.json({ error: "로그인이 필요해요." }, { status: 401 })
  if (overLimit(data.user.id)) return Response.json({ error: "요청이 너무 많아요. 1분 뒤에 다시 시도해 주세요." }, { status: 429 })

  const input = parseBody(await request.json().catch(() => null))
  if (!input) return Response.json({ error: "요청 형식이 올바르지 않아요." }, { status: 400 })

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      system: `${SYSTEM}\n\n<page>\n${input.context}\n</page>`,
      messages: input.messages,
    }),
  })
  if (!res.ok) {
    console.error("AI request failed", res.status, (await res.text()).slice(0, 500))
    return Response.json({ error: "AI가 답하지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 502 })
  }
  const json = (await res.json()) as { content?: { type: string; text?: string }[] }
  const text = (json.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("").trim()
  if (!text) return Response.json({ error: "AI가 빈 답을 보냈어요. 다시 시도해 주세요." }, { status: 502 })
  return Response.json({ text })
}
