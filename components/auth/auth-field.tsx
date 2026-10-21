const fieldClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-indigo-500"

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const MIN_PASSWORD_LENGTH = 8

export function AuthField({
  id,
  label,
  error,
  ...inputProps
}: {
  id: string
  label: string
  error?: string
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "id">) {
  const errorId = `${id}-error`
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-card-foreground">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`${fieldClass} ${error ? "border-red-400 focus:ring-red-300" : ""}`}
        {...inputProps}
      />
      {error && (
        <p id={errorId} className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}

export const submitButtonClass =
  "w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-indigo-600"
