import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;
  return session;
}

export async function GET() {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [total, lichessCount, manualCount, solveCount, puzzles] = await Promise.all([
    prisma.chessPuzzle.count(),
    prisma.chessPuzzle.count({ where: { source: "lichess" } }),
    prisma.chessPuzzle.count({ where: { source: "manual" } }),
    prisma.userPuzzleSolve.count(),
    prisma.chessPuzzle.findMany({
      select: { themes: true, difficulty: true, rating: true, solveCount: true },
    }),
  ]);

  // Theme breakdown
  const themeCounts: Record<string, number> = {};
  for (const p of puzzles) {
    for (const t of p.themes) {
      themeCounts[t] = (themeCounts[t] ?? 0) + 1;
    }
  }
  const topThemes = Object.entries(themeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([theme, count]) => ({ theme, count }));

  // Difficulty breakdown
  const diffCounts: Record<string, number> = {};
  for (const p of puzzles) {
    diffCounts[p.difficulty] = (diffCounts[p.difficulty] ?? 0) + 1;
  }

  // Rating distribution (buckets of 200)
  const ratingBuckets: Record<string, number> = {};
  for (const p of puzzles) {
    const bucket = `${Math.floor(p.rating / 200) * 200}`;
    ratingBuckets[bucket] = (ratingBuckets[bucket] ?? 0) + 1;
  }

  const avgRating = puzzles.length
    ? Math.round(puzzles.reduce((s, p) => s + p.rating, 0) / puzzles.length)
    : 0;

  const totalSolveCount = puzzles.reduce((s, p) => s + p.solveCount, 0);

  return NextResponse.json({
    total, lichessCount, manualCount, solveCount,
    avgRating, totalSolveCount,
    topThemes, diffCounts, ratingBuckets,
  });
}
