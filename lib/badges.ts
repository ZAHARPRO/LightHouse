export type BadgeDef = {
  icon: string;
  label: string;
  color: string;
  points: number;
  description: string;
  how: string;
  category: "community" | "activity" | "special" | "games";
};

export const BADGE_DEFS: Record<string, BadgeDef> = {
  EARLY_ADOPTER: {
    icon: "🚀", label: "Early Adopter", color: "#10b981", points: 200,
    description: "One of the first members of LightHouse",
    how: "Awarded by admins to early members",
    category: "special",
  },
  FIRST_COMMENT: {
    icon: "💬", label: "First Comment", color: "#6366f1", points: 10,
    description: "Left your very first comment",
    how: "Leave a comment on any video or post",
    category: "community",
  },
  WATCH_STREAK: {
    icon: "🔥", label: "Watch Streak", color: "#f97316", points: 50,
    description: "Maintained a consistent watch streak",
    how: "Watch videos 7 days in a row",
    category: "activity",
  },
  SUPER_FAN: {
    icon: "⭐", label: "Super Fan", color: "#fbbf24", points: 100,
    description: "A dedicated fan of a creator",
    how: "Subscribe and engage regularly with a creator",
    category: "community",
  },
  PREMIUM_MEMBER: {
    icon: "👑", label: "Premium Member", color: "#fbbf24", points: 150,
    description: "Upgraded to a premium tier",
    how: "Subscribe to Basic, Pro, or Elite plan",
    category: "special",
  },
  CHESS_WIN: {
    icon: "♟️", label: "Chess Victor", color: "#818cf8", points: 50,
    description: "Won a game of chess against the bot",
    how: "Beat the bot in Chess (any difficulty)",
    category: "games",
  },
  CHESS_ONLINE_WIN: {
    icon: "🏆", label: "Online Champion", color: "#a78bfa", points: 100,
    description: "Won an online 1v1 chess match",
    how: "Win a real-time online chess game",
    category: "games",
  },
  MINESWEEPER_WIN: {
    icon: "💣", label: "Bomb Defuser", color: "#34d399", points: 30,
    description: "Cleared a minesweeper board",
    how: "Win any minesweeper game",
    category: "games",
  },
  MINESWEEPER_EXPERT: {
    icon: "🧨", label: "Mine Expert", color: "#f87171", points: 75,
    description: "Cleared the hard minesweeper board (30×16, 99 mines)",
    how: "Win minesweeper on Hard difficulty",
    category: "games",
  },
  MINESWEEPER_ONLINE_WIN: {
    icon: "🎯", label: "Online Sweeper", color: "#22d3ee", points: 60,
    description: "Won an online minesweeper match",
    how: "Win a 1v1 online minesweeper game",
    category: "games",
  },
};
