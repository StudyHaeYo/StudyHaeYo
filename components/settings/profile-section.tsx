"use client"

import { useEffect, useId, useRef, useState, type FormEvent } from "react"
import { createPortal } from "react-dom"
import { LogOut, UserX } from "lucide-react"
import { toast } from "sonner"
import { deleteAccount, signOut, updateDisplayName, updatePassword, useCurrentUser } from "@/lib/auth"
import { MIN_PASSWORD_LENGTH } from "@/components/auth/auth-field"
import { surface } from "@/components/page-shell"
import { button, dialogBackdrop, dialogPanel } from "@/components/ui-styles"
import { useFocusTrap } from "@/hooks/use-focus-trap"

const NAME_MAX = 30
const fieldClass =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-action-500 disabled:opacity-60"

// 계정 설정(2026-11-19): 이름 · 비밀번호 바꾸기, 로그아웃, 탈퇴(D-49). 첫 렌더에서는 이름 · 이메일 자리표시(hydration 안전).
export function ProfileSection() {
  return (
    <>
      <NameAndEmail />
      <PasswordChange />
    </>
  )
}

function SectionHead({ id, title }: { id: string; title: string }) {
  return (
    <div className="border-b border-border px-5 py-3">
      <h2 id={id} className="text-sm font-semibold text-card-foreground">
        {title}
      </h2>
    </div>
  )
}

function NameAndEmail() {
  const user = useCurrentUser()
  const [name, setName] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The field starts with the current name once it is known (after mount).
  useEffect(() => {
    if (user) setName(user.name)
  }, [user])

  const changed = user !== null && name.trim() !== user.name
  const save = async (e: FormEvent) => {
    e.preventDefault()
    const next = name.trim()
    if (!next) {
      setError("이름을 적어 주세요.")
      return
    }
    if (!changed || pending) return
    setPending(true)
    setError(null)
    const result = await updateDisplayName(next)
    setPending(false)
    if (result.ok) toast.success("이름을 바꿨어요.")
    else setError(result.message)
  }

  return (
    <section aria-labelledby="settings-profile" className={surface}>
      <SectionHead id="settings-profile" title="프로필" />
      <form onSubmit={save} noValidate className="flex flex-col gap-3 px-5 py-4 text-sm">
        <label htmlFor="settings-name" className="text-muted-foreground">
          이름
        </label>
        <div className="flex gap-2">
          <input
            id="settings-name"
            name="name"
            autoComplete="name"
            maxLength={NAME_MAX}
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError(null)
            }}
            disabled={user === null || pending}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "settings-name-error" : undefined}
            className={fieldClass}
          />
          <button type="submit" disabled={pending} className={button("secondary")}>
            {pending ? "저장 중…" : "이름 저장"}
          </button>
        </div>
        {error && (
          <p id="settings-name-error" role="alert" className="text-xs text-danger-700">
            {error}
          </p>
        )}
        <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
          <span className="text-muted-foreground">이메일</span>
          <span className="min-w-0 truncate font-medium text-card-foreground">
            {user?.email ?? <span aria-hidden="true" className="inline-block h-3.5 w-28 rounded bg-muted align-middle" />}
          </span>
        </div>
      </form>
    </section>
  )
}

function PasswordChange() {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<{ field: "password" | "confirm" | "form"; text: string } | null>(null)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (pending) return
    if (!password) {
      setError({ field: "password", text: "새 비밀번호를 입력해 주세요." })
      return
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError({ field: "password", text: `새 비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 해요.` })
      return
    }
    if (confirm !== password) {
      setError({ field: "confirm", text: "새 비밀번호가 서로 달라요. 한 번 더 같게 입력해 주세요." })
      return
    }
    setPending(true)
    setError(null)
    const result = await updatePassword(password)
    setPending(false)
    if (result.ok) {
      setPassword("")
      setConfirm("")
      toast.success("비밀번호를 바꿨어요.")
    } else setError({ field: "form", text: result.message })
  }

  return (
    <section aria-labelledby="settings-password" className={surface}>
      <SectionHead id="settings-password" title="비밀번호 바꾸기" />
      <form onSubmit={save} noValidate className="grid gap-3 px-5 py-4 text-sm sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-muted-foreground">
          새 비밀번호
          <input
            type="password"
            name="new-password"
            autoComplete="new-password"
            placeholder={`${MIN_PASSWORD_LENGTH}자 이상`}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setError(null)
            }}
            disabled={pending}
            aria-invalid={error?.field === "password" ? true : undefined}
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-muted-foreground">
          새 비밀번호 확인
          <input
            type="password"
            name="confirm-password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value)
              setError(null)
            }}
            disabled={pending}
            aria-invalid={error?.field === "confirm" ? true : undefined}
            className={fieldClass}
          />
        </label>
        {error && (
          <p role="alert" className="text-xs text-danger-700 sm:col-span-2">
            {error.text}
          </p>
        )}
        <div className="sm:col-span-2">
          <button type="submit" disabled={pending} className={button("secondary")}>
            {pending ? "바꾸는 중…" : "비밀번호 바꾸기"}
          </button>
        </div>
      </form>
    </section>
  )
}

// Last on the page: leaving the account comes after everything about it. `deletable` is false until the server has
// its service_role key (app/settings/page.tsx), so 탈퇴 is not shown when it could not work.
export function AccountSection({ deletable }: { deletable: boolean }) {
  const [pending, setPending] = useState(false)
  const logout = async () => {
    setPending(true)
    const result = await signOut()
    if (!result.ok) {
      setPending(false)
      toast.error("로그아웃하지 못했어요", { description: result.message })
      return
    }
    // Full page load so nothing of this account stays in memory or in the router cache (same as the sidebar).
    window.location.replace("/login")
  }
  return (
    <section aria-labelledby="settings-account" className={surface}>
      <SectionHead id="settings-account" title="계정" />
      <div className="flex items-center justify-between gap-4 px-5 py-4 text-sm">
        <span className="text-muted-foreground">이 기기에서 로그아웃해요. 저장 중인 내용은 먼저 저장돼요.</span>
        <button type="button" onClick={() => void logout()} disabled={pending} className={button("secondary")}>
          <LogOut aria-hidden="true" />
          {pending ? "로그아웃 중…" : "로그아웃"}
        </button>
      </div>
      {deletable && <DeleteAccount />}
    </section>
  )
}

function DeleteAccount() {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const close = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }
  return (
    <div className="flex items-center justify-between gap-4 border-t border-border px-5 py-4 text-sm">
      <span className="text-muted-foreground">탈퇴하면 이 계정의 노트와 학습 기록이 모두 지워져요.</span>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)} className={button("danger")}>
        <UserX aria-hidden="true" />
        탈퇴하기
      </button>
      {open && <DeleteAccountDialog onClose={close} />}
    </div>
  )
}

// Asks for the password again: deleting can't be undone, and a borrowed or left-open browser shouldn't be enough.
function DeleteAccountDialog({ onClose }: { onClose: () => void }) {
  const id = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [password, setPassword] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useFocusTrap(dialogRef, true)

  useEffect(() => {
    inputRef.current?.focus()
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose()
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [onClose, pending])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (pending) return
    if (!password) {
      setError("비밀번호를 입력해 주세요.")
      inputRef.current?.focus()
      return
    }
    setPending(true)
    setError(null)
    const result = await deleteAccount(password)
    if (result.ok) {
      // Full page load: nothing of the deleted account stays in memory or in the router cache.
      window.location.replace("/login?deleted=1")
      return
    }
    setPending(false)
    setError(result.message)
    inputRef.current?.focus()
  }

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-scrim/30 p-4 ${dialogBackdrop}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-desc`}
        className={`${dialogPanel} w-full max-w-sm p-6`}
      >
        <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <UserX className="size-5" aria-hidden="true" />
        </div>
        <h2 id={`${id}-title`} className="mt-4 text-base font-semibold text-foreground">
          탈퇴할까요?
        </h2>
        <p id={`${id}-desc`} className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          노트, 학습 기록, 학습 계획, 할 일, D-day, 첨부 파일이 모두 지워지고 되돌릴 수 없어요.
        </p>
        <form onSubmit={submit} noValidate className="mt-4 flex flex-col gap-1.5 text-sm">
          <label htmlFor={`${id}-password`} className="text-muted-foreground">
            확인을 위해 비밀번호를 입력해 주세요
          </label>
          <input
            ref={inputRef}
            id={`${id}-password`}
            type="password"
            name="current-password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setError(null)
            }}
            disabled={pending}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            className={fieldClass}
          />
          {error && (
            <p id={`${id}-error`} role="alert" className="text-xs text-danger-700">
              {error}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={pending} className={button("secondary")}>
              취소
            </button>
            <button type="submit" disabled={pending} className={button("danger")}>
              {pending ? "지우는 중…" : "탈퇴하기"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
