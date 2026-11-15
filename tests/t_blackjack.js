const {chromium}=require('playwright');
const URL=process.argv[2]||'http://localhost:8899/blackjack.html';
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

// 1 arranque: defaults configurables
const l=await p.evaluate(()=>({
  chips:state.chips,min:state.minbet,phase:state.phase,
  stackSel:document.querySelector('#stackSel').value,minSel:document.querySelector('#minSel').value,
  btns:[...document.querySelectorAll('.tools .btn, #betBar .btn, .midline .btn')].map(b=>b.textContent.trim()).slice(0,14),
  gen:typeof newState==='function'&&typeof handValue==='function'&&typeof betOptions==='function'
}));
ok('defaults:1000 fichas / mínima25 / phase bet',l.chips===1000&&l.min===25&&l.phase==='bet',{chips:l.chips,min:l.min,phase:l.phase});
ok('selects de config presentes',l.stackSel==='1000'&&l.minSel==='25',l);
ok('motor global',l.gen,l);

// 2 configuracion con presets
await p.selectOption('#stackSel','500');await sleep(350);
const c1=await p.evaluate(()=>({chips:state.chips,ls:localStorage.getItem('bj.stack')}));
ok('fichas iniciales 500 persisten y reinician',c1.chips===500&&c1.ls==='500',c1);
await p.selectOption('#minSel','10');await sleep(350);
const c2=await p.evaluate(()=>({min:state.minbet,ls:localStorage.getItem('bj.minbet'),opts:[...document.querySelectorAll('#betBar .chip,#betBar [class*=chip],#chip0,#chip1,#chip2')].map(b=>b.textContent.trim())}));
ok('mínima10: persiste y deriva botones [10,40,200]',c2.min===10&&c2.ls==='10'&&c2.opts.some(t=>t.includes('10'))&&c2.opts.some(t=>t.includes('40')),c2);
// volver a defaults
await p.selectOption('#stackSel','1000');await sleep(300);
await p.selectOption('#minSel','25');await sleep(300);

// 3 apostar + repartir
await p.click('#chip0');await sleep(200);
const betOn=await p.evaluate(()=>({lbl:document.querySelector('#betLbl').textContent,st:state.phase}));
ok('fase apuesta activa con lbl',betOn.st==='bet'&&betOn.lbl.length>3,betOn);
await p.click('button:has-text("Repartir")');await sleep(600);
const dealt=await p.evaluate(()=>({
  ph:document.querySelectorAll('#playerHand .card').length,
  dh:document.querySelectorAll('#dealerHand .card').length,
  phase:state.phase, chips:state.chips}));
ok('reparto:2+2 cartas, fase jugador, -25 fichas',dealt.ph===2&&dealt.dh===2&&dealt.phase==='player'&&dealt.chips===975,dealt);

// 4 Hit
const chipsPre=dealt.chips;
await p.click('button:has-text("Robar")');await sleep(500);
const hit=await p.evaluate(()=>({n:document.querySelectorAll('#playerHand .card').length,phase:state.phase}));
ok('Robar añade1 carta (o resuelve si pasa)',hit.n===3||hit.phase!=='player',hit);

// 5 Plantarse -> resuelve
const canStand=await p.$eval('#btnStand',b=>!b.disabled).catch(()=>false);
if(canStand){ await p.click('button:has-text("Plantarse")'); await sleep(900); }
const st=await p.evaluate(()=>({phase:state.phase,chips:state.chips,status:document.querySelector('#status').textContent}));
ok('mano resuelta (plantarse o resolucion automatica)',(st.phase==='bet'||st.phase==='over'||!canStand)&&st.chips>=0&&st.status.length>3,st);

await p.screenshot({path:'/tmp/vis_blackjack.png',fullPage:false});

// 6 bancarrota rapida no bloquea home
await p.click('.top a.brand');await sleep(450);
ok('logo lleva al indice',(await p.title())==='Juegos',await p.title());
ok('sin errores JS',errs.length===0,errs);
console.log(fails?`BLACKJACK: ${fails} FAIL`:'BLACKJACK: ALL PASS');
await b.close();
process.exit(fails?1:0);
})().catch(e=>{console.error('CRASH',e);process.exit(2);});
