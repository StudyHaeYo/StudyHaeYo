import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import { Toaster } from 'sonner'
import { DataSync } from '@/components/data-sync'
import { SessionTracker } from '@/components/study-session/session-tracker'
import { PomodoroDriver } from '@/components/study-session/pomodoro-driver'
import { StudySessionLayer } from '@/components/study-session/session-summary-modal'
import { QuickRecordLayer } from '@/components/record/quick-record-dialog'
import { parseTheme, THEME_COOKIE } from '@/lib/theme'
// Pretendard: 한국어 글꼴. 페이지에 쓰인 글자 묶음만 내려받는다(dynamic subset). 우리 서버에서 함께 배포된다.
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import './globals.css'

export const metadata: Metadata = {
  title: '스터디 해요',
  description: '자기주도 학습 기록을 관리하는 스터디 해요 대시보드',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
  // iPhone "홈 화면에 추가" opens it like an app (Android/desktop read app/manifest.ts).
  appleWebApp: { capable: true, title: '스터디 해요', statusBarStyle: 'default' },
}

// The browser chrome (address bar, scrollbars, form controls) follows the chosen theme (D-48). Colors are the
// page background of each theme (app/globals.css --background).
const LIGHT_BAR = '#ffffff'
const DARK_BAR = '#13151b'

export async function generateViewport(): Promise<Viewport> {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value)
  if (theme === 'light') return { colorScheme: 'light', themeColor: LIGHT_BAR }
  if (theme === 'dark') return { colorScheme: 'dark', themeColor: DARK_BAR }
  return {
    colorScheme: 'light dark',
    themeColor: [
      { media: '(prefers-color-scheme: light)', color: LIGHT_BAR },
      { media: '(prefers-color-scheme: dark)', color: DARK_BAR },
    ],
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // 화면 테마(D-48): the cookie the settings screen writes. Rendering it here keeps the server HTML and the first client
  // render the same (no flash, no hydration mismatch); app/globals.css switches the colors on data-theme.
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value)
  return (
    <html lang="ko" data-theme={theme}>
      <body className="antialiased">
        {/* First Tab stop: skip the sidebar's tree straight to the screen's content (WCAG 2.4.1). */}
        <a
          href="#main"
          className="sr-only rounded-lg bg-background text-sm font-medium text-foreground shadow-lg focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:px-3 focus:py-2 focus:outline-2 focus:outline-action-500"
        >
          본문으로 건너뛰기
        </a>
        <DataSync />
        {children}
        <SessionTracker />
        <PomodoroDriver />
        <StudySessionLayer />
        <QuickRecordLayer />
        <Toaster position="bottom-center" richColors closeButton theme={theme} />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
