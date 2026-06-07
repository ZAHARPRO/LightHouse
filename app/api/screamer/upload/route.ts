import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  if (file.size > MAX_SIZE) return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp4";
  if (!["mp4", "webm", "mp3", "ogg"].includes(ext)) {
    return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
  }

  const filename = `${randomBytes(12).toString("hex")}.${ext}`;
  const filePath = path.join(process.cwd(), "public", "uploads", "screamers", filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  return NextResponse.json({ url: `/uploads/screamers/${filename}` });
}
