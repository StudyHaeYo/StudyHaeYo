import { describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { deleteAccountData } from "@/lib/account-delete"

// A stand-in for the service_role client: records what was called, in order.
function fakeAdmin(opts: { files?: number; failAt?: "list" | "remove" | "plans" | "account" } = {}) {
  const calls: string[] = []
  let files = Array.from({ length: opts.files ?? 0 }, (_, i) => `file-${i}.pdf`)
  const client = {
    storage: {
      from: (bucket: string) => ({
        list: async (folder: string, { limit }: { limit: number }) => {
          calls.push(`list ${bucket}/${folder}`)
          if (opts.failAt === "list") return { data: null, error: { message: "x" } }
          return { data: files.slice(0, limit).map((name) => ({ name })), error: null }
        },
        remove: async (paths: string[]) => {
          calls.push(`remove ${paths.length}`)
          if (opts.failAt === "remove") return { data: null, error: { message: "x" } }
          files = files.filter((f) => !paths.includes(`u1/${f}`))
          return { data: [], error: null }
        },
      }),
    },
    from: (table: string) => ({
      delete: () => ({
        eq: async (column: string, value: string) => {
          calls.push(`delete ${table} ${column}=${value}`)
          return { error: opts.failAt === "plans" ? { message: "x" } : null }
        },
      }),
    }),
    auth: {
      admin: {
        deleteUser: async (id: string) => {
          calls.push(`deleteUser ${id}`)
          return { data: null, error: opts.failAt === "account" ? { message: "x" } : null }
        },
      },
    },
  }
  return { admin: client as unknown as SupabaseClient, calls }
}

describe("탈퇴: deleteAccountData (D-49)", () => {
  it("지우는 순서: 첨부 파일 → 학습 계획 → 계정", async () => {
    const { admin, calls } = fakeAdmin({ files: 2 })
    expect(await deleteAccountData(admin, "u1")).toEqual({ ok: true })
    expect(calls).toEqual([
      "list attachments/u1",
      "remove 2",
      "list attachments/u1",
      "delete learning_plans user_id=u1",
      "deleteUser u1",
    ])
  })

  it("첨부 파일이 1000개를 넘으면 여러 번 나눠 지운다", async () => {
    const { admin, calls } = fakeAdmin({ files: 2500 })
    expect(await deleteAccountData(admin, "u1")).toEqual({ ok: true })
    expect(calls.filter((c) => c.startsWith("remove"))).toEqual(["remove 1000", "remove 1000", "remove 500"])
  })

  it("첨부 파일이 없으면 바로 계획과 계정을 지운다", async () => {
    const { admin, calls } = fakeAdmin()
    expect(await deleteAccountData(admin, "u1")).toEqual({ ok: true })
    expect(calls).toEqual(["list attachments/u1", "delete learning_plans user_id=u1", "deleteUser u1"])
  })

  it("한 단계가 실패하면 거기서 멈추고 어느 단계인지 알려 준다(계정은 남는다)", async () => {
    for (const [failAt, step] of [
      ["list", "attachments"],
      ["remove", "attachments"],
      ["plans", "plans"],
      ["account", "account"],
    ] as const) {
      const { admin, calls } = fakeAdmin({ files: 1, failAt })
      expect(await deleteAccountData(admin, "u1")).toEqual({ ok: false, step })
      if (step !== "account") expect(calls.some((c) => c.startsWith("deleteUser"))).toBe(false)
    }
  })
})
