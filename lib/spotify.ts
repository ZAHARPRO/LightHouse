import { prisma } from "./prisma";

const TOKEN_URL = "https://accounts.spotify.com/api/token";

export async function getSpotifyToken(userId: string): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "spotify" },
    select: { access_token: true, refresh_token: true, expires_at: true },
  });

  if (!account) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  if (account.expires_at && account.expires_at > nowSec + 60) {
    return account.access_token ?? null;
  }

  if (!account.refresh_token) return null;

  const creds = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${creds}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: account.refresh_token,
    }),
  });

  if (!res.ok) return null;

  const data = await res.json() as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  };

  await prisma.account.updateMany({
    where: { userId, provider: "spotify" },
    data: {
      access_token: data.access_token,
      expires_at: nowSec + data.expires_in,
      ...(data.refresh_token ? { refresh_token: data.refresh_token } : {}),
    },
  });

  return data.access_token;
}
