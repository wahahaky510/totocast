
var UPSET_PTS=6;
var MARK2KEY={"1":"home","0":"draw","2":"away"};
var MARKLBL={home:"1",draw:"0",away:"2"};
function favKey(m){if(m.hp==null||m.ap==null)return null;var d=m.hp-m.ap;if(d>=UPSET_PTS)return"home";if(d<=-UPSET_PTS)return"away";return"none";}
function outClass(m,key){if(key==="draw")return"draw";var f=favKey(m);if(f===null)return"unknown";if(f==="none")return"even";return key===f?"form":"upset";}
function pf(m,key){var pc=key==="home"?m.ph:key==="away"?m.pa:m.pd;if(pc==null)return 1/3;return Math.max(0.01,pc/100);}
function selKeysFor(picks,no){return (picks[no]||[]).map(function(v){return MARK2KEY[v]});}
function enumSel(M,picks,f){
  var sel=[];for(var i=0;i<M.length;i++){var k=selKeysFor(picks,M[i].no);if(k.length)sel.push({m:M[i],keys:k});}
  var allSel=sel.length===M.length;
  var product=1;sel.forEach(function(s){product*=s.keys.length});
  if(!sel.length)return{empty:true,sel:sel,product:1,allSel:allSel};
  if(product>60000)return{toobig:true,product:product,sel:sel,allSel:allSel};
  var gmF=(f.minGM||0)/100,gmC=(f.maxGM==null?100:f.maxGM)/100,combos=[],idx=new Array(sel.length).fill(0);
  for(var c=0;c<product;c++){
    var nu=0,nd=0,ln=0,chosen=new Array(sel.length);
    for(var j=0;j<sel.length;j++){var key=sel[j].keys[idx[j]];chosen[j]=key;if(key==="draw")nd++;if(outClass(sel[j].m,key)==="upset")nu++;ln+=Math.log(pf(sel[j].m,key));}
    var gm=Math.exp(ln/sel.length);
    if(nu>=(f.minUpset||0)&&nu<=(f.maxUpset==null?13:f.maxUpset)&&nd>=(f.minDraw||0)&&nd<=(f.maxDraw==null?13:f.maxDraw)&&gm>=gmF&&gm<=gmC)combos.push(chosen.slice());
    for(var m2=0;m2<sel.length;m2++){if(++idx[m2]<sel[m2].keys.length)break;idx[m2]=0;}
  }
  return{sel:sel,combos:combos,product:product,allSel:allSel};
}
function boxCells(allowed){var acc=[""];for(var m=0;m<allowed.length;m++){var nx=[];for(var a=0;a<acc.length;a++)for(var k=0;k<allowed[m].length;k++)nx.push(acc[a]?acc[a]+","+allowed[m][k]:allowed[m][k]);acc=nx;}return acc;}
function exactTickets(combos,opts){
  var uncovered={},nn=0;combos.forEach(function(a){uncovered[a.join(",")]=1;nn++;});
  var tickets=[];
  function firstKey(){for(var k in uncovered)return k;return null;}
  while(nn>0&&tickets.length<4000){
    var seed=firstKey().split(",");
    var allowed=seed.map(function(k){return [k]});
    for(var m=0;m<opts.length;m++){
      for(var o=0;o<opts[m].length;o++){
        var opt=opts[m][o];if(allowed[m].indexOf(opt)>=0)continue;
        var trial=allowed.map(function(a,i){return i===m?a.concat([opt]):a});
        var cells=boxCells(trial),ok=true;
        for(var c=0;c<cells.length;c++){if(!uncovered.hasOwnProperty(cells[c])){ok=false;break;}}
        if(ok)allowed[m]=trial[m];
      }
    }
    boxCells(allowed).forEach(function(c){if(uncovered.hasOwnProperty(c)){delete uncovered[c];nn--;}});
    tickets.push(allowed);
  }
  return tickets;
}
function escH(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}
(function(){
  var M=window.__MATCHES__||[], AI=window.__AI_PICKS__||{};
  var KEY="totocast-r"+(window.__ROUND__||0), FKEY=KEY+"-filter";
  var picks={}; try{picks=JSON.parse(localStorage.getItem(KEY)||"{}")}catch(e){}
  var PRESETS={
    // 2022-2026 の toto 134回の実際の結果でカバー率を検証して設定 (本命寄り50% / バランス79% / 波乱狙い38%)
    honmei:{minUpset:0,maxUpset:2,minDraw:1,maxDraw:5,minGM:33,maxGM:100},
    balance:{minUpset:0,maxUpset:3,minDraw:1,maxDraw:6,minGM:30,maxGM:100},
    wild:{minUpset:1,maxUpset:5,minDraw:3,maxDraw:7,minGM:0,maxGM:35},
    reset:{minUpset:0,maxUpset:13,minDraw:0,maxDraw:13,minGM:0,maxGM:100}
  };
  function n(id,d){var e=document.getElementById(id);if(!e)return d;var v=parseInt(e.value,10);return isNaN(v)?d:v;}
  function curFilter(){return {minUpset:n("minUpset",0),maxUpset:n("maxUpset",13),minDraw:n("minDraw",0),maxDraw:n("maxDraw",13),minGM:n("minGM",0),maxGM:n("maxGM",100)};}
  function build(){
    var r=enumSel(M,picks,curFilter());
    if(r.toobig)return{toobig:true,product:r.product,allSel:r.allSel};
    var cnt=r.combos?r.combos.length:0;return{product:r.product,count:cnt,cost:cnt*100,allSel:r.allSel,empty:r.empty};
  }
  function render(){
    document.querySelectorAll(".picks").forEach(function(p){var no=p.dataset.no;
      p.querySelectorAll(".pickbtn").forEach(function(b){b.classList.toggle("on",(picks[no]||[]).indexOf(b.dataset.v)>=0)})});
    var r=build();
    var raw=document.getElementById("raw"),cb=document.getElementById("combos"),co=document.getElementById("cost");
    if(r.toobig){raw.textContent=r.product.toLocaleString();cb.textContent="多すぎ";co.textContent="（絞ってね）";}
    else if(!r.allSel && r.product<=1){ // 未完成で1通りは意味がないのでハイフン
      raw.textContent="–";cb.textContent="–";co.textContent="";
    }else{
      raw.textContent=r.product.toLocaleString();
      cb.textContent=r.count.toLocaleString();
      co.textContent=r.count?("（"+r.cost.toLocaleString()+"円）"):"（該当なし）";
    }
    try{localStorage.setItem(KEY,JSON.stringify(picks))}catch(e){}
  }
  function saveF(){var o={};["minUpset","maxUpset","minDraw","maxDraw","minGM","maxGM"].forEach(function(id){o[id]=n(id,null)});try{localStorage.setItem(FKEY,JSON.stringify(o))}catch(e){}}
  function loadF(){try{var o=JSON.parse(localStorage.getItem(FKEY)||"null");if(!o)return;Object.keys(o).forEach(function(id){var e=document.getElementById(id);if(e&&o[id]!=null)e.value=o[id]})}catch(e){}}
  function applyPreset(p){var v=PRESETS[p];if(!v)return;Object.keys(v).forEach(function(id){var e=document.getElementById(id);if(e)e.value=v[id]});saveF();render();}
  document.querySelectorAll(".pickbtn").forEach(function(b){b.addEventListener("click",function(){
    var no=b.closest(".picks").dataset.no,v=b.dataset.v;var s=picks[no]||(picks[no]=[]);var i=s.indexOf(v);
    if(i>=0)s.splice(i,1);else s.push(v);if(!s.length)delete picks[no];render();})});
  // カードの開閉(詳細: 確率/コメント/出場停止)
  document.querySelectorAll(".cardtop").forEach(function(h){h.addEventListener("click",function(){
    var c=h.closest(".card"),dt=c.querySelector(".cdetail");if(!dt)return;dt.hidden=!dt.hidden;c.classList.toggle("open",!dt.hidden);})});
  ["minUpset","maxUpset","minDraw","maxDraw","minGM","maxGM"].forEach(function(id){
    var e=document.getElementById(id);if(e)e.addEventListener("input",function(){saveF();render();})});
  document.querySelectorAll(".fpresets button").forEach(function(b){b.addEventListener("click",function(){applyPreset(b.dataset.p)})});
  var ai=document.getElementById("setai");if(ai)ai.addEventListener("click",function(){var o={};Object.keys(AI).forEach(function(k){o[k]=AI[k].slice()});picks=o;var AF=window.__AI_FILTER__;if(AF){Object.keys(AF).forEach(function(id){var e=document.getElementById(id);if(e)e.value=AF[id]});saveF();}render();});
  var cl=document.getElementById("clear");if(cl)cl.addEventListener("click",function(){picks={};render();});
  // タブ切り替え(見どころ/出場停止/フィルタ)
  document.querySelectorAll(".tabs .tb").forEach(function(b){b.addEventListener("click",function(){
    document.querySelectorAll(".tabs .tb").forEach(function(x){x.classList.toggle("on",x===b)});
    var t=b.dataset.tab;
    document.querySelectorAll(".tabpanel").forEach(function(p){p.hidden=(p.dataset.panel!==t)});
  });});
  loadF();render();
})();