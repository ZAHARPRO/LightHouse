export const RANK_TIERS = [
  { name: "Bronze",   tier: 1, min: 100,  color: "#cd7f32", emoji: "🥉" },
  { name: "Bronze",   tier: 2, min: 300,  color: "#cd7f32", emoji: "🥉" },
  { name: "Bronze",   tier: 3, min: 500,  color: "#cd7f32", emoji: "🥉" },
  { name: "Silver",   tier: 1, min: 700,  color: "#c0c0c0", emoji: "🥈" },
  { name: "Silver",   tier: 2, min: 900,  color: "#c0c0c0", emoji: "🥈" },
  { name: "Silver",   tier: 3, min: 1100, color: "#c0c0c0", emoji: "🥈" },
  { name: "Gold",     tier: 1, min: 1300, color: "#ffd700", emoji: "🥇" },
  { name: "Gold",     tier: 2, min: 1600, color: "#ffd700", emoji: "🥇" },
  { name: "Gold",     tier: 3, min: 1900, color: "#ffd700", emoji: "🥇" },
  { name: "Platinum", tier: 1, min: 2200, color: "#e2e8f0", emoji: "💠" },
  { name: "Platinum", tier: 2, min: 2600, color: "#e2e8f0", emoji: "💠" },
  { name: "Platinum", tier: 3, min: 3000, color: "#e2e8f0", emoji: "💠" },
  { name: "Diamond",  tier: 1, min: 3400, color: "#67e8f9", emoji: "💎" },
  { name: "Diamond",  tier: 2, min: 3700, color: "#67e8f9", emoji: "💎" },
] as const;

export type RankInfo = {
  name: string;
  tier: number;
  label: string;
  color: string;
  emoji: string;
};

export function getRank(elo: number): RankInfo | null {
  if (elo < 100) return null;
  if (elo >= 4000) {
    // Diamond keeps climbing: D3 at 4000, D4 at 4500, D5 at 5000 …
    const tier = 3 + Math.floor((elo - 4000) / 500);
    return { name: "Diamond", tier, label: `Diamond ${toRoman(tier)}`, color: "#67e8f9", emoji: "💎" };
  }
  let result: typeof RANK_TIERS[number] = RANK_TIERS[0];
  for (const r of RANK_TIERS) {
    if (elo >= r.min) result = r;
  }
  return { name: result.name, tier: result.tier, label: `${result.name} ${toRoman(result.tier)}`, color: result.color, emoji: result.emoji };
}

function toRoman(n: number): string {
  const map: [number, string][] = [[4,"IV"],[1,"I"]]; // limited to small tiers
  const full: [number,string][] = [[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]];
  return full.reduce((s,[v,r])=>{while(n>=v){s+=r;n-=v;}return s;},"");
}

/** Returns ELO deltas [winnerDelta, loserDelta] (both positive — caller applies signs) */
export function calculateEloDelta(winnerElo: number, loserElo: number): [number, number] {
  const BASE = 50;
  const diff = Math.abs(winnerElo - loserElo);
  const extraDiff = Math.max(0, diff - 600);
  const modifier = Math.floor(extraDiff / 100) * 5;

  const higherIsWinner = winnerElo >= loserElo;
  let winnerDelta: number;
  let loserDelta: number;

  if (higherIsWinner) {
    // Expected outcome → winner gets less, loser loses less
    winnerDelta = Math.max(10, BASE - modifier);
    loserDelta  = winnerDelta;
  } else {
    // Upset → underdog wins more, favourite loses more
    winnerDelta = Math.min(90, BASE + modifier);
    loserDelta  = winnerDelta;
  }

  return [winnerDelta, loserDelta];
}
