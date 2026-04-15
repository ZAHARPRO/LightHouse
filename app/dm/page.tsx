import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getDMConversations } from "@/actions/dm";
import Link from "next/link";
import { MessageCircle, ArrowLeft } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";

function timeAgo(d: Date) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function DMListPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const convs = await getDMConversations();

  return (
    <div className="max-w-[640px] mx-auto px-6 py-10">
      <Link
        href="/profile"
        className="inline-flex items-center gap-1.5 no-underline text-[var(--text-muted)] text-[0.8125rem] mb-6 py-[0.3rem] px-[0.625rem] rounded-[7px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
      >
        <ArrowLeft size={13} /> Back to Profile
      </Link>

      <div className="flex items-center gap-2 mb-6">
        <MessageCircle size={18} className="text-[var(--accent-orange)]" />
        <h1 className="font-display font-extrabold text-2xl tracking-tight text-[var(--text-primary)]">
          Messages
        </h1>
      </div>

      {convs.length === 0 ? (
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-12 text-center">
          <MessageCircle size={32} className="mx-auto mb-3 text-[var(--text-muted)] opacity-40" />
          <p className="text-[var(--text-secondary)] text-sm">No conversations yet.</p>
          <p className="text-[var(--text-muted)] text-xs mt-1">
            Visit someone&apos;s profile and click &quot;Message&quot; to start a chat.
          </p>
        </div>
      ) : (
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden">
          {convs.map((conv, i) => {
            return (
              <Link
                key={conv.id}
                href={`/dm/${conv.id}`}
                className={[
                  "flex items-center gap-4 px-5 py-4 no-underline",
                  "hover:bg-[var(--bg-elevated)] transition-colors duration-100",
                  i < convs.length - 1 ? "border-b border-[var(--border-subtle)]" : "",
                ].join(" ")}
              >
                {/* Avatar */}
                <UserAvatar name={conv.other.name ?? "?"} image={conv.other.image} tier={conv.other.tier} size="md" />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-display font-semibold text-[0.9rem] text-[var(--text-primary)] mb-0.5">
                    {conv.other.name ?? "Unknown"}
                  </p>
                  {conv.lastMessage && (
                    <p className="text-[0.8rem] text-[var(--text-muted)] truncate">
                      {conv.lastIsMe ? "You: " : ""}{conv.lastMessage.content}
                    </p>
                  )}
                </div>

                {/* Time */}
                {conv.lastMessage && (
                  <span className="text-[0.7rem] text-[var(--text-muted)] shrink-0">
                    {timeAgo(conv.lastMessage.createdAt)}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
