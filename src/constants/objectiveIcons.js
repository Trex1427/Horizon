export const OBJECTIVE_ICONS = {
  car: '🚗',
  house: '🏠',
  plane: '✈️',
  heart: '❤️',
  shopping: '🛍️',
  laptop: '💻',
  money: '💵',
  star: '⭐',
  book: '📚',
  music: '🎵',
  camera: '📷',
  game: '🎮',
  bike: '🚴',
  tree: '🌳',
  health: '💪',
};

export const OBJECTIVE_ICON_OPTIONS = Object.entries(OBJECTIVE_ICONS).map(([key, emoji]) => ({
  value: key,
  label: `${emoji} ${key.charAt(0).toUpperCase() + key.slice(1)}`,
}));
