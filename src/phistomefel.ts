import { units, validRegions } from './sudoku';

export const PHISTOMEFEL = { name: 'Phistomefel Ring', level: 'Hard' as const, score: 200 };
export const PHISTOMEFEL_RING = [20,21,22,23,24,29,33,38,42,47,51,56,57,58,59,60];
export const PHISTOMEFEL_CORNERS = [0,1,7,8,9,10,16,17,63,64,70,71,72,73,79,80];
const center = [30,31,32,39,40,41,48,49,50];
const applicability = new Map<string, boolean>();

const abs = (n: bigint) => n < 0n ? -n : n;
function gcd(a: bigint, b: bigint): bigint {
  a=abs(a); b=abs(b);
  while(b) { const remainder=a%b; a=b; b=remainder; }
  return a;
}
function normalize(row: bigint[]) {
  let divisor=0n;
  for(const value of row) divisor=gcd(divisor,value);
  if(divisor>1n) for(let i=0;i<row.length;i++) row[i]/=divisor;
}

/** Exact row-space proof, independent of the givens or any searched solution.
 * For each digit, ring minus corners = 1 minus its count in the central 3x3.
 * Thus proving that central count is 1 proves the user's multiset identity.
 * A central 3x3 region suffices; other layouts may also imply that count.
 */
export function supportsPhistomefel(regions: number[]): boolean {
  const key=regions.join(',');
  const cached=applicability.get(key);
  if(cached!==undefined) return cached;
  if(!validRegions(regions)) return false;
  let supported=center.every(cell=>regions[cell]===regions[center[0]]);
  if(!supported) {
    const basis:{pivot:number; row:bigint[]}[]=[];
    const reduce=(row:bigint[])=>{
      for(const entry of basis) {
        const factor=row[entry.pivot];
        if(!factor) continue;
        const scale=entry.row[entry.pivot];
        for(let i=0;i<row.length;i++) row[i]=row[i]*scale-entry.row[i]*factor;
        normalize(row);
      }
    };
    // Each house has one occurrence of any chosen digit; final coordinate is its RHS.
    for(const house of units(regions)) {
      const row=Array<bigint>(82).fill(0n);for(const cell of house) row[cell]=1n;row[81]=1n;
      reduce(row);
      const pivot=row.findIndex(n=>n!==0n);
      if(pivot>=0) {basis.push({pivot,row});basis.sort((a,b)=>a.pivot-b.pivot);}
    }
    const target=Array<bigint>(82).fill(0n);for(const cell of center) target[cell]=1n;target[81]=1n;
    reduce(target);supported=target.every(n=>n===0n);
  }
  if(applicability.size>=64) applicability.delete(applicability.keys().next().value!);
  applicability.set(key,supported);
  return supported;
}

export interface RingCount { minimum:number; maximum:number; optional:number[]; }
function sees(a:number,b:number,regions:number[]) {
  return Math.floor(a/9)===Math.floor(b/9) || a%9===b%9 || regions[a]===regions[b];
}
/** At most 16 candidates: count compatible locations, never complete Sudoku solutions. */
function capacity(cells:number[],regions:number[]) {
  const peers=cells.map((cell,i)=>cells.reduce((mask,other,j)=>mask | (i!==j && sees(cell,other,regions) ? 1<<j : 0),0));
  const memo=new Map<number,number>();
  function maximum(mask:number):number {
    if(!mask) return 0;
    const cached=memo.get(mask);if(cached!==undefined) return cached;
    const bit=mask & -mask, index=31-Math.clz32(bit), rest=mask^bit;
    const result=Math.max(maximum(rest),1+maximum(rest & ~peers[index]));
    memo.set(mask,result);return result;
  }
  return maximum((1<<cells.length)-1);
}
function countDigit(cells:number[],values:number[],notes:number[][],digit:number,regions:number[]):RingCount {
  const certain=cells.filter(cell=>values[cell]===digit || (!values[cell] && notes[cell].length===1 && notes[cell][0]===digit));
  const optional=cells.filter(cell=>!values[cell] && notes[cell].length>1 && notes[cell].includes(digit));
  return {minimum:certain.length,maximum:certain.length+capacity(optional,regions),optional};
}

/** One instance compares one digit's possible multiplicities in both directions. */
export function findPhistomefel(regions:number[],values:number[],notes:number[][]) {
  if(!supportsPhistomefel(regions)) return null;
  for(let digit=1;digit<=9;digit++) {
    const ring=countDigit(PHISTOMEFEL_RING,values,notes,digit,regions);
    const corners=countDigit(PHISTOMEFEL_CORNERS,values,notes,digit,regions);
    if(ring.minimum>corners.maximum || corners.minimum>ring.maximum) throw new Error('Inconsistent Phistomefel Ring candidate counts.');
    const removed:{cell:number;digit:number}[]=[];
    for(const [a,b] of [[ring,corners],[corners,ring]]) {
      for(const cell of a.optional) {
        const remaining=a.optional.filter(other=>other!==cell);
        const withCell=a.minimum+1+capacity(remaining.filter(other=>!sees(cell,other,regions)),regions);
        if(a.minimum+1>b.maximum || withCell<b.minimum) removed.push({cell,digit});
        else if(a.minimum+capacity(remaining,regions)<b.minimum) {
          for(const other of notes[cell]) if(other!==digit) removed.push({cell,digit:other});
        }
      }
    }
    if(removed.length) return {digit,ring,corners,removed,pattern:[...PHISTOMEFEL_RING,...PHISTOMEFEL_CORNERS]};
  }
  return null;
}
