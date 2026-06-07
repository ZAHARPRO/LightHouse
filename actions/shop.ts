"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

function requireAdmin(role: string) {
  if (role !== "ADMIN") throw new Error("Unauthorized");
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function getShopSettings() {
  let settings = await prisma.shopSettings.findUnique({ where: { id: 1 } });
  if (!settings) settings = await prisma.shopSettings.create({ data: { id: 1 } });
  return settings;
}

export async function updateShopSettings(currencyName: string, currencyIcon: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };
  requireAdmin(session.user.role ?? "USER");
  await prisma.shopSettings.upsert({
    where: { id: 1 },
    update: { currencyName, currencyIcon },
    create: { id: 1, currencyName, currencyIcon },
  });
  revalidatePath("/shop");
  revalidatePath("/admin/shop");
  return { ok: true };
}

// ── Items ─────────────────────────────────────────────────────────────────────

export async function getShopItems() {
  return prisma.shopItem.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function getAllShopItems() {
  return prisma.shopItem.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { purchases: true } } },
  });
}

export async function createShopItem(data: {
  name: string; description?: string; type: string; price: number;
  icon: string; color: string; sortOrder?: number; stock?: number | null;
  screamerVideoUrl?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };
  requireAdmin(session.user.role ?? "USER");
  await prisma.shopItem.create({
    data: {
      name: data.name,
      description: data.description,
      type: data.type as import("@prisma/client").ShopItemType,
      price: data.price,
      icon: data.icon,
      color: data.color,
      sortOrder: data.sortOrder ?? 0,
      stock: data.stock ?? null,
      screamerVideoUrl: data.screamerVideoUrl ?? null,
    },
  });
  revalidatePath("/shop");
  revalidatePath("/admin/shop");
  return { ok: true };
}

export async function updateShopItem(id: string, data: {
  name?: string; description?: string; price?: number;
  icon?: string; color?: string; sortOrder?: number; active?: boolean;
  stock?: number | null; screamerVideoUrl?: string | null;
}) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };
  requireAdmin(session.user.role ?? "USER");
  await prisma.shopItem.update({ where: { id }, data });
  revalidatePath("/shop");
  revalidatePath("/admin/shop");
  return { ok: true };
}

export async function deleteShopItem(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };
  requireAdmin(session.user.role ?? "USER");
  await prisma.shopItem.delete({ where: { id } });
  revalidatePath("/shop");
  revalidatePath("/admin/shop");
  return { ok: true };
}

// ── Purchase ──────────────────────────────────────────────────────────────────

export async function purchaseItem(itemId: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Not signed in" };

  const [user, item] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id }, select: { lightGrivna: true } }),
    prisma.shopItem.findUnique({ where: { id: itemId } }),
  ]);
  if (!user || !item) return { ok: false, error: "Not found" };
  if (!item.active) return { ok: false, error: "Item unavailable" };
  if (user.lightGrivna < item.price) return { ok: false, error: "Insufficient funds" };
  if (item.stock !== null && item.stock <= 0) return { ok: false, error: "Out of stock" };

  if (item.type === "SCREAMER") {
    // Screamers are consumable — each purchase = one charge, no unique constraint
    await prisma.$transaction([
      prisma.user.update({ where: { id: session.user.id }, data: { lightGrivna: { decrement: item.price } } }),
      ...(item.stock !== null ? [prisma.shopItem.update({ where: { id: itemId }, data: { stock: { decrement: 1 } } })] : []),
      prisma.screamerCharge.create({ data: { userId: session.user.id, itemId } }),
    ]);
    revalidatePath("/shop");
    return { ok: true, type: "screamer" };
  }

  const existing = await prisma.shopPurchase.findUnique({
    where: { userId_itemId: { userId: session.user.id, itemId } },
  });
  if (existing) return { ok: false, error: "Already owned" };

  await prisma.$transaction([
    prisma.user.update({ where: { id: session.user.id }, data: { lightGrivna: { decrement: item.price } } }),
    ...(item.stock !== null ? [prisma.shopItem.update({ where: { id: itemId }, data: { stock: { decrement: 1 } } })] : []),
    prisma.shopPurchase.create({ data: { userId: session.user.id, itemId } }),
  ]);

  revalidatePath("/shop");
  return { ok: true };
}

export async function getMyScreamerCharges(): Promise<Record<string, number>> {
  const session = await auth();
  if (!session?.user?.id) return {};
  const charges = await prisma.screamerCharge.findMany({
    where: { userId: session.user.id, used: false },
    select: { itemId: true },
  });
  const counts: Record<string, number> = {};
  for (const c of charges) counts[c.itemId] = (counts[c.itemId] ?? 0) + 1;
  return counts;
}

export async function sendScreamer(recipientId: string, itemId: string, bypass: boolean) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Not signed in" };
  if (session.user.id === recipientId) return { ok: false, error: "Cannot screamer yourself" };

  const [item, recipient] = await Promise.all([
    prisma.shopItem.findUnique({ where: { id: itemId }, select: { id: true, type: true, screamerVideoUrl: true, active: true } }),
    prisma.user.findUnique({ where: { id: recipientId }, select: { screamersEnabled: true } }),
  ]);
  if (!item || item.type !== "SCREAMER" || !item.active) return { ok: false, error: "Item not found" };
  if (!item.screamerVideoUrl) return { ok: false, error: "No video set for this screamer" };
  if (!recipient) return { ok: false, error: "Recipient not found" };

  const chargesNeeded = bypass ? 3 : 1;
  const available = await prisma.screamerCharge.findMany({
    where: { userId: session.user.id, itemId, used: false },
    take: chargesNeeded,
    orderBy: { createdAt: "asc" },
  });
  if (available.length < chargesNeeded) return { ok: false, error: "Not enough charges" };

  if (!recipient.screamersEnabled && !bypass) {
    return { ok: false, error: "disabled", canBypass: true };
  }

  const chargeIds = available.map((c) => c.id);
  await prisma.$transaction([
    prisma.screamerCharge.updateMany({ where: { id: { in: chargeIds } }, data: { used: true } }),
    prisma.pendingScreamer.create({
      data: { senderId: session.user.id, recipientId, videoUrl: item.screamerVideoUrl!, bypassed: bypass },
    }),
  ]);

  return { ok: true };
}

export async function getMyPurchasedIds(): Promise<string[]> {
  const session = await auth();
  if (!session?.user?.id) return [];
  const purchases = await prisma.shopPurchase.findMany({
    where: { userId: session.user.id },
    select: { itemId: true },
  });
  return purchases.map((p) => p.itemId);
}

// ── Cart ──────────────────────────────────────────────────────────────────────

export async function getMyCart() {
  const session = await auth();
  if (!session?.user?.id) return [];
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { cartJson: true },
  });
  const ids: string[] = (() => { try { return JSON.parse(user?.cartJson ?? "[]"); } catch { return []; } })();
  if (ids.length === 0) return [];
  return prisma.shopItem.findMany({ where: { id: { in: ids }, active: true } });
}

export async function addToCart(itemId: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Not signed in" };
  const user = await prisma.user.findUnique({
    where: { id: session.user.id }, select: { cartJson: true },
  });
  const ids: string[] = (() => { try { return JSON.parse(user?.cartJson ?? "[]"); } catch { return []; } })();
  if (!ids.includes(itemId)) ids.push(itemId);
  await prisma.user.update({ where: { id: session.user.id }, data: { cartJson: JSON.stringify(ids) } });
  revalidatePath("/shop");
  return { ok: true };
}

export async function removeFromCart(itemId: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Not signed in" };
  const user = await prisma.user.findUnique({
    where: { id: session.user.id }, select: { cartJson: true },
  });
  const ids: string[] = (() => { try { return JSON.parse(user?.cartJson ?? "[]"); } catch { return []; } })();
  const next = ids.filter((id) => id !== itemId);
  await prisma.user.update({ where: { id: session.user.id }, data: { cartJson: JSON.stringify(next) } });
  revalidatePath("/shop");
  return { ok: true };
}

export async function clearCart() {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  await prisma.user.update({ where: { id: session.user.id }, data: { cartJson: "[]" } });
  revalidatePath("/shop");
  return { ok: true };
}

// ── Promo codes ───────────────────────────────────────────────────────────────

export async function redeemPromoCode(code: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Not signed in" };

  const promo = await prisma.promoCode.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!promo || !promo.active) return { ok: false, error: "Invalid or expired code" };
  if (promo.expiresAt && promo.expiresAt < new Date()) return { ok: false, error: "Code expired" };
  if (promo.maxUses != null && promo.usedCount >= promo.maxUses) return { ok: false, error: "Code used up" };

  const alreadyUsed = await prisma.promoCodeUse.findUnique({
    where: { userId_promoCodeId: { userId: session.user.id, promoCodeId: promo.id } },
  });
  if (alreadyUsed) return { ok: false, error: "Already redeemed" };

  await prisma.$transaction([
    prisma.promoCodeUse.create({ data: { userId: session.user.id, promoCodeId: promo.id } }),
    prisma.promoCode.update({ where: { id: promo.id }, data: { usedCount: { increment: 1 } } }),
    prisma.user.update({ where: { id: session.user.id }, data: { lightGrivna: { increment: promo.amount } } }),
  ]);

  revalidatePath("/shop");
  return { ok: true, amount: promo.amount };
}

export async function createPromoCode(data: { code: string; amount: number; maxUses?: number; expiresAt?: string }) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };
  requireAdmin(session.user.role ?? "USER");
  const code = data.code.trim().toUpperCase();
  if (!code) return { ok: false, error: "Code required" };
  await prisma.promoCode.create({
    data: {
      code,
      amount: data.amount,
      maxUses: data.maxUses ?? null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    },
  });
  revalidatePath("/admin/shop");
  return { ok: true };
}

export async function deletePromoCode(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };
  requireAdmin(session.user.role ?? "USER");
  await prisma.promoCode.delete({ where: { id } });
  revalidatePath("/admin/shop");
  return { ok: true };
}

export async function getAllPromoCodes() {
  const session = await auth();
  if (!session?.user?.id) return [];
  requireAdmin(session.user.role ?? "USER");
  return prisma.promoCode.findMany({ orderBy: { createdAt: "desc" } });
}

export async function setScreamersEnabled(enabled: boolean) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  await prisma.user.update({ where: { id: session.user.id }, data: { screamersEnabled: enabled } });
  revalidatePath("/settings");
  return { ok: true };
}

export async function syncPointsToLightGrivna() {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };
  requireAdmin(session.user.role ?? "USER");
  // Set lightGrivna = floor(points / 3) for every user, only if it would increase their balance
  const result = await prisma.$executeRaw`
    UPDATE "User"
    SET "lightGrivna" = GREATEST("lightGrivna", FLOOR("points" / 3))
  `;
  revalidatePath("/shop");
  return { ok: true, affected: result };
}
