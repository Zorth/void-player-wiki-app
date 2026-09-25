'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Compass, BookOpen, Users, ScrollText, PlusCircle, Shield, LogOut, LogIn, ChevronDown, ExternalLink } from 'lucide-react';
import { KNOWN_WORLDS } from '@/lib/constants';
import SearchModal from './SearchModal';

interface UserSession {
  userId: string;
  name: string;
  email: string;
  picture?: string;
  nickname?: string;
  isAdmin: boolean;
  canEdit: boolean;
}

export default function Navbar() {
  const pathname = usePathname();
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [worldsOpen, setWorldsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.authenticated) setUser(data.user);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Keyboard shortcut Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-40 bg-obsidian-surface/95 backdrop-blur-md border-b border-obsidian-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo */}
          <div className="flex items-center space-x-6">
            <Link href="/" className="flex items-center space-x-2.5 group">
              <img
                src="/void_icon_purple.png"
                alt="The Void"
                className="w-8 h-8 rounded-lg object-contain shadow-lg shadow-purple-900/30 group-hover:scale-105 transition-transform"
              />
              <span className="font-bold text-lg text-obsidian-text tracking-tight group-hover:text-obsidian-purpleLight transition-colors">
                The Void <span className="text-obsidian-textMuted font-normal text-sm">Player Wiki</span>
              </span>
            </Link>

            {/* Nav Links */}
            <nav className="hidden md:flex items-center space-x-1">
              {/* Worlds Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setWorldsOpen(!worldsOpen)}
                  onBlur={() => setTimeout(() => setWorldsOpen(false), 200)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    pathname.startsWith('/worlds')
                      ? 'bg-obsidian-purpleFaint text-obsidian-purpleLight'
                      : 'text-obsidian-textMuted hover:text-obsidian-text hover:bg-obsidian-card'
                  }`}
                >
                  <Compass className="w-4 h-4" />
                  <span>Worlds</span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                </button>

                {worldsOpen && (
                  <div className="absolute left-0 mt-2 w-48 bg-obsidian-card border border-obsidian-border rounded-lg shadow-xl py-1.5 z-50">
                    {KNOWN_WORLDS.map(w => (
                      <Link
                        key={w}
                        href={`/worlds/${w.toLowerCase().replace(/\s+/g, '-')}`}
                        className="block px-4 py-2 text-sm text-obsidian-textMuted hover:text-white hover:bg-obsidian-purpleFaint hover:border-l-2 hover:border-obsidian-purple"
                        onClick={() => setWorldsOpen(false)}
                      >
                        {w}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Sessions */}
              <Link
                href="/sessions"
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  pathname === '/sessions'
                    ? 'bg-obsidian-purpleFaint text-obsidian-purpleLight'
                    : 'text-obsidian-textMuted hover:text-obsidian-text hover:bg-obsidian-card'
                }`}
              >
                <ScrollText className="w-4 h-4" />
                <span>Sessions</span>
              </Link>

              {/* Characters */}
              <Link
                href="/characters"
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  pathname === '/characters'
                    ? 'bg-obsidian-purpleFaint text-obsidian-purpleLight'
                    : 'text-obsidian-textMuted hover:text-obsidian-text hover:bg-obsidian-card'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Characters</span>
              </Link>

              {/* Rules */}
              <Link
                href="/rules"
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  pathname.startsWith('/rules')
                    ? 'bg-obsidian-purpleFaint text-obsidian-purpleLight'
                    : 'text-obsidian-textMuted hover:text-obsidian-text hover:bg-obsidian-card'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>Rules</span>
              </Link>

              {/* Guild Portal External Link */}
              <a
                href="https://guild.tarragon.be"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 px-3 py-1.5 rounded-md text-sm font-medium text-obsidian-purpleLight hover:text-white hover:bg-obsidian-card transition-colors"
                title="Go to Guild Portal (Characters, Sessions, Maps)"
              >
                <span>Guild</span>
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>
            </nav>
          </div>

          {/* Right Side: Search & Auth */}
          <div className="flex items-center space-x-3">
            {/* Search Trigger */}
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center space-x-2 px-3 py-1.5 bg-obsidian-card border border-obsidian-border rounded-lg text-sm text-obsidian-textMuted hover:text-obsidian-text hover:border-obsidian-borderSubtle transition-all"
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Search wiki...</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-obsidian-surface border border-obsidian-border rounded text-obsidian-textFaint">
                Ctrl K
              </kbd>
            </button>

            {/* Editor Action if permitted */}
            {user?.canEdit && (
              <Link
                href="/editor"
                className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 bg-obsidian-purple hover:bg-obsidian-purpleHover text-white rounded-lg text-sm font-medium shadow-sm transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                <span>New Note</span>
              </Link>
            )}

            {/* Admin Panel Link */}
            {user?.isAdmin && (
              <Link
                href="/admin"
                title="Admin Permissions"
                className="p-1.5 rounded-lg text-obsidian-textMuted hover:text-obsidian-purpleLight hover:bg-obsidian-card transition-colors"
              >
                <Shield className="w-4 h-4" />
              </Link>
            )}

            {/* User Profile / Login */}
            {!loading && (
              user ? (
                <div className="flex items-center space-x-2.5 pl-2 border-l border-obsidian-border">
                  {user.picture ? (
                    <img src={user.picture} alt={user.name} className="w-7 h-7 rounded-full object-cover border border-obsidian-border" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-obsidian-purple text-xs font-semibold flex items-center justify-center text-white">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="hidden lg:inline text-xs font-medium text-obsidian-text">
                    {user.name}
                  </span>
                  <a
                    href="/api/auth/logout"
                    title="Sign Out"
                    className="p-1 text-obsidian-textMuted hover:text-red-400 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </a>
                </div>
              ) : (
                <a
                  href={`/api/auth/login?returnTo=${encodeURIComponent(pathname)}`}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-obsidian-card hover:bg-obsidian-hover border border-obsidian-border rounded-lg text-sm font-medium text-obsidian-text transition-colors"
                >
                  <LogIn className="w-4 h-4 text-obsidian-purpleLight" />
                  <span>Sign In</span>
                </a>
              )
            )}
          </div>
        </div>
      </header>

      {/* Global Search Modal */}
      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
    </>
  );
}
