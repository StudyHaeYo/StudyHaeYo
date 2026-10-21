"use client"

import { useCurrentUser } from "@/lib/auth"

// 로그인한 사용자의 이름/이메일. 첫 렌더에서는 자리표시를 보여준다(hydration 안전).
export function ProfileSection() {
  const user = useCurrentUser()
  const rows = [
    { label: "이름", value: user?.name },
    { label: "이메일", value: user?.email },
  ]

  return (
    <section aria-labelledby="settings-profile" className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 id="settings-profile" className="text-sm font-semibold text-card-foreground">
          프로필
        </h2>
        <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">수정은 준비 중</span>
      </div>
      <dl className="divide-y divide-border">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="min-w-0 truncate font-medium text-card-foreground">
              {row.value ?? <span aria-hidden="true" className="inline-block h-3.5 w-28 rounded bg-muted align-middle" />}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
