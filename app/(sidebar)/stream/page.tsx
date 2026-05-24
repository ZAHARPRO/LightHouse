import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Monitor } from "lucide-react";
import StreamBroadcaster from "@/components/StreamBroadcaster";
import StreamViewer from "@/components/StreamViewer";

export default async function StreamPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin");

  const isAdmin = session.user.role === "ADMIN";

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-[10px] bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
          <Monitor size={17} className="text-[var(--accent-orange)]" />
        </div>
        <div>
          <h1 className="font-display font-extrabold text-[1.25rem] tracking-[-0.02em] text-[var(--text-primary)] leading-none">
            {isAdmin ? "Admin Stream" : "Live Stream"}
          </h1>
          <p className="text-[0.8125rem] text-[var(--text-muted)] mt-0.5">
            {isAdmin ? "Share your screen with all users" : "Watch the admin live stream"}
          </p>
        </div>
      </div>

      {/* Stream component */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[14px] p-5">
        {isAdmin ? <StreamBroadcaster /> : <StreamViewer />}
      </div>

      {/* Info box */}
      <div className="mt-4 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[10px] px-4 py-3">
        <p className="text-[0.8125rem] text-[var(--text-muted)]">
          {isAdmin
            ? "Click \"Start Stream\" to share your screen. The stream is visible to all logged-in users at /stream."
            : "This page shows the admin live screen share when active. Refresh if you just missed the start."}
        </p>
      </div>
    </div>
  );
}
