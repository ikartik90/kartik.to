// Which icon is on each face of a grid of five-faced cubes: no icon on two faces at once while there are enough, so
// whichever face a flip brings round, no two fronts match.

const FACES = 5;

/** The first `cubes` icons in front, then the next ones round their sides, repeating round the sides if short. */
export function startingFaces<Icon>(icons: Icon[], cubes: number): Icon[][] {
  const sides = Math.max(1, icons.length - cubes);
  return Array.from({ length: cubes }, (_, i) => [
    icons[i % icons.length],
    ...Array.from({ length: FACES - 1 }, (_, side) => icons[cubes + ((i * (FACES - 1) + side) % sides)] ?? icons[i]),
  ]);
}

/** `faces` with each face named given an icon from `pool` on no face yet, picked by `random`; a face keeps its icon if none is spare. */
export function refreshFaces<Icon extends { key: string }>(
  faces: Icon[][],
  updates: { cube: number; element: number }[],
  pool: Icon[],
  random: () => number = Math.random,
): Icon[][] {
  const next = faces.map((cube) => [...cube]);
  const used = new Set(next.flat().map((icon) => icon.key));
  for (const { cube, element } of updates) {
    const spare = pool.filter((icon) => !used.has(icon.key));
    if (!spare.length) continue;
    const pick = spare[Math.floor(random() * spare.length)];
    used.delete(next[cube][element].key);
    used.add(pick.key);
    next[cube][element] = pick;
  }
  return next;
}
