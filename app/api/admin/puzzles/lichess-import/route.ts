import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseLichessCsv, difficultyFromThemes } from "@/lib/lichess-puzzle";

export const runtime = "nodejs";
export const maxDuration = 60;

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;
  return session;
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    csv: string;
    maxCount?: number;
    minRating?: number;
    maxRating?: number;
    themes?: string[];
  };

  if (!body.csv?.trim())
    return NextResponse.json({ error: "No CSV data provided" }, { status: 400 });

  const rows = parseLichessCsv(body.csv, {
    maxCount:  body.maxCount  ?? 500,
    minRating: body.minRating,
    maxRating: body.maxRating,
    themes:    body.themes?.length ? body.themes : undefined,
  });

  if (rows.length === 0)
    return NextResponse.json({ error: "No valid puzzles found in CSV" }, { status: 400 });

  let imported = 0;
  let skipped  = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      const title = row.themes[0]
        ? row.themes[0].replace(/([A-Z])/g, " $1").trim()
        : "Lichess Puzzle";

      await prisma.chessPuzzle.upsert({
        where: { lichessId: row.lichessId },
        update: {
          fen:        row.fen,
          solution:   JSON.stringify(row.solution),
          rating:     row.rating,
          themes:     row.themes,
          difficulty: difficultyFromThemes(row.themes),
        },
        create: {
          lichessId:  row.lichessId,
          title:      `${title} #${row.lichessId}`,
          fen:        row.fen,
          solution:   JSON.stringify(row.solution),
          rating:     row.rating,
          themes:     row.themes,
          difficulty: difficultyFromThemes(row.themes),
          source:     "lichess",
        },
      });
      imported++;
    } catch (e) {
      skipped++;
      if (errors.length < 5) errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  return NextResponse.json({ imported, skipped, errors, total: rows.length });
}
