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
- **Every new game must include a badge set** in `lib/badges.ts` and `lib/awardBadge.ts`. Minimum required badges: `{GAME}_WIN` (beat the bot), `{GAME}_ONLINE_WIN` (win online), `{GAME}_SILVER/GOLD/PLATINUM/DIAMOND` (ELO milestones at 700/1300/2200/3400). Add the corresponding `RewardType` enum values to `prisma/schema.prisma`. Call `awardGameBadge("{GAME}_WIN")` from the bot game page on player victory, and `awardBadge()` from the engine/API on online wins and ELO thresholds.

## Rated matchmaking
- **Never copy-paste matchmaking logic.** Use the shared hook and component:
  - `lib/useMatchmakingQueue.ts` — manages searching state, elapsed timer, mute countdown, localStorage persistence, and auto-restart after ejection (`?returning=1`).
  - `components/MatchmakingCard.tsx` — renders idle settings card + searching animation + cancel button.
- Every rated queue page (`/online/rated/page.tsx`) must follow this pattern:
  ```tsx
  const queue = useMatchmakingQueue({
    gameKey: "chess",           // unique per game — used for localStorage key
    muteStatusApi: null,        // set to "/api/{game}-rooms/mute-status" if the game has a mute system
    returning: searchParams.get("returning") === "1",
    startSearch: async () => { /* returns roomId to poll, or null if navigated immediately */ },
    cancelSearch: async (roomId) => { /* DELETE the room or matchmake endpoint */ },
    checkMatch: async (roomId) => { /* return route string when matched, null to keep polling */ },
    onNavigate: (route) => router.push(route),
  });

  return <MatchmakingCard {...queue} accentColor="pink" searchingLabel="⏱ 10 min">{/* settings */}</MatchmakingCard>;
  ```
- `accentColor` must be one of: `"yellow"` `"orange"` `"pink"` `"blue"` `"green"`. Do not add new Tailwind color variants — extend the `ACCENT` map in `MatchmakingCard.tsx` if needed.
- Settings buttons inside `<MatchmakingCard>` must be `disabled={queue.searching}` so the user cannot change settings mid-search.
- For **matchmake-endpoint games** (chess, checkers, battleship, billiards, minesweeper):
  - `startSearch` POSTs to `/api/{game}-rooms/matchmake`, redirects immediately if `matched: true`, otherwise returns `roomId`.
  - `checkMatch` GETs `/api/{game}-rooms/{roomId}` and returns the route when `room.guestId` is set.
  - `cancelSearch` DELETEs `/api/{game}-rooms/matchmake`.
- For **Durak** (multi-player lobby system):
  - `startSearch` GETs the rooms list, joins a matching room (and navigates) or creates a new one and returns its `id`.
  - `checkMatch` GETs `/api/durak-rooms/{roomId}` and returns the route when `status !== "WAITING" || confirmingAt !== null`.
  - `cancelSearch` DELETEs `/api/durak-rooms/{roomId}`.
- **Rated confirmation modal** (Durak-style, for games where all players must confirm before starting):
  - When the room fills → server sets `confirmingAt` on the room (still WAITING).
  - Room page shows a confirmation modal (20s countdown, Accept/Decline) instead of the normal lobby.
  - Decline → player gets `durakQueueMutedUntil` + 20s mute, slot is deleted; accepting player is redirected back to rated queue with `?returning=1`.
  - The hook's `muteStatusApi` + mute check prevents muted players from immediately rejoining.
  - "Start Game" host button must be hidden for rated rooms: `{isHost && !room.rated && <button>Start</button>}`.
- Common i18n strings for matchmaking UI live in the `"matchmaking"` namespace (`messages/en.json` etc.): `findMatch`, `searching`, `cancel`, `liveGames`, `winToGain`, `mutedFor`, `myHistory`.

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
