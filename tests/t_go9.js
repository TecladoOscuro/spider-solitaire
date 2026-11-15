const {chromium}=require('/Users/fabrilobo/spider-solitaire/tests/node_modules/playwright');
const URL='http://localhost:8899/go9.html';
let fails=0;
const ok=(n,c,x)=>{console.log((c?'PASS ':'FAIL ')+n+(c?'':' -> '+JSON.stringify(x)));if(!c)fails++;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitTurn(p,turn,ms){
  const t0=Date.now();
  while(Date.now()-t0<ms){
    const s=await p.evaluate(()=>({t:state.turn,over:state.over,busy:busy}));
    if(s.over||(!s.busy&&s.t===turn)) return true;
    await sleep(120);
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
await p.goto(URL);await sleep(500);

// 1 estructura
const l=await p.evaluate(()=>({
  pts:document.querySelectorAll('#board .pt').length,
  lines:document.querySelectorAll('#board .ln').length,
  hoshi:document.querySelectorAll('#board .hoshi').length,
  legal:document.querySelectorAll('#board .pt.legal').length,
  gen:typeof initialState==='function'&&typeof group==='function'&&typeof neighbors==='function'&&
      typeof wouldCapture==='function'&&typeof legal==='function'&&typeof play==='function'&&
      typeof pass==='function'&&typeof score==='function'&&typeof status==='function'&&
      typeof chooseMove==='function'&&typeof render==='function',
  turn:state.turn, over:state.over,
  title:document.title
}));
ok('81 intersecciones +81 líneas +5 hoshi',l.pts===81&&l.lines===81&&l.hoshi===5,l);
ok('81 puntos legales al empezar',l.legal===81,l.legal);
ok('motor + render globales',l.gen,l.gen);
ok('título Go 9×9',l.title==='Go 9×9',l.title);

// 2 primer jugador coloca, IA responde
const mv=await p.evaluate(()=>legalMoves(state)[0]);
await p.click(`#board [data-i="${mv}"]`);await sleep(250);
const placed=await p.evaluate(()=>({stones:countStones(state),placing:document.querySelectorAll('#board .stone.placing').length}));
ok('piedra negra colocada con animación',placed.stones.b===1&&placed.placing>=1,placed);
const aiDone=await waitTurn(p,'b',12000);
const after=await p.evaluate(()=>({t:state.turn,st:countStones(state),cap:state.captures}));
ok('IA blancas responde (turno negras, 2 piedras)',aiDone&&after.t==='b'&&after.st.b===1&&after.st.w===1,after);

// 3 cadena + libertades al tocar piedra
await p.hover('.status');await sleep(120);
await p.hover(`#board [data-i="${mv}"]`);await sleep(200);
const ch=await p.evaluate(()=>({chain:document.querySelectorAll('#board .pt.chain').length,lib:document.querySelectorAll('#board .pt.lib').length,chaining:document.querySelector('#board').classList.contains('chaining')}));
ok('cadena y libertades resaltadas al pasar el cursor',ch.chain>=1&&ch.chaining,ch);

// 4 jugada ilegal → toast + casilla roja (suicidio)
await p.evaluate(()=>{
  state=initialState();
  var rows=['www......','w.w......','www......'];
  for(var r=0;r<3;r++) for(var c=0;c<9;c++){ var ch=rows[r].charAt(c); if(ch==='b'||ch==='w') state.cells[r*9+c]=ch; }
  state.turn='b'; undoStack=[]; movesCount=0; render();
});
await p.click('#board [data-i="10"]');await sleep(120);
const bad=await p.evaluate(()=>({toast:document.querySelector('#toast').textContent,show:document.querySelector('#toast').classList.contains('show'),bad:document.querySelectorAll('#board .pt.bad').length,cell:state.cells[10]}));
ok('ilegal → toast con motivo + casilla roja, sin piedra',/Suicidio/.test(bad.toast)&&bad.show&&bad.bad===1&&bad.cell===null,bad);

// 5 PASAR (jugador) → la IA juega
await p.evaluate(()=>{state=initialState();render();});
await p.click('#btnPass');await sleep(200);
const pass1=await p.evaluate(()=>({pases:state.pases,t:state.turn,toast:document.querySelector('#toast').textContent}));
ok('Pasar: pase del jugador contado',pass1.pases===1&&pass1.t==='w',pass1);
const ai2=await waitTurn(p,'b',12000);
ok('la IA no pasa: juega y limpia pases',ai2&&await p.evaluate(()=>state.pases===0&&countStones(state).w===1),await p.evaluate(()=>({p:state.pases,st:countStones(state)})));

// 6 deshacer
await p.click('#btnUndo');await sleep(300);
const und=await p.evaluate(()=>({t:state.turn,st:countStones(state)}));
ok('Deshacer vuelve al inicio',und.t==='b'&&und.st.b===0&&und.st.w===0,und);

// 7 pista
await p.click('#btnHint');await sleep(300);
const hint=await p.evaluate(()=>({hl:document.querySelectorAll('#board .pt.hint').length,toast:document.querySelector('#toast').textContent}));
ok('Pista resalta la jugada recomendada',hint.hl===1,hint);

// 8 dificultad persiste
await p.selectOption('#diffSel','1');await sleep(300);
ok('go9.diff persiste',await p.evaluate(()=>localStorage.getItem('go9.diff'))==='1',await p.evaluate(()=>localStorage.getItem('go9.diff')));

// 9 partida completa (negras jugando la primera legal) hasta overlay
let plies=0;
while(plies++<400){
  const st=await p.evaluate(()=>({over:state.over,t:state.turn,busy:busy,set:settled(state)}));
  if(st.over) break;
  if(st.t==='b'&&!st.busy){
    if(st.set){ await p.click('#btnPass'); await sleep(250); continue; }
    const m=await p.evaluate(()=>{const L=legalMoves(state);return L.length?L[0]:null;});
    if(m===null){ await p.click('#btnPass'); await sleep(250); continue; }
    await p.click(`#board [data-i="${m}"]`);
    await sleep(150);
    await waitTurn(p,'b',12000);
  } else await sleep(250);
}
let shown=false;
const t0=Date.now();
while(Date.now()-t0<6000){
  if(await p.evaluate(()=>document.querySelector('#win').classList.contains('show'))){shown=true;break;}
  await sleep(200);
}
const fin=await p.evaluate(()=>({over:state.over,result:state.result,show:document.querySelector('#win').classList.contains('show'),
  count:document.querySelector('#winCount').textContent,stats:document.querySelector('#winStats').textContent,
  wld:document.querySelector('#stWLD').textContent,cap:document.querySelector('#stCap').textContent}));
ok('partida completa termina (doble pase)',fin.over&&['b','w'].includes(fin.result),fin);
ok('overlay con recuento',shown&&fin.show&&/\d/.test(fin.count),fin);
ok('overlay desglosa territorio+capturas+komi',/Territorio/.test(fin.stats)&&/Komi 5.5/.test(fin.stats),fin.stats);
ok('récord V-D-E persistido (go9.stats)',
   /^\d+-\d+-\d+$/.test(fin.wld)&&fin.wld.split('-').reduce((a,b)=>a+ +b,0)>=1&&await p.evaluate(()=>!!localStorage.getItem('go9.stats')),
   {wld:fin.wld,ls:await p.evaluate(()=>localStorage.getItem('go9.stats'))});

await p.screenshot({path:'/tmp/vis_go9_win.png'});
await p.click('#btnAgain');await sleep(400);
const fresh=await p.evaluate(()=>({st:countStones(state),over:state.over,legal:document.querySelectorAll('#board .pt.legal').length}));
ok('Jugar otra vez reinicia',fresh.st.b===0&&fresh.st.w===0&&!fresh.over&&fresh.legal===81,fresh);
await p.screenshot({path:'/tmp/vis_go9.png'});

// 10 captura animada (fixture: negras capturan 2)
await p.evaluate(()=>{
  state=initialState();
  var rows=['bwb......','bwb......'];
  for(var r=0;r<2;r++) for(var c=0;c<9;c++){ var ch=rows[r].charAt(c); if(ch==='b'||ch==='w') state.cells[r*9+c]=ch; }
  state.turn='b'; undoStack=[]; movesCount=0; render();
});
await p.click('#board [data-i="19"]');await sleep(180);
const cap=await p.evaluate(()=>({dying:document.querySelectorAll('#board .stone.dying').length,cap:state.captures.b,toast:document.querySelector('#toast').textContent}));
ok('captura animada (piedras desaparecen) + contador',cap.dying===2&&cap.cap===2,/Captura/.test(cap.toast),cap);
await sleep(700);
const cap2=await p.evaluate(()=>({dying:document.querySelectorAll('#board .stone.dying').length,st:countStones(state)}));
ok('las piedras capturadas desaparecen del tablero',cap2.dying===0&&cap2.st.w===0,cap2);

await p.click('.top a.brand');await sleep(450);
ok('logo lleva al índice',(await p.title())==='Juegos',await p.title());
ok('sin errores JS',errs.length===0,errs);
console.log(fails?`GO9 BROWSER: ${fails} FAIL`:'GO9 BROWSER: ALL PASS');
await b.close();
process.exit(fails?1:0);
})().catch(e=>{console.error('CRASH',e);process.exit(2);});
