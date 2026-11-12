const {chromium}=require('playwright');
const URL=process.argv[2]||'http://localhost:8899/damas.html';
let fails=0;
const ok=(n,c,x)=>{console.log((c?'PASS ':'FAIL ')+n+(c?'':' -> '+JSON.stringify(x)));if(!c)fails++;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitTurn(p,turn,ms){
  const t0=Date.now();
  while(Date.now()-t0<(ms||15000)){
    const t=await p.evaluate(()=>S.turn);
    if(t===turn)return true;
    await sleep(150);
  }
  return false;
}
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
  hasS:typeof S!=='undefined', hasGen:typeof generateMoves!=='undefined',
  hasInit:typeof initialState!=='undefined', hasCh:typeof chooseMove!=='undefined',
  pieces:S?S.board.flat().filter(x=>x).length:0,
  red:S?S.board.flat().filter(x=>x==='r'||x==='R').length:0,
  black:S?S.board.flat().filter(x=>x==='b'||x==='B').length:0,
  sqs:document.querySelectorAll('.sq').length,
  turn:S?S.turn:null
}));
ok('globals del motor',init.hasS&&init.hasGen&&init.hasInit&&init.hasCh,init);
ok('8x8 = 64 casillas',init.sqs===64,init);
ok('12 piezas rojas + 12 negras, turno r',init.red===12&&init.black===12&&init.turn==='r',init);

// 2 seleccion + puntos de destino
const mv=await p.evaluate(()=>generateMoves(S)[0]);
ok('movimiento legal disponible',!!mv,mv);
if(mv){
  await p.click(`.sq[data-r="${mv.path[0][0]}"][data-c="${mv.path[0][1]}"]`);
  await p.waitForTimeout(150);
  const sel=await p.evaluate(()=>({sel:document.querySelectorAll('.sq.sel').length,dest:document.querySelectorAll('.sq.dest').length}));
  ok('selecciona pieza + puntos destino',sel.sel===1&&sel.dest>0,sel);

  // 3 click-click mueve
  const initBoard=await p.evaluate(()=>JSON.stringify(initialState().board));
  await p.click(`.sq[data-r="${mv.path[1][0]}"][data-c="${mv.path[1][1]}"]`);
  let changed=false;
  const t0=Date.now();
  while(Date.now()-t0<5000){
    const eq=await p.evaluate(b=>JSON.stringify(S.board)===b,initBoard);
    if(!eq){changed=true;break;}
    await sleep(80);
  }
  ok('jugada aplicada (tablero cambia)',changed,await p.evaluate(()=>S.turn));
  const lastSq=await p.evaluate(()=>document.querySelectorAll('.sq.last').length);
  ok('resalta ultimo movimiento',lastSq===2,lastSq);

  // 4 IA responde
  const replied=await waitTurn(p,'r',20000);
  ok('IA negras responde y turno vuelve a rojas',replied,await p.evaluate(()=>S.turn));
}

// 5 deshacer par (tu jugada + IA)
await p.click('#btnUndo');await p.waitForTimeout(250);
const und=await p.evaluate(()=>({turn:S.turn,eq:JSON.stringify(S.board)===JSON.stringify(initialState().board)}));
ok('deshacer restaura posicion inicial',und.turn==='r'&&und.eq,und);

// 6 arrastrar
const mv2=await p.evaluate(()=>generateMoves(S)[0]);
if(mv2){
  const s0=await p.evaluate(()=>JSON.stringify(S.board));
  const a=await p.$(`.sq[data-r="${mv2.path[0][0]}"][data-c="${mv2.path[0][1]}"]`);
  const t=await p.$(`.sq[data-r="${mv2.path[1][0]}"][data-c="${mv2.path[1][1]}"]`);
  const ab=await a.boundingBox(), tb=await t.boundingBox();
  await p.mouse.move(ab.x+ab.width/2,ab.y+ab.height/2);
  await p.mouse.down();
  await p.mouse.move(tb.x+tb.width/2,tb.y+tb.height/2,{steps:8});
  await p.waitForTimeout(120);
  await p.mouse.up();
  let s1=s0;
  const t1=Date.now();
  while(Date.now()-t1<6000){
    s1=await p.evaluate(()=>JSON.stringify(S.board));
    if(s1!==s0)break;
    await sleep(80);
  }
  ok('arrastre mueve pieza',s0!==s1,{changed:s0!==s1});
}

// 7 nuevo juego
await p.click('#btnNew');await p.waitForTimeout(300);
const ng=await p.evaluate(()=>({turn:S.turn,eq:JSON.stringify(S.board)===JSON.stringify(initialState().board),moves:document.querySelector('#moves').textContent,win:document.querySelector('#win').classList.contains('show')}));
ok('nuevo juego reinicia',ng.turn==='r'&&ng.eq&&ng.moves==='0'&&!ng.win,ng);

// 8 pista
await p.click('#btnHint');await p.waitForTimeout(250);
const hint=await p.evaluate(()=>({h:document.querySelectorAll('.sq.hint').length,t:document.querySelector('#toast').classList.contains('show')}));
ok('pista resalta algo',hint.h>0||hint.t,hint);

// 9 dificultad
await p.selectOption('#diffSel','3');await p.waitForTimeout(300);
const diff=await p.evaluate(()=>localStorage.getItem('damas.diff'));
ok('dificultad persiste',diff==='3',diff);

await p.screenshot({path:'/tmp/shot_damas.png',fullPage:true});
ok('sin errores JS',errs.length===0,errs);
console.log(fails?`DAMAS(${URL}): ${fails} FAIL`:'DAMAS: ALL PASS');
await b.close();
process.exit(fails?1:0);
})().catch(e=>{console.error('CRASH',e);process.exit(2);});
