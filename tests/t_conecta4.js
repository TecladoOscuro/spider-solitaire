const {chromium}=require('playwright');
const URL=process.argv[2]||'http://localhost:8899/conecta4.html';
let fails=0;
const ok=(n,c,x)=>{console.log((c?'PASS ':'FAIL ')+n+(c?'':' -> '+JSON.stringify(x)));if(!c)fails++;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitTurn(p,turn,ms){
  const t0=Date.now();
  while(Date.now()-t0<ms){
    const s=await p.evaluate(()=>({t:state.turn,over:state.over}));
    if(s.over||s.t===turn) return true;
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
await p.goto(URL);await p.waitForTimeout(450);

// 1 globals + layout
const l=await p.evaluate(()=>{
  const cells=document.querySelectorAll('#board [data-i],#board .cell');
  return {cells:cells.length, discs:state.cells.filter(Boolean).length, turn:state.turn,
    legal:legalMoves(state).length, arrows:document.querySelectorAll('#picks *,#board .arrow,.arrow').length,
    gen:typeof applyMove==='function'&&typeof generateMoves==='function'&&typeof chooseMove==='function'};
});
ok('42 casillas vacias, turno rojas',l.cells===42&&l.discs===0&&l.turn==='r',l);
ok('7 columnas jugables',l.legal===7,l.legal);
ok('motor global',l.gen,l);

// 2 juega rojas -> IA
const cell=await p.evaluate(()=>{
  const el=document.querySelector('#board [data-i]')||document.querySelector('#board .cell');
  return el.className.indexOf('cell')>=0?'cell':'other';
});
await p.click('#picks > :nth-child(4)').catch(async()=>{ await p.click('#board'); });
const s1=await (async()=>{const t0=Date.now();while(Date.now()-t0<3000){const s=await p.evaluate(()=>({t:state.turn,n:state.cells.filter(Boolean).length}));if(s.n>=1)return s;await sleep(80);}return{t:null,n:0};})();
ok('roja cae en el tablero',s1.n>=1,s1);
const ai=await waitTurn(p,'r',8000);
ok('IA amarilla responde',ai&&await p.evaluate(()=>state.cells.filter(Boolean).length===2),await p.evaluate(()=>({t:state.turn,n:state.cells.filter(Boolean).length})));

// 3 deshacer (par)
await p.click('#btnUndo');await sleep(350);
const und=await p.evaluate(()=>({n:state.cells.filter(Boolean).length,t:state.turn}));
ok('deshacer revierte el par',und.n===0&&und.t==='r',und);

// 4 pista
await p.click('#btnHint');await sleep(300);
const hint=await p.evaluate(()=>({h:document.querySelectorAll('.hint,.column.hl,[class*=hint]').length-0,toast:document.querySelector('#toast').classList.contains('show')}));
ok('pista resalta columna',hint.h>0||hint.toast,hint);

// 5 dificultad
await p.selectOption('#diffSel','3');await sleep(350);
const d3=await p.evaluate(()=>({ls:localStorage.getItem('c4.diff'),n:state.cells.filter(Boolean).length}));
ok('dificultad persiste y reinicia',d3.ls==='3'&&d3.n===0,d3);
await p.selectOption('#diffSel','1');await sleep(350);

// 6 partida completa (rojas = primera legal, IA nivel1)
let plies=0;
while(plies++<50){
  const st=await p.evaluate(()=>({over:state.over,t:state.turn}));
  if(st.over) break;
  if(st.t==='r'){
    const m=await p.evaluate(()=>legalMoves(state)[0]);
    await p.click(`#picks > :nth-child(${m+1})`).catch(async()=>{ await p.click('#board'); });
    await sleep(300);
    await waitTurn(p,'r',9000);
  } else await sleep(250);
}
const shown=await (async()=>{const t0=Date.now();while(Date.now()-t0<6000){if(await p.evaluate(()=>document.querySelector('#win').classList.contains('show')))return true;await sleep(200);}return false;})();
const fin=await p.evaluate(()=>{
  const won=document.querySelectorAll('.cell.won,#board .won').length;
  return {over:state.over,result:state.result,line:state.line,won,
    show:document.querySelector('#win').classList.contains('show'),
    title:document.querySelector('#winTitle').textContent,
    stats:document.querySelector('#statW').textContent+'/'+document.querySelector('#statD').textContent+'/'+document.querySelector('#statL').textContent};
});
ok('partida termina con linea',fin.over&&fin.line&&fin.line.length===4,fin);
ok('overlay con linea pulsante',shown&&fin.show&&fin.won===4,{shown,show:fin.show,won:fin.won});
const statsOK=fin.result==='r'?fin.stats.startsWith('1/'):fin.result==='y'?fin.stats.endsWith('/1'):fin.stats.startsWith('0/1');
ok('stats registran resultado',statsOK,fin.stats);

await p.screenshot({path:'/tmp/vis_conecta4_win.png',fullPage:false});
await p.click('#btnAgain');await sleep(350);
await p.screenshot({path:'/tmp/vis_conecta4.png',fullPage:false});
await p.click('.top a.brand');await sleep(450);
ok('logo lleva al indice',(await p.title())==='Juegos',await p.title());
ok('sin errores JS',errs.length===0,errs);
console.log(fails?`CONECTA4: ${fails} FAIL`:'CONECTA4: ALL PASS');
await b.close();
process.exit(fails?1:0);
})().catch(e=>{console.error('CRASH',e);process.exit(2);});
