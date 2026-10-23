import {
  isTextBlock,
  newBlockId,
  textBlockWords,
  type AttachmentBlock,
  type Block,
  type StudyPage,
  type TextBlock,
} from "@/lib/study-pages"

// AI 학습 도우미 (client side). The browser never sees the API key: it calls our route (app/api/ai/chat/route.ts),
// which checks the session and calls Claude. Chat history lives only in the open page (not saved).

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

export type AiResult = { ok: true; text: string } | { ok: false; message: string }

export const MAX_CONTEXT_CHARS = 20_000

const textOf = (blocks: Block[]) =>
  blocks
    .filter(isTextBlock)
    .map(textBlockWords)
    .filter((t) => t.trim())
    .join("\n")

// What the AI reads: title, body (or the study note's sections), and the latest study records.
export function pageContextText(page: StudyPage) {
  const parts = [`제목: ${page.title || "제목 없음"}`]
  if (page.note) {
    parts.push(`[오늘 배운 내용]\n${textOf(page.note.learned) || "(비어 있음)"}`)
    if (page.note.concepts.length > 0) parts.push(`[핵심 개념]\n${page.note.concepts.map((c) => `- ${c.text}`).join("\n")}`)
    if (page.note.confusions.length > 0)
      parts.push(`[헷갈린 점]\n${page.note.confusions.map((c) => `- ${c.text}${c.resolved ? " (해결함)" : ""}`).join("\n")}`)
  } else {
    parts.push(`[본문]\n${textOf(page.blocks) || "(비어 있음)"}`)
  }
  const records = [...page.studyRecords].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3)
  if (records.length > 0)
    parts.push(
      `[최근 학습 기록]\n${records
        .map((r) => `- ${r.date} ${r.durationMinutes}분, 이해도 ${r.understanding}/5: ${r.studyContent}${r.difficulties ? ` / 어려웠던 점: ${r.difficulties}` : ""}`)
        .join("\n")}`,
    )
  return parts.join("\n\n").slice(0, MAX_CONTEXT_CHARS)
}

// At most this many PDFs go along with one question (the server checks it too).
export const MAX_AI_PDFS = 2

// PDFs in the page the AI could read. Only files saved to Storage (`path`) can be sent; ones that live
// only in this tab are listed with `stored: false` so the screen can say why they can't be picked.
export function pagePdfs(page: StudyPage): { block: AttachmentBlock; stored: boolean }[] {
  const blocks = page.note ? page.note.learned : page.blocks
  return blocks
    .filter((b): b is AttachmentBlock => (b.type === "file" || b.type === "image") && b.mime === "application/pdf")
    .map((block) => ({ block, stored: Boolean(block.path) }))
}

export async function askStudyAI(context: string, messages: ChatMessage[], pdfs: AttachmentBlock[] = []): Promise<AiResult> {
  try {
    const attachments = pdfs
      .filter((b) => b.path)
      .slice(0, MAX_AI_PDFS)
      .map((b) => ({ path: b.path, name: b.name }))
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(attachments.length > 0 ? { context, messages, attachments } : { context, messages }),
    })
    const data = (await res.json().catch(() => null)) as { text?: string; error?: string } | null
    if (!res.ok || !data?.text) return { ok: false, message: data?.error ?? "AI가 답하지 못했어요. 잠시 후 다시 시도해 주세요." }
    return { ok: true, text: data.text }
  } catch {
    return { ok: false, message: "네트워크 문제로 AI에 연결하지 못했어요." }
  }
}

const clean = (text: string) => text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1")

// The AI answers in a small markdown subset (# headings, - lists, ``` code); turn it into page blocks.
export function markdownToBlocks(markdown: string): TextBlock[] {
  const blocks: TextBlock[] = []
  let code: string[] | null = null
  for (const raw of markdown.replace(/\r/g, "").split("\n")) {
    if (raw.trim().startsWith("```")) {
      if (code) {
        blocks.push({ id: newBlockId(), type: "code", text: code.join("\n") })
        code = null
      } else code = []
      continue
    }
    if (code) {
      code.push(raw)
      continue
    }
    const line = raw.trim()
    if (!line || /^-{3,}$/.test(line)) continue
    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      const level = Math.min(heading[1].length, 3)
      blocks.push({ id: newBlockId(), type: (["h1", "h2", "h3"] as const)[level - 1], text: clean(heading[2]) })
    } else if (/^[-*]\s+\[( |x|X)\]\s+/.test(line)) {
      const checked = /^[-*]\s+\[(x|X)\]/.test(line)
      blocks.push({ id: newBlockId(), type: "todo", text: clean(line.replace(/^[-*]\s+\[( |x|X)\]\s+/, "")), checked })
    } else if (/^\d+[.)]\s+/.test(line)) {
      blocks.push({ id: newBlockId(), type: "ol", text: clean(line.replace(/^\d+[.)]\s+/, "")) })
    } else if (/^>\s?/.test(line)) {
      blocks.push({ id: newBlockId(), type: "quote", text: clean(line.replace(/^>\s?/, "")) })
    } else if (/^[-*•]\s+/.test(line)) {
      blocks.push({ id: newBlockId(), type: "li", text: clean(line.replace(/^[-*•]\s+/, "")) })
    } else {
      blocks.push({ id: newBlockId(), type: "p", text: clean(line) })
    }
  }
  if (code) blocks.push({ id: newBlockId(), type: "code", text: code.join("\n") })
  return blocks
}
