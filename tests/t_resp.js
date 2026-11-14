const {chromium}=require('playwright');
const BASE=process.argv[2]||'http://localhost:8899';
const VPS=[
  ['iphone_p',390,844],
  ['iphone_l',844,390],
  ['ipad_p',768,1024],
  ['ipad_l',1024,768],
  ['small',360,640],
  ['laptop',1440,900],
];
const PAGES=[['index','/index.html'],['spider','/spider.html'],['damas','/damas.html'],['ajedrez','/ajedrez.html']];
let fails=0;
const ok=(n,c,x)=>{console.log((c?'PASS ':'FAIL ')+n+(c?'':' -> '+JSON.stringify(x)));if(!c)fails++;};
(async()=>{
const b=await chromium.launch();
for(const [game,path] of PAGES){
  for(const [vp,w,h] of VPS){
    const p=await b.newPage({viewport:{width:w,height:h},hasTouch:w<1100});
    const errs=[];
    p.on('pageerror',e=>errs.push(e.message));
    await p.goto(BASE+path);await p.waitForTimeout(450);
    const m=await p.evaluate(g=>{
      const de=document.documentElement;
      const hdr=document.querySelector('.top,header');
      const hr=hdr?hdr.getBoundingClientRect():null;
      const btns=[...document.querySelectorAll('header .btn, .top .btn, header select, .top select')];
      const btnOff=btns.filter(el=>{const r=el.getBoundingClientRect();return r.right>innerWidth+1||r.left<-1;}).length;
      const pageX=de.scrollWidth-de.clientWidth;
      // tableros dentro del viewport
      const boards=[...document.querySelectorAll('#board,.board')].filter(el=>el.getBoundingClientRect().height>50);
      const bBad=boards.filter(el=>{const r=el.getBoundingClientRect();return r.left<-1||r.right>innerWidth+1;}).map(el=>el.className);
      // panel lateral ajedrez dentro del viewport
      const panel=document.querySelector('.panel');
      let pBad=false;
      if(panel){const r=panel.getBoundingClientRect();pBad=r.left<-1||r.right>innerWidth+1;}
      // spider: sin scroll horizontal interno
      let hscroll=null;
      if(g==='spider'){const bd=document.querySelector('#board');hscroll=bd.scrollWidth-bd.clientWidth;}
      // tablero con altura razonable
      const mainBoard=boards[0];
      const br=mainBoard?mainBoard.getBoundingClientRect():null;
      return {pageX,btnOff,bBad,pBad,hscroll,hdrH:hr?Math.round(hr.height):0,
        board:br?{w:Math.round(br.width),h:Math.round(br.height),l:Math.round(br.left),r:Math.round(br.right)}:null};
    },game);
    const tag=`${game} ${vp}`;
    ok(`${tag}: sin desborde de pagina`,m.pageX<=1,{pageX:m.pageX});
    ok(`${tag}: botones header caben`,m.btnOff===0,{btnOff:m.btnOff});
    if(m.board) ok(`${tag}: tablero visible`,m.board.w>100&&m.board.h>100,m.board);
    ok(`${tag}: tablero dentro del viewport`,m.bBad.length===0,m.bBad);
    if(game==='ajedrez') ok(`${tag}: panel dentro del viewport`,!m.pBad,{pBad:m.pBad});
    if(game==='spider') ok(`${tag}: sin scroll horizontal (10 columnas caben)`,m.hscroll!==null&&m.hscroll<=1,{hscroll:m.hscroll});
    ok(`${tag}: sin errores JS`,errs.length===0,errs);
    await p.screenshot({path:`/tmp/resp2_${game}_${vp}.png`,fullPage:false});
    await p.close();
  }
}
console.log(fails?`RESPONSIVE: ${fails} FAIL`:'RESPONSIVE: ALL PASS');
await b.close();
process.exit(fails?1:0);
})().catch(e=>{console.error('CRASH',e);process.exit(2);});
