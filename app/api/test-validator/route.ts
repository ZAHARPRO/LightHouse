import { NextResponse } from "next/server";
import { validatePuzzle } from "@/lib/puzzle-validator";

export const runtime = "nodejs";

export async function GET() {
  const result = await validatePuzzle(
    "7k/6Q1/6K1/8/8/8/8/8 w - - 0 1",
    "mate1"
  );

  return NextResponse.json(result);
}