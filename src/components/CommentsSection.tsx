'use client';

import React, { useState, useEffect } from 'react';
import { MessageSquare, Trash2, Send, LogIn, ThumbsUp, Heart, Laugh } from 'lucide-react';
import { formatDateTime24h } from '@/lib/date';
import { formatPlayerName } from '@/lib/constants';

interface Comment {
  id: number;
  note_slug: string;
  user_id: string;
  user_name: string;
  user_picture: string | null;
  user_nickname: string | null;
  content: string;
  created_at: string;
  reactions?: Record<string, { count: number; users: string[] }>;
}

interface UserSession {
  userId: string;
  name: string;
  picture?: string;
  nickname?: string;
  isAdmin: boolean;
}

export default function CommentsSection({ noteSlug, initialUser }: { noteSlug: string; initialUser?: UserSession | null }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [user, setUser] = useState<UserSession | null>(initialUser || null);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchComments = () => {
    fetch(`/api/comments?slug=${encodeURIComponent(noteSlug)}`)
      .then(res => res.json())
      .then(data => {
        setComments(data.comments || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchComments();
    if (!initialUser) {
      fetch('/api/auth/me')
        .then(res => res.json())
        .then(data => {
          if (data.authenticated) setUser(data.user);
        })
        .catch(() => {});
    }
  }, [noteSlug, initialUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: noteSlug, content: newComment.trim() }),
      });
      if (res.ok) {
        setNewComment('');
        fetchComments();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this comment?')) return;
    const res = await fetch('/api/comments', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setComments(prev => prev.filter(c => c.id !== id));
    }
  };

  const handleReact = async (commentId: number, reaction: 'upvote' | 'heart' | 'laugh') => {
    if (!user) {
      window.location.href = `/api/auth/login?returnTo=${encodeURIComponent(window.location.pathname)}`;
      return;
    }

    // Optimistic UI update
    setComments(prev => prev.map(c => {
      if (c.id !== commentId) return c;
      const current = c.reactions?.[reaction] || { count: 0, users: [] };
      const hasReacted = current.users.includes(user.userId);
      const newUsers = hasReacted
        ? current.users.filter(u => u !== user.userId)
        : [...current.users, user.userId];
      const newCount = hasReacted ? Math.max(0, current.count - 1) : current.count + 1;

      return {
        ...c,
        reactions: {
          ...c.reactions,
          [reaction]: { count: newCount, users: newUsers },
        },
      };
    }));

    try {
      const res = await fetch('/api/comments/react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId, reaction }),
      });
      if (!res.ok) {
        fetchComments();
      }
    } catch {
      fetchComments();
    }
  };

  return (
    <section className="mt-12 pt-8 border-t border-obsidian-border">
      <div className="flex items-center space-x-2 mb-6">
        <MessageSquare className="w-5 h-5 text-obsidian-purpleLight" />
        <h3 className="text-lg font-semibold text-white">
          Comments ({comments.length})
        </h3>
      </div>

      {/* Comment Form */}
      {user ? (
        <form onSubmit={handleSubmit} className="mb-8 bg-obsidian-surface border border-obsidian-border rounded-xl p-4">
          <div className="flex items-center space-x-2.5 mb-3">
            {user.picture ? (
              <img src={user.picture} alt={user.name} className="w-6 h-6 rounded-full object-cover" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-obsidian-purple text-xs flex items-center justify-center font-bold text-white">
                {user.name.charAt(0)}
              </div>
            )}
            <span className="text-xs font-medium text-obsidian-text">
              Commenting as <span className="text-white font-semibold">{user.name}</span>
            </span>
          </div>

          <textarea
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            placeholder="Share your thoughts, campaign notes, or lore questions..."
            rows={3}
            className="w-full bg-obsidian-card border border-obsidian-border rounded-lg p-3 text-sm text-white placeholder-obsidian-textFaint focus:outline-none focus:border-obsidian-purple transition-colors resize-none"
          />

          <div className="flex justify-end mt-2">
            <button
              type="submit"
              disabled={submitting || !newComment.trim()}
              className="flex items-center space-x-1.5 px-4 py-2 bg-obsidian-purple hover:bg-obsidian-purpleHover disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submitting ? 'Posting...' : 'Post Comment'}</span>
            </button>
          </div>
        </form>
      ) : (
        <div className="mb-8 p-4 bg-obsidian-card border border-obsidian-border rounded-xl flex items-center justify-between">
          <p className="text-sm text-obsidian-textMuted">
            Sign in with your Clerk account to comment on this article.
          </p>
          <a
            href={`/api/auth/login?returnTo=${typeof window !== 'undefined' ? encodeURIComponent(window.location.pathname) : '/'}`}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-obsidian-surface hover:bg-obsidian-hover border border-obsidian-border rounded-lg text-xs font-medium text-white transition-colors"
          >
            <LogIn className="w-3.5 h-3.5 text-obsidian-purpleLight" />
            <span>Sign In</span>
          </a>
        </div>
      )}

      {/* Comments List */}
      {loading ? (
        <div className="py-6 text-center text-xs text-obsidian-textFaint">Loading discussion...</div>
      ) : comments.length === 0 ? (
        <div className="py-8 text-center text-sm text-obsidian-textFaint">
          No comments on this article yet. Be the first to start the discussion!
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map(c => {
            const canDelete = user && (user.isAdmin || user.userId === c.user_id);
            return (
              <div key={c.id} className="p-4 bg-obsidian-surface border border-obsidian-borderSubtle rounded-xl flex items-start space-x-3 group">
                {c.user_picture ? (
                  <img src={c.user_picture} alt={c.user_name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-obsidian-purple text-xs font-semibold flex items-center justify-center text-white shrink-0">
                    {c.user_name.charAt(0)}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-sm text-white">{formatPlayerName(c.user_name)}</span>
                      {c.user_nickname && c.user_nickname !== c.user_name && (
                        <span className="text-xs text-obsidian-textFaint">@{c.user_nickname}</span>
                      )}
                      <span className="text-[11px] text-obsidian-textFaint">
                        {formatDateTime24h(c.created_at)}
                      </span>
                    </div>

                    {canDelete && (
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="opacity-0 group-hover:opacity-100 text-obsidian-textFaint hover:text-red-400 p-1 transition-all"
                        title="Delete comment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <p className="mt-1.5 text-sm text-zinc-300 leading-relaxed whitespace-pre-line">
                    {c.content}
                  </p>

                  {/* Reaction Buttons */}
                  <div className="flex items-center space-x-1.5 mt-3 pt-2.5 border-t border-obsidian-borderSubtle/60">
                    {/* THIS / +1 Button */}
                    <button
                      type="button"
                      onClick={() => handleReact(c.id, 'upvote')}
                      title={user ? 'Agree (+1 / THIS)' : 'Sign in to react'}
                      className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all select-none border ${
                        c.reactions?.upvote?.users?.includes(user?.userId || '')
                          ? 'bg-purple-950/60 border-obsidian-purple text-purple-300 shadow-sm'
                          : 'bg-obsidian-card hover:bg-obsidian-hover border-obsidian-border text-obsidian-textMuted hover:text-white'
                      }`}
                    >
                      <ThumbsUp className={`w-3.5 h-3.5 ${
                        c.reactions?.upvote?.users?.includes(user?.userId || '') ? 'text-obsidian-purpleLight fill-obsidian-purpleLight/20' : ''
                      }`} />
                      <span className="text-[11px] uppercase tracking-wider font-mono">THIS</span>
                      {Number(c.reactions?.upvote?.count || 0) > 0 && (
                        <span className="text-xs font-bold font-mono ml-0.5 text-purple-200">
                          {c.reactions?.upvote?.count}
                        </span>
                      )}
                    </button>

                    {/* Heart / Like Button */}
                    <button
                      type="button"
                      onClick={() => handleReact(c.id, 'heart')}
                      title={user ? 'Love / Like' : 'Sign in to react'}
                      className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all select-none border ${
                        c.reactions?.heart?.users?.includes(user?.userId || '')
                          ? 'bg-rose-950/60 border-rose-800 text-rose-300 shadow-sm'
                          : 'bg-obsidian-card hover:bg-obsidian-hover border-obsidian-border text-obsidian-textMuted hover:text-white'
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${
                        c.reactions?.heart?.users?.includes(user?.userId || '') ? 'text-rose-400 fill-rose-400' : ''
                      }`} />
                      {Number(c.reactions?.heart?.count || 0) > 0 && (
                        <span className="text-xs font-bold font-mono text-rose-200">
                          {c.reactions?.heart?.count}
                        </span>
                      )}
                    </button>

                    {/* Laugh / Funny Button */}
                    <button
                      type="button"
                      onClick={() => handleReact(c.id, 'laugh')}
                      title={user ? 'Funny / Laugh' : 'Sign in to react'}
                      className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all select-none border ${
                        c.reactions?.laugh?.users?.includes(user?.userId || '')
                          ? 'bg-amber-950/60 border-amber-800 text-amber-300 shadow-sm'
                          : 'bg-obsidian-card hover:bg-obsidian-hover border-obsidian-border text-obsidian-textMuted hover:text-white'
                      }`}
                    >
                      <Laugh className={`w-3.5 h-3.5 ${
                        c.reactions?.laugh?.users?.includes(user?.userId || '') ? 'text-amber-400 fill-amber-400/20' : ''
                      }`} />
                      {Number(c.reactions?.laugh?.count || 0) > 0 && (
                        <span className="text-xs font-bold font-mono text-amber-200">
                          {c.reactions?.laugh?.count}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
