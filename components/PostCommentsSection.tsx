"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ThumbsUp, Pin, PinOff, Reply, ChevronDown, ChevronUp, Send } from "lucide-react";
import { addPostComment, togglePostCommentLike, togglePinPostComment } from "@/actions/postComments";

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
  postId: string;
  postAuthorId: string;
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

export default function PostCommentsSection({ postId, postAuthorId, currentUserId, initialComments }: Props) {
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
      const res = await addPostComment(postId, content);
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
      c.id !== commentId ? c : { ...c, userLiked: !c.userLiked, likeCount: c.userLiked ? c.likeCount - 1 : c.likeCount + 1 }
    )));
    start(async () => { await togglePostCommentLike(commentId, postId); });
  }

  function handleReplyLike(commentId: string, replyId: string) {
    if (!currentUserId) return;
    setComments(prev => sortComments(prev.map(c =>
      c.id !== commentId ? c : {
        ...c,
        replies: c.replies.map(r =>
          r.id !== replyId ? r : { ...r, userLiked: !r.userLiked, likeCount: r.userLiked ? r.likeCount - 1 : r.likeCount + 1 }
        ),
      }
    )));
    start(async () => { await togglePostCommentLike(replyId, postId); });
  }

  function handlePin(commentId: string) {
    setComments(prev => sortComments(prev.map(c => ({ ...c, isPinned: c.id === commentId ? !c.isPinned : false }))));
    start(async () => { await togglePinPostComment(commentId, postId); });
  }

  function handleAddReply(commentId: string, reply: ReplyData) {
    setComments(prev => prev.map(c =>
      c.id !== commentId ? c : { ...c, replies: [...c.replies, reply] }
    ));
  }

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-5">
        <h2 className="font-display font-extrabold text-lg">Comments</h2>
        <span className="text-[var(--text-muted)] text-sm">({total})</span>
      </div>

      {currentUserId ? (
        <form onSubmit={handleSubmit} className="mb-6">
          {error && <p className="text-red-500 text-[0.8rem] mb-2">{error}</p>}
          <div className="flex gap-[0.625rem]">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Write a comment…"
              rows={2}
              maxLength={2000}
              className="input-field flex-1 leading-relaxed"
              style={{ resize: "none" }}
            />
            <button
              type="submit"
              disabled={pending || !text.trim()}
              className={[
                "self-end flex items-center gap-[0.375rem] px-4 py-2 rounded-lg",
                "bg-[var(--accent-orange)] border-none text-white font-display font-semibold text-sm",
                pending || !text.trim() ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
              ].join(" ")}
            >
              <Send size={14} /> Post
            </button>
          </div>
        </form>
      ) : (
        <p className="text-[var(--text-muted)] text-sm mb-6">Sign in to leave a comment.</p>
      )}

      {sorted.length === 0 ? (
        <p className="text-[var(--text-muted)] text-sm">No comments yet. Be the first!</p>
      ) : (
        <div className="flex flex-col">
          {sorted.map((comment) => (
            <PostCommentItem
              key={comment.id}
              comment={comment}
              postId={postId}
              postAuthorId={postAuthorId}
              currentUserId={currentUserId}
              isPostAuthor={currentUserId === postAuthorId}
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

function PostCommentItem({
  comment, postId, postAuthorId, currentUserId,
  isPostAuthor, onLike, onPin, onAddReply, onReplyLike,
}: {
  comment: CommentData;
  postId: string;
  postAuthorId: string;
  currentUserId: string | null;
  isPostAuthor: boolean;
  onLike: () => void;
  onPin: () => void;
  onAddReply: (r: ReplyData) => void;
  onReplyLike: (replyId: string) => void;
}) {
  const [repliesOpen, setRepliesOpen] = useState(false);
  const [replyTo, setReplyTo]         = useState<{ name: string } | null>(null);
  const [replyText, setReplyText]     = useState("");
  const [pending, start]              = useTransition();
  const isAuthorComment = comment.author.id === postAuthorId;

  function openReply(toName?: string) { setReplyTo({ name: toName ?? "" }); setReplyText(""); }
  function closeReply() { setReplyTo(null); setReplyText(""); }

  function submitReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyText.trim()) return;
    const content     = replyText.trim();
    const replyToName = replyTo?.name ?? undefined;
    closeReply();
    start(async () => {
      const res = await addPostComment(postId, content, comment.id, replyToName);
      if (res && "comment" in res) {
        const r = res.comment as typeof res.comment & { id: string; content: string; createdAt: Date; author: Author };
        onAddReply({ id: r.id, content: r.content, createdAt: r.createdAt, author: r.author, likeCount: 0, userLiked: false, replyToName: replyToName ?? null });
        setRepliesOpen(true);
      }
    });
  }

  return (
    <div className="py-4 border-b border-[var(--border-subtle)]">
      {comment.isPinned && (
        <div className="flex items-center gap-[0.375rem] mb-2 text-[var(--accent-orange)] text-xs font-display font-bold">
          <Pin size={11} /> Pinned comment
        </div>
      )}

      <div className={[
        "rounded-[10px] px-4 py-[0.875rem]",
        isAuthorComment
          ? "bg-orange-500/[0.05] border border-orange-500/15"
          : "bg-transparent border border-transparent",
      ].join(" ")}>
        <div className="flex items-center gap-[0.625rem] mb-2">
          <Link href={`/profile/${comment.author.id}`} className={[
            "w-[30px] h-[30px] rounded-full shrink-0 flex items-center justify-center font-display font-extrabold text-[0.6875rem]",
            isAuthorComment
              ? "bg-orange-500/15 border-[1.5px] border-orange-500/40 text-[var(--accent-orange)]"
              : "bg-[var(--bg-elevated)] border-[1.5px] border-[var(--border-default)] text-[var(--text-secondary)]",
          ].join(" ")}>
            {(comment.author.name ?? "?")[0].toUpperCase()}
          </Link>
          <Link href={`/profile/${comment.author.id}`} className="font-display font-bold text-sm text-[var(--text-primary)]">
            {comment.author.name}
          </Link>
          {isAuthorComment && (
            <span className="text-[0.6875rem] font-bold px-2 py-[0.1rem] rounded-full bg-orange-500/10 text-[var(--accent-orange)] border border-orange-500/25 font-display">
              Author
            </span>
          )}
          <span className="text-xs text-[var(--text-muted)] ml-auto">{timeAgo(comment.createdAt)}</span>
        </div>

        <p className="text-[0.9rem] text-[var(--text-secondary)] leading-[1.65] mb-[0.625rem] whitespace-pre-wrap break-words">
          {comment.content}
        </p>

        <div className="flex items-center gap-2">
          <button
            onClick={onLike}
            disabled={!currentUserId}
            className={[
              "flex items-center gap-[0.3rem] px-2 py-1 rounded-md border-none font-display font-semibold text-[0.8rem] transition-all duration-150",
              comment.userLiked ? "bg-orange-500/10 text-[var(--accent-orange)]" : "bg-transparent text-[var(--text-muted)]",
              currentUserId ? "cursor-pointer" : "cursor-default",
            ].join(" ")}
          >
            <ThumbsUp size={13} fill={comment.userLiked ? "currentColor" : "none"} />
            {comment.likeCount > 0 && comment.likeCount}
          </button>

          {currentUserId && (
            <button
              onClick={() => replyTo === null ? openReply() : closeReply()}
              className="flex items-center gap-[0.3rem] px-2 py-1 rounded-md border-none bg-transparent text-[var(--text-muted)] cursor-pointer font-display font-semibold text-[0.8rem]"
            >
              <Reply size={13} /> Reply
            </button>
          )}

          {isPostAuthor && (
            <button
              onClick={onPin}
              title={comment.isPinned ? "Unpin" : "Pin"}
              className={[
                "ml-auto flex items-center gap-[0.3rem] px-2 py-1 rounded-md border-none font-display font-semibold text-xs cursor-pointer",
                comment.isPinned ? "bg-orange-500/10 text-[var(--accent-orange)]" : "bg-transparent text-[var(--text-muted)]",
              ].join(" ")}
            >
              {comment.isPinned ? <PinOff size={12} /> : <Pin size={12} />}
              {comment.isPinned ? "Unpin" : "Pin"}
            </button>
          )}
        </div>

        {replyTo !== null && (
          <form onSubmit={submitReply} className="mt-3">
            {replyTo.name && (
              <p className="text-xs text-[var(--text-muted)] mb-[0.375rem] font-display font-semibold">
                Replying to <span className="text-[var(--accent-orange)]">@{replyTo.name}</span>
              </p>
            )}
            <div className="flex gap-2">
              <textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder={replyTo.name ? `Reply to @${replyTo.name}…` : "Write a reply…"}
                rows={2}
                maxLength={2000}
                autoFocus
                className="input-field flex-1 text-sm leading-snug"
                style={{ resize: "none" }}
              />
              <div className="flex flex-col gap-[0.375rem]">
                <button
                  type="submit"
                  disabled={pending || !replyText.trim()}
                  className={[
                    "flex items-center gap-1 px-3 py-[0.375rem] rounded-[7px]",
                    "bg-[var(--accent-orange)] border-none text-white font-display font-semibold text-[0.8125rem]",
                    pending || !replyText.trim() ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                  ].join(" ")}
                >
                  <Send size={12} /> Post
                </button>
                <button
                  type="button"
                  onClick={closeReply}
                  className="px-3 py-[0.375rem] rounded-[7px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] font-display font-semibold text-[0.8125rem] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {comment.replies.length > 0 && (
        <div className="pl-4 mt-[0.375rem]">
          <button
            onClick={() => setRepliesOpen(o => !o)}
            className="flex items-center gap-[0.375rem] bg-transparent border-none cursor-pointer text-[var(--accent-orange)] font-display font-bold text-[0.8125rem] py-1"
          >
            {repliesOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {comment.replies.length} {comment.replies.length === 1 ? "reply" : "replies"}
          </button>

          {repliesOpen && (
            <div className="flex flex-col pl-3 border-l-2 border-[var(--border-subtle)] mt-2">
              {[...comment.replies]
                .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                .map(reply => {
                  const isReplyAuthor = reply.author.id === postAuthorId;
                  return (
                    <div key={reply.id} className="py-3 px-[0.875rem] border-b border-[var(--border-subtle)]">
                      <div className="flex items-center gap-2 mb-[0.375rem]">
                        <Link href={`/profile/${reply.author.id}`} className={[
                          "w-6 h-6 rounded-full shrink-0 flex items-center justify-center font-display font-extrabold text-[0.5625rem]",
                          isReplyAuthor
                            ? "bg-orange-500/15 border-[1.5px] border-orange-500/40 text-[var(--accent-orange)]"
                            : "bg-[var(--bg-elevated)] border-[1.5px] border-[var(--border-subtle)] text-[var(--text-secondary)]",
                        ].join(" ")}>
                          {(reply.author.name ?? "?")[0].toUpperCase()}
                        </Link>
                        <Link href={`/profile/${reply.author.id}`} className="font-display font-bold text-[0.8125rem] text-[var(--text-primary)]">
                          {reply.author.name}
                        </Link>
                        {isReplyAuthor && (
                          <span className="text-[0.625rem] font-bold px-[0.4rem] py-[0.1rem] rounded-full bg-orange-500/10 text-[var(--accent-orange)] border border-orange-500/25 font-display">
                            Author
                          </span>
                        )}
                        <span className="text-[0.6875rem] text-[var(--text-muted)] ml-auto">
                          {timeAgo(reply.createdAt)}
                        </span>
                      </div>

                      <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-[0.375rem] whitespace-pre-wrap break-words">
                        {reply.replyToName && (
                          <span className="text-[var(--accent-orange)] font-bold mr-1">@{reply.replyToName}</span>
                        )}
                        {reply.content}
                      </p>

                      <div className="flex items-center gap-[0.375rem]">
                        <button
                          onClick={() => onReplyLike(reply.id)}
                          disabled={!currentUserId}
                          className={[
                            "flex items-center gap-[0.3rem] px-[0.4rem] py-[0.2rem] rounded-[5px] border-none font-display font-semibold text-xs",
                            reply.userLiked ? "bg-orange-500/10 text-[var(--accent-orange)]" : "bg-transparent text-[var(--text-muted)]",
                            currentUserId ? "cursor-pointer" : "cursor-default",
                          ].join(" ")}
                        >
                          <ThumbsUp size={11} fill={reply.userLiked ? "currentColor" : "none"} />
                          {reply.likeCount > 0 && reply.likeCount}
                        </button>
                        {currentUserId && (
                          <button
                            onClick={() => openReply(reply.author.name ?? undefined)}
                            className="flex items-center gap-1 px-[0.4rem] py-[0.2rem] rounded-[5px] border-none bg-transparent text-[var(--text-muted)] cursor-pointer font-display font-semibold text-xs"
                          >
                            <Reply size={11} /> Reply
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
