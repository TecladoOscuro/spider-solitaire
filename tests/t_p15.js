const {chromium}=require('playwright');
const URL=process.argv[2]||'http://localhost:8899/puzzle15.html';
let fails=0;
const ok=(n,c,x)=>{console.log((c?'PASS ':'FAIL ')+n+(c?'':' -> '+JSON.stringify(x)));if(!c)fails++;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1440,height:900}});
p.setDefaultTimeout(8000);
const errs=[];
p.on('pageerror',e=>errs.push('pageerror: '+e.message));
p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
p.on('dialog',d=>d.accept().catch(()=>{}));
await p.goto(URL);await sleep(600);

// 1 layout + globals
const l=await p.evaluate(()=>({
  tiles:state.tiles.length, perm:[...state.tiles].sort((a,b)=>a-b).join(',')==='0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15',
  solved:isSolved(state.tiles), lm:legalMoves(state.tiles).length,
  cells:document.querySelectorAll('#board > *').length,
  gen:typeof shuffle==='function'&&typeof slide==='function'
}));
ok('16 fichas, permutacion valida, barajado',l.tiles===16&&l.perm&&!l.solved&&l.cells===16,l);
ok('movimientos legales >0 + motor',l.lm>0&&l.gen,l.lm);

// 2 mover
const mv=await p.evaluate(()=>({i:legalMoves(state.tiles)[0],tiles:state.tiles.join(',')}));
const tileVal=await p.evaluate(i=>state.tiles[i],mv.i);
const sel=await p.evaluate(v=>{const e=document.querySelector('#board .tile[data-v="'+v+'"]');if(e){e.click();return true;}return false;},tileVal);
await sleep(350);
const moved=await p.evaluate(t=>({tiles:state.tiles.join(','),moves:state.moves}),0);
ok('clic en ficha movible la desliza',sel&&moved.tiles!==mv.tiles&&moved.moves===1,{sel,moves:moved.moves});

// 3 deshacer
await p.click('#btnUndo');await sleep(300);
const und=await p.evaluate(t=>state.tiles.join(',')===t,mv.tiles);
ok('deshacer restaura',und);

// 4 victoria forzada: tablero casi resuelto -> clic en15
await p.evaluate(()=>{ state.tiles=[1,2,3,4,5,6,7,8,9,10,11,12,13,14,0,15]; state.moves=5; });
await sleep(150);
const clicked=await p.evaluate(()=>{const e=document.querySelector('#board .tile[data-v="15"]');if(e){e.click();return true;}return false;});
await sleep(600);
const win=await p.evaluate(()=>({solved:isSolved(state.tiles),show:document.querySelector('#win').classList.contains('show'),
  t:document.querySelector('#winStats').textContent}));
ok('ultimo movimiento -> resuelto + overlay',clicked&&win.solved&&win.show&&win.t.length>5,win);

// 5 dificultad
await p.click('#btnAgain');await sleep(350);
await p.selectOption('#diffSel','3');await sleep(400);
const d3=await p.evaluate(()=>({ls:localStorage.getItem('p15.diff'),solved:isSolved(state.tiles),moves:state.moves}));
ok('experto persiste y baraja',d3.ls==='3'&&!d3.solved&&d3.moves===0,d3);

await p.screenshot({path:'/tmp/vis_puzzle15.png',fullPage:false});
await p.click('.top a.brand');await sleep(450);
ok('logo lleva al indice',(await p.title())==='Juegos',await p.title());
ok('sin errores JS',errs.length===0,errs);
console.log(fails?`P15: ${fails} FAIL`:'P15: ALL PASS');
await b.close();
process.exit(fails?1:0);
})().catch(e=>{console.error('CRASH',e);process.exit(2);});
