import type { Metadata } from "next"
import { PageHeader, PageShell, surface } from "@/components/page-shell"
import { ProfileSection } from "@/components/settings/profile-section"
import { formatDuration } from "@/lib/study-pages"
import { WEEKLY_GOAL_MINUTES } from "@/lib/goals"

export const metadata: Metadata = {
  title: "설정 · 스터디 해요",
}

const sections = [
  {
    title: "학습 설정",
    rows: [
      { label: "기본 템플릿", value: "빈 노트" },
      { label: "주간 목표 시간", value: formatDuration(WEEKLY_GOAL_MINUTES) },
    ],
  },
]

export default function SettingsPage() {
  return (
    <PageShell>
      <PageHeader title="설정" description="지금은 보기만 할 수 있어요." />
      <div className="flex flex-col gap-6">
        <ProfileSection />

        {sections.map((section) => (
          <section key={section.title} aria-labelledby={`settings-${section.title}`} className={surface}>
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 id={`settings-${section.title}`} className="text-sm font-semibold text-card-foreground">
                {section.title}
              </h2>
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
    </PageShell>
  )
}
