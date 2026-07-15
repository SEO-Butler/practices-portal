export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="text-center">
        <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-teal-600 text-3xl text-white">
          +
        </span>
        <h1 className="text-2xl font-semibold">You&apos;re offline</h1>
        <p className="mt-2 max-w-sm text-slate-600">
          Practices Portal needs a connection for live bookings, queues and
          vitals. Reconnect and try again.
        </p>
      </div>
    </div>
  );
}
