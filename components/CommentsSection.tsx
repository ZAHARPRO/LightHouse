"use client";

import { useState, useTransition } from "react";
import { ThumbsUp, Pin, PinOff, Reply, ChevronDown, ChevronUp, Send } from "lucide-react";
import { addComment, toggleCommentLike, togglePinComment } from "@/actions/comments";

type Author = { id: string; name: string | null };

type ReplyData = {
  id: string; content: string; createdAt: Date;
  author: Author; likeCount: number; userLiked: boolean;
  replyToName: string | null;
};

type CommentData = {
  id: string; content: string; createdAt: Date; isPinned: boolean;
  author: Author; likeCount: number; userLiked: boolean;
  replies: ReplyData[];
};

interface Props {
  videoId: string;
  videoAuthorId: string;
  currentUserId: string | null;
  initialComments: CommentData[];
}

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function sortComments(comments: CommentData[]): CommentData[] {
  return [...comments].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    if (b.likeCount !== a.likeCount) return b.likeCount - a.likeCount;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

export default function CommentsSection({ videoId, videoAuthorId, currentUserId, initialComments }: Props) {
  const [comments, setComments] = useState<CommentData[]>(initialComments);
  const [text, setText]         = useState("");
  const [pending, start]        = useTransition();
  const [error, setError]       = useState<string | null>(null);

  const sorted = sortComments(comments);
  const total  = comments.length + comments.reduce((s, c) => s + c.replies.length, 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    const content = text.trim();
    setText("");
    start(async () => {
      const res = await addComment(videoId, content);
      if (res && "error" in res) { setError(res.error ?? null); return; }
      if (res.comment) {
        const c = res.comment as typeof res.comment & { id: string; content: string; createdAt: Date; author: Author };
        setComments(prev => sortComments([...prev, {
          id: c.id, content: c.content, createdAt: c.createdAt,
          isPinned: false, author: c.author,
          likeCount: 0, userLiked: false, replies: [],
        }]));
      }
    });
  }

  function handleLike(commentId: string) {
    if (!currentUserId) return;
    setComments(prev => sortComments(prev.map(c =>
      c.id !== commentId ? c : {
        ...c,
        userLiked: !c.userLiked,
        likeCount: c.userLiked ? c.likeCount - 1 : c.likeCount + 1,
      }
    )));
    start(async () => { await toggleCommentLike(commentId, videoId); });
  }

  function handleReplyLike(commentId: string, replyId: string) {
    if (!currentUserId) return;
    setComments(prev => sortComments(prev.map(c =>
      c.id !== commentId ? c : {
        ...c,
        replies: c.replies.map(r =>
          r.id !== replyId ? r : {
            ...r,
            userLiked: !r.userLiked,
            likeCount: r.userLiked ? r.likeCount - 1 : r.likeCount + 1,
          }
        ),
      }
    )));
    start(async () => { await toggleCommentLike(replyId, videoId); });
  }

  function handlePin(commentId: string) {
    setComments(prev => sortComments(prev.map(c => ({
      ...c,
      isPinned: c.id === commentId ? !c.isPinned : false,
    }))));
    start(async () => { await togglePinComment(commentId, videoId); });
  }

  function handleAddReply(commentId: string, reply: ReplyData) {
    setComments(prev => prev.map(c =>
      c.id !== commentId ? c : { ...c, replies: [...c.replies, reply] }
    ));
  }

  return (
    <div style={{ marginTop: "2rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.125rem" }}>
          Comments
        </h2>
        <span style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>({total})</span>
      </div>

      {/* New comment form */}
      {currentUserId ? (
        <form onSubmit={handleSubmit} style={{ marginBottom: "1.5rem" }}>
          {error && <p style={{ color: "#ef4444", fontSize: "0.8rem", marginBottom: "0.5rem" }}>{error}</p>}
          <div style={{ display: "flex", gap: "0.625rem" }}>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Write a comment…"
              rows={2}
              maxLength={2000}
              className="input-field"
              style={{ flex: 1, resize: "none", lineHeight: 1.6 }}
            />
            <button type="submit" disabled={pending || !text.trim()} style={{
              alignSelf: "flex-end", padding: "0.5rem 1rem", borderRadius: 8,
              background: "var(--accent-orange)", border: "none", cursor: pending ? "not-allowed" : "pointer",
              color: "white", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.875rem",
              display: "flex", alignItems: "center", gap: "0.375rem",
              opacity: pending || !text.trim() ? 0.5 : 1,
            }}>
              <Send size={14} /> Post
            </button>
          </div>
        </form>
      ) : (
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
          Sign in to leave a comment.
        </p>
      )}

      {/* Comments list */}
      {sorted.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>No comments yet. Be the first!</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
          {sorted.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              videoId={videoId}
              videoAuthorId={videoAuthorId}
              currentUserId={currentUserId}
              isVideoAuthor={currentUserId === videoAuthorId}
              onLike={() => handleLike(comment.id)}
              onPin={() => handlePin(comment.id)}
              onAddReply={(reply) => handleAddReply(comment.id, reply)}
              onReplyLike={(replyId) => handleReplyLike(comment.id, replyId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Single comment ─── */

function CommentItem({
  comment, videoId, videoAuthorId, currentUserId,
  isVideoAuthor, onLike, onPin, onAddReply, onReplyLike,
}: {
  comment: CommentData;
  videoId: string;
  videoAuthorId: string;
  currentUserId: string | null;
  isVideoAuthor: boolean;
  onLike: () => void;
  onPin: () => void;
  onAddReply: (r: ReplyData) => void;
  onReplyLike: (replyId: string) => void;
}) {
  const [repliesOpen, setRepliesOpen]   = useState(false);
  const [replyTo, setReplyTo]           = useState<{ name: string } | null>(null);
  const [replyText, setReplyText]       = useState("");
  const [pending, start]                = useTransition();
  const isAuthorComment = comment.author.id === videoAuthorId;

  function openReply(toName?: string) {
    setReplyTo(toName ? { name: toName } : null);
    setReplyText("");
  }

  function closeReply() {
    setReplyTo(null);
    setReplyText("");
  }

  function submitReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyText.trim()) return;
    const content     = replyText.trim();
    const replyToName = replyTo?.name ?? undefined;
    closeReply();
    start(async () => {
      const res = await addComment(videoId, content, comment.id, replyToName);
      if (res && "comment" in res) {
        const r = res.comment as typeof res.comment & { id: string; content: string; createdAt: Date; author: Author };
        onAddReply({ id: r.id, content: r.content, createdAt: r.createdAt, author: r.author, likeCount: 0, userLiked: false, replyToName: replyToName ?? null });
        setRepliesOpen(true);
      }
    });
  }

  return (
    <div style={{
      padding: "1rem 0",
      borderBottom: "1px solid var(--border-subtle)",
    }}>
      {/* Pin indicator */}
      {comment.isPinned && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.5rem", color: "var(--accent-orange)", fontSize: "0.75rem", fontFamily: "var(--font-display)", fontWeight: 700 }}>
          <Pin size={11} /> Pinned comment
        </div>
      )}

      {/* Main comment */}
      <div style={{
        borderRadius: 10,
        padding: "0.875rem 1rem",
        background: isAuthorComment ? "rgba(249,115,22,0.05)" : "transparent",
        border: isAuthorComment ? "1px solid rgba(249,115,22,0.15)" : "1px solid transparent",
      }}>
        {/* Author row */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.5rem" }}>
          <div style={{
            width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
            background: isAuthorComment ? "rgba(249,115,22,0.15)" : "var(--bg-elevated)",
            border: isAuthorComment ? "1.5px solid rgba(249,115,22,0.4)" : "1.5px solid var(--border-default)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "0.6875rem",
            color: isAuthorComment ? "var(--accent-orange)" : "var(--text-secondary)",
          }}>
            {(comment.author.name ?? "?")[0].toUpperCase()}
          </div>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.875rem", color: "var(--text-primary)" }}>
            {comment.author.name}
          </span>
          {isAuthorComment && (
            <span style={{ fontSize: "0.6875rem", fontWeight: 700, padding: "0.1rem 0.5rem", borderRadius: 100, background: "rgba(249,115,22,0.12)", color: "var(--accent-orange)", border: "1px solid rgba(249,115,22,0.25)", fontFamily: "var(--font-display)" }}>
              Creator
            </span>
          )}
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "auto" }}>
            {timeAgo(comment.createdAt)}
          </span>
        </div>

        {/* Content */}
        <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", lineHeight: 1.65, marginBottom: "0.625rem", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {comment.content}
        </p>

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {/* Like */}
          <button
            onClick={onLike}
            disabled={!currentUserId}
            style={{
              display: "flex", alignItems: "center", gap: "0.3rem",
              padding: "0.25rem 0.5rem", borderRadius: 6, border: "none",
              background: comment.userLiked ? "rgba(249,115,22,0.1)" : "transparent",
              color: comment.userLiked ? "var(--accent-orange)" : "var(--text-muted)",
              cursor: currentUserId ? "pointer" : "default", fontSize: "0.8rem",
              fontFamily: "var(--font-display)", fontWeight: 600,
              transition: "all 0.15s",
            }}
          >
            <ThumbsUp size={13} fill={comment.userLiked ? "currentColor" : "none"} />
            {comment.likeCount > 0 && comment.likeCount}
          </button>

          {/* Reply */}
          {currentUserId && (
            <button
              onClick={() => replyTo === null ? openReply() : closeReply()}
              style={{
                display: "flex", alignItems: "center", gap: "0.3rem",
                padding: "0.25rem 0.5rem", borderRadius: 6, border: "none",
                background: "transparent", color: "var(--text-muted)",
                cursor: "pointer", fontSize: "0.8rem",
                fontFamily: "var(--font-display)", fontWeight: 600,
              }}
            >
              <Reply size={13} /> Reply
            </button>
          )}

          {/* Pin (video author only) */}
          {isVideoAuthor && (
            <button
              onClick={onPin}
              title={comment.isPinned ? "Unpin" : "Pin"}
              style={{
                marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.3rem",
                padding: "0.25rem 0.5rem", borderRadius: 6, border: "none",
                background: comment.isPinned ? "rgba(249,115,22,0.1)" : "transparent",
                color: comment.isPinned ? "var(--accent-orange)" : "var(--text-muted)",
                cursor: "pointer", fontSize: "0.75rem",
                fontFamily: "var(--font-display)", fontWeight: 600,
              }}
            >
              {comment.isPinned ? <PinOff size={12} /> : <Pin size={12} />}
              {comment.isPinned ? "Unpin" : "Pin"}
            </button>
          )}
        </div>

        {/* Reply form */}
        {replyTo !== null && (
          <form onSubmit={submitReply} style={{ marginTop: "0.75rem" }}>
            {replyTo.name && (
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.375rem", fontFamily: "var(--font-display)", fontWeight: 600 }}>
                Replying to <span style={{ color: "var(--accent-orange)" }}>@{replyTo.name}</span>
              </p>
            )}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder={replyTo.name ? `Reply to @${replyTo.name}…` : "Write a reply…"}
                rows={2}
                maxLength={2000}
                autoFocus
                className="input-field"
                style={{ flex: 1, resize: "none", fontSize: "0.875rem", lineHeight: 1.5 }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <button type="submit" disabled={pending || !replyText.trim()} style={{
                  padding: "0.375rem 0.75rem", borderRadius: 7,
                  background: "var(--accent-orange)", border: "none",
                  color: "white", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.8125rem",
                  cursor: pending || !replyText.trim() ? "not-allowed" : "pointer",
                  opacity: pending || !replyText.trim() ? 0.5 : 1,
                  display: "flex", alignItems: "center", gap: "0.25rem",
                }}>
                  <Send size={12} /> Post
                </button>
                <button type="button" onClick={closeReply} style={{
                  padding: "0.375rem 0.75rem", borderRadius: 7,
                  background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
                  color: "var(--text-muted)", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.8125rem",
                  cursor: "pointer",
                }}>
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Replies toggle */}
      {comment.replies.length > 0 && (
        <div style={{ paddingLeft: "1rem", marginTop: "0.375rem" }}>
          <button
            onClick={() => setRepliesOpen(o => !o)}
            style={{
              display: "flex", alignItems: "center", gap: "0.375rem",
              background: "none", border: "none", cursor: "pointer",
              color: "var(--accent-orange)", fontFamily: "var(--font-display)",
              fontWeight: 700, fontSize: "0.8125rem", padding: "0.25rem 0",
            }}
          >
            {repliesOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {comment.replies.length} {comment.replies.length === 1 ? "reply" : "replies"}
          </button>

          {repliesOpen && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0", paddingLeft: "0.75rem", borderLeft: "2px solid var(--border-subtle)", marginTop: "0.5rem" }}>
              {[...comment.replies]
                .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                .map(reply => (
                  <div key={reply.id} style={{ padding: "0.75rem 0.875rem", borderBottom: "1px solid var(--border-subtle)" }}>
                    {/* Author */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.375rem" }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                        background: reply.author.id === videoAuthorId ? "rgba(249,115,22,0.15)" : "var(--bg-elevated)",
                        border: reply.author.id === videoAuthorId ? "1.5px solid rgba(249,115,22,0.4)" : "1.5px solid var(--border-subtle)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "0.5625rem",
                        color: reply.author.id === videoAuthorId ? "var(--accent-orange)" : "var(--text-secondary)",
                      }}>
                        {(reply.author.name ?? "?")[0].toUpperCase()}
                      </div>
                      <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.8125rem", color: "var(--text-primary)" }}>
                        {reply.author.name}
                      </span>
                      {reply.author.id === videoAuthorId && (
                        <span style={{ fontSize: "0.625rem", fontWeight: 700, padding: "0.1rem 0.4rem", borderRadius: 100, background: "rgba(249,115,22,0.12)", color: "var(--accent-orange)", border: "1px solid rgba(249,115,22,0.25)", fontFamily: "var(--font-display)" }}>
                          Creator
                        </span>
                      )}
                      <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginLeft: "auto" }}>
                        {timeAgo(reply.createdAt)}
                      </span>
                    </div>
                    {/* Content */}
                    <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "0.375rem", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {reply.replyToName && (
                        <span style={{ color: "var(--accent-orange)", fontWeight: 700, marginRight: "0.25rem" }}>
                          @{reply.replyToName}
                        </span>
                      )}
                      {reply.content}
                    </p>
                    {/* Actions */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                      <button
                        onClick={() => onReplyLike(reply.id)}
                        disabled={!currentUserId}
                        style={{
                          display: "flex", alignItems: "center", gap: "0.3rem",
                          padding: "0.2rem 0.4rem", borderRadius: 5, border: "none",
                          background: reply.userLiked ? "rgba(249,115,22,0.1)" : "transparent",
                          color: reply.userLiked ? "var(--accent-orange)" : "var(--text-muted)",
                          cursor: currentUserId ? "pointer" : "default", fontSize: "0.75rem",
                          fontFamily: "var(--font-display)", fontWeight: 600,
                        }}
                      >
                        <ThumbsUp size={11} fill={reply.userLiked ? "currentColor" : "none"} />
                        {reply.likeCount > 0 && reply.likeCount}
                      </button>
                      {currentUserId && (
                        <button
                          onClick={() => openReply(reply.author.name ?? undefined)}
                          style={{
                            display: "flex", alignItems: "center", gap: "0.25rem",
                            padding: "0.2rem 0.4rem", borderRadius: 5, border: "none",
                            background: "transparent", color: "var(--text-muted)",
                            cursor: "pointer", fontSize: "0.75rem",
                            fontFamily: "var(--font-display)", fontWeight: 600,
                          }}
                        >
                          <Reply size={11} /> Reply
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
