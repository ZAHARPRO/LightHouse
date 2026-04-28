import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Users, Award, ShieldCheck, Flag, Newspaper, ArrowLeft, Puzzle } from "lucide-react";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") redirect("/feed");

  const links = [
    { href: "/admin",        icon: LayoutDashboard, label: "Dashboard" },
    { href: "/admin/users",  icon: Users,           label: "Users"     },
    { href: "/admin/badges",  icon: Award,        label: "Badges"  },
    { href: "/admin/news",    icon: Newspaper,    label: "News"    },
    { href: "/admin/reports", icon: Flag,         label: "Reports" },
    { href: "/admin/staff",   icon: ShieldCheck,  label: "Staff"   },
    { href: "/admin/puzzles", icon: Puzzle,        label: "Puzzles" },
  ];

  return (
    <div className="min-h-[calc(100vh-64px)] flex">
      {/* Sidebar */}
      <aside className="w-[220px] shrink-0 border-r border-[var(--border-subtle)] bg-[var(--bg-card)] flex flex-col py-6 px-3 gap-1">
        <p className="text-[0.65rem] font-display font-bold text-[var(--text-muted)] tracking-[0.1em] uppercase px-3 mb-3">
          Admin Panel
        </p>
        {links.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg no-underline text-[var(--text-secondary)] text-sm font-display font-medium hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors duration-150"
          >
            <Icon size={15} className="shrink-0" />
            {label}
          </Link>
        ))}

        <div className="mt-auto">
          <Link
            href="/feed"
            className="flex items-center gap-2 px-3 py-2 rounded-lg no-underline text-[var(--text-muted)] text-sm font-display font-medium hover:text-[var(--text-secondary)] transition-colors"
          >
            <ArrowLeft size={14} /> Back to site
          </Link>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
