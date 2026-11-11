export function matchesSimulation(score: number, searchSteps: number, minimum: number, logicalOnly: boolean): boolean {
  return score >= minimum && (!logicalOnly || searchSteps === 0);
}

/** Equal-width numeric bins, including every score, with at most 20 bars. */
export function histogramBins(counts: ReadonlyMap<number, number>) {
  let maximum = 0;
  for (const score of counts.keys()) maximum = Math.max(maximum, score);
  const width = Math.max(1000, Math.ceil((maximum + 1) / 20000) * 1000);
  const bins = Array.from({ length: Math.max(1, Math.floor(maximum / width) + 1) }, (_, i) => ({ low: i * width, high: (i + 1) * width - 1, count: 0 }));
  for (const [score, count] of counts) bins[Math.floor(score / width)].count += count;
  return bins;
}
