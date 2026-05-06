import { NextResponse } from "next/server";

// For battleship, the WAITING→PLACEMENT transition happens automatically when
// a guest joins (/join route). PLACEMENT→PLAYING happens when both players
// submit their ship placements (/place route). This endpoint is not needed.
export async function POST() {
  return NextResponse.json({ error: "Not applicable for battleship" }, { status: 400 });
}
