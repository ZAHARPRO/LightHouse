"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Upload, Check, X, ChevronDown, ChevronUp, MessageSquare, Volume2 } from "lucide-react";

const TTS_KEY         = "lh_tts_settings";
const TTS_ENABLED_KEY = "lh_tts_enabled";
const TRIGGERS_KEY    = "lh_tts_triggers";

function loadTriggers(): string[] {
  try { const r = localStorage.getItem(TRIGGERS_KEY); if (r) return JSON.parse(r); } catch { /* ignore */ }
  return [];
}
function saveTriggers(words: string[]) {
  try { localStorage.setItem(TRIGGERS_KEY, JSON.stringify(words)); } catch { /* ignore */ }
}

type TtsSettings = { voice: string; rate: number; pitch: number; volume: number; };

function loadTts(): TtsSettings {
  try {
    const raw = localStorage.getItem(TTS_KEY);
    if (raw) return { rate: 1, pitch: 1, volume: 1, voice: "", ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { voice: "", rate: 1, pitch: 1, volume: 1 };
}
function saveTts(s: TtsSettings) {
  try { localStorage.setItem(TTS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export interface CustomFont  { id: string; name: string; }
export interface CustomFrame { id: string; name: string; url: string; }

export type PosPreset = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface OverlaySettings {
  enabled: boolean;
  fontFamily: string;
  fontWeight: "400" | "600" | "700" | "900";
  fontSize: number;
  textColor: string;
  overlayBgColor: string;
  overlayBgOpacity: number;
  msgBgColor: string;
  msgBgOpacity: number;
  avatarFrame: "circle" | "rounded" | "squircle" | string;
  maxMessages: number;
  showAvatars: boolean;
  showTimestamps: boolean;
  posPreset: PosPreset;
  customFonts: CustomFont[];
  customFrames: CustomFrame[];
}

export const POS_KEY = "streamOverlayPos";

export const STORAGE_KEY = "streamOverlaySettings";

export const PRESET_FONTS = [
  { label: "Inter",          value: "Inter" },
  { label: "Roboto",         value: "Roboto" },
  { label: "Nunito",         value: "Nunito" },
  { label: "Montserrat",     value: "Montserrat" },
  { label: "Oswald",         value: "Oswald" },
  { label: "Open Sans",      value: "Open Sans" },
  { label: "Lato",           value: "Lato" },
  { label: "Comic Sans",     value: "Comic Sans MS" },
  { label: "Georgia",        value: "Georgia" },
  { label: "Courier New",    value: "Courier New" },
  { label: "Impact",         value: "Impact" },
  { label: "Press Start 2P", value: "Press Start 2P" },
];

export const GOOGLE_FONTS = ["Inter","Roboto","Nunito","Montserrat","Oswald","Open Sans","Lato","Press Start 2P"];

export const PRESET_FRAMES = [
  { id: "circle",   label: "Circle" },
  { id: "rounded",  label: "Rounded" },
  { id: "squircle", label: "Squircle" },
];

export const DEFAULT_SETTINGS: OverlaySettings = {
  enabled: true,
  fontFamily: "Inter",
  fontWeight: "600",
  fontSize: 15,
  textColor: "#ffffff",
  overlayBgColor: "#000000",
  overlayBgOpacity: 40,
  msgBgColor: "#000000",
  msgBgOpacity: 60,
  avatarFrame: "circle",
  maxMessages: 8,
  showAvatars: true,
  showTimestamps: false,
  posPreset: "top-right",
  customFonts: [],
  customFrames: [],
};

export function frameClip(frame: string) {
  if (frame === "circle")   return "50%";
  if (frame === "rounded")  return "8px";
  if (frame === "squircle") return "30%";
  return "50%";
}

export function loadGoogleFont(name: string) {
  const id = `gfont-${name.replace(/\s+/g, "-")}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name)}:wght@400;600;700;900&display=swap`;
  document.head.appendChild(link);
}

export function loadSettings(): OverlaySettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettingsToStorage(s: OverlaySettings) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[0.75rem] text-[var(--text-secondary)] shrink-0">{label}</span>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[0.6875rem] font-display font-bold tracking-[0.06em] uppercase text-[var(--text-muted)] mt-1">{children}</p>;
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      className="relative w-9 h-5 rounded-full shrink-0 transition-colors"
      style={{ background: value ? "var(--accent-orange)" : "rgba(255,255,255,0.1)" }}
    >
      <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
        style={{ left: value ? "calc(100% - 18px)" : "2px" }} />
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function StreamOverlaySettings() {
  const [settings,    setSettings]    = useState<OverlaySettings>(DEFAULT_SETTINGS);
  const [open,        setOpen]        = useState(false);
  const [tab,         setTab]         = useState<"appearance"|"font"|"avatar"|"layout"|"voice">("appearance");
  const [newFontName, setNewFontName] = useState("");
  const [tts,         setTts]         = useState<TtsSettings>({ voice: "", rate: 1, pitch: 1, volume: 1 });
  const [ttsOn,       setTtsOn]       = useState(false);
  const [voices,      setVoices]      = useState<SpeechSynthesisVoice[]>([]);
  const [triggers,    setTriggers]    = useState<string[]>([]);
  const [newTrigger,  setNewTrigger]  = useState("");
  const frameUpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSettings(loadSettings());
    setTts(loadTts());
    try { setTtsOn(localStorage.getItem(TTS_ENABLED_KEY) === "true"); } catch { /* ignore */ }
    setTriggers(loadTriggers());
    function loadVoices() { setVoices(window.speechSynthesis?.getVoices() ?? []); }
    loadVoices();
    if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  function updateTts(patch: Partial<TtsSettings>) {
    setTts(prev => { const next = { ...prev, ...patch }; saveTts(next); return next; });
  }

  function toggleTtsOn() {
    const next = !ttsOn;
    setTtsOn(next);
    try { localStorage.setItem(TTS_ENABLED_KEY, String(next)); } catch { /* ignore */ }
  }

  function addTrigger() {
    const word = newTrigger.trim().toLowerCase();
    if (!word || triggers.includes(word)) return;
    const next = [...triggers, word];
    setTriggers(next);
    saveTriggers(next);
    setNewTrigger("");
  }

  function removeTrigger(word: string) {
    const next = triggers.filter(w => w !== word);
    setTriggers(next);
    saveTriggers(next);
  }

  function previewVoice() {
    if (!window.speechSynthesis) return;
    const utter = new SpeechSynthesisUtterance("Hello, this is a voice preview.");
    const v = window.speechSynthesis.getVoices().find(vv => vv.name === tts.voice);
    if (v) utter.voice = v;
    utter.rate = tts.rate; utter.pitch = tts.pitch; utter.volume = tts.volume;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  }

  function save(next: OverlaySettings) {
    setSettings(next);
    saveSettingsToStorage(next);
  }

  function addCustomFont() {
    const name = newFontName.trim();
    if (!name || settings.customFonts.some(f => f.name === name)) return;
    save({ ...settings, customFonts: [...settings.customFonts, { id: crypto.randomUUID(), name }] });
    setNewFontName("");
    loadGoogleFont(name);
  }

  function onFrameUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      save({ ...settings, customFrames: [...settings.customFrames, { id: crypto.randomUUID(), name: file.name.replace(/\.[^.]+$/, ""), url: reader.result as string }] });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  const allFonts = [...PRESET_FONTS, ...settings.customFonts.map(f => ({ label: f.name, value: f.name }))];

  return (
    <div className="flex flex-col gap-0 border border-[var(--border-subtle)] rounded-[10px] overflow-hidden">
      {/* Header — Messages */}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-between px-3 py-2.5 bg-[var(--bg-elevated)] hover:bg-[var(--bg-card)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <MessageSquare size={14} className="text-[var(--accent-orange)]" />
          <span className="text-[0.8125rem] font-display font-semibold text-[var(--text-primary)]">Messages</span>
          <span
            className="text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: settings.enabled ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.06)", color: settings.enabled ? "#10b981" : "var(--text-muted)" }}
          >
            {settings.enabled ? "ON" : "OFF"}
          </span>
        </div>
        {open ? <ChevronUp size={14} className="text-[var(--text-muted)]" /> : <ChevronDown size={14} className="text-[var(--text-muted)]" />}
      </button>

      {open && (
        <div className="bg-[var(--bg-card)] border-t border-[var(--border-subtle)]">
          {/* Enabled toggle — top of panel */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--border-subtle)]">
            <span className="text-[0.8125rem] font-display font-semibold text-[var(--text-primary)]">Show chat overlay</span>
            <Toggle value={settings.enabled} onChange={v => save({ ...settings, enabled: v })} />
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[var(--border-subtle)]">
            {(["appearance","font","avatar","layout","voice"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="flex-1 py-2 text-[0.7rem] font-display font-semibold capitalize transition-colors"
                style={{
                  color: tab === t ? "var(--accent-orange)" : "var(--text-muted)",
                  background: "none", border: "none", cursor: "pointer",
                  borderBottom: tab === t ? "2px solid var(--accent-orange)" : "2px solid transparent",
                }}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 p-3">

            {/* ── APPEARANCE ── */}
            {tab === "appearance" && (<>
              <Row label="Text color">
                <input type="color" value={settings.textColor}
                  onChange={e => save({ ...settings, textColor: e.target.value })}
                  className="w-9 h-7 rounded cursor-pointer border-0" />
              </Row>

              <Row label="Overlay background">
                <div className="flex items-center gap-2">
                  <input type="color" value={settings.overlayBgColor}
                    onChange={e => save({ ...settings, overlayBgColor: e.target.value })}
                    className="w-9 h-7 rounded cursor-pointer border-0" />
                  <input type="range" min={0} max={100} value={settings.overlayBgOpacity}
                    onChange={e => save({ ...settings, overlayBgOpacity: +e.target.value })}
                    className="w-24" />
                  <span className="text-[0.7rem] text-[var(--text-muted)] w-8">{settings.overlayBgOpacity}%</span>
                </div>
              </Row>

              <Row label="Message background">
                <div className="flex items-center gap-2">
                  <input type="color" value={settings.msgBgColor}
                    onChange={e => save({ ...settings, msgBgColor: e.target.value })}
                    className="w-9 h-7 rounded cursor-pointer border-0" />
                  <input type="range" min={0} max={100} value={settings.msgBgOpacity}
                    onChange={e => save({ ...settings, msgBgOpacity: +e.target.value })}
                    className="w-24" />
                  <span className="text-[0.7rem] text-[var(--text-muted)] w-8">{settings.msgBgOpacity}%</span>
                </div>
              </Row>

              <Row label="Timestamps"><Toggle value={settings.showTimestamps} onChange={v => save({ ...settings, showTimestamps: v })} /></Row>
            </>)}

            {/* ── FONT ── */}
            {tab === "font" && (<>
              <Row label="Size">
                <div className="flex items-center gap-2">
                  <input type="range" min={11} max={24} value={settings.fontSize}
                    onChange={e => save({ ...settings, fontSize: +e.target.value })}
                    className="w-24" />
                  <span className="text-[0.7rem] text-[var(--text-muted)] w-5">{settings.fontSize}</span>
                </div>
              </Row>

              <Row label="Weight">
                <select value={settings.fontWeight}
                  onChange={e => save({ ...settings, fontWeight: e.target.value as OverlaySettings["fontWeight"] })}
                  className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[6px] px-2 py-1 text-[0.75rem] text-[var(--text-primary)] outline-none"
                >
                  <option value="400">Regular (400)</option>
                  <option value="600">SemiBold (600)</option>
                  <option value="700">Bold (700)</option>
                  <option value="900">Black (900)</option>
                </select>
              </Row>

              <SectionLabel>Font</SectionLabel>
              <div className="grid grid-cols-3 gap-1.5">
                {allFonts.map(f => (
                  <button key={f.value} onClick={() => { save({ ...settings, fontFamily: f.value }); if (GOOGLE_FONTS.includes(f.value)) loadGoogleFont(f.value); }}
                    className="flex items-center justify-between px-2 py-1.5 rounded-[6px] text-[0.7rem] transition-colors truncate"
                    style={{
                      background: settings.fontFamily === f.value ? "rgba(var(--accent-orange-rgb),0.12)" : "var(--bg-elevated)",
                      border: `1px solid ${settings.fontFamily === f.value ? "rgba(249,115,22,0.4)" : "var(--border-subtle)"}`,
                      color: settings.fontFamily === f.value ? "var(--accent-orange)" : "var(--text-secondary)",
                      fontFamily: f.value,
                    }}
                  >
                    <span className="truncate">{f.label}</span>
                    {settings.fontFamily === f.value && <Check size={9} className="shrink-0 ml-1" />}
                  </button>
                ))}
              </div>

              <SectionLabel>Add Google Font</SectionLabel>
              <div className="flex gap-2">
                <input value={newFontName} onChange={e => setNewFontName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addCustomFont()}
                  placeholder="e.g. Bebas Neue"
                  className="flex-1 input-field text-sm h-8 px-2"
                />
                <button onClick={addCustomFont} className="px-3 h-8 rounded-[7px] bg-[var(--accent-orange)] text-white flex items-center">
                  <Plus size={14} />
                </button>
              </div>

              {settings.customFonts.length > 0 && (
                <div className="flex flex-col gap-1">
                  {settings.customFonts.map(f => (
                    <div key={f.id} className="flex items-center justify-between px-2 py-1 bg-[var(--bg-elevated)] rounded-[6px]">
                      <span className="text-[0.75rem] text-[var(--text-secondary)]" style={{ fontFamily: f.name }}>{f.name}</span>
                      <button onClick={() => save({ ...settings, customFonts: settings.customFonts.filter(x => x.id !== f.id) })}
                        className="text-red-400/60 hover:text-red-400 transition-colors p-0.5">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>)}

            {/* ── AVATAR ── */}
            {tab === "avatar" && (<>
              <Row label="Show avatars"><Toggle value={settings.showAvatars} onChange={v => save({ ...settings, showAvatars: v })} /></Row>

              <SectionLabel>Avatar frame</SectionLabel>
              <div className="flex gap-2 flex-wrap">
                {PRESET_FRAMES.map(f => (
                  <button key={f.id} onClick={() => save({ ...settings, avatarFrame: f.id })}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-[8px] transition-colors"
                    style={{
                      background: settings.avatarFrame === f.id ? "rgba(249,115,22,0.1)" : "var(--bg-elevated)",
                      border: `2px solid ${settings.avatarFrame === f.id ? "rgba(249,115,22,0.5)" : "var(--border-subtle)"}`,
                    }}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: frameClip(f.id), background: "var(--accent-orange)" }} />
                    <span className="text-[0.6rem] text-[var(--text-muted)]">{f.label}</span>
                  </button>
                ))}

                {settings.customFrames.map(f => (
                  <div key={f.id} className="relative">
                    <button onClick={() => save({ ...settings, avatarFrame: f.id })}
                      className="flex flex-col items-center gap-1.5 p-2 rounded-[8px]"
                      style={{
                        background: settings.avatarFrame === f.id ? "rgba(249,115,22,0.1)" : "var(--bg-elevated)",
                        border: `2px solid ${settings.avatarFrame === f.id ? "rgba(249,115,22,0.5)" : "var(--border-subtle)"}`,
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={f.url} alt={f.name} style={{ width: 28, height: 28, objectFit: "contain" }} />
                      <span className="text-[0.6rem] text-[var(--text-muted)] max-w-[48px] truncate">{f.name}</span>
                    </button>
                    <button onClick={() => save({ ...settings, customFrames: settings.customFrames.filter(x => x.id !== f.id), avatarFrame: settings.avatarFrame === f.id ? "circle" : settings.avatarFrame })}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                      <X size={9} color="white" />
                    </button>
                  </div>
                ))}
              </div>

              <button onClick={() => frameUpRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 rounded-[8px] border border-dashed border-[var(--border-subtle)] text-[0.75rem] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors w-fit"
              >
                <Upload size={12} /> Upload frame (PNG/SVG)
              </button>
              <input ref={frameUpRef} type="file" accept="image/png,image/svg+xml" className="hidden" onChange={onFrameUpload} />
            </>)}

            {/* ── VOICE ── */}
            {tab === "voice" && (<>
              <Row label="Enable TTS">
                <Toggle value={ttsOn} onChange={toggleTtsOn} />
              </Row>

              <SectionLabel>Voice</SectionLabel>
              <select
                value={tts.voice}
                onChange={e => updateTts({ voice: e.target.value })}
                className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[6px] px-2 py-1.5 text-[0.75rem] text-[var(--text-primary)] outline-none"
              >
                <option value="">Default</option>
                {voices.map(v => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
              </select>

              {([
                { label: "Speed",  key: "rate",   min: 0.5, max: 2,  step: 0.1 },
                { label: "Pitch",  key: "pitch",  min: 0.5, max: 2,  step: 0.1 },
                { label: "Volume", key: "volume", min: 0,   max: 1,  step: 0.1 },
              ] as const).map(({ label, key, min, max, step }) => (
                <Row key={key} label={`${label}: ${tts[key].toFixed(1)}`}>
                  <input
                    type="range" min={min} max={max} step={step}
                    value={tts[key]}
                    onChange={e => updateTts({ [key]: parseFloat(e.target.value) })}
                    className="w-32 accent-orange-500"
                  />
                </Row>
              ))}

              <button
                onClick={previewVoice}
                className="flex items-center gap-2 px-3 py-1.5 rounded-[7px] text-[0.75rem] font-display font-semibold transition-colors w-fit"
                style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.3)", color: "var(--accent-orange)" }}
              >
                <Volume2 size={13} /> Preview voice
              </button>

              <p className="text-[0.6875rem] text-[var(--text-muted)]">
                When TTS is on, incoming chat messages are read aloud for you.
              </p>

              <SectionLabel>Trigger words</SectionLabel>
              <p className="text-[0.6875rem] text-[var(--text-muted)] -mt-2">
                Messages containing these words are always read aloud.
              </p>
              <div className="flex gap-2">
                <input
                  value={newTrigger}
                  onChange={e => setNewTrigger(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addTrigger()}
                  placeholder="e.g. pog, wow"
                  className="flex-1 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[6px] px-2 py-1 text-[0.75rem] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
                />
                <button onClick={addTrigger}
                  className="px-3 h-8 rounded-[7px] bg-[var(--accent-orange)] text-white flex items-center justify-center shrink-0">
                  <Plus size={14} />
                </button>
              </div>
              {triggers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {triggers.map(word => (
                    <span key={word} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6875rem] font-semibold"
                      style={{ background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.3)", color: "var(--accent-orange)" }}>
                      {word}
                      <button onClick={() => removeTrigger(word)} className="opacity-60 hover:opacity-100 transition-opacity ml-0.5">
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </>)}

            {/* ── LAYOUT ── */}
            {tab === "layout" && (<>
              <Row label={`Max messages: ${settings.maxMessages}`}>
                <input type="range" min={3} max={20} value={settings.maxMessages}
                  onChange={e => save({ ...settings, maxMessages: +e.target.value })}
                  className="w-32" />
              </Row>

              <SectionLabel>Position</SectionLabel>
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  { id: "top-left",     label: "↖ Top left" },
                  { id: "top-right",    label: "↗ Top right" },
                  { id: "bottom-left",  label: "↙ Bottom left" },
                  { id: "bottom-right", label: "↘ Bottom right" },
                ] as { id: PosPreset; label: string }[]).map(p => (
                  <button key={p.id} onClick={() => save({ ...settings, posPreset: p.id })}
                    className="px-2 py-1.5 rounded-[6px] text-[0.7rem] font-display font-semibold transition-colors"
                    style={{
                      background: settings.posPreset === p.id ? "rgba(249,115,22,0.12)" : "var(--bg-elevated)",
                      border: `1px solid ${settings.posPreset === p.id ? "rgba(249,115,22,0.4)" : "var(--border-subtle)"}`,
                      color: settings.posPreset === p.id ? "var(--accent-orange)" : "var(--text-secondary)",
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <p className="text-[0.6875rem] text-[var(--text-muted)]">
                You can also drag the panel in the overlay window for fine-tuning.
              </p>
            </>)}
          </div>
        </div>
      )}
    </div>
  );
}
