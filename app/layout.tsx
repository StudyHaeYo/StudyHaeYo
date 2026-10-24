import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Toaster } from 'sonner'
import { DataSync } from '@/components/data-sync'
import { SessionTracker } from '@/components/study-session/session-tracker'
import { PomodoroDriver } from '@/components/study-session/pomodoro-driver'
import { StudySessionLayer } from '@/components/study-session/session-summary-modal'
import { QuickRecordLayer } from '@/components/record/quick-record-dialog'
// Pretendard: 한국어 글꼴. 페이지에 쓰인 글자 묶음만 내려받는다(dynamic subset). 우리 서버에서 함께 배포된다.
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import './globals.css'

export const metadata: Metadata = {
  title: '스터디 해요 · 학습 기록 대시보드',
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
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        <DataSync />
        {children}
        <SessionTracker />
        <PomodoroDriver />
        <StudySessionLayer />
        <QuickRecordLayer />
        <Toaster position="bottom-center" richColors closeButton />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
