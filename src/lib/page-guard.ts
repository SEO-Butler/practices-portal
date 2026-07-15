import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { homePathFor, type SessionRole } from "@/lib/auth";
import type { SessionPayload } from "@/lib/auth";

/**
 * Server-component guard: redirects to /login when signed out, or to the
 * user's own dashboard when they hit a page for another role.
 */
export async function requirePage(roles: SessionRole[]): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!roles.includes(session.role)) redirect(homePathFor(session.role));
  return session;
}
