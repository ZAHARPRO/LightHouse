"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { FileText, Edit2, Trash2, X, Check, Crown, ChevronUp } from "lucide-react";
import { updatePost, deletePost } from "@/actions/posts";

type Post = {
  id: string; title: string; content: string;
  isPremium: boolean; createdAt: Date;
};

export default function PostManager({ initialPosts }: { initialPosts: Post[] }) {
  const [posts, setPosts]         = useState(initialPosts);
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [success, setSuccess]     = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);

  function flash(msg: string, type: "ok" | "err") {
    if (type === "ok") { setSuccess(msg); setTimeout(() => setSuccess(null), 2500); }
    else               { setError(msg);   setTimeout(() => setError(null),   3000); }
  }

  function handleSave(postId: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updatePost(postId, fd);
      if (res && "error" in res) { flash(res.error, "err"); return; }
      setPosts(ps => ps.map(p =>
        p.id !== postId ? p : {
          ...p,
          title:     (fd.get("title") as string)?.trim() || p.title,
          content:   (fd.get("content") as string)?.trim() || p.content,
          isPremium: fd.get("isPremium") === "on",
        }
      ));
      setExpanded(null);
      flash("Post updated", "ok");
    });
  }

  function handleDelete(postId: string) {
    startTransition(async () => {
      const res = await deletePost(postId);
      if (res && "error" in res) { flash(res.error, "err"); return; }
      setPosts(ps => ps.filter(p => p.id !== postId));
      setConfirmDel(null);
      flash("Post deleted", "ok");
    });
  }

  if (posts.length === 0) return (
    <div className="card" style={{ padding: "3rem", textAlign: "center" }}>
      <FileText size={32} color="var(--text-muted)" style={{ margin: "0 auto 1rem" }} />
      <p style={{ color: "var(--text-secondary)", marginBottom: "1.25rem" }}>No posts yet</p>
      <Link href="/post/new" className="btn-primary" style={{ textDecoration: "none", padding: "0.5rem 1.25rem" }}>
        Write First Post
      </Link>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>

      {success && (
        <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", padding:"0.75rem 1rem", borderRadius:8, background:"rgba(16,185,129,0.08)", border:"1px solid rgba(16,185,129,0.25)", color:"#10b981", fontSize:"0.875rem" }}>
          <Check size={14}/> {success}
        </div>
      )}
      {error && (
        <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", padding:"0.75rem 1rem", borderRadius:8, background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.25)", color:"#ef4444", fontSize:"0.875rem" }}>
          <X size={14}/> {error}
        </div>
      )}

      {posts.map((post) => {
        const isOpen = expanded === post.id;
        const isDel  = confirmDel === post.id;

        return (
          <div key={post.id} style={{ background:"var(--bg-card)", border:"1px solid var(--border-subtle)", borderRadius:12, overflow:"hidden" }}>
            {/* Row */}
            <div style={{ display:"flex", alignItems:"center", gap:"0.875rem", padding:"1rem" }}>
              <div style={{ width:38, height:38, borderRadius:8, flexShrink:0, background:"rgba(249,115,22,0.08)", border:"1px solid rgba(249,115,22,0.15)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <FileText size={16} color="var(--accent-orange)"/>
              </div>

              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:"0.5rem" }}>
                  <Link href={`/post/${post.id}`} style={{ fontFamily:"var(--font-display)", fontWeight:700, fontSize:"0.9rem", color:"var(--text-primary)", textDecoration:"none", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:360 }}>
                    {post.title}
                  </Link>
                  {post.isPremium && <Crown size={12} color="#fbbf24"/>}
                </div>
                <p style={{ fontSize:"0.75rem", color:"var(--text-muted)", marginTop:"0.2rem" }}>
                  {new Date(post.createdAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
                  {" · "}
                  {post.content.slice(0, 60)}{post.content.length > 60 ? "…" : ""}
                </p>
              </div>

              <div style={{ display:"flex", gap:"0.375rem", flexShrink:0 }}>
                <button onClick={() => { setExpanded(e => e===post.id ? null : post.id); setConfirmDel(null); }}
                  style={btnStyle(isOpen ? "orange" : "default")} title="Edit">
                  {isOpen ? <ChevronUp size={14}/> : <Edit2 size={14}/>}
                </button>
                <button onClick={() => { setConfirmDel(d => d===post.id ? null : post.id); setExpanded(null); }}
                  style={btnStyle(isDel ? "red" : "default")} title="Delete">
                  <Trash2 size={14}/>
                </button>
              </div>
            </div>

            {/* Edit form */}
            {isOpen && (
              <form onSubmit={(e) => handleSave(post.id, e)}
                style={{ borderTop:"1px solid var(--border-subtle)", padding:"1.25rem 1rem", display:"flex", flexDirection:"column", gap:"0.875rem", background:"var(--bg-elevated)" }}>
                <div>
                  <Label>Title *</Label>
                  <input name="title" defaultValue={post.title} required className="input-field" style={{ height:38 }}/>
                </div>
                <div>
                  <Label>Content *</Label>
                  <textarea name="content" defaultValue={post.content} required rows={6} className="input-field" style={{ resize:"vertical", lineHeight:1.65 }}/>
                </div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <label style={{ display:"flex", alignItems:"center", gap:"0.5rem", cursor:"pointer", fontSize:"0.875rem", color:"var(--text-secondary)" }}>
                    <input type="checkbox" name="isPremium" defaultChecked={post.isPremium} style={{ accentColor:"var(--accent-orange)", width:15, height:15 }}/>
                    <Crown size={13} color="var(--accent-orange)"/> Premium
                  </label>
                  <div style={{ display:"flex", gap:"0.5rem" }}>
                    <button type="button" onClick={() => setExpanded(null)} style={btnStyle("default")}><X size={13}/> Cancel</button>
                    <button type="submit" disabled={pending} style={btnStyle("orange")}><Check size={13}/> {pending ? "Saving…" : "Save"}</button>
                  </div>
                </div>
              </form>
            )}

            {/* Delete confirm */}
            {isDel && (
              <div style={{ borderTop:"1px solid var(--border-subtle)", padding:"1rem", display:"flex", alignItems:"center", justifyContent:"space-between", background:"rgba(239,68,68,0.05)", flexWrap:"wrap", gap:"0.5rem" }}>
                <span style={{ fontSize:"0.875rem", color:"var(--text-secondary)" }}>Delete <b style={{ color:"var(--text-primary)" }}>{post.title}</b>? This can't be undone.</span>
                <div style={{ display:"flex", gap:"0.5rem" }}>
                  <button onClick={() => setConfirmDel(null)} style={btnStyle("default")}><X size={13}/> Cancel</button>
                  <button onClick={() => handleDelete(post.id)} disabled={pending} style={btnStyle("red")}><Trash2 size={13}/> {pending ? "…" : "Delete"}</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p style={{ fontFamily:"var(--font-display)", fontWeight:600, fontSize:"0.75rem", color:"var(--text-muted)", marginBottom:"0.375rem" }}>{children}</p>;
}

function btnStyle(variant: "default"|"orange"|"red"): React.CSSProperties {
  const base: React.CSSProperties = {
    display:"flex", alignItems:"center", gap:"0.3rem",
    padding:"0.375rem 0.625rem", borderRadius:7, cursor:"pointer",
    fontFamily:"var(--font-display)", fontWeight:600, fontSize:"0.8rem",
    transition:"all 0.15s", border:"1px solid",
  };
  if (variant==="orange") return { ...base, background:"rgba(249,115,22,0.12)", borderColor:"rgba(249,115,22,0.35)", color:"var(--accent-orange)" };
  if (variant==="red")    return { ...base, background:"rgba(239,68,68,0.1)",    borderColor:"rgba(239,68,68,0.3)",    color:"#ef4444" };
  return { ...base, background:"var(--bg-elevated)", borderColor:"var(--border-subtle)", color:"var(--text-secondary)" };
}
