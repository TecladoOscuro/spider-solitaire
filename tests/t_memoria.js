const {chromium}=require('playwright');
const URL=process.argv[2]||'http://localhost:8899/memoria.html';
let fails=0;
const ok=(n,c,x)=>{console.log((c?'PASS ':'FAIL ')+n+(c?'':' -> '+JSON.stringify(x)));if(!c)fails++;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1440,height:900}});
const errs=[];
p.on('pageerror',e=>errs.push('pageerror: '+e.message));
p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
p.on('dialog',d=>d.accept().catch(()=>{}));
await p.goto(URL);await p.waitForTimeout(450);

// 1 layout + globals
const l=await p.evaluate(()=>({
  cards:document.querySelectorAll('#grid .card').length,
  n:Math.sqrt(state.cards.length),
  down:state.cards.filter(c=>!c.up&&!c.matched).length,
  moves:state.moves,
  gen:typeof deal==='function'&&typeof flip==='function'&&typeof isWon==='function'
}));
ok('16 cartas 4x4 todas boca abajo',l.cards===16&&l.n===4&&l.down===16&&l.moves===0,l);
ok('motor global',l.gen,l);

// 2 pareja correcta
const pair=await p.evaluate(()=>{
  const seen={};
  for(let i=0;i<state.cards.length;i++){
    const k=state.cards[i].sym+'_'+state.cards[i].col;
    if(seen[k]!==undefined) return {a:seen[k],b:i};
    seen[k]=i;
  }
  return null;
});
await p.click(`#grid .card[data-i="${pair.a}"]`);await sleep(200);
const oneUp=await p.evaluate(i=>state.cards[i].up,pair.a);
ok('primera carta se levanta',oneUp===true);
await p.click(`#grid .card[data-i="${pair.b}"]`);await sleep(450);
const m1=await p.evaluate(pr=>({ma:state.cards[pr.a].matched,mb:state.cards[pr.b].matched,moves:state.moves,pairs:document.querySelector('#stPairs').textContent}),pair);
ok('pareja correcta: matched +1 par',m1.ma&&m1.mb&&m1.moves===1&&/^1\//.test(m1.pairs),m1);

// 3 pareja incorrecta -> se cierran
const mm=await p.evaluate(()=>{
  let x=-1,y=-1;
  for(let i=0;i<state.cards.length;i++){
    if(state.cards[i].matched) continue;
    if(x<0){x=i;continue;}
    const c=state.cards[i],cx=state.cards[x];
    if(c.sym!==cx.sym||c.col!==cx.col){y=i;break;}
  }
  return {x,y};
});
await p.click(`#grid .card[data-i="${mm.x}"]`);await sleep(200);
await p.click(`#grid .card[data-i="${mm.y}"]`);await sleep(300);
const midFlip=await p.evaluate(m=>({flipped:state.cards[m.x].up&&state.cards[m.y].up,pend:state.flipped.length===2}),mm);
ok('fallo: ambas visibles durante espera',midFlip.flipped&&midFlip.pend,midFlip);
await sleep(750);
const afterFlip=await p.evaluate(m=>({up:state.cards[m.x].up||state.cards[m.y].up,pend:state.flipped.length,moves:state.moves}),mm);
ok('fallo: se cierran tras espera',!afterFlip.up&&afterFlip.pend===0&&afterFlip.moves===2,afterFlip);

// 4 pista
await p.click('#btnHint');await sleep(300);
const peek=await p.evaluate(()=>document.querySelectorAll('#grid .peek,#grid [class*=peek]').length);
ok('pista destella pareja oculta',peek>0,peek);

// 5 dificultad experto
await p.selectOption('#diffSel','2');await sleep(500);
const exp=await p.evaluate(()=>{
  const g=document.querySelector('#grid');
  return {n:state.cards.length,cards:document.querySelectorAll('#grid .card').length,
    ls:localStorage.getItem('mem.diff'),fits:g.scrollWidth-g.clientWidth,
    pageX:document.documentElement.scrollWidth-document.documentElement.clientWidth};
});
ok('experto 8x8 =64 cartas sin scroll horizontal',exp.n===64&&exp.cards===64&&exp.ls==='2'&&exp.fits<=1&&exp.pageX<=1,exp);

// 6 completar partida
let guard=0;
while(guard++<80){
  const won=await p.evaluate(()=>state.won);
  if(won) break;
  const pr=await p.evaluate(()=>{
    const open=[];
    for(let i=0;i<state.cards.length;i++){
      const c=state.cards[i];
      if(c.matched||state.flipped.indexOf(i)>=0) continue;
      for(let j=i+1;j<state.cards.length;j++){
        const d=state.cards[j];
        if(d.matched||state.flipped.indexOf(j)>=0) continue;
        if(d.sym===c.sym&&d.col===c.col) return {a:i,b:j};
      }
    }
    return null;
  });
  if(!pr){ await sleep(300); continue; }
  await p.click(`#grid .card[data-i="${pr.a}"]`);
  await sleep(60);
  await p.click(`#grid .card[data-i="${pr.b}"]`);
  await sleep(120);
}
await sleep(400);
const win=await p.evaluate(()=>({won:state.won,show:document.querySelector('#win').classList.contains('show'),pairs:state.cards.filter(c=>c.matched).length/2,rec:document.querySelector('#stRec').textContent}));
ok('partida completa -> overlay +32 parejas',win.won&&win.show&&win.pairs===32,win);
ok('récord guardado',win.rec!=='—'&&win.rec!=='--',win);

await p.screenshot({path:'/tmp/vis_memoria_win.png',fullPage:false});
await p.click('#btnAgain');await sleep(300);
await p.click('.top a.brand');await sleep(400);
ok('logo lleva al indice',(await p.title())==='Juegos',await p.title());
ok('sin errores JS',errs.length===0,errs);
console.log(fails?`MEMORIA: ${fails} FAIL`:'MEMORIA: ALL PASS');
await b.close();
process.exit(fails?1:0);
})().catch(e=>{console.error('CRASH',e);process.exit(2);});
