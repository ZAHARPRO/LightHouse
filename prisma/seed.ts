import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding LightHouse database…");

  // ── Categories ──────────────────────────────────────────────────────────
  const [tech, creative, music, travel] = await Promise.all([
    prisma.category.upsert({ where: { slug: "tech" },     update: {}, create: { name: "Technology", slug: "tech" } }),
    prisma.category.upsert({ where: { slug: "creative" }, update: {}, create: { name: "Creative",   slug: "creative" } }),
    prisma.category.upsert({ where: { slug: "music" },    update: {}, create: { name: "Music",      slug: "music" } }),
    prisma.category.upsert({ where: { slug: "travel" },   update: {}, create: { name: "Travel",     slug: "travel" } }),
  ]);

  const hashedPw = await bcrypt.hash("password123", 12);

  // ── Demo User ────────────────────────────────────────────────────────────
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@lighthouse.io" },
    update: {},
    create: {
      name: "Demo User",
      email: "demo@lighthouse.io",
      password: hashedPw,
      points: 250,
      tier: "PRO",
      bio: "LightHouse demo account",
    },
  });

  // ── Sidebar users ────────────────────────────────────────────────────────
  const orcistanchik = await prisma.user.upsert({
    where: { email: "orcistanchik@lighthouse.io" },
    update: {},
    create: {
      name: "Orcistanchik",
      email: "orcistanchik@lighthouse.io",
      password: hashedPw,
      points: 1489,
      tier: "PRO",
      bio: "Месим глину, снимаем контент, живём на полную 🔥",
    },
  });

  const charliePenguin = await prisma.user.upsert({
    where: { email: "charlie@lighthouse.io" },
    update: {},
    create: {
      name: "Charlie Penguin",
      email: "charlie@lighthouse.io",
      password: hashedPw,
      points: 909,
      tier: "BASIC",
      bio: "Tech creator & cinephile. I talk code, film and everything in between.",
    },
  });

  const superFreak = await prisma.user.upsert({
    where: { email: "superfreak@lighthouse.io" },
    update: {},
    create: {
      name: "SuperFreak",
      email: "superfreak@lighthouse.io",
      password: hashedPw,
      points: 42000,
      tier: "ELITE",
      bio: "Shovel Knight OST enjoyer. Elite creator. Premium vibes only.",
    },
  });

  // ── Videos ───────────────────────────────────────────────────────────────
  const demoVideos = [
    { title: "The Art of Minimalist Photography",    duration: 842,  views: 42300,  isPremium: false, categoryId: creative.id },
    { title: "Building a Next.js App from Scratch",  duration: 3600, views: 128000, isPremium: false, categoryId: tech.id },
    { title: "Cinematic Travel: Tokyo Night Walk",   duration: 1240, views: 89500,  isPremium: true,  categoryId: travel.id },
    { title: "Deep Focus Study Session — 2 Hours",   duration: 7200, views: 215000, isPremium: false, categoryId: music.id },
    { title: "Mastering Prisma ORM in 30 Minutes",   duration: 1800, views: 33800,  isPremium: false, categoryId: tech.id },
    { title: "Exclusive Creator Masterclass",        duration: 5400, views: 12000,  isPremium: true,  categoryId: creative.id },
  ];

  const orcVideos = [
    { title: "Месим глину с красивыми парнями ;)",   duration: 3050, views: 1489,  isPremium: false, categoryId: creative.id },
    { title: "Почему рабство стоит вернуть",         duration: 101,  views: 9,     isPremium: false, categoryId: creative.id },
    { title: "Інтерв'ю з Тарантіничем",             duration: 98,   views: 909,   isPremium: false, categoryId: creative.id },
    { title: "День в гончарній майстерні",           duration: 1240, views: 3200,  isPremium: false, categoryId: creative.id },
    { title: "Як я ліплю горщики — туторіал",       duration: 1800, views: 780,   isPremium: false, categoryId: creative.id },
  ];

  const charlieVideos = [
    { title: "How to Build a Next.js App",           duration: 1920, views: 7800,  isPremium: false, categoryId: tech.id },
    { title: "TypeScript Tips I Wish I Knew Earlier",duration: 1440, views: 12400, isPremium: false, categoryId: tech.id },
    { title: "Reviewing Blade Runner 2049 in 2025",  duration: 2700, views: 4100,  isPremium: false, categoryId: creative.id },
    { title: "My Full-Stack Starter Setup",          duration: 3200, views: 9900,  isPremium: true,  categoryId: tech.id },
  ];

  const superFreakVideos = [
    { title: "Shovel Knight OST — Full Album",       duration: 4200, views: 42000, isPremium: true,  categoryId: music.id },
    { title: "Best Video Game Music of 2024",        duration: 3600, views: 18700, isPremium: false, categoryId: music.id },
    { title: "How Yacht Club Designs Their Audio",   duration: 2100, views: 11200, isPremium: true,  categoryId: music.id },
    { title: "Chiptune Masterclass — Intro",         duration: 1500, views: 6300,  isPremium: false, categoryId: music.id },
  ];

  for (const v of demoVideos) {
    await prisma.video.create({ data: { ...v, url: "https://example.com/video.mp4", authorId: demoUser.id } });
  }
  for (const v of orcVideos) {
    await prisma.video.create({ data: { ...v, url: "https://example.com/video.mp4", authorId: orcistanchik.id } });
  }
  for (const v of charlieVideos) {
    await prisma.video.create({ data: { ...v, url: "https://example.com/video.mp4", authorId: charliePenguin.id } });
  }
  for (const v of superFreakVideos) {
    await prisma.video.create({ data: { ...v, url: "https://example.com/video.mp4", authorId: superFreak.id } });
  }

  // ── Rewards ───────────────────────────────────────────────────────────────
  await prisma.reward.createMany({
    data: [
      { type: "EARLY_ADOPTER",  pointsValue: 50,  description: "Joined LightHouse early",      userId: demoUser.id },
      { type: "PREMIUM_MEMBER", pointsValue: 100, description: "Became a premium member",       userId: demoUser.id },
      { type: "FIRST_COMMENT",  pointsValue: 10,  description: "Left your first comment!",       userId: demoUser.id },
      { type: "EARLY_ADOPTER",  pointsValue: 50,  description: "Joined LightHouse early",      userId: orcistanchik.id },
      { type: "SUPER_FAN",      pointsValue: 75,  description: "Super fan of the community",    userId: orcistanchik.id },
      { type: "WATCH_STREAK",   pointsValue: 30,  description: "7-day watch streak",            userId: orcistanchik.id },
      { type: "EARLY_ADOPTER",  pointsValue: 50,  description: "Joined LightHouse early",      userId: charliePenguin.id },
      { type: "FIRST_COMMENT",  pointsValue: 10,  description: "Left your first comment!",       userId: charliePenguin.id },
      { type: "EARLY_ADOPTER",  pointsValue: 50,  description: "Joined LightHouse early",      userId: superFreak.id },
      { type: "PREMIUM_MEMBER", pointsValue: 100, description: "Became a premium member",       userId: superFreak.id },
      { type: "SUPER_FAN",      pointsValue: 75,  description: "Elite content creator",         userId: superFreak.id },
      { type: "WATCH_STREAK",   pointsValue: 30,  description: "30-day watch streak legend",    userId: superFreak.id },
    ],
    skipDuplicates: true,
  });

  // ── Chat messages ─────────────────────────────────────────────────────────
  await prisma.chatMessage.createMany({
    data: [
      { content: "Welcome to LightHouse! 🔥",                          authorId: demoUser.id },
      { content: "The video feed looks amazing!",                       authorId: demoUser.id },
      { content: "Just subscribed to Pro — totally worth it 🚀",        authorId: demoUser.id },
      { content: "Ліплю горщики, відповідаю на питання 😄",             authorId: orcistanchik.id },
      { content: "New Next.js tutorial dropping tomorrow!",              authorId: charliePenguin.id },
      { content: "Anyone else here from the beta? 👋",                  authorId: superFreak.id },
      { content: "Shovel Knight OST hits different at 3am",             authorId: superFreak.id },
    ],
  });

  // ── Subscriptions (demo → sidebar creators) ──────────────────────────────
  await prisma.subscription.createMany({
    data: [
      { subscriberId: demoUser.id, creatorId: orcistanchik.id,  plan: "BASIC", status: "ACTIVE" },
      { subscriberId: demoUser.id, creatorId: charliePenguin.id, plan: "BASIC", status: "ACTIVE" },
      { subscriberId: demoUser.id, creatorId: superFreak.id,     plan: "PRO",   status: "ACTIVE" },
    ],
    skipDuplicates: true,
  });

  console.log("✅ Seed complete!");
  console.log("🔑 demo@lighthouse.io / password123");
  console.log("🔑 orcistanchik@lighthouse.io / password123");
  console.log("🔑 charlie@lighthouse.io / password123");
  console.log("🔑 superfreak@lighthouse.io / password123");
  console.log("");
  console.log(`👤 Orcistanchik  → /profile/${orcistanchik.id}`);
  console.log(`👤 Charlie       → /profile/${charliePenguin.id}`);
  console.log(`👤 SuperFreak    → /profile/${superFreak.id}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
