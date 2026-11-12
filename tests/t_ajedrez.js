const {chromium}=require('playwright');
const URL=process.argv[2]||'http://localhost:8899/ajedrez.html';
let fails=0;
const ok=(n,c,x)=>{console.log((c?'PASS ':'FAIL ')+n+(c?'':' -> '+JSON.stringify(x)));if(!c)fails++;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitTurn(p,turn,ms){
  const t0=Date.now();
  while(Date.now()-t0<(ms||20000)){
    const t=await p.evaluate(()=>state.turn);
    if(t===turn)return true;
    await sleep(150);
  }
  return false;
}
const idx=(f,r)=>r*8+f; // f=0..7 (a), r=0..7 (rank1)
(async()=>{
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1440,height:900}});
const errs=[];
p.on('pageerror',e=>errs.push('pageerror: '+e.message));
p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
p.on('dialog',d=>d.accept().catch(()=>{}));

await p.goto(URL);await p.waitForTimeout(400);

// 1 globals + layout
const init=await p.evaluate(()=>({
  hasSt:typeof state!=='undefined',hasGen:typeof generateMoves!=='undefined',
  hasSan:typeof toSAN!=='undefined',hasCh:typeof chooseMove!=='undefined',
  pieces:state?state.board.filter(x=>x).length:0,
  turn:state?state.turn:null,
  sqs:document.querySelectorAll('.sq').length,
  moves:document.querySelector('#moveList').children.length
}));
ok('globals del motor',init.hasSt&&init.hasGen&&init.hasSan&&init.hasCh,init);
ok('64 casillas',init.sqs===64,init);
ok('32 piezas, blancas primero',init.pieces===32&&init.turn==='w',init);
ok('lista de jugadas vacia',init.moves===0,init);

// 2 seleccion e2 → puntos legales
await p.click(`.sq[data-i="${idx(4,1)}"]`); // e2
await p.waitForTimeout(150);
const dots=await p.evaluate(()=>({sel:document.querySelectorAll('.sq.sel').length,dot:document.querySelectorAll('.sq.dot').length}));
ok('e2 seleccionado + puntos (e3,e4)',dots.sel===1&&dots.dot>=2,dots);

// 3 juega e4
await p.click(`.sq[data-i="${idx(4,3)}"]`); // e4
let list0='';
const t0=Date.now();
while(Date.now()-t0<5000){
  list0=await p.evaluate(()=>document.querySelector('#moveList').textContent);
  if(/e4/.test(list0))break;
  await sleep(80);
}
ok('e4 jugada',/e4/.test(list0),list0);
const lastN=await p.evaluate(()=>document.querySelectorAll('.sq.last').length);
ok('resalta ultimo movimiento (2 casillas)',lastN===2,lastN);

// 4 IA responde
const replied=await waitTurn(p,'w',25000);
ok('IA negras responde',replied,await p.evaluate(()=>state.turn));
const list2=await p.evaluate(()=>document.querySelector('#moveList').textContent);
ok('lista con respuesta negra (>=2 jugadas)',(await p.evaluate(()=>document.querySelector('#moveList').children.length))>=1&&list2.length>4,list2);

// 5 deshacer (par completo)
await p.click('#btnUndo');await p.waitForTimeout(300);
const und=await p.evaluate(()=>({turn:state.turn,eq:JSON.stringify(state.board)===JSON.stringify(initialState().board),list:document.querySelector('#moveList').children.length}));
ok('deshacer vuelve al inicio',und.turn==='w'&&und.eq&&und.list===0,und);

// 6 arrastre e2-e4
const ab=await (await p.$(`.sq[data-i="${idx(4,1)}"]`)).boundingBox();
const tb=await (await p.$(`.sq[data-i="${idx(4,3)}"]`)).boundingBox();
await p.mouse.move(ab.x+ab.width/2,ab.y+ab.height/2);
await p.mouse.down();
await p.mouse.move(tb.x+tb.width/2,tb.y+tb.height/2,{steps:8});
await p.waitForTimeout(120);
await p.mouse.up();
let dl='';
const t2=Date.now();
while(Date.now()-t2<5000){
  dl=await p.evaluate(()=>document.querySelector('#moveList').textContent);
  if(/e4/.test(dl))break;
  await sleep(80);
}
ok('arrastre juega e4',/e4/.test(dl),dl);
const replied2=await waitTurn(p,'w',25000);
ok('IA responde tras arrastre',replied2,await p.evaluate(()=>state.turn));

// 7 nuevo juego
await p.click('#btnNew');await p.waitForTimeout(350);
const ng=await p.evaluate(()=>({turn:state.turn,eq:JSON.stringify(state.board)===JSON.stringify(initialState().board),list:document.querySelector('#moveList').children.length,hMoves:document.querySelector('#hMoves').textContent,win:document.querySelector('#win').classList.contains('show')}));
ok('nuevo juego reinicia',ng.turn==='w'&&ng.eq&&ng.list===0&&ng.hMoves==='0'&&!ng.win,ng);

// 8 jaque: f3 e5 g4 Qh4 mate -> verificar deteccion en UI (rapido con dificultad 1? no: la IA no ayuda) => jugadas propias hasta que IA... skip mate en UI.
// 8 dificultad
await p.selectOption('#diffSel','2');await p.waitForTimeout(300);
const dif=await p.evaluate(()=>({ls:localStorage.getItem('ajedrez.diff'),h:document.querySelector('#hDiff').textContent}));
ok('dificultad cambia y persiste',dif.ls==='2'&&dif.h==='1200',dif);

// 9 deshacer con lista vacia no rompe
await p.click('#btnUndo');await p.waitForTimeout(200);
ok('deshacer sin historia no rompe',(await p.evaluate(()=>state.board.filter(x=>x).length))===32);

await p.screenshot({path:'/tmp/shot_ajedrez.png',fullPage:true});
ok('sin errores JS',errs.length===0,errs);
console.log(fails?`AJEDREZ(${URL}): ${fails} FAIL`:'AJEDREZ: ALL PASS');
await b.close();
process.exit(fails?1:0);
})().catch(e=>{console.error('CRASH',e);process.exit(2);});
