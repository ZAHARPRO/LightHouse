import { getAdminStats } from "@/actions/admin";
import { Users, Video, FileText, Headphones, Award, Puzzle, Swords } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function AdminDashboard() {
  const [stats, t] = await Promise.all([getAdminStats(), getTranslations("admin")]);

  const cards = [
    { icon: Users,      label: t("totalUsers"),    value: stats.users,       href: "/admin/users",  color: "#ec4899" },
    { icon: Video,      label: t("videos"),         value: stats.videos,      href: "/feed",         color: "#ec4899" },
    { icon: FileText,   label: t("posts"),          value: stats.posts,       href: "/feed",         color: "#10b981" },
    { icon: Headphones, label: t("openTickets"),   value: stats.openTickets, href: "/feed",         color: "#c084fc" },
    { icon: Award,      label: t("badgesAwarded"), value: stats.rewards,     href: "/admin/badges", color: "#ec4899" },
  ];

  return (
    <div>
      <h1 className="font-display font-extrabold text-2xl tracking-tight text-[var(--text-primary)] mb-1">{t("dashboard")}</h1>
      <p className="text-[var(--text-muted)] text-sm mb-8">{t("overview")}</p>

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
        <Link href="/admin/users" className="no-underline bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-6 hover:border-[var(--accent-orange)]/30 transition-colors group">
          <h2 className="font-display font-bold text-base text-[var(--text-primary)] mb-1 group-hover:text-[var(--accent-orange)] transition-colors">{t("userManagement")}</h2>
          <p className="text-sm text-[var(--text-muted)]">{t("userManagementDesc")}</p>
        </Link>
        <Link href="/admin/badges" className="no-underline bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-6 hover:border-[var(--accent-orange)]/30 transition-colors group">
          <h2 className="font-display font-bold text-base text-[var(--text-primary)] mb-1 group-hover:text-[var(--accent-orange)] transition-colors">{t("badgeCreator")}</h2>
          <p className="text-sm text-[var(--text-muted)]">{t("badgeCreatorDesc")}</p>
        </Link>
        <Link href="/admin/reports" className="no-underline bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-6 hover:border-[var(--accent-orange)]/30 transition-colors group">
          <h2 className="font-display font-bold text-base text-[var(--text-primary)] mb-1 group-hover:text-[var(--accent-orange)] transition-colors">{t("reportCenter")}</h2>
          <p className="text-sm text-[var(--text-muted)]">{t("reportCenterDesc")}</p>
        </Link>
        <Link href="/admin/news" className="no-underline bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-6 hover:border-[var(--accent-orange)]/30 transition-colors group">
          <h2 className="font-display font-bold text-base text-[var(--text-primary)] mb-1 group-hover:text-[var(--accent-orange)] transition-colors">{t("newsManagement")}</h2>
          <p className="text-sm text-[var(--text-muted)]">{t("newsManagementDesc")}</p>
        </Link>
        <Link href="/admin/staff" className="no-underline bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-6 hover:border-[var(--accent-orange)]/30 transition-colors group">
          <h2 className="font-display font-bold text-base text-[var(--text-primary)] mb-1 group-hover:text-[var(--accent-orange)] transition-colors">{t("staffManagement")}</h2>
          <p className="text-sm text-[var(--text-muted)]">{t("staffManagementDesc")}</p>
        </Link>
        <Link href="/admin/puzzles" className="no-underline bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-6 hover:border-violet-500/30 transition-colors group">
          <div className="flex items-center gap-2 mb-1">
            <Puzzle size={15} className="text-violet-400" />
            <h2 className="font-display font-bold text-base text-[var(--text-primary)] group-hover:text-violet-400 transition-colors">Chess Puzzles</h2>
          </div>
          <p className="text-sm text-[var(--text-muted)]">Create and manage mate-in-1 and mate-in-2 puzzles</p>
        </Link>
        <Link href="/admin/rooms" className="no-underline bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-6 hover:border-blue-500/30 transition-colors group">
          <div className="flex items-center gap-2 mb-1">
            <Swords size={15} className="text-blue-400" />
            <h2 className="font-display font-bold text-base text-[var(--text-primary)] group-hover:text-blue-400 transition-colors">Rated Rooms</h2>
          </div>
          <p className="text-sm text-[var(--text-muted)]">Monitor active matches, force-close rooms, and revert ELO results</p>
        </Link>
      </div>
    </div>
  );
}
