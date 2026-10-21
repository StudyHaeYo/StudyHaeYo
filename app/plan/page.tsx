"use client"

import { Sidebar } from "@/components/sidebar"
import { LearningPlans } from "@/components/plan/learning-plans"

export default function PlanPage() {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />

      <main className="flex-1 overflow-y-auto px-6 py-6 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <header className="mb-6">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">학습 계획</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              전체, 과목, 페이지 단위로 기간과 목표를 정해 두세요.
            </p>
          </header>

          <LearningPlans />
        </div>
      </main>
    </div>
  )
}
