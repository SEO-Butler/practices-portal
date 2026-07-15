// In-process pub/sub for practice-scoped change events, feeding the SSE
// stream at /api/events/[practiceId]. Events carry no data beyond a type —
// clients refetch through their normal (auth-guarded) APIs, so the public
// stream can never leak PII. Single-instance by design (one Next server);
// swap for Postgres LISTEN/NOTIFY or Redis pub/sub when scaling out.

export interface PracticeEvent {
  type: "appointments" | "vitals" | "cases";
  at: string;
}

type Listener = (event: PracticeEvent) => void;

// Survives dev hot-reload the same way the prisma singleton does.
const globalBus = globalThis as unknown as {
  ppEventBus?: Map<string, Set<Listener>>;
};

function bus(): Map<string, Set<Listener>> {
  return (globalBus.ppEventBus ??= new Map());
}

export function publishPracticeEvent(
  practiceId: string,
  type: PracticeEvent["type"],
): void {
  const listeners = bus().get(practiceId);
  if (!listeners) return;
  const event: PracticeEvent = { type, at: new Date().toISOString() };
  for (const listener of [...listeners]) {
    try {
      listener(event);
    } catch {
      // A broken subscriber must never affect the publisher.
    }
  }
}

export function subscribePractice(
  practiceId: string,
  listener: Listener,
): () => void {
  let listeners = bus().get(practiceId);
  if (!listeners) {
    listeners = new Set();
    bus().set(practiceId, listeners);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) bus().delete(practiceId);
  };
}
