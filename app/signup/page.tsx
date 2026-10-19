import type { Metadata } from "next"
import Link from "next/link"
import { AuthShell } from "@/components/auth/auth-shell"
import { SignupForm } from "@/components/auth/signup-form"

export const metadata: Metadata = {
  title: "회원가입 · 스터디 해요",
}

export default function SignupPage() {
  return (
    <AuthShell
      title="회원가입"
      description="학습 기록을 시작하려면 계정을 만들어 주세요."
      footer={
        <>
          이미 계정이 있나요?{" "}
          <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-700 hover:underline">
            로그인
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  )
}
