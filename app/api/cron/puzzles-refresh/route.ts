import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  fetchLichessDailyPuzzle,
  fetchLichessPuzzleBatch,
  difficultyFromThemes,
} from "@/lib/lichess-puzzle";
import type { LichessPuzzleRow } from "@/lib/lichess-puzzle";

export const runtime = "nodejs";
export const maxDuration = 60;

async function upsertPuzzle(puzzle: LichessPuzzleRow) {
  const title = puzzle.themes[0]
    ? puzzle.themes[0].replace(/([A-Z])/g, " $1").trim()
    : "Daily Puzzle";

  await prisma.chessPuzzle.upsert({
    where: { lichessId: puzzle.lichessId },
    update: {
      fen:        puzzle.fen,
      solution:   JSON.stringify(puzzle.solution),
      rating:     puzzle.rating,
      themes:     puzzle.themes,
      difficulty: difficultyFromThemes(puzzle.themes),
    },
    create: {
      lichessId:  puzzle.lichessId,
      title:      `${title} #${puzzle.lichessId}`,
      fen:        puzzle.fen,
      solution:   JSON.stringify(puzzle.solution),
      rating:     puzzle.rating,
      themes:     puzzle.themes,
      difficulty: difficultyFromThemes(puzzle.themes),
      source:     "lichess",
    },
  });
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cfg = await prisma.puzzleCronConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, count: 1, intervalDays: 7 },
  });

  const force = new URL(req.url).searchParams.get("force") === "1";

  if (!force && cfg.lastRunAt) {
    const msSinceLast = Date.now() - cfg.lastRunAt.getTime();
    const msInterval  = cfg.intervalDays * 24 * 60 * 60 * 1000;
    if (msSinceLast < msInterval) {
      const nextRunIn = Math.ceil((msInterval - msSinceLast) / (1000 * 60 * 60));
      return NextResponse.json({
        ok: false,
        skipped: true,
        reason: `Next run in ~${nextRunIn}h (interval: every ${cfg.intervalDays} day${cfg.intervalDays !== 1 ? "s" : ""})`,
      });
    }
  }

  const lichessApiKey = process.env.LICHESS_API_KEY ?? "";
  const added: string[] = [];
  const errors: string[] = [];

  let usedMode = "daily";

  if (lichessApiKey && cfg.count > 1) {
    // ── Batch mode (requires LICHESS_API_KEY + puzzle rating on that account) ─
    const { puzzles, error } = await fetchLichessPuzzleBatch(cfg.count, lichessApiKey);

    if (puzzles.length > 0) {
      usedMode = "batch";
      for (const puzzle of puzzles) {
        try {
          await upsertPuzzle(puzzle);
          if (!added.includes(puzzle.lichessId)) added.push(puzzle.lichessId);
        } catch (e) {
          errors.push(e instanceof Error ? e.message : String(e));
        }
      }
    } else {
      // Batch failed — record why, then fall back to daily puzzle
      if (error) {
        const hint = error.includes("404")
          ? `${error}. Tip: the Lichess account linked to your API token must have played puzzles on lichess.org to have a puzzle rating (required for batch API).`
          : error;
        errors.push(`Batch failed: ${hint}`);
      }
      usedMode = "daily (batch fallback)";
      const puzzle = await fetchLichessDailyPuzzle();
      if (!puzzle) {
        errors.push("Daily puzzle fallback also failed");
      } else {
        try {
          await upsertPuzzle(puzzle);
          added.push(puzzle.lichessId);
        } catch (e) {
          errors.push(e instanceof Error ? e.message : String(e));
        }
      }
    }
  } else {
    // ── Single daily puzzle (no API key needed) ───────────────────────────────
    const puzzle = await fetchLichessDailyPuzzle();
    if (!puzzle) {
      errors.push("Could not fetch daily puzzle from Lichess");
    } else {
      try {
        await upsertPuzzle(puzzle);
        added.push(puzzle.lichessId);
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
  }

  await prisma.puzzleCronConfig.update({
    where: { id: 1 },
    data: { lastRunAt: new Date() },
  });

  return NextResponse.json({
    ok: errors.length === 0 || added.length > 0,
    added: added.length,
    puzzleIds: added,
    errors,
    mode: usedMode,
  });
}
