import type { Metadata } from "next"
import { cookies } from "next/headers"
import { PageHeader, PageShell } from "@/components/page-shell"
import { AccountSection, ProfileSection } from "@/components/settings/profile-section"
import { ThemeSection } from "@/components/settings/theme-section"
import { parseTheme, THEME_COOKIE } from "@/lib/theme"

export const metadata: Metadata = {
  title: "설정 · 스터디 해요",
}

// Only what can be changed here, with a label and a control per row and no explaining sentences (D-47, 2026-11-20).
export default async function SettingsPage() {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value)
  // 탈퇴(D-49) needs the server-only service_role key. Only whether it is set reaches the screen, never the key.
  const deletable = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  return (
    <PageShell>
      <PageHeader title="설정" />
      <div className="flex flex-col gap-6">
        <ProfileSection />
        <ThemeSection initial={theme} />
        <AccountSection deletable={deletable} />
      </div>
    </PageShell>
  )
}
