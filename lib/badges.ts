export type BadgeDef = {
  icon: string;
  label: string;
  color: string;
  points: number;
  description: string;
  how: string;
  howToEarn: string;
  category: "community" | "activity" | "special" | "games";
  rare?: boolean;
};

export const BADGE_DEFS: Record<string, BadgeDef> = {
  EARLY_ADOPTER: {
    icon: "🚀", label: "Early Adopter", color: "#10b981", points: 200,
    description: "One of the first members of LightHouse",
    how: "Awarded by admins to early members",
    howToEarn: "This badge was awarded to users who signed up during the closed beta period.",
    category: "special", rare: true,
  },
  FIRST_COMMENT: {
    icon: "💬", label: "First Comment", color: "#6366f1", points: 10,
    description: "Left your very first comment",
    how: "Leave a comment on any video or post",
    howToEarn: "Jump into the conversation — post your first comment on any video.",
    category: "community",
  },
  WATCH_STREAK: {
    icon: "🔥", label: "Watch Streak", color: "#f97316", points: 50,
    description: "Maintained a consistent watch streak",
    how: "Watch videos 7 days in a row",
    howToEarn: "Stay consistent — watch at least one video every day for 7 consecutive days.",
    category: "activity",
  },
  SUPER_FAN: {
    icon: "⭐", label: "Super Fan", color: "#fbbf24", points: 100,
    description: "A dedicated fan of a creator",
    how: "Subscribe and engage regularly with a creator",
    howToEarn: "Show your appreciation — like 50+ videos across LightHouse.",
    category: "community",
  },
  PREMIUM_MEMBER: {
    icon: "👑", label: "Premium Member", color: "#fbbf24", points: 150,
    description: "Upgraded to a premium tier",
    how: "Subscribe to Basic, Pro, or Elite plan",
    howToEarn: "Unlock premium content by subscribing to any paid plan on LightHouse.",
    category: "special",
  },
  CHESS_WIN: {
    icon: "♟️", label: "Chess Victor", color: "#818cf8", points: 50,
    description: "Won a game of chess against the bot",
    how: "Beat the bot in Chess (any difficulty)",
    howToEarn: "Beat the AI opponent in Chess — any difficulty counts.",
    category: "games",
  },
  CHESS_ONLINE_WIN: {
    icon: "🏆", label: "Online Champion", color: "#a78bfa", points: 100,
    description: "Won an online 1v1 chess match",
    how: "Win a real-time online chess game",
    howToEarn: "Win a real-time 1v1 online chess match against another player.",
    category: "games",
  },
  MINESWEEPER_WIN: {
    icon: "💣", label: "Bomb Defuser", color: "#34d399", points: 30,
    description: "Cleared a minesweeper board",
    how: "Win any minesweeper game",
    howToEarn: "Clear any minesweeper board without hitting a mine.",
    category: "games",
  },
  MINESWEEPER_EXPERT: {
    icon: "🧨", label: "Mine Expert", color: "#f87171", points: 75,
    description: "Cleared the hard minesweeper board (30×16, 99 mines)",
    how: "Win minesweeper on Hard difficulty",
    howToEarn: "Clear the Hard difficulty board (30×16, 99 mines).",
    category: "games",
  },
  MINESWEEPER_ONLINE_WIN: {
    icon: "🎯", label: "Online Sweeper", color: "#22d3ee", points: 60,
    description: "Won an online minesweeper match",
    how: "Win a 1v1 online minesweeper game",
    howToEarn: "Win a 1v1 online minesweeper match against another player.",
    category: "games",
  },

  // Chess ELO rank badges
  CHESS_SILVER: {
    icon: "🥈", label: "Chess Silver", color: "#c0c0c0", points: 75,
    description: "Reached Silver rank in rated chess (700+ ELO)",
    how: "Reach 700 ELO in rated chess",
    howToEarn: "Climb to Silver rank by reaching 700 ELO in rated online chess.",
    category: "games",
  },
  CHESS_GOLD: {
    icon: "🥇", label: "Chess Gold", color: "#ffd700", points: 150,
    description: "Reached Gold rank in rated chess (1300+ ELO)",
    how: "Reach 1300 ELO in rated chess",
    howToEarn: "Prove your skill — reach 1300 ELO in rated online chess.",
    category: "games", rare: true,
  },
  CHESS_PLATINUM: {
    icon: "💠", label: "Chess Platinum", color: "#e2e8f0", points: 300,
    description: "Reached Platinum rank in rated chess (2200+ ELO)",
    how: "Reach 2200 ELO in rated chess",
    howToEarn: "Elite territory — reach 2200 ELO in rated online chess.",
    category: "games", rare: true,
  },
  CHESS_DIAMOND: {
    icon: "💎", label: "Chess Diamond", color: "#67e8f9", points: 500,
    description: "Reached Diamond rank in rated chess (3400+ ELO)",
    how: "Reach 3400 ELO in rated chess",
    howToEarn: "The pinnacle — reach Diamond rank (3400 ELO) in rated online chess.",
    category: "games", rare: true,
  },

  // Minesweeper ELO rank badges
  MINE_SILVER: {
    icon: "🥈", label: "Sweeper Silver", color: "#c0c0c0", points: 75,
    description: "Reached Silver rank in rated minesweeper (700+ ELO)",
    how: "Reach 700 ELO in rated minesweeper",
    howToEarn: "Climb to Silver rank by reaching 700 ELO in rated online minesweeper.",
    category: "games",
  },
  MINE_GOLD: {
    icon: "🥇", label: "Sweeper Gold", color: "#ffd700", points: 150,
    description: "Reached Gold rank in rated minesweeper (1300+ ELO)",
    how: "Reach 1300 ELO in rated minesweeper",
    howToEarn: "Prove your skill — reach 1300 ELO in rated online minesweeper.",
    category: "games", rare: true,
  },
  MINE_PLATINUM: {
    icon: "💠", label: "Sweeper Platinum", color: "#e2e8f0", points: 300,
    description: "Reached Platinum rank in rated minesweeper (2200+ ELO)",
    how: "Reach 2200 ELO in rated minesweeper",
    howToEarn: "Elite territory — reach 2200 ELO in rated online minesweeper.",
    category: "games", rare: true,
  },
  MINE_DIAMOND: {
    icon: "💎", label: "Sweeper Diamond", color: "#67e8f9", points: 500,
    description: "Reached Diamond rank in rated minesweeper (3400+ ELO)",
    how: "Reach 3400 ELO in rated minesweeper",
    howToEarn: "The pinnacle — reach Diamond rank (3400 ELO) in rated online minesweeper.",
    category: "games", rare: true,
  },
};
