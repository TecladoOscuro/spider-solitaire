const {chromium}=require('playwright');
let fails=0;
const ok=(n,c,x)=>{console.log((c?'PASS ':'FAIL ')+n+(c?'':' -> '+JSON.stringify(x)));if(!c)fails++;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const BASE=process.argv[2]||'http://localhost:8899';
(async()=>{
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
const errs=[];
p.on('pageerror',e=>errs.push(e.message));
p.on('dialog',d=>d.accept().catch(()=>{}));

// --- spider movil ---
await p.goto(BASE+'/spider.html');await p.waitForTimeout(400);
async function findVisibleMove(){
  for(const sl of [0,99999]){
    await p.evaluate(s=>{document.querySelector('#board').scrollLeft=s;},sl);
    const m=await p.evaluate(()=>{const st=window.__spider.state();const cd=window.__spider.canDrag,cp=window.__spider.canDrop;
      for(let f=0;f<10;f++)for(let i=0;i<st.cols[f].length;i++){
        if(!cd(f,i))continue;
        const card=document.querySelector('.col[data-col="'+f+'"] .card[data-idx="'+i+'"]');
        if(!card)continue;
        const r=card.getBoundingClientRect();
        if(r.x<4||r.x+r.width>386)continue;
        for(let t=0;t<10;t++)if(t!==f&&cp(f,i,t))return{f,i,t};
      }return null;});
    if(m)return m;
  }
  return null;
}
const mv=await findVisibleMove();
if(mv){
  const pt=await p.evaluate(m=>{const c=document.querySelector(`.col[data-col="${m.f}"] .card[data-idx="${m.i}"]`);
    const r=c.getBoundingClientRect();const nx=c.nextElementSibling;const nt=nx?nx.getBoundingClientRect().top:r.bottom;
    return {x:r.x+r.width/2,y:r.top+Math.max(6,(nt-r.top)/2)};},mv);
  await p.touchscreen.tap(pt.x,pt.y);await p.waitForTimeout(150);
  await p.tap(`.col[data-col="${mv.t}"]`);
  await sleep(300);
}
ok('movil spider: tap mueve',(await p.evaluate(()=>window.__spider.state().moves))===1,await p.evaluate(()=>window.__spider.state().moves));
const overflow=await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
ok('movil spider: sin desbordamiento horizontal raro',overflow<=20,overflow);
await p.screenshot({path:'/tmp/shot_spider_m.png',fullPage:false});

// --- damas movil ---
await p.goto(BASE+'/damas.html');await p.waitForTimeout(400);
const dm=await p.evaluate(()=>generateMoves(S)[0]);
const ib=await p.evaluate(()=>JSON.stringify(S.board));
await p.tap(`.sq[data-r="${dm.path[0][0]}"][data-c="${dm.path[0][1]}"]`);await p.waitForTimeout(150);
await p.tap(`.sq[data-r="${dm.path[1][0]}"][data-c="${dm.path[1][1]}"]`);
let ch=false;const t0=Date.now();
while(Date.now()-t0<5000){const eq=await p.evaluate(x=>JSON.stringify(S.board)===x,ib);if(!eq){ch=true;break;}await sleep(80);}
ok('movil damas: tap mueve',ch);
await p.screenshot({path:'/tmp/shot_damas_m.png',fullPage:false});

// --- ajedrez movil ---
await p.goto(BASE+'/ajedrez.html');await p.waitForTimeout(400);
await p.tap('.sq[data-i="12"]');await p.waitForTimeout(150);
const dots=await p.evaluate(()=>document.querySelectorAll('.sq.dot').length);
ok('movil ajedrez: puntos legales',dots>=2,dots);
await p.tap('.sq[data-i="28"]');
let l='';const t1=Date.now();
while(Date.now()-t1<5000){l=await p.evaluate(()=>document.querySelector('#moveList').textContent);if(/e4/.test(l))break;await sleep(80);}
ok('movil ajedrez: tap juega e4',/e4/.test(l),l);
await p.screenshot({path:'/tmp/shot_ajedrez_m.png',fullPage:false});

ok('movil: sin errores JS',errs.length===0,errs);
console.log(fails?`MOBILE: ${fails} FAIL`:'MOBILE: ALL PASS');
await b.close();
process.exit(fails?1:0);
})().catch(e=>{console.error('CRASH',e);process.exit(2);});
