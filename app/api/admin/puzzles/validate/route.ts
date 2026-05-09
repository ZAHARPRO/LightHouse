import { NextRequest, NextResponse } from "next/server";
import { validatePuzzle } from "@/lib/puzzle-validator";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const result = await validatePuzzle(
      body.fen,
      body.difficulty
    );

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { valid: false, error: "Server error" },
      { status: 500 }
    );
  }
}