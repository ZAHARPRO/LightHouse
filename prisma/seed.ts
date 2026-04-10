import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding LightHouse database…");

  // Create categories
  const categories = await Promise.all([
    prisma.category.upsert({ where: { slug: "tech" }, update: {}, create: { name: "Technology", slug: "tech" } }),
    prisma.category.upsert({ where: { slug: "creative" }, update: {}, create: { name: "Creative", slug: "creative" } }),
    prisma.category.upsert({ where: { slug: "music" }, update: {}, create: { name: "Music", slug: "music" } }),
    prisma.category.upsert({ where: { slug: "travel" }, update: {}, create: { name: "Travel", slug: "travel" } }),
  ]);

  // Demo user
  const hashedPw = await bcrypt.hash("password123", 12);
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

  // Demo videos
  const videoData = [
    { title: "The Art of Minimalist Photography", duration: 842, views: 42300, isPremium: false, categoryId: categories[1].id },
    { title: "Building a Next.js App from Scratch", duration: 3600, views: 128000, isPremium: false, categoryId: categories[0].id },
    { title: "Cinematic Travel: Tokyo Night Walk", duration: 1240, views: 89500, isPremium: true, categoryId: categories[3].id },
    { title: "Deep Focus Study Session — 2 Hours", duration: 7200, views: 215000, isPremium: false, categoryId: categories[2].id },
    { title: "Mastering Prisma ORM in 30 Minutes", duration: 1800, views: 33800, isPremium: false, categoryId: categories[0].id },
    { title: "Exclusive Creator Masterclass", duration: 5400, views: 12000, isPremium: true, categoryId: categories[1].id },
  ];

  for (const v of videoData) {
    await prisma.video.create({
      data: { ...v, url: "https://example.com/video.mp4", authorId: demoUser.id },
    });
  }

  // Demo rewards
  await prisma.reward.createMany({
    data: [
      { type: "EARLY_ADOPTER", pointsValue: 50, description: "Joined LightHouse early", userId: demoUser.id },
      { type: "PREMIUM_MEMBER", pointsValue: 100, description: "Became a premium member", userId: demoUser.id },
      { type: "FIRST_COMMENT", pointsValue: 10, description: "Left your first comment!", userId: demoUser.id },
    ],
    skipDuplicates: true,
  });

  // Demo chat messages
  await prisma.chatMessage.createMany({
    data: [
      { content: "Welcome to LightHouse! 🔥", authorId: demoUser.id },
      { content: "The video feed looks amazing!", authorId: demoUser.id },
      { content: "Just subscribed to Pro — totally worth it 🚀", authorId: demoUser.id },
    ],
  });

  console.log("✅ Seed complete!");
  console.log("🔑 Demo login: demo@lighthouse.io / password123");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
