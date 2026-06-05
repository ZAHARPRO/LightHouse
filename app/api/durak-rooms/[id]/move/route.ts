import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { applyMove, processBotTurns, type MoveInput } from "@/lib/durak-engine";
import { broadcast } from "@/lib/durak-sse";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as MoveInput;
  if (!body?.action) return NextResponse.json({ error: "No action" }, { status: 400 });

  const result = await applyMove(id, session.user.id, body);
  if (!result.ok) return NextResponse.json({ error: result.error ?? "Illegal move" }, { status: 400 });

  // Broadcast the human's move immediately, then bots act in background
  broadcast(id, { type: "update" });
  void processBotTurns(id);
  return NextResponse.json({ ok: true });
}
