
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
  var M=window.__MATCHES__||[], ROUND=window.__ROUND__||0;
  var KEY="totocast-r"+ROUND, FKEY=KEY+"-filter";
  var root=document.getElementById("keisan");
  var picks={};try{picks=JSON.parse(localStorage.getItem(KEY)||"{}")}catch(e){}
  var f={minUpset:0,maxUpset:13,minDraw:0,maxDraw:13,minGM:0,maxGM:100};
  try{var o=JSON.parse(localStorage.getItem(FKEY)||"null");if(o){["minUpset","maxUpset","minDraw","maxDraw","minGM","maxGM"].forEach(function(k){var v=parseInt(o[k],10);if(!isNaN(v))f[k]=v;});}}catch(e){}
  function msg(h){root.innerHTML='<div class="bonote">'+h+'</div>';}
  var r=enumSel(M,picks,f);
  if(r.empty){msg('予想がまだありません。<a href="'+ROUND+'.html">予想ページ</a>で目を選んでね。');return;}
  if(r.toobig){msg('選択（全体 '+r.product.toLocaleString()+'通り）が多すぎます。<a href="'+ROUND+'.html">予想ページ</a>でダブル/トリプルを減らしてね。');return;}
  var hit=r.combos.length, sel=r.sel;
  if(!hit){msg('いまのフィルタに該当する組合せが 0 通りです。<a href="'+ROUND+'.html">予想ページ</a>でフィルタを広げてね。');return;}
  var posByNo={};sel.forEach(function(s,i){posByNo[s.m.no]=i});
  var fdesc='波乱 '+f.minUpset+'〜'+f.maxUpset+' / 引分 '+f.minDraw+'〜'+f.maxDraw+' / 堅さ '+f.minGM+'〜'+f.maxGM+'%';
  function breakdownHTML(){
    var rows=M.map(function(m){
      var seld=posByNo.hasOwnProperty(m.no);
      function cell(key){
        if(!seld||selKeysFor(picks,m.no).indexOf(key)<0)return '<td class="bx">–</td>';
        var pos=posByNo[m.no],cnt=0;for(var c=0;c<hit;c++)if(r.combos[c][pos]===key)cnt++;
        var pct=Math.round(cnt/hit*100),fixed=cnt===hit;
        var oc=outClass(m,key),cls=oc==="upset"?"up":oc==="draw"?"dr":oc==="form"?"fm":"";
        return '<td class="'+cls+(fixed?" fixed":"")+'">'+cnt.toLocaleString()+'<small>'+pct+'%</small></td>';
      }
      return '<tr><td class="tl"><b>'+m.no+'</b> <span class="bdt">'+escH(m.hn)+' / '+escH(m.an)+'</span></td>'+cell("home")+cell("draw")+cell("away")+'</tr>';
    }).join("");
    return '<div class="bohd">各試合の 1 / 0 / 2 の割合（該当 '+hit.toLocaleString()+' 通り中）</div>'
      +'<div class="bonote">選んだ目が該当通りの中で何通りに含まれるか。<b class="fixedkey">黄</b>＝全該当で固定、割れているほど勝負どころ。</div>'
      +'<div class="tablewrap"><table class="rec brk"><thead><tr><th>試合</th><th>1 ホーム</th><th>0 引分</th><th>2 アウェイ</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  }
  var tickets=(hit<=8000)?exactTickets(r.combos,sel.map(function(s){return s.keys})):null;
  var cur=0;
  function bar(m,key){var p=key==="home"?m.ph:key==="draw"?m.pd:m.pa;p=p||0;return '<div class="kbar '+key+'" style="width:'+Math.max(3,Math.min(100,p))+'%"></div>';}
  function tsize(t){var s=1;t.forEach(function(a){s*=a.length});return s;}
  function drawTicket(){
    var t=tickets[cur];
    var rows=M.map(function(m){
      var inS=posByNo.hasOwnProperty(m.no), allowed=inS?t[posByNo[m.no]]:[];
      function cell(key,label){var on=allowed.indexOf(key)>=0;return '<td class="kc '+key+(on?" on":"")+'">'+bar(m,key)+'<span class="knm">'+escH(label)+'</span></td>';}
      var dt=(m.date||"").replace(/\(.*/,"");
      return '<tr><td class="kdate">'+escH(dt)+'</td>'+cell("home",m.hn)+cell("draw","引き分け")+cell("away",m.an)+'</tr>';
    }).join("");
    document.getElementById("ktbody").innerHTML=rows;
    document.getElementById("kpos").textContent=(cur+1)+" / "+tickets.length;
    var kj=document.getElementById("kjump");kj.value=cur+1;kj.max=tickets.length;
    var sz=tsize(t);
    document.getElementById("kcount").textContent="この券の購入口数 "+sz+"口";
    document.getElementById("kyen").textContent="合計 ¥"+(sz*100).toLocaleString();
  }
  function go(i){if(i<0)i=tickets.length-1;if(i>=tickets.length)i=0;cur=i;drawTicket();}
  var ticketView;
  if(tickets){
    ticketView='<div class="ksum">被りなし <b>'+tickets.length+'枚</b>のマルチ券で、該当 <b>'+hit.toLocaleString()+'通り</b>（¥'+(hit*100).toLocaleString()+'）をカバー。<span class="kfil">フィルタ: '+fdesc+'</span></div>'
      +'<div class="knav"><button id="kprev">◀ 前の券</button><div class="kposwrap"><b id="kpos"></b><label class="kjlbl">券 <input id="kjump" type="number" min="1"></label></div><button id="knext">次の券 ▶</button></div>'
      +'<div class="tablewrap"><table class="ktbl"><thead><tr><th>開催</th><th>ホーム（1）</th><th>引き分け（0）</th><th>アウェイ（2）</th></tr></thead><tbody id="ktbody"></tbody></table></div>'
      +'<div class="kfoot"><span id="kcount"></span><span id="kyen"></span></div>';
  }else{
    ticketView='<div class="bonote">該当 '+hit.toLocaleString()+' 通りが多すぎて券分割できません。予想ページでフィルタを絞ってね。</div>';
  }
  root.innerHTML=ticketView+breakdownHTML();
  if(tickets){
    document.getElementById("kprev").addEventListener("click",function(){go(cur-1)});
    document.getElementById("knext").addEventListener("click",function(){go(cur+1)});
    document.getElementById("kjump").addEventListener("change",function(){var v=parseInt(this.value,10);if(!isNaN(v))go(v-1)});
    drawTicket();
  }
})();