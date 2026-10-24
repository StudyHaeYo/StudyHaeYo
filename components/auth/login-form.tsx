"use client"

import { useState } from "react"
import { safeNextPath, signIn } from "@/lib/auth"
import { AuthField, EMAIL_PATTERN, submitButtonClass } from "./auth-field"

function validate(email: string, password: string) {
  const errors: { email?: string; password?: string } = {}
  if (!email.trim()) errors.email = "이메일을 입력해 주세요."
  else if (!EMAIL_PATTERN.test(email.trim())) errors.email = "이메일 형식이 올바르지 않아요."
  // 가입 규칙(8자 이상)은 회원가입에서만 검사한다. 규칙이 바뀌어도 기존 사용자가 로그인할 수 있게.
  if (!password) errors.password = "비밀번호를 입력해 주세요."
  return errors
}

export function LoginForm({
  next,
  notice,
  noticeTone = "error",
}: {
  next?: string
  notice?: string
  noticeTone?: "success" | "error"
}) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const errors = submitted ? validate(email, password) : {}

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (pending) return
    setSubmitted(true)
    setFormError(null)
    if (Object.keys(validate(email, password)).length > 0) return

    setPending(true)
    const result = await signIn(email.trim(), password)
    if (result.ok) {
      // A full page load, not a client navigation: the router may still hold the redirect to /login it got before
      // signing in, which left people on the login page until they pressed F5.
      window.location.replace(safeNextPath(next))
      return
    }
    setFormError(result.message)
    setPending(false)
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {notice && !formError && (
        <p
          role="status"
          className={`rounded-lg px-3 py-2 text-sm ${
            noticeTone === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}
        >
          {notice}
        </p>
      )}
      <AuthField
        id="login-email"
        label="이메일"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
        disabled={pending}
      />
      <AuthField
        id="login-password"
        label="비밀번호"
        type="password"
        autoComplete="current-password"
        placeholder="비밀번호"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
        disabled={pending}
      />
      {formError && (
        <p role="alert" className="text-sm text-red-600">
          {formError}
        </p>
      )}
      <button type="submit" disabled={pending} className={`mt-2 ${submitButtonClass}`}>
        {pending ? "로그인 중..." : "로그인"}
      </button>
    </form>
  )
}
