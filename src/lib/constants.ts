export const KNOWN_WORLDS = [
  'Sythian',
  'Verninthal',
  'Zenith',
  'Asnyri',
  'Hilonor',
  'Kalogeron',
  'The Void'
];

export const KNOWN_PLAYERS: Record<string, string> = {
  zorth: 'Jasper G.',
  bork: 'Mattis D.',
  feladir: 'Joppe D.',
  hubbe: 'Hubert B.',
  ruler: 'Matthias D.',
  frinkx: 'Frederik V.',
  remi: 'Andrii M.',
  gencaybk: 'Gencay B.',
  ughchillsu: 'Snu S.',
  lolypotter: 'Laurens D.',
  christine: 'Khang N.',
  lucasp: 'Lucas P.',
  rosariodipasta: 'Rosario D.',
  elioivens: 'Elio I.',
  pallarslol: "Lil' M.",
  bleebo: 'Bram V.',
  ddann99: 'Dan V.',
  devonthegoat: 'Devon G.',
  kaboomie121: 'Vic V.',
  twanny420: 'Antoine H.',
  valito260: 'Valentin D.',
  _elkers: 'Elke B.',
  habibi: 'Habibi H.',
  davemicrowave5: 'David M.',
  roguewave: 'Rogue W.',
  krecher9: 'Krecher K.',
  nelesix: 'Nele S.',
  silxntbtw: 'Silnt S.',
  hiralveradirineheart: 'Hiral V.',
};

export function formatPlayerName(player?: string | null): string {
  if (!player) return 'Unknown';
  const trimmed = player.trim();
  if (!trimmed) return 'Unknown';

  const lower = trimmed.toLowerCase();
  if (KNOWN_PLAYERS[lower]) {
    return KNOWN_PLAYERS[lower];
  }

  // If already in "Firstname L." format (e.g. "Mattis D." or "First Last")
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const first = words[0];
    const last = words[words.length - 1];
    // If the last word is already a single letter (with optional dot), preserve capitalized First L.
    if (/^[A-Za-z]\.?$/.test(last)) {
      const initial = last.charAt(0).toUpperCase();
      const capFirst = first.charAt(0).toUpperCase() + first.slice(1);
      return `${capFirst} ${initial}.`;
    }
    // If multiple words like "Firstname Lastname", abbreviate the last name
    const initial = last.charAt(0).toUpperCase();
    const capFirst = first.charAt(0).toUpperCase() + first.slice(1);
    return `${capFirst} ${initial}.`;
  }

  // If single word username not in map, capitalize first letter
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

