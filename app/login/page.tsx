import type { Metadata } from "next"
import Link from "next/link"
import { AuthShell } from "@/components/auth/auth-shell"
import { LoginForm } from "@/components/auth/login-form"

export const metadata: Metadata = {
  title: "로그인 · 스터디 해요",
}

export default function LoginPage() {
  return (
    <AuthShell
      title="로그인"
      description="이메일과 비밀번호로 로그인하세요."
      footer={
        <>
          계정이 없나요?{" "}
          <Link href="/signup" className="font-medium text-indigo-600 hover:text-indigo-700 hover:underline">
            회원가입
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  )
}
