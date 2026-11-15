const {chromium}=require('playwright');
const URL=process.argv[2]||'http://localhost:8899/serpiente.html';
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
  cells:document.querySelectorAll('#board > *').length,
  n:state.size, len:state.snake.length, over:state.over, score:state.score,
  dpad:document.querySelectorAll('#dpad [data-d]').length,
  opts:document.querySelectorAll('#diffSel option').length,
  gen:typeof step==='function'&&typeof setDir==='function'&&typeof spawnFood==='function'
}));
ok('400 celdas, serpiente3, tablero20',l.cells===400&&l.len===3&&l.n===20,l);
ok('dpad4 +3 niveles + motor',l.dpad===4&&l.opts===3&&l.gen,l);

// 2 giro ANTES de chocar (la serpiente llega al muro en ~1.2s)
await p.keyboard.press('ArrowDown');await sleep(150);
const d=await p.evaluate(()=>({dir:state.dir,nd:state.nextDir,over:state.over}));
ok('flecha abajo cambia la dirección',!d.over&&(d.dir==='down'||d.nd==='down'),d);

// 3b pausa / reanuda (justo tras el giro, como en la prueba aislada)
await p.keyboard.press(' ');await sleep(150);
const p0=await p.evaluate(()=>({s:JSON.stringify(state.snake),over:state.over}));
await sleep(500);
const p1=await p.evaluate(()=>({s:JSON.stringify(state.snake),over:state.over}));
ok('Espacio pausa (no avanza, sin over)',p0.s===p1.s&&!p0.over);
await p.keyboard.press(' ');await sleep(450);
const p2=await p.evaluate(()=>({s:JSON.stringify(state.snake),over:state.over,txt:document.querySelector('#status').textContent}));
ok('Espacio reanuda',p2.s!==p1.s&&!p2.over&&/marcha/i.test(p2.txt),p2);

// 3 avanza solo
const h0=await p.evaluate(()=>state.snake[0].join(','));
await sleep(700);
const h1=await p.evaluate(()=>state.snake[0].join(','));
ok('la serpiente avanza con el tiempo',h0!==h1,{h0,h1});



// 5 dificultad
await p.selectOption('#diffSel','3');await sleep(400);
const d3=await p.evaluate(()=>({ls:localStorage.getItem('snake.diff'),n:state.size,score:state.score}));
ok('dificultad persiste y reinicia',d3.ls==='3'&&d3.n===20&&d3.score===0,d3);

// 6 muerte contra muro (baja hasta el borde)
await p.keyboard.press('ArrowDown');
let over=false;
const t0=Date.now();
while(Date.now()-t0<15000){
  over=await p.evaluate(()=>state.over);
  if(over) break;
  await sleep(250);
}
await sleep(600);
const fin=await p.evaluate(()=>({over:state.over,show:document.querySelector('#win').classList.contains('show'),
  t:document.querySelector('#winStats')?document.querySelector('#winStats').textContent:''}));
ok('muerte por muro -> overlay',over&&fin.show,fin);

await p.screenshot({path:'/tmp/vis_serpiente.png',fullPage:false});
await p.click('#btnAgain');await sleep(400);
await p.click('.top a.brand');await sleep(450);
ok('logo lleva al indice',(await p.title())==='Juegos',await p.title());
ok('sin errores JS',errs.length===0,errs);
console.log(fails?`SERPIENTE: ${fails} FAIL`:'SERPIENTE: ALL PASS');
await b.close();
process.exit(fails?1:0);
})().catch(e=>{console.error('CRASH',e);process.exit(2);});
