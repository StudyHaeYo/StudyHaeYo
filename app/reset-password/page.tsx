import type { Metadata } from "next"
import Link from "next/link"
import { AuthShell } from "@/components/auth/auth-shell"
import { ResetPasswordForm } from "@/components/auth/reset-password-form"

export const metadata: Metadata = {
  title: "새 비밀번호 · 스터디 해요",
}

// Reached from the reset mail through /auth/callback, already signed in (the proxy sends anyone else to /login).
export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="새 비밀번호"
      footer={
        <Link href="/" className="font-medium text-action-600 hover:text-action-700 hover:underline">
          바꾸지 않고 홈으로
        </Link>
      }
    >
      <ResetPasswordForm />
    </AuthShell>
  )
}
