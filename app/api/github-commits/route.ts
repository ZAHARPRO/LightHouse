import { NextResponse } from "next/server";

const REPO = "ZAHARPRO/LightHouse";
const API  = `https://api.github.com/repos/${REPO}/commits?per_page=15`;

export const revalidate = 300;

export async function GET() {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    return NextResponse.json({ needsToken: true }, { status: 401 });
  }

  try {
    const res = await fetch(API, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        Authorization: `Bearer ${token}`,
      },
      next: { revalidate: 300 },
    });

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({ needsToken: true }, { status: 401 });
    }

    if (!res.ok) {
      const body = await res.text();
      console.error(`[github-commits] GitHub ${res.status}:`, body);
      return NextResponse.json({ error: `GitHub returned ${res.status}` }, { status: 502 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any[] = await res.json();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const commits = raw.map((c: any) => {
      const [title, ...rest] = (c.commit.message as string).trim().split("\n");
      const description = rest.join("\n").trim().replace(/\n{2,}/g, "\n\n") || null;
      return {
        sha:         (c.sha as string),
        title:       title.trim(),
        description,
        author:      (c.commit.author?.name ?? "unknown") as string,
        date:        (c.commit.author?.date ?? new Date().toISOString()) as string,
        url:         (c.html_url ?? `https://github.com/${REPO}/commit/${c.sha}`) as string,
      };
    });

    return NextResponse.json(commits);
  } catch (err) {
    console.error("[github-commits]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
