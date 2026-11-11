import { gridMarkup } from './grid-view';
import { parseGrid, serializeGrid } from './clipboard';
import { histogramBins, matchesSimulation } from './simulation-stats';

interface Result { id: number; trial: number; grid: string; score: number; elapsedMs: number; displayedAt: string; }
const PAGE_SIZE = 12;

export function renderSimulation(main: HTMLElement) {
  document.title = 'Simulation — Irregular Sudoku';
  main.innerHTML = `<h1 class="page-title">Simulation</h1><section class="simulation-controls"><label>Total trials<select id="sim-trials">${[1,10,100,1000,10000,100000,1000000].map(n=>`<option value="${n}" ${n===1000000?'selected':''}>${n.toLocaleString()}</option>`).join('')}</select></label><label>Display grids with difficulty of at least<select id="sim-minimum">${[0,1000,2000,3000,5000,10000,1000000].map(n=>`<option value="${n}">${n.toLocaleString()}</option>`).join('')}</select></label><label class="sim-checkbox"><input id="sim-logical" type="checkbox" checked/> Display grids that don't use brute force</label><div class="copy-actions"><button id="sim-start" class="primary">Start simulation</button><button id="sim-stop" disabled>Stop</button></div></section><p class="copy-help">Each trial generates a unique puzzle with symmetric regions and paired digging. Display filters apply together; the histogram includes every completed puzzle. Keep this page open while running. Starting a new run clears its results.</p><p id="sim-status" role="status" aria-live="polite">Ready.</p><progress id="sim-progress" value="0" max="1000000" aria-label="Completed trials"></progress><p id="sim-counts">0 completed · 0 matching · 0 failed</p><section class="simulation-chart"><h2>Difficulty distribution</h2><p class="copy-help">Horizontal axis: difficulty range. Vertical axis: number of puzzles. Equal-width bins adjust as the range grows.</p><div id="sim-histogram"></div></section><section><h2>Matching grids</h2><div class="copy-actions"><button id="sim-newer" disabled>Newer results</button><button id="sim-older" disabled>Older results</button><button id="sim-live" disabled>Show latest live</button></div><p id="sim-page">No matching grids yet.</p><div id="sim-results" class="simulation-results"></div></section>`;
  const el = <T extends HTMLElement>(id: string) => main.querySelector<T>(`#${id}`)!;
  let worker: Worker | null = null, running = false, total = 0, completed = 0, failed = 0, matching = 0;
  let minimum = 0, logicalOnly = true, pageEnd: number | null = null, renderVersion = 0, epoch = 0;
  const counts = new Map<number, number>();
  let db: IDBDatabase | null = null;
  const dbName = `irregular-simulation-${crypto.randomUUID()}`;
  const status = (text: string) => { el('sim-status').textContent = text; };
  function openArchive(): Promise<IDBDatabase> {
    return new Promise((resolve,reject)=>{
      const request=indexedDB.open(dbName,1);
      request.onupgradeneeded=()=>request.result.createObjectStore('results',{keyPath:'id'});
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
  }
  function save(result?: Result): Promise<void> {
    return new Promise((resolve,reject)=>{
      const tx=db!.transaction('results','readwrite');
      if(result) tx.objectStore('results').put(result); else tx.objectStore('results').clear();
      tx.oncomplete=()=>resolve(); tx.onabort=()=>reject(tx.error); tx.onerror=()=>reject(tx.error);
    });
  }
  function update() {
    el<HTMLProgressElement>('sim-progress').max=total || Number(el<HTMLSelectElement>('sim-trials').value);
    el<HTMLProgressElement>('sim-progress').value=completed+failed;
    el('sim-counts').textContent=`${completed.toLocaleString()} completed · ${matching.toLocaleString()} matching · ${failed.toLocaleString()} failed · ${(completed+failed).toLocaleString()} / ${total.toLocaleString()} trials`;
    for(const id of ['sim-start','sim-trials','sim-minimum','sim-logical']) el<HTMLButtonElement>(id).disabled=running;
    el<HTMLButtonElement>('sim-stop').disabled=!running;
    const end=pageEnd ?? matching;
    el<HTMLButtonElement>('sim-older').disabled=end<=PAGE_SIZE;
    el<HTMLButtonElement>('sim-newer').disabled=pageEnd===null || end>=matching;
    el<HTMLButtonElement>('sim-live').disabled=pageEnd===null;
  }
  function chart() {
    const bins=histogramBins(counts), max=Math.max(4,Math.ceil(Math.max(...bins.map(b=>b.count))/4)*4);
    const left=65, top=20, width=900, height=250, barWidth=width/bins.length;
    el('sim-histogram').innerHTML=`<svg viewBox="0 0 1000 355" role="img" aria-label="Difficulty histogram for ${completed} completed puzzles"><title>Difficulty distribution of all completed puzzles</title>${[0,0.25,0.5,0.75,1].map(f=>`<line x1="${left}" x2="965" y1="${top+height*(1-f)}" y2="${top+height*(1-f)}" stroke="#d6ddd8"/><text x="55" y="${top+height*(1-f)+5}" text-anchor="end">${Math.round(max*f)}</text>`).join('')}${bins.map((b,i)=>`<g><title>${b.low}–${b.high}: ${b.count} puzzles</title><rect x="${left+i*barWidth+2}" y="${top+height*(1-b.count/max)}" width="${Math.max(1,barWidth-4)}" height="${height*b.count/max}" fill="#245b51"/><text transform="translate(${left+(i+0.5)*barWidth},285) rotate(-35)" text-anchor="end">${b.low.toLocaleString()}–${b.high.toLocaleString()}</text></g>`).join('')}<text x="515" y="350" text-anchor="middle">Difficulty</text></svg>`;
  }
  async function renderResults() {
    const version=++renderVersion, end=pageEnd ?? matching, start=Math.max(1,end-PAGE_SIZE+1);
    if(!end || !db) {el('sim-results').replaceChildren();el('sim-page').textContent='No matching grids yet.';update();return;}
    const rows=await new Promise<Result[]>((resolve,reject)=>{
      const request=db!.transaction('results').objectStore('results').getAll(IDBKeyRange.bound(start,end));
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    });
    if(version!==renderVersion) return;
    el('sim-page').textContent=`Matches ${start.toLocaleString()}–${end.toLocaleString()} of ${matching.toLocaleString()}${pageEnd===null?' · live':''}`;
    el('sim-results').innerHTML=rows.reverse().map(result=>{
      const puzzle=parseGrid(result.grid);
      return `<article class="simulation-result"><h3>Trial ${result.trial.toLocaleString()}</h3><div class="board" role="group" aria-label="Puzzle from trial ${result.trial}">${gridMarkup(puzzle)}</div><table class="puzzle-attributes"><tbody><tr><th scope="row">Elapsed time</th><td>${(result.elapsedMs/1000).toFixed(2)}s</td></tr><tr><th scope="row">Givens</th><td>${puzzle.values.filter(Boolean).length}</td></tr><tr><th scope="row">Difficulty</th><td>${result.score}</td></tr><tr><th scope="row">Displayed at</th><td>${new Date(result.displayedAt).toLocaleString()}</td></tr></tbody></table></article>`;
    }).join('');update();
  }
  function stop(message: string) {running=false;worker?.terminate();worker=null;update();status(message);}
  function next() {
    if(!running) return;
    if(completed+failed>=total) {stop('Simulation complete.');return;}
    status(`Generating and rating trial ${(completed+failed+1).toLocaleString()}…`);
    worker!.postMessage({});
  }
  el('sim-start').onclick=async()=>{
    if(running) return;
    const run=++epoch; running=true; update();
    try {
      db ??= await openArchive(); await save();
      if(epoch!==run) return;
      completed=0;failed=0;matching=0;counts.clear();pageEnd=null;
      total=Number(el<HTMLSelectElement>('sim-trials').value);minimum=Number(el<HTMLSelectElement>('sim-minimum').value);logicalOnly=el<HTMLInputElement>('sim-logical').checked;
      chart();await renderResults();
      if(!running || epoch!==run) return;
      worker=new Worker(new URL('./simulation-worker.ts',import.meta.url),{type:'module'});
      worker.onerror=()=>stop('Simulation stopped because the worker failed. Completed results are retained.');
      worker.onmessage=async({data})=>{
        if(!running || epoch!==run) return;
        if(data.type==='error') {failed++;stop(`Trial failed: ${data.message} Completed results are retained.`);return;}
        completed++;counts.set(data.score,(counts.get(data.score)??0)+1);chart();
        try {
          if(matchesSimulation(data.score,data.searchSteps,minimum,logicalOnly)) {
            const result:Result={id:matching+1,trial:completed+failed,grid:serializeGrid(data.puzzle),score:data.score,elapsedMs:data.elapsedMs,displayedAt:new Date().toISOString()};
            await save(result);
            if(epoch!==run) return;
            matching++;
            if(pageEnd===null) await renderResults();
          }
          if(epoch!==run) return;
          update();next();
        } catch {if(epoch===run) stop('Simulation stopped: browser storage is unavailable or full. Existing results and histogram are retained.');}
      };
      next();
    } catch {if(epoch===run) stop('Could not start simulation. Browser storage and workers must be available.');}
  };
  el('sim-stop').onclick=()=>stop('Stopped. Completed results are retained; the unfinished trial is not counted.');
  function browse(end:number|null) {pageEnd=end;void renderResults().catch(()=>status('Could not read archived results.'));}
  el('sim-older').onclick=()=>browse(Math.max(1,(pageEnd??matching)-PAGE_SIZE));
  el('sim-newer').onclick=()=>browse(Math.min(matching,(pageEnd??matching)+PAGE_SIZE));
  el('sim-live').onclick=()=>browse(null);
  window.addEventListener('pagehide',event=>{
    stop('Stopped after leaving the page.');
    if(!event.persisted) {db?.close();indexedDB.deleteDatabase(dbName);}
  });
  chart();
}
