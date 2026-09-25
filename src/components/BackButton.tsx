'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

interface BackButtonProps {
  fallbackHref: string;
  label: string;
}

export default function BackButton({ fallbackHref, label }: BackButtonProps) {
  const router = useRouter();

  const handleClick = (e: React.MouseEvent) => {
    // If the user arrived from within the same domain (e.g. /characters or /sessions), pop history
    if (typeof window !== 'undefined' && window.history.length > 1 && document.referrer && document.referrer.includes(window.location.host)) {
      e.preventDefault();
      router.back();
    }
  };

  return (
    <a
      href={fallbackHref}
      onClick={handleClick}
      className="inline-flex items-center space-x-1.5 hover:text-white transition-colors cursor-pointer text-obsidian-textMuted"
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      <span>{label}</span>
    </a>
  );
}
