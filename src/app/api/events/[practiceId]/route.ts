import { subscribePractice } from "@/lib/events";

export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

/**
 * Server-Sent Events stream of change pings for one practice. Public by
 * design: events contain only a type and timestamp — subscribers refetch
 * their data through the normal auth-guarded APIs.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ practiceId: string }> },
) {
  const { practiceId } = await context.params;

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (payload: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          closed = true;
        }
      };

      send(`data: ${JSON.stringify({ type: "connected" })}\n\n`);
      const unsubscribe = subscribePractice(practiceId, (event) =>
        send(`data: ${JSON.stringify(event)}\n\n`),
      );
      // Comment heartbeat keeps proxies from idling the connection out.
      const heartbeat = setInterval(() => send(`: hb\n\n`), 25_000);

      request.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
