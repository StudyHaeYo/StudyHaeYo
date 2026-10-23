import { createClient } from "@/lib/supabase/server"

// AI 학습 도우미: the only place that talks to Claude. The key (ANTHROPIC_API_KEY) is a server-only Vercel env var.
// Signed-in users only; each request carries the page text and the chat so far (nothing is stored).
// PDFs the user picks are read here from Storage with the user's own session (RLS: own files only)
// and sent to Claude as document blocks. The browser only sends their Storage paths.

// PDF requests can take a while (download + a long document); allow up to a minute.
export const maxDuration = 60

const MODEL = process.env.AI_MODEL || "claude-sonnet-5-5"
const MAX_MESSAGES = 20
const MAX_MESSAGE_CHARS = 4_000
const MAX_CONTEXT_CHARS = 20_000
const LIMIT_PER_MINUTE = 10
// Claude accepts up to 100 PDF pages per request (32MB). Pages cost ~1.5–3k tokens each, so we stop lower.
const MAX_PDFS = 2
const MAX_PDF_PAGES = 50
const MAX_PDF_BYTES = 10 * 1024 * 1024

const SYSTEM = `너는 학습 관리 서비스 "스터디 해요"의 AI 학습 도우미다. 사용자는 대학생·자격증 준비생이다.

[근거]
- <page> 안의 학습 페이지 내용과 첨부된 PDF를 근거로 답한다. 페이지에 없는 내용을 보충하면 그 문장 끝에 "(페이지 밖 내용)"이라고 붙인다.
- 페이지 본문이 비어 있고 PDF도 없으면, 제목과 질문을 주제로 일반 지식으로 답한다. 이때 답의 첫 줄은 정확히 "> 자료 없이 만든 내용이에요. 교재와 꼭 확인하세요."로 시작하고, 문장마다 "(페이지 밖 내용)"은 붙이지 않는다.
- PDF에서 가져온 내용은 문장 끝에 (p.3)처럼 쪽 번호를 붙인다.

[형식]
- 한국어로, 짧고 정확하게 쓴다. # 제목, - 목록, 1. 번호 목록, 일반 문단만 쓴다. 표와 굵은 글씨는 쓰지 않는다.
- 정리를 할 때는 "## 핵심 개념" 아래에 "- 용어: 한 줄 설명" 형식으로 핵심 개념을 모은다(복습 카드가 된다).

[문제 만들기]
- 문제에는 1. 2. 번호를 붙인다. 객관식 보기는 ① ② ③ ④를 쓴다.
- 정답과 해설은 맨 아래 "## 정답과 해설" 아래에만 모은다(화면에서 접혀 보인다).
- 마지막 줄에 "답을 보내 주면 채점해 드릴게요."라고 쓴다.

[채점]
- 사용자가 답을 보내면(예: "1번 ②, 2번 스택") 앞서 낸 문제나 PDF(문제집)의 정답을 근거로 채점한다. 근거가 없으면 일반 지식으로 채점하고 그렇다고 밝힌다.
- 문제마다 "1. 맞음" 또는 "1. 틀림 — 정답 ③. 짧은 해설" 형식으로 쓴다.
- 틀린 문제가 있으면 "## 헷갈린 점" 아래에 "- 개념: 무엇을 헷갈렸는지" 형식으로 한 줄씩 정리한다.
- 답의 마지막 줄은 정확히 "점수: 맞은 수/문제 수" 형식으로 쓴다(예: 점수: 4/5). 채점이 아닌 답에는 이 줄을 쓰지 않는다.

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
type PdfRef = { path: string; name: string }

function parsePdfs(value: unknown): PdfRef[] | null {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > MAX_PDFS) return null
  const refs: PdfRef[] = []
  for (const v of value) {
    if (!v || typeof v !== "object") return null
    const { path, name } = v as { path?: unknown; name?: unknown }
    if (typeof path !== "string" || !/^[0-9a-f-]{36}\/[A-Za-z0-9-]+(\.[a-z0-9]{1,8})?$/.test(path)) return null
    refs.push({ path, name: typeof name === "string" ? name.slice(0, 200) : "PDF" })
  }
  return refs
}

function parseBody(body: unknown): { context: string; messages: Message[]; pdfs: PdfRef[] } | null {
  if (!body || typeof body !== "object") return null
  const { context, messages, attachments } = body as { context?: unknown; messages?: unknown; attachments?: unknown }
  const pdfs = parsePdfs(attachments)
  if (!pdfs) return null
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
  return { context: context.slice(0, MAX_CONTEXT_CHARS), messages: parsed, pdfs }
}

// Rough page count from the raw file ("/Type /Page" objects). Misses PDFs that keep pages in compressed
// object streams (returns 0); Claude's own 100-page limit still applies to those.
function countPdfPages(bytes: Uint8Array) {
  const text = new TextDecoder("latin1").decode(bytes)
  return (text.match(/\/Type\s*\/Page(?![a-zA-Z])/g) ?? []).length
}

type Supabase = Awaited<ReturnType<typeof createClient>>

async function loadPdfs(supabase: Supabase, userId: string, refs: PdfRef[]) {
  const docs: { name: string; data: string }[] = []
  let pages = 0
  for (const ref of refs) {
    if (!ref.path.startsWith(`${userId}/`)) return { error: "다른 사람의 파일은 열 수 없어요." }
    const { data, error } = await supabase.storage.from("attachments").download(ref.path)
    if (error || !data) return { error: `"${ref.name}" 파일을 불러오지 못했어요.` }
    if (data.size > MAX_PDF_BYTES) return { error: `"${ref.name}" 파일이 너무 커요.` }
    const bytes = new Uint8Array(await data.arrayBuffer())
    if (new TextDecoder("latin1").decode(bytes.subarray(0, 5)) !== "%PDF-") return { error: `"${ref.name}"은(는) PDF가 아니에요.` }
    pages += countPdfPages(bytes)
    if (pages > MAX_PDF_PAGES)
      return { error: `PDF가 너무 길어요. 한 번에 ${MAX_PDF_PAGES}쪽까지 읽을 수 있어요. 필요한 쪽만 따로 PDF로 만들어 올려 주세요.` }
    docs.push({ name: ref.name, data: Buffer.from(bytes).toString("base64") })
  }
  return { docs }
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

  // PDFs ride on the first user message so the prompt prefix stays the same turn after turn;
  // cache_control lets follow-up questions reuse it instead of paying for the whole PDF again.
  let messages: unknown[] = input.messages
  if (input.pdfs.length > 0) {
    const loaded = await loadPdfs(supabase, data.user.id, input.pdfs)
    if ("error" in loaded) return Response.json({ error: loaded.error }, { status: 400 })
    const [first, ...rest] = input.messages
    const documents = loaded.docs.map((doc, i) => ({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: doc.data },
      title: doc.name,
      ...(i === loaded.docs.length - 1 ? { cache_control: { type: "ephemeral" } } : {}),
    }))
    messages = [{ role: "user", content: [...documents, { type: "text", text: first.content }] }, ...rest]
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      system: `${SYSTEM}\n\n<page>\n${input.context}\n</page>`,
      messages,
    }),
  })
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 500)
    console.error("AI request failed", res.status, detail)
    if (res.status === 413 || (input.pdfs.length > 0 && /pdf|page|document/i.test(detail)))
      return Response.json({ error: "PDF가 너무 크거나 읽을 수 없는 형식이에요. 쪽수를 줄이거나 다른 PDF로 시도해 주세요." }, { status: 400 })
    return Response.json({ error: "AI가 답하지 못했어요. 잠시 후 다시 시도해 주세요." }, { status: 502 })
  }
  const json = (await res.json()) as { content?: { type: string; text?: string }[] }
  const text = (json.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("").trim()
  if (!text) return Response.json({ error: "AI가 빈 답을 보냈어요. 다시 시도해 주세요." }, { status: 502 })
  return Response.json({ text })
}
