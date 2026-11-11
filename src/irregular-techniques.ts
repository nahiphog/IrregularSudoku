/** Local irregular-region technique; the imported classic catalog is unchanged. */
export const IRREGULAR_LOCKED = {
  name: 'Locked candidates (Irregular)', level: 'Medium' as const, score: 55
};

export function findIrregularLockedCandidates(regions: number[], notes: number[][]) {
  for (let region = 0; region < 9; region++) for (let digit = 1; digit <= 9; digit++) {
    const places = regions.flatMap((r, cell) => r === region && notes[cell].includes(digit) ? [cell] : []);
    // Singles are handled by the existing simpler techniques. Never infer from an empty set.
    if (places.length < 2) continue;
    const removed = notes.flatMap((list, cell) =>
      regions[cell] !== region && list.includes(digit) && places.every(source =>
        Math.floor(source / 9) === Math.floor(cell / 9) || source % 9 === cell % 9
      ) ? [{ cell, digit }] : []
    );
    if (removed.length) return { region, digit, places, removed };
  }
  return null;
}
