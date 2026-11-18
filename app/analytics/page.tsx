import { redirect } from "next/navigation"

// 학습 분석 is part of 돌아보기 now (개편안 D-43): old links and bookmarks land there.
export default function AnalyticsPage() {
  redirect("/records")
}
