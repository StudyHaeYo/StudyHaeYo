import { PageShell } from "@/components/page-shell"
import { LearningPlans } from "@/components/plan/learning-plans"

export const metadata = { title: "학습 계획 · 스터디 해요" }

// ?subject=<id> (학습 분석의 [계획 세우기]): the form opens with that subject already chosen.
export default async function PlanPage({ searchParams }: { searchParams: Promise<{ subject?: string }> }) {
  const { subject } = await searchParams
  return (
    <PageShell>
      <LearningPlans key={subject ?? "plans"} initialSubjectId={subject} />
    </PageShell>
  )
}
