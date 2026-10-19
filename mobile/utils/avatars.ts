const PASTELS = ['#DCE9E8', '#E5EDE3', '#E4E2F2', '#DDEBF5', '#F1E7DA'];

const ANIMALS = [
  { key: 'lion', emoji: '🦁', label: 'Lion' },
  { key: 'elephant', emoji: '🐘', label: 'Elephant' },
  { key: 'giraffe', emoji: '🦒', label: 'Giraffe' },
  { key: 'zebra', emoji: '🦓', label: 'Zebra' },
  { key: 'rhino', emoji: '🦏', label: 'Rhino' },
  { key: 'leopard', emoji: '🐆', label: 'Leopard' },
  { key: 'crocodile', emoji: '🐊', label: 'Crocodile' },
  { key: 'eagle', emoji: '🦅', label: 'Eagle' },
  { key: 'owl', emoji: '🦉', label: 'Owl' },
  { key: 'monkey', emoji: '🐒', label: 'Monkey' },
  { key: 'fox', emoji: '🦊', label: 'Fox' },
  { key: 'turtle', emoji: '🐢', label: 'Turtle' },
  { key: 'frog', emoji: '🐸', label: 'Frog' },
  { key: 'fish', emoji: '🐟', label: 'Fish' },
  { key: 'duck', emoji: '🦆', label: 'Duck' },
  { key: 'dolphin', emoji: '🐬', label: 'Dolphin' },
];

export const AVATARS = ANIMALS.map((a, i) => ({ ...a, bg: PASTELS[i % PASTELS.length] }));

// The chosen animal, or an automatic one based on the user id.
export function avatarFor(userId?: number | null, key?: string | null) {
  const chosen = AVATARS.find((a) => a.key === key);
  if (chosen) return chosen;
  return AVATARS[Math.abs(Number(userId) || 0) % AVATARS.length];
}