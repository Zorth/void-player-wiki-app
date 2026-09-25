'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { KNOWN_WORLDS } from '@/lib/constants';
import {
  Save,
  Eye,
  Edit3,
  Image as ImageIcon,
  Link as LinkIcon,
  Compass,
  User,
  Tag,
  AlertCircle,
  ArrowLeft,
  MapPin,
  Flag,
  Calendar,
  Layers,
  BookOpen,
  CheckCircle2,
  Lock,
  MoreHorizontal,
} from 'lucide-react';
import { marked } from 'marked';

export default function EditorPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-xs text-obsidian-textFaint">Loading Editor...</div>}>
      <EditorContent />
    </Suspense>
  );
}

type ArticleType = 'location' | 'npc' | 'organization' | 'event' | 'species' | 'meta' | 'other' | 'session' | 'pc' | 'world';

function EditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editSlug = searchParams.get('slug');

  const [title, setTitle] = useState('');
  const [articleType, setArticleType] = useState<ArticleType>('location');
  const [isSettlement, setIsSettlement] = useState(false);
  const [otherTag, setOtherTag] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [image, setImage] = useState('');
  const [guildCharacterId, setGuildCharacterId] = useState<string | undefined>(undefined);
  const [selectedWorlds, setSelectedWorlds] = useState<string[]>([]);
  const [extraTagsStr, setExtraTagsStr] = useState('');
  const [content, setContent] = useState('');
  const [existingFilePath, setExistingFilePath] = useState<string | undefined>(undefined);

  const [isExistingSession, setIsExistingSession] = useState(false);
  const [isExistingCharacter, setIsExistingCharacter] = useState(false);
  const [existingMetadata, setExistingMetadata] = useState<any>(null);

  const [previewMode, setPreviewMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Check user auth & edit permissions
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (!data.authenticated || !data.user.canEdit) {
          setError('You do not have permission to edit or create articles. Contact an administrator.');
        } else {
          setUser(data.user);
        }
      });

    // If editing existing note
    if (editSlug) {
      fetch(`/api/notes/get?slug=${encodeURIComponent(editSlug)}`)
        .then(res => res.json())
        .then(data => {
          if (data.note) {
            const n = data.note;
            setTitle(n.title);
            setContent(n.rawContent || '');
            setExistingFilePath(n.filePath);
            setSelectedWorlds(n.worlds || []);
            setExistingMetadata(n);
            if (n.image) setImage(n.image);
            if (n.guildCharacterId) setGuildCharacterId(n.guildCharacterId);

            if (n.category === 'session-report' || n.tags.includes('session')) {
              setArticleType('session');
              setIsExistingSession(true);
              if (n.date) setSessionDate(n.date);
            } else if (n.category === 'character' || n.tags.includes('pc')) {
              setArticleType('pc');
              setIsExistingCharacter(true);
            } else if (n.tags.includes('world')) {
              setArticleType('world');
            } else if (n.tags.includes('location/settlement')) {
              setArticleType('location');
              setIsSettlement(true);
            } else if (n.tags.includes('location')) {
              setArticleType('location');
              setIsSettlement(false);
            } else if (n.tags.includes('npc')) {
              setArticleType('npc');
            } else if (n.tags.includes('organization')) {
              setArticleType('organization');
            } else if (n.tags.includes('event')) {
              setArticleType('event');
            } else if (n.tags.includes('species')) {
              setArticleType('species');
            } else if (n.category === 'guide' || n.tags.includes('meta')) {
              setArticleType('meta');
            } else if (n.tags.length > 0) {
              setArticleType('other');
              setOtherTag(n.tags[0]);
            }

            // Filter out primary tag from extra tags
            const primaryTags = ['location', 'location/settlement', 'npc', 'organization', 'event', 'species', 'meta', 'session', 'pc', 'world'];
            const extras = (n.tags || []).filter((t: string) => !primaryTags.includes(t) && !t.startsWith('pc/') && (n.tags.length === 0 || t !== n.tags[0] || primaryTags.some(pt => n.tags.includes(pt))));
            setExtraTagsStr(extras.join(', '));
          }
        })
        .catch(() => {});
    } else {
      const qCat = searchParams.get('category');
      const qTitle = searchParams.get('title');
      const qGuildCharId = searchParams.get('guildCharacterId');
      if (qTitle) setTitle(qTitle);
      if (qGuildCharId) setGuildCharacterId(qGuildCharId);
      if (qCat === 'character' || qCat === 'pc') {
        setArticleType('pc');
        setIsExistingCharacter(true);
      } else if (qCat === 'session-report' || qCat === 'session') {
        setArticleType('session');
        setIsExistingSession(true);
      }
    }
  }, [editSlug, searchParams]);

  const toggleWorld = (w: string) => {
    setSelectedWorlds(prev =>
      prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w]
    );
  };

  const insertText = (before: string, after: string = '') => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = ta.value.substring(start, end);
    const replacement = before + selected + after;
    const newContent = ta.value.substring(0, start) + replacement + ta.value.substring(end);
    setContent(newContent);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  };

  const handleImageUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        insertText(`\n![[${data.filename}]]\n`);
        if (articleType === 'pc' && !image) {
          setImage(data.filename);
        }
      } else {
        alert('Upload failed: ' + (await res.text()));
      }
    } catch (e: any) {
      alert('Upload error: ' + e.message);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageUpload(e.dataTransfer.files[0]);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setError('');
    setSaving(true);

    // Determine tags
    const finalTags: string[] = [];
    if (articleType === 'location') {
      finalTags.push('location');
      if (isSettlement) finalTags.push('location/settlement');
    } else if (articleType === 'npc') {
      finalTags.push('npc');
    } else if (articleType === 'organization') {
      finalTags.push('organization');
    } else if (articleType === 'event') {
      finalTags.push('event');
    } else if (articleType === 'species') {
      finalTags.push('species');
    } else if (articleType === 'meta') {
      // Guide/rules articles are classified by folder (_META) and category ('guide'), not #meta tag
    } else if (articleType === 'other') {
      if (otherTag.trim()) {
        const cleanTag = otherTag.replace(/^#/, '').toLowerCase().trim();
        if (cleanTag) finalTags.push(cleanTag);
      }
    } else if (articleType === 'session') {
      finalTags.push('session');
    } else if (articleType === 'pc') {
      finalTags.push('pc');
      if (existingMetadata?.rank) {
        finalTags.push(`pc/${existingMetadata.rank}`);
      }
    } else if (articleType === 'world') {
      finalTags.push('world');
    }

    // Add extra tags
    if (extraTagsStr.trim()) {
      const extras = extraTagsStr.split(',').map(t => t.replace(/^#/, '').toLowerCase().trim()).filter(Boolean);
      finalTags.push(...extras);
    }

    // Determine category
    let category = 'world-note';
    if (articleType === 'meta') category = 'guide';
    else if (articleType === 'session') category = 'session-report';
    else if (articleType === 'pc') category = 'character';

    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          title: title.trim(),
          date: articleType === 'session' ? (sessionDate || undefined) : undefined,
          image: image.trim() || undefined,
          guildCharacterId: guildCharacterId || undefined,
          content,
          worlds: articleType === 'meta' ? [] : selectedWorlds,
          tags: Array.from(new Set(finalTags)),
          existingFilePath,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save note');
      }

      const data = await res.json();
      router.push(`/notes/${data.slug}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (error && !user) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-red-950/20 border border-red-800/40 rounded-2xl text-center space-y-4">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
        <h2 className="text-lg font-bold text-white">Access Denied</h2>
        <p className="text-xs text-red-300">{error}</p>
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
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-obsidian-border pb-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => router.back()}
            className="p-1.5 text-obsidian-textMuted hover:text-white hover:bg-obsidian-card rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {editSlug ? 'Edit Article' : 'New Article'}
            </h1>
            <p className="text-xs text-obsidian-textFaint">
              {editSlug ? 'Update knowledge base document' : 'Contribute new lore, location, faction, or campaign note'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center space-x-1.5 transition-colors ${
              previewMode
                ? 'bg-obsidian-purple text-white border-obsidian-purple'
                : 'bg-obsidian-card border-obsidian-border text-obsidian-text hover:bg-obsidian-hover'
            }`}
          >
            {previewMode ? <Edit3 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{previewMode ? 'Back to Editor' : 'Preview'}</span>
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 bg-obsidian-purple hover:bg-obsidian-purpleHover disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-md flex items-center space-x-1.5 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save & Publish'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-950/30 border border-red-800/40 rounded-lg text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Metadata Configuration */}
      <div className="p-5 bg-obsidian-surface border border-obsidian-border rounded-xl space-y-5">
        {/* Title */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-obsidian-textFaint mb-1.5">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. City State of Greater Kalogeron"
            className="w-full bg-obsidian-card border border-obsidian-border rounded-lg px-3 py-2 text-base font-semibold text-white focus:outline-none focus:border-obsidian-purple"
          />
        </div>

        {/* What is this? Selector */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-obsidian-textFaint mb-2">
            What is this?
          </label>

          {isExistingSession ? (
            <div className="p-3.5 bg-purple-950/20 border border-purple-800/40 rounded-xl flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <Calendar className="w-4 h-4 text-purple-300" />
                <div>
                  <div className="text-sm font-semibold text-white">Session Report</div>
                  <div className="text-xs text-obsidian-textMuted">Synchronized with Guild API expedition record</div>
                </div>
              </div>
              <div className="flex items-center space-x-2 text-xs font-mono text-purple-300">
                <Lock className="w-3.5 h-3.5 text-obsidian-textFaint" />
                <span>Session Type</span>
              </div>
            </div>
          ) : isExistingCharacter ? (
            <div className="p-3.5 bg-blue-950/20 border border-blue-800/40 rounded-xl flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <User className="w-4 h-4 text-blue-300" />
                <div>
                  <div className="text-sm font-semibold text-white">Player Character Dossier</div>
                  <div className="text-xs text-obsidian-textMuted">
                    Synchronized with Guild API {existingMetadata?.class && `(${existingMetadata.ancestry} ${existingMetadata.class})`}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2 text-xs font-mono text-blue-300">
                <Lock className="w-3.5 h-3.5 text-obsidian-textFaint" />
                <span>Character Type</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setArticleType('location')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  articleType === 'location'
                    ? 'bg-obsidian-card border-obsidian-purple text-white shadow-sm ring-1 ring-obsidian-purple'
                    : 'bg-obsidian-card/60 border-obsidian-border text-obsidian-textMuted hover:border-obsidian-borderSubtle hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <MapPin className="w-4 h-4 text-sky-400" />
                  <span className="font-semibold text-sm">Location</span>
                </div>
                <p className="text-[11px] text-obsidian-textFaint leading-tight">
                  Place, landmark, wilderness, or region
                </p>
              </button>

              <button
                type="button"
                onClick={() => setArticleType('npc')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  articleType === 'npc'
                    ? 'bg-obsidian-card border-obsidian-purple text-white shadow-sm ring-1 ring-obsidian-purple'
                    : 'bg-obsidian-card/60 border-obsidian-border text-obsidian-textMuted hover:border-obsidian-borderSubtle hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <User className="w-4 h-4 text-purple-400" />
                  <span className="font-semibold text-sm">NPC</span>
                </div>
                <p className="text-[11px] text-obsidian-textFaint leading-tight">
                  Characters in story, not played by players
                </p>
              </button>

              <button
                type="button"
                onClick={() => setArticleType('organization')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  articleType === 'organization'
                    ? 'bg-obsidian-card border-obsidian-purple text-white shadow-sm ring-1 ring-obsidian-purple'
                    : 'bg-obsidian-card/60 border-obsidian-border text-obsidian-textMuted hover:border-obsidian-borderSubtle hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <Flag className="w-4 h-4 text-amber-400" />
                  <span className="font-semibold text-sm">Organization</span>
                </div>
                <p className="text-[11px] text-obsidian-textFaint leading-tight">
                  Factions, councils, guilds, or groups
                </p>
              </button>

              <button
                type="button"
                onClick={() => setArticleType('event')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  articleType === 'event'
                    ? 'bg-obsidian-card border-obsidian-purple text-white shadow-sm ring-1 ring-obsidian-purple'
                    : 'bg-obsidian-card/60 border-obsidian-border text-obsidian-textMuted hover:border-obsidian-borderSubtle hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold text-sm">Event</span>
                </div>
                <p className="text-[11px] text-obsidian-textFaint leading-tight">
                  Historical or upcoming campaign event
                </p>
              </button>

              <button
                type="button"
                onClick={() => setArticleType('species')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  articleType === 'species'
                    ? 'bg-obsidian-card border-obsidian-purple text-white shadow-sm ring-1 ring-obsidian-purple'
                    : 'bg-obsidian-card/60 border-obsidian-border text-obsidian-textMuted hover:border-obsidian-borderSubtle hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <span className="font-semibold text-sm">Species</span>
                </div>
                <p className="text-[11px] text-obsidian-textFaint leading-tight">
                  Creature or playable ancestry species
                </p>
              </button>

              <button
                type="button"
                onClick={() => setArticleType('meta')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  articleType === 'meta'
                    ? 'bg-obsidian-card border-obsidian-purple text-white shadow-sm ring-1 ring-obsidian-purple'
                    : 'bg-obsidian-card/60 border-obsidian-border text-obsidian-textMuted hover:border-obsidian-borderSubtle hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <BookOpen className="w-4 h-4 text-rose-400" />
                  <span className="font-semibold text-sm">Campaign Guide</span>
                </div>
                <p className="text-[11px] text-obsidian-textFaint leading-tight">
                  Rules &amp; guidelines (saved in _META)
                </p>
              </button>

              <button
                type="button"
                onClick={() => setArticleType('other')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  articleType === 'other'
                    ? 'bg-obsidian-card border-obsidian-purple text-white shadow-sm ring-1 ring-obsidian-purple'
                    : 'bg-obsidian-card/60 border-obsidian-border text-obsidian-textMuted hover:border-obsidian-borderSubtle hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <MoreHorizontal className="w-4 h-4 text-amber-400" />
                  <span className="font-semibold text-sm">Other</span>
                </div>
                <p className="text-[11px] text-obsidian-textFaint leading-tight">
                  Languages, deities, items, artifacts, etc.
                </p>
              </button>
            </div>
          )}

          {/* Other Custom Primary Tag Input */}
          {articleType === 'other' && (
            <div className="mt-3 p-3 bg-obsidian-card/50 border border-obsidian-border rounded-lg space-y-1.5">
              <label className="block text-xs font-semibold text-white">
                Primary Tag (e.g. <span className="font-mono text-obsidian-purpleLight">#language</span>, <span className="font-mono text-obsidian-purpleLight">#item</span>, <span className="font-mono text-obsidian-purpleLight">#deity</span>)
              </label>
              <div className="flex items-center space-x-2">
                <span className="text-obsidian-textFaint text-sm font-mono">#</span>
                <input
                  type="text"
                  value={otherTag.replace(/^#/, '')}
                  onChange={e => setOtherTag(e.target.value.replace(/^#/, '').toLowerCase())}
                  placeholder="language"
                  className="w-full sm:w-64 bg-obsidian-surface border border-obsidian-border rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-obsidian-purple"
                />
              </div>
            </div>
          )}

          {/* Location Sub-tag (Settlement) */}
          {articleType === 'location' && (
            <div className="mt-3 p-3 bg-obsidian-card/50 border border-obsidian-border rounded-lg flex items-center space-x-2.5">
              <input
                type="checkbox"
                id="settlementCheckbox"
                checked={isSettlement}
                onChange={e => setIsSettlement(e.target.checked)}
                className="rounded border-obsidian-border text-obsidian-purple focus:ring-0 focus:outline-none w-4 h-4 bg-obsidian-surface cursor-pointer"
              />
              <label htmlFor="settlementCheckbox" className="text-xs text-white font-medium cursor-pointer select-none">
                Settlement (Inhabited by people — adds <span className="font-mono text-obsidian-purpleLight">#location/settlement</span>)
              </label>
            </div>
          )}
        </div>

        {/* Session Date (Only for session reports) */}
        {articleType === 'session' && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-obsidian-textFaint mb-1.5">
              Session Date
            </label>
            <input
              type="date"
              value={sessionDate}
              onChange={e => setSessionDate(e.target.value)}
              className="w-full sm:w-64 bg-obsidian-card border border-obsidian-border rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-obsidian-purple"
            />
          </div>
        )}

        {/* Character Portrait (Frontmatter Image) */}
        {articleType === 'pc' && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-obsidian-textFaint mb-1.5">
              Character Portrait (Frontmatter Image)
            </label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <input
                type="text"
                value={image}
                onChange={e => setImage(e.target.value)}
                placeholder="e.g. CharacterName.png"
                className="w-full sm:w-80 bg-obsidian-card border border-obsidian-border rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-obsidian-purple"
              />
              {image ? (
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] text-obsidian-purpleLight font-mono px-2 py-1 bg-obsidian-purpleFaint rounded border border-obsidian-purpleBorder">
                    Avatar: {image}
                  </span>
                  <button
                    type="button"
                    onClick={() => setImage('')}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <span className="text-[11px] text-obsidian-textFaint">
                  Filename in <code>_META/_attachments/</code> used for this character's card in the roster.
                </span>
              )}
            </div>
          </div>
        )}

        {/* Linked Worlds (Rules / guides are not linked to worlds) */}
        {articleType !== 'meta' && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-obsidian-textFaint mb-2">
              Linked Worlds (select all that apply)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {KNOWN_WORLDS.map(w => {
                const selected = selectedWorlds.includes(w);
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => toggleWorld(w)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center space-x-1.5 ${
                      selected
                        ? 'bg-obsidian-purple text-white border-obsidian-purple shadow-sm'
                        : 'bg-obsidian-card border-obsidian-border text-obsidian-textMuted hover:text-white hover:border-obsidian-purpleBorder'
                    }`}
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>{w}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Additional Custom Sub-tags */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-obsidian-textFaint mb-1.5">
            Additional Sub-Tags (comma-separated, optional)
          </label>
          <input
            type="text"
            value={extraTagsStr}
            onChange={e => setExtraTagsStr(e.target.value)}
            placeholder="e.g. district, ruins, harbor, military"
            className="w-full bg-obsidian-card border border-obsidian-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-obsidian-purple font-mono"
          />
        </div>

        {/* Automated Authors Indicator */}
        <div className="p-3 bg-obsidian-card/40 border border-obsidian-borderSubtle rounded-lg flex items-center justify-between text-xs text-obsidian-textMuted">
          <div className="flex items-center space-x-2">
            <User className="w-3.5 h-3.5 text-obsidian-textFaint" />
            <span>
              Authoring: <strong className="text-white">{user?.name || user?.nickname || 'Your Account'}</strong> will be recorded automatically.
            </span>
          </div>
          <span className="text-[11px] text-obsidian-textFaint font-mono">Automated Version Tracking</span>
        </div>
      </div>

      {/* Editor & Preview Area */}
      <div className="space-y-2">
        {/* Markdown Toolbar */}
        {!previewMode && (
          <div className="flex flex-wrap items-center gap-1.5 p-2 bg-obsidian-surface border border-obsidian-border rounded-lg text-xs text-obsidian-textMuted">
            <button
              type="button"
              onClick={() => insertText('## ')}
              className="px-2 py-1 bg-obsidian-card hover:bg-obsidian-hover hover:text-white rounded border border-obsidian-border"
              title="Heading 2"
            >
              H2
            </button>
            <button
              type="button"
              onClick={() => insertText('### ')}
              className="px-2 py-1 bg-obsidian-card hover:bg-obsidian-hover hover:text-white rounded border border-obsidian-border"
              title="Heading 3"
            >
              H3
            </button>
            <button
              type="button"
              onClick={() => insertText('**', '**')}
              className="px-2 py-1 bg-obsidian-card hover:bg-obsidian-hover hover:text-white rounded border border-obsidian-border font-bold"
              title="Bold"
            >
              B
            </button>
            <button
              type="button"
              onClick={() => insertText('*', '*')}
              className="px-2 py-1 bg-obsidian-card hover:bg-obsidian-hover hover:text-white rounded border border-obsidian-border italic"
              title="Italic"
            >
              I
            </button>
            <button
              type="button"
              onClick={() => insertText('[[', ']]')}
              className="px-2 py-1 bg-obsidian-card hover:bg-obsidian-hover hover:text-white rounded border border-obsidian-border flex items-center space-x-1"
              title="Wikilink"
            >
              <LinkIcon className="w-3 h-3" />
              <span>Wikilink</span>
            </button>

            {/* Obsidian Callouts dropdown */}
            <select
              onChange={e => {
                const val = e.target.value;
                if (!val) return;
                insertText(`> [!${val}]\n> `);
                e.target.value = '';
              }}
              className="px-2 py-1 bg-obsidian-card hover:bg-obsidian-hover text-obsidian-text rounded border border-obsidian-border text-xs focus:outline-none"
              defaultValue=""
            >
              <option value="" disabled>+ Callout...</option>
              <option value="abstract">Abstract</option>
              <option value="note">Note</option>
              <option value="info">Info</option>
              <option value="tip">Tip</option>
              <option value="question">Question</option>
              <option value="warning">Warning</option>
              <option value="quote">Quote</option>
            </select>

            <label className="px-2 py-1 bg-obsidian-card hover:bg-obsidian-hover hover:text-white rounded border border-obsidian-border flex items-center space-x-1 cursor-pointer">
              <ImageIcon className="w-3 h-3" />
              <span>Upload Image</span>
              <input
                type="file"
                accept="image/*"
                onChange={e => {
                  if (e.target.files && e.target.files[0]) {
                    handleImageUpload(e.target.files[0]);
                  }
                }}
                className="hidden"
              />
            </label>
          </div>
        )}

        {previewMode ? (
          <div className="p-6 bg-obsidian-surface border border-obsidian-border rounded-xl min-h-[500px]">
            <div className="prose max-w-none text-zinc-300 leading-relaxed font-sans">
              <div dangerouslySetInnerHTML={{ __html: marked.parse(content) as string }} />
            </div>
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            placeholder="Write markdown here... Supports Obsidian callouts (> [!note]), image embeds (![[image.png]]), and wikilinks ([[Note Title]])."
            className="w-full h-[550px] bg-obsidian-surface border border-obsidian-border rounded-xl p-4 text-sm font-mono text-white focus:outline-none focus:border-obsidian-purple leading-relaxed resize-y"
          />
        )}
      </div>
    </div>
  );
}
