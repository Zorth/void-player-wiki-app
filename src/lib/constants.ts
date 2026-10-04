export const KNOWN_WORLDS = [
  'Sythian',
  'Verninthal',
  'Zenith',
  'Asnyri',
  'Hilonor',
  'Kalogeron',
  'The Void'
];

export function formatPlayerName(player?: string | null): string {
  if (!player) return 'Unknown';
  const trimmed = player.trim();
  if (!trimmed) return 'Unknown';

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return parts[0];
  }

  const firstName = parts[0];
  const lastParts = parts.slice(1);
  const initials = lastParts
    .map(p => {
      const clean = p.replace(/\.+$/, '').trim();
      return clean.length > 0 ? `${clean[0].toUpperCase()}.` : '';
    })
    .filter(Boolean)
    .join(' ');

  return initials ? `${firstName} ${initials}` : firstName;
}

export function formatAuthorName(author?: string | null): string {
  return formatPlayerName(author);
}

export function formatAuthors(authors?: string[] | null): string {
  if (!authors || authors.length === 0) return '';
  return authors.map(a => formatPlayerName(a)).filter(Boolean).join(', ');
}
