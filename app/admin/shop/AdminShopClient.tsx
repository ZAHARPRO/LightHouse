"use client";

import { useState, useTransition } from "react";
import {
  updateShopSettings, createShopItem, updateShopItem, deleteShopItem,
  createPromoCode, deletePromoCode, syncPointsToLightGrivna,
} from "@/actions/shop";
import { Loader2, Trash2, Plus, Pencil, Check, X, ShoppingBag, Ticket, RefreshCw } from "lucide-react";

type ShopItem = {
  id: string; name: string; description: string | null;
  type: string; price: number; icon: string; color: string;
  active: boolean; sortOrder: number; stock: number | null;
  screamerVideoUrl: string | null;
  _count: { purchases: number };
};

type PromoCode = {
  id: string; code: string; amount: number; maxUses: number | null;
  usedCount: number; active: boolean; expiresAt: Date | null;
};

type ShopSettings = { currencyName: string; currencyIcon: string };

const ITEM_TYPES = ["BADGE", "VIDEO_FRAME", "GAME_FRAME", "EMOJI", "SCREAMER"];

const emptyItem = { name: "", description: "", type: "BADGE", price: 10, icon: "⭐", color: "#f97316", sortOrder: 0, active: true, stock: "" as string, screamerVideoUrl: "" };

export default function AdminShopClient({
  settings, items, promoCodes,
}: {
  settings: ShopSettings;
  items: ShopItem[];
  promoCodes: PromoCode[];
}) {
  const [pending, start] = useTransition();

  // Sync legacy points
  const [syncMsg, setSyncMsg] = useState("");
  function runSync() {
    if (!confirm("Set every user's LG to max(current LG, floor(points / 3))? This is safe to run multiple times.")) return;
    start(async () => {
      const res = await syncPointsToLightGrivna();
      setSyncMsg(res.ok ? `Done! ${res.affected} rows updated.` : (res.error ?? "Error"));
      setTimeout(() => setSyncMsg(""), 5000);
    });
  }

  // Settings
  const [currName, setCurrName] = useState(settings.currencyName);
  const [currIcon, setCurrIcon] = useState(settings.currencyIcon);
  const [settingsSaved, setSettingsSaved] = useState(false);

  function saveSettings() {
    start(async () => {
      await updateShopSettings(currName, currIcon);
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    });
  }

  // Items
  const [localItems, setLocalItems] = useState<ShopItem[]>(items);
  const [editingItem, setEditingItem] = useState<Partial<typeof emptyItem> & { id?: string } | null>(null);
  const [itemMsg, setItemMsg] = useState("");

  function openNew() { setEditingItem({ ...emptyItem }); }
  const [uploadingVideo, setUploadingVideo] = useState(false);

  function openEdit(item: ShopItem) {
    setEditingItem({
      id: item.id, name: item.name, description: item.description ?? "",
      type: item.type, price: item.price, icon: item.icon, color: item.color,
      sortOrder: item.sortOrder, active: item.active,
      stock: item.stock != null ? String(item.stock) : "",
      screamerVideoUrl: item.screamerVideoUrl ?? "",
    });
  }

  async function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingVideo(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/screamer/upload", { method: "POST", body: fd }).then(r => r.json()).catch(() => null);
    setUploadingVideo(false);
    if (res?.url) setEditingItem((p) => ({ ...p, screamerVideoUrl: res.url }));
  }

  function saveItem() {
    if (!editingItem) return;
    const stockVal = editingItem.stock !== "" && editingItem.stock !== undefined
      ? parseInt(String(editingItem.stock)) || null
      : null;
    start(async () => {
      if (editingItem.id) {
        await updateShopItem(editingItem.id, {
          name: editingItem.name, description: editingItem.description,
          price: editingItem.price, icon: editingItem.icon, color: editingItem.color,
          sortOrder: editingItem.sortOrder, active: editingItem.active,
          stock: stockVal,
          screamerVideoUrl: editingItem.screamerVideoUrl || null,
        });
        setLocalItems((prev) => prev.map((i) =>
          i.id === editingItem.id
            ? {
                ...i,
                name: editingItem.name ?? i.name,
                description: editingItem.description ?? null,
                price: editingItem.price ?? i.price,
                icon: editingItem.icon ?? i.icon,
                color: editingItem.color ?? i.color,
                sortOrder: editingItem.sortOrder ?? i.sortOrder,
                active: editingItem.active ?? true,
                stock: stockVal,
                screamerVideoUrl: editingItem.screamerVideoUrl ?? null,
              }
            : i
        ));
      } else {
        const res = await createShopItem({
          name: editingItem.name ?? "",
          description: editingItem.description,
          type: editingItem.type ?? "BADGE",
          price: editingItem.price ?? 10,
          icon: editingItem.icon ?? "⭐",
          color: editingItem.color ?? "#f97316",
          sortOrder: editingItem.sortOrder,
          stock: stockVal,
          screamerVideoUrl: editingItem.screamerVideoUrl || undefined,
        });
        if (res.ok) {
          setItemMsg("Item created — refresh to see it");
          setTimeout(() => setItemMsg(""), 3000);
        }
      }
      setEditingItem(null);
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this item? All purchases will be removed too.")) return;
    start(async () => {
      await deleteShopItem(id);
      setLocalItems((prev) => prev.filter((i) => i.id !== id));
    });
  }

  // Promo codes
  const [localPromos, setLocalPromos] = useState<PromoCode[]>(promoCodes);
  const [promoForm, setPromoForm] = useState({ code: "", amount: 10, maxUses: "", expiresAt: "" });
  const [promoMsg, setPromoMsg] = useState("");

  function createPromo() {
    if (!promoForm.code.trim()) return;
    start(async () => {
      const res = await createPromoCode({
        code: promoForm.code,
        amount: promoForm.amount,
        maxUses: promoForm.maxUses ? parseInt(promoForm.maxUses) : undefined,
        expiresAt: promoForm.expiresAt || undefined,
      });
      if (res.ok) {
        setPromoMsg("Promo code created!");
        setPromoForm({ code: "", amount: 10, maxUses: "", expiresAt: "" });
        setTimeout(() => setPromoMsg(""), 3000);
      }
    });
  }

  function handleDeletePromo(id: string) {
    start(async () => {
      await deletePromoCode(id);
      setLocalPromos((prev) => prev.filter((p) => p.id !== id));
    });
  }

  const inputCls = "w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] text-sm outline-none focus:border-[var(--accent-orange)]";

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-[1.3rem] font-display font-extrabold text-[var(--text-primary)] flex items-center gap-2">
          <ShoppingBag size={20} className="text-[var(--accent-orange)]" />
          Shop Management
        </h1>
        <p className="text-[0.8rem] text-[var(--text-muted)] mt-0.5">Configure currency, items, and promo codes</p>
      </div>

      {/* Legacy points sync */}
      <section className="p-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)]">
        <h2 className="text-[0.9rem] font-display font-bold text-[var(--text-primary)] mb-1">Sync existing points → LG</h2>
        <p className="text-[0.75rem] text-[var(--text-muted)] mb-3">
          For every user sets <code className="text-[var(--accent-orange)]">lightGrivna = max(lightGrivna, floor(points / 3))</code>.
          Safe to run multiple times — never decreases anyone's balance.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={runSync}
            disabled={pending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[0.82rem] font-display font-bold disabled:opacity-50"
            style={{ background: "rgba(99,102,241,0.15)", color: "#6366f1", border: "1px solid rgba(99,102,241,0.3)" }}
          >
            {pending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Run sync
          </button>
          {syncMsg && <span className="text-[0.8rem] font-display text-emerald-400">{syncMsg}</span>}
        </div>
      </section>

      {/* Currency Settings */}
      <section className="p-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)]">
        <h2 className="text-[0.9rem] font-display font-bold text-[var(--text-primary)] mb-4">Currency Settings</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-[0.72rem] font-display font-semibold text-[var(--text-muted)]">Currency Name</label>
            <input value={currName} onChange={(e) => setCurrName(e.target.value)} className={inputCls} style={{ width: 180 }} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[0.72rem] font-display font-semibold text-[var(--text-muted)]">Currency Icon</label>
            <input value={currIcon} onChange={(e) => setCurrIcon(e.target.value)} className={inputCls} style={{ width: 80 }} />
          </div>
          <button
            onClick={saveSettings}
            disabled={pending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[0.82rem] font-display font-bold disabled:opacity-50"
            style={{ background: "var(--accent-orange)", color: "white" }}
          >
            {settingsSaved ? <Check size={13} /> : pending ? <Loader2 size={13} className="animate-spin" /> : null}
            {settingsSaved ? "Saved!" : "Save"}
          </button>
        </div>
      </section>

      {/* Items */}
      <section className="p-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[0.9rem] font-display font-bold text-[var(--text-primary)]">
            Shop Items ({localItems.length})
          </h2>
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.78rem] font-display font-bold"
            style={{ background: "rgba(249,115,22,0.15)", color: "var(--accent-orange)", border: "1px solid rgba(249,115,22,0.3)" }}
          >
            <Plus size={13} /> Add Item
          </button>
        </div>
        {itemMsg && <p className="text-emerald-400 text-[0.8rem] mb-3">{itemMsg}</p>}

        {/* Edit / create form */}
        {editingItem && (
          <div className="mb-4 p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] space-y-3">
            <p className="text-[0.8rem] font-display font-bold text-[var(--text-primary)]">
              {editingItem.id ? "Edit Item" : "New Item"}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[0.7rem] font-display text-[var(--text-muted)]">Name</label>
                <input value={editingItem.name ?? ""} onChange={(e) => setEditingItem((p) => ({ ...p, name: e.target.value }))} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[0.7rem] font-display text-[var(--text-muted)]">Type</label>
                <select value={editingItem.type ?? "BADGE"} onChange={(e) => setEditingItem((p) => ({ ...p, type: e.target.value }))}
                  className={inputCls}>
                  {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[0.7rem] font-display text-[var(--text-muted)]">Price</label>
                <input type="number" min={0} value={editingItem.price ?? 0} onChange={(e) => setEditingItem((p) => ({ ...p, price: parseInt(e.target.value) || 0 }))} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[0.7rem] font-display text-[var(--text-muted)]">Icon (emoji)</label>
                <input value={editingItem.icon ?? ""} onChange={(e) => setEditingItem((p) => ({ ...p, icon: e.target.value }))} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[0.7rem] font-display text-[var(--text-muted)]">Color (hex)</label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={editingItem.color ?? "#f97316"} onChange={(e) => setEditingItem((p) => ({ ...p, color: e.target.value }))}
                    className="w-9 h-9 rounded cursor-pointer border border-[var(--border-subtle)] bg-transparent" />
                  <input value={editingItem.color ?? ""} onChange={(e) => setEditingItem((p) => ({ ...p, color: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[0.7rem] font-display text-[var(--text-muted)]">Sort order</label>
                <input type="number" value={editingItem.sortOrder ?? 0} onChange={(e) => setEditingItem((p) => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[0.7rem] font-display text-[var(--text-muted)]">Stock (blank = unlimited)</label>
                <input
                  type="number" min={0}
                  value={editingItem.stock ?? ""}
                  onChange={(e) => setEditingItem((p) => ({ ...p, stock: e.target.value }))}
                  placeholder="∞" className={inputCls}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[0.7rem] font-display text-[var(--text-muted)]">Description</label>
              <input value={editingItem.description ?? ""} onChange={(e) => setEditingItem((p) => ({ ...p, description: e.target.value }))} className={inputCls} />
            </div>
            {editingItem.type === "SCREAMER" && (
              <div className="flex flex-col gap-2 p-3 rounded-lg border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.06)]">
                <p className="text-[0.72rem] font-display font-bold text-red-400">😱 Screamer Video</p>
                <div className="flex flex-col gap-1">
                  <label className="text-[0.7rem] font-display text-[var(--text-muted)]">YouTube URL or direct video URL</label>
                  <input
                    value={editingItem.screamerVideoUrl ?? ""}
                    onChange={(e) => setEditingItem((p) => ({ ...p, screamerVideoUrl: e.target.value }))}
                    placeholder="https://youtube.com/watch?v=... or /uploads/screamers/..."
                    className={inputCls}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[0.7rem] font-display text-[var(--text-muted)]">Or upload video/MP3 (max 10 MB)</label>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer text-[0.75rem] font-display border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                      {uploadingVideo ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                      {uploadingVideo ? "Uploading…" : "Choose file"}
                      <input type="file" accept="video/mp4,video/webm,audio/mp3,audio/mpeg,audio/ogg" className="sr-only" onChange={handleVideoUpload} disabled={uploadingVideo} />
                    </label>
                    {editingItem.screamerVideoUrl && (
                      <span className="text-[0.7rem] text-emerald-400 truncate max-w-[200px]">{editingItem.screamerVideoUrl}</span>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer text-[0.8rem] text-[var(--text-secondary)]">
                <input type="checkbox" checked={editingItem.active ?? true} onChange={(e) => setEditingItem((p) => ({ ...p, active: e.target.checked }))} />
                Active (visible in shop)
              </label>
            </div>
            <div className="flex gap-2">
              <button onClick={saveItem} disabled={pending} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[0.78rem] font-display font-bold disabled:opacity-50" style={{ background: "var(--accent-orange)", color: "white" }}>
                {pending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save
              </button>
              <button onClick={() => setEditingItem(null)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[0.78rem] font-display text-[var(--text-muted)] border border-[var(--border-subtle)]">
                <X size={12} /> Cancel
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {localItems.length === 0 && (
            <p className="text-[0.8rem] text-[var(--text-muted)]">No items yet.</p>
          )}
          {localItems.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
              <span className="text-[1.5rem] leading-none shrink-0">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[0.82rem] font-display font-bold text-[var(--text-primary)] truncate">{item.name}</p>
                <p className="text-[0.7rem] text-[var(--text-muted)]">
                  {item.type} · {item.price} {settings.currencyIcon} · {item._count.purchases} sold
                  {item.stock != null && <span className="ml-2 text-amber-400">stock: {item.stock}</span>}
                </p>
              </div>
              {!item.active && (
                <span className="shrink-0 px-1.5 py-0.5 rounded text-[0.6rem] font-display bg-red-500/10 text-red-400">Hidden</span>
              )}
              <div className="w-3 h-3 rounded-full shrink-0" style={{ background: item.color }} />
              <button onClick={() => openEdit(item)} className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg hover:bg-[var(--bg-card)] text-[var(--text-muted)]">
                <Pencil size={13} />
              </button>
              <button onClick={() => handleDelete(item.id)} disabled={pending} className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Promo codes */}
      <section className="p-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)]">
        <h2 className="text-[0.9rem] font-display font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <Ticket size={15} className="text-[var(--accent-orange)]" />
          Promo Codes
        </h2>

        {/* Create form */}
        <div className="flex flex-wrap gap-3 items-end mb-5 p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          <div className="flex flex-col gap-1">
            <label className="text-[0.7rem] font-display text-[var(--text-muted)]">Code</label>
            <div className="flex gap-1.5">
              <input
                value={promoForm.code} onChange={(e) => setPromoForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                placeholder="SUMMER2026" className={inputCls} style={{ width: 140 }}
              />
              <button
                type="button"
                onClick={() => {
                  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
                  const code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
                  setPromoForm((p) => ({ ...p, code }));
                }}
                className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                title="Generate random code"
              >
                <RefreshCw size={13} />
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[0.7rem] font-display text-[var(--text-muted)]">Amount</label>
            <input
              type="number" min={1} value={promoForm.amount}
              onChange={(e) => setPromoForm((p) => ({ ...p, amount: parseInt(e.target.value) || 1 }))}
              className={inputCls} style={{ width: 80 }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[0.7rem] font-display text-[var(--text-muted)]">Max uses (blank=∞)</label>
            <input
              type="number" min={1} value={promoForm.maxUses}
              onChange={(e) => setPromoForm((p) => ({ ...p, maxUses: e.target.value }))}
              placeholder="∞" className={inputCls} style={{ width: 100 }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[0.7rem] font-display text-[var(--text-muted)]">Expires (optional)</label>
            <input
              type="datetime-local" value={promoForm.expiresAt}
              onChange={(e) => setPromoForm((p) => ({ ...p, expiresAt: e.target.value }))}
              className={inputCls} style={{ width: 180 }}
            />
          </div>
          <button
            onClick={createPromo}
            disabled={pending || !promoForm.code.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[0.78rem] font-display font-bold disabled:opacity-50"
            style={{ background: "var(--accent-orange)", color: "white" }}
          >
            <Plus size={13} /> Create
          </button>
          {promoMsg && <span className="text-emerald-400 text-[0.78rem] font-display">{promoMsg}</span>}
        </div>

        <div className="space-y-2">
          {localPromos.length === 0 && <p className="text-[0.8rem] text-[var(--text-muted)]">No promo codes yet.</p>}
          {localPromos.map((promo) => (
            <div key={promo.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
              <span className="font-display font-bold text-[0.85rem] tracking-widest text-[var(--accent-orange)] shrink-0">{promo.code}</span>
              <div className="flex-1 min-w-0 flex flex-wrap gap-x-4 gap-y-0.5">
                <span className="text-[0.75rem] text-[var(--text-secondary)]">+{promo.amount} {settings.currencyIcon}</span>
                <span className="text-[0.75rem] text-[var(--text-muted)]">
                  {promo.usedCount}/{promo.maxUses ?? "∞"} uses
                </span>
                {promo.expiresAt && (
                  <span className="text-[0.72rem] text-[var(--text-muted)]">
                    expires {new Date(promo.expiresAt).toLocaleDateString()}
                  </span>
                )}
              </div>
              {!promo.active && (
                <span className="shrink-0 px-1.5 py-0.5 rounded text-[0.6rem] font-display bg-red-500/10 text-red-400">Inactive</span>
              )}
              <button onClick={() => handleDeletePromo(promo.id)} disabled={pending} className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
