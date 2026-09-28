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

  return trimmed;
}

