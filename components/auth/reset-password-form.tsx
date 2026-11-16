"use client"

import { useState } from "react"
import { updatePassword } from "@/lib/auth"
import { AuthField, MIN_PASSWORD_LENGTH, submitButtonClass } from "./auth-field"

type Values = { password: string; confirm: string }

function validate({ password, confirm }: Values) {
  const errors: Partial<Values> = {}
  if (!password) errors.password = "새 비밀번호를 입력해 주세요."
  else if (password.length < MIN_PASSWORD_LENGTH) errors.password = `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 해요.`
  if (!confirm) errors.confirm = "새 비밀번호를 한 번 더 입력해 주세요."
  else if (confirm !== password) errors.confirm = "비밀번호가 일치하지 않아요."
  return errors
}

export function ResetPasswordForm() {
  const [values, setValues] = useState<Values>({ password: "", confirm: "" })
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

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
    const result = await updatePassword(values.password)
    if (result.ok) {
      // Already signed in by the reset link: straight to Home, a full load like after signing in.
      window.location.replace("/")
      return
    }
    setFormError(result.message)
    setPending(false)
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <AuthField
        id="reset-password"
        label="새 비밀번호"
        type="password"
        autoComplete="new-password"
        placeholder={`${MIN_PASSWORD_LENGTH}자 이상`}
        value={values.password}
        onChange={update("password")}
        error={errors.password}
        disabled={pending}
      />
      <AuthField
        id="reset-confirm"
        label="새 비밀번호 확인"
        type="password"
        autoComplete="new-password"
        placeholder="한 번 더 입력"
        value={values.confirm}
        onChange={update("confirm")}
        error={errors.confirm}
        disabled={pending}
      />
      {formError && (
        <p role="alert" className="text-sm text-danger-600">
          {formError}
        </p>
      )}
      <button type="submit" disabled={pending} className={`mt-2 ${submitButtonClass}`}>
        {pending ? "저장 중…" : "비밀번호 바꾸기"}
      </button>
    </form>
  )
}
