"use client"

import { useState } from "react"
import Link from "next/link"
import { Check } from "lucide-react"
import { confusionBlocks, pageKind, sortRecordsNewestFirst, wrongProblems, type StudyPage } from "@/lib/study-pages"
import { updatePage } from "@/lib/workspace"
import { scopeRows, useScopeDeadlines } from "@/components/study-page/exam-scope"

// 시험 정리's "시험 전에 다시 볼 것" (D-35, D-36): gathered from the scope notes, nothing written here. Three sources,
// each tied to where it lives:
// - 헷갈린 점 not resolved yet (a block): pressing ? resolves it in its own note — only that mark, the note's 이해도
//   and review day stay as they are — with [되돌리기] right after
// - 오답 노트 problems not right yet (a block): read here, solved in the note
// - the 어려웠던 점 of the note's latest record only (free text, read only): once a newer record has none, it goes
// Notes come in the 범위표's order; one with nothing to gather is left out.

const SHOWN = 3

type Item =
  | { kind: "confusion"; id: string; text: string; resolved: boolean }
  | { kind: "problem"; id: string; text: string }
  | { kind: "record"; id: string; text: string; review: boolean }

const REVIEW_PREFIX = /^다시 볼 것:\s*/

function gather(page: StudyPage, justResolved: Set<string>): Item[] {
  const confusions = confusionBlocks(page.blocks).filter((b) => !b.checked || justResolved.has(b.id))
  const items: Item[] = confusions.map((b) => ({ kind: "confusion", id: b.id, text: b.text.trim(), resolved: !!b.checked }))
  if (pageKind(page) === "wrong-answers")
    for (const b of wrongProblems(page.blocks)) if (b.text.trim()) items.push({ kind: "problem", id: b.id, text: b.text.trim() })
  const latest = sortRecordsNewestFirst(page.studyRecords)[0]
  const hard = latest?.difficulties?.trim()
  if (latest && hard) {
    const review = REVIEW_PREFIX.test(hard)
    const text = hard.replace(REVIEW_PREFIX, "")
    // The same words already listed as a 헷갈린 점 of this note would only say it twice (exact match only).
    if (text && !items.some((i) => i.text === text)) items.push({ kind: "record", id: latest.id, text, review })
  }
  return items
}

const sourceLabel = (item: Item) =>
  item.kind === "confusion" ? "헷갈린 점" : item.kind === "problem" ? "틀린 문제" : item.review ? "지난 복습에서 놓친 곳" : "지난 기록의 어려웠던 점"

export function ExamRecheck({ examId, scope, examDate, today }: { examId: string; scope: StudyPage[]; examDate: string | undefined; today: string | null }) {
  // Resolved here this time: they stay in the list, crossed out, so a wrong press can be taken back.
  const [justResolved, setJustResolved] = useState<Set<string>>(() => new Set())
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const deadlines = useScopeDeadlines(today)
  if (scope.length === 0) return null

  const groups = scopeRows(scope, examDate, today, deadlines, examId)
    .map(({ page }) => ({ page, items: gather(page, justResolved) }))
    .filter((g) => g.items.length > 0)
  const open = groups.reduce((n, g) => n + g.items.filter((i) => !(i.kind === "confusion" && i.resolved)).length, 0)

  const setChecked = (pageId: string, blockId: string, checked: boolean) => {
    updatePage(pageId, (p) => ({ ...p, blocks: p.blocks.map((b) => (b.id === blockId ? { ...b, checked } : b)) }))
    setJustResolved((s) => new Set(s).add(blockId))
  }

  return (
    <section aria-labelledby="exam-recheck-heading" className="flex flex-col">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-2">
        <h2 id="exam-recheck-heading" className="text-base font-semibold text-foreground">
          시험 전에 다시 볼 것
          {open > 0 && <span className="ml-1.5 text-sm font-medium tabular-nums text-muted-foreground">{open}</span>}
        </h2>
        <p className="text-[13px] text-muted-foreground">범위 노트의 헷갈린 점 · 틀린 문제 · 지난 기록에서 모았어요</p>
      </div>
      {groups.length === 0 ? (
        <p className="border-t border-border py-3 text-sm text-muted-foreground">현재 범위에서 다시 볼 항목이 없어요.</p>
      ) : (
        <ul className="flex flex-col border-t border-border">
          {groups.map(({ page, items }) => {
            const title = page.title || "제목 없음"
            const all = expanded.has(page.id)
            const shown = all ? items : items.slice(0, SHOWN)
            return (
              <li key={page.id} className="border-b border-border py-3">
                <Link href={`/record/${page.id}`} className="text-sm font-semibold text-foreground hover:underline">
                  {title}
                </Link>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {shown.map((item) => (
                    <li key={`${item.kind}-${item.id}`} className="flex items-start gap-2.5">
                      {item.kind === "confusion" ? (
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={item.resolved}
                          aria-label={item.resolved ? `${item.text} 해결 취소` : `${item.text} 해결함`}
                          title={item.resolved ? "해결 취소" : "해결했으면 눌러요 (원래 노트에도 해결로 표시돼요)"}
                          onClick={() => setChecked(page.id, item.id, !item.resolved)}
                          className={`mt-[3px] flex size-[18px] shrink-0 items-center justify-center rounded-full border transition-colors ${
                            item.resolved
                              ? "border-muted-foreground/40 bg-muted-foreground/40 text-white"
                              : "border-attention-500 text-attention-700 hover:bg-attention-50"
                          }`}
                        >
                          {item.resolved ? <Check className="size-3" aria-hidden="true" /> : <span className="text-[11px] font-bold leading-none">?</span>}
                        </button>
                      ) : (
                        <span aria-hidden="true" className="mt-[9px] size-1.5 shrink-0 rounded-full bg-muted-foreground/50 [margin-inline:6px]" />
                      )}
                      <span className="min-w-0 flex-1 text-[15px] leading-relaxed">
                        {item.kind === "record" ? (
                          <span className="text-muted-foreground">{item.text}</span>
                        ) : (
                          <Link
                            href={`/record/${page.id}#b-${item.id}`}
                            className={`break-words hover:underline ${item.kind === "confusion" && item.resolved ? "text-muted-foreground line-through" : "text-foreground"}`}
                          >
                            {item.text}
                          </Link>
                        )}
                        <span className="ml-2 whitespace-nowrap text-xs text-muted-foreground">{sourceLabel(item)}</span>
                        {item.kind === "confusion" && item.resolved && (
                          <button
                            type="button"
                            onClick={() => setChecked(page.id, item.id, false)}
                            className="ml-2 text-xs font-medium text-action-700 hover:underline"
                          >
                            되돌리기
                          </button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                {items.length > SHOWN && (
                  <button
                    type="button"
                    aria-expanded={all}
                    onClick={() => setExpanded((s) => {
                      const next = new Set(s)
                      if (all) next.delete(page.id)
                      else next.add(page.id)
                      return next
                    })}
                    className="ml-7 mt-1 text-[13px] font-medium text-action-700 hover:underline"
                  >
                    {all ? "접기" : `${items.length - SHOWN}개 더 보기`}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
