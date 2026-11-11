import { classicRegions, conflicts, type Puzzle } from './sudoku';
import { edgeKey, gridEdges, edgesFromRegions, regionsFromEdges, puzzleFromEdges } from './region-edges';

export function mountImportEditor(host: HTMLElement, onChange: () => void) {
  let edges = new Set<string>(), values: number[] = Array(81).fill(0), mode = 'edges', selected = 0, colors = true;
  let painting = false, adding = true;
  const history: { edges: Set<string>; values: number[] }[] = [];
  host.innerHTML = `<h2>Draw your puzzle</h2><fieldset class="editor-modes"><legend>Edit mode</legend><label><input type="radio" name="import-mode" value="edges" checked/> Region edges</label><label><input type="radio" name="import-mode" value="givens"/> Givens</label></fieldset><p class="copy-help">Edges: click or drag along cell borders to draw or erase. Givens: select a cell, then type 1–9 or use the buttons. Delete, Backspace or 0 clears a given. Arrow keys move between cells.</p><div class="edge-editor" id="edge-editor" role="group" aria-label="Editable imported grid"></div><div class="editor-digits" aria-label="Enter a given">${Array.from({length:9}, (_,i)=>`<button data-digit="${i+1}">${i+1}</button>`).join('')}<button data-digit="0">Clear</button></div><div class="builder-actions"><button id="editor-undo">Undo edit</button><button id="editor-classic">Use classic regions</button><button id="editor-clear-edges">Clear edges</button><button id="editor-clear-givens">Clear givens</button></div><p id="editor-validity" role="status"></p><button id="check-editor" class="primary">Check puzzle</button>`;
  const board = host.querySelector<HTMLElement>('#edge-editor')!;
  const checkpoint = () => { history.push({edges:new Set(edges),values:[...values]}); if (history.length > 100) history.shift(); };
  function draw() {
    const regions = regionsFromEdges(edges), sizes = new Map<number, number>(); regions.forEach(r=>sizes.set(r,(sizes.get(r)??0)+1));
    const bad = conflicts(values, regions);
    board.classList.toggle('editing-givens', mode === 'givens');
    board.innerHTML = values.map((v,i)=>`<button class="editor-cell ${colors && sizes.size === 9 ? `region-${regions[i]}` : ''} ${mode === 'givens' && selected === i ? 'editor-selected' : ''} ${bad.has(i) ? 'editor-conflict' : ''}" data-cell="${i}" style="left:${i%9*100/9}%;top:${Math.floor(i/9)*100/9}%" aria-label="Row ${Math.floor(i/9)+1}, column ${i%9+1}, ${v ? `given ${v}` : 'empty'}" ${mode === 'edges' ? 'tabindex="-1"' : `tabindex="${selected===i?0:-1}"`}>${v||''}</button>`).join('') + gridEdges.map(([a,b])=>{
      const vertical = b === a+1, key = edgeKey(a,b), row=Math.floor(a/9), col=a%9;
      return `<button class="editor-edge ${vertical?'vertical':'horizontal'} ${edges.has(key)?'drawn':''}" data-edge="${key}" style="left:${(vertical?col+1:col)*100/9}%;top:${(vertical?row:row+1)*100/9}%" aria-label="Border between row ${row+1} column ${col+1} and row ${Math.floor(b/9)+1} column ${b%9+1}" aria-pressed="${edges.has(key)}" ${mode==='givens'?'tabindex="-1"':''}></button>`;
    }).join('');
    let message = `${sizes.size} region${sizes.size===1?'':'s'} · sizes: ${[...sizes.values()].join(', ')}.`;
    try { puzzleFromEdges(edges, values); message = 'Ready: nine regions of nine cells. Check puzzle to test its solutions.'; } catch (e) { message += ` ${(e as Error).message}`; }
    host.querySelector('#editor-validity')!.textContent = message;
    host.querySelector<HTMLButtonElement>('#editor-undo')!.disabled = !history.length;
    host.querySelectorAll<HTMLButtonElement>('[data-digit]').forEach(b=>b.disabled=mode!=='givens');
  }
  const changed = () => { draw(); onChange(); };
  const focusCell = () => board.querySelector<HTMLButtonElement>(`[data-cell="${selected}"]`)?.focus({preventScroll:true});
  function setDigit(digit:number) { if (mode!=='givens' || values[selected]===digit) return; checkpoint(); values[selected]=digit; changed(); focusCell(); }
  function paint(key:string) { if (edges.has(key)===adding) return; if (adding) edges.add(key); else edges.delete(key); changed(); }
  board.addEventListener('pointerdown',event=>{
    const edge=(event.target as HTMLElement).closest<HTMLElement>('[data-edge]');
    if (mode!=='edges'||!edge||event.button!==0) return;
    event.preventDefault(); checkpoint(); adding=!edges.has(edge.dataset.edge!); painting=true; board.setPointerCapture(event.pointerId); paint(edge.dataset.edge!);
  });
  board.addEventListener('pointermove',event=>{
    if(!painting) return;
    const edge=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-edge]');
    if(edge&&board.contains(edge)) paint(edge.dataset.edge!);
  });
  board.addEventListener('pointerup',()=>painting=false); board.addEventListener('pointercancel',()=>painting=false);
  board.addEventListener('click',event=>{
    const target=event.target as HTMLElement, cell=target.closest<HTMLElement>('[data-cell]'), edge=target.closest<HTMLElement>('[data-edge]');
    if(mode==='givens'&&cell) { selected=Number(cell.dataset.cell); draw(); focusCell(); }
    else if(mode==='edges'&&edge&&event.detail===0) { checkpoint(); adding=!edges.has(edge.dataset.edge!); paint(edge.dataset.edge!); board.querySelector<HTMLButtonElement>(`[data-edge="${edge.dataset.edge}"]`)?.focus(); }
  });
  board.addEventListener('keydown',event=>{
    if(mode!=='givens') return;
    if(/^[0-9]$/.test(event.key)||['Backspace','Delete'].includes(event.key)) { event.preventDefault(); setDigit(Number(event.key)||0); }
    const moves:Record<string,number>={ArrowLeft:-1,ArrowRight:1,ArrowUp:-9,ArrowDown:9};
    if(event.key in moves) { event.preventDefault(); selected=Math.max(0,Math.min(80,selected+moves[event.key])); draw(); focusCell(); }
  });
  host.querySelectorAll<HTMLInputElement>('[name="import-mode"]').forEach(input=>input.onchange=()=>{mode=input.value;draw();});
  host.querySelectorAll<HTMLButtonElement>('[data-digit]').forEach(button=>button.onclick=()=>setDigit(Number(button.dataset.digit)));
  host.querySelector<HTMLButtonElement>('#editor-undo')!.onclick=()=>{const last=history.pop();if(last){edges=last.edges;values=last.values;changed();}};
  host.querySelector<HTMLButtonElement>('#editor-classic')!.onclick=()=>{checkpoint();edges=edgesFromRegions(classicRegions());changed();};
  host.querySelector<HTMLButtonElement>('#editor-clear-edges')!.onclick=()=>{checkpoint();edges.clear();changed();};
  host.querySelector<HTMLButtonElement>('#editor-clear-givens')!.onclick=()=>{checkpoint();values.fill(0);changed();};
  draw();
  return {
    puzzle:()=>puzzleFromEdges(edges,values),
    load(puzzle:Puzzle){checkpoint();edges=edgesFromRegions(puzzle.regions);values=[...puzzle.values];changed();},
    setColors(enabled:boolean){colors=enabled;draw();}
  };
}
