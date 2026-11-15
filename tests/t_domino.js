const {chromium}=require('playwright');
const URL=process.argv[2]||'http://localhost:8899/domino.html';
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

// 1 estado inicial (+ posible apertura de la IA)
const l0=await p.evaluate(()=>({h:Object.values(state.hands).map(a=>a.length),stock:state.stock.length,
  turn:state.turn,gen:typeof play==='function'&&typeof legalPlays==='function'&&typeof chooseMove==='function',
  tiles:document.querySelectorAll('#handWrap > *').length,chain:document.querySelectorAll('#chain > *').length}));
ok('14 fichas repartidas (7+7) o13+abierta, pozo14, motor',(l0.h[0]+l0.h[1]===14||l0.h[0]+l0.h[1]===13)&&l0.stock===14&&l0.gen,l0);
// turno mio: si abre la IA, esperar
let mine=false;
const t0=Date.now();
while(Date.now()-t0<8000){
  const s=await p.evaluate(()=>({turn:state.turn,over:state.over}));
  if(s.turn==='r'||s.over){mine=true;break;}
  await sleep(200);
}
ok('turno del humano alcanzable (o fin)',mine);

// 2 juega: clic en fichas hasta que avance la cadena
if(mine){
  const chain0=await p.evaluate(()=>document.querySelectorAll('#chain > *').length);
  let acted=false;
  for(let k=0;k<16&&!acted;k++){
    const g=await p.evaluate(()=>({lp:legalPlays(state).length,stock:state.stock.length,turn:state.turn}));
    if(g.turn!=='r') { acted=true; break; }
    if(g.lp===0){
      if(g.stock>0){ await p.click('#stock'); await sleep(450); continue; }
      await sleep(700);
      if((await p.evaluate(()=>state.turn))!=='r'){ acted=true; }
      continue;
    }
    const kids=await p.evaluate(()=>document.querySelectorAll('#handWrap > *').length);
    if(k>=kids) break;
    const el=await p.$('#handWrap > *:nth-child('+(k%kids+1)+')');
    const bb=await el.boundingBox();
    await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2);
    await p.mouse.down();await p.mouse.up();
    await sleep(420);
    const now=await p.evaluate(()=>({chain:document.querySelectorAll('#chain > *').length,turn:state.turn}));
    if(now.chain>chain0||now.turn==='y') acted=true;
  }
  const pl=await p.evaluate(()=>({chain:document.querySelectorAll('#chain > *').length,turn:state.turn}));
  ok('juega, roba si toca o pasa: la cadena o el turno avanza',(pl.chain>chain0||pl.turn==='y'),{chain0,...pl});

  // 3 deshacer
  await p.click('#btnUndo');await sleep(400);
  const und=await p.evaluate(()=>({turn:state.turn,h:Object.values(state.hands).map(a=>a.length)}));
  ok('deshacer',und.h.includes(7)||und.turn==='r',und);
}

// 4 dificultad
await p.selectOption('#diffSel','3');await sleep(450);
const d3=await p.evaluate(()=>({ls:localStorage.getItem('dm.diff'),h:Object.values(state.hands).map(a=>a.length),stock:state.stock.length}));
ok('dificultad persiste y reparte14',d3.ls==='3'&&(d3.h[0]+d3.h[1]===14||d3.h[0]+d3.h[1]===13)&&d3.stock===14,d3);

await p.screenshot({path:'/tmp/vis_domino.png',fullPage:false});
await p.click('.top a.brand');await sleep(450);
ok('logo lleva al indice',(await p.title())==='Juegos',await p.title());
ok('sin errores JS',errs.length===0,errs);
console.log(fails?`DOMINO-UI: ${fails} FAIL`:'DOMINO-UI: ALL PASS');
await b.close();
process.exit(fails?1:0);
})().catch(e=>{console.error('CRASH',e);process.exit(2);});
