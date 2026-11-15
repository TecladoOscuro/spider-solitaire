const {chromium}=require('playwright');
const URL=process.argv[2]||'http://localhost:8899/sopa-de-letras.html';
let fails=0;
const ok=(n,c,x)=>{console.log((c?'PASS ':'FAIL ')+n+(c?'':' -> '+JSON.stringify(x)));if(!c)fails++;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const tapCell=async(p,r,c)=>{
  const el=await p.$('#board .cell[data-r="'+r+'"][data-c="'+c+'"]');
  const bb=await el.boundingBox();
  await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2);
  await p.mouse.down();await p.mouse.up();
};
(async()=>{
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1440,height:900}});
p.setDefaultTimeout(8000);
const errs=[];
p.on('pageerror',e=>errs.push('pageerror: '+e.message));
p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
p.on('dialog',d=>d.accept().catch(()=>{}));
await p.goto(URL);await sleep(600);

const l=await p.evaluate(()=>({cells:document.querySelectorAll('#board .cell').length,n:state.size,
  words:state.words.length,found:state.found.length,gen:typeof checkSelection==='function'&&typeof isWon==='function'}));
ok('rejilla10x10,8 palabras, motor',l.cells===100&&l.n===10&&l.words===8&&l.found===0&&l.gen,l);

// encontra1 por toque-toque
const w0=await p.evaluate(()=>({a:state.words[0].cells[0],b:state.words[0].cells[state.words[0].cells.length-1],word:state.words[0].word}));
await tapCell(p,w0.a[0],w0.a[1]);await sleep(200);
const anch=await p.evaluate(()=>({anchors:document.querySelectorAll('#board .anchor,#board [class*=anchor],#board .sel').length}));
await tapCell(p,w0.b[0],w0.b[1]);await sleep(350);
const f1=await p.evaluate(()=>({found:state.found.length,marked:document.querySelectorAll('.witem.on,#wordList .on,#wordList [class*=on]').length}));
ok('seleccion toque-toque encuentra la palabra',f1.found===1&&f1.marked>=1,{word:w0.word,...f1,anch});

// gana con el resto
let guard=0;
while(guard++<30){
  const done=await p.evaluate(()=>state.found.length);
  const total=await p.evaluate(()=>state.words.length);
  if(done>=total) break;
  const w=await p.evaluate(()=>{const f=state.found.length;const wd=state.words[f];return {a:wd.cells[0],b:wd.cells[wd.cells.length-1]};});
  await tapCell(p,w.a[0],w.a[1]);await sleep(140);
  await tapCell(p,w.b[0],w.b[1]);await sleep(200);
}
let shown=false;const tw=Date.now();
while(Date.now()-tw<5000){ if(await p.evaluate(()=>document.querySelector('#win').classList.contains('show'))){shown=true;break;} await sleep(200); }
const win=await p.evaluate(()=>({won:isWon(state),found:state.found.length,words:state.words.length,show:document.querySelector('#win').classList.contains('show'),st:document.querySelector('#winStats').textContent}));
ok('todas -> victoria + overlay',win.won&&win.found===win.words&&win.show&&win.st.length>5,win);

await p.screenshot({path:'/tmp/vis_sopa.png',fullPage:false});
await p.click('#btnAgain').catch(()=>{});await sleep(350);

// dificultad experto
await p.selectOption('#diffSel','2');await sleep(500);
const d2=await p.evaluate(()=>({ls:localStorage.getItem('sl.diff'),n:state.size,cells:document.querySelectorAll('#board .cell').length,words:state.words.length,
  hs:(()=>{const gw=document.querySelector('#board');return gw.scrollWidth-gw.clientWidth;})(),
  pageX:document.documentElement.scrollWidth-document.documentElement.clientWidth}));
ok('experto15x15=225 celdas/12 palabras, sin scroll ni desborde',d2.ls==='2'&&d2.n===15&&d2.cells===225&&d2.words===12&&d2.hs<=0&&d2.pageX<=1,d2);

await p.click('.top a.brand');await sleep(450);
ok('logo lleva al indice',(await p.title())==='Juegos',await p.title());
ok('sin errores JS',errs.length===0,errs);
console.log(fails?`SOPA: ${fails} FAIL`:'SOPA: ALL PASS');
await b.close();
process.exit(fails?1:0);
})().catch(e=>{console.error('CRASH',e);process.exit(2);});
