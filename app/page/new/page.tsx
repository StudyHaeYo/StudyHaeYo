import { redirect } from "next/navigation"

// Pages are now created as data from /new; keep this path working for old links.
export default async function LegacyNewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = await searchParams
  const subject = typeof query.subject === "string" ? query.subject : ""
  redirect(subject ? `/new?subject=${subject}` : "/new")
}
