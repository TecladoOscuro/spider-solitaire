const {chromium}=require('playwright');
const URL=process.argv[2]||'http://localhost:8899/sudoku.html';
let fails=0;
const ok=(n,c,x)=>{console.log((c?'PASS ':'FAIL ')+n+(c?'':' -> '+JSON.stringify(x)));if(!c)fails++;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1440,height:900}});
const errs=[];
p.on('pageerror',e=>errs.push('pageerror: '+e.message));
p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
p.on('dialog',d=>d.accept().catch(()=>{}));
await p.goto(URL);await p.waitForTimeout(400);

// 1 layout + globals
const l=await p.evaluate(()=>({
  cells:document.querySelectorAll('#board [data-i]').length,
  givens:state.puzzle.filter(x=>x>0).length,
  pad:document.querySelectorAll('.pad-btn[data-d]').length,
  hook:!!window.__sudoku,
  gen:typeof generatePuzzle==='function'&&typeof wrongCells==='function'
}));
ok('81 celdas + pad 1-9',l.cells===81&&l.pad===9,l);
ok('pistas de partida',l.givens>=24,l);
ok('globals/motor',l.hook&&l.gen,l);

// 2 seleccion + escritura correcta
const target=await p.evaluate(()=>{
  const i=state.grid.findIndex(x=>x===0);
  return {i, v:state.solution[i]};
});
await p.click(`#board [data-i="${target.i}"]`);await p.waitForTimeout(100);
await p.click(`.pad-btn[data-d="${target.v}"]`);await p.waitForTimeout(120);
const wrote=await p.evaluate(t=>({val:state.grid[t.i],sel:document.querySelectorAll('#board .sel,#board .active,#board [class*=sel]').length}),target);
ok('escribe valor correcto',wrote.val===target.v,wrote);

// 3 valor errado en rojo
const t2=await p.evaluate(()=>{
  let idx=-1;
  for(let k=0;k<81;k++){ if(state.grid[k]===0&&state.puzzle[k]===0){ idx=k; break; } }
  const sol=state.solution[idx];
  return {i:idx, v:sol%9+1===sol?1:sol%9+1};
});
await p.click(`#board [data-i="${t2.i}"]`);await p.waitForTimeout(100);
await p.click(`.pad-btn[data-d="${t2.v}"]`);await p.waitForTimeout(150);
const errCheck=await p.evaluate(t=>{
  const cell=document.querySelector(`#board [data-i="${t.i}"]`);
  const cs=getComputedStyle(cell);
  const col=cs.color;
  const m=col.match(/(\d+),\s*(\d+),\s*(\d+)/);
  const red=m? (+m[1]>140 && +m[2]<110 && +m[3]<110) : false;
  return {red, wrong:wrongCells(state.grid,state.solution).includes(t.i), errStat:document.querySelector('#errStat').textContent};
},t2);
ok('error marcado en rojo',errCheck.red&&errCheck.wrong,errCheck);

// 4 notas
await p.click('#btnNotes');await p.waitForTimeout(80);
const t3=await p.evaluate(()=>{
  let idx=-1;
  for(let k=0;k<81;k++){ if(state.grid[k]===0&&state.puzzle[k]===0){ idx=k; break; } }
  return {i:idx, v:state.solution[idx]};
});
await p.click(`#board [data-i="${t3.i}"]`);await p.waitForTimeout(80);
await p.click(`.pad-btn[data-d="${t3.v}"]`);await p.waitForTimeout(120);
const notes=await p.evaluate(t=>({has:(state.notes[t.i]||[]).includes(t.v),stillEmpty:state.grid[t.i]===0}),t3);
ok('modo notas: nota sin escribir celda',notes.has&&notes.stillEmpty,notes);
await p.click('#btnNotes');await p.waitForTimeout(80);

// 5 borrar + deshacer
await p.click(`#board [data-i="${t3.i}"]`);await p.waitForTimeout(80);
await p.click(`.pad-btn[data-d="${t3.v}"]`);await p.waitForTimeout(100); // ahora escribe (notas off)
const beforeErase=await p.evaluate(t=>state.grid[t.i],t3);
await p.click(`#board [data-i="${t3.i}"]`);await p.waitForTimeout(60);
await p.click('#btnErase');await p.waitForTimeout(120);
const erased=await p.evaluate(t=>state.grid[t.i],t3);
ok('borrar limpia la celda',beforeErase===t3.v&&erased===0,{beforeErase,erased});
await p.click('#btnUndo');await p.waitForTimeout(120);
const undone=await p.evaluate(t=>state.grid[t.i],t3);
ok('deshacer restaura',undone===beforeErase,{undone});

// 6 pista
await p.click(`#board [data-i="${t3.i}"]`);await p.waitForTimeout(80);
await p.click('#btnHint');await p.waitForTimeout(200);
const hinted=await p.evaluate(t=>state.grid[t.i]===t.v,t3);
ok('pista escribe valor',hinted);

// 7 completar partida -> overlay
await p.evaluate(()=>{ /* asegura notas off y seleccion limpia */ });
for(let i=0;i<81;i++){
  const need=await p.evaluate(k=>({g:state.grid[k],v:state.solution[k],won:state.won}),i);
  if(need.won) break;
  if(need.g!==need.v){
    await p.click(`#board [data-i="${i}"]`);
    await p.click(`.pad-btn[data-d="${need.v}"]`);
  }
}
await p.waitForTimeout(300);
const win=await p.evaluate(()=>({won:state.won,show:document.querySelector('#win').classList.contains('show'),complete:isComplete(state.grid)}));
ok('partida completada -> overlay',win.won&&win.show&&win.complete,win);

// 8 nueva + dificultad
await p.click('#btnAgain');await p.waitForTimeout(300);
await p.selectOption('#diffSel','4');await p.waitForTimeout(400);
const d4=await p.evaluate(()=>({lv:state.level,ls:localStorage.getItem('sudoku.diff'),givens:state.puzzle.filter(x=>x>0).length,cells:document.querySelectorAll('#board [data-i]').length}));
ok('experto: nivel4 y ~26 pistas',d4.lv===4&&d4.ls==='4'&&d4.givens>=24&&d4.givens<=28&&d4.cells===81,d4);

await p.screenshot({path:'/tmp/shot2_sudoku.png',fullPage:true});

await p.click('.top a.brand');await p.waitForTimeout(500);
ok('logo lleva al indice',(await p.title())==='Juegos',await p.title());
ok('sin errores JS',errs.length===0,errs);
console.log(fails?`SUDOKU: ${fails} FAIL`:'SUDOKU: ALL PASS');
await b.close();
process.exit(fails?1:0);
})().catch(e=>{console.error('CRASH',e);process.exit(2);});
