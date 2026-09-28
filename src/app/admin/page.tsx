'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Check, X, User, ArrowLeft, UserPlus, RefreshCw } from 'lucide-react';
import { formatTime24h } from '@/lib/date';

interface UserPerm {
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  user_nickname: string | null;
  user_picture: string | null;
  can_edit: number;
  is_admin: number;
  updated_at: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserPerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newUserId, setNewUserId] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [adding, setAdding] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [syncError, setSyncError] = useState('');

  const fetchSyncStatus = () => {
    fetch('/api/admin/sync')
      .then(res => res.json())
      .then(data => {
        if (data.lastSync) setSyncResult(data.lastSync);
      })
      .catch(() => {});
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncError('');
    try {
      const res = await fetch('/api/admin/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      setSyncResult(data.result);
    } catch (e: any) {
      setSyncError(e.message);
    } finally {
      setSyncing(false);
    }
  };

  const fetchUsers = () => {
    fetch('/api/admin/permissions')
      .then(res => {
        if (!res.ok) throw new Error('Admin access required');
        return res.json();
      })
      .then(data => {
        setUsers(data.users || []);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchUsers();
    fetchSyncStatus();
  }, []);

  const togglePermission = async (userId: string, currentVal: number) => {
    const newVal = currentVal === 1 ? false : true;
    const res = await fetch('/api/admin/permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, canEdit: newVal }),
    });
    if (res.ok) {
      setUsers(prev =>
        prev.map(u => (u.user_id === userId ? { ...u, can_edit: newVal ? 1 : 0 } : u))
      );
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserId.trim()) return;
    setAdding(true);
    const res = await fetch('/api/admin/permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: newUserId.trim(),
        canEdit: true,
        noteName: newUserName.trim() || undefined,
      }),
    });
    if (res.ok) {
      setNewUserId('');
      setNewUserName('');
      fetchUsers();
    }
    setAdding(false);
  };

  if (error) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-red-950/20 border border-red-800/40 rounded-2xl text-center space-y-4">
        <Shield className="w-8 h-8 text-red-400 mx-auto" />
        <h1 className="text-xl font-bold text-white">Admin Access Required</h1>
        <p className="text-xs text-red-300">Only users with the Clerk Admin role can access this page.</p>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 bg-obsidian-card hover:bg-obsidian-hover border border-obsidian-border rounded-lg text-xs font-semibold text-white"
        >
          Return to Wiki
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3 border-b border-obsidian-border pb-4">
        <button
          onClick={() => router.back()}
          className="p-1.5 text-obsidian-textMuted hover:text-white hover:bg-obsidian-card rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
            <Shield className="w-5 h-5 text-obsidian-purpleLight" />
            <span>Admin: User Permissions</span>
          </h1>
          <p className="text-xs text-obsidian-textMuted mt-0.5">
            Grant or revoke article editing and publishing rights for logged-in campaign members.
          </p>
        </div>
      </div>

      {/* Guild Synchronization */}
      <div className="p-5 bg-obsidian-surface border border-obsidian-border rounded-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-xs font-semibold text-white">
              <RefreshCw className={`w-4 h-4 text-obsidian-purpleLight ${syncing ? 'animate-spin' : ''}`} />
              <span>Guild Portal Synchronization</span>
            </div>
            <p className="text-xs text-obsidian-textMuted max-w-xl leading-relaxed">
              Fetches sessions and player characters from the Guild API, creating new articles in the vault and syncing character attributes. The container also runs this automatically every 15 minutes.
            </p>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-obsidian-purple hover:bg-obsidian-purpleHover disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors whitespace-nowrap self-start sm:self-auto shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Syncing...' : 'Sync from Guild Now'}</span>
          </button>
        </div>

        {syncResult && (
          <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-xs text-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <Check className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>
                Sessions: <strong>{syncResult.sessionsCreated} created, {syncResult.sessionsLinked} linked</strong> &bull; Characters: <strong>{syncResult.charactersCreated} created, {syncResult.charactersLinked} linked</strong>
              </span>
            </div>
            <span className="text-[11px] text-emerald-400/80 font-mono">
              Last synced: {formatTime24h(syncResult.timestamp, true)}
            </span>
          </div>
        )}

        {syncError && (
          <div className="p-3 rounded-lg bg-red-950/30 border border-red-800/40 text-xs text-red-300 flex items-center space-x-2">
            <X className="w-4 h-4 shrink-0 text-red-400" />
            <span>{syncError}</span>
          </div>
        )}
      </div>

      {/* Pre-authorize by Clerk ID */}
      <form onSubmit={handleAddUser} className="p-4 bg-obsidian-surface border border-obsidian-border rounded-xl space-y-3">
        <div className="flex items-center space-x-2 text-xs font-semibold text-white">
          <UserPlus className="w-4 h-4 text-obsidian-purpleLight" />
          <span>Authorize Player by Clerk User ID</span>
        </div>
        <p className="text-xs text-obsidian-textFaint">
          If a player hasn&apos;t logged in yet, you can pre-authorize their Clerk User ID (e.g. <code className="text-obsidian-purpleLight font-mono">user_2...</code>) to grant them wiki editing rights immediately.
        </p>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            placeholder="Clerk User ID (user_...)"
            value={newUserId}
            onChange={e => setNewUserId(e.target.value)}
            className="flex-1 bg-obsidian-card border border-obsidian-border rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-obsidian-purple font-mono"
            required
          />
          <input
            type="text"
            placeholder="Player Name (Optional)"
            value={newUserName}
            onChange={e => setNewUserName(e.target.value)}
            className="sm:w-48 bg-obsidian-card border border-obsidian-border rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-obsidian-purple"
          />
          <button
            type="submit"
            disabled={adding || !newUserId.trim()}
            className="px-4 py-1.5 bg-obsidian-purple hover:bg-obsidian-purpleHover disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors whitespace-nowrap"
          >
            {adding ? 'Authorizing...' : 'Grant Edit Rights'}
          </button>
        </div>
      </form>

      {loading ? (
        <div className="text-center py-12 text-sm text-obsidian-textFaint">Loading user directory...</div>
      ) : (
        <div className="bg-obsidian-surface border border-obsidian-border rounded-xl overflow-x-auto shadow-sm">
          <table className="w-full text-left text-sm min-w-[500px]">
            <thead className="bg-obsidian-card border-b border-obsidian-border text-xs text-obsidian-textFaint uppercase">
              <tr>
                <th className="px-6 py-3 font-semibold">User</th>
                <th className="px-6 py-3 font-semibold">Email</th>
                <th className="px-6 py-3 font-semibold">Role</th>
                <th className="px-6 py-3 font-semibold text-right">Can Edit Articles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-obsidian-borderSubtle">
              {users.map(u => {
                const isAdmin = u.is_admin === 1;
                const canEdit = u.can_edit === 1 || isAdmin;

                return (
                  <tr key={u.user_id} className="hover:bg-obsidian-card/50 transition-colors">
                    <td className="px-6 py-4 flex items-center space-x-3">
                      {u.user_picture ? (
                        <img src={u.user_picture} alt="" className="w-7 h-7 rounded-full object-cover" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-obsidian-purple text-xs font-bold flex items-center justify-center text-white">
                          {(u.user_name || 'U').charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-white">{u.user_name || 'Anonymous'}</div>
                        {u.user_nickname && (
                          <div className="text-xs text-obsidian-textFaint">@{u.user_nickname}</div>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-xs text-obsidian-textMuted font-mono">
                      {u.user_email || '—'}
                    </td>

                    <td className="px-6 py-4">
                      {isAdmin ? (
                        <span className="px-2 py-0.5 rounded bg-purple-950/40 text-purple-300 border border-purple-800/40 text-[11px] font-semibold">
                          Clerk Admin
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-obsidian-card text-obsidian-textMuted border border-obsidian-border text-[11px]">
                          Member
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right">
                      {isAdmin ? (
                        <span className="text-xs text-obsidian-textFaint font-medium">
                          Always Allowed (Admin)
                        </span>
                      ) : (
                        <button
                          onClick={() => togglePermission(u.user_id, u.can_edit)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors inline-flex items-center space-x-1.5 ${
                            canEdit
                              ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40 hover:bg-emerald-900/50'
                              : 'bg-obsidian-card text-obsidian-textMuted border-obsidian-border hover:border-obsidian-borderSubtle'
                          }`}
                        >
                          {canEdit ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Granted</span>
                            </>
                          ) : (
                            <>
                              <X className="w-3.5 h-3.5" />
                              <span>Revoked</span>
                            </>
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
