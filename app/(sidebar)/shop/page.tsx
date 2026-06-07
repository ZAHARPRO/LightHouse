import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getShopSettings, getShopItems, getMyPurchasedIds, getMyScreamerCharges } from "@/actions/shop";
import { getTranslations } from "next-intl/server";
import ShopClient from "./ShopClient";

export default async function ShopPage() {
  const [session, t, settings, items] = await Promise.all([
    auth(),
    getTranslations("shop"),
    getShopSettings(),
    getShopItems(),
  ]);

  let balance = 0;
  let purchasedIds: string[] = [];
  let cartIds: string[] = [];
  let isAdmin = false;
  let screamerCharges: Record<string, number> = {};

  if (session?.user?.id) {
    const [user, purchased, charges] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { lightGrivna: true, cartJson: true, role: true },
      }),
      getMyPurchasedIds(),
      getMyScreamerCharges(),
    ]);
    balance = user?.lightGrivna ?? 0;
    cartIds = (() => { try { return JSON.parse(user?.cartJson ?? "[]"); } catch { return []; } })();
    purchasedIds = purchased;
    screamerCharges = charges;
    isAdmin = user?.role === "ADMIN";
  }

  return (
    <ShopClient
      settings={settings}
      items={items}
      balance={balance}
      purchasedIds={purchasedIds}
      cartIds={cartIds}
      isAdmin={isAdmin}
      isSignedIn={!!session?.user?.id}
      screamerCharges={screamerCharges}
    />
  );
}
