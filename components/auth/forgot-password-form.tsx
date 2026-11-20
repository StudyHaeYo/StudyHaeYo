"use client"

import { useState } from "react"
import { requestPasswordReset, useRememberedEmail } from "@/lib/auth"
import { AuthField, EMAIL_PATTERN, submitButtonClass } from "./auth-field"

function validate(email: string) {
  if (!email.trim()) return "이메일을 입력해 주세요."
  if (!EMAIL_PATTERN.test(email.trim())) return "이메일 형식이 올바르지 않습니다."
  return undefined
}

export function ForgotPasswordForm({ notice }: { notice?: string }) {
  const remembered = useRememberedEmail()
  const [typedEmail, setEmail] = useState<string | null>(null)
  const email = typedEmail ?? remembered ?? ""
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const error = submitted ? validate(email) : undefined

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (pending) return
    setSubmitted(true)
    setFormError(null)
    if (validate(email)) return

    setPending(true)
    const result = await requestPasswordReset(email.trim())
    setPending(false)
    if (result.ok) setSentTo(email.trim())
    else setFormError(result.message)
  }

  if (sentTo) {
    return (
      <div role="status" className="flex flex-col gap-2 rounded-lg bg-action-50 px-4 py-4 text-sm leading-relaxed text-action-800">
        <p className="font-medium">메일을 확인해 주세요</p>
        <p>
          <span className="font-medium">{sentTo}</span>이 가입된 이메일이면 비밀번호를 바꾸는 링크를 보냈습니다. 메일이 안
          보이면 스팸함도 확인해 주세요. 링크는 이 브라우저에서 열어 주세요.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {notice && !formError && (
        <p role="status" className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
          {notice}
        </p>
      )}
      <AuthField
        id="forgot-email"
        label="가입한 이메일"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={error}
        disabled={pending}
      />
      {formError && (
        <p role="alert" className="text-sm text-danger-600">
          {formError}
        </p>
      )}
      <button type="submit" disabled={pending} className={`mt-2 ${submitButtonClass}`}>
        {pending ? "보내는 중…" : "재설정 메일 보내기"}
      </button>
    </form>
  )
}
