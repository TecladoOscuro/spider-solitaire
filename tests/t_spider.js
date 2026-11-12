const {chromium}=require('playwright');
const URL=process.argv[2]||'http://localhost:8899/spider.html';
let fails=0;
const ok=(n,c,x)=>{console.log((c?'PASS ':'FAIL ')+n+(c?'':' -> '+JSON.stringify(x)));if(!c)fails++;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function findMove(p){
  return p.evaluate(()=>{
    const st=window.__spider.state();
    const cd=window.__spider.canDrag, cp=window.__spider.canDrop;
    for(let f=0;f<10;f++)for(let i=0;i<st.cols[f].length;i++){
      if(!cd(f,i))continue;
      for(let t=0;t<10;t++)if(t!==f&&cp(f,i,t))return{f,i,t};
    }
    return null;
  });
}
(async()=>{
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1440,height:900}});
const errs=[];
p.on('pageerror',e=>errs.push('pageerror: '+e.message));
p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
p.on('dialog',d=>d.accept().catch(()=>{}));

await p.goto(URL);await p.waitForTimeout(400);

// 1 layout inicial
let counts=await p.$$eval('.col',c=>c.map(x=>x.children.length));
ok('layout inicial 6,6,6,6,5...',JSON.stringify(counts)===JSON.stringify([6,6,6,6,5,5,5,5,5,5]),counts);
ok('stock=5 repartos',await p.textContent('#stockN')==='5',await p.textContent('#stockN'));

// 2 solape de cartas
const g=await p.evaluate(()=>{
  const cs=[...document.querySelectorAll('.col')[0].children];
  const t=cs.map(c=>c.getBoundingClientRect().top);
  const h=cs[0].getBoundingClientRect().height;
  return {gap:Math.round(t[1]-t[0]),h:Math.round(h)};
});
ok('cartas solapadas (gap>0 y < mitad altura)',g.gap>0&&g.gap<g.h*0.5,g);

// 3 repartir
await p.click('#stock');await p.waitForTimeout(250);
counts=await p.$$eval('.col',c=>c.map(x=>x.children.length));
ok('repartir +1 carta por columna',counts.every(n=>n>=6)&&counts.length===10&&await p.textContent('#stockN')==='4',{counts,stock:await p.textContent('#stockN')});

// 4 click-click
let mv=await findMove(p);
ok('existe movimiento legal',!!mv,mv);
if(mv){
  const pt=await p.evaluate(m=>{
    const card=document.querySelector(`.col[data-col="${m.f}"] .card[data-idx="${m.i}"]`);
    const r=card.getBoundingClientRect();
    const nx=card.nextElementSibling;
    const nt=nx?nx.getBoundingClientRect().top:r.bottom;
    return {x:r.x+r.width/2,y:r.top+Math.max(6,(nt-r.top)/2)};
  },mv);
  await p.mouse.click(pt.x,pt.y);
  await p.waitForTimeout(150);
  ok('click selecciona (card.sel)',(await p.$('.card.sel'))!==null);
  await p.click(`.col[data-col="${mv.t}"]`);
  await p.waitForTimeout(250);
  const st=await p.evaluate(()=>({m:window.__spider.state().moves}));
  ok('click-click mueve (moves=2)',st.m===2,st);
}

// 5 drag & drop
mv=await findMove(p);
if(mv){
  const pt=await p.evaluate(m=>{
    const card=document.querySelector(`.col[data-col="${m.f}"] .card[data-idx="${m.i}"]`);
    const r=card.getBoundingClientRect();
    const nx=card.nextElementSibling;
    const nt=nx?nx.getBoundingClientRect().top:r.bottom;
    return {x:r.x+r.width/2,y:r.top+Math.max(6,(nt-r.top)/2)};
  },mv);
  const tgt=await p.$(`.col[data-col="${mv.t}"]`);
  const tb=await tgt.boundingBox();
  await p.mouse.move(pt.x,pt.y);
  await p.mouse.down();
  await p.mouse.move(tb.x+tb.width/2,tb.y+50,{steps:8});
  await p.waitForTimeout(150);
  const ghostVisible=await p.evaluate(()=>document.querySelectorAll('body > .ghost').length);
  ok('fantasma visible durante drag',ghostVisible===1,ghostVisible);
  await p.mouse.up();
  await p.waitForTimeout(300);
  const st=await p.evaluate(()=>({m:window.__spider.state().moves,ghosts:document.querySelectorAll('body > .ghost').length,hidden:document.querySelectorAll('.card.dragging').length,body:document.body.classList.contains('dragging')}));
  ok('drag mueve (moves=3)',st.m===3,st);
  ok('sin fantasma residual',st.ghosts===0,st);
  ok('sin cartas ocultas ni clase dragging',st.hidden===0&&!st.body,st);
}

// 6 alineacion tras soltar
const align=await p.evaluate(()=>{
  const cols=[...document.querySelectorAll('.col')];
  for(const col of cols){
    const cs=[...col.children];
    const t=cs.map(c=>c.getBoundingClientRect().top);
    const ds=[];
    for(let i=1;i<t.length;i++)if(cs[i-1].classList.contains('up'))ds.push(Math.round(t[i]-t[i-1]));
    if(ds.length>=2)return {ds,uniform:ds.every(d=>Math.abs(d-ds[0])<=1.5)};
  }
  return {skip:true};
});
ok('columna alineada (gaps iguales tras soltar)',align.skip||align.uniform,align);

// 7 deshacer
await p.click('#btnUndo');await p.waitForTimeout(200);
ok('deshacer vuelve a moves=2',(await p.evaluate(()=>window.__spider.state().moves))===2);

// 8 pista
await p.click('#btnHint');await p.waitForTimeout(200);
const hint=await p.evaluate(()=>({c:document.querySelectorAll('.hint-card').length,s:document.querySelector('#stock').classList.contains('hint-stock'),t:document.querySelector('#toast').classList.contains('show')}));
ok('pista resalta algo',hint.c>0||hint.s||hint.t,hint);

// 9 nuevo juego con confirmacion
ok('moves>0 antes de nuevo',(await p.evaluate(()=>window.__spider.state().moves))>0);
await p.click('#btnNew');await p.waitForTimeout(300);
const ng=await p.evaluate(()=>{const s=window.__spider.state();return{m:s.moves,c:s.cols.map(x=>x.length),stock:s.stock.length,ghosts:document.querySelectorAll('body > .ghost').length,win:document.querySelector('#win').classList.contains('show')};});
ok('nuevo juego reinicia todo',ng.m===0&&JSON.stringify(ng.c)===JSON.stringify([6,6,6,6,5,5,5,5,5,5])&&ng.stock===50&&ng.ghosts===0&&!ng.win,ng);

await p.screenshot({path:'/tmp/shot_spider.png',fullPage:true});

// 10 dificultad 1 palo
await p.selectOption('#diffSel','1');await p.waitForTimeout(300);
const d=await p.evaluate(()=>{const s=window.__spider.state();const all=s.cols.flat().concat(s.stock).every(c=>c.s===0);return{all,stock:s.stock.length,c:s.cols.map(x=>x.length)};});
ok('1 palo: solo picas y resetea',d.all&&d.stock===50&&JSON.stringify(d.c)===JSON.stringify([6,6,6,6,5,5,5,5,5,5]),d);

// 11 stock agotado + teclas
await p.evaluate(()=>{ while(window.__spider.state().stock.length) window.__spider.deal(); });
await p.waitForTimeout(200);
ok('stock vacio marca off',(await p.evaluate(()=>document.querySelector('#stock').classList.contains('off'))));
await p.keyboard.press('n');await p.waitForTimeout(300);
ok('tecla N nuevo juego',(await p.evaluate(()=>window.__spider.state().stock.length))===50);

ok('sin errores JS',errs.length===0,errs);
console.log(fails?`SPIDER(${URL}): ${fails} FAIL`:'SPIDER: ALL PASS');
await b.close();
process.exit(fails?1:0);
})().catch(e=>{console.error('CRASH',e);process.exit(2);});
