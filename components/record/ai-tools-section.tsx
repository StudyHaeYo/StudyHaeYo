"use client"

import { useState, type ReactNode } from "react"
import { ChevronDown, HelpCircle, Sparkles, type LucideIcon } from "lucide-react"
import { SummaryTab } from "@/components/record/summary-tab"
import { QuizTab } from "@/components/record/quiz-tab"

type AiTool = "summary" | "quiz"

const tools: { id: AiTool; label: string; icon: LucideIcon }[] = [
  { id: "summary", label: "요약하기", icon: Sparkles },
  { id: "quiz", label: "문제 생성하기", icon: HelpCircle },
]

export function AiToolsSection() {
  const [open, setOpen] = useState<Record<AiTool, boolean>>({ summary: false, quiz: false })

  const toggle = (id: AiTool) => setOpen((prev) => ({ ...prev, [id]: !prev[id] }))

  return (
    <section aria-labelledby="ai-tools-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-indigo-600" />
          <h2 id="ai-tools-heading" className="text-sm font-semibold text-foreground">
            AI 학습 도구
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">이 페이지 본문을 바탕으로 요약하거나 확인 문제를 만들어요.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tools.map(({ id, label, icon: Icon }) => {
          const active = open[id]
          return (
            <button
              key={id}
              onClick={() => toggle(id)}
              aria-expanded={active}
              aria-controls={`ai-panel-${id}`}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium shadow-sm transition-colors ${
                active
                  ? "border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700"
                  : "border-border bg-card text-foreground hover:border-indigo-300 hover:text-indigo-600"
              }`}
            >
              <Icon className="size-4" />
              {label}
              <ChevronDown className={`size-4 transition-transform ${active ? "rotate-180" : ""}`} />
            </button>
          )
        })}
      </div>

      <AccordionPanel id="ai-panel-summary" open={open.summary}>
        <SummaryTab />
      </AccordionPanel>
      <AccordionPanel id="ai-panel-quiz" open={open.quiz}>
        <QuizTab />
      </AccordionPanel>
    </section>
  )
}

function AccordionPanel({ id, open, children }: { id: string; open: boolean; children: ReactNode }) {
  return (
    <div
      id={id}
      hidden={!open}
      className="animate-in fade-in slide-in-from-top-1 duration-200"
    >
      {children}
    </div>
  )
}
