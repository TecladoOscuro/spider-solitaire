const {chromium}=require('playwright');
const URL=process.argv[2]||'http://localhost:8899/klondike.html';
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
await p.goto(URL);await p.waitForTimeout(400);

// 1 layout + globals
const l=await p.evaluate(()=>({
  cols:document.querySelectorAll('.col').length,
  fnds:document.querySelectorAll('.fnd').length,
  stock:document.querySelector('#stockN').textContent,
  moves:document.querySelector('#moves').textContent,
  hasState:typeof state!=='undefined'&&!!state,
  hook:!!window.__klondike,
  gen:typeof generate==='function'&&typeof applyMove==='function'&&typeof status==='function'
}));
ok('7 columnas + 4 fundaciones',l.cols===7&&l.fnds===4,l);
ok('stock 24',l.stock==='24',l);
ok('globals/motor',l.hasState&&l.hook&&l.gen,l);

// 2 robar (respeta dificultad: 1 o3)
const draw=await p.evaluate(()=>state.draw);
await p.click('#stock');await p.waitForTimeout(150);
const d1=await p.evaluate(()=>({w:state.waste.length,s:state.stock.length,m:state.moves,wn:document.querySelector('#stockN').textContent}));
ok('robar segun dificultad (draw='+draw+')',d1.w===Math.min(draw,24)&&d1.s===24-d1.w&&+d1.wn===d1.s,d1);

// 3 vaciar stock y reciclar
const extra=Math.ceil(24/draw)-1;
for(let i=0;i<extra;i++){ await p.click('#stock'); await sleep(60); }
await p.waitForTimeout(150);
const empty=await p.evaluate(()=>({s:state.stock.length,w:state.waste.length}));
ok('stock vacio tras robos',empty.s===0&&empty.w===24,empty);
await p.click('#stock');await p.waitForTimeout(200);
const rec=await p.evaluate(()=>({s:state.stock.length,w:state.waste.length}));
ok('reciclar waste -> stock',rec.s===24&&rec.w===0,rec);

// 4 movimiento legal via generate + clicks en DOM
const mv=await p.evaluate(()=>{
  const ms=generate(state).filter(m=>m.from.z!=='stock'&&m.from.z!=='recycle');
  return ms.length?ms[0]:null;
});
ok('hay movimiento legal',!!mv,mv);
if(mv){
  const before=await p.evaluate(()=>state.moves);
  const srcSel=mv.from.z==='w'?'#waste':(mv.from.z==='t'?`.col[data-i="${mv.from.i}"] .card[data-j="${mv.from.j}"]`:null);
  if(srcSel && await p.$(srcSel)) await p.click(srcSel);
  else if(mv.from.z==='f') await p.click(`.fnd[data-i="${mv.from.i}"]`);
  await p.waitForTimeout(120);
  const dstSel=mv.to.z==='t'?`.col[data-i="${mv.to.i}"]`:`.fnd[data-i="${mv.to.i}"]`;
  await p.click(dstSel);
  await p.waitForTimeout(200);
  const after=await p.evaluate(()=>state.moves);
  ok('movimiento aplica (moves+1)',after===before+1,{after,before,mv});
}

// 5 deshacer
const mAfter=await p.evaluate(()=>state.moves);
await p.click('#btnUndo');await p.waitForTimeout(200);
const und=await p.evaluate(()=>state.moves);
ok('deshacer retrocede un movimiento',und===mAfter-1,{mAfter,und});
const coh=await p.evaluate(()=>Array.isArray(state.stock)&&Array.isArray(state.waste)&&state.stock.length+state.waste.length<=52);
ok('estado coherente tras deshacer',coh);

// 6 pista
await p.click('#btnHint');await p.waitForTimeout(200);
const hint=await p.evaluate(()=>({hint:document.querySelectorAll('.hint,[class*=hint]').length-((document.querySelector('.hint-bar')?1:0)),toast:document.querySelector('#toast').classList.contains('show')}));
ok('pista resalta o avisa',hint.hint>0||hint.toast,hint);

// 7 nuevo juego con confirm
await p.click('#btnNew');await p.waitForTimeout(250);
const ng=await p.evaluate(()=>({m:state.moves,s:state.stock.length,w:state.waste.length,cols:document.querySelectorAll('.col').length}));
ok('nuevo juego reinicia',ng.m===0&&ng.s===24&&ng.w===0,ng);

// 8 dificultad 1 carta
await p.selectOption('#diffSel','1');await p.waitForTimeout(250);
const dd=await p.evaluate(()=>({draw:state.draw,ls:localStorage.getItem('klondike.diff'),m:state.moves}));
ok('dificultad 1 carta persiste',dd.draw===1&&dd.ls==='1'&&dd.m===0,dd);

await p.screenshot({path:'/tmp/shot2_klondike.png',fullPage:true});

// 9 home nav
await p.click('.top a.brand');await p.waitForTimeout(500);
ok('logo lleva al indice',(await p.title())==='Juegos',await p.title());

ok('sin errores JS',errs.length===0,errs);
console.log(fails?`KLONDIKE: ${fails} FAIL`:'KLONDIKE: ALL PASS');
await b.close();
process.exit(fails?1:0);
})().catch(e=>{console.error('CRASH',e);process.exit(2);});
