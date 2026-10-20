import type { Metadata } from "next"
import { Sidebar } from "@/components/sidebar"
import { ProfileSection } from "@/components/settings/profile-section"
import { formatDuration } from "@/lib/study-pages"
import { WEEKLY_GOAL_MINUTES } from "@/lib/goals"

export const metadata: Metadata = {
  title: "설정 | 스터디 해요",
}

const sections = [
  {
    title: "학습 설정",
    rows: [
      { label: "기본 템플릿", value: "학습 노트" },
      { label: "복습 알림", value: "켜짐 · 오전 9시" },
      { label: "주간 목표 시간", value: formatDuration(WEEKLY_GOAL_MINUTES) },
    ],
  },
]

export default function SettingsPage() {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="h-screen flex-1 overflow-y-auto px-6 py-8 lg:px-10">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          <header className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold tracking-tight">설정</h1>
            <p className="text-sm text-muted-foreground">
              설정 변경 기능은 준비 중이에요. 지금은 현재 값만 확인할 수 있어요.
            </p>
          </header>

          <ProfileSection />

          {sections.map((section) => (
            <section
              key={section.title}
              aria-labelledby={`settings-${section.title}`}
              className="rounded-xl border border-border bg-card shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <h2 id={`settings-${section.title}`} className="text-sm font-semibold text-card-foreground">
                  {section.title}
                </h2>
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">준비 중</span>
              </div>
              <dl className="divide-y divide-border">
                {section.rows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                    <dt className="text-muted-foreground">{row.label}</dt>
                    <dd className="font-medium text-card-foreground">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </main>
    </div>
  )
}
