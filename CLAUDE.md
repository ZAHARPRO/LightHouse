@AGENTS.md

# Project Rules

## Styling
- **Always use Tailwind CSS.** No CSS modules, no `style={{}}` inline objects except for values that cannot be expressed in Tailwind (e.g. dynamic `transform: translateX(${n}px)`).
- Use CSS custom properties for theme colors: `text-[var(--text-primary)]`, `bg-[var(--bg-elevated)]`, `border-[var(--border-subtle)]`, etc. Never hardcode hex colors that belong to the theme.
- Dark theme is the default. All new UI must look correct on dark backgrounds.
- Consistent spacing: prefer Tailwind scale (`gap-2`, `px-4`, `py-2`) over arbitrary values.

## Data fetching & mutations
- **Mutations go in Server Actions** (`"use server"` files under `actions/`). Do not use API routes for plain data mutations.
- API routes (`app/api/`) are reserved for: SSE streams, webhooks, OAuth callbacks, and endpoints that must be called from outside the app.
- In client components use `useTransition` + a server action for optimistic / loading state — not a manual `fetch` to an API route.
- Never call `prisma` directly from a client component or a page that isn't a Server Component.

## Internationalisation
- **Every user-visible string must use next-intl.** No hardcoded English text in JSX.
- Add translation keys to **all three** files: `messages/en.json`, `messages/uk.json`, `messages/meme.json`.
- Server components: `const t = await getTranslations("namespace")`.
- Client components: `const t = useTranslations("namespace")`.
- Group keys by feature namespace (e.g. `"chess"`, `"admin"`, `"puzzles"`). Do not dump everything under `"common"`.

## Admin panel
- Every new feature that manages data (games, content, users) **must have a corresponding admin page** under `app/admin/`.
- All admin server actions must call `requireAdmin()` before touching the database.
- Admin pages are server components; fetch data directly with Prisma (no client-side fetching on admin pages).
- New admin pages must appear in the admin sidebar nav.

## Games
- Each game lives under `app/(sidebar)/games/{game}/` with sub-routes: main page, `/online/` lobby, `/online/[roomId]/` active room.
- Every game must be **connected to the admin panel**: at minimum a room-management entry under `/admin/rooms`, ideally a dedicated admin page for that game's stats and configuration.
- Game rooms use Prisma models for persistence and SSE (`lib/lobby-sse.ts`) for real-time updates.
- ELO / rating updates happen server-side in a server action or API route handler — never in client code.

## Authentication
- Server components / server actions: `const session = await auth()` from `@/auth`.
- Client components: `const { data: session } = useSession()` from `next-auth/react`.
- Protected server actions must check `session?.user?.id` and return an error response if missing.

## Database
- Always import the singleton: `import { prisma } from "@/lib/prisma"`. Never `new PrismaClient()`.
- Add new models to `prisma/schema.prisma` and run `prisma migrate dev`.
- Prefer `select` to fetch only needed fields; avoid loading entire rows when only one column is needed.

## Components
- Reusable / shared components → `components/` at the repo root.
- Page-specific components → co-locate inside the feature folder under `app/`.
- Client components must have `"use client"` as the first line.
- Keep server components as the default; only add `"use client"` when the component needs browser APIs or interactivity.

## Real-time
- Lobby presence and game sync → SSE via `lib/lobby-sse.ts` (`sseBroadcast` / `sseStream`).
- Live video/audio streams → LiveKit SDK.
- Do not use WebSockets directly; route everything through the established SSE or LiveKit patterns.

## TypeScript
- No `any` unless wrapping a third-party API that has no types. Use `unknown` + a type guard instead.
- Shared types that cross multiple files go in `lib/` or `types/`. Do not re-declare the same interface in multiple places.
