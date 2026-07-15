"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";

type State =
  | "loading"
  | "unsupported" // browser can't push, or server has no VAPID keys
  | "denied"
  | "off"
  | "on"
  | "working";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** "Notify me on this device" toggle backed by the Push API. */
export function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [serverKey, setServerKey] = useState<string | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      // Defer: the lint rule forbids synchronous setState in effect bodies.
      Promise.resolve().then(() => setState("unsupported"));
      return;
    }
    api<{ key: string | null }>("/api/push/key")
      .then(async (res) => {
        if (!res.key) {
          setState("unsupported");
          return;
        }
        setServerKey(res.key);
        if (Notification.permission === "denied") {
          setState("denied");
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setState(sub ? "on" : "off");
      })
      .catch(() => setState("unsupported"));
  }, []);

  async function enable() {
    if (!serverKey) return;
    setState("working");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(serverKey) as BufferSource,
      });
      await api("/api/push/subscribe", {
        method: "POST",
        json: { subscription: JSON.parse(JSON.stringify(sub)) },
      });
      setState("on");
    } catch {
      setState(Notification.permission === "denied" ? "denied" : "off");
    }
  }

  async function disable() {
    setState("working");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api("/api/push/subscribe", {
          method: "DELETE",
          json: { endpoint: sub.endpoint },
        });
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setState("on");
    }
  }

  if (state === "loading" || state === "unsupported") return null;
  if (state === "denied") {
    return (
      <p className="text-xs text-slate-400">
        Notifications are blocked for this site in your browser settings.
      </p>
    );
  }

  return (
    <button
      onClick={state === "on" ? disable : enable}
      disabled={state === "working"}
      className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
        state === "on"
          ? "border border-slate-300 text-slate-600 hover:bg-slate-100"
          : "bg-teal-600 text-white hover:bg-teal-700"
      }`}
    >
      {state === "working"
        ? "Working…"
        : state === "on"
          ? "🔕 Disable device notifications"
          : "🔔 Notify me on this device"}
    </button>
  );
}
