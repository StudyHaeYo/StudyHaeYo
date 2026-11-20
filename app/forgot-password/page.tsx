import type { Metadata } from "next"
import Link from "next/link"
import { AuthShell } from "@/components/auth/auth-shell"
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"

export const metadata: Metadata = {
  title: "비밀번호 찾기 · 스터디 해요",
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = await searchParams
  const notice =
    query.error === "link" ? "링크가 만료됐거나 다른 브라우저에서 열렸습니다. 메일을 다시 받아 주세요." : undefined

  return (
    <AuthShell
      title="비밀번호 찾기"
      description="가입한 이메일로 비밀번호 변경 링크 전송"
      footer={
        <Link href="/login" className="font-medium text-action-600 hover:text-action-700 hover:underline">
          로그인으로 돌아가기
        </Link>
      }
    >
      <ForgotPasswordForm notice={notice} />
    </AuthShell>
  )
}
