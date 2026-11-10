import { isGiven, type Puzzle } from './sudoku';

/** 81 one-based region IDs followed by 81 digits; empty cells are zero. */
export function serializeGrid(puzzle: Puzzle): string {
  return puzzle.regions.map(r => r + 1).join('') + puzzle.values.join('');
}

const palette = ['#eef0df', '#f5e9dc', '#e5ede5', '#e4ecee', '#f4efdc', '#eee5e5', '#e9e6ef', '#e3ede0', '#f0e7dc'];
/** Draw directly from puzzle data: no selection, candidates or UI chrome. */
export function gridImage(puzzle: Puzzle, colors: boolean): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 936;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Image creation is not supported in this browser.'));
  ctx.fillStyle = '#fffef9'; ctx.fillRect(0, 0, 936, 936);
  const size = 100, pad = 18;
  for (let i = 0; i < 81; i++) {
    const x = pad + i % 9 * size, y = pad + Math.floor(i / 9) * size;
    ctx.fillStyle = colors ? palette[puzzle.regions[i]] : '#fffef9'; ctx.fillRect(x, y, size, size);
    if (puzzle.values[i]) { ctx.fillStyle = isGiven(puzzle, i) ? '#000000' : '#1756c0'; ctx.font = '500 48px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(puzzle.values[i]), x + size / 2, y + size / 2 + 2); }
  }
  const line = (x: number, y: number, x2: number, y2: number, boundary: boolean) => {
    ctx.beginPath(); ctx.lineWidth = boundary ? 5 : 1; ctx.strokeStyle = boundary ? '#42584f' : '#b6c0b3'; ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
  };
  for (let i = 0; i < 81; i++) {
    const x = pad + i % 9 * size, y = pad + Math.floor(i / 9) * size;
    line(x, y, x + size, y, i < 9 || puzzle.regions[i] !== puzzle.regions[i - 9]);
    line(x, y, x, y + size, i % 9 === 0 || puzzle.regions[i] !== puzzle.regions[i - 1]);
  }
  line(pad, pad + 900, pad + 900, pad + 900, true); line(pad + 900, pad, pad + 900, pad + 900, true);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not create the grid image.')), 'image/png'));
}
