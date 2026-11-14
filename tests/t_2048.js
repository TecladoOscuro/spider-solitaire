const {chromium}=require('playwright');
const URL=process.argv[2]||'http://localhost:8899/2048.html';
let fails=0;
const ok=(n,c,x)=>{console.log((c?'PASS ':'FAIL ')+n+(c?'':' -> '+JSON.stringify(x)));if(!c)fails++;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const snap=async p=>p.evaluate(()=>JSON.stringify(state.grid));
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
  cells:document.querySelectorAll('#cells .cell').length,
  tiles:document.querySelectorAll('#tiles .tile').length,
  n:state.size, t:state.grid.flat().filter(Boolean).length,
  score:document.querySelector('#statScore').textContent,
  gen:typeof move==='function'&&typeof slideLine==='function'&&typeof canMove==='function'
}));
ok('4x4 =16 celdas,2 casillas',l.cells===16&&l.n===4&&l.t===2&&l.tiles===2,l);
ok('motor global',l.gen,l);

// 2 mueve hasta que cambie (teclas)
let changed=false, before=await snap(p), dirs=['ArrowLeft','ArrowUp','ArrowRight','ArrowDown'];
for(const d of dirs){
  await p.keyboard.press(d); await sleep(650);
  const after=await snap(p);
  if(after!==before){ changed=true; break; }
}
const m1=await p.evaluate(()=>({t:state.grid.flat().filter(Boolean).length,score:state.score,sz:state.size}));
ok('flecha mueve y spawnea (+1 casilla o fusion)',changed&&m1.t>=2&&m1.t<=3&&m1.sz===4&&m1.score>=0,m1);

// 3 mas movimientos sin romper
for(const d of ['ArrowRight','ArrowDown','ArrowLeft','ArrowUp','ArrowRight']){
  await p.keyboard.press(d); await sleep(600);
}
const m2=await p.evaluate(()=>({t:state.grid.flat().filter(Boolean).length,over:state.over,score:state.score}));
ok('movimientos encadenados coherentes',m2.t>=2&&m2.t<=16&&m2.score>=0,m2);

// 4 deshacer (1 paso)
await p.keyboard.press('ArrowLeft'); await sleep(700);
const snapA=await snap(p);
await p.keyboard.press('ArrowDown'); await sleep(700);
const movedNow=(await snap(p))!==snapA;
await p.click('#btnUndo'); await sleep(650);
const undone=await snap(p);
ok('deshacer devuelve el paso anterior',!movedNow||undone===snapA,{movedNow,same:undone===snapA});

// 5 tamano experto
await p.selectOption('#sizeSel','6'); await sleep(500);
const sz6=await p.evaluate(()=>({cells:document.querySelectorAll('#cells .cell').length,n:state.size,ls:localStorage.getItem('2048.size'),t:state.grid.flat().filter(Boolean).length,pageX:document.documentElement.scrollWidth-document.documentElement.clientWidth}));
ok('6x6 =36 celdas, persiste, sin desborde',sz6.cells===36&&sz6.n===6&&sz6.ls==='6'&&sz6.t===2&&sz6.pageX<=1,sz6);

// 6 nuevo juego
await p.click('#btnNew'); await sleep(650);
const ng=await p.evaluate(()=>({t:state.grid.flat().filter(Boolean).length,score:state.score}));
ok('nuevo juego reinicia',ng.t===2&&ng.score===0,ng);

await p.screenshot({path:'/tmp/vis_2048.png',fullPage:false});
await p.click('.top a.brand'); await sleep(450);
ok('logo lleva al indice',(await p.title())==='Juegos',await p.title());
ok('sin errores JS',errs.length===0,errs);
console.log(fails?`2048: ${fails} FAIL`:'2048: ALL PASS');
await b.close();
process.exit(fails?1:0);
})().catch(e=>{console.error('CRASH',e);process.exit(2);});
