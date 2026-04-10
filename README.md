# 🔦 LightHouse

A premium video platform built with **Next.js 14**, **Prisma**, **NextAuth v5**, and **Server Actions**.

## Features (from Scrum board)
- 📺 **Video Feed** — browse HD & 4K content with like/comment actions
- 💬 **Global Live Chat** — real-time chat room open to all users
- 👑 **Subscription Plans** — Basic / Pro / Elite tiers with Prisma-backed state
- 🏆 **Reward System** — points & badges earned through engagement
- 📧 **Contact Page** — server-action form saved to DB
- 🔐 **Auth** — credentials + Google + GitHub via NextAuth v5

## Tech Stack
| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) |
| Database ORM | Prisma 5 |
| Auth | NextAuth v5 (beta) + PrismaAdapter |
| Styling | Tailwind CSS + CSS variables |
| Server logic | Next.js Server Actions |
| DB | PostgreSQL |

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment
```bash
cp .env.example .env.local
# Fill in DATABASE_URL, AUTH_SECRET, and OAuth credentials
```

### 3. Set up the database
```bash
# Push schema to DB
npm run db:push

# (Optional) Seed with demo data
npx tsx prisma/seed.ts
```

### 4. Run dev server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

**Demo account:** `demo@lighthouse.io` / `password123`

---

## Project Structure

```
lighthouse/
├── app/
│   ├── page.tsx              ← Landing page
│   ├── feed/page.tsx         ← Video feed
│   ├── chat/page.tsx         ← Global chat
│   ├── subscriptions/page.tsx← Plans
│   ├── contact/page.tsx      ← Contact form
│   ├── profile/page.tsx      ← User profile + rewards
│   └── auth/
│       ├── signin/page.tsx
│       ├── register/page.tsx
│       └── error/page.tsx
├── actions/
│   ├── auth.ts               ← register / login
│   ├── videos.ts             ← getVideos, likeVideo, addComment
│   ├── chat.ts               ← getChatMessages, sendChatMessage
│   ├── subscriptions.ts      ← subscribeToPlan
│   └── contact.ts            ← sendContactMessage
├── components/
│   └── Navbar.tsx
├── lib/
│   └── prisma.ts             ← Prisma singleton
├── prisma/
│   ├── schema.prisma         ← Full data model
│   └── seed.ts               ← Demo data
├── auth.ts                   ← NextAuth config
└── middleware.ts             ← Route protection
```

---

## Database Models
- **User** — profile, tier, points
- **Video** — content, views, premium flag
- **Comment / Like** — engagement
- **ChatMessage** — global chat
- **Subscription** — plan + status + expiry
- **Reward** — badge types + point values
- **ContactMessage** — support inbox
- **Category** — video taxonomy

---

## OAuth Setup

### Google
1. Go to [Google Cloud Console](https://console.developers.google.com)
2. Create OAuth 2.0 credentials
3. Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`

### GitHub
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. New OAuth App
3. Callback URL: `http://localhost:3000/api/auth/callback/github`
