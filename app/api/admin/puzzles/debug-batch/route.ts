import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { fetchLichessPuzzleBatch } from "@/lib/lichess-puzzle";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.LICHESS_API_KEY;
  const { puzzles, error } = await fetchLichessPuzzleBatch(5, apiKey);

  return NextResponse.json({
    fetched: puzzles.length,
    error,
    ids: puzzles.map(p => p.lichessId),
    ratings: puzzles.map(p => p.rating),
  });
}
