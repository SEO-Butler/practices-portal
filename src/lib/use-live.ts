"use client";

import { useEffect, useRef } from "react";

/**
 * Subscribes to the practice's SSE change stream and calls `onEvent`
 * whenever something changes (clients refetch their own data). A slow
 * interval remains as a fallback for environments where SSE can't connect;
 * EventSource itself auto-reconnects on drops.
 */
export function useLiveRefresh(
  practiceId: string | null | undefined,
  onEvent: () => void,
  fallbackMs = 60_000,
): void {
  const callback = useRef(onEvent);
  useEffect(() => {
    callback.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!practiceId) return;
    const source = new EventSource(
      `/api/events/${encodeURIComponent(practiceId)}`,
    );
    source.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as { type: string };
        if (data.type !== "connected") callback.current();
      } catch {
        // ignore malformed frames
      }
    };
    const fallback = setInterval(() => callback.current(), fallbackMs);
    return () => {
      source.close();
      clearInterval(fallback);
    };
  }, [practiceId, fallbackMs]);
}
