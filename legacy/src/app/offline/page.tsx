export default function OfflinePage() {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">You're offline</h1>
        <p className="mt-2 max-w-xs text-sm text-muted">
          Zandegi needs a connection for this page. Reconnect and try again.
        </p>
      </div>
    </div>
  );
}
