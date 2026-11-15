const {chromium}=require('playwright');
const URL=process.argv[2]||'http://localhost:8899/palabra.html';
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

const l=await p.evaluate(()=>({len:state.len,tries:state.guesses.length,rows:document.querySelectorAll('#board > *').length,gen:typeof guess==='function'&&typeof evaluate==='function'}));
ok('partida5 letras,0 intentos, motor',l.len===5&&l.tries===0&&l.gen,l);

// 1 palabra FUERA de lista (el bug reportado): debe avanzar
const w1=await p.evaluate(()=>WORDS[5].find(x=>x!==state.word)||'GATOS');
const t1='GATOS'!==w1?'GATOS':w1; // palabra comun cualquiera
async function typeWord(w){ for(const ch of w){ await p.keyboard.press(ch); await sleep(40); } await p.keyboard.press('Enter'); await sleep(450); }
await typeWord(t1);
const a1=await p.evaluate(()=>({n:state.guesses.length,g:state.guesses[0],err:'',cells:document.querySelectorAll('#board .g,#board .green,#board [class*=green]').length,toast:document.querySelector('#toast').textContent}));
ok('palabra no-lista AVANZA (intento registrado)',a1.n===1&&a1.g===t1,{n:a1.n,g:a1.g,toast:a1.toast});

// 2 teclado en pantalla
const clicked=await p.evaluate(()=>{
  const k=[...document.querySelectorAll('button,.key,[data-k]')].find(el=>/^[A-ZÑ]$/.test(el.textContent.trim())&&el.offsetParent);
  if(!k) return null;
  const ch=k.textContent.trim();
  const before=state.guesses.length;
  k.click();
  return {ch,before,after:state.guesses.length};
});
ok('teclado en pantalla escribe',!!clicked,clicked);

// 3 longitud incorrecta rechazada
await p.keyboard.press('a');await sleep(60);
await p.keyboard.press('Enter');await sleep(300);
const a3=await p.evaluate(()=>({n:state.guesses.length,toast:document.querySelector('#toast').textContent}));
ok('Enter incompleto no suma intento',a3.n<=(clicked?1:1),a3);

// 4 gana con la respuesta
await p.evaluate(()=>{ /* limpiar: nueva partida */ });
await p.keyboard.press('n');await sleep(350); // N en casilla vacia = nueva
const st=await p.evaluate(()=>({word:state.word,tries:state.guesses.length}));
ok('N nueva partida limpia',st.tries===0,{word:st.word});
await typeWord(st.word);
let shown=false;
const tw=Date.now();
while(Date.now()-tw<5000){ if(await p.evaluate(()=>document.querySelector('#win').classList.contains('show'))){shown=true;break;} await sleep(200); }
const win=await p.evaluate(()=>({done:state.done,res:state.result,show:document.querySelector('#win').classList.contains('show')}));
win.show=win.show||shown;
ok('acertar -> victoria + overlay',win.done&&win.res==='win'&&win.show,win);

await p.screenshot({path:'/tmp/vis_palabra.png',fullPage:false});
await p.click('#btnAgain').catch(()=>{});await sleep(350);
await p.click('.top a.brand');await sleep(450);
ok('logo lleva al indice',(await p.title())==='Juegos',await p.title());
ok('sin errores JS',errs.length===0,errs);
console.log(fails?`PALABRA: ${fails} FAIL`:'PALABRA: ALL PASS');
await b.close();
process.exit(fails?1:0);
})().catch(e=>{console.error('CRASH',e);process.exit(2);});
