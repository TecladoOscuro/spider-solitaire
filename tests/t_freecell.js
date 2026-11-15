/* Tests node del motor puro de freecell.html (sin navegador, sin Playwright).
   Extrae el <script>, lo aísla en un contexto vm sin DOM y ejercita el motor.
   Uso: node t_freecell.js */
const fs=require('fs'), path=require('path'), vm=require('vm');
let fails=0;
const ok=(n,c,x)=>{console.log((c?'PASS ':'FAIL ')+n+(c?'':' -> '+JSON.stringify(x)));if(!c)fails++;};

const html=fs.readFileSync(path.join(__dirname,'..','freecell.html'),'utf8');
const mm=html.match(/<script>([\s\S]*?)<\/script>/);
ok('extrae <script> de freecell.html',!!mm,{});
if(!mm){ console.log('FREECELL: 1 FAIL'); process.exit(1); }
const src=mm[1];

/* --- 1. el motor es puro --- */
const guardIdx=src.indexOf("typeof document !== 'undefined'");
ok('guard de UI presente',guardIdx>0,{guardIdx});
const engine=src.slice(0,guardIdx>0?guardIdx:src.length);
const rawBad=['document','window','localStorage','setTimeout','setInterval','fetch','alert']
  .filter(w=>new RegExp('\\b'+w+'\\b').test(engine));
ok('zona motor sin palabras prohibidas (tampoco en comentarios)',rawBad.length===0,rawBad);
ok('sin IIFE y sin use strict',!/\(\s*function\s*\(/.test(engine)&&!/['"]use strict['"]/.test(engine),{});
ok('sin Date.now() en el motor',!/Date\s*\./.test(engine),{});

const ctx=vm.createContext({console,Math,JSON});
try{ vm.runInContext(src,ctx,{filename:'freecell-engine.js'}); }
catch(e){ ok('el script corre en node sin DOM',false,{error:String(e)}); console.log('FREECELL: FAIL'); process.exit(1); }
ok('el script corre en node sin DOM',true,{});

/* --- 2. API pedida --- */
const api=['newState','canPlace','legalMoves','applyMove','autoFoundation','status'];
const missing=api.filter(k=>typeof ctx[k]!=='function');
ok('API: '+api.join(', '),missing.length===0 && !!ctx.state && ctx.state.tableau.length===7,{missing});
const {newState,canPlace,canToFoundation,runOk,moveOk,applyMove,autoFoundation,legalMoves,status,capacity}=ctx;

/* --- utilidades --- */
const C=(s,r)=>({s:s,r:r,up:true});                       /* 0♠ 1♥ 2♦ 3♣ */
const lcg=s=>()=>((s=(s*1664525+1013904223)>>>0)/4294967296);
const mk=()=>({tableau:[[],[],[],[],[],[],[]],freecells:[null,null,null,null],
               foundations:[[],[],[],[]],moves:0,score:0,won:false});
const flat=st=>[].concat(...st.tableau, st.freecells.filter(Boolean), ...st.foundations);

/* --- 3. reparto --- */
const st=newState(4,lcg(1));
const sizes=st.tableau.map(c=>c.length);
const cards=flat(st);
const uniq=new Set(cards.map(c=>c.s+':'+c.r));
ok('reparto 52 cartas sin duplicados (8+8+8+7+7+7+7=52, todas boca arriba)',
   sizes.join()==='8,8,8,7,7,7,7' && cards.length===52 && uniq.size===52 &&
   st.tableau.every(c=>c.every(k=>k.up)),
   {sizes,total:cards.length,unicas:uniq.size});
const klondikeDeal=1+2+3+4+5+6+7;
ok('comprobado 1+2+…+7=28: es el reparto de Klondike; FreeCell reparte 52 (con 28 faltarían 24 cartas y no se ganaría)',
   klondikeDeal===28 && cards.length===52 && st.foundations.every(f=>f.length===0) && st.moves===0 && !st.won,
   {klondikeDeal,repartoFreeCell:cards.length});

/* --- 4. dificultad = nº de celdas libres --- */
ok('dificultad: Fácil 6 · Normal 4 · Experto 2 (4 por defecto)',
   newState(6).freecells.length===6 && newState(4).freecells.length===4 &&
   newState(2).freecells.length===2 && newState().freecells.length===4 &&
   newState(9).freecells.length===4 && newState(6).freecells.every(x=>x===null),{});
ok('estructura: 7 columnas · 4 fundaciones vacías · 0 movs · no ganado',
   st.tableau.length===7 && st.foundations.length===4 &&
   st.foundations.every(f=>f.length===0) && st.moves===0 && st.won===false,{});

/* --- 5. RNG inyectable --- */
const a=newState(4,lcg(42)), b=newState(4,lcg(42)), c=newState(4,lcg(7));
ok('RNG inyectable: misma semilla = mismo reparto',JSON.stringify(a)===JSON.stringify(b),{});
ok('RNG inyectable: semillas distintas = repartos distintos',JSON.stringify(a)!==JSON.stringify(c),{});

/* --- 6. reglas de colocación en columna --- */
ok('columna vacía acepta un rey',canPlace([],C(0,13))===true,{});
ok('columna vacía acepta cualquier carta',canPlace([],C(1,7))===true,{});
const dK=[C(0,13)];
ok('color alterno: ♥Q sobre ♠K',canPlace(dK,C(1,12))===true,{});
ok('mismo color rechazado: ♣Q sobre ♠K',canPlace(dK,C(3,12))===false,{});
ok('rango: ♠J sobre ♠K rechazado (no es descendente)',canPlace(dK,C(0,12))===false,{});
ok('orden invertido admitido (colOrCard,destino)',canPlace(C(1,12),dK)===true,{});
ok('serie como 2º argumento usa su carta cabecera',canPlace(dK,[C(1,12),C(0,11)])===true,{});
ok('movimiento a la propia columna rechazado',
   moveOk(st,{from:{z:'t',i:0,j:st.tableau[0].length-1},to:{z:'t',i:0}})===false,{});

/* --- 7. reglas de fundación --- */
ok('fundación vacía acepta el As',canToFoundation([],C(0,1))===true,{});
ok('fundación vacía rechaza el 2',canToFoundation([],C(0,2))===false,{});
const f1=[C(0,1)];
ok('♠2 sobre ♠A (mismo palo, +1)',canToFoundation(f1,C(0,2))===true,{});
ok('♥2 sobre ♠A rechazado (palo)',canToFoundation(f1,C(1,2))===false,{});
ok('♠3 sobre ♠A rechazado (rango)',canToFoundation(f1,C(0,3))===false,{});

/* --- 8. secuencias arrastrables --- */
const seq=[C(0,13),C(1,12),C(3,11),C(2,10)];       /* K♠ Q♥ J♣ 10♦ */
const badSeq=[C(0,13),C(1,12),C(2,11),C(3,10)];     /* Q♥ J♦: dos rojas seguidas */
ok('serie válida: color alterno descendente',runOk(seq,0)===true,{});
ok('runOk admite sufijos (j=2)',runOk(seq,2)===true,{});
ok('serie inválida: dos rojas seguidas',runOk(badSeq,0)===false,{});
ok('runOk con índice fuera de rango',runOk(seq,9)===false && runOk([],0)===false,{});
ok('carta boca abajo rompe la serie',runOk([C(0,13),{s:1,r:12,up:false}],0)===false,{});

/* --- 9. celdas libres --- */
const s1=newState(4,lcg(1));
const mCell={from:{z:'t',i:0,j:s1.tableau[0].length-1},to:{z:'w',i:0}};
ok('movimiento a celda libre aceptado',moveOk(s1,mCell)===true,{top:s1.tableau[0].slice(-1)[0]});
const s2=applyMove(s1,mCell);
ok('applyMove devuelve estado nuevo sin mutar el original',
   !!s2 && s2!==s1 && s1.freecells[0]===null && s2.freecells[0]!==null,{});
const top1=s1.tableau[1].length-1;
ok('celda ocupada rechaza otra carta',
   moveOk(s2,{from:{z:'t',i:1,j:top1},to:{z:'w',i:0}})===false,{});
ok('celda→celda rechazado',moveOk(s2,{from:{z:'w',i:0},to:{z:'w',i:1}})===false,{});
const s2w=mk();
s2w.tableau[0]=[C(0,13)];      /* ♠K */
s2w.freecells[0]=C(1,12);      /* ♥Q en la celda */
ok('desde la celda hay movimientos legales (celda→columna: 6 vacías + ♠K)',
   legalMoves(s2w).some(m=>m.from.z==='w'&&m.to.z==='t') &&
   legalMoves(s2w).filter(m=>m.from.z==='w'&&m.to.z==='t').length===7,
   legalMoves(s2w).filter(m=>m.from.z==='w'));
const s2f=cloneSt(s2); s2f.foundations[0]=[C(0,1)];
function cloneSt(x){ return JSON.parse(JSON.stringify(x)); }
ok('fundación→celda rechazado (solo sirve para soltarla en columna)',
   moveOk(s2f,{from:{z:'f',i:0},to:{z:'w',i:1}})===false,{});

/* --- 10. columna vacía acepta rey y series --- */
const s3=mk();
s3.tableau[0]=[C(0,13),C(1,12),C(3,11)];
ok('columna vacía acepta rey',moveOk(s3,{from:{z:'t',i:0,j:0},to:{z:'t',i:1}})===true,{});
ok('columna vacía acepta serie larga (en destino vacío no se consulta la capacidad)',
   moveOk(s3,{from:{z:'t',i:0,j:0},to:{z:'t',i:2}})===true,{});
const s4=applyMove(s3,{from:{z:'t',i:0,j:0},to:{z:'t',i:1}});
ok('la serie viaja entera y la columna origen queda vacía',
   !!s4 && s4.tableau[1].length===3 && s4.tableau[0].length===0,{});

/* --- 11. límite clásico de series a destino NO vacío --- */
const run6=[C(0,10),C(1,9),C(3,8),C(2,7),C(0,6),C(1,5)]; /* J♠10♥9♣8♦7♠6♥ */
function mkCap(nfc){
  const s=mk();
  s.freecells=[];
  for(let i=0;i<nfc;i++) s.freecells.push(null);
  s.tableau[0]=run6.slice();
  s.tableau[1]=[C(1,11)];                                 /* Q♥: acepta J♠ */
  const fill=[C(0,13),C(1,13),C(2,13),C(3,13),C(0,12)];   /* nada vacío */
  for(let i=0;i<5;i++) s.tableau[2+i]=[fill[i]];
  return s;
}
const mvRun={from:{z:'t',i:0,j:0},to:{z:'t',i:1}};
ok('4 celdas libres → capacidad 5 → serie de 6 a columna no vacía rechazada',
   capacity(mkCap(4),0)===5 && moveOk(mkCap(4),mvRun)===false,{cap:capacity(mkCap(4),0)});
ok('6 celdas libres → capacidad 7 → serie de 6 aceptada',
   capacity(mkCap(6),0)===7 && moveOk(mkCap(6),mvRun)===true,{cap:capacity(mkCap(6),0)});
ok('2 celdas libres → capacidad 3 → serie de 6 rechazada',
   capacity(mkCap(2),0)===3 && moveOk(mkCap(2),mvRun)===false,{cap:capacity(mkCap(2),0)});
const sE=mkCap(4); sE.tableau[6]=[];
ok('cada hueco vacío duplica la capacidad ((4+1)·2^e)',
   capacity(sE,0)===10,{cap:capacity(sE,0)});

/* --- 12. auto-fundación (doble toque) --- */
const s7=mk();
s7.tableau[0]=[C(0,1)];
const a1=autoFoundation(s7,0);
ok('autoFoundation(As en tope) devuelve movimiento a fundación',
   !!a1 && a1.to.z==='f' && a1.to.i===0 && a1.from.z==='t' && a1.from.j===0,a1);
const s8=applyMove(s7,a1);
ok('As colocado en la fundación',!!s8 && s8.foundations[0].length===1 && s8.foundations[0][0].r===1,{});
s8.tableau[1]=[C(0,2)];
const a2=autoFoundation(s8,1);
ok('cadena As→2 (doble fundación)',!!a2 && a2.to.z==='f' && a2.to.i===0,a2);
const s9=applyMove(s8,a2);
ok('fundación con A,2 del mismo palo y +20 puntos',
   !!s9 && s9.foundations[0].map(x=>x.r).join()==='1,2' && s9.score===20,s9&&s9.score);
s9.freecells[3]=C(1,1);
const a3=autoFoundation(s9,{z:'w',i:3});
ok('autoFoundation acepta descriptor de origen (celda libre)',
   !!a3 && a3.from.z==='w' && a3.from.i===3 && a3.to.z==='f' && a3.to.i===1,a3);
const s10=applyMove(s9,a3);
ok('♥As en su fundación y celda liberada',
   !!s10 && s10.foundations[1].length===1 && s10.freecells[3]===null,{});
s10.tableau[2]=[C(0,5)];
ok('autoFoundation devuelve null si la carta no encaja',autoFoundation(s10,2)===null,{});

/* --- 13. victoria fabricada --- */
const w=mk();
for(let si=0;si<4;si++) for(let r=1;r<=13;r++) w.foundations[si].push(C(si,r));
w.won=true;
ok('4 montañas completas → status win',
   status(w).over===true && status(w).result==='win',status(w));
ok('legalMoves vacío con la partida ganada',legalMoves(w).length===0,{});
const w2=mk();
for(let si=0;si<4;si++) for(let r=1;r<=13;r++) w2.foundations[si].push(C(si,r));
w2.foundations[3].pop();                                  /* falta el ♣K */
w2.tableau[0]=[C(3,13)];
const w3=applyMove(w2,{from:{z:'t',i:0,j:0},to:{z:'f',i:3}});
ok('el último movimiento fabrica la victoria (won=true, 4×13, +500)',
   !!w3 && w3.won===true && w3.foundations.every(f=>f.length===13) && w3.score===510,
   w3&&{won:w3.won,score:w3.score});
ok('♣K rechazado en otra fundación',
   applyMove(w2,{from:{z:'t',i:0,j:0},to:{z:'f',i:0}})===null,{});
ok('partida viva → status over:false',status(newState(4,lcg(3))).over===false,{});
const stuck=mk();
stuck.tableau=[[C(0,13)],[C(1,13)],[C(2,13)],[C(3,13)],[C(0,5)],[C(1,5)],[C(2,5)]];
stuck.freecells=[C(0,7),C(1,7),C(2,7),C(3,7)];
ok('partida sin ninguna jugada → status stuck',
   legalMoves(stuck).length===0 && status(stuck).over===true && status(stuck).result==='stuck',
   {n:legalMoves(stuck).length,s:status(stuck)});

/* --- 14. applyMove sin mutar --- */
const um=newState(4,lcg(77));
const before=JSON.stringify(um);
const lm=legalMoves(um);
const mv=lm.find(x=>x.to.z==='t')||lm[0];
const after=applyMove(um,mv);
ok('applyMove no muta el estado original',JSON.stringify(um)===before,{});
ok('applyMove devuelve objeto nuevo con moves+1',
   !!after && after!==um && after.moves===um.moves+1 && um.moves===0,{});
ok('movimiento ilegal → null',
   applyMove(um,{from:{z:'t',i:0,j:0},to:{z:'t',i:0}})===null && applyMove(um,null)===null,{});
ok('status tras aplicar sigue coherente',status(after).over===false,{});

/* --- 15. legalMoves en partida viva y cobertura de zonas --- */
const live=legalMoves(newState(4,lcg(5)));
ok('legalMoves no vacío en partida viva',live.length>0,{n:live.length});
ok('partida recién repartida: al menos columna→celda libre',
   live.some(m=>m.from.z==='t'&&m.to.z==='w'),{n:live.length});
const aceState=mk();
aceState.tableau[0]=[C(0,1)];      /* ♠A */
aceState.freecells[0]=C(1,1);      /* ♥A */
aceState.foundations[2]=[C(3,1)];  /* ♣A en fundación */
const cov=legalMoves(aceState);
ok('legalMoves cubre: col→celda, col→fundación, col→col, celda→fundación, celda→col, fundación→col',
   cov.some(m=>m.from.z==='t'&&m.to.z==='w') &&
   cov.some(m=>m.from.z==='t'&&m.to.z==='f') &&
   cov.some(m=>m.from.z==='t'&&m.to.z==='t') &&
   cov.some(m=>m.from.z==='w'&&m.to.z==='f') &&
   cov.some(m=>m.from.z==='w'&&m.to.z==='t') &&
   cov.some(m=>m.from.z==='f'&&m.to.z==='t'),
   cov);
ok('cada movimiento de legalMoves es aplicable',
   live.every(m=>!!applyMove(newState(4,lcg(5)),m)),{n:live.length});

/* --- 16. simulación aleatoria larga --- */
function invariant(st,tag){
  const cards=flat(st);
  if(cards.length!==52) throw new Error(tag+': cartas='+cards.length);
  const s=new Set(cards.map(c=>c.s+':'+c.r));
  if(s.size!==52) throw new Error(tag+': cartas duplicadas o perdidas='+s.size);
  st.foundations.forEach((f,i)=>{
    if(f.length>13) throw new Error(tag+': fundación '+i+' con '+f.length);
    if(f.length){
      if(f[0].r!==1) throw new Error(tag+': fundación '+i+' no empieza por As');
      for(let k=1;k<f.length;k++)
        if(f[k].s!==f[k-1].s||f[k].r!==f[k-1].r+1)
          throw new Error(tag+': fundación '+i+' irregular');
    }
  });
  if(typeof st.moves!=='number'||st.moves<0) throw new Error(tag+': contador de movimientos');
}
let total=0,maxM=0,wins=0,stucks=0,mut=0,nulls=0;
const GAMES=200, LIMIT=400;
try{
  for(let g=0;g<GAMES;g++){
    const r=lcg(9000+g);
    let s=newState(4,r);
    for(let k=0;k<LIMIT;k++){
      const ms=legalMoves(s);
      if(!ms.length) break;
      const m=ms[Math.floor(r()*ms.length)];
      const snap=JSON.stringify(s);
      const nxt=applyMove(s,m);
      if(!nxt){ nulls++; throw new Error('g'+g+' k'+k+': applyMove null con '+JSON.stringify(m)); }
      if(JSON.stringify(s)!==snap) mut++;
      s=nxt;
      invariant(s,'g'+g+' k'+k);
      if(s.won) break;
    }
    invariant(s,'g'+g+' final');
    total+=s.moves;
    maxM=Math.max(maxM,s.moves);
    if(s.won) wins++;
    else if(!legalMoves(s).length) stucks++;
  }
  ok('simulación: '+GAMES+' partidas × ≤'+LIMIT+' movimientos con invariantes (52 cartas únicas, fundaciones 1..n del mismo palo)',true,{GAMES});
  ok('simulación: applyMove nunca null y nunca muta el estado previo',nulls===0&&mut===0,{nulls,mut});
  ok('simulación: progreso real (máximo '+maxM+' movimientos)',maxM>=60,{maxM,media:Math.round(total/GAMES)});
}catch(e){
  ok('simulación: movimientos coherentes',false,{error:String(e.message||e)});
}
console.log('INFO simulación: media de movimientos='+Math.round(total/GAMES)+' · máximo='+maxM+
            ' · victorias='+wins+' · bloqueos='+stucks+' (200 partidas, límite 400 movs, semilla fija)');

console.log(fails?('FREECELL: '+fails+' FAIL'):'FREECELL: ALL PASS');
process.exit(fails?1:0);
