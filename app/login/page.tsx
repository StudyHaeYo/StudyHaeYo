import type { Metadata } from "next"
import Link from "next/link"
import { AuthShell } from "@/components/auth/auth-shell"
import { LoginForm } from "@/components/auth/login-form"

export const metadata: Metadata = {
  title: "로그인 · 스터디 해요",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = await searchParams
  const next = typeof query.next === "string" ? query.next : undefined
  const notice =
    query.verified === "1"
      ? "이메일 인증이 끝났어요. 로그인해 주세요."
      : query.error === "verification"
        ? "인증 링크가 만료됐거나 올바르지 않아요. 다시 가입하거나 받은 메일을 확인해 주세요."
        : undefined

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
      <LoginForm next={next} notice={notice} noticeTone={query.verified === "1" ? "success" : "error"} />
    </AuthShell>
  )
}
