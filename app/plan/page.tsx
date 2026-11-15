import { PageShell } from "@/components/page-shell"
import { LearningPlans } from "@/components/plan/learning-plans"

export const metadata = { title: "학습 계획 · 스터디 해요" }

export default function PlanPage() {
  return (
    <PageShell>
      <LearningPlans />
    </PageShell>
  )
}
