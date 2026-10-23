import { isTextBlock, textBlockWords, type Block, type StudyPage } from "@/lib/study-pages"
import { nodePath, type WorkspaceState } from "@/lib/workspace"

// 노트 검색 (⌘K): pages by title, body, 핵심 개념, 헷갈린 점 and study-record notes. Runs on the data already on
// screen (no server call). A query of only Korean initial consonants ("ㅎㅅ") matches titles by 초성.

export type SearchField = "제목" | "본문" | "핵심 개념" | "헷갈린 점" | "학습 기록"

export interface SearchResult {
  pageId: string
  title: string
  // Folders/subjects above the page, e.g. "전공 공부 › 자료구조".
  path: string
  field: SearchField
  // The matching line, cut around the match.
  snippet: string
  // Where the match sits in `snippet` (for highlighting); null for 초성 matches.
  match: [number, number] | null
}

const MAX_RESULTS = 20
const SNIPPET_RADIUS = 36

const CHOSEONG = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"]

// "해시 테이블" → "ㅎㅅ ㅌㅇㅂ"; other characters are kept as they are.
export function choseong(text: string) {
  let out = ""
  for (const ch of text) {
    const code = ch.charCodeAt(0) - 0xac00
    out += code >= 0 && code < 11172 ? CHOSEONG.at(Math.floor(code / 588)) : ch
  }
  return out
}

const isChoseongQuery = (q: string) => /^[ㄱ-ㅎ\s]+$/.test(q)

const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ")

function snippetAround(line: string, at: number, length: number): Pick<SearchResult, "snippet" | "match"> {
  const start = Math.max(0, at - SNIPPET_RADIUS)
  const end = Math.min(line.length, at + length + SNIPPET_RADIUS)
  const prefix = start > 0 ? "…" : ""
  const suffix = end < line.length ? "…" : ""
  const snippet = prefix + line.slice(start, end) + suffix
  return { snippet, match: [prefix.length + at - start, prefix.length + at - start + length] }
}

function blockLines(blocks: Block[]) {
  return blocks.filter(isTextBlock).flatMap((b) => textBlockWords(b).split("\n"))
}

function pageSources(page: StudyPage): { field: SearchField; lines: string[] }[] {
  const sources: { field: SearchField; lines: string[] }[] = [{ field: "본문", lines: blockLines(page.blocks) }]
  if (page.note) {
    sources.push({ field: "본문", lines: blockLines(page.note.learned) })
    sources.push({ field: "핵심 개념", lines: page.note.concepts.map((c) => c.text) })
    sources.push({ field: "헷갈린 점", lines: page.note.confusions.map((c) => c.text) })
  }
  sources.push({
    field: "학습 기록",
    lines: page.studyRecords.flatMap((r) => [r.studyContent, r.difficulties, r.nextSteps]).filter(Boolean),
  })
  return sources
}

export function searchWorkspace(workspace: WorkspaceState, rawQuery: string): SearchResult[] {
  const query = rawQuery.trim()
  if (!query) return []
  const results: SearchResult[] = []
  const pathOf = (page: StudyPage) =>
    nodePath(workspace, page.parentId)
      .map((n) => n.name)
      .join(" › ")

  if (isChoseongQuery(query)) {
    const q = query.replace(/\s+/g, "")
    for (const page of workspace.pages) {
      const title = page.title || "제목 없음"
      if (choseong(title).replace(/\s+/g, "").includes(q))
        results.push({ pageId: page.id, title, path: pathOf(page), field: "제목", snippet: title, match: null })
    }
    return results.slice(0, MAX_RESULTS)
  }

  const q = normalize(query)
  const titleHits: SearchResult[] = []
  const bodyHits: SearchResult[] = []
  for (const page of workspace.pages) {
    const title = page.title || "제목 없음"
    const at = normalize(title).indexOf(q)
    if (at !== -1) {
      titleHits.push({ pageId: page.id, title, path: pathOf(page), field: "제목", snippet: title, match: [at, at + q.length] })
      continue
    }
    // One result per page: its first matching line, in the order body → concepts → confusions → records.
    found: for (const { field, lines } of pageSources(page)) {
      for (const line of lines) {
        const hit = normalize(line).indexOf(q)
        if (hit === -1) continue
        bodyHits.push({ pageId: page.id, title, path: pathOf(page), field, ...snippetAround(line, hit, q.length) })
        break found
      }
    }
  }
  return [...titleHits, ...bodyHits].slice(0, MAX_RESULTS)
}
