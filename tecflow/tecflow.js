/* =========================================================
   TecFlow — bancada técnica (RTIEBT, NT 12, automação, SADI)
   Plataforma aberta a qualquer pessoa: sem conta e sem servidor.
   Tudo corre no aparelho; os cálculos guardados ficam só no histórico deste aparelho.
   ========================================================= */
"use strict";
window.TEC_BRAND="TecFlow";
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const now=()=>new Date().toISOString();
const fmtDate=iso=>{if(!iso)return"";const d=new Date(iso);return d.toLocaleDateString("pt-PT",{day:"2-digit",month:"2-digit"})+" "+d.toLocaleTimeString("pt-PT",{hour:"2-digit",minute:"2-digit"})};
function toast(m){const t=document.createElement("div");t.className="toast";t.textContent=m;document.body.appendChild(t);setTimeout(()=>t.remove(),3400)}
function logPatch(it,patch){return patch}
function tRef(t){return t&&t.seq?"#"+t.seq:"tarefa"}
async function saveBlob(name,blob){
 try{const f=new File([blob],name,{type:blob.type||"application/octet-stream"});
  if(/iPhone|iPad|iPod/.test(navigator.userAgent)&&navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:name});return}}catch(e){if(e&&e.name==="AbortError")return}
 const u=URL.createObjectURL(blob);const a=document.createElement("a");a.href=u;a.download=name;a.rel="noopener";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000);toast("Ficheiro descarregado: "+name)}
/* sem obra, sem utilizador, sem base de dados */
const S={pub:true,field:false,view:"tecnico",projectId:null,planId:null,meId:null,canWrite:false,isCoord:false,isProjAdmin:false,demo:true,meta:{name:"TecFlow"},items:[],issues:[],plans:[]};
const api={set(){return Promise.resolve()},update(){return Promise.resolve()},del(){return Promise.resolve()}};
function go(){window.scrollTo({top:0,behavior:"smooth"})}
(function boot(){
 /* aviso: pode ser fechado; fica lembrado neste aparelho */
 const ad=$("tfAviso");try{if(localStorage.getItem("tf-aviso")==="1")ad.hidden=true}catch(e){}
 const ax=$("tfAvisoX");if(ax)ax.onclick=()=>{ad.hidden=true;try{localStorage.setItem("tf-aviso","1")}catch(e){}};
 /* funcionar sem rede */
 if("serviceWorker" in navigator&&location.protocol!=="file:")navigator.serviceWorker.register("sw.js").catch(()=>{});
 /* instalar como app (Android / computador) */
 let ip=null;const ib=$("tfInstall");
 window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();ip=e;if(ib)ib.hidden=false});
 window.addEventListener("appinstalled",()=>{ip=null;if(ib)ib.hidden=true;toast("TecFlow instalado.")});
 if(ib)ib.onclick=async()=>{if(!ip)return;ip.prompt();try{await ip.userChoice}catch(e){}ip=null;ib.hidden=true};
 /* partilhar */
 const sh=$("tfShare");if(sh)sh.onclick=async()=>{const url=location.origin+location.pathname;
  try{if(navigator.share){await navigator.share({title:"TecFlow — bancada técnica",text:"Calculadoras RTIEBT, guia de bolso, esquemas, automação e SADI — grátis e sem conta.",url});return}}catch(e){if(e&&e.name==="AbortError")return}
  try{await navigator.clipboard.writeText(url);toast("Link copiado.")}catch(e){prompt("Copia o link:",url)}};
})();
