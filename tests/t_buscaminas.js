const {chromium}=require('playwright');
const URL=process.argv[2]||'http://localhost:8899/buscaminas.html';
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

// estado global en vivo (nombres st/S segun implementacion)
const stExpr=`(typeof st!=='undefined'&&st&&st.cells)?st:((typeof S!=='undefined'&&S&&S.cells)?S:null)`;
const live=async()=>p.evaluate(`(${stExpr})`);

// 1 layout
const l=await p.evaluate(e=>{
  const s=eval(e);
  return {cells:document.querySelectorAll('.cell').length,led:document.querySelector('#ledMines').textContent,has:!!s};
},stExpr);
ok('81 celdas + LED minas 010',l.cells===81&&l.led==='010',l);
ok('estado global',l.has,l);

// 2 primer click seguro (flood)
await p.click('.cell[data-i="40"]');await p.waitForTimeout(250);
const f=await p.evaluate(e=>{const s=eval(e);return {revealed:s.cells.filter(c=>c.revealed).length,over:s.over,started:s.started};},stExpr);
ok('primer click seguro y abre region',!f.over&&f.revealed>1,f);

// 3 bandera con clic derecho
const hidden=await p.evaluate(e=>{const s=eval(e);return s.cells.findIndex((c,i)=>!c.revealed);},stExpr);
await p.click(`.cell[data-i="${hidden}"]`,{button:'right'});await p.waitForTimeout(150);
const fl=await p.evaluate(e=>{const s=eval(e);return {flags:s.flags,led:document.querySelector('#ledMines').textContent,cls:document.querySelector('.cell[data-i="'+s.cells.findIndex(x=>!x.revealed&&!x.flagged)+'"]')!==null};},stExpr);
ok('clic derecho marca bandera (LED 009)',fl.flags===1&&fl.led==='009',fl);

// 4 modo tactil: toggle bandera con tap
await p.click('#btnMode');await p.waitForTimeout(120);
const modeOn=await p.evaluate(()=>({t:document.querySelector('#btnMode').textContent,cls:document.querySelector('#btnMode').className}));
ok('alterna modo de toque',/flag|on|act/i.test(modeOn.cls+modeOn.t)||modeOn.t.includes('🚩')||modeOn.t.includes('⛏'),modeOn);
const hidden2=await p.evaluate(e=>{const s=eval(e);return s.cells.findIndex((c,i)=>!c.revealed&&!c.flagged);},stExpr);
await p.click(`.cell[data-i="${hidden2}"]`);await p.waitForTimeout(150);
const fl2=await p.evaluate(e=>{const s=eval(e);return s.flags;},stExpr);
ok('tap en modo bandera marca',fl2===2,fl2);
await p.click('#btnMode');await p.waitForTimeout(120); // vuelve a revelar

// 5 perder
const mine=await p.evaluate(e=>{const s=eval(e);return s.cells.findIndex((c,i)=>c.mine&&!c.revealed&&!c.flagged);},stExpr);
await p.click(`.cell[data-i="${mine}"]`);await p.waitForTimeout(250);
const lose=await p.evaluate(e=>{const s=eval(e);return {over:s.over,res:s.result,lose:document.querySelector('#loseBar').hidden===false||!document.querySelector('#loseBar').hasAttribute('hidden')};},stExpr);
ok('revelar mina -> derrota con barra',lose.over&&lose.res==='lose'&&lose.lose,lose);

// 6 nueva partida por dificultad
await p.selectOption('#diffSel','1');await p.waitForTimeout(350);
const mid=await p.evaluate(e=>{const s=eval(e);return {cells:s.cells.length,mines:s.mines,w:s.w,led:document.querySelector('#ledMines').textContent};},stExpr);
ok('intermedio 16x16 / 40 minas',mid.cells===256&&mid.mines===40&&mid.w===16&&mid.led==='040',mid);

// 7 ganar: revelar todas las seguras
await p.click('.cell[data-i="136"]');await p.waitForTimeout(200); // centro de 16x16
let guard=0;
while(guard++<400){
  const nx=await p.evaluate(e=>{const s=eval(e);if(s.over)return null;const i=s.cells.findIndex(x=>!x.mine&&!x.revealed);return i;},stExpr);
  if(nx===null||nx===undefined) break;
  await p.click(`.cell[data-i="${nx}"]`,{timeout:4000}).catch(()=>{});
}
await p.waitForTimeout(300);
const win=await p.evaluate(e=>{const s=eval(e);return {over:s.over,res:s.result,show:document.querySelector('#win').classList.contains('show')};},stExpr);
ok('revelar todo -> victoria + overlay',win.over&&win.res==='win'&&win.show,win);

// 8 cara reinicia (cierra overlay antes)
await p.click('#btnAgain');await p.waitForTimeout(300);
await p.click('.cell[data-i="40"]');await p.waitForTimeout(150);
const revBefore=await p.evaluate(e=>{const s=eval(e);return s.cells.filter(x=>x.revealed).length;},stExpr);
await p.click('#face');await p.waitForTimeout(250);
const fresh=await p.evaluate(e=>{const s=eval(e);return {over:s.over,rev:s.cells.filter(x=>x.revealed).length};},stExpr);
ok('cara reinicia tras revelar',revBefore>0&&!fresh.over&&fresh.rev===0,{revBefore,fresh});

await p.selectOption('#diffSel','2');await p.waitForTimeout(400);
await p.screenshot({path:'/tmp/shot2_mines.png',fullPage:true});
const exp=await p.evaluate(e=>{const s=eval(e);return s.cells.length;},stExpr);
ok('experto 30x16 = 480 celdas',exp===480,exp);

await p.click('.top a.brand');await p.waitForTimeout(500);
ok('logo lleva al indice',(await p.title())==='Juegos',await p.title());
ok('sin errores JS',errs.length===0,errs);
console.log(fails?`BUSCAMINAS: ${fails} FAIL`:'BUSCAMINAS: ALL PASS');
await b.close();
process.exit(fails?1:0);
})().catch(e=>{console.error('CRASH',e);process.exit(2);});
