"use server";

import { cookies } from "next/headers";

export async function setTheme(theme: string) {
  if (theme !== "dark" && theme !== "pink") return;
  const store = await cookies();
  store.set("THEME", theme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
