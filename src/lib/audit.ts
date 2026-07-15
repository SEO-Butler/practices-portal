import { prisma } from "@/lib/db";

// Append-only audit trail. There are deliberately no update/delete helpers
// and the table has no foreign keys — entries outlive actors and subjects.

export interface AuditEntry {
  actorId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  /** Dotted verb, e.g. "chart.view", "appointment.check_in", "auth.login_failed". */
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  patientId?: string | null;
  practiceId?: string | null;
  details?: Record<string, unknown>;
  request?: Request;
}

export function requestMeta(request: Request | undefined): {
  ip: string | null;
  userAgent: string | null;
} {
  if (!request) return { ip: null, userAgent: null };
  const forwarded = request.headers.get("x-forwarded-for");
  return {
    ip: forwarded ? forwarded.split(",")[0].trim() : null,
    userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
  };
}

/** Writes one audit record. Never throws — auditing must not break the action. */
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    const { ip, userAgent } = requestMeta(entry.request);
    await prisma.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        actorEmail: entry.actorEmail ?? null,
        actorRole: entry.actorRole ?? null,
        action: entry.action,
        resourceType: entry.resourceType ?? null,
        resourceId: entry.resourceId ?? null,
        patientId: entry.patientId ?? null,
        practiceId: entry.practiceId ?? null,
        details: (entry.details ?? undefined) as never,
        ip,
        userAgent,
      },
    });
  } catch (err) {
    console.error("[audit] failed to record", entry.action, err);
  }
}
