/* =========================================================
   TecFlow — interface (áreas, pesquisa, tema do dia, modo de terreno,
   treino adaptativo, fichas de bolso, biblioteca, percursos, FDUL221)
   Usa os painéis do tecnico.js (TEC.panel) e os dados de tfdata.js.
   ========================================================= */
"use strict";
(function(){
const W=()=>$("pageWrap");
const LS={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const norm=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9%.,/ ]+/g," ").replace(/\s+/g," ").trim();
const IC={
 home:'<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
 bus:'<circle cx="5" cy="12" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 12h5m0 0V6h5m-5 6v6h5"/>',
 fire:'<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 1.6 1 2.6 2 3-.5-3 0-5.5.5-8z"/>',
 probe:'<path d="M14 4l6 6-9 9H5v-6z"/><path d="M12 6l6 6"/><path d="M3 21l3-3"/>',
 book:'<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/><path d="M9 7h6"/>',
 train:'<path d="M3 8l9-4 9 4-9 4z"/><path d="M7 10v5c0 1.5 2.5 3 5 3s5-1.5 5-3v-5"/><path d="M21 8v6"/>',
 ask:'<path d="M4 5h16v11H9l-5 4z"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.4"/><path d="M12 14.5v.01"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
 field:'<path d="M12 2l3 6 6 .9-4.5 4.3 1 6.3L12 16.6 6.5 19.5l1-6.3L3 8.9 9 8z"/>',
 pdf:'<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 14h6M9 17h4"/>',
 back:'<path d="M15 18l-6-6 6-6"/>',
 check:'<path d="M5 12.5l4.2 4.2L19 7"/>',
 led:'<circle cx="12" cy="10" r="5"/><path d="M10 15v5M14 15v5"/>',
 meter:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6v4H9z"/><circle cx="12" cy="16" r="2"/>',
 doc:'<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/>',
 path:'<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h4a4 4 0 0 0 0-8H12a4 4 0 0 1 0-8h4"/>'};
const ic=(k,c="")=>`<svg class="tfi ${c}" viewBox="0 0 24 24" aria-hidden="true">${IC[k]||""}</svg>`;
const badge=s=>{const v=TF_SRC[s];return v?`<span class="tfsrc s-${s}" title="${esc(v[1])}">${esc(v[0])}</span>`:""};
const refL=k=>{const r=TF_REF[k];if(!r)return"";return r.u?`<a href="${r.u}" target="_blank" rel="noopener">${esc(r.t)} ↗</a>`:esc(r.t)};
const area=id=>TF_AREAS.find(a=>a.id===id);
function kindBanner(k){if(k==="learn")return`<div class="tfkind learn"><b>🎓 Aprendizagem</b><span>Exercício, simulação ou explicação simplificada para formação. <b>Não é um procedimento autorizado</b> para intervir numa instalação real.</span></div>`;
 if(k==="real")return`<div class="tfkind real"><b>🛡 Intervenção real</b><span>Em Portugal, a instalação e manutenção de SADI é feita por <b>entidade registada na ANEPC</b>, com técnico responsável credenciado, seguindo a NT 12, o RT-SCIE e os procedimentos do fabricante.</span></div>`;
 if(k==="ref")return`<div class="tfkind ref"><b>📘 Referência</b><span>Informação técnica de consulta. Confirma sempre no projeto, no manual do fabricante e na regulamentação em vigor.</span></div>`;return""}

/* ---------------- rotas ---------------- */
function route(){const h=location.hash.replace(/^#\/?/,"");const [p,qs]=h.split("?");const parts=(p||"").split("/").filter(Boolean);const q=Object.fromEntries(new URLSearchParams(qs||""));return{parts,q}}
function nav(h){if(location.hash===h)render();else location.hash=h}
let lastRoute="";
function render(){const {parts,q}=route();const key=location.hash;const w=W();if(!w)return;
 document.querySelectorAll(".tfnav [data-r]").forEach(b=>b.classList.toggle("on",(parts[0]||"")===b.dataset.r));
 const p0=parts[0]||"";
 try{
  if(!p0)(S.field?fieldHome:home)(w);
  else if(area(p0))areaPage(w,p0,parts[1]||area(p0).subs[0][0],q);
  else if(p0==="pesq")searchPage(w,q.q||"");
  else if(p0==="treino")treino(w,q);
  else if(p0==="tema")temaPage(w,parts[1]);
  else if(p0==="percurso")pathPage(w,parts[1]);
  else if(p0==="ia")iaPage(w,q);
  else home(w);
 }catch(e){w.innerHTML=`<div class="empty" style="padding:30px">Ocorreu um erro a abrir esta página: ${esc(e.message)}</div>`;console.error(e)}
 if(key!==lastRoute){window.scrollTo(0,0);lastRoute=key}
 markPathVisit(key)}
window.addEventListener("hashchange",render);
/* links internos do tecnico.js (ex.: «Abrir calculadora →») passam para as áreas do TecFlow */
function hookTec(){if(!window.TEC)return;TEC.onGo=(tab,sub,extra)=>{extra=extra||{};
 if(tab==="calc")nav("#/diag/calc"+(sub?"?sub="+sub:""));
 else if(tab==="cons"){const m={guia:"#/bib/guia",banc:"#/auto/banc",esq:"#/diag/esq",auto:"#/auto/prot",seg:"#/sadi/geral",tab:"#/bib/tab"};nav((m[sub]||"#/bib/guia")+(extra.guia?"?g="+extra.guia:""))}
 else if(tab==="ia")nav("#/ia"+(extra.q?"?q="+encodeURIComponent(extra.q)+"&t="+Date.now():""));else nav("#/");return true}}

/* ---------------- início ---------------- */
function dayTheme(){const d=new Date();const n=Math.floor((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()))/864e5);return TF_THEMES[n%TF_THEMES.length]}
function themeSeen(id){const h=LS.get("tf-themes",[]).filter(x=>x.id!==id);h.unshift({id,at:new Date().toISOString()});LS.set("tf-themes",h.slice(0,60))}
function qzStats(){return LS.get("tf-qz",{t:{},q:{}})}
function weak(){const s=qzStats().t;return Object.entries(s).filter(([k,v])=>v.n>=2&&v.ok/v.n<0.7).sort((a,b)=>a[1].ok/a[1].n-b[1].ok/b[1].n).map(([k])=>k)}
function pathProg(p){const d=LS.get("tf-path",{});const done=p.steps.filter((s,i)=>d[p.id+":"+i]).length;return[done,p.steps.length]}
function home(w){const t=dayTheme();const nh=LS.get("tf-themes",[]).length;const lv=LS.get("tf-lv","");const wk=weak();
 const p=TF_PATHS.find(x=>x.id===lv);let cont="";
 if(p){const d=LS.get("tf-path",{});const k=p.steps.findIndex((s2,i)=>!d[p.id+":"+i]);const [dn,n]=pathProg(p);cont=k>=0?`<a class="tfcont" href="${p.steps[k].to}"><span>${p.ic}</span><div><small>Continuar · ${esc(p.t)} · ${dn}/${n}</small><b>${esc(p.steps[k].t)}</b></div><i>→</i></a>`:""}
 w.innerHTML=`<section class="tfhero slim"><div><h2>O que precisas <em>agora</em>?</h2>
  <form class="tfbig" id="hmQf"><span>${ic("search")}</span><input id="hmQ" placeholder="Código, equipamento, protocolo ou fabricante" autocomplete="off" enterkeyhint="search"><button class="tfbtn2 pri">Pesquisar</button></form>
  <div class="tfquick">${["E08","Exceção 02","DPT 9.001","Detetor cozinha"].map(x=>`<button data-qq="${esc(x)}">${esc(x)}</button>`).join("")}</div></div></section>
 <section class="tfhoje">
  <a class="tfcard tftema" href="#/tema/${t.id}"><header><span class="tfk">☀ Tema do dia</span>${badge(t.s)}</header><h3>${esc(t.t)}</h3><p class="tfclamp">${esc(t.x)}</p><small class="mut">Ler mais →${nh?` · ${nh} tema${nh===1?"":"s"} consultado${nh===1?"":"s"}`:""}</small></a>
  <div class="tfhoje2">${cont||`<a class="tfcont" href="#/percurso/ini"><span>🧭</span><div><small>Começar um percurso</small><b>Escolhe o teu nível</b></div><i>→</i></a>`}
   <a class="tfcont" href="#/treino?go=1"><span>🎯</span><div><small>Treino adaptativo</small><b>${wk.length?"Reforçar: "+wk.slice(0,2).map(k=>TF_TOPICS[k]).join(", "):"5 perguntas rápidas"}</b></div><i>→</i></a></div>
 </section>
 <section class="tfareas sm">${TF_AREAS.map(a=>`<a class="tfarea-c" href="#/${a.id}" style="--ac:${a.c}"><span class="tfai">${ic(a.ic)}</span><b>${esc(a.t)}</b><small>${a.subs.length} secções</small></a>`).join("")}</section>
 <nav class="tfmore">${[["#/bib/fichas","pdf","Fichas de bolso"],["#/sadi/fdul","fire","FDUL221"],["#/percurso/"+(lv||"ini"),"path","Percursos"],["#/bib/docs","doc","Os meus PDF"],["#/bib/glos","book","Glossário"]].map(x=>`<a href="${x[0]}">${ic(x[1])}<span>${x[2]}</span></a>`).join("")}<button type="button" id="hmField">${ic("field")}<span>Modo de terreno</span></button></nav>`;
 wireHomeCommon(w);$("hmField").onclick=()=>setField(true)}
function wireHomeCommon(w){const f=w.querySelector("#hmQf");if(f)f.onsubmit=e=>{e.preventDefault();nav("#/pesq?q="+encodeURIComponent($("hmQ").value))};
 w.querySelectorAll("[data-qq]").forEach(b=>b.onclick=()=>nav("#/pesq?q="+encodeURIComponent(b.dataset.qq)))}
function fieldHome(w){const T=[["#/diag/falhas","probe","Análise de falhas","Sintoma → verificações"],["#/sadi/fdul?m=3","fire","Códigos FDUL221","E01 a E17"],["#/diag/led","led","LEDs","O que significa cada luz"],["#/diag/med","meter","Medições","Valores esperados"],["#/diag/calc?sub=qt","probe","Queda de tensão","Calcular já"],["#/bib/fichas","pdf","Fichas de bolso","Resumos"],["#/bib/docs","doc","Os meus PDF","Manuais no aparelho"],["#/diag/rel","doc","Relatório","Registar a intervenção"],["#/ia","ask","Perguntar","Assistente técnico"]];
 w.innerHTML=`<section class="tffield"><div class="tffh"><b>🦺 Modo de terreno</b><button class="tfbtn2" id="fdOff">Sair do modo de terreno</button></div>
  <form class="tfbig" id="hmQf"><span>${ic("search")}</span><input id="hmQ" placeholder="Código, equipamento, protocolo…" autocomplete="off" enterkeyhint="search"><button class="tfbtn2 pri">Ir</button></form>
  <div class="tftiles">${T.map(t=>`<a href="${t[0]}">${ic(t[1])}<b>${t[2]}</b><small>${t[3]}</small></a>`).join("")}</div>
  <div class="tfkind real"><b>🛡 Em intervenção real</b><span>Avisa antes de testar (central recetora e ocupantes), assinala o que ficou inibido e repõe tudo no fim. Regista no relatório.</span></div></section>`;
 wireHomeCommon(w);$("fdOff").onclick=()=>setField(false)}
function setField(on){S.field=!!on;LS.set("tf-field",S.field);document.body.classList.toggle("field",S.field);const b=$("tfFieldB");if(b)b.setAttribute("aria-pressed",S.field);nav("#/")}

/* ---------------- tema ---------------- */
function temaPage(w,id){const t=TF_THEMES.find(x=>x.id===id)||dayTheme();themeSeen(t.id);const a=area(t.a);
 const rel=TF_THEMES.filter(x=>x.a===t.a&&x.id!==t.id).slice(0,4);
 w.innerHTML=`${crumb([["#/","Início"],[null,"Tema"]])}<article class="tfcard tftema big"><header><span class="tfk">☀ Tema · ${esc(a?a.t:"")}</span>${badge(t.s)}<span class="tfchip">Nível ${t.lv}</span></header><h2>${esc(t.t)}</h2><p class="tflead">${esc(t.x)}</p>
 <div class="tfrow"><a class="tfbtn2 pri" href="${t.go}">Aprofundar na área →</a><a class="tfbtn2" href="#/treino?top=${topicOfArea(t.a)}&go=1">Treinar este tema</a></div></article>
 ${rel.length?`<h3 class="tfh">Temas relacionados</h3><div class="tflist">${rel.map(x=>`<a href="#/tema/${x.id}"><b>${esc(x.t)}</b>${badge(x.s)}</a>`).join("")}</div>`:""}`}
const topicOfArea=a=>({auto:"modbus",sadi:"sadi",diag:"medir",bib:"rtiebt"})[a]||"sadi";
const crumb=l=>`<nav class="tfcrumb">${l.map(([h,t],i)=>h?`<a href="${h}">${esc(t)}</a>`:`<b>${esc(t)}</b>`).join("<span>›</span>")}</nav>`;

/* ---------------- áreas ---------------- */
function areaPage(w,aid,sub,q){const a=area(aid);if(!a.subs.find(s=>s[0]===sub))sub=a.subs[0][0];
 w.innerHTML=`<section class="tfahead" style="--ac:${a.c}"><span class="tfai">${ic(a.ic)}</span><div><h2>${esc(a.t)}</h2><p>${esc(a.d)}</p></div></section>
 <nav class="tfsubn" style="--ac:${a.c}">${a.subs.map(s=>`<a href="#/${aid}/${s[0]}" class="${s[0]===sub?"on":""}">${aid==="sadi"&&TF_KIND[s[0]]==="learn"?"🎓 ":aid==="sadi"&&TF_KIND[s[0]]==="real"?"🛡 ":""}${esc(s[1])}</a>`).join("")}</nav>
 <div class="tfpanel" id="tfP"></div>`;
 const E=$("tfP");if(aid==="sadi")E.insertAdjacentHTML("beforebegin",kindBanner(TF_KIND[sub]));
 const P=(n,o)=>{const d=document.createElement("div");d.dataset.p=n;E.appendChild(d);if(!window.TEC||!TEC.panel(n,d,o))d.innerHTML=`<p class="muted">Conteúdo indisponível.</p>`};
 const sel=document.querySelector(".tfsubn .on");if(sel&&sel.scrollIntoView)try{sel.scrollIntoView({block:"nearest",inline:"center"})}catch(e){}
 ({auto:{dados:()=>tabsPage(E),com:()=>comPage(E),prot:()=>P("auto",{sub:"tab"}),sel:()=>P("auto",{sub:"sel"}),topo:()=>P("auto",{sub:"topo"}),ip:()=>ipPage(E),gw:()=>gwPage(E),banc:()=>P("banc")},
  sadi:{det:()=>detPage(E),fa:()=>faPage(E),geral:()=>P("seg",{sub:"sadi"}),proto:()=>P("seg",{sub:"proto"}),lig:()=>P("seg",{sub:"lig"}),sie:()=>P("seg",{sub:"sie"}),sim:()=>P("seg",{sub:"sim"}),fdul:()=>fdulPage(E,+q.m||1),av:()=>faultList(E,["sadi","fdul"]),real:()=>realPage(E),reg:()=>regPage(E)},
  diag:{ferr:()=>toolsPage(E),falhas:()=>falhas(E,q.sys),led:()=>ledPage(E),med:()=>medPage(E),calc:()=>P("calc",{sub:q.sub||"qt"}),esq:()=>{P("esq",q.e?{sub:q.e}:{});simbolos(E)},rel:()=>relPage(E)},
  bib:{glos:()=>glosPage(E,q.t),docs:()=>docsPage(E),fichas:()=>fichasPage(E,q.f),ref:()=>refPage(E),guia:()=>P("guia",q.g?{guia:q.g}:{}),fab:()=>fabPage(E),tab:()=>P("tab")}})[aid][sub]()}


/* ---------- v44: tabelas rápidas, comissionamento, detetores, alarmes falsos, ferramentas, glossário ---------- */
const tabHtml=k=>{const x=TF_TAB[k];return`<section class="tfcard" id="tb_${k}"><h3>${esc(x.t)} ${badge(x.s)}</h3><div class="tscroll"><table class="tt2"><tr>${x.h.map(h=>`<th>${esc(h)}</th>`).join("")}</tr>${x.r.map(r=>`<tr>${r.map((c,i)=>`<td>${i?esc(c):`<b>${esc(c)}</b>`}</td>`).join("")}</tr>`).join("")}</table></div>${x.n?`<p class="mut">${esc(x.n)}</p>`:""}${x.ref?`<p class="mut">Fonte: ${refL(x.ref)}</p>`:""}</section>`};
function tabsPage(E){const K=Object.keys(TF_TAB);E.innerHTML=`<div class="tfkind ref"><b>📋 Tabelas rápidas</b><span>Os valores que se procuram a meio de uma configuração: funções Modbus, DPT KNX, objetos BACnet, endereçamento DALI e M-Bus.</span></div>
 <div class="tfpick">${K.map(k=>`<button data-tj="${k}">${esc(TF_TAB[k].t.replace(" — "," · "))}</button>`).join("")}</div>${K.map(tabHtml).join("")}`;
 E.querySelectorAll("[data-tj]").forEach(b=>b.onclick=()=>{const t=$("tb_"+b.dataset.tj);if(t)t.scrollIntoView({block:"start",behavior:"smooth"})})}
function comPage(E){const st=LS.get("tf-com",{});E.innerHTML=`<div class="tfkind ref"><b>✅ Comissionamento</b><span>Listas de verificação para pôr cada sistema a funcionar e entregar. As marcas ficam guardadas neste aparelho.</span></div>
 ${TF_COM.map((c,ci)=>{const n=c.p.filter((_,i)=>st[ci+":"+i]).length;return`<details class="tfficha"${ci===0?" open":""}><summary><b>${esc(c.t)}</b>${badge(c.s)}<span class="tfchip">${n}/${c.p.length}</span></summary><div class="tffb"><ol class="tfsteps chk">${c.p.map((p,i)=>`<li class="${st[ci+":"+i]?"ok":""}"><label><input type="checkbox" data-cm="${ci}:${i}"${st[ci+":"+i]?" checked":""}><span>${esc(p)}</span></label></li>`).join("")}</ol><div class="tfrow"><button class="tfbtn2 sm" data-cmr="${ci}">Limpar marcas</button></div></div></details>`}).join("")}
 <div class="tfrow"><a class="tfbtn2" href="#/bib/fichas?f=f-com">${ic("pdf")} Listas em PDF</a></div>`;
 E.querySelectorAll("[data-cm]").forEach(c=>c.onchange=()=>{const s2=LS.get("tf-com",{});if(c.checked)s2[c.dataset.cm]=1;else delete s2[c.dataset.cm];LS.set("tf-com",s2);c.closest("li").classList.toggle("ok",c.checked);const ci=c.dataset.cm.split(":")[0];const chip=c.closest("details").querySelector("summary .tfchip");chip.textContent=TF_COM[ci].p.filter((_,i)=>s2[ci+":"+i]).length+"/"+TF_COM[ci].p.length});
 E.querySelectorAll("[data-cmr]").forEach(b=>b.onclick=()=>{const s2=LS.get("tf-com",{});Object.keys(s2).filter(k=>k.startsWith(b.dataset.cmr+":")).forEach(k=>delete s2[k]);LS.set("tf-com",s2);comPage(E)})}
function detPage(E){E.innerHTML=`<section class="tfcard"><h3>Que equipamento usar onde ${badge("nr")}</h3><p class="mut">A escolha final é sempre do projeto (NT 12) — esta tabela ajuda a perceber porquê.</p></section>
 <div class="tfleds">${TF_DET.map(d=>`<article><header><b>${esc(d.t)}</b><span class="tfchip">${esc(d.n)}</span></header><p><b>Onde:</b> ${esc(d.uso)}</p>${d.ev&&d.ev!=="—"?`<p><b>Evitar:</b> ${esc(d.ev)}</p>`:""}</article>`).join("")}</div>
 <p class="mut">Fonte: ${refL("en54b")} · ${refL("nt12")}</p>`}
function faPage(E){E.innerHTML=`<section class="tfcard"><h3>Alarmes falsos — causas e prevenção</h3><p>Um alarme falso tira confiança ao sistema e pode levar a desligar o que não se deve. Antes de agir, lê o histórico da central (hora, dispositivo, repetição).</p></section>
 ${TF_FA.map(f=>`<section class="tfcard"><h3>${esc(f.c)} ${badge(f.s)}</h3><ul>${f.p.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>${f.ref?`<p class="mut">Fonte: ${refL(f.ref)}</p>`:""}</section>`).join("")}
 ${faultCard(TF_FAULTS.find(f=>f.id==="S8"))}`;wireAddRel(E)}
function toolsPage(E){E.innerHTML=`<div class="tfkind ref"><b>🧰 Ferramentas</b><span>O que levar na mala e para que serve cada ferramenta. Prioridade a ferramentas gratuitas sempre que existem.</span></div>
 <div class="tfleds">${TF_TOOLS.map(t=>`<article><header><b>${esc(t.t)}</b>${badge(t.s)}</header><p>${esc(t.p)}</p>${t.ref?`<p class="mut">${refL(t.ref)}</p>`:""}${t.to?`<p><a href="${t.to}">Aprender a usar →</a></p>`:""}</article>`).join("")}</div>`}
function glosPage(E,t){const L=TF_GLOS.slice().sort((a,b)=>a[0].localeCompare(b[0],"pt"));const letters=[...new Set(L.map(g=>g[0][0].toUpperCase()))];
 E.innerHTML=`<div class="tfkind ref"><b>🔤 Glossário</b><span>Termos técnicos explicados em poucas palavras.</span></div><input class="tecq" id="glQ" placeholder="Procurar termo…" value="${esc(t||"")}"><div class="tfpick sm">${letters.map(l=>`<button data-gl="${l}">${l}</button>`).join("")}</div>
 <div class="tfglos">${L.map(g=>`<div data-l="${g[0][0].toUpperCase()}" id="gl_${norm(g[0]).replace(/[^a-z0-9]+/g,"-")}"><b>${esc(g[0])}</b><span>${esc(g[1])}</span></div>`).join("")}</div>`;
 const q=$("glQ");const f=()=>{const n=norm(q.value);E.querySelectorAll(".tfglos>div").forEach(d=>d.hidden=n&&!norm(d.textContent).includes(n))};q.oninput=f;f();
 E.querySelectorAll("[data-gl]").forEach(b=>b.onclick=()=>{q.value="";f();const d=E.querySelector(`.tfglos [data-l="${b.dataset.gl}"]`);if(d)d.scrollIntoView({block:"center",behavior:"smooth"})})}

/* ---------- automação: IP e gateways ---------- */
function ipPage(E){E.innerHTML=`<div class="tfkind ref"><b>📘 Comunicação IP</b><span>O essencial para pôr controladores, gateways e GTC a falar na mesma rede.</span></div>
 <section class="tfcard"><h3>Calculadora de sub-rede</h3><div class="tfform"><label>Endereço IP<input id="ipA" value="192.168.1.20" inputmode="decimal"></label><label>Prefixo / máscara<select id="ipM">${[30,29,28,27,26,25,24,23,22,21,20,16].map(p=>`<option value="${p}"${p===24?" selected":""}>/${p} — ${mask(p)}</option>`).join("")}</select></label><label>Outro equipamento (opcional)<input id="ipB" value="192.168.1.30" inputmode="decimal"></label></div><div id="ipR" class="tfres"></div></section>
 <section class="tfcard"><h3>Portas usadas na automação ${badge("nr")}</h3><table class="tt2"><tr><th>Serviço</th><th>Porta</th></tr>${TF_PORTS.map(p=>`<tr><td>${esc(p[0])}</td><td><b>${esc(p[1])}</b></td></tr>`).join("")}</table><p class="mut">As firewalls entre a GTC e os equipamentos têm de deixar passar estas portas.</p></section>
 <section class="tfcard"><h3>Boas práticas ${badge("rt")}</h3><ul><li>IP fixo (ou reserva no DHCP) para controladores, gateways e routers KNX/IP.</li><li>Rede (ou VLAN) própria para a automação, separada da rede de escritório.</li><li>Documentar: IP, máscara, gateway, VLAN, porta e Device ID de cada equipamento.</li><li>BACnet/IP entre sub-redes: BBMD ou Foreign Device. KNXnet/IP routing usa multicast (224.0.23.12): o switch tem de o deixar passar.</li><li>Não ligar equipamentos de campo diretamente à Internet; acesso remoto por VPN.</li></ul></section>`;
 const go=()=>{const a=ip2n($("ipA").value),b=ip2n($("ipB").value),p=+$("ipM").value;const R=$("ipR");if(a===null){R.innerHTML=`<p class="bad">Endereço IP inválido.</p>`;return}
  const m=p===0?0:(~0<<(32-p))>>>0;const net=(a&m)>>>0,bc=(net|(~m>>>0))>>>0;const hosts=p>=31?0:Math.pow(2,32-p)-2;
  R.innerHTML=`<div class="tfkv"><span>Rede</span><b>${n2ip(net)}/${p}</b><span>Máscara</span><b>${mask(p)}</b><span>Broadcast</span><b>${n2ip(bc)}</b><span>Endereços úteis</span><b>${hosts>0?n2ip(net+1)+" → "+n2ip(bc-1)+" ("+hosts+")":"—"}</b></div>${b===null?"":((b&m)>>>0)===net?`<p class="ok">✔ ${esc($("ipB").value)} está na mesma sub-rede — comunicam diretamente.</p>`:`<p class="bad">✘ ${esc($("ipB").value)} está noutra sub-rede — precisa de router (gateway)${""}.</p>`}`};
 ["ipA","ipB","ipM"].forEach(i=>$(i).addEventListener("input",go));go()}
const ip2n=s=>{const m=String(s).trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);if(!m)return null;const p=m.slice(1).map(Number);if(p.some(x=>x>255))return null;return((p[0]<<24)>>>0)+(p[1]<<16)+(p[2]<<8)+p[3]};
const n2ip=n=>[n>>>24,(n>>>16)&255,(n>>>8)&255,n&255].join(".");
const mask=p=>n2ip(p===0?0:(~0<<(32-p))>>>0);
function gwPage(E){E.innerHTML=`<div class="tfkind ref"><b>📘 Gateways e integração BMS</b><span>Como ligar sistemas diferentes à gestão técnica centralizada (GTC/BMS).</span></div>
 ${TF_GW.map(g=>`<section class="tfcard"><h3>${esc(g.t)} ${badge(g.s)}</h3><ul>${g.p.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>${g.ref?`<p class="mut">Fonte: ${refL(g.ref)}</p>`:""}</section>`).join("")}
 <section class="tfcard"><h3>Modelo de lista de pontos ${badge("rt")}</h3><div class="tscroll"><table class="tt2"><tr><th>Ponto</th><th>Origem</th><th>Endereço origem</th><th>Tipo</th><th>Escala / unidade</th><th>Destino (BMS)</th><th>L/E</th></tr>
 <tr><td>Temperatura de insuflação UTA1</td><td>Modbus RTU, id 12</td><td>HR 30010</td><td>INT16</td><td>÷10 · °C</td><td>AI-101</td><td>L</td></tr>
 <tr><td>Estado ventilador UTA1</td><td>Modbus RTU, id 12</td><td>Coil 5</td><td>BOOL</td><td>—</td><td>BI-102</td><td>L</td></tr>
 <tr><td>Luz sala 1.03</td><td>KNX</td><td>GA 1/2/3</td><td>DPT 1.001</td><td>—</td><td>BV-201</td><td>L/E</td></tr>
 <tr><td>Energia ativa QE-P1</td><td>Modbus TCP 192.168.10.21</td><td>IR 0x0034</td><td>FLOAT32</td><td>kWh</td><td>AI-301</td><td>L</td></tr></table></div>
 <div class="tfrow"><button class="tfbtn2" id="gwCsv">Descarregar modelo (CSV)</button></div></section>`;
 $("gwCsv").onclick=()=>saveBlob("lista-de-pontos-modelo.csv",new Blob(["﻿Ponto;Origem;Endereço origem;Tipo;Escala/unidade;Destino BMS;L/E\nTemperatura insuflação UTA1;Modbus RTU id 12;HR 30010;INT16;÷10 °C;AI-101;L\n"],{type:"text/csv;charset=utf-8"}))}

/* ---------- avarias ---------- */
const faultCard=f=>`<details class="tffault" id="fl_${f.id}"><summary><span class="tfcode">${esc(f.c)}</span><b>${esc(f.t)}</b>${badge(f.s)}</summary><div><p><b>Causa provável:</b> ${esc(f.cause)}</p><ol>${f.do.map(x=>`<li>${esc(x)}</li>`).join("")}</ol>${f.ref?`<p class="mut">Fonte: ${refL(f.ref)}</p>`:""}<button class="tfbtn2 sm" data-addrel="${f.id}">+ Juntar ao relatório</button></div></details>`;
function faultList(E,sys){const l=TF_FAULTS.filter(f=>sys.includes(f.sys));
 E.innerHTML=`<section class="tfcard"><h3>Estados da central ${badge("dd")}</h3><div class="tfkv"><span>🔴 Alarme</span><b>Deteção confirmada (detetor ou botoneira) → evacuação e comandos.</b><span>🟠 Pré-alarme / alerta</span><b>Primeiro nível em sistemas com dependência ou dois níveis (segundo a configuração).</b><span>🟡 Avaria</span><b>Falha que pode impedir a deteção ou o alarme: tratar sempre.</b><span>⚪ Desativação / teste</span><b>Parte do sistema fora de serviço: tem de ficar assinalada e ser reposta.</b></div></section>
 <input class="tecq" id="flQ" placeholder="Filtrar: curto, terra, sirene, E06…"><div id="flL">${l.map(faultCard).join("")}</div>`;
 const fq=$("flQ");fq.oninput=()=>{const n=norm(fq.value);E.querySelectorAll(".tffault").forEach(d=>d.hidden=n&&!norm(d.textContent).includes(n))};wireAddRel(E)}
function wireAddRel(E){E.querySelectorAll("[data-addrel]").forEach(b=>b.onclick=()=>{const f=TF_FAULTS.find(x=>x.id===b.dataset.addrel);const r=relDraft();r.anom=(r.anom?r.anom+"\n":"")+f.c+" — "+f.t;LS.set("tf-reld",r);toast("Juntado ao relatório em curso (Diagnóstico → Relatórios).")})}
function falhas(E,sys){const S2=Object.keys(TF_SYS);sys=S2.includes(sys)?sys:"";
 E.innerHTML=`<div class="tfkind ref"><b>🔎 Análise de falhas</b><span>1) Escolhe o sistema · 2) escolhe o sintoma ou o código · 3) segue as verificações pela ordem.</span></div>
 <div class="tfpick">${S2.map(k=>`<button data-sy="${k}" class="${k===sys?"on":""}">${esc(TF_SYS[k])}</button>`).join("")}</div><div id="faR"></div>`;
 E.querySelectorAll("[data-sy]").forEach(b=>b.onclick=()=>nav("#/diag/falhas?sys="+b.dataset.sy));
 const R=$("faR");if(!sys){R.innerHTML=`<p class="muted">Escolhe o sistema acima, ou pesquisa um código (ex.: E08, exceção 02).</p>`;return}
 R.innerHTML=TF_FAULTS.filter(f=>f.sys===sys).map(faultCard).join("")+(sys==="fdul"?`<p><a class="tfbtn2" href="#/sadi/fdul?m=3">Métodos de diagnóstico do FDUL221 →</a></p>`:"");wireAddRel(R)}

/* ---------- LEDs / medições ---------- */
function ledPage(E){const sys=[...new Set(TF_LEDS.map(l=>l.sys))];
 E.innerHTML=`<div class="tfkind ref"><b>💡 Leitura de LEDs</b><span>O significado exato varia com a marca e o modelo — os marcados «Oficial do fabricante» vêm do manual; os outros são o comportamento típico.</span></div>
 <div class="tfpick">${["Todos",...sys].map((s,i)=>`<button data-ls="${esc(s)}" class="${i?"":"on"}">${esc(s)}</button>`).join("")}</div>
 <div class="tfleds">${TF_LEDS.map(l=>`<article data-sys="${esc(l.sys)}"><header><b>${esc(l.eq)}</b><span class="tfchip">${esc(l.sys)}</span>${badge(l.s)}</header><p class="tfledl">${esc(l.led)}</p><p><b>Significa:</b> ${esc(l.sig)}</p><p><b>O que fazer:</b> ${esc(l.do)}</p>${l.ref?`<p class="mut">${refL(l.ref)}</p>`:""}</article>`).join("")}</div>`;
 E.querySelectorAll("[data-ls]").forEach(b=>b.onclick=()=>{E.querySelectorAll("[data-ls]").forEach(x=>x.classList.toggle("on",x===b));E.querySelectorAll(".tfleds article").forEach(a=>a.hidden=b.dataset.ls!=="Todos"&&a.dataset.sys!==b.dataset.ls)})}
const measTable=()=>`<div class="tscroll"><table class="tt2"><tr><th>Sistema</th><th>O quê</th><th>Onde / como</th><th>Valor esperado</th></tr>${TF_MEAS.map(m=>`<tr><td><b>${esc(m.sys)}</b></td><td>${esc(m.o)}</td><td>${esc(m.onde)}<br><small>${esc(m.como)}</small></td><td>${esc(m.ok)}</td></tr>`).join("")}</table></div>`;
function medPage(E){E.innerHTML=`<div class="tfkind ref"><b>📏 Medições</b><span>Valores de referência para comparar no terreno. Mede sempre com o equipamento adequado e em segurança.</span></div>
 <div class="tfmeas">${TF_MEAS.map(m=>`<article><header><b>${esc(m.o)}</b><span class="tfchip">${esc(m.sys)}</span>${badge(m.s)}</header><p><b>Onde:</b> ${esc(m.onde)}</p><p><b>Como:</b> ${esc(m.como)}</p><p class="tfok"><b>Esperado:</b> ${esc(m.ok)}</p>${m.ref?`<p class="mut">${refL(m.ref)}</p>`:""}</article>`).join("")}</div>`}

/* ---------- esquemas: simbologia ---------- */
const SYM=[["Disjuntor","M6 18V13l6-4M12 9V6M6 6v0","Proteção contra sobreintensidades"],["Interruptor diferencial","M6 18V13l6-4M12 9V6M14 13h4v4h-4z","Proteção contra contactos indiretos (IΔn)"],["Contactor (contacto NA)","M8 18v-5l6-3M14 10V6","Comandado por bobina"],["Bobina (relé/contactor)","M8 9h8v6H8zM12 3v6M12 15v6","A1/A2"],["Terra de proteção","M12 4v8M6 12h12M8 15h8M10 18h4","PE"],["Lâmpada","M8 8l8 8M16 8l-8 8M12 12m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0","Ponto de luz"],["Tomada","M6 14a6 6 0 0 1 12 0M12 8V4M6 14h12","Tomada com terra"],["Botão de pressão (NA)","M8 18v-5l6-3M11 6h6M14 6v4","Comando momentâneo"],["Fusível","M8 9h8v6H8zM12 3v18","Proteção"],["Transformador","M12 9m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0M12 15m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0","Ex.: SELV"]];
function simbolos(E){E.insertAdjacentHTML("beforeend",`<section class="tfcard"><h3>Simbologia básica (IEC 60617, simplificada) ${badge("dd")}</h3><div class="tfsym">${SYM.map(s=>`<div><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${s[1]}"/></svg><b>${esc(s[0])}</b><small>${esc(s[2])}</small></div>`).join("")}</div>
 <h4>Como ler um esquema</h4><ol><li>Identifica a alimentação (origem, tensão, proteções a montante).</li><li>Segue o circuito de potência e depois o de comando, separadamente.</li><li>Os contactos desenham-se em repouso (sem tensão, sem atuação).</li><li>Confere as referências cruzadas (bobina K1 ↔ contactos K1).</li><li>Assinala no papel o que já verificaste no terreno.</li></ol></section>`)}

/* ---------- SADI: intervenção real e requisitos ---------- */
function realPage(E){E.innerHTML=`<section class="tfcard"><h3>Manutenção do SADI — periodicidade (NT 12, secção 8) ${badge("nr")}</h3>
 <div class="tfcols"><div><h4>Diária <small>pessoa designada pelo RS</small></h4><ul><li>Painéis em estado normal ou desvios registados no livro de ocorrências.</li><li>Alarmes do dia útil anterior tratados.</li><li>Sistema reposto após desativação, teste ou silenciamento.</li></ul></div>
 <div><h4>Trimestral <small>pessoa designada</small></h4><ul><li>Fonte de socorro (sem rede) e autonomia.</li><li>Papel/tinta da impressora.</li><li>Teste de sinalizadores (EN 54-2, 12.11).</li><li>≥ 1 detetor ou botoneira por zona: sinal, alarme e funções auxiliares.</li><li>0,5 m livres à volta/por baixo dos detetores; botoneiras desobstruídas.</li><li>Supervisão de avarias; retentores de portas.</li><li>Alerta aos bombeiros só onde permitido.</li><li>Alterações estruturais ou de ocupação.</li><li>Procedimento para não executar funções deletérias (ex.: descarga de extinção).</li></ul></div>
 <div><h4>Anual <small>entidade registada na ANEPC</small></h4><ul><li>Verificações diárias e trimestrais.</li><li>Cada detetor segundo o fabricante (até 25 % em cada trimestral, todos no ano).</li><li>Inspeção visual de cabos e equipamentos.</li><li>Baterias: ensaio e substituição no prazo do fabricante.</li><li>Anomalias e ações nos registos de segurança (MAP).</li><li>Relatório assinado pelo técnico responsável da entidade.</li><li>Equipamento reposto ao estado normal.</li></ul></div></div><p class="mut">Fonte: ${refL("nt12")}</p></section>
 <section class="tfcard"><h3>Testar sem alarmes falsos (NT 12, 8.2) ${badge("nr")}</h3><ul><li>Antes de um ensaio com ligação a central recetora de alarmes: <b>avisar a central recetora</b>.</li><li>Se a transmissão ficar inibida durante o ensaio, a CDI deve mostrá-lo; se não mostrar, <b>afixar aviso no painel</b>.</li><li><b>Avisar os ocupantes</b> antes de qualquer ensaio que faça soar as sirenes.</li><li>Impedir a atuação indesejada de outros equipamentos de proteção (extinção, comandos).</li></ul></section>
 <section class="tfcard"><h3>Sequência de intervenção ${badge("rt")}</h3><p class="mut">Modelo de trabalho para organizar a intervenção. Complementa — não substitui — os procedimentos da tua entidade e do fabricante.</p>
 <ol class="tfsteps"><li><b>Autorização</b> do responsável de segurança (RS) e acordo do âmbito.</li><li><b>Avisos</b>: central recetora/bombeiros (conforme acordo), ocupantes, segurança do edifício.</li><li><b>Inibições assinaladas</b>: transmissão, comandos (extinção, portas, AVAC, elevadores) — só o necessário e registado.</li><li><b>Medidas compensatórias</b> se uma zona ou laço ficar fora de serviço (ex.: vigilância).</li><li><b>Executar</b> segundo o manual do fabricante (ex.: linha desligada da central antes de usar o FDUL221).</li><li><b>Repor</b> tudo; confirmar a central em estado normal; retirar avisos.</li><li><b>Registar</b> nos registos de segurança e entregar relatório.</li></ol><div class="tfrow"><a class="tfbtn2 pri" href="#/diag/rel?tpl=sadi3">Relatório trimestral</a><a class="tfbtn2" href="#/diag/rel?tpl=sadi12">Relatório anual</a></div></section>
 <section class="tfcard"><h3>Exercício ou intervenção? ${badge("dd")}</h3><div class="tftwo"><div class="tfkind learn"><b>🎓 Exercício de aprendizagem</b><span>Simuladores, bancada, cenários do FDUL221, ligações do laço: servem para treinar. Podem simplificar valores e menus.</span></div><div class="tfkind real"><b>🛡 Procedimento autorizado</b><span>Numa instalação real: entidade registada, técnico qualificado, NT 12, RT-SCIE e manual do fabricante. Avisos, inibições assinaladas, reposição e registo.</span></div></div></section>`}
function regPage(E){E.innerHTML=`<section class="tfcard"><h3>Requisitos aplicáveis em Portugal ${badge("nr")}</h3><ul class="tfreg">
 <li><b>Regime jurídico (RJ-SCIE)</b> — ${refL("rjscie")}. Define responsabilidades, categorias de risco, inspeções e medidas de autoproteção.</li>
 <li><b>Regulamento técnico (RT-SCIE)</b> — ${refL("rtscie")}.</li>
 <li><b>Nota Técnica n.º 12 (ANEPC)</b> — conceção, instalação, exploração e manutenção de SADI: ${refL("nt12")}.</li>
 <li><b>Entidades</b>: quem comercializa, instala ou mantém equipamentos e sistemas SCIE tem de estar <b>registado na ANEPC</b> — ${refL("p773")}. A NT 12 exige pelo menos um técnico responsável credenciado.</li>
 <li><b>Inspeções regulares</b> pedidas pelo responsável do edifício; a ANEPC (ou a câmara municipal, nos edifícios de 1.ª categoria desde 2024) faz inspeções regulares e extraordinárias — ${refL("govscie")}.</li>
 <li><b>Equipamentos</b> conformes com a ${refL("en54")}.</li>
 <li><b>Junto à CDI</b>: nome e telefone da empresa de manutenção afixados (NT 12, secção 8).</li>
 <li><b>Registos</b>: ocorrências, avarias, ensaios e manutenções nos registos de segurança das medidas de autoproteção.</li></ul>
 <p class="mut">Resumo para orientação. A legislação muda: confirma sempre as versões em vigor no Diário da República e no site da ANEPC.</p></section>`}

/* ---------------- FDUL221 ---------------- */
const FMOD=[[1,"Conhecer o equipamento"],[2,"Preparar e executar um teste"],[3,"Diagnosticar avarias"],[4,"Simulador de aprendizagem"]];
function fdulPage(E,m){m=[1,2,3,4].includes(m)?m:1;
 E.innerHTML=`<section class="tfahead sm" style="--ac:#0ea5e9"><span class="tfai">🧰</span><div><h2>FDUL221 — testador de linha FDnet / C-NET</h2><p>Formação prática passo a passo, como no terreno. Baseado no manual técnico Siemens ${badge("of")}</p></div></section>
 <nav class="tfmods">${FMOD.map(([k,t])=>`<a href="#/sadi/fdul?m=${k}" class="${k===m?"on":""}"><i>${k}</i><span>Módulo ${k}</span><b>${t}</b>${LS.get("tf-fdul",{})["m"+k]?`<em>✔</em>`:""}</a>`).join("")}</nav><div id="fdB"></div>
 <p class="mut">Fonte: ${refL("fdulTM")}. Os ecrãs e menus do simulador são simplificados para treino — os textos reais podem variar com a versão de firmware.</p>`;
 const B=$("fdB");[0,fd1,fd2,fd3,fd4][m](B);
 const fin=document.createElement("div");fin.className="tfrow";fin.innerHTML=`<button class="tfbtn2" id="fdDone">${LS.get("tf-fdul",{})["m"+m]?"✔ Módulo concluído":"Marcar módulo como concluído"}</button>${m<4?`<a class="tfbtn2 pri" href="#/sadi/fdul?m=${m+1}">Módulo ${m+1} →</a>`:""}`;E.appendChild(fin);
 $("fdDone").onclick=()=>{const d=LS.get("tf-fdul",{});d["m"+m]=1;LS.set("tf-fdul",d);fdulPage(E,m)}}
const FPARTS={
 lcd:["Ecrã","4 linhas × 20 caracteres, com retroiluminação e contraste ajustáveis (Configuração → LCD setup) e deslocamento automático do texto. Símbolos: funcionamento a bateria (com nível de carga), alimentação externa e posição do cursor."],
 up:["Tecla ▲ / ▼","Navegar entre os menus e dentro deles. Dentro de algumas funções (ex.: Device Info, LCD setup) deslocam para a direita/esquerda."],
 ok:["Tecla OK","Confirmar uma escolha: entrar num menu ou função, iniciar um procedimento (ex.: ler a linha) ou ativar uma função (ex.: relés, sirenes, indicadores de alarme)."],
 ex:["Tecla Exit","Sair de uma função ou menu e cancelar um procedimento. Mantida premida ao ligar o interruptor → abre o menu de Configuração."],
 sw:["Interruptor I / O","I = ligado, O = desligado. Ligar abre o menu Topologia; desligar sai dos menus."],
 led:["LEDs","Vermelho: pisca devagar = erro no arranque; pisca rápido = ligado a PC. Verde: pisca fraco = normal; pisca forte = a ler a topologia ou ligado a PC; acende ao deslocar."],
 a:["Bornes A (+ vermelho / − preto)","Início do laço ou do ramal, e ligação de um dispositivo isolado."],
 b:["Bornes B (+ vermelho / − preto)","Fim do laço (retorno). Num ramal fica livre."],
 pe:["Borne amarelo/verde","Ligação à terra ou à blindagem — necessária para detetar defeitos de blindagem e de terra."],
 pw:["Alimentação externa","Só com a fonte FDUL221-B (24 V DC, 625 mA). Gama de funcionamento 10–30 V DC."],
 usb:["USB","Ligação ao PC (software «PC Linetester Tool» FXS2017): transferir topologias, atualizar firmware. Versões antigas: RS232 ou MC link."],
 bat:["Baterias","Duas baterias de 9 V de lítio-dióxido de manganês (U9VL, 1 Ah) num compartimento por baixo. O nível aparece à direita no ecrã; a duração depende da linha, da retroiluminação e da temperatura."]};
function fdSvg(sel){const hs=(k,x,y,w,h,r=6)=>`<rect class="fh${sel===k?" on":""}" data-fp="${k}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" tabindex="0" role="button" aria-label="${FPARTS[k][0]}"/>`;
 return`<svg class="fdsvg" viewBox="0 0 360 300" role="img" aria-label="FDUL221 (representação simplificada)">
 <rect x="40" y="10" width="280" height="280" rx="22" fill="#e5e7eb" stroke="#9ca3af" stroke-width="2"/><rect x="52" y="22" width="256" height="256" rx="16" fill="#f3f4f6"/>
 <text x="180" y="44" class="fdt">FDUL221 · esquema</text>
 <rect x="70" y="56" width="220" height="74" rx="6" fill="#1f2a1f"/><rect x="76" y="62" width="208" height="62" rx="3" fill="#a7c957"/>
 <text x="84" y="78" class="fdl">LineTester  FDnet</text><text x="84" y="92" class="fdl">&gt;Startup Loop A-&gt;B</text><text x="84" y="106" class="fdl"> Startup Stub A</text><text x="84" y="120" class="fdl"> Devices</text>
 <g class="fdk"><rect x="150" y="146" width="60" height="26" rx="8"/><text x="180" y="164">▲</text><rect x="150" y="204" width="60" height="26" rx="8"/><text x="180" y="222">▼</text><rect x="222" y="175" width="54" height="26" rx="8"/><text x="249" y="193">OK</text><rect x="84" y="175" width="54" height="26" rx="8"/><text x="111" y="193">Exit</text></g>
 <circle cx="96" cy="150" r="6" fill="#ef4444"/><circle cx="116" cy="150" r="6" fill="#22c55e"/>
 <rect x="248" y="140" width="30" height="20" rx="4" fill="#374151"/><text x="263" y="154" class="fdw">I/O</text>
 <g><rect x="70" y="244" width="22" height="22" rx="4" fill="#dc2626"/><rect x="96" y="244" width="22" height="22" rx="4" fill="#111827"/><text x="94" y="240" class="fds">A</text>
 <rect x="140" y="244" width="22" height="22" rx="4" fill="#dc2626"/><rect x="166" y="244" width="22" height="22" rx="4" fill="#111827"/><text x="164" y="240" class="fds">B</text>
 <rect x="212" y="244" width="22" height="22" rx="4" fill="#facc15" stroke="#16a34a" stroke-width="4"/><text x="223" y="240" class="fds">⏚</text>
 <rect x="252" y="246" width="18" height="18" rx="9" fill="#374151"/><text x="261" y="240" class="fds">24V</text><rect x="278" y="248" width="16" height="12" rx="2" fill="#374151"/><text x="286" y="240" class="fds">USB</text></g>
 <text x="180" y="300" class="fds" dy="-2">(bateria: compartimento por baixo)</text>
 ${hs("lcd",66,52,228,82)}${hs("up",146,142,68,92)}${hs("ok",218,171,62,34)}${hs("ex",80,171,62,34)}${hs("sw",244,136,38,28)}${hs("led",86,140,40,20)}${hs("a",66,236,56,34)}${hs("b",136,236,56,34)}${hs("pe",206,236,34,34)}${hs("pw",248,236,26,34)}${hs("usb",276,236,22,34)}${hs("bat",120,282,120,14,4)}</svg>`}
function fd1(B){let sel="lcd";const draw=()=>{B.innerHTML=`<div class="tfkind learn"><b>🎓 Módulo 1</b><span>Toca em cada parte do testador para saberes para que serve. Representação simplificada — não é a imagem real do aparelho.</span></div>
 <div class="fdwrap"><div>${fdSvg(sel)}</div><div class="tfcard fdinfo"><h3>${esc(FPARTS[sel][0])}</h3><p>${esc(FPARTS[sel][1])}</p><div class="tfpick sm">${Object.keys(FPARTS).map(k=>`<button data-fp="${k}" class="${k===sel?"on":""}">${esc(FPARTS[k][0].replace(/ \(.*/,""))}</button>`).join("")}</div></div></div>
 <section class="tfcard"><h3>Para que serve ${badge("of")}</h3><ul><li>Ler e documentar a topologia de linhas FDnet / C-NET (laço, ramal, sub-ramal no laço).</li><li>Procurar e diagnosticar erros na linha (curto, aberto, terra, blindagem, resistência, capacidade, derivações não permitidas).</li><li>Instalação: controlo e aceitação das linhas, endereçamento («Convert Line»), localizar dispositivos («Locate devices»).</li><li>Funciona sozinho ou com o PC (FXS2017).</li></ul>
 <h4>Kit</h4><ul><li>FDUL221-A — kit de ligação à linha</li><li>FDUL221-B — fonte de alimentação</li><li>FDUL221-C — cabo PC</li><li>FDUL221-D — software</li></ul>
 <h4>Dados</h4><div class="tfkv"><span>Alimentação</span><b>10–30 V DC (fonte FDUL221-B) ou 2 × 9 V Li-MnO2</b><span>Temperatura</span><b>−25 a +40 °C (ecrã 0 a +40 °C)</b><span>Humidade</span><b>95 % HR sem condensação</b><span>Proteção</span><b>IP30</b><span>Máx. dispositivos</span><b>252 por linha FDnet/C-NET</b></div></section>
 ${miniQuiz(["q21","q22","q23"])}`;
 B.querySelectorAll("[data-fp]").forEach(e=>{const f=()=>{sel=e.dataset.fp;draw()};e.addEventListener("click",f);e.addEventListener("keydown",ev=>{if(ev.key==="Enter"||ev.key===" "){ev.preventDefault();f()}})});wireMini(B)};draw()}

/* LCD simulado (menus simplificados) */
const TOPO=["Startup Loop A->B","Startup Stub A","Startup Line","Convert Line","Devices","Fault","Measurements","Measure Device","Locate devices","Types summary"];
const CONF=["LCD setup","Mode: FDnet","Selftest","Load Factory Def.","Save & Exit"];
const DEVS=["[T001] FDO221 OK","[T002] FDO221 OK","[T003] FDM221 OK","[T004] FDO221 OK","[T005] FDCIO221 OK","[T006] FDS226 OK"];
function lcdSim(host,onEv){const L={on:false,mode:"off",i:0,list:[],title:"",busy:false,gen:0};
 const later=(f,ms)=>{const g=L.gen;setTimeout(()=>{if(g===L.gen&&L.on&&host.isConnected)f()},ms)};
 const lines=()=>{if(!L.on)return["","","",""];if(L.busy)return[L.title,"","  A ler a linha...",""];
  const top=Math.max(0,Math.min(L.i-1,L.list.length-3));return[L.title,...L.list.slice(top,top+3).map((t,k)=>(top+k===L.i?">":" ")+t)].concat(["","",""]).slice(0,4)};
 const draw=()=>{host.querySelector(".lcd").innerHTML=lines().map(l=>`<div>${esc(String(l).slice(0,20).padEnd(20," ")).replace(/ /g,"&nbsp;")}</div>`).join("");host.querySelector(".lcdled.g").classList.toggle("on",L.on);host.querySelector(".lcdled.g").classList.toggle("fast",L.busy);
  host.querySelector("[data-k=sw]").textContent=L.on?"O (desligar)":"I (ligar)"};
 const set=(mode,title,list)=>{L.mode=mode;L.title=title;L.list=list;L.i=0;draw()};
 const key=k=>{if(k==="sw"){L.gen++;L.busy=false;if(L.on){L.on=false;L.mode="off";draw();onEv("off");return}L.on=true;set("topo","LineTester FDnet",TOPO);onEv("on");return}
  if(k==="swx"){if(L.on)return;L.gen++;L.on=true;set("conf","LineTester Config",CONF);onEv("conf");return}
  if(!L.on||L.busy)return;
  if(k==="up"){L.i=Math.max(0,L.i-1);draw()}else if(k==="dn"){L.i=Math.min(L.list.length-1,L.i+1);draw()}
  else if(k==="ex"){if(L.mode==="topo"||L.mode==="conf")return;if(L.mode.startsWith("c-"))set("conf","LineTester Config",CONF);else set("topo","LineTester FDnet",TOPO)}
  else if(k==="ok"){const it=L.list[L.i];
   if(L.mode==="topo"){if(it==="Startup Loop A->B"||it==="Startup Stub A"){L.busy=true;L.title=it;draw();later(()=>{L.busy=false;set("res",it==="Startup Loop A->B"?"Loop A->B: 6 dev":"Stub A: 6 dev",["Sem erros (no err)",...DEVS]);onEv(it==="Startup Loop A->B"?"loop":"stub")},1400)}
    else if(it==="Devices")set("dev","Devices",DEVS);
    else if(it==="Measurements"){set("mea","Measurements",["Earth (+):  OK","Earth (-):  OK","Shield:     OK"]);onEv("meas")}
    else if(it==="Locate devices")set("loc","Locate devices",["All ON","All OFF"]);
    else if(it==="Fault")set("flt","Fault",["Sem erros"]);
    else if(it==="Measure Device")set("md","Measure Device",DEVS.map(d=>d.replace(" OK","")));
    else set("x",it,["(simulação: função","não detalhada)"])}
   else if(L.mode==="loc"){if(it==="All ON"){set("loc","Locate devices",["All ON  ✔ ativo","All OFF"]);onEv("allon")}else set("loc","Locate devices",["All ON","All OFF ✔"])}
   else if(L.mode==="conf"){if(it==="Mode: FDnet"){set("c-mode","Mode",[">FDnet (ativo)"]);onEv("mode")}else if(it==="Selftest"){L.busy=true;L.title="Selftest";draw();later(()=>{L.busy=false;set("c-st","Selftest",["Display   OK","LEDs      OK","Power     OK","Line drv  OK","Fuse/cable OK"]);onEv("selftest")},1200)}else if(it==="Save & Exit"){L.gen++;L.on=false;L.mode="off";draw();onEv("off")}else if(it==="LCD setup")set("c-lcd","LCD setup",["Contrast  ◄ 5 ►","Light mode: auto"]);else set("c-x",it,["(não executar","em treino)"])}
   else if(L.mode==="md"){set("md2",it,["(+) A: 12 Ω  B: 14 Ω","(-) A: 12 Ω  B: 14 Ω","(valores de treino)"])}}};
 host.innerHTML=`<div class="lcdbox"><div class="lcdtop"><span class="lcdled r"></span><span class="lcdled g"></span><b>FDUL221 · simulador</b></div><div class="lcd" aria-live="polite"></div>
  <div class="lcdkeys"><button data-k="ex">Exit</button><div class="lcdud"><button data-k="up" aria-label="Para cima">▲</button><button data-k="dn" aria-label="Para baixo">▼</button></div><button data-k="ok" class="pri">OK</button></div>
  <div class="lcdpw"><button data-k="sw">I (ligar)</button><button data-k="swx" title="Ligar com Exit premido">I + Exit (Configuração)</button></div></div>`;
 host.querySelectorAll("[data-k]").forEach(b=>b.onclick=()=>key(b.dataset.k));draw();return key}
function fd2(B){const done=new Set(LS.get("tf-fd2",[]));
 const STEPS=[["Desligar a linha da central","Nunca ligar a central e o testador à mesma linha ao mesmo tempo: pode danificar de forma irreparável a interface da linha ou o testador. Numa instalação real: avisos e medidas compensatórias antes de pôr a linha fora de serviço."],
  ["Identificar a topologia","Laço (as duas pontas voltam à central), ramal (stub) ou sub-ramal no laço. Permitido: laço, ramal e um sub-ramal entre dois dispositivos do laço. Não permitido: sub-ramal num ramal; sub-ramais seguidos sem separador."],
  ["Ligar respeitando a polaridade","Laço: início → A (+ vermelho / − preto), fim → B. Ramal ou dispositivo isolado: só A."],
  ["Ligar a blindagem","Blindagem → borne amarelo/verde, para detetar defeitos de blindagem e de terra."],
  ["Ligar o testador e confirmar o protocolo","Interruptor em I. Confirmar «FDnet» no ecrã; se não, Configuração (ligar com Exit premido) → Mode."],
  ["Ler a topologia","«Startup Loop A->B» (laço ou sub-ramal no laço) ou «Startup Stub A» (ramal/dispositivo) → OK. A leitura normalmente não muda endereços: só os dispositivos sem endereço ou em conflito são reendereçados. Para reatribuir todos: «Convert Line»."],
  ["Interpretar o resultado","Dispositivos pela ordem do laço/ramal, numerados [T001]…; os do sub-ramal seguem a ordem do sub-ramal. Com erros: código E01–E17 no dispositivo, e os indicadores desse dispositivo piscam."],
  ["Localizar e guardar","«Locate devices» → «All ON» faz piscar todos os dispositivos detetados: vês logo os que faltam. Guardar a topologia. Se acrescentares/retirares dispositivos, ler de novo."],
  ["Terminar","Desligar (O), retirar o testador, voltar a ligar a linha à central, confirmar estado normal e repor inibições."]];
 const tasks=[["on","Ligar o testador"],["loop","Ler um laço (Startup Loop A->B)"],["allon","Fazer piscar todos os dispositivos (All ON)"],["meas","Ver as medições de terra"],["mode","Abrir a Configuração e confirmar Mode: FDnet"]];
 const tk=new Set(LS.get("tf-fd2t",[]));
 B.innerHTML=`<div class="tfkind learn"><b>🎓 Módulo 2</b><span>Segue os passos e pratica no simulador ao lado. Em obra, segue também o procedimento da tua entidade.</span></div>
 <div class="fdwrap fd2"><ol class="tfsteps chk">${STEPS.map((s,i)=>`<li class="${done.has(i)?"ok":""}"><label><input type="checkbox" data-st="${i}"${done.has(i)?" checked":""}><b>${esc(s[0])}</b></label><p>${esc(s[1])}</p></li>`).join("")}</ol>
 <div><div id="lcdH"></div><section class="tfcard"><h3>Tarefas no simulador</h3><ul class="tftasks">${tasks.map(t=>`<li data-tk="${t[0]}" class="${tk.has(t[0])?"ok":""}">${tk.has(t[0])?"✔":"○"} ${esc(t[1])}</li>`).join("")}</ul></section>
 <section class="tfcard"><h3>Exercício: onde ligas?</h3><p>Laço com início no detetor T001 e fim no T024, cabo blindado.</p>${[["Início do laço",["A","B","⏚"]],["Fim do laço",["A","B","⏚"]],["Blindagem",["A","B","⏚"]]].map((r,i)=>`<div class="tfq"><b>${r[0]}</b>${r[1].map(o=>`<button data-wq="${i}" data-v="${o}">${o}</button>`).join("")}</div>`).join("")}<p id="wqR" class="mut"></p></section></div></div>`;
 B.querySelectorAll("[data-st]").forEach(c=>c.onchange=()=>{const i=+c.dataset.st;c.checked?done.add(i):done.delete(i);LS.set("tf-fd2",[...done]);c.closest("li").classList.toggle("ok",c.checked)});
 lcdSim($("lcdH"),ev=>{if(tasks.some(t=>t[0]===ev)&&!tk.has(ev)){tk.add(ev);LS.set("tf-fd2t",[...tk]);const li=B.querySelector(`[data-tk="${ev}"]`);if(li){li.classList.add("ok");li.textContent="✔ "+tasks.find(t=>t[0]===ev)[1]}toast("Tarefa concluída ✔")}});
 const ans={0:"A",1:"B",2:"⏚"},got={};
 B.querySelectorAll("[data-wq]").forEach(b=>b.onclick=()=>{const i=b.dataset.wq;got[i]=b.dataset.v;B.querySelectorAll(`[data-wq="${i}"]`).forEach(x=>x.classList.toggle("on",x===b));
  if(Object.keys(got).length===3){const ok=Object.keys(ans).every(k=>got[k]===ans[k]);$("wqR").innerHTML=ok?`<span class="ok">✔ Certo: início em A, fim em B, blindagem no borne amarelo/verde.</span>`:`<span class="bad">✘ Revê: início do laço → A, fim → B, blindagem → amarelo/verde (⏚).</span>`;stat("fdul",ok)}})}
function loopSvg(kind){const N=8,cx=185,cy=100,rx=145,ry=66;const pt=i=>{const a=Math.PI+i*(2*Math.PI/N);return[cx+rx*Math.cos(a),cy+ry*Math.sin(a)]};
 const mk={open:[1.5,"✂","Corte"],short:[5.5,"⚡","Curto"],earth:[2.5,"⏚","Terra"],res:[6.5,"Ω","R alta"],com:[4,"?","Disp."]}[kind];const [fx,fy]=pt(mk[0]);const ly=fy<cy?fy-20:fy+30;
 return`<svg viewBox="0 0 360 200" class="fdloop" aria-hidden="true"><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="#94a3b8" stroke-width="3"/>
 <rect x="${cx-rx-28}" y="${cy-16}" width="40" height="32" rx="6" fill="#0f1b2d"/><text x="${cx-rx-8}" y="${cy+5}" class="fdw">A·B</text>
 ${[...Array(N)].map((_,i)=>{if(i===0)return"";const [x,y]=pt(i);return`<circle cx="${x}" cy="${y}" r="10" fill="#fff" stroke="#0f1b2d" stroke-width="2"/><text x="${x}" y="${y+4}" class="fdn">T${String(i).padStart(2,"0")}</text>`}).join("")}
 <circle cx="${fx}" cy="${fy}" r="15" fill="#fee2e2" stroke="#dc2626" stroke-width="2"/><text x="${fx}" y="${fy+5}" class="fdx">${mk[1]}</text><text x="${fx}" y="${ly}" class="fdn r">${mk[2]}</text></svg>`}
function fd3(B){const G=[["open","Linha aberta",["E02","E03"],"Num laço, a central (e o testador) alimentam pelas duas pontas — um corte deixa tudo a funcionar mas sem redundância. Para encontrar o ponto: abrir o laço numa ponta e ler a partir de A; o corte está a seguir ao último dispositivo que responde."],
  ["short","Curto-circuito",["E01"],"Os separadores de linha integrados isolam o curto: o separador abre no dispositivo indicado e o curto está no troço de cabo seguinte. Num laço, um curto também aparece como linha aberta."],
  ["earth","Defeito à terra",["E06","E07"],"Medições → (+) e (−) em relação à terra. «OK» nos dois = bom. «leak/fault» num lado: o valor mais baixo é o defeito real (o outro, ≈ 100 kΩ, é do circuito interno). Acima de 500 kΩ não é detetado com fiabilidade. Para medir com multímetro, desligar o testador da linha."],
  ["res","Resistência elevada",["E08","E05"],"Bornes mal apertados, emendas, cabo demasiado comprido ou fino. Limites FDnet: R máx. 240 Ω, C máx. 750 nF, até 3,3 km (FS20/FS720, depende do cabo). «Measure Device» mostra se a falha está antes ou depois de um dispositivo."],
  ["com","Comunicação e dispositivos",["E04","E10","E11","E12","E13","E14","E15","E16","E17","E09"],"Fugas de corrente, demasiados dispositivos, derivações não permitidas, fins de ramal com restos de resistências/zeners (linhas migradas), díodos (fio no borne do indicador externo AI) e dispositivos em alarme ou avariados."]];
 B.innerHTML=`<div class="tfkind learn"><b>🎓 Módulo 3</b><span>Os cinco tipos de avaria e o que o testador mostra em cada um. Códigos e textos do manual técnico Siemens.</span></div>
 ${G.map(g=>`<section class="tfcard fdgrp"><div class="fdgh">${loopSvg(g[0])}<div><h3>${esc(g[1])}</h3><p>${esc(g[3])}</p></div></div>${g[2].map(c=>faultCard(TF_FAULTS.find(f=>f.id===c))).join("")}</section>`).join("")}
 <section class="tfcard"><h3>Métodos de localização ${badge("of")}</h3><div class="tfcols"><div><h4>Divisão ao meio (bisseção)</h4><ol><li>Separar a linha num dispositivo perto do meio → dois ramais.</li><li>Medir cada ramal: fica-se a saber qual tem o defeito.</li><li>Voltar a ligar o ramal bom; dividir o ramal com defeito ao meio.</li><li>Repetir até isolar o troço.</li></ol></div>
 <div><h4>«Measure Device»</h4><p>Recomendado para E02, E14 e E15.</p><ol><li>Ler a linha e escolher o dispositivo.</li><li>OK → «Measure Device».</li><li>Ver os valores em «Measurements».</li><li>Repetir noutros dispositivos.</li></ol><p class="mut">No laço mede + e − separadamente e os lados A e B; no ramal só a resistência total. Os valores incluem a linha e díodos (indicadores externos).</p></div>
 <div><h4>«Locate devices»</h4><p>Escolher um dispositivo faz piscar os seus indicadores. «All ON» faz piscar todos os detetados — os que não piscam são os que o testador não vê.</p></div></div></section>`;wireAddRel(B)}
const SCEN=[
 {id:"s1",t:"Curto-circuito num laço",code:"E01",lcd:["Loop A->B: 23 dev","E01 Short [T009]",">T009 FDO221","  T010 ?"],story:"Laço de 24 detetores num piso de escritórios. A central dá avaria no laço 2.",steps:[
  {q:"Antes de ligar o FDUL221 à linha…",o:[["Desligo a linha da central (com avisos e vigilância assegurados)",1,"Certo. Central e testador ligados ao mesmo tempo podem danificar a interface ou o testador."],["Ligo o testador em paralelo com a central para comparar",0,"Nunca: pode danificar a interface da linha ou o testador."],["Desligo só as sirenes",0,"Não chega — a linha tem de estar desligada da central."]]},
  {q:"O testador mostra E01 Short no T009. O que fazes?",o:[["Substituo o T009",0,"O separador do T009 abriu porque o curto está a seguir. O T009 está a proteger o laço."],["Verifico o troço de cabo entre o T009 e o T010",1,"Certo: o curto está no troço a seguir ao dispositivo indicado."],["Volto a ligar à central e espero",0,"A avaria continua lá."]]},
  {q:"Encontras um cabo esmagado numa caixa entre T009 e T010 e reparas. A seguir…",o:[["Leio de novo a topologia para confirmar «sem erros»",1,"Certo: confirma com o testador antes de devolver a linha à central."],["Ligo logo à central",0,"Primeiro confirma com nova leitura; depois religa e confirma o estado normal."]]}],end:"Separadores de linha FDnet isolam o curto; o código aponta o dispositivo cujo separador abriu."},
 {id:"s2",t:"Linha aberta no positivo",code:"E02",lcd:["Loop A->B: 24 dev","E02 Open (+)","",""],story:"Depois de obras de teto falso, a central indica laço aberto.",steps:[
  {q:"O testador mostra E02 Open (+), sem dispositivo exato. Primeiro passo?",o:[["Desligo o retorno (B) e leio a partir de A",1,"Certo: o corte estará depois do último dispositivo que responde."],["Faço um ensaio de isolamento a 500 V com os detetores ligados",0,"Perigoso: os 500 V podem destruir os dispositivos."],["Troco o testador",0,"O testador está a indicar bem a avaria."]]},
  {q:"A partir de A respondem T001 a T014. Onde está o corte?",o:[["Entre T014 e T015",1,"Certo: logo a seguir ao último dispositivo que responde."],["Antes do T001",0,"Se fosse antes do T001, nenhum responderia a partir de A."],["No T024",0,"O T024 está do outro lado do corte."]]},
  {q:"Que função ajuda a confirmar?",o:[["«Measure Device» no T014",1,"Certo: recomendado para E02 — mostra se a falha está antes ou depois do dispositivo."],["«Types summary»",0,"Mostra os tipos de dispositivos, não localiza o corte."]]}],end:"Num laço, um aberto não cala a deteção mas tira a redundância."},
 {id:"s3",t:"Defeito à terra",code:"E06",lcd:["Measurements","Earth (+): 100k","Earth (-): 22k fault",""],story:"A central indica defeito à terra intermitente, pior em dias de chuva.",steps:[
  {q:"Nas medições: (+) 100 kΩ e (−) 22 kΩ «fault». Qual é o defeito?",o:[["(−) com 22 kΩ",1,"Certo: o lado com o valor mais baixo é o defeito real; ≈ 100 kΩ vem do circuito interno."],["(+) com 100 kΩ",0,"≈ 100 kΩ do outro lado é típico do circuito interno do testador."],["Nenhum, está tudo bem",0,"«fault» indica defeito."]]},
  {q:"Como localizas?",o:[["Divisão ao meio: separar, medir cada metade, repetir",1,"Certo: o método recomendado para defeitos à terra."],["Substituo todos os detetores",0,"Caro e não resolve se o defeito estiver no cabo."],["Ignoro, é humidade",0,"Defeito à terra tem de ser corrigido."]]},
  {q:"Encontras a blindagem a tocar numa caixa metálica ligada à terra. Correção?",o:[["Isolar a blindagem; contínua e à terra só num ponto",1,"Certo."],["Ligar a blindagem à terra em todas as caixas",0,"Vários pontos de terra causam correntes e avarias de terra."]]}],end:"> 500 kΩ não é detetado com fiabilidade pelo testador."},
 {id:"s4",t:"Resistência série elevada",code:"E08",lcd:["Loop A->B: 18 dev","E08 series R","",""],story:"Laço novo; alguns detetores comunicam de forma instável.",steps:[
  {q:"Causa mais provável de E08?",o:[["Borne mal apertado, emenda ou cabo demasiado comprido/fino",1,"Certo."],["Excesso de detetores",0,"Isso seria E10 (> 252)."],["Sub-ramal mal colocado",0,"Isso seria E11/E12."]]},
  {q:"Limites a confirmar (FDnet, FS20/FS720)?",o:[["R ≤ 240 Ω, C ≤ 750 nF, ≈ 3,3 km",1,"Certo (depende do cabo)."],["R ≤ 24 Ω, sem limite de comprimento",0,"Não."]]}],end:"«Measure Device» ajuda a ver em que troço a resistência sobe."},
 {id:"s5",t:"Derivações seguidas",code:"E12",lcd:["Loop A->B: 30 dev","E12 >2 TTap [T017]","",""],story:"Foram acrescentadas duas derivações para salas novas.",steps:[
  {q:"E12 >2 TTap significa…",o:[["Dois sub-ramais seguidos sem dispositivo entre eles",1,"Certo."],["Defeito à terra",0,"Isso é E06/E07."]]},
  {q:"Correção?",o:[["Colocar um dispositivo/separador (ex.: FDCL221) entre os sub-ramais",1,"Certo: só um sub-ramal entre dois dispositivos do laço."],["Juntar os dois sub-ramais num só ramal a partir de outro ramal",0,"Sub-ramal num ramal não é permitido (E11)."]]}],end:"Topologias permitidas: laço, ramal e um sub-ramal entre dois dispositivos do laço."},
 {id:"s6",t:"Díodo na linha",code:"E14",lcd:["Loop A->B: 12 dev","E14 Diode (+) [T006]","",""],story:"Foi montado um indicador de ação externo no T006.",steps:[
  {q:"Causa típica de E14?",o:[["Fio da linha ligado ao borne do indicador externo (AI) em vez do borne da linha",1,"Certo — na base DB72x o 1a é +AI e o 1b é +C-NET."],["Bateria do testador fraca",0,"Não provoca E14."]]},
  {q:"Como confirmas antes de mexer?",o:[["«Measure Device» no T006 e verificar a cablagem na base",1,"Certo."],["Trocar o detetor T006",0,"O problema é a ligação, não o detetor."]]}],end:"Os valores medidos incluem díodos como os dos indicadores externos."}];
if(typeof TF_SCEN2!=="undefined")SCEN.push(...TF_SCEN2);
function fd4(B){let sc=null,st=0,score=0,log=[];
 const pick=id=>{sc=SCEN.find(s=>s.id===id)||SCEN[Math.floor(Math.random()*SCEN.length)];st=0;score=0;log=[];draw()};
 const draw=()=>{if(!sc){B.innerHTML=`<div class="tfkind learn"><b>🎓 Módulo 4 — simulador</b><span>Recebes uma avaria simulada, escolhes os passos de diagnóstico e vês a explicação de cada resposta. Os resultados contam para o treino adaptativo.</span></div>
   <div class="tfrow"><button class="tfbtn2 pri" id="scR">🎲 Avaria aleatória</button></div><div class="tflist">${SCEN.map(s=>`<button data-sc="${s.id}"><b>${esc(s.t)}</b><span class="tfcode">${s.code}</span>${LS.get("tf-scen",{})[s.id]!=null?`<small>melhor: ${LS.get("tf-scen",{})[s.id]}%</small>`:""}</button>`).join("")}</div>`;
   $("scR").onclick=()=>pick();B.querySelectorAll("[data-sc]").forEach(b=>b.onclick=()=>pick(b.dataset.sc));return}
  const S3=sc.steps[st];
  B.innerHTML=`<div class="tfkind learn"><b>🎓 Cenário de treino — ${esc(sc.t)}</b><span>${esc(sc.story)}</span></div>
  <div class="fdwrap"><div class="lcdbox ro"><div class="lcdtop"><span class="lcdled r"></span><span class="lcdled g on"></span><b>FDUL221</b></div><div class="lcd">${sc.lcd.map(l=>`<div>${esc(String(l).slice(0,20).padEnd(20," ")).replace(/ /g,"&nbsp;")}</div>`).join("")}</div></div>
  <div>${log.map(l=>`<div class="tfans ${l.ok?"ok":"bad"}"><b>${esc(l.q)}</b><p>${l.ok?"✔":"✘"} ${esc(l.a)}</p><p class="mut">${esc(l.e)}</p></div>`).join("")}
  ${S3?`<section class="tfcard"><h3>Passo ${st+1} de ${sc.steps.length}</h3><p><b>${esc(S3.q)}</b></p><div class="tfopts">${S3.o.map((o,i)=>`<button data-o="${i}">${esc(o[0])}</button>`).join("")}</div></section>`
  :`<section class="tfcard"><h3>Resultado: ${Math.round(score/sc.steps.length*100)} %</h3><p>${esc(sc.end)}</p><p>Código: ${faultCard(TF_FAULTS.find(f=>f.id===sc.code))}</p><div class="tfrow"><button class="tfbtn2 pri" id="scR">🎲 Outra avaria</button><button class="tfbtn2" id="scL">Lista de cenários</button></div></section>`}</div></div>`;
  B.querySelectorAll("[data-o]").forEach(b=>b.onclick=()=>{const o=S3.o[+b.dataset.o];const ok=!!o[1];if(ok)score++;stat("fdul",ok);log.push({q:S3.q,a:o[0],e:o[2],ok});st++;
   if(st>=sc.steps.length){const r=LS.get("tf-scen",{});r[sc.id]=Math.max(r[sc.id]||0,Math.round(score/sc.steps.length*100));LS.set("tf-scen",r)}draw()});
  const r=$("scR");if(r)r.onclick=()=>pick();const l=$("scL");if(l)l.onclick=()=>{sc=null;draw()};wireAddRel(B)};draw()}

/* ---------------- relatórios ---------------- */
function relDraft(){return LS.get("tf-reld",{tpl:"sadi3",cli:"",loc:"",sis:"",data:new Date().toISOString().slice(0,10),tec:"",ent:"",reg:"",chk:{},med:[],anom:"",acoes:"",estado:"normal",obs:""})}
function relPage(E,tpl){const q=route().q;const r=relDraft();if(q.tpl&&TF_REPTPL.find(t=>t.id===q.tpl)&&r.tpl!==q.tpl){r.tpl=q.tpl;r.chk={};LS.set("tf-reld",r)}
 const T=TF_REPTPL.find(t=>t.id===r.tpl)||TF_REPTPL[0];const saved=LS.get("tf-rels",[]);
 E.innerHTML=`<div class="tfkind ref"><b>📝 Relatório de intervenção</b><span>Preenche no terreno; fica guardado neste aparelho. Exporta em PDF (Imprimir → Guardar como PDF).</span></div>
 ${T.id.startsWith("sadi")?`<div class="tfkind real"><b>🛡 SADI</b><span>O relatório de manutenção anual tem de ser assinado pelo técnico responsável da entidade registada na ANEPC e as anomalias registadas nos registos de segurança. Este modelo ajuda a organizar a informação.</span></div>`:""}
 <section class="tfcard"><div class="tfform">
  <label>Modelo<select id="rTpl">${TF_REPTPL.map(t=>`<option value="${t.id}"${t.id===T.id?" selected":""}>${esc(t.t)}</option>`).join("")}</select></label>
  <label>Cliente / edifício<input id="rCli" value="${esc(r.cli)}"></label><label>Local / zona / laço<input id="rLoc" value="${esc(r.loc)}"></label>
  <label>Sistema / equipamento<input id="rSis" value="${esc(r.sis)}" placeholder="Ex.: Cerberus PRO FC724, laço 2"></label><label>Data<input id="rData" type="date" value="${esc(r.data)}"></label>
  <label>Técnico<input id="rTec" value="${esc(r.tec)}"></label><label>Entidade<input id="rEnt" value="${esc(r.ent)}"></label><label>N.º de registo ANEPC (se aplicável)<input id="rReg" value="${esc(r.reg)}"></label></div></section>
 ${T.chk.length?`<section class="tfcard"><h3>Verificações ${badge(T.s)}</h3><div class="tfchk">${T.chk.map((c,i)=>`<div class="tfchkr"><span>${esc(c)}</span><span class="tfseg">${["OK","NOK","N/A"].map(v=>`<button data-ck="${i}" data-v="${v}" class="${(r.chk[i]||"")===v?"on v"+v.replace("/",""):""}">${v}</button>`).join("")}</span></div>`).join("")}</div></section>`:""}
 <section class="tfcard"><h3>Medições</h3><div id="rMed"></div><button class="tfbtn2 sm" id="rMedAdd">+ Medição</button></section>
 <section class="tfcard"><div class="tfform one"><label>Anomalias encontradas<textarea id="rAnom" rows="3">${esc(r.anom)}</textarea></label><label>Ações realizadas<textarea id="rAcoes" rows="3">${esc(r.acoes)}</textarea></label>
  <label>Estado final<select id="rEst">${[["normal","Sistema em estado normal"],["pend","Funcional com pendentes"],["fora","Fora de serviço / parcialmente fora de serviço"]].map(o=>`<option value="${o[0]}"${r.estado===o[0]?" selected":""}>${o[1]}</option>`).join("")}</select></label><label>Observações<textarea id="rObs" rows="2">${esc(r.obs)}</textarea></label></div></section>
 <div class="tfrow"><button class="tfbtn2 pri" id="rPdf">${ic("pdf")} PDF / imprimir</button><button class="tfbtn2" id="rSave">Guardar no histórico</button><button class="tfbtn2" id="rNew">Novo relatório</button></div>
 ${saved.length?`<h3 class="tfh">Relatórios guardados</h3><div class="tflist">${saved.map((s,i)=>`<div class="tfli"><b>${esc(s.cli||"(sem cliente)")} · ${esc(s.data)}</b><small>${esc((TF_REPTPL.find(t=>t.id===s.tpl)||{}).t||"")}</small><span><button class="tfbtn2 sm" data-ro="${i}">Abrir</button><button class="tfbtn2 sm" data-rd="${i}">Apagar</button></span></div>`).join("")}</div>`:""}`;
 const save=()=>LS.set("tf-reld",r);const bind=(id,k)=>{const e=$(id);e.oninput=()=>{r[k]=e.value;save()}};
 [["rCli","cli"],["rLoc","loc"],["rSis","sis"],["rData","data"],["rTec","tec"],["rEnt","ent"],["rReg","reg"],["rAnom","anom"],["rAcoes","acoes"],["rObs","obs"]].forEach(a=>bind(...a));
 $("rEst").onchange=e=>{r.estado=e.target.value;save()};$("rTpl").onchange=e=>{r.tpl=e.target.value;r.chk={};save();relPage(E)};
 E.querySelectorAll("[data-ck]").forEach(b=>b.onclick=()=>{const i=b.dataset.ck;r.chk[i]=r.chk[i]===b.dataset.v?"":b.dataset.v;save();E.querySelectorAll(`[data-ck="${i}"]`).forEach(x=>x.className=(r.chk[i]===x.dataset.v?"on v"+x.dataset.v.replace("/",""):""))});
 const drawMed=()=>{$("rMed").innerHTML=r.med.length?`<div class="tscroll"><table class="tt2"><tr><th>Grandeza</th><th>Valor</th><th>Referência</th><th></th></tr>${r.med.map((m,i)=>`<tr><td><input data-mi="${i}" data-mk="g" value="${esc(m.g)}" placeholder="Ex.: R isolamento laço 2"></td><td><input data-mi="${i}" data-mk="v" value="${esc(m.v)}" placeholder="Ex.: > 500 MΩ"></td><td><input data-mi="${i}" data-mk="r" value="${esc(m.r)}" placeholder="Ex.: ≥ 0,5 MΩ"></td><td><button class="tfbtn2 sm" data-mx="${i}" aria-label="Retirar">×</button></td></tr>`).join("")}</table></div>`:`<p class="muted">Sem medições.</p>`;
  $("rMed").querySelectorAll("[data-mi]").forEach(i=>i.oninput=()=>{r.med[+i.dataset.mi][i.dataset.mk]=i.value;save()});$("rMed").querySelectorAll("[data-mx]").forEach(b=>b.onclick=()=>{r.med.splice(+b.dataset.mx,1);save();drawMed()})};drawMed();
 $("rMedAdd").onclick=()=>{r.med.push({g:"",v:"",r:""});save();drawMed()};
 $("rPdf").onclick=()=>printHtml(relHtml(r),"Relatorio_"+(r.cli||"intervencao")+"_"+r.data);
 $("rSave").onclick=()=>{const l=LS.get("tf-rels",[]);l.unshift(JSON.parse(JSON.stringify(r)));LS.set("tf-rels",l.slice(0,40));toast("Relatório guardado neste aparelho.");relPage(E)};
 $("rNew").onclick=()=>{if(!confirm("Começar um relatório novo? O atual fica apagado se não o guardaste."))return;localStorage.removeItem("tf-reld");relPage(E)};
 E.querySelectorAll("[data-ro]").forEach(b=>b.onclick=()=>{LS.set("tf-reld",LS.get("tf-rels",[])[+b.dataset.ro]);relPage(E)});
 E.querySelectorAll("[data-rd]").forEach(b=>b.onclick=()=>{if(!confirm("Apagar este relatório guardado?"))return;const l=LS.get("tf-rels",[]);l.splice(+b.dataset.rd,1);LS.set("tf-rels",l);relPage(E)})}
function relHtml(r){const T=TF_REPTPL.find(t=>t.id===r.tpl)||TF_REPTPL[0];const est={normal:"Sistema em estado normal",pend:"Funcional com pendentes",fora:"Fora de serviço / parcialmente fora de serviço"}[r.estado];
 return`<h1>Relatório de intervenção</h1><p class="ps">${esc(T.t)}</p><table><tr><th>Cliente / edifício</th><td>${esc(r.cli)}</td><th>Data</th><td>${esc(r.data)}</td></tr><tr><th>Local</th><td>${esc(r.loc)}</td><th>Sistema</th><td>${esc(r.sis)}</td></tr><tr><th>Técnico</th><td>${esc(r.tec)}</td><th>Entidade / registo</th><td>${esc(r.ent)} ${r.reg?"· "+esc(r.reg):""}</td></tr></table>
 ${T.chk.length?`<h2>Verificações</h2><table>${T.chk.map((c,i)=>`<tr><td>${esc(c)}</td><td class="c">${esc(r.chk[i]||"—")}</td></tr>`).join("")}</table>`:""}
 ${r.med.length?`<h2>Medições</h2><table><tr><th>Grandeza</th><th>Valor</th><th>Referência</th></tr>${r.med.map(m=>`<tr><td>${esc(m.g)}</td><td>${esc(m.v)}</td><td>${esc(m.r)}</td></tr>`).join("")}</table>`:""}
 <h2>Anomalias</h2><p>${esc(r.anom||"—").replace(/\n/g,"<br>")}</p><h2>Ações realizadas</h2><p>${esc(r.acoes||"—").replace(/\n/g,"<br>")}</p><h2>Estado final</h2><p><b>${esc(est)}</b></p>${r.obs?`<h2>Observações</h2><p>${esc(r.obs).replace(/\n/g,"<br>")}</p>`:""}
 <div class="sig"><div>Técnico<br><br>______________________</div><div>Técnico responsável / cliente<br><br>______________________</div></div><p class="ps">Gerado no TecFlow. Modelo auxiliar — não substitui os registos e procedimentos exigidos (NT 12 / RT-SCIE).</p>`}

/* impressão / PDF */
function printHtml(html,title){let P=$("tfPrint");if(!P){P=document.createElement("div");P.id="tfPrint";document.body.appendChild(P)}P.innerHTML=html;const t0=document.title;document.title=String(title||"TecFlow").replace(/[^\p{L}\p{N}_-]+/gu,"_");
 const after=()=>{document.title=t0;window.removeEventListener("afterprint",after)};window.addEventListener("afterprint",after);setTimeout(()=>{try{window.print()}catch(e){toast("Usa o menu do navegador → Imprimir → Guardar como PDF.")}},60)}

/* ---------------- biblioteca ---------------- */
function fichaBody(f){let h=f.h||"";if(f.faults)h+=`<table class="tt2"><tr><th>Código</th><th>Significado</th><th>O que fazer</th></tr>${f.faults.map(id=>{const x=TF_FAULTS.find(y=>y.id===id);return x?`<tr><td><b>${esc(x.c)}</b></td><td>${esc(x.t)}<br><small>${esc(x.cause)}</small></td><td>${esc(x.do.join(" "))}</td></tr>`:""}).join("")}</table>`;
 if(f.meas)h+=measTable();if(f.ports)h+=`<table class="tt2"><tr><th>Serviço</th><th>Porta</th></tr>${TF_PORTS.map(p=>`<tr><td>${esc(p[0])}</td><td>${esc(p[1])}</td></tr>`).join("")}</table>`;return h}
function fichasPage(E,open){E.innerHTML=`<div class="tfkind ref"><b>📄 Fichas de bolso</b><span>Resumos para consulta rápida. «PDF» abre a impressão — escolhe «Guardar como PDF» para ficar com o ficheiro.</span></div>
 <div class="tffichas">${TF_FICHAS.map(f=>`<details class="tfficha" id="fi_${f.id}"${open===f.id?" open":""}><summary><b>${esc(f.t)}</b>${badge(f.s)}<span class="tfchip">${esc(area(f.a).t)}</span></summary><div class="tffb">${fichaBody(f)}${f.ref?`<p class="mut">Fonte: ${refL(f.ref)}</p>`:""}<button class="tfbtn2 sm pri" data-fpdf="${f.id}">${ic("pdf")} PDF</button></div></details>`).join("")}</div>
 <div class="tfrow"><button class="tfbtn2" id="fiAll">${ic("pdf")} Todas as fichas num PDF</button></div>`;
 const one=f=>`<section class="pf"><h1>${esc(f.t)}</h1><p class="ps">${esc(TF_SRC[f.s][0])}${f.ref?" · "+esc(TF_REF[f.ref].t):""}</p>${fichaBody(f)}<p class="ps">TecFlow · ${new Date().toLocaleDateString("pt-PT")} · confirmar sempre no documento original.</p></section>`;
 E.querySelectorAll("[data-fpdf]").forEach(b=>b.onclick=()=>{const f=TF_FICHAS.find(x=>x.id===b.dataset.fpdf);printHtml(one(f),"Ficha_"+f.t)});
 $("fiAll").onclick=()=>printHtml(TF_FICHAS.map(one).join(""),"TecFlow_fichas_de_bolso");
 if(open){const d=$("fi_"+open);if(d)setTimeout(()=>d.scrollIntoView({block:"start"}),50)}}
function refPage(E){const G=[["Segurança contra incêndio",["rjscie","rtscie","nt12","p773","govscie","en54"]],["Instalações elétricas",["rtiebt"]],["Automação predial",["knx","bacnet","modbus","dali","mbus"]],["Fabricantes",["siemens","fdulTM"]]];
 E.innerHTML=`<div class="tfkind ref"><b>📚 Normas e referências</b><span>Cada referência tem a sua classe. Os links abrem o site oficial (precisa de rede).</span></div>${G.map(g=>`<section class="tfcard"><h3>${esc(g[0])}</h3><ul class="tfrefs">${g[1].map(k=>`<li>${badge(TF_REF[k].s)} ${refL(k)}</li>`).join("")}</ul></section>`).join("")}
 <section class="tfcard"><h3>Como ler as classes</h3><div class="tfkv">${Object.entries(TF_SRC).map(([k,v])=>`<span>${badge(k)}</span><b>${esc(v[1])}</b>`).join("")}</div></section>`}
function fabPage(E){E.innerHTML=`<div class="tfkind ref"><b>🏭 Fabricantes</b><span>Marcas comuns em Portugal e onde aparecem. Para manuais oficiais, usa o site do fabricante e guarda o PDF em «Os meus PDF».</span></div>
 <input class="tecq" id="fbQ" placeholder="Procurar fabricante, sistema ou equipamento…"><div class="tfleds">${TF_MANUF.map(m=>`<article><header><b>${esc(m.n)}</b>${m.sys.map(s=>`<span class="tfchip">${esc(s)}</span>`).join("")}</header><p>${esc(m.p)}</p>${m.eq?`<p>${m.eq.map(e=>`<a class="tfchip" href="#/pesq?q=${encodeURIComponent(e)}">${esc(e)}</a>`).join(" ")}</p>`:""}<p><a href="#/bib/docs?maker=${encodeURIComponent(m.n)}">Os meus PDF desta marca →</a></p></article>`).join("")}</div>`;
 $("fbQ").oninput=e=>{const n=norm(e.target.value);E.querySelectorAll(".tfleds article").forEach(a=>a.hidden=n&&!norm(a.textContent).includes(n))}}

/* PDF guardados no aparelho (IndexedDB) */
const DB={db:null,open(){if(this.db)return Promise.resolve(this.db);return new Promise((res,rej)=>{let r;try{r=indexedDB.open("tecflow",1)}catch(e){rej(e);return}r.onupgradeneeded=()=>{r.result.createObjectStore("docs",{keyPath:"id"})};r.onsuccess=()=>{this.db=r.result;res(this.db)};r.onerror=()=>rej(r.error)})},
 tx(m){return this.open().then(d=>d.transaction("docs",m).objectStore("docs"))},
 all(){return this.tx("readonly").then(s=>new Promise((res,rej)=>{const q=s.getAll();q.onsuccess=()=>res(q.result||[]);q.onerror=()=>rej(q.error)}))},
 put(o){return this.tx("readwrite").then(s=>new Promise((res,rej)=>{const q=s.put(o);q.onsuccess=()=>res();q.onerror=()=>rej(q.error)}))},
 del(id){return this.tx("readwrite").then(s=>new Promise((res,rej)=>{const q=s.delete(id);q.onsuccess=()=>res();q.onerror=()=>rej(q.error)}))}};
const DTYPES=["Manual do fabricante","Ficha técnica","Procedimento","Norma / regulamento","Relatório / registo","Outro"];
function docsPage(E){const q0=route().q;E.innerHTML=`<div class="tfkind ref"><b>📁 Os meus PDF</b><span>Guarda manuais, fichas técnicas, procedimentos e normas <b>neste aparelho</b> para abrir no terreno, mesmo sem rede. Nada é enviado para a Internet.</span></div>
 <section class="tfcard"><h3>Adicionar documentos</h3><div class="tfform"><label>Tipo<select id="dTy">${DTYPES.map(t=>`<option>${t}</option>`).join("")}</select></label><label>Classe<select id="dCl">${Object.entries(TF_SRC).map(([k,v])=>`<option value="${k}">${v[0]}</option>`).join("")}</select></label>
  <label>Fabricante<input id="dMk" list="dMkL" value="${esc(q0.maker||"")}" placeholder="Ex.: Siemens"><datalist id="dMkL">${TF_MANUF.map(m=>`<option value="${esc(m.n)}">`).join("")}</datalist></label><label>Sistema / etiquetas<input id="dTg" placeholder="Ex.: SADI, FDnet, FDUL221"></label></div>
  <div class="tfrow"><label class="tfbtn2 pri">${ic("pdf")} Escolher PDF…<input type="file" id="dIn" accept="application/pdf,.pdf" multiple hidden></label><span class="mut" id="dSt"></span></div></section>
 <div class="tfrow"><input class="tecq" id="dQ" placeholder="Procurar nos meus documentos…" value="${esc(q0.maker||"")}"></div><div class="tfpick" id="dF"><button data-dc="" class="on">Todos</button>${Object.entries(TF_SRC).map(([k,v])=>`<button data-dc="${k}">${v[0]}</button>`).join("")}</div><div id="dL"><p class="muted">A carregar…</p></div><div id="dV"></div>`;
 let docs=[],fc="";
 const est=()=>{if(navigator.storage&&navigator.storage.estimate)navigator.storage.estimate().then(e=>{$("dSt").textContent=`Espaço usado: ${(e.usage/1048576).toFixed(1)} MB de ${(e.quota/1048576/1024).toFixed(1)} GB disponíveis`}).catch(()=>{})};
 const list=()=>{const n=norm($("dQ").value);const l=docs.filter(d=>(!fc||d.cls===fc)&&(!n||norm([d.title,d.type,d.maker,d.tags].join(" ")).includes(n))).sort((a,b)=>String(b.at).localeCompare(String(a.at)));
  $("dL").innerHTML=l.length?`<div class="tflist">${l.map(d=>`<div class="tfli"><span class="tfdi">${ic("pdf")}</span><div><b>${esc(d.title)}</b><small>${esc(d.type)}${d.maker?" · "+esc(d.maker):""}${d.tags?" · "+esc(d.tags):""} · ${(d.size/1048576).toFixed(1)} MB</small>${badge(d.cls)}</div><span><button class="tfbtn2 sm pri" data-do="${d.id}">Abrir</button><button class="tfbtn2 sm" data-dx="${d.id}" aria-label="Apagar">Apagar</button></span></div>`).join("")}</div>`:`<p class="muted">${docs.length?"Nada encontrado.":"Ainda não guardaste documentos. Escolhe um PDF acima."}</p>`;
  $("dL").querySelectorAll("[data-do]").forEach(b=>b.onclick=()=>{const d=docs.find(x=>x.id===b.dataset.do);if(!d)return;const u=URL.createObjectURL(d.blob);
   $("dV").innerHTML=`<section class="tfcard"><div class="tfrow"><b>${esc(d.title)}</b><a class="tfbtn2 sm" href="${u}" target="_blank" rel="noopener">Abrir em ecrã inteiro</a><button class="tfbtn2 sm" id="dVx">Fechar</button></div><iframe class="tfpdf" src="${u}" title="${esc(d.title)}"></iframe></section>`;
   $("dVx").onclick=()=>{$("dV").innerHTML="";URL.revokeObjectURL(u)};$("dV").scrollIntoView({block:"start"})});
  $("dL").querySelectorAll("[data-dx]").forEach(b=>b.onclick=async()=>{if(!confirm("Apagar este documento do aparelho?"))return;await DB.del(b.dataset.dx);load()})};
 const load=()=>DB.all().then(l=>{docs=l;list();est()}).catch(e=>{$("dL").innerHTML=`<p class="bad">Este navegador não permite guardar documentos (${esc(e&&e.message||"IndexedDB")}).</p>`});
 $("dQ").oninput=list;E.querySelectorAll("[data-dc]").forEach(b=>b.onclick=()=>{fc=b.dataset.dc;E.querySelectorAll("[data-dc]").forEach(x=>x.classList.toggle("on",x===b));list()});
 $("dIn").onchange=async e=>{const fs=[...e.target.files];if(!fs.length)return;try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{})}catch(_){}
  for(const f of fs){if(!/pdf$/i.test(f.type)&&!/\.pdf$/i.test(f.name)){toast(f.name+": só PDF.");continue}
   await DB.put({id:uid(),title:f.name.replace(/\.pdf$/i,""),name:f.name,type:$("dTy").value,cls:$("dCl").value,maker:$("dMk").value.trim(),tags:$("dTg").value.trim(),size:f.size,at:new Date().toISOString(),blob:f}).catch(err=>toast("Não foi possível guardar: "+(err&&err.message||err)))}
  e.target.value="";toast(fs.length===1?"Documento guardado no aparelho.":fs.length+" documentos guardados.");load()};
 load()}

/* ---------------- pesquisa ---------------- */
let IDX=null;
function buildIdx(){const L=[];const add=(type,t,k,to,s)=>L.push({type,t,k:norm(t+" "+(k||"")),to,s});
 TF_AREAS.forEach(a=>{add("Área",a.t,a.d,"#/"+a.id);a.subs.forEach(s=>add("Área",a.t+" › "+s[1],"","#/"+a.id+"/"+s[0]))});
 TF_FAULTS.forEach(f=>add("Avaria / código",f.c+" — "+f.t,f.cause+" "+TF_SYS[f.sys]+" "+f.id,f.sys==="fdul"?"#/sadi/fdul?m=3":"#/diag/falhas?sys="+f.sys,f.s));
 TF_LEDS.forEach(l=>add("LED",l.sys+" · "+l.eq+": "+l.led,l.sig,"#/diag/led",l.s));
 TF_MEAS.forEach(m=>add("Medição",m.sys+" · "+m.o,m.ok+" "+m.onde,"#/diag/med",m.s));
 TF_FICHAS.forEach(f=>add("Ficha",f.t,(f.h||"").replace(/<[^>]+>/g," "),"#/bib/fichas?f="+f.id,f.s));
 TF_MANUF.forEach(m=>{add("Fabricante",m.n,m.p+" "+m.sys.join(" ")+" "+(m.eq||[]).join(" "),"#/bib/fab");(m.eq||[]).forEach(e=>add("Equipamento",e+" ("+m.n+")",m.p,e==="FDUL221"?"#/sadi/fdul":"#/sadi/sie","of"))});
 TF_THEMES.forEach(t=>add("Tema",t.t,t.x,"#/tema/"+t.id,t.s));
 TF_PORTS.forEach(p=>add("Protocolo",p[0]+" — "+p[1],"porta","#/auto/ip","nr"));
 if(typeof TF_TAB!=="undefined"){Object.entries(TF_TAB).forEach(([k,x])=>{add("Tabela",x.t,x.r.map(r=>r.join(" ")).join(" ")+" "+(x.n||""),"#/auto/dados",x.s);x.r.forEach(r=>add("Tabela",x.t.split(" — ")[0]+": "+r[0]+" — "+r[1],r.slice(2).join(" "),"#/auto/dados",x.s))});
  TF_GLOS.forEach(g=>add("Glossário",g[0],g[1],"#/bib/glos?t="+encodeURIComponent(g[0]),"dd"));TF_DET.forEach(d=>add("Equipamento",d.t+" ("+d.n+")",d.uso+" "+d.ev,"#/sadi/det",d.s));
  TF_TOOLS.forEach(t=>add("Ferramenta",t.t,t.p,"#/diag/ferr",t.s));TF_COM.forEach(c=>add("Comissionamento",c.t,c.p.join(" "),"#/auto/com",c.s));TF_FA.forEach(f=>add("Alarme falso",f.c,f.p.join(" "),"#/sadi/fa",f.s))}
 add("Equipamento","FDUL221 — testador de linha FDnet","line tester siemens topologia","#/sadi/fdul","of");
 if(window.TEC&&TEC.index){const X=TEC.index();X.kb.forEach(k=>add("Guia",k.t,k.k,"#/bib/guia?g="+k.id,"nr"));X.proto.forEach(p=>add("Protocolo",p.n,p.uso+" "+p.norma+" "+p.lim,"#/auto/prot","nr"));X.sproto.forEach(p=>add("Protocolo",p.n+" (SADI)",p.uso,"#/sadi/proto","nr"));
  X.lel.forEach(e=>add("Equipamento",e.n,"laço ligação","#/sadi/lig","dd"));X.lels.forEach(e=>add("Equipamento",e.n,"siemens fdnet ligação","#/sadi/sie","of"));X.esq.forEach(e=>add("Esquema",e.t,"esquema ligação","#/diag/esq?e="+e.id,"dd"));X.ex.forEach(e=>add("Exercício",e.t,"bancada","#/auto/banc","dd"));X.calcs.forEach(c=>add("Calculadora",c.t,"calcular","#/diag/calc?sub="+c.id,"nr"))}
 return L}
function search(q){IDX=IDX||buildIdx();const n=norm(q);if(!n)return[];const toks=n.split(" ").filter(Boolean);
 return IDX.map(it=>{let sc=0;const tt=norm(it.t);for(const t of toks){if(tt.includes(t))sc+=3;else if(it.k.includes(t))sc+=1;else return null}if(tt.startsWith(n))sc+=4;if(tt.includes(n))sc+=2;return{...it,sc}}).filter(Boolean).sort((a,b)=>b.sc-a.sc)}
function searchPage(w,q){w.innerHTML=`${crumb([["#/","Início"],[null,"Pesquisa"]])}<form class="tfbig" id="sqF"><span>${ic("search")}</span><input id="sqQ" value="${esc(q)}" placeholder="Protocolo, equipamento, código de avaria ou fabricante" autocomplete="off" enterkeyhint="search"></form>
 <div class="tfpick" id="sqT"></div><div id="sqR"></div><div id="sqD"></div>`;
 let ft="";const run=()=>{const v=$("sqQ").value;const r=search(v);const types=[...new Set(r.map(x=>x.type))];
  $("sqT").innerHTML=r.length?[["","Tudo ("+r.length+")"],...types.map(t=>[t,t+" ("+r.filter(x=>x.type===t).length+")"])].map(([k,l])=>`<button data-ft="${esc(k)}" class="${ft===k?"on":""}">${esc(l)}</button>`).join(""):"";
  $("sqT").querySelectorAll("[data-ft]").forEach(b=>b.onclick=()=>{ft=b.dataset.ft;run()});
  const l=r.filter(x=>!ft||x.type===ft).slice(0,60);
  $("sqR").innerHTML=v.trim()?(l.length?`<div class="tflist">${l.map(x=>`<a href="${x.to}"><span class="tfty">${esc(x.type)}</span><b>${esc(x.t)}</b>${x.s?badge(x.s):""}</a>`).join("")}</div>`:`<p class="muted">Nada encontrado. Experimenta outra palavra, ou <a href="#/ia?q=${encodeURIComponent(v)}">pergunta ao assistente</a>.</p>`):`<p class="muted">Escreve um protocolo (KNX, BACnet…), um equipamento (FDCIO221, DB720…), um código (E06, exceção 02…) ou um fabricante.</p>`;
  if(v.trim().length>1)DB.all().then(ds=>{const n=norm(v);const m=ds.filter(d=>norm([d.title,d.type,d.maker,d.tags].join(" ")).includes(n));$("sqD").innerHTML=m.length?`<h3 class="tfh">Nos meus PDF</h3><div class="tflist">${m.map(d=>`<a href="#/bib/docs?maker=${encodeURIComponent(d.title)}"><span class="tfty">Documento</span><b>${esc(d.title)}</b>${badge(d.cls)}</a>`).join("")}</div>`:""}).catch(()=>{});else $("sqD").innerHTML=""};
 $("sqQ").oninput=()=>{ft="";run();history.replaceState(null,"","#/pesq?q="+encodeURIComponent($("sqQ").value));lastRoute=location.hash};$("sqF").onsubmit=e=>{e.preventDefault()};run();if(!S.field||!q)$("sqQ").focus()}

/* ---------------- treino adaptativo ---------------- */
function stat(top,ok,qid){const s=qzStats();const t=s.t[top]||{ok:0,n:0};t.n++;if(ok)t.ok++;s.t[top]=t;if(qid){const x=s.q[qid]||{ok:0,n:0};x.n++;if(ok)x.ok++;s.q[qid]=x}LS.set("tf-qz",s)}
function pickQs(n,f){const s=qzStats();const pool=TF_QZ.filter(q=>(!f.top||q.top===f.top)&&(!f.lv||q.lv<=f.lv));
 const w=q=>{const t=s.t[q.top],x=s.q[q.id];let v=1;if(t&&t.n)v+=3*(1-t.ok/t.n);if(!x)v+=1;else if(x.ok<x.n)v+=2*(1-x.ok/x.n);else v*=0.4;return v};
 const out=[],P=pool.slice();while(out.length<n&&P.length){const tot=P.reduce((a,q)=>a+w(q),0);let r=Math.random()*tot;let i=0;for(;i<P.length;i++){r-=w(P[i]);if(r<=0)break}out.push(P.splice(Math.min(i,P.length-1),1)[0])}return out}
function miniQuiz(ids){const qs=ids.map(id=>TF_QZ.find(q=>q.id===id)).filter(Boolean);return`<section class="tfcard"><h3>Verifica o que aprendeste</h3>${qs.map(q=>`<div class="tfmq" data-mq="${q.id}"><p><b>${esc(q.q)}</b></p><div class="tfopts">${q.o.map((o,i)=>`<button data-mo="${i}">${esc(o)}</button>`).join("")}</div><p class="tfmx" hidden></p></div>`).join("")}</section>`}
function wireMini(B){B.querySelectorAll("[data-mq]").forEach(d=>{const q=TF_QZ.find(x=>x.id===d.dataset.mq);d.querySelectorAll("[data-mo]").forEach(b=>b.onclick=()=>{if(d.dataset.done)return;d.dataset.done=1;const ok=+b.dataset.mo===q.a;stat(q.top,ok,q.id);
 d.querySelectorAll("[data-mo]").forEach((x,i)=>x.classList.add(i===q.a?"ok":(x===b?"bad":"dim")));const e=d.querySelector(".tfmx");e.hidden=false;e.innerHTML=(ok?"✔ ":"✘ ")+esc(q.e)})})}
function treino(w,q){const s=qzStats();const lv=+q.lv||0;const top=TF_TOPICS[q.top]?q.top:"";
 if(q.go||lv){return quizRun(w,pickQs(5,{top,lv}),lv?`Teste do nível ${lv}`:top?`Treino: ${TF_TOPICS[top]}`:"Treino adaptativo")}
 w.innerHTML=`${crumb([["#/","Início"],[null,"Treino"]])}<section class="tfcard"><h2>🎯 Treino adaptativo</h2><p>O TecFlow escolhe mais perguntas dos temas onde erras mais e repete as que falhaste. Tudo fica só neste aparelho.</p>
 <div class="tfrow"><a class="tfbtn2 pri" href="#/treino?go=1">Treinar agora (5 perguntas)</a></div></section>
 <section class="tfcard"><h3>Domínio por tema</h3><div class="tfmast">${Object.entries(TF_TOPICS).map(([k,v])=>{const t=s.t[k];const p=t&&t.n?Math.round(t.ok/t.n*100):null;return`<a href="#/treino?top=${k}&go=1" class="${p==null?"":p<70?"low":p<85?"mid":"hi"}"><b>${esc(v)}</b><span class="tfbar2"><i style="width:${p||0}%"></i></span><small>${p==null?"sem respostas":p+" % · "+t.n+" resp."}</small></a>`}).join("")}</div>
 <p class="mut">Toca num tema para treinar só esse. Os cenários do FDUL221 (SADI → Testador FDUL221 → Módulo 4) também contam.</p><div class="tfrow"><button class="tfbtn2" id="qzRst">Apagar o meu progresso</button></div></section>`;
 $("qzRst").onclick=()=>{if(confirm("Apagar todo o progresso do treino neste aparelho?")){localStorage.removeItem("tf-qz");treino(w,{})}}}
function quizRun(w,qs,title){let i=0,ok=0;const draw=()=>{const q=qs[i];
 if(!q){w.innerHTML=`${crumb([["#/","Início"],["#/treino","Treino"],[null,"Resultado"]])}<section class="tfcard"><h2>${esc(title)}: ${ok}/${qs.length}</h2><p>${ok===qs.length?"Excelente! 🎉":ok>=qs.length*0.6?"Bom trabalho — continua a treinar os pontos fracos.":"Vale a pena rever estes temas."}</p>
  <div class="tfrow"><a class="tfbtn2 pri" href="#/treino?go=1&r=${Date.now()}">Mais 5 perguntas</a><a class="tfbtn2" href="#/treino">Ver progresso</a></div></section>`;return}
 w.innerHTML=`${crumb([["#/","Início"],["#/treino","Treino"],[null,title]])}<section class="tfcard tfquiz"><header><span class="tfchip">${esc(TF_TOPICS[q.top])}</span><span class="tfchip">Nível ${q.lv}</span><span class="mut">${i+1}/${qs.length}</span></header><h3>${esc(q.q)}</h3><div class="tfopts">${q.o.map((o,k)=>`<button data-qo="${k}">${esc(o)}</button>`).join("")}</div><div id="qzE"></div></section>`;
 w.querySelectorAll("[data-qo]").forEach(b=>b.onclick=()=>{if(w.querySelector(".tfopts").dataset.done)return;w.querySelector(".tfopts").dataset.done=1;const good=+b.dataset.qo===q.a;if(good)ok++;stat(q.top,good,q.id);
  w.querySelectorAll("[data-qo]").forEach((x,k)=>x.classList.add(k===q.a?"ok":(x===b?"bad":"dim")));$("qzE").innerHTML=`<p class="${good?"ok":"bad"}">${good?"✔ Certo.":"✘ Não é bem assim."} ${esc(q.e)}</p><button class="tfbtn2 pri" id="qzN">${i+1<qs.length?"Seguinte →":"Ver resultado"}</button>`;$("qzN").onclick=()=>{i++;draw()};$("qzN").focus()})};
 if(!qs.length){w.innerHTML=`<p class="muted">Sem perguntas para este filtro.</p>`;return}draw()}

/* ---------------- percursos ---------------- */
function markPathVisit(h){const d=LS.get("tf-path",{});let ch=false;TF_PATHS.forEach(p=>p.steps.forEach((s,i)=>{if(!s.quiz&&s.to===h&&!d[p.id+":"+i]){d[p.id+":"+i]=1;ch=true}}));if(ch)LS.set("tf-path",d)}
function pathPage(w,id){const p=TF_PATHS.find(x=>x.id===id)||TF_PATHS[0];LS.set("tf-lv",p.id);const d=LS.get("tf-path",{});const [dn,n]=pathProg(p);const next=p.steps.findIndex((s,i)=>!d[p.id+":"+i]);
 w.innerHTML=`${crumb([["#/","Início"],[null,"Percurso"]])}<section class="tfcard"><h2>${p.ic} ${esc(p.t)}</h2><p>${esc(p.d)}</p><span class="tfbar2 big"><i style="width:${Math.round(dn/n*100)}%"></i></span><p class="mut">${dn}/${n} passos concluídos</p>
 ${next>=0?`<div class="tfrow"><a class="tfbtn2 pri" href="${p.steps[next].to}">Continuar: ${esc(p.steps[next].t)} →</a></div>`:`<p class="ok">✔ Percurso concluído!</p>`}</section>
 <ol class="tfsteps chk">${p.steps.map((s,i)=>`<li class="${d[p.id+":"+i]?"ok":""}"><label><input type="checkbox" data-ps="${i}"${d[p.id+":"+i]?" checked":""}><a href="${s.to}"><b>${esc(s.t)}</b></a></label></li>`).join("")}</ol>
 <div class="tfpaths sm">${TF_PATHS.filter(x=>x.id!==p.id).map(x=>`<a class="tfpath" href="#/percurso/${x.id}"><span class="tfpi">${x.ic}</span><b>${esc(x.t)}</b></a>`).join("")}</div>`;
 w.querySelectorAll("[data-ps]").forEach(c=>c.onchange=()=>{const D2=LS.get("tf-path",{});if(c.checked)D2[p.id+":"+c.dataset.ps]=1;else delete D2[p.id+":"+c.dataset.ps];LS.set("tf-path",D2);pathPage(w,p.id)})}

/* ---------------- assistente ---------------- */
function iaPage(w,q){w.innerHTML=`${crumb([["#/","Início"],[null,"Assistente"]])}<div class="tfkind ref"><b>💬 Assistente técnico</b><span>Responde com base no guia e nas tabelas do TecFlow, sem Internet. Para códigos e equipamentos usa também a <a href="#/pesq">pesquisa</a>.</span></div><div id="iaB" data-p="ia"></div>`;
 if(!window.TEC||!TEC.panel("ia",$("iaB"),q.q?{q:q.q}:{}))$("iaB").innerHTML=`<p class="muted">Assistente indisponível.</p>`}

/* ---------------- arranque ---------------- */
function boot(){S.field=!!LS.get("tf-field",false);document.body.classList.toggle("field",S.field);hookTec();
 const fb=$("tfFieldB");if(fb){fb.setAttribute("aria-pressed",S.field);fb.onclick=()=>setField(!S.field)}
 const hq=$("tfQf");if(hq)hq.onsubmit=e=>{e.preventDefault();const v=$("tfQ").value;nav("#/pesq?q="+encodeURIComponent(v));$("tfQ").blur()};
 /* links antigos (?tab=…, ?q=…) */
 const P=new URLSearchParams(location.search);if(!location.hash){const t=P.get("tab"),qq=P.get("q");if(qq)location.replace("#/ia?q="+encodeURIComponent(qq));else if(t==="calc")location.replace("#/diag/calc");else if(t==="cons")location.replace("#/bib/guia");else if(t==="ia")location.replace("#/ia")}
 render()}
window.TF={render,search,nav,stat};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
