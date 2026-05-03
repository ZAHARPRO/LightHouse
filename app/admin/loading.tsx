export default function AdminLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[var(--border-subtle)] border-t-violet-400 rounded-full animate-spin" />
        <p className="text-[var(--text-muted)] text-sm font-display">Loading…</p>
      </div>
    </div>
  );
}
