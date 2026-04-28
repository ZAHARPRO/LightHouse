import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "./auth.config";

// Per-Lambda-instance cache for custom avatar (base64) users.
// Avoids a DB query on every request; TTL = 60 s.
// Invalidated immediately when the user calls session.update().
const avatarCache = new Map<string, { image: string | null; expiresAt: number }>();

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  callbacks: {
    ...authConfig.callbacks,

    // jwt runs on sign-in and on explicit session.update() calls.
    // Strategy for token.image:
    //   URL string → cached in token, zero DB queries per request
    //   ""          → sentinel meaning "no image", zero DB queries
    //   undefined   → user has a base64 custom avatar, session callback queries DB
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id   = user.id;
        token.role = (user as { role?: string }).role ?? "USER";
        delete token.picture;
        const img = (user as { image?: string | null }).image ?? null;
        if (img && !img.startsWith("data:")) {
          token.image = img;   // OAuth URL — cache it
        } else if (!img) {
          token.image = "";    // no image — sentinel
        }
        // base64: leave token.image undefined → per-request DB fallback
      } else {
        delete token.picture;
      }

      // After avatar upload/removal, the client calls session.update().
      // Re-read the image from DB and update the cached value.
      if (trigger === "update") {
        const userId = token.id as string;
        avatarCache.delete(userId); // invalidate stale cache entry
        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { image: true },
        });
        const img = dbUser?.image ?? null;
        if (img && !img.startsWith("data:")) {
          token.image = img;
        } else if (!img) {
          token.image = "";
        } else {
          // base64 — clear token so session callback uses the (now-fresh) cache
          delete (token as Record<string, unknown>).image;
          avatarCache.set(userId, { image: img, expiresAt: Date.now() + 60_000 });
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user.id   = token.id   as string;
        session.user.role = token.role as string;
        if (typeof token.image === "string") {
          // "" → no image; any other string → URL
          session.user.image = token.image || null;
        } else {
          // token.image is undefined → user has a base64 custom avatar
          // Check the per-instance cache before hitting the DB
          const userId = token.id as string;
          const cached = avatarCache.get(userId);
          if (cached && cached.expiresAt > Date.now()) {
            session.user.image = cached.image;
          } else {
            const dbUser = await prisma.user.findUnique({
              where: { id: userId },
              select: { image: true },
            });
            session.user.image = dbUser?.image ?? null;
            avatarCache.set(userId, { image: session.user.image, expiresAt: Date.now() + 60_000 });
          }
        }
      }
      return session;
    },
  },
  providers: [
    ...authConfig.providers,
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.password) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isValid) return null;

        return user;
      },
    }),
  ],
});
