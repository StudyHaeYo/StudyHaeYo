"use client"

import { GraduationCap, Play } from "lucide-react"
import { Sidebar } from "@/components/sidebar"

export default function StudyModePage() {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />

      <main className="flex-1 overflow-y-auto px-6 py-6 lg:px-10">
        <div className="mx-auto max-w-2xl">
          <header className="mb-6">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              공부 모드
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              집중 타이머와 함께 공부 세션을 시작해보세요.
            </p>
          </header>

          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <GraduationCap className="size-6" />
            </div>
            <h3 className="text-base font-medium text-foreground">
              아직 진행 중인 공부 세션이 없어요
            </h3>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              공부 모드를 시작하면 집중 시간을 기록하고 학습 통계에 반영할 수 있어요.
            </p>
            <button className="mt-5 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700">
              <Play className="size-4" />공부 세션 시작하기
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
