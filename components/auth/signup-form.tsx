"use client"

import { useState } from "react"
import { signUp } from "@/lib/auth"
import { AuthField, EMAIL_PATTERN, MIN_PASSWORD_LENGTH, submitButtonClass } from "./auth-field"

type Values = { name: string; email: string; password: string; confirm: string }
type Errors = Partial<Record<keyof Values, string>>

function validate({ name, email, password, confirm }: Values) {
  const errors: Errors = {}
  if (!name.trim()) errors.name = "이름(닉네임)을 입력해 주세요."
  if (!email.trim()) errors.email = "이메일을 입력해 주세요."
  else if (!EMAIL_PATTERN.test(email.trim())) errors.email = "이메일 형식이 올바르지 않아요."
  if (!password) errors.password = "비밀번호를 입력해 주세요."
  else if (password.length < MIN_PASSWORD_LENGTH)
    errors.password = `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 해요.`
  if (!confirm) errors.confirm = "비밀번호를 한 번 더 입력해 주세요."
  else if (confirm !== password) errors.confirm = "비밀번호가 일치하지 않아요."
  return errors
}

export function SignupForm() {
  const [values, setValues] = useState<Values>({ name: "", email: "", password: "", confirm: "" })
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const errors = submitted ? validate(values) : {}
  const update = (key: keyof Values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({ ...prev, [key]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (pending) return
    setSubmitted(true)
    setFormError(null)
    if (Object.keys(validate(values)).length > 0) return

    setPending(true)
    const result = await signUp(values.name.trim(), values.email.trim(), values.password)
    if (result.ok) {
      if (result.needsEmailVerification) {
        setSentTo(values.email.trim())
        setPending(false)
        return
      }
      // A full page load, not a client navigation: the router may still hold the redirect to /login it got before
      // signing in, which left people on the login page until they pressed F5.
      window.location.replace("/")
      return
    }
    setFormError(result.message)
    setPending(false)
  }

  if (sentTo) {
    return (
      <div role="status" className="flex flex-col gap-2 rounded-lg bg-indigo-50 px-4 py-4 text-sm leading-relaxed text-indigo-800">
        <p className="font-medium">인증 메일을 보냈어요</p>
        <p>
          <span className="font-medium">{sentTo}</span>로 보낸 메일의 인증 링크를 누르면 가입이 끝나요. 메일이 안 보이면
          스팸함도 확인해 주세요.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <AuthField
        id="signup-name"
        label="이름(닉네임)"
        autoComplete="nickname"
        placeholder="예: 재윤"
        value={values.name}
        onChange={update("name")}
        error={errors.name}
        disabled={pending}
      />
      <AuthField
        id="signup-email"
        label="이메일"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={values.email}
        onChange={update("email")}
        error={errors.email}
        disabled={pending}
      />
      <AuthField
        id="signup-password"
        label="비밀번호"
        type="password"
        autoComplete="new-password"
        placeholder={`${MIN_PASSWORD_LENGTH}자 이상`}
        value={values.password}
        onChange={update("password")}
        error={errors.password}
        disabled={pending}
      />
      <AuthField
        id="signup-confirm"
        label="비밀번호 확인"
        type="password"
        autoComplete="new-password"
        placeholder="비밀번호를 한 번 더 입력"
        value={values.confirm}
        onChange={update("confirm")}
        error={errors.confirm}
        disabled={pending}
      />
      {formError && (
        <p role="alert" className="text-sm text-red-600">
          {formError}
        </p>
      )}
      <button type="submit" disabled={pending} className={`mt-2 ${submitButtonClass}`}>
        {pending ? "가입 중..." : "회원가입"}
      </button>
    </form>
  )
}
