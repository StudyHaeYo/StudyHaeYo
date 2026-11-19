import { PageShell } from "@/components/page-shell"
import { LearningPlans } from "@/components/plan/learning-plans"

export const metadata = { title: "계획 · 스터디 해요" }

// Opens from 오늘 (개편안 D-43), no longer a menu of its own. ?new=1 (오늘의 [계획 만들기]) opens the form;
// ?subject=<id> (학습 분석 · 약한 곳의 [이 과목 계획 만들기]) opens it with that subject already chosen.
export default async function PlanPage({ searchParams }: { searchParams: Promise<{ subject?: string; new?: string }> }) {
  const { subject, new: fresh } = await searchParams
  return (
    <PageShell>
      <LearningPlans key={subject ?? fresh ?? "plans"} initialSubjectId={subject} startOpen={fresh === "1"} />
    </PageShell>
  )
}
