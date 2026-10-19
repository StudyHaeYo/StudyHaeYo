"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "@/lib/auth"
import { AuthField, EMAIL_PATTERN, MIN_PASSWORD_LENGTH, submitButtonClass } from "./auth-field"

function validate(email: string, password: string) {
  const errors: { email?: string; password?: string } = {}
  if (!email.trim()) errors.email = "이메일을 입력해 주세요."
  else if (!EMAIL_PATTERN.test(email.trim())) errors.email = "이메일 형식이 올바르지 않아요."
  if (!password) errors.password = "비밀번호를 입력해 주세요."
  else if (password.length < MIN_PASSWORD_LENGTH)
    errors.password = `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 해요.`
  return errors
}

export function LoginForm() {
  const router = useRouter()
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
      router.push("/")
      return
    }
    setFormError(result.message)
    setPending(false)
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
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
        placeholder={`${MIN_PASSWORD_LENGTH}자 이상`}
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
