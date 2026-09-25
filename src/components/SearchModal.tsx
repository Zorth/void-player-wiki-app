'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, X, Compass, Tag, FileText, ArrowRight } from 'lucide-react';

interface SearchResult {
  slug: string;
  title: string;
  category: string;
  worlds: string[];
  tags: string[];
  abstract?: string;
}

export default function SearchModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then(res => res.json())
        .then(data => {
          setResults(data.results || []);
          setSelectedIndex(0);
        })
        .catch(() => {});
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      router.push(`/notes/${results[selectedIndex].slug}`);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-obsidian-surface border border-obsidian-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh]">
        
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-obsidian-border bg-obsidian-card">
          <Search className="w-5 h-5 text-obsidian-purpleLight mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search notes... (e.g. #settlement @sythian or title)"
            className="w-full bg-transparent text-white placeholder-obsidian-textFaint text-base focus:outline-none"
          />
          <button onClick={onClose} className="p-1 text-obsidian-textMuted hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto p-2 divide-y divide-obsidian-borderSubtle">
          {results.length === 0 ? (
            <div className="py-12 text-center text-sm text-obsidian-textFaint">
              No matching notes found. Try searching for a world, location, or character.
            </div>
          ) : (
            results.map((r, i) => {
              const isSelected = i === selectedIndex;
              return (
                <Link
                  key={r.slug}
                  href={`/notes/${r.slug}`}
                  onClick={onClose}
                  className={`flex items-start justify-between p-3 rounded-lg transition-all ${
                    isSelected
                      ? 'bg-obsidian-purpleFaint border border-obsidian-purpleBorder'
                      : 'hover:bg-obsidian-card border border-transparent'
                  }`}
                >
                  <div className="flex-1 pr-3">
                    <div className="flex items-center space-x-2">
                      <FileText className={`w-4 h-4 ${isSelected ? 'text-obsidian-purpleLight' : 'text-obsidian-textMuted'}`} />
                      <span className="font-medium text-sm text-white">{r.title}</span>
                      {r.worlds.map(w => (
                        <span key={w} className="inline-flex items-center text-[11px] px-1.5 py-0.5 rounded bg-purple-950/40 text-purple-300 border border-purple-800/40">
                          <Compass className="w-3 h-3 mr-1" />
                          {w}
                        </span>
                      ))}
                    </div>

                    {r.abstract && (
                      <p className="text-xs text-obsidian-textMuted mt-1 line-clamp-1">
                        {r.abstract}
                      </p>
                    )}

                    {r.tags.length > 0 && (
                      <div className="flex items-center space-x-1.5 mt-1.5">
                        {r.tags.slice(0, 4).map(t => (
                          <span key={t} className="text-[10px] text-obsidian-textFaint">
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <ArrowRight className={`w-4 h-4 self-center shrink-0 ${isSelected ? 'text-obsidian-purpleLight' : 'opacity-0'}`} />
                </Link>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 border-t border-obsidian-border bg-obsidian-bg text-[11px] text-obsidian-textFaint flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <span>Navigate: <kbd className="px-1 py-0.5 rounded bg-obsidian-card border border-obsidian-border font-mono text-[10px]">↑</kbd> <kbd className="px-1 py-0.5 rounded bg-obsidian-card border border-obsidian-border font-mono text-[10px]">↓</kbd></span>
            <span>Filter: <code className="text-obsidian-purpleLight font-mono">#tag</code>, <code className="text-obsidian-purpleLight font-mono">@world</code></span>
          </div>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  );
}
