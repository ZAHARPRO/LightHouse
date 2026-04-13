import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Staff is considered "online" if they were active in the last 5 minutes
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

export async function GET() {
  const since = new Date(Date.now() - ONLINE_THRESHOLD_MS);

  const count = await prisma.user.count({
    where: {
      role: { in: ["ADMIN", "OPERATOR", "STAFF"] },
      lastActiveAt: { gte: since },
    },
  });

  return NextResponse.json({ online: count > 0, count });
}
