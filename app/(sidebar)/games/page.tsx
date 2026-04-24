import Link from "next/link";
import { Bomb, Wifi } from "lucide-react";

const GAMES = [
  {
    href: "/games/minesweeper",
    title: "Сапёр",
    description: "Открывай клетки и не задень мину",
    icon: Bomb,
    color: "text-orange-400",
    bg: "bg-orange-500/10 border-orange-500/20",
  },
  {
    href: "/games/minesweeper/online",
    title: "Сапёр Online",
    description: "1 vs 1 против другого игрока",
    icon: Wifi,
    color: "text-green-400",
    bg: "bg-green-500/10 border-green-500/20",
  },
];

export default function GamesPage() {
  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-3xl font-display font-extrabold text-[var(--text-primary)] mb-2">
        Mini Games
      </h1>
      <p className="text-[var(--text-muted)] mb-10">Выбери игру</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {GAMES.map(({ href, title, description, icon: Icon, color, bg }) => (
          <Link
            key={href}
            href={href}
            className={[
              "flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border no-underline",
              "transition-all duration-150 hover:scale-[1.03] hover:shadow-lg",
              bg,
            ].join(" ")}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-black/20 ${color}`}>
              <Icon size={26} />
            </div>
            <div className="text-center">
              <p className="font-display font-bold text-[var(--text-primary)] text-sm">{title}</p>
              <p className="text-[0.72rem] text-[var(--text-muted)] mt-0.5 leading-tight">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
