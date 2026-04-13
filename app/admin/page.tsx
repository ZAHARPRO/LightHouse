import { getAdminStats } from "@/actions/admin";
import { Users, Video, FileText, Headphones, Award } from "lucide-react";
import Link from "next/link";

export default async function AdminDashboard() {
  const stats = await getAdminStats();

  const cards = [
    { icon: Users,      label: "Total Users",    value: stats.users,       href: "/admin/users",  color: "#6366f1" },
    { icon: Video,      label: "Videos",         value: stats.videos,      href: "/feed",         color: "#f97316" },
    { icon: FileText,   label: "Posts",          value: stats.posts,       href: "/feed",         color: "#10b981" },
    { icon: Headphones, label: "Open Tickets",   value: stats.openTickets, href: "/feed",         color: "#fbbf24" },
    { icon: Award,      label: "Badges Awarded", value: stats.rewards,     href: "/admin/badges", color: "#ec4899" },
  ];

  return (
    <div>
      <h1 className="font-display font-extrabold text-2xl tracking-tight text-[var(--text-primary)] mb-1">Dashboard</h1>
      <p className="text-[var(--text-muted)] text-sm mb-8">Platform overview</p>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-10">
        {cards.map(({ icon: Icon, label, value, href, color }) => (
          <Link
            key={label}
            href={href}
            className="no-underline bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-5 flex flex-col gap-3 hover:border-[var(--border-default)] transition-colors duration-150"
          >
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
              <Icon size={17} style={{ color }} />
            </div>
            <div>
              <p className="font-display font-extrabold text-2xl text-[var(--text-primary)] leading-none mb-0.5">
                {value.toLocaleString()}
              </p>
              <p className="text-[0.75rem] text-[var(--text-muted)]">{label}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/admin/users" className="no-underline bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-6 hover:border-orange-500/30 transition-colors group">
          <h2 className="font-display font-bold text-base text-[var(--text-primary)] mb-1 group-hover:text-[var(--accent-orange)] transition-colors">User Management</h2>
          <p className="text-sm text-[var(--text-muted)]">View all users, change roles & tiers, delete accounts.</p>
        </Link>
        <Link href="/admin/badges" className="no-underline bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-6 hover:border-orange-500/30 transition-colors group">
          <h2 className="font-display font-bold text-base text-[var(--text-primary)] mb-1 group-hover:text-[var(--accent-orange)] transition-colors">Badge Creator</h2>
          <p className="text-sm text-[var(--text-muted)]">Create custom badges and manually award them to users.</p>
        </Link>
      </div>
    </div>
  );
}
