"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Send, MessageSquare, Smile, Reply, X,
  Volume2, VolumeX, ChevronDown, Heart,
  ShieldCheck, ShieldOff, Ban, MicOff, Mic, UserCheck, UserX,
} from "lucide-react";
import Image from "next/image";

type ReplyTo      = { id: string; userName: string; text: string };
type ModAction    = "mute" | "unmute" | "ban" | "unban" | "make_mod" | "remove_mod";

type ChatMsg = {
  id: string;
  text: string;
  userName: string;
  userImage?: string | null;
  userId: string;
  isSupport?: boolean;
  isModerator?: boolean;
  at: number;
  replyTo?: ReplyTo | null;
};

type TtsSettings = { voice: string; rate: number; pitch: number; volume: number };

const TTS_KEY         = "lh_tts_settings";
const TTS_ENABLED_KEY = "lh_tts_enabled";
const TRIGGERS_KEY    = "lh_tts_triggers";

const DEFAULT_EMOJIS = [
  "😀","😂","😍","🥹","😭","😎","🤔","🥺","😮","🤯",
  "😡","😴","🤩","🥳","🫡","👀","💀","🙏","🫶","❤️",
  "🔥","💯","✨","🎉","⭐","👍","👎","🤝","👏","🫂",
  "🎮","💪","🚀","🏆","💡","🍕","🎵","🌊","⚡","🐐",
];

function loadTtsSettings(): TtsSettings {
  try {
    const raw = localStorage.getItem(TTS_KEY);
    if (raw) return { rate: 1, pitch: 1, volume: 1, voice: "", ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { voice: "", rate: 1, pitch: 1, volume: 1 };
}

interface Props {
  streamId: string;
  currentUserId: string;
  currentUserName?: string;
  isStreamOwner?: boolean;
  initialMessages?: ChatMsg[];
}

export default function StreamChatPanel({
  streamId,
  currentUserId,
  currentUserName = "",
  isStreamOwner = false,
  initialMessages = [],
}: Props) {
  const [msgs,         setMsgs]         = useState<ChatMsg[]>(initialMessages);
  const [text,         setText]         = useState("");
  const [sending,      setSending]      = useState(false);
  const [showEmoji,    setShowEmoji]    = useState(false);
  const [replyTo,      setReplyTo]      = useState<ReplyTo | null>(null);
  const [newMsgCount,  setNewMsgCount]  = useState(0);
  const [ttsEnabled,   setTtsEnabled]   = useState(false);
  const [ttsSettings,  setTtsSettings]  = useState<TtsSettings>({ voice: "", rate: 1, pitch: 1, volume: 1 });
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [hoveredId,    setHoveredId]    = useState<string | null>(null);
  const [triggerWords, setTriggerWords] = useState<string[]>([]);

  // Moderation state
  const [modMods,   setModMods]   = useState<Set<string>>(new Set());
  const [modMuted,  setModMuted]  = useState<Set<string>>(new Set());
  const [modBanned, setModBanned] = useState<Set<string>>(new Set());

  const bottomRef   = useRef<HTMLDivElement>(null);
  const msgsRef     = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLInputElement>(null);
  const emojiRef    = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const ttsRef           = useRef({ enabled: ttsEnabled, settings: ttsSettings });
  const triggersRef      = useRef<string[]>([]);
  const defaultTriggerRef = useRef<string>("");

  useEffect(() => { ttsRef.current = { enabled: ttsEnabled, settings: ttsSettings }; }, [ttsEnabled, ttsSettings]);
  useEffect(() => { triggersRef.current = triggerWords; }, [triggerWords]);
  useEffect(() => {
    defaultTriggerRef.current = (currentUserName ?? "").toLowerCase().replace(/\s+/g, "");
  }, [currentUserName]);

  // Load localStorage + modstate on mount
  useEffect(() => {
    setTtsSettings(loadTtsSettings());
    try { setTtsEnabled(localStorage.getItem(TTS_ENABLED_KEY) === "true"); } catch { /* ignore */ }
    try {
      const raw = localStorage.getItem(TRIGGERS_KEY);
      if (raw) setTriggerWords(JSON.parse(raw) as string[]);
    } catch { /* ignore */ }

    fetch(`/api/streams/${streamId}/modstate`)
      .then(r => r.json())
      .then((data: { mods: string[]; muted: string[]; banned: string[] }) => {
        setModMods(new Set(data.mods));
        setModMuted(new Set(data.muted));
        setModBanned(new Set(data.banned));
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track scroll position
  useEffect(() => {
    const el = msgsRef.current;
    if (!el) return;
    function onScroll() {
      if (!el) return;
      atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      if (atBottomRef.current) setNewMsgCount(0);
    }
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Smart auto-scroll
  useEffect(() => {
    if (msgs.length === 0) return;
    if (atBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    } else {
      setNewMsgCount(c => c + 1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgs.length]);

  // SSE
  useEffect(() => {
    if (!streamId) return;
    const es = new EventSource(`/api/streams/${streamId}/sse`);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);

        if (data.type === "chat") {
          const msg = data as ChatMsg;
          setMsgs(prev => [...prev, msg]);
          if (msg.userId !== currentUserId && ttsRef.current.enabled) {
            const words = triggersRef.current.length > 0
              ? triggersRef.current
              : defaultTriggerRef.current ? [defaultTriggerRef.current] : [];
            if (words.length > 0) {
              const lower = msg.text.toLowerCase();
              if (words.some(w => lower.includes(w))) {
                speak(msg.userName, msg.text, ttsRef.current.settings);
              }
            }
          }
        }

        if (data.type === "mod_update") {
          const { action, targetUserId } = data as { action: ModAction; targetUserId: string };
          if (action === "mute")       setModMuted(s => new Set([...s, targetUserId]));
          if (action === "unmute")     setModMuted(s => { const n = new Set(s); n.delete(targetUserId); return n; });
          if (action === "ban")        setModBanned(s => new Set([...s, targetUserId]));
          if (action === "unban")      setModBanned(s => { const n = new Set(s); n.delete(targetUserId); return n; });
          if (action === "make_mod")   setModMods(s => new Set([...s, targetUserId]));
          if (action === "remove_mod") setModMods(s => { const n = new Set(s); n.delete(targetUserId); return n; });
        }
      } catch { /* ignore */ }
    };
    return () => es.close();
  }, [streamId, currentUserId]);

  // Close emoji panel on outside click
  useEffect(() => {
    if (!showEmoji) return;
    function outside(e: MouseEvent) {
      if (!emojiRef.current?.contains(e.target as Node)) setShowEmoji(false);
    }
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [showEmoji]);

  // Recent senders for @ mention
  const recentSenders = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (let i = msgs.length - 1; i >= 0 && result.length < 20; i--) {
      const m = msgs[i];
      if (!m.isSupport && m.userName !== currentUserName && !seen.has(m.userName)) {
        seen.add(m.userName);
        result.push(m.userName);
      }
    }
    return result;
  }, [msgs, currentUserName]);

  const mentionMatches = useMemo(
    () => mentionQuery !== null
      ? recentSenders.filter(n => n.toLowerCase().startsWith(mentionQuery.toLowerCase()))
      : [],
    [mentionQuery, recentSenders],
  );

  function speak(userName: string, msgText: string, s: TtsSettings) {
    if (!window.speechSynthesis) return;
    const utter = new SpeechSynthesisUtterance(`${userName}: ${msgText}`);
    const v = window.speechSynthesis.getVoices().find(vv => vv.name === s.voice);
    if (v) utter.voice = v;
    utter.rate = s.rate; utter.pitch = s.pitch; utter.volume = s.volume;
    window.speechSynthesis.speak(utter);
  }

  const moderate = useCallback(async (action: ModAction, targetUserId: string) => {
    await fetch(`/api/streams/${streamId}/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, targetUserId }),
    }).catch(() => {});
  }, [streamId]);

  async function send() {
    const t = text.trim();
    if (!t || sending) return;
    if (modMuted.has(currentUserId)) return;
    if (modBanned.has(currentUserId)) return;
    const reply = replyTo;
    setSending(true);
    setText("");
    setReplyTo(null);
    setMentionQuery(null);
    const res = await fetch(`/api/streams/${streamId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: t, replyTo: reply }),
    }).catch(() => null);
    if (res && !res.ok) {
      const err = await res.json().catch(() => ({}));
      if (err.error) alert(err.error);
    }
    setSending(false);
    inputRef.current?.focus();
  }

  function handleChange(val: string) {
    setText(val);
    const atIdx = val.lastIndexOf("@");
    if (atIdx !== -1 && !val.slice(atIdx + 1).includes(" ")) {
      setMentionQuery(val.slice(atIdx + 1));
      setMentionIndex(0);
      return;
    }
    setMentionQuery(null);
  }

  function insertMention(name: string) {
    const atIdx = text.lastIndexOf("@");
    setText(text.slice(0, atIdx) + "@" + name + " ");
    setMentionQuery(null);
    inputRef.current?.focus();
  }

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setNewMsgCount(0);
    atBottomRef.current = true;
  }

  function toggleTts() {
    const next = !ttsEnabled;
    setTtsEnabled(next);
    try { localStorage.setItem(TTS_ENABLED_KEY, String(next)); } catch { /* ignore */ }
  }

  function renderText(msgText: string, isMe: boolean) {
    return msgText.split(/(@\w+)/g).map((part, i) => {
      if (/^@\w+$/.test(part)) {
        const isMine = currentUserName && part.slice(1).toLowerCase() === currentUserName.toLowerCase();
        return (
          <span key={i} className={`font-semibold ${isMine
            ? (isMe ? "text-orange-200" : "text-orange-400")
            : (isMe ? "text-orange-100" : "text-[var(--accent-orange)]")}`}>
            {part}
          </span>
        );
      }
      return part;
    });
  }

  function formatTime(ms: number) {
    return new Date(ms).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  }

  const isCurrentUserMod = modMods.has(currentUserId);
  const canModerate      = isStreamOwner || isCurrentUserMod;
  const isSelfMuted      = modMuted.has(currentUserId);
  const isSelfBanned     = modBanned.has(currentUserId);

  return (
    <div className="flex flex-col bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[14px] overflow-hidden h-[360px] sm:h-[420px] lg:h-[calc(100vh-180px)] lg:min-h-[400px] lg:max-h-[800px]">

      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border-subtle)] shrink-0">
        <MessageSquare size={14} className="text-[var(--accent-orange)]" />
        <span className="font-display font-bold text-[0.8125rem] text-[var(--text-primary)]">Live Chat</span>
        {isCurrentUserMod && (
          <span className="flex items-center gap-1 text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400">
            <ShieldCheck size={9} /> MOD
          </span>
        )}
        <span className="ml-auto text-[0.6875rem] text-[var(--text-muted)]">{msgs.length} messages</span>
      </div>

      {/* Messages */}
      <div
        ref={msgsRef}
        className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2 min-h-0 [scrollbar-width:thin] [scrollbar-color:var(--border-subtle)_transparent]"
      >
        {msgs.length === 0 && (
          <p className="text-[0.75rem] text-[var(--text-muted)] italic text-center mt-4">
            No messages yet. Be the first to say hi!
          </p>
        )}

        {msgs.map((m) => {
          if (modBanned.has(m.userId) && m.userId !== currentUserId) return null;

          const isMe        = m.userId === currentUserId;
          const isMod       = m.isModerator || modMods.has(m.userId);
          const mentionedMe = !!currentUserName && m.text.toLowerCase().includes(`@${currentUserName.toLowerCase()}`);
          const isTarget    = !isMe && canModerate;
          const isMsgMuted  = modMuted.has(m.userId);
          const isMsgBanned = modBanned.has(m.userId);
          const isMsgMod    = modMods.has(m.userId);

          if (m.isSupport) {
            return (
              <div key={m.id} className="flex flex-col items-center my-1">
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-[12px] max-w-[95%] text-center"
                  style={{ background: "linear-gradient(135deg,#831843 0%,#9d174d 100%)", border: "1px solid rgba(244,114,182,0.3)" }}>
                  <Heart size={11} className="text-pink-300 shrink-0" fill="currentColor" />
                  <span className="text-[0.6875rem] font-display font-bold text-pink-200 truncate max-w-[80px]">{m.userName}</span>
                  <span className="text-[0.6875rem] text-pink-100 break-words leading-snug">{m.text}</span>
                  <Heart size={11} className="text-pink-300 shrink-0" fill="currentColor" />
                </div>
              </div>
            );
          }

          return (
            <div
              key={m.id}
              className={`flex items-start gap-2 group ${isMe ? "flex-row-reverse" : "flex-row"}`}
              style={mentionedMe ? { background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.2)", borderRadius: 10, padding: "2px 4px", margin: "0 -4px" } : undefined}
              onMouseEnter={() => setHoveredId(m.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* Avatar */}
              <div className="shrink-0 mt-0.5">
                {m.userImage ? (
                  <Image src={m.userImage} alt="" width={26} height={26} className="rounded-full object-cover" unoptimized />
                ) : (
                  <div className="w-[26px] h-[26px] rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-[0.6rem] font-bold text-[var(--text-muted)]">
                    {m.userName[0]?.toUpperCase() ?? "?"}
                  </div>
                )}
              </div>

              <div className={`flex flex-col max-w-[72%] ${isMe ? "items-end" : "items-start"}`}>
                {!isMe && (
                  <span className={`flex items-center gap-1 text-[0.6875rem] font-display font-semibold truncate max-w-[140px] mb-0.5 ml-0.5 ${isMod ? "text-indigo-400" : "text-[var(--accent-orange)]"}`}>
                    {isMod && <ShieldCheck size={10} className="shrink-0" />}
                    {m.userName}
                  </span>
                )}

                {/* Reply quote */}
                {m.replyTo && (
                  <div className={`px-2 py-1 mb-1 rounded-[8px] text-[0.6875rem] max-w-full ${isMe ? "mr-0.5" : "ml-0.5"}`}
                    style={{ borderLeft: "2px solid var(--accent-orange)", background: "var(--bg-elevated)", color: "var(--text-muted)" }}>
                    <span className="font-semibold text-[var(--accent-orange)]">{m.replyTo.userName}</span>
                    {" "}{m.replyTo.text.length > 60 ? m.replyTo.text.slice(0, 60) + "…" : m.replyTo.text}
                  </div>
                )}

                <div
                  className="px-3 py-1.5 text-[0.8125rem] break-words leading-snug"
                  style={{
                    background: isMe ? "var(--accent-orange)" : isMod ? "rgba(99,102,241,0.12)" : "var(--bg-elevated)",
                    color: isMe ? "#fff" : "var(--text-primary)",
                    border: isMe ? "none" : isMod ? "1px solid rgba(99,102,241,0.35)" : "1px solid var(--border-subtle)",
                    borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  }}
                >
                  {renderText(m.text, isMe)}
                </div>
                <span suppressHydrationWarning className="text-[0.6rem] text-[var(--text-muted)] mt-0.5 mx-0.5">
                  {formatTime(m.at)}
                </span>
              </div>

              {/* Hover action buttons */}
              <div className={`flex items-center gap-0.5 self-center shrink-0 transition-opacity ${hoveredId === m.id ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                {/* Reply — always */}
                <button onClick={() => { setReplyTo({ id: m.id, userName: m.userName, text: m.text }); inputRef.current?.focus(); }}
                  className="p-1 rounded-[6px] text-[var(--text-muted)] hover:text-[var(--accent-orange)] hover:bg-[var(--bg-elevated)] transition-colors" title="Reply">
                  <Reply size={13} />
                </button>

                {/* Mute / Unmute — owner + mods */}
                {isTarget && (
                  <button onClick={() => moderate(isMsgMuted ? "unmute" : "mute", m.userId)}
                    className={`p-1 rounded-[6px] transition-colors hover:bg-[var(--bg-elevated)] ${isMsgMuted ? "text-yellow-400 hover:text-yellow-300" : "text-[var(--text-muted)] hover:text-yellow-400"}`}
                    title={isMsgMuted ? "Unmute" : "Mute"}>
                    {isMsgMuted ? <Mic size={13} /> : <MicOff size={13} />}
                  </button>
                )}

                {/* Ban / Unban — owner + mods */}
                {isTarget && (
                  <button onClick={() => moderate(isMsgBanned ? "unban" : "ban", m.userId)}
                    className={`p-1 rounded-[6px] transition-colors hover:bg-[var(--bg-elevated)] ${isMsgBanned ? "text-red-400 hover:text-red-300" : "text-[var(--text-muted)] hover:text-red-400"}`}
                    title={isMsgBanned ? "Unban" : "Ban"}>
                    {isMsgBanned ? <ShieldOff size={13} /> : <Ban size={13} />}
                  </button>
                )}

                {/* Make / Remove mod — owner only */}
                {isStreamOwner && !isMe && (
                  <button onClick={() => moderate(isMsgMod ? "remove_mod" : "make_mod", m.userId)}
                    className={`p-1 rounded-[6px] transition-colors hover:bg-[var(--bg-elevated)] ${isMsgMod ? "text-indigo-400 hover:text-indigo-300" : "text-[var(--text-muted)] hover:text-indigo-400"}`}
                    title={isMsgMod ? "Remove mod" : "Make mod"}>
                    {isMsgMod ? <UserX size={13} /> : <UserCheck size={13} />}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* New messages badge */}
      {newMsgCount > 0 && (
        <div className="flex justify-center py-1 shrink-0">
          <button onClick={scrollToBottom}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[0.6875rem] font-semibold text-white hover:opacity-80 transition-opacity shadow-lg"
            style={{ background: "var(--accent-orange)" }}>
            <ChevronDown size={12} />
            {newMsgCount} new {newMsgCount === 1 ? "message" : "messages"}
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="flex flex-col border-t border-[var(--border-subtle)] shrink-0 relative">

        {/* Mention dropdown — absolute above input */}
        {mentionQuery !== null && (
          <div className="absolute bottom-full left-0 right-0 mx-3 mb-1 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[8px] shadow-xl z-40 max-h-[160px] overflow-y-auto [scrollbar-width:thin]">
            {mentionMatches.length === 0 ? (
              <p className="px-3 py-2.5 text-[0.8125rem] text-[var(--text-muted)] italic">
                {recentSenders.length === 0
                  ? "No users in chat yet"
                  : `No user matching "@${mentionQuery}"`}
              </p>
            ) : (
              mentionMatches.slice(0, 6).map((name, i) => (
                <button key={name} onMouseDown={e => { e.preventDefault(); insertMention(name); }}
                  className={`w-full text-left px-3 py-1.5 text-[0.8125rem] transition-colors ${i === mentionIndex ? "bg-[var(--bg-elevated)] text-[var(--accent-orange)]" : "text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"}`}>
                  @{name}
                </button>
              ))
            )}
          </div>
        )}

        {/* Emoji panel */}
        {showEmoji && (
          <div ref={emojiRef}
            className="absolute bottom-full left-0 right-0 mx-3 mb-1 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[10px] p-2 shadow-xl z-50">
            <div className="grid grid-cols-10 gap-0.5">
              {DEFAULT_EMOJIS.map(emoji => (
                <button key={emoji} onClick={() => { setText(p => p + emoji); inputRef.current?.focus(); }}
                  className="w-7 h-7 flex items-center justify-center text-[1.1rem] rounded-[6px] hover:bg-[var(--bg-elevated)] transition-colors">
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Reply bar */}
        {replyTo && (
          <div className="flex items-center gap-2 px-3 pt-2 pb-0.5">
            <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-[0.75rem] min-w-0"
              style={{ borderLeft: "2px solid var(--accent-orange)", background: "var(--bg-elevated)" }}>
              <Reply size={11} className="text-[var(--accent-orange)] shrink-0" />
              <span className="font-semibold text-[var(--accent-orange)] shrink-0">{replyTo.userName}</span>
              <span className="text-[var(--text-muted)] truncate">
                {replyTo.text.length > 50 ? replyTo.text.slice(0, 50) + "…" : replyTo.text}
              </span>
            </div>
            <button onClick={() => setReplyTo(null)}
              className="shrink-0 p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              <X size={13} />
            </button>
          </div>
        )}

        {/* Banned / Muted notice */}
        {(isSelfBanned || isSelfMuted) && (
          <div className="px-3 py-1.5 text-[0.75rem] font-semibold text-center"
            style={{ background: isSelfBanned ? "rgba(239,68,68,0.1)" : "rgba(234,179,8,0.1)",
                     color: isSelfBanned ? "#f87171" : "#fbbf24" }}>
            {isSelfBanned ? "You have been banned from this chat" : "You are muted and cannot send messages"}
          </div>
        )}

        <div className="flex items-center gap-1.5 px-3 py-2.5">
          <button onClick={() => { setShowEmoji(v => !v); setMentionQuery(null); }}
            className={`p-1.5 rounded-[7px] transition-colors shrink-0 ${showEmoji ? "bg-[var(--bg-elevated)] text-[var(--accent-orange)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}>
            <Smile size={16} />
          </button>

          {(isStreamOwner || isCurrentUserMod) && (
            <button onClick={toggleTts} title={ttsEnabled ? "Enable TTS" : "Disable TTS"}
              className={`p-1.5 rounded-[7px] transition-colors shrink-0 ${ttsEnabled ? "bg-[var(--bg-elevated)] text-[var(--accent-orange)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}>
              {ttsEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            </button>
          )}

          <input
            ref={inputRef}
            disabled={isSelfBanned || isSelfMuted}
            className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[8px] px-3 py-[0.4rem] text-[0.8125rem] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-pink-500/40 transition-colors disabled:opacity-40"
            placeholder={isSelfBanned ? "You are banned" : isSelfMuted ? "You are muted" : "Say something… (@ to mention)"}
            value={text}
            maxLength={200}
            onChange={e => handleChange(e.target.value)}
            onKeyDown={e => {
              if (mentionQuery !== null && mentionMatches.length > 0) {
                if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, mentionMatches.length - 1)); return; }
                if (e.key === "ArrowUp")   { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)); return; }
                if (e.key === "Tab" || (e.key === "Enter" && mentionQuery !== "")) {
                  e.preventDefault();
                  insertMention(mentionMatches[mentionIndex] ?? mentionMatches[0]);
                  return;
                }
              }
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              if (e.key === "Escape") { setShowEmoji(false); setReplyTo(null); setMentionQuery(null); }
            }}
          />

          <button onClick={send} disabled={!text.trim() || sending || isSelfBanned || isSelfMuted}
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--accent-orange)] text-white disabled:opacity-30 transition-opacity hover:opacity-80 shrink-0">
            <Send size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
