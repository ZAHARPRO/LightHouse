"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ShoppingBag, ShoppingCart, Tag, Check, Loader2, Ticket, Plus, Minus, Settings } from "lucide-react";
import {
  purchaseItem, addToCart, removeFromCart, redeemPromoCode,
} from "@/actions/shop";
import { useTranslations } from "next-intl";

type ShopItem = {
  id: string; name: string; description: string | null;
  type: string; price: number; icon: string; color: string; stock: number | null;
};

type ShopSettings = { currencyName: string; currencyIcon: string };

const TYPE_LABELS: Record<string, string> = {
  BADGE: "Badge",
  VIDEO_FRAME: "Video Frame",
  GAME_FRAME: "Game Frame",
  EMOJI: "Emoji",
  SCREAMER: "Screamer",
};

const TYPE_COLORS: Record<string, string> = {
  BADGE: "#f97316",
  VIDEO_FRAME: "#6366f1",
  GAME_FRAME: "#10b981",
  EMOJI: "#fbbf24",
  SCREAMER: "#ef4444",
};

export default function ShopClient({
  settings, items, balance, purchasedIds, cartIds, isAdmin, isSignedIn, screamerCharges,
}: {
  settings: ShopSettings;
  items: ShopItem[];
  balance: number;
  purchasedIds: string[];
  cartIds: string[];
  isAdmin: boolean;
  isSignedIn: boolean;
  screamerCharges: Record<string, number>;
}) {
  const [localBalance, setLocalBalance] = useState(balance);
  const [localPurchased, setLocalPurchased] = useState(new Set(purchasedIds));
  const [localCart, setLocalCart] = useState(new Set(cartIds));
  const [localCharges, setLocalCharges] = useState<Record<string, number>>(screamerCharges);
  const [promoCode, setPromoCode] = useState("");
  const [promoMsg, setPromoMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [activeType, setActiveType] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const types = [...new Set(items.map((i) => i.type))];
  const filtered = activeType ? items.filter((i) => i.type === activeType) : items;

  function handleBuy(item: ShopItem) {
    const isScreamer = item.type === "SCREAMER";
    if (!isSignedIn || localBalance < item.price) return;
    if (!isScreamer && localPurchased.has(item.id)) return;
    if (item.stock !== null && item.stock <= 0) return;
    setLoadingId(item.id);
    start(async () => {
      const res = await purchaseItem(item.id);
      if (res.ok) {
        setLocalBalance((b) => b - item.price);
        if (isScreamer) {
          setLocalCharges((c) => ({ ...c, [item.id]: (c[item.id] ?? 0) + 1 }));
        } else {
          setLocalPurchased((s) => new Set([...s, item.id]));
          setLocalCart((s) => { const n = new Set(s); n.delete(item.id); return n; });
        }
      }
      setLoadingId(null);
    });
  }

  function handleCart(item: ShopItem) {
    if (!isSignedIn || localPurchased.has(item.id)) return;
    start(async () => {
      if (localCart.has(item.id)) {
        await removeFromCart(item.id);
        setLocalCart((s) => { const n = new Set(s); n.delete(item.id); return n; });
      } else {
        await addToCart(item.id);
        setLocalCart((s) => new Set([...s, item.id]));
      }
    });
  }

  function handlePromo() {
    if (!promoCode.trim() || !isSignedIn) return;
    start(async () => {
      const res = await redeemPromoCode(promoCode);
      if (res.ok) {
        setLocalBalance((b) => b + (res.amount ?? 0));
        setPromoMsg({ ok: true, text: `+${res.amount} ${settings.currencyIcon} added to your balance!` });
        setPromoCode("");
      } else {
        setPromoMsg({ ok: false, text: res.error ?? "Invalid code" });
      }
      setTimeout(() => setPromoMsg(null), 4000);
    });
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShoppingBag size={22} className="text-[var(--accent-orange)]" />
            <h1 className="text-[1.5rem] font-display font-extrabold text-[var(--text-primary)]">
              Light Shop
            </h1>
          </div>
          <p className="text-[0.85rem] text-[var(--text-muted)]">
            Spend your {settings.currencyName} on badges, frames, and more
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Balance */}
          {isSignedIn && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]">
              <span className="text-[1.1rem]">{settings.currencyIcon}</span>
              <span className="text-[0.9rem] font-display font-bold text-[var(--text-primary)]">
                {localBalance.toLocaleString()}
              </span>
              <span className="text-[0.75rem] text-[var(--text-muted)]">{settings.currencyName}</span>
            </div>
          )}

          {/* Admin button */}
          {isAdmin && (
            <Link
              href="/admin/shop"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[0.8rem] font-display font-semibold no-underline"
              style={{ background: "rgba(249,115,22,0.12)", color: "var(--accent-orange)", border: "1px solid rgba(249,115,22,0.25)" }}
            >
              <Settings size={13} />
              Manage Shop
            </Link>
          )}
        </div>
      </div>

      {/* Promo code bar */}
      {isSignedIn && (
        <div className="flex items-center gap-2 mb-6">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex-1 max-w-xs">
            <Ticket size={13} className="text-[var(--text-muted)] shrink-0" />
            <input
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handlePromo()}
              placeholder="PROMO CODE"
              className="bg-transparent border-none outline-none text-[0.8rem] font-display font-semibold tracking-widest text-[var(--text-primary)] placeholder-[var(--text-muted)] w-full"
            />
          </div>
          <button
            onClick={handlePromo}
            disabled={pending || !promoCode.trim()}
            className="px-4 py-2 rounded-xl text-[0.8rem] font-display font-bold transition-opacity disabled:opacity-40"
            style={{ background: "linear-gradient(90deg,#f97316,#fbbf24)", color: "white" }}
          >
            Redeem
          </button>
          {promoMsg && (
            <span className={`text-[0.8rem] font-display ${promoMsg.ok ? "text-emerald-400" : "text-red-400"}`}>
              {promoMsg.text}
            </span>
          )}
        </div>
      )}

      {/* Category tabs */}
      {types.length > 1 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setActiveType(null)}
            className="px-3 py-1.5 rounded-full text-[0.78rem] font-display font-semibold transition-all"
            style={{
              background: !activeType ? "var(--accent-orange)" : "var(--bg-elevated)",
              color: !activeType ? "white" : "var(--text-secondary)",
              border: `1px solid ${!activeType ? "transparent" : "var(--border-subtle)"}`,
            }}
          >
            All
          </button>
          {types.map((type) => (
            <button
              key={type}
              onClick={() => setActiveType(type === activeType ? null : type)}
              className="px-3 py-1.5 rounded-full text-[0.78rem] font-display font-semibold transition-all"
              style={{
                background: activeType === type ? `${TYPE_COLORS[type]}22` : "var(--bg-elevated)",
                color: activeType === type ? TYPE_COLORS[type] : "var(--text-secondary)",
                border: `1px solid ${activeType === type ? `${TYPE_COLORS[type]}40` : "var(--border-subtle)"}`,
              }}
            >
              {TYPE_LABELS[type] ?? type}
            </button>
          ))}
        </div>
      )}

      {/* Item grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-[var(--text-muted)]">
          <ShoppingBag size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-display">No items available yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((item) => {
            const isScreamer = item.type === "SCREAMER";
            const owned = !isScreamer && localPurchased.has(item.id);
            const charges = isScreamer ? (localCharges[item.id] ?? 0) : 0;
            const inCart = localCart.has(item.id);
            const canAfford = localBalance >= item.price;
            const outOfStock = item.stock !== null && item.stock <= 0;
            const isLoading = loadingId === item.id;

            return (
              <div
                key={item.id}
                className="relative flex flex-col rounded-2xl border overflow-hidden transition-[border-color,box-shadow] duration-150"
                style={{
                  borderColor: owned ? `${item.color}60` : "var(--border-subtle)",
                  background: owned ? `${item.color}0a` : "var(--bg-card)",
                  boxShadow: owned ? `0 2px 16px ${item.color}20` : undefined,
                }}
              >
                {/* Type badge */}
                <div className="absolute top-2 left-2">
                  <span
                    className="px-1.5 py-0.5 rounded text-[0.6rem] font-display font-bold uppercase tracking-wide"
                    style={{ background: `${TYPE_COLORS[item.type]}22`, color: TYPE_COLORS[item.type] }}
                  >
                    {TYPE_LABELS[item.type] ?? item.type}
                  </span>
                </div>

                {/* Owned check */}
                {owned && (
                  <div className="absolute top-2 right-2">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: item.color }}>
                      <Check size={10} color="white" />
                    </div>
                  </div>
                )}

                {/* Icon */}
                <div className="flex items-center justify-center pt-10 pb-4">
                  <span
                    className="text-[3rem] leading-none"
                    style={{ filter: `drop-shadow(0 0 8px ${item.color}50)` }}
                  >
                    {item.icon}
                  </span>
                </div>

                {/* Info */}
                <div className="px-3 pb-4 flex flex-col gap-2 flex-1">
                  <p className="text-[0.85rem] font-display font-bold text-[var(--text-primary)] text-center leading-tight">
                    {item.name}
                  </p>
                  {item.description && (
                    <p className="text-[0.7rem] text-[var(--text-muted)] text-center line-clamp-2">
                      {item.description}
                    </p>
                  )}

                  {/* Price */}
                  <div className="flex items-center justify-center gap-1 my-1">
                    <span className="text-[1rem]">{settings.currencyIcon}</span>
                    <span
                      className="text-[1rem] font-display font-extrabold"
                      style={{ color: item.color }}
                    >
                      {item.price}
                    </span>
                  </div>

                  {/* Stock badge */}
                  {item.stock !== null && (
                    <div className="text-center text-[0.65rem] font-display font-semibold mb-1"
                      style={{ color: item.stock > 0 ? "var(--text-muted)" : "#ef4444" }}>
                      {item.stock > 0 ? `${item.stock} left` : "Out of stock"}
                    </div>
                  )}

                  {/* Screamer charge count */}
                  {isScreamer && charges > 0 && (
                    <div className="text-center text-[0.68rem] font-display font-bold mb-1" style={{ color: "#ef4444" }}>
                      😱 {charges} charge{charges !== 1 ? "s" : ""}
                    </div>
                  )}

                  {/* Buttons */}
                  {!isSignedIn ? (
                    <Link
                      href="/auth/signin"
                      className="text-center px-3 py-1.5 rounded-lg text-[0.75rem] font-display font-semibold no-underline"
                      style={{ background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}
                    >
                      Sign in
                    </Link>
                  ) : owned ? (
                    <div
                      className="text-center px-3 py-1.5 rounded-lg text-[0.75rem] font-display font-semibold"
                      style={{ background: `${item.color}18`, color: item.color, border: `1px solid ${item.color}30` }}
                    >
                      ✓ Owned
                    </div>
                  ) : (
                    <div className="flex gap-1.5">
                      {!isScreamer && (
                        <button
                          onClick={() => handleCart(item)}
                          disabled={pending || outOfStock}
                          className="flex-none flex items-center justify-center w-8 h-8 rounded-lg border transition-colors"
                          style={{
                            borderColor: inCart ? `${item.color}60` : "var(--border-subtle)",
                            background: inCart ? `${item.color}18` : "var(--bg-elevated)",
                            color: inCart ? item.color : "var(--text-muted)",
                          }}
                          title={inCart ? "Remove from cart" : "Add to cart"}
                        >
                          {inCart ? <Minus size={12} /> : <Plus size={12} />}
                        </button>
                      )}
                      <button
                        onClick={() => handleBuy(item)}
                        disabled={isLoading || !canAfford || outOfStock || pending}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[0.75rem] font-display font-bold transition-all disabled:opacity-40"
                        style={{
                          background: canAfford && !outOfStock ? `linear-gradient(90deg, ${item.color}, ${item.color}cc)` : "var(--bg-elevated)",
                          color: canAfford && !outOfStock ? "white" : "var(--text-muted)",
                        }}
                      >
                        {isLoading ? <Loader2 size={11} className="animate-spin" /> : outOfStock ? "Sold out" : canAfford ? (isScreamer ? "Buy charge" : "Buy") : "Need more"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Earn more info */}
      <div className="mt-12 p-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
        <p className="text-[0.8rem] font-display font-bold text-[var(--text-primary)] mb-2">
          {settings.currencyIcon} How to earn {settings.currencyName}
        </p>
        <div className="flex flex-wrap gap-3 text-[0.75rem] text-[var(--text-muted)]">
          {[
            { action: "Register", amount: "+16" },
            { action: "Subscribe to a creator", amount: "+33" },
            { action: "Leave first comment", amount: "+3" },
            { action: "Every 10 chat messages", amount: "+1" },
            { action: "Redeem promo codes", amount: "varies" },
          ].map(({ action, amount }) => (
            <div key={action} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-card)] border border-[var(--border-subtle)]">
              <span style={{ color: "var(--accent-orange)", fontWeight: 700 }}>{amount}</span>
              <span>{action}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
