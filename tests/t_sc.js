const {chromium}=require('playwright');
const URL=process.argv[2]||'http://localhost:8899/damas-chinas.html';
let fails=0;
const ok=(n,c,x)=>{console.log((c?'PASS ':'FAIL ')+n+(c?'':' -> '+JSON.stringify(x)));if(!c)fails++;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const vmap=async p=>p.evaluate(()=>{const a=new Array(121).fill('');document.querySelectorAll('#board .cell').forEach(e=>{a[+e.dataset.i]=e.dataset.v||'';});return JSON.stringify(a);});
(async()=>{
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1440,height:900}});
p.setDefaultTimeout(8000);
const errs=[];
p.on('pageerror',e=>errs.push('pageerror: '+e.message));
p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
p.on('dialog',d=>d.accept().catch(()=>{}));
await p.goto(URL);await p.waitForTimeout(600);

// 1 layout + globals
const l=await p.evaluate(()=>{
  const pts=[...document.querySelectorAll('#board .cell')];
  return {n:pts.length, r:pts.filter(e=>e.dataset.v==='r').length, bb:pts.filter(e=>e.dataset.v==='b').length,
    gen:typeof movesFrom==='function'&&typeof applyMove==='function'&&typeof chooseMove==='function',
    turn:typeof state!=='undefined'?state.turn:null};
});
ok('121 casillas,10+10 fichas',l.n===121&&l.r===10&&l.bb===10,l);
ok('motor global, turno rojas',l.gen&&l.turn==='r',l);

// 2 seleccionar ficha roja con jugada
const mv=await p.evaluate(()=>{
  const pts=[...document.querySelectorAll('#board .cell')];
  for(const e of pts){
    if(e.dataset.v==='r'){
      const ms=movesFrom(state,+e.dataset.i);
      if(ms.length) return {i:+e.dataset.i, to:ms[0].to};
    }
  }
  return null;
});
ok('ficha roja con jugada legal',!!mv,mv);
const before=await vmap(p);
// clics sintéticos (element.click): misma ruta de listener/handler, estable en entorno headless
const selR=await p.evaluate(()=>{
  for(const e of document.querySelectorAll('#board .cell')){
    if(e.dataset.v==='r'){const ms=movesFrom(state,+e.dataset.i); if(ms.length){e.click();return {i:+e.dataset.i,to:ms[0].to};}}
  }
  return null;
});
await sleep(250);
const dots=await p.evaluate(()=>document.querySelectorAll('#board .dest').length);
ok('destinos legales visibles',dots>0,dots);
const preB=await p.evaluate(()=>JSON.stringify([...document.querySelectorAll('#board .cell')].filter(e=>e.dataset.v==='b').map(e=>+e.dataset.i)));
await p.evaluate(t=>{document.querySelector('#board .cell[data-i="'+t+'"]').click();},selR.to);
await sleep(700);
const afterMove=await vmap(p);
const A=JSON.parse(afterMove);
ok('sliding aplica',afterMove!==before&&A[selR.i]===''&&A[selR.to]==='r',{i:selR.i,to:selR.to,from:A[selR.i],to2:A[selR.to]});
// la IA juega a los60ms: se mide por el movimiento de las NEGRAS (la jugada humana no las toca)
const postB=await p.evaluate(()=>JSON.stringify([...document.querySelectorAll('#board .cell')].filter(e=>e.dataset.v==='b').map(e=>+e.dataset.i)));
const turnBack=await p.evaluate(()=>state.turn);
ok('IA negras responde',postB!==preB&&turnBack==='r',{preB,postB,turnBack});

// 4 deshacer (par completo)
await p.click('#btnUndo');await sleep(400);
const undone=await vmap(p);
ok('deshacer restaura el inicio',undone===before);

// 5 dificultad
await p.selectOption('#diffSel','3');await sleep(400);
const d3=await p.evaluate(()=>({ls:localStorage.getItem('sc.diff'),n:[...document.querySelectorAll('#board .cell')].filter(e=>e.dataset.v).length}));
ok('dificultad persiste y reinicia',d3.ls==='3'&&d3.n===20,d3);

await p.screenshot({path:'/tmp/vis_damaschinas.png',fullPage:false});
await p.click('.top a.brand');await sleep(450);
ok('logo lleva al indice',(await p.title())==='Juegos',await p.title());
ok('sin errores JS',errs.length===0,errs);
console.log(fails?`DAMAS-CHINAS: ${fails} FAIL`:'DAMAS-CHINAS: ALL PASS');
await b.close();
process.exit(fails?1:0);
})().catch(e=>{console.error('CRASH',e);process.exit(2);});
