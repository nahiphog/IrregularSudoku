import { mountWalkthrough } from './walkthrough-view';
import { gridMarkup } from './grid-view';
import { parseGrid, serializeGrid, gridImage } from './clipboard';
import { histogramBins, matchesSimulation } from './simulation-stats';

interface Result { id: number; trial: number; grid: string; score: number; hardestTechnique: string; elapsedMs: number; displayedAt: string; }
const PAGE_SIZE = 12;

export function renderSimulation(main: HTMLElement) {
  document.title = 'Simulation — Irregular Sudoku';
  main.innerHTML = `<h1 class="page-title">Simulation</h1><section class="simulation-controls"><label>Total trials<select id="sim-trials">${[1,10,100,1000,10000,100000,1000000].map(n=>`<option value="${n}" ${n===1000000?'selected':''}>${n.toLocaleString()}</option>`).join('')}</select></label><label>Display grids with difficulty of at least<select id="sim-minimum">${[0,1000,1600,2000,3000,5000,10000,1000000].map(n=>`<option value="${n}" ${n===1600?'selected':''}>${n.toLocaleString()}</option>`).join('')}</select></label><label class="sim-checkbox"><input id="sim-logical" type="checkbox" checked/> Display grids that don't use brute force</label><div class="copy-actions"><button id="sim-start" class="primary">Start simulation</button></div></section><p class="copy-help">Each trial generates a unique puzzle with symmetric regions and paired digging. Display filters apply together; the histogram includes every completed puzzle. Keep this page open while running. Starting a new run clears its results.</p><p id="sim-status" role="status" aria-live="polite">Ready.</p><progress id="sim-progress" value="0" max="1000000" aria-label="Completed trials"></progress><p id="sim-counts">0 completed · 0 matching · 0 failed</p><section class="simulation-chart"><h2>Difficulty distribution</h2><p class="copy-help">Horizontal axis: difficulty range. Vertical axis: number of puzzles. Equal-width bins adjust as the range grows.</p><div id="sim-histogram"></div></section><section><h2>Matching grids</h2><div class="copy-actions"><button id="sim-newer" disabled>Previous page</button><button id="sim-older" disabled>Next page</button><button id="sim-live" disabled>Highest difficulty</button></div><p id="sim-page">No matching grids yet.</p><p id="sim-copy-status" role="status"></p><div id="sim-copy-fallback" hidden><label for="sim-copy-text">Copy this 162-character string:</label><textarea id="sim-copy-text" readonly rows="4"></textarea></div><div id="sim-results" class="simulation-results"></div></section><dialog id="sim-walk-dialog" aria-labelledby="sim-walk-title"><div class="sim-walk-header"><h2 id="sim-walk-title">Solution walkthrough</h2><button id="sim-walk-close" aria-label="Close walkthrough">Close</button></div><p id="sim-walk-status" role="status"></p><div id="sim-walk-host"></div></dialog>`;
  const el = <T extends HTMLElement>(id: string) => main.querySelector<T>(`#${id}`)!;
  let worker: Worker | null = null, running = false, total = 0, completed = 0, failed = 0, matching = 0;
  let minimum = 1600, logicalOnly = true, page = 0, renderVersion = 0, epoch = 0;
  const dialog=el<HTMLDialogElement>('sim-walk-dialog');
  let analysisWorker:Worker|null=null, selectedResult:Result|null=null;
  const walkView=mountWalkthrough(el('sim-walk-host'),analyzeSelected);
  function analyzeSelected() {
    if(!selectedResult || !dialog.open) return;
    analysisWorker?.terminate();
    const selected=selectedResult;
    walkView.update(null,true,true);
    el('sim-walk-status').textContent='';
    try {
      const activeWorker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});
      analysisWorker=activeWorker;
      const finish=()=>{activeWorker.terminate();if(analysisWorker===activeWorker) analysisWorker=null;};
      activeWorker.onmessage=({data})=>{
        if(analysisWorker!==activeWorker || !dialog.open) return;
        if(data.type==='analyzing') {el('sim-walk-status').textContent='Analyzing '+data.steps+' steps…';return;}
        finish();
        if(data.type==='analyzed') {el('sim-walk-status').textContent='';walkView.update(data.walkthrough,false,true);}
        else {walkView.update(null,false,true);el('sim-walk-status').textContent=data.message || 'Could not analyze this puzzle. Try Analyze walkthrough again.';}
      };
      activeWorker.onerror=()=>{if(analysisWorker!==activeWorker) return;finish();walkView.update(null,false,true);el('sim-walk-status').textContent='Could not analyze this puzzle. Try Analyze walkthrough again.';};
      activeWorker.postMessage({type:'analyze',...parseGrid(selected.grid)});
    } catch {analysisWorker?.terminate();analysisWorker=null;walkView.update(null,false,true);el('sim-walk-status').textContent='Could not start the walkthrough. Please try again.';}
  }
  function openWalkthrough(id:number) {
    const result=visibleResults.get(id);
    if(!result) return;
    selectedResult=result;
    el('sim-walk-title').textContent='Trial '+result.trial.toLocaleString();
    dialog.showModal();analyzeSelected();
  }
  el('sim-walk-close').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{
    const id=selectedResult?.id;
    analysisWorker?.terminate();analysisWorker=null;selectedResult=null;walkView.update(null,false,true);
    (main.querySelector<HTMLElement>('[data-walkthrough="'+id+'"]') ?? el('sim-start')).focus({preventScroll:true});
  });
  el('sim-results').addEventListener('keydown',event=>{
    const target=(event.target as HTMLElement).closest<HTMLElement>('[data-walkthrough]');
    if(target && (event.key==='Enter' || event.key===' ')) {event.preventDefault();openWalkthrough(Number(target.dataset.walkthrough));}
  });
  const counts = new Map<number, number>();
  let visibleResults = new Map<number, Result>();
  let db: IDBDatabase | null = null;
  const dbName = `irregular-simulation-${crypto.randomUUID()}`;
  const status = (text: string) => { el('sim-status').textContent = text; };
  function openArchive(): Promise<IDBDatabase> {
    return new Promise((resolve,reject)=>{
      const request=indexedDB.open(dbName,1);
      request.onupgradeneeded=()=>request.result.createObjectStore('results',{keyPath:'id'}).createIndex('difficulty',['score','id']);
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
    for(const id of ['sim-trials','sim-minimum','sim-logical']) el<HTMLButtonElement>(id).disabled=running;
    el('sim-start').textContent=running ? 'Stop simulation' : 'Start simulation';
    el<HTMLButtonElement>('sim-older').disabled=(page+1)*PAGE_SIZE>=matching;
    el<HTMLButtonElement>('sim-newer').disabled=page===0;
    el<HTMLButtonElement>('sim-live').disabled=page===0;
  }
  function chart() {
    const bins=histogramBins(counts), max=Math.max(4,Math.ceil(Math.max(...bins.map(b=>b.count))/4)*4);
    const left=65, top=20, width=900, height=250, barWidth=width/bins.length;
    el('sim-histogram').innerHTML=`<svg viewBox="0 0 1000 355" role="img" aria-label="Difficulty histogram for ${completed} completed puzzles"><title>Difficulty distribution of all completed puzzles</title>${[0,0.25,0.5,0.75,1].map(f=>`<line x1="${left}" x2="965" y1="${top+height*(1-f)}" y2="${top+height*(1-f)}" stroke="#d6ddd8"/><text x="55" y="${top+height*(1-f)+5}" text-anchor="end">${Math.round(max*f)}</text>`).join('')}${bins.map((b,i)=>`<g><title>${b.low}–${b.high}: ${b.count} puzzles</title><rect x="${left+i*barWidth+2}" y="${top+height*(1-b.count/max)}" width="${Math.max(1,barWidth-4)}" height="${height*b.count/max}" fill="#245b51"/><text transform="translate(${left+(i+0.5)*barWidth},285) rotate(-35)" text-anchor="end">${b.low.toLocaleString()}–${b.high.toLocaleString()}</text></g>`).join('')}<text x="515" y="350" text-anchor="middle">Difficulty</text></svg>`;
  }
  async function renderResults() {
    const version=++renderVersion, start=page*PAGE_SIZE+1, end=Math.min(matching,(page+1)*PAGE_SIZE);
    if(!end || !db) {el('sim-results').replaceChildren();el('sim-page').textContent='No matching grids yet.';update();return;}
    const rows=await new Promise<Result[]>((resolve,reject)=>{
      const request=db!.transaction('results').objectStore('results').index('difficulty').openCursor(null,'prev');
      const rows:Result[]=[]; let skipped=false;
      request.onsuccess=()=>{
        const cursor=request.result;
        if(!cursor || rows.length===PAGE_SIZE) {resolve(rows);return;}
        if(!skipped && start>1) {skipped=true;cursor.advance(start-1);return;}
        rows.push(cursor.value);cursor.continue();
      };
      request.onerror=()=>reject(request.error);
    });
    if(version!==renderVersion) return;
    el('sim-page').textContent=`Matches ${start.toLocaleString()}–${end.toLocaleString()} of ${matching.toLocaleString()} · highest difficulty first`;
    visibleResults=new Map(rows.map(result=>[result.id,result]));
    el('sim-results').innerHTML=rows.map(result=>{
      const puzzle=parseGrid(result.grid);
      return `<article class="simulation-result"><h3>Trial ${result.trial.toLocaleString()}</h3><div class="board simulation-grid-link" role="button" tabindex="0" data-walkthrough="${result.id}" aria-label="View solution walkthrough for trial ${result.trial}" aria-haspopup="dialog">${gridMarkup(puzzle)}</div><p class="copy-help">Click the grid to view its solution walkthrough.</p><table class="puzzle-attributes"><tbody><tr><th scope="row">Elapsed time</th><td>${(result.elapsedMs/1000).toFixed(2)}s</td></tr><tr><th scope="row">Givens</th><td>${puzzle.values.filter(Boolean).length}</td></tr><tr><th scope="row">Difficulty</th><td>${result.score}</td></tr><tr><th scope="row">Hardest technique</th><td>${result.hardestTechnique}</td></tr><tr><th scope="row">Displayed at</th><td>${new Date(result.displayedAt).toLocaleString()}</td></tr></tbody></table><div class="copy-actions" role="group" aria-label="Copy trial ${result.trial}"><button data-copy="${result.id}" data-format="string">Copy string</button><button data-copy="${result.id}" data-format="image">Copy image</button></div></article>`;
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
    if(running) {stop('Stopped. Completed results are retained; the unfinished trial is not counted.');return;}
    const run=++epoch; running=true; update();
    try {
      db ??= await openArchive(); await save();
      if(epoch!==run) return;
      completed=0;failed=0;matching=0;counts.clear();page=0;visibleResults.clear();el('sim-copy-fallback').hidden=true;el('sim-copy-status').textContent='';
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
            const result:Result={id:matching+1,trial:completed+failed,grid:serializeGrid(data.puzzle),score:data.score,hardestTechnique:data.hardestTechnique,elapsedMs:data.elapsedMs,displayedAt:new Date().toISOString()};
            await save(result);
            if(epoch!==run) return;
            matching++;
            await renderResults();
          }
          if(epoch!==run) return;
          update();next();
        } catch {if(epoch===run) stop('Simulation stopped: browser storage is unavailable or full. Existing results and histogram are retained.');}
      };
      next();
    } catch {if(epoch===run) stop('Could not start simulation. Browser storage and workers must be available.');}
  };
  function browse(nextPage:number) {page=nextPage;void renderResults().catch(()=>status('Could not read archived results.'));}
  el('sim-older').onclick=()=>browse(page+1);
  el('sim-newer').onclick=()=>browse(Math.max(0,page-1));
  el('sim-live').onclick=()=>browse(0);
  el('sim-results').addEventListener('click',async event=>{
    const grid=(event.target as HTMLElement).closest<HTMLElement>('[data-walkthrough]');
    if(grid) {openWalkthrough(Number(grid.dataset.walkthrough));return;}
    const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button[data-copy]');
    if(!button) return;
    const result=visibleResults.get(Number(button.dataset.copy));
    if(!result) return;
    el('sim-copy-fallback').hidden=true;
    const copied=(message:string)=>{el('sim-copy-status').textContent=message;};
    if(button.dataset.format==='string') {
      try {await navigator.clipboard.writeText(result.grid);copied('Copied 162 characters.');}
      catch {el('sim-copy-fallback').hidden=false;const field=el<HTMLTextAreaElement>('sim-copy-text');field.value=result.grid;field.focus();field.select();copied('Clipboard unavailable. Copy the selected string manually.');}
    } else {
      const png=gridImage(parseGrid(result.grid),true);
      try {await navigator.clipboard.write([new ClipboardItem({'image/png':png})]);copied('Image copied.');}
      catch {try {const blob=await png,a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='simulation-trial-'+result.trial+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);copied('Image clipboard unavailable. Downloaded PNG instead.');} catch {copied('Could not create image.');}}
    }
  });
  window.addEventListener('pagehide',event=>{
    stop('Stopped after leaving the page.');
    if(dialog.open) dialog.close();
    analysisWorker?.terminate();
    if(!event.persisted) {db?.close();indexedDB.deleteDatabase(dbName);}
  });
  chart();
}
