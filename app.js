
"use strict";
/* =========================================================
   Constantes de domínio
   ========================================================= */
const TYPES=[
 {k:"DI",n:"Deteção incêndio"},{k:"CV",n:"Câmara CCTV"},{k:"IL",n:"Iluminação"},
 {k:"QE",n:"Quadro elétrico"},{k:"TM",n:"Tomada"},{k:"AV",n:"AVAC"},{k:"RD",n:"Rede / dados"},{k:"EQ",n:"Outro"}];
const STAGES=[
 {k:"previsto",n:"Previsto",c:"var(--st0)"},{k:"instalado",n:"Instalado",c:"var(--st1)"},
 {k:"enderecado",n:"Endereçado",c:"var(--st2)"},{k:"testado",n:"Testado",c:"var(--st3)"},
 {k:"validado",n:"Validado",c:"var(--st4)"},{k:"aceite",n:"Aceite",c:"var(--st5)"}];
/* quem pode marcar cada etapa: validar = coordenação; aceitar = fiscalização/cliente ou coordenação */
function canStage(k){return k==="validado"?S.isCoord:k==="aceite"?(S.isCoord||isClient()):S.canWrite}
function lockMsg(k){return k==="validado"?"Só a coordenação pode validar.":"Só a fiscalização / cliente (ou a coordenação) pode aceitar."}
/* histórico: cada alteração fica registada no próprio equipamento (últimas 40) */
function logPatch(it,patch,t,extra){patch.log=[...((it&&it.log)||[]).slice(-39),{at:now(),by:S.meId,t,...(extra||{})}];return patch}
function logText(e){return e.u?`${e.t} ${nameOf(e.u)}`:e.t}
const today=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
const dayOf=iso=>{if(!iso)return"";const d=new Date(iso);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
const fmtDay=d=>d?d.split("-").reverse().slice(0,2).join("/"):"";
/* IDs / MAC repetidos: guardados na mesma, mas destacados */
let dupCache={key:null,map:null};
function dupMap(){const key=S.items.length+":"+S.items.map(i=>i.devId+"|"+i.mac).join(",");if(dupCache.key===key)return dupCache.map;
 const by={};for(const i of S.items){if(i.devId){const k="I:"+String(i.devId).trim().toUpperCase();(by[k]=by[k]||[]).push(i.id)}if(i.mac){const k="M:"+normMac(i.mac);(by[k]=by[k]||[]).push(i.id)}}
 const m={};for(const ids of Object.values(by))if(ids.length>1)for(const id of ids)m[id]=Math.max(m[id]||0,ids.length);dupCache={key,map:m};return m}
function isDup(it){return !!dupMap()[it.id]}
function dupCount(){return Object.keys(dupMap()).length}
function isLate(it){return it.due&&it.due<today()&&sIdx(it.stage)<3}
const CHECKS={
 DI:["Base fixa e alinhada","Endereço programado e confirmado no painel","Teste funcional (fumo, calor ou acionamento)","LED de estado OK","Etiqueta de identificação colocada"],
 CV:["Fixação e orientação","Alimentação PoE OK","IP e MAC registados","Imagem no gravador / VMS","Foco e ângulo validados"],
 IL:["Fixação","Ligação elétrica","Endereço DALI/KNX programado","Teste ligar, desligar e regular","Bloco de emergência testado (se aplicável)"],
 QE:["Identificação dos circuitos","Aperto de bornes","Teste dos diferenciais","Medição de isolamento","Esquema atualizado no quadro"],
 TM:["Fixação","Polaridade verificada","Terra verificada"],
 AV:["Fixação","Alimentação","Comunicação com o controlador","Teste de funcionamento"],
 RD:["Cabo certificado","Etiquetado nas duas pontas","Ligado ao bastidor / switch"],
 EQ:["Instalado conforme projeto","Teste de funcionamento"]};
const ck=it=>((it.checks||{})[it.type])||{};
const tOf=k=>TYPES.find(t=>t.k===k)||TYPES[TYPES.length-1];
const sIdx=k=>Math.max(0,STAGES.findIndex(s=>s.k===k));
const sOf=k=>STAGES[sIdx(k)];
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const now=()=>new Date().toISOString();
const fmtDate=iso=>{if(!iso)return"";const d=new Date(iso);return d.toLocaleDateString("pt-PT",{day:"2-digit",month:"2-digit"})+" "+d.toLocaleTimeString("pt-PT",{hour:"2-digit",minute:"2-digit"})};
function toast(m){const t=document.createElement("div");t.className="toast";t.textContent=m;document.body.appendChild(t);setTimeout(()=>t.remove(),3400)}

/* =========================================================
   Estado
   ========================================================= */
const CFG=window.OBRA_CONFIG||{};
const S={plans:[],items:[],issues:[],meta:{},ready:false,
 me:null,meId:null,role:null,isCoord:false,canWrite:false,local:false,demo:false,session:null,
 online:navigator.onLine,syncing:false,pending:0,lastSyncAt:null,
 view:"home",planId:null,sel:null,mode:"nav",filter:"todo",q:"",
 projectId:null,projects:[],mp:false,pm:[]};      // projeto aberto, projetos com acesso, servidor com vários projetos
const PK=(c,id,p)=>(p||S.projectId)+"|"+c+"|"+id;
let sb=null;                       // cliente Supabase
let sampleFn=true,sampleMax=2;      // leitura de etiquetas no aparelho (sempre disponível)
const names={};                     // id -> {name}
let members=[];                     // equipa: [{user_id,name,email,role}]
let legacyPeople={};                // nomes vindos da importação (Planta de Obra no Claude)

/* =========================================================
   Base local no aparelho (IndexedDB): dados, fila de envio e ficheiros
   ========================================================= */
const IDBX=(()=>{let p;
 function open(){if(!p)p=new Promise((res,rej)=>{const r=indexedDB.open("planta-obra-app",1);
  r.onupgradeneeded=()=>{const d=r.result;d.createObjectStore("docs");d.createObjectStore("outbox",{autoIncrement:true});d.createObjectStore("files");d.createObjectStore("kv")};
  r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});return p}
 function tx(store,mode,fn){return open().then(db=>new Promise((res,rej)=>{const t=db.transaction(store,mode);const req=fn(t.objectStore(store));
  t.oncomplete=()=>res(req&&"result" in req?req.result:undefined);t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error)}))}
 return{get:(s,k)=>tx(s,"readonly",st=>st.get(k)),put:(s,k,v)=>tx(s,"readwrite",st=>st.put(v,k)),add:(s,v)=>tx(s,"readwrite",st=>st.add(v)),
  del:(s,k)=>tx(s,"readwrite",st=>st.delete(k)),clear:s=>tx(s,"readwrite",st=>st.clear()),count:s=>tx(s,"readonly",st=>st.count()),
  all:s=>open().then(db=>new Promise((res,rej)=>{const out=[];const c=db.transaction(s,"readonly").objectStore(s).openCursor();
   c.onsuccess=()=>{const cur=c.result;if(cur){out.push({key:cur.key,value:cur.value});cur.continue()}else res(out)};c.onerror=()=>rej(c.error)}))}})();

/* =========================================================
   Dados: memória + aparelho + fila de envio (funciona sem rede)
   ========================================================= */
const COLS=["plans","items","issues","meta"];
let L={plans:{},items:{},issues:{},meta:{}};const subsC={plans:[],items:[],issues:[],meta:[]};
function emit(c){const arr=Object.entries(L[c]).map(([id,v])=>({id,...v}));subsC[c].forEach(f=>f(arr))}
const emitQ={};function emitSoon(c){if(emitQ[c])return;emitQ[c]=1;setTimeout(()=>{delete emitQ[c];emit(c)},0)}
function deepMerge(a,b){const o={...(a||{})};for(const[k,v]of Object.entries(b)){o[k]=v&&typeof v==="object"&&!Array.isArray(v)&&o[k]&&typeof o[k]==="object"&&!Array.isArray(o[k])?deepMerge(o[k],v):v}return o}
function onWriteErr(e){console.warn(e);toast("Não foi possível guardar no aparelho: "+((e&&e.message)||"erro"))}
async function persist(c,id,data,deleted){const P=S.projectId;
 try{if(deleted)await IDBX.del("docs",PK(c,id,P));else await IDBX.put("docs",PK(c,id,P),{project:P,col:c,id,data});
  if(!S.demo){await IDBX.add("outbox",{t:"doc",project:P,col:c,id,data:deleted?{}:data,deleted:!!deleted});S.pending++;renderSync();scheduleFlush()}}
 catch(e){onWriteErr(e)}}
/* regra da obra: um equipamento com ID (ou MAC) registado conta sempre como Instalado e Endereçado */
function autoStage(d){if(!d||!(String(d.devId||"").trim()||String(d.mac||"").trim()))return false;if(sIdx(d.stage)>=2)return false;
 const at=now(),by=S.meId;d.stageLog={...(d.stageLog||{})};if(!d.stageLog.instalado)d.stageLog.instalado={by,at,auto:true};d.stageLog.enderecado={by,at,auto:true};
 d.stage="enderecado";d.log=[...(d.log||[]).slice(-39),{at,by,t:"Etapa: Endereçado (automático: ID registado)"}];return true}
/* aplica a regra aos equipamentos que já existiam */
let autoDone=false;
async function autoStageAll(){if(autoDone||!(S.canWrite||S.demo))return;autoDone=true;let n=0;
 for(const[id,v]of Object.entries(L.items)){if((String(v.devId||"").trim()||String(v.mac||"").trim())&&sIdx(v.stage)<2){await api.update("items",id,{});n++}}
 if(n)toast(`${n} equipamento${n>1?"s":""} com ID passaram a Endereçado.`)}
const api={
 sub(c,cb){subsC[c].push(cb);emit(c);return()=>{}},
 async set(c,id,data){if(!S.projectId){toast("Escolhe primeiro um projeto.");return}if(!S.canWrite&&!S.demo&&c!=="meta"){toast("Sem permissão para alterar.");return}if(c==="items")autoStage(data);L[c][id]=data;emitSoon(c);await persist(c,id,data,false)},
 async update(c,id,patch){if(!S.projectId||!L[c][id])return;const d=deepMerge(L[c][id],patch);if(c==="items")autoStage(d);L[c][id]=d;emitSoon(c);await persist(c,id,d,false)},
 async del(c,id){if(!S.projectId)return;delete L[c][id];emitSoon(c);await persist(c,id,null,true)}};
/* dados guardados antes de haver vários projetos passam para o projeto "p0" */
async function migrateLocal(){if(await IDBX.get("kv","mig3").catch(()=>null))return;
 const rows=await IDBX.all("docs").catch(()=>[]);for(const r of rows){const v=r.value;if(v&&!v.project){await IDBX.put("docs","p0|"+v.col+"|"+v.id,{...v,project:"p0"}).catch(()=>{});await IDBX.del("docs",r.key).catch(()=>{})}}
 const ls=await IDBX.get("kv","lastSync").catch(()=>null);if(ls)await IDBX.put("kv","lastSync:p0",ls).catch(()=>{});await IDBX.put("kv","mig3",1).catch(()=>{})}
async function loadLocal(){await migrateLocal();const rows=S.projectId?await IDBX.all("docs").catch(()=>[]):[];L={plans:{},items:{},issues:{},meta:{}};
 for(const r of rows){const v=r.value;if(v&&v.project===S.projectId&&L[v.col])L[v.col][v.id]=v.data}
 S.pending=await IDBX.count("outbox").catch(()=>0);S.lastSyncAt=await IDBX.get("kv","lastSyncAt").catch(()=>null)}

/* ---- sincronização com o Supabase ---- */
let flushing=false,flushTimer=null,pulling=false,pullAgain=false;
function scheduleFlush(ms=500){clearTimeout(flushTimer);flushTimer=setTimeout(flush,ms)}
async function flush(){if(flushing||S.demo||!sb||!S.session||!navigator.onLine||!S.canWrite)return;flushing=true;S.syncing=true;renderSync();
 let ok=true;
 try{const rows=await IDBX.all("outbox");
  for(const r of rows.filter(x=>x.value.t==="file")){const v=r.value;const b=await IDBX.get("files",v.ref);
   if(b){const{error}=await sb.storage.from("ficheiros").upload(v.path,b,{contentType:b.type||v.type||"application/octet-stream",upsert:true});
    if(error&&!/exists|duplicate/i.test(error.message||""))throw error}
   await IDBX.del("outbox",r.key)}
  // no servidor antigo (sem a atualização 3) só existe o projeto "p0"
  const docs=rows.filter(x=>x.value.t==="doc"&&(S.mp||(x.value.project||"p0")==="p0"));const last={};for(const r of docs)last[(r.value.project||"p0")+"|"+r.value.col+"|"+r.value.id]=r.value;
  const batch=Object.values(last).map(v=>({...(S.mp?{project:v.project||"p0"}:{}),col:v.col,id:v.id,data:v.data||{},deleted:!!v.deleted}));
  for(let i=0;i<batch.length;i+=200){const{error}=await sb.from("docs").upsert(batch.slice(i,i+200),{onConflict:S.mp?"project,col,id":"col,id"});if(error)throw error}
  for(const r of docs)await IDBX.del("outbox",r.key)}
 catch(e){ok=false;console.warn("sync",e);if(/row-level security|permission/i.test((e&&e.message)||""))toast("O servidor recusou a alteração: a tua conta ainda não está aprovada.")}
 finally{flushing=false;S.pending=await IDBX.count("outbox").catch(()=>S.pending);S.syncing=false;renderSync();
  if(S.pending&&navigator.onLine)scheduleFlush(ok?800:15000)}}
async function pull(){if(S.demo||!sb||!S.session||!navigator.onLine||!S.canWrite&&!isActive()||!S.projectId)return;
 if(pulling){pullAgain=true;return}pulling=true;S.syncing=true;renderSync();
 try{const pend=new Set((await IDBX.all("outbox")).filter(x=>x.value.t==="doc").map(x=>(x.value.project||"p0")+"|"+x.value.col+"|"+x.value.id));
  const P=S.projectId;if(!S.mp&&P!=="p0")return;
  let since=(await IDBX.get("kv","lastSync:"+P))||"1970-01-01T00:00:00Z",more=true;
  while(more){let q=sb.from("docs").select("col,id,data,deleted,updated_at").gt("updated_at",since);if(S.mp)q=q.eq("project",P);
   const{data,error}=await q.order("updated_at",{ascending:true}).limit(1000);
   if(error)throw error;
   const here=P===S.projectId;
   for(const r of data){if(!L[r.col]||pend.has(P+"|"+r.col+"|"+r.id))continue;
    if(r.deleted){if(here)delete L[r.col][r.id];await IDBX.del("docs",PK(r.col,r.id,P))}else{if(here)L[r.col][r.id]=r.data;await IDBX.put("docs",PK(r.col,r.id,P),{project:P,col:r.col,id:r.id,data:r.data})}
    if(here)emitSoon(r.col)}
   if(data.length)since=data[data.length-1].updated_at;more=data.length===1000}
  await IDBX.put("kv","lastSync:"+P,since);S.lastSyncAt=new Date().toISOString();await IDBX.put("kv","lastSyncAt",S.lastSyncAt)}
 catch(e){console.warn("pull",e)}
 finally{pulling=false;S.syncing=false;renderSync();if(pullAgain){pullAgain=false;pull()}}}
async function syncNow(){await flush();await pull()}
let rtChan=null,rtTimer=null;
function realtime(){if(!sb||rtChan)return;
 rtChan=sb.channel("obra").on("postgres_changes",{event:"*",schema:"public",table:"docs"},()=>{clearTimeout(rtTimer);rtTimer=setTimeout(pull,400)})
  .on("postgres_changes",{event:"*",schema:"public",table:"members"},()=>loadMembers().then(render))
  .on("postgres_changes",{event:"*",schema:"public",table:"projects"},()=>loadProjects().then(render))
  .on("postgres_changes",{event:"*",schema:"public",table:"project_members"},()=>loadProjects().then(render)).subscribe()}
window.addEventListener("online",()=>{S.online=true;renderSync();syncNow()});
window.addEventListener("offline",()=>{S.online=false;renderSync()});
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")syncNow()});
setInterval(()=>{if(document.visibilityState==="visible")syncNow()},60000);

/* =========================================================
   Ficheiros (plantas, PDFs, fotos): guardados no aparelho e enviados
   para o Supabase Storage quando há rede
   ========================================================= */
const urlCache={};
function fileExt(t){t=t||"";if(t==="application/pdf")return"pdf";if(t==="image/png")return"png";if(t==="image/webp")return"webp";if(!t||/^image\/jpe?g$/.test(t))return"jpg";
 return({"application/vnd.openxmlformats-officedocument.wordprocessingml.document":"docx","application/msword":"doc","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":"xlsx","application/vnd.ms-excel":"xls","application/zip":"zip","text/plain":"txt","text/csv":"csv","image/gif":"gif","image/heic":"heic"})[t]||(t.startsWith("image/")?"img":"bin")}
function srcOf(ref){return !ref?"":/^(data:|blob:)/.test(ref)?ref:(urlCache[ref]||"")}
function dataUrlToBlob(u){const ci=u.indexOf(",");const h=u.slice(0,ci),b=u.slice(ci+1);if(!/;base64/i.test(h))return new Blob([decodeURIComponent(b)],{type:(h.match(/^data:([^;,]*)/)||[])[1]||"text/plain"});const bin=atob(b);const a=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return new Blob([a],{type:(h.match(/:(.*?);/)||[])[1]||"application/octet-stream"})}
const blobToDataUrl=b=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(b)});
async function putFile(blob,type){type=type||blob.type||"image/jpeg";if(blob.size>50e6)throw new Error("ficheiro demasiado grande (máx. 50 MB)");
 const path=`${uid()}.${fileExt(type)}`,ref="sb:"+path;const b=blob.type===type?blob:new Blob([blob],{type});
 await IDBX.put("files",ref,b);
 if(!S.demo){await IDBX.add("outbox",{t:"file",ref,path,type});S.pending++;renderSync();scheduleFlush(200)}
 return ref}
const blobWait={};
async function blobOf(ref){if(!ref)throw new Error("sem ficheiro");if(ref.startsWith("data:"))return dataUrlToBlob(ref);
 const local=await IDBX.get("files",ref).catch(()=>null);if(local)return local;
 if(ref.startsWith("sb:")&&sb&&navigator.onLine){if(blobWait[ref])return blobWait[ref];
  blobWait[ref]=(async()=>{const{data,error}=await sb.storage.from("ficheiros").download(ref.slice(3));if(error||!data)throw new Error("ficheiro indisponível");
   await IDBX.put("files",ref,data).catch(()=>{});return data})();
  try{return await blobWait[ref]}finally{delete blobWait[ref]}}
 throw new Error(navigator.onLine?"ficheiro indisponível":"ficheiro ainda não guardado neste aparelho (sem rede)")}
async function urlOf(ref){if(!ref)return"";if(/^(data:|blob:)/.test(ref))return ref;if(urlCache[ref])return urlCache[ref];
 const b=await blobOf(ref);urlCache[ref]=URL.createObjectURL(b);return urlCache[ref]}
function hydrate(root){(root||document).querySelectorAll("img[data-ref]").forEach(im=>{const r=im.dataset.ref;if(im.dataset.done===r)return;im.dataset.done=r;
 urlOf(r).then(u=>{if(im.dataset.ref===r)im.src=u}).catch(()=>{im.alt="Foto indisponível sem rede"})})}
async function shrink(file,max=1400,q=.82){const url=URL.createObjectURL(file);try{const im=new Image();
 await new Promise((res,rej)=>{im.onload=res;im.onerror=()=>rej(new Error("formato de imagem não suportado"));im.src=url});
 const k=Math.min(1,max/Math.max(im.naturalWidth,im.naturalHeight));const cv=document.createElement("canvas");
 cv.width=Math.round(im.naturalWidth*k);cv.height=Math.round(im.naturalHeight*k);const cx=cv.getContext("2d");cx.fillStyle="#fff";cx.fillRect(0,0,cv.width,cv.height);cx.drawImage(im,0,0,cv.width,cv.height);
 return await new Promise(r=>cv.toBlob(r,"image/jpeg",q))}finally{URL.revokeObjectURL(url)}}
/* foto original (qualidade máxima) guardada só neste aparelho para a leitura de etiquetas; a cópia partilhada é mais leve */
const ORIG_MAX=40;
async function hiRes(file){const ok=/^image\/(jpeg|png|webp)$/.test(file.type||"")&&file.size<=15e6;
 if(ok){try{const bm=await createImageBitmap(file);const L=Math.max(bm.width,bm.height);bm.close&&bm.close();if(L<=4200)return file}catch(e){}}
 try{return await shrink(file,4200,.95)}catch(e){return file}}
async function origPut(ref,blob){try{await IDBX.put("files","orig:"+ref,blob);let l=(await IDBX.get("kv","origList").catch(()=>null))||[];l=l.filter(x=>x!==ref);l.push(ref);
 while(l.length>ORIG_MAX){const o=l.shift();await IDBX.del("files","orig:"+o).catch(()=>{})}await IDBX.put("kv","origList",l)}catch(e){}}
async function bestBlobOf(ref){const o=await IDBX.get("files","orig:"+ref).catch(()=>null);return o||blobOf(ref)}
/* guardar um piso inteiro no aparelho para usar sem rede */
async function keepOffline(p,onStep){const refs=[p.img,p.pdf,p.ov&&p.ov.ref,p.fw&&p.fw.img].filter(Boolean);
 S.items.filter(i=>i.planId===p.id).forEach(i=>(i.photos||[]).forEach(r=>refs.push(r)));S.issues.filter(x=>x.planId===p.id&&x.photo).forEach(x=>refs.push(x.photo));
 let ok=0,k=0;for(const r of refs){k++;onStep&&onStep(k,refs.length);try{await blobOf(r);ok++}catch(e){}}return{ok,total:refs.length}}

/* =========================================================
   Pessoas e papéis
   ========================================================= */
/* hierarquia de acesso (do mais alto para o mais baixo) */
const ROLE_N={admin:"Administrador",coord:"Coordenação",tecnico:"Técnico",fiscal:"Fiscalização / cliente",leitura:"Só leitura",pendente:"À espera de aprovação"};
const ROLE_ORDER=["admin","coord","tecnico","fiscal","leitura","pendente"];
function setRole(r){S.role=r||null;S.isAdmin=r==="admin";S.isCoord=r==="coord"||r==="admin";S.canWrite=!!r&&r!=="pendente"&&r!=="leitura"}
function isActive(){return !!S.role&&S.role!=="pendente"}
function isClient(){return S.role==="fiscal"}
async function loadMembers(){if(!sb)return;const{data,error}=await sb.from("members").select("user_id,name,email,role,created_at").order("created_at");
 if(error||!data||!data.some(m=>m.user_id===S.meId))return;members=data;await IDBX.put("kv","members",data).catch(()=>{});applyMembers()}
function applyMembers(){members.forEach(m=>{names[m.user_id]={name:m.name||m.email}});const me=members.find(m=>m.user_id===S.meId);if(me){setRole(me.role);S.me={...(S.me||{}),name:me.name||S.me&&S.me.name,email:me.email}}}
function wantNames(){}
function nameOf(id){if(!id)return"";if(S.demo&&id==="demo")return"Eu";if(id===S.meId)return(S.me&&S.me.name)||"Eu";return(names[id]&&names[id].name)||legacyPeople[id]||"Alguém"}
function initials(n){return String(n||"?").split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join("")||"?"}
function hue(id){let h=0;for(const c of String(id))h=(h*31+c.charCodeAt(0))%360;return h}
function personChip(id,removable){return`<span class="person" data-id="${esc(id)}"><span class="ini" style="--h:${hue(id)}">${esc(initials(nameOf(id)))}</span><span>${esc(nameOf(id))}</span>${removable?`<button type="button" data-rm="${esc(id)}" aria-label="Remover">×</button>`:""}</span>`}
/* seletor de pessoas: procura na equipa */
function mountPicker(host,selected,onPick,placeholder){if(!host)return;
 if(S.demo){host.innerHTML="";return}
 const draw=()=>{host.innerHTML=`<div class="picker">${selected?personChip(selected,true):`<input type="text" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}" autocomplete="off">`}<div class="opts" hidden></div></div>`;
  const rm=host.querySelector("[data-rm]");if(rm)rm.onclick=()=>{selected=null;onPick(null);draw()};
  const inp=host.querySelector("input"),opts=host.querySelector(".opts");if(!inp)return;
  const show=q=>{q=(q||"").toLowerCase();const hits=members.filter(m=>m.role!=="pendente"&&(!q||(m.name+" "+m.email).toLowerCase().includes(q))).slice(0,8);
   opts.innerHTML=hits.map(h=>`<button type="button" data-id="${esc(h.user_id)}"><span class="ini" style="--h:${hue(h.user_id)}">${esc(initials(h.name))}</span><span></span></button>`).join("")||`<div class="none" style="padding:8px">Ninguém encontrado na equipa</div>`;
   opts.querySelectorAll("button").forEach((b,i)=>{b.querySelector("span:last-child").textContent=hits[i].name+" · "+(ROLE_N[hits[i].role]||"");b.onclick=()=>{selected=hits[i].user_id;onPick(selected);draw()}});opts.hidden=false};
  inp.onfocus=()=>show(inp.value);inp.oninput=()=>show(inp.value);inp.onblur=()=>setTimeout(()=>{opts.hidden=true},200)};
 draw()}

/* página de entrada: apresenta a plataforma e o projeto guardado neste aparelho */
function homeCache(){try{return JSON.parse(localStorage.getItem("cp-home")||"null")}catch(e){return null}}
function saveHomeCache(){if(!S.ready||!S.plans.length&&!S.meta.name)return;const its=S.items;
 const c={name:S.meta.name||"",plans:S.plans.length,items:its.length,tested:its.filter(i=>sIdx(i.stage)>=3).length,at:now()};
 try{const o=homeCache();if(!o||o.name!==c.name||o.items!==c.items||o.tested!==c.tested||o.plans!==c.plans)localStorage.setItem("cp-home",JSON.stringify(c))}catch(e){}}
const OF_LOGO=`<svg class="oflogo" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#e8a317"/><path d="M9 23c4.2 0 3-7.5 7-7.5S19 9 23 9" fill="none" stroke="#1d2421" stroke-width="2.4" stroke-linecap="round"/><circle cx="9" cy="23" r="2.7" fill="#1d2421"/><circle cx="16" cy="15.5" r="2.4" fill="#1d2421"/><circle cx="23" cy="9" r="3.6" fill="#1d2421"/><circle cx="23" cy="9" r="1.5" fill="#e8a317"/></svg>`;
const OF_WORD=`<span class="ofword">Obra<em>Flow</em></span>`;
/* demonstração animada do fluxo na página de entrada (só ilustração, sem dados reais) */
function landingDemo(){
 return`<section class="lp-demo" aria-label="Como funciona o ObraFlow">
  <div class="dm-head"><span class="dm-k">Como funciona</span><span class="dm-live"><i></i>demonstração</span></div>
  <div class="dm-stage" aria-hidden="true">
   <svg class="dm-plan" viewBox="0 0 320 200">
    <g class="dm-walls"><path d="M14 14h292v172H14z"/><path d="M14 84h96M110 14v70M170 14v62h136M170 76v40M14 130h70v56M84 130h20M150 186v-48h70M220 138v48M220 138h86"/></g>
    <g class="dm-room"><text x="40" y="52">SALA 1</text><text x="210" y="45">OPEN SPACE</text><text x="28" y="165">WC</text><text x="240" y="168">COPA</text></g>
   </svg>
   <span class="dm-pin p1" style="left:20%;top:58%"><b></b></span>
   <span class="dm-pin p2 tgt" style="left:62%;top:36%"><b></b></span>
   <span class="dm-pin p3" style="left:44%;top:58%"><b></b></span>
   <span class="dm-pin p4" style="left:80%;top:62%"><b></b></span>
   <div class="dm-phone"><div class="dm-scr"><div class="dm-label"><small>EATON · DI-200</small><b>ID: 7D5F4E</b><small>MAC 00:1B:7A:3C:9E:21</small></div><i class="dm-scan"></i><span class="dm-shut"></span></div></div>
   <div class="dm-chip"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7"/></svg><span><b>7D5F4E</b> validado automaticamente</span></div>
   <div class="dm-prog"><span>Piso 3 · testado</span><div><i></i></div></div>
   <div class="dm-done"><svg viewBox="0 0 24 24"><path d="M9 12l2 2 4-4"/><path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z"/></svg>Auto de entrega pronto</div>
  </div>
  <ol class="dm-steps"><li class="s1"><b>1</b>Planta</li><li class="s2"><b>2</b>Foto da etiqueta</li><li class="s3"><b>3</b>ID validado</li><li class="s4"><b>4</b>Ensaio e entrega</li></ol>
 </section>`}

function landingHero(){
 const ic=d=>`<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
 return`<section class="lp-hero">
  <div class="lp-brand">${OF_LOGO}${OF_WORD}</div>
  <h2>A obra a fluir,<br>do desenho à entrega.</h2>
  <p>Plantas, equipamentos e IDs, ensaios e auto de entrega — no telemóvel, no tablet e no computador. Funciona mesmo sem rede.</p>
  <ul class="lp-feat">
   <li>${ic('<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>')}<span><b>Pins na planta</b>com o ID lido da etiqueta</span></li>
   <li>${ic('<path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2"/><path d="M8 12h8"/>')}<span><b>Leitura automática</b>foto → ID validado</span></li>
   <li>${ic('<path d="M9 12l2 2 4-4"/><path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z"/>')}<span><b>Ensaios e entrega</b>checklists, anomalias, relatórios</span></li>
  </ul></section>`}

/* =========================================================
   Entrar / registar / sair
   ========================================================= */
let authMode="login";
function showAuth(msg){const A=$("auth");A.hidden=false;document.body.classList.add("authing");
 const isUp=authMode==="signup",isReset=authMode==="reset";
 A.innerHTML=`<div class="landing lp">${landingHero()}<div class="authcard lp-card">
  <div class="lp-cardhead"><h2>${isUp?"Criar conta":isReset?"Recuperar acesso":"Bem-vindo de volta"}</h2><p>${isUp?"Regista-te para entrar na equipa da obra.":isReset?"Enviamos um link para definires nova palavra-passe.":"Entra com o teu email da obra."}</p></div>
  <form id="authForm" novalidate>
   ${isUp?`<label class="f lp-f">Nome<span class="lp-in"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg><input id="auName" autocomplete="name" placeholder="Nome e apelido" required></span></label>`:""}
   <label class="f lp-f">Email<span class="lp-in"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg><input id="auEmail" type="email" inputmode="email" autocomplete="email" autocapitalize="off" placeholder="nome@empresa.pt" required></span></label>
   ${isReset?"":`<label class="f lp-f">Palavra-passe<span class="lp-in"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg><input id="auPass" type="password" autocomplete="${isUp?"new-password":"current-password"}" minlength="6" placeholder="${isUp?"mínimo 6 caracteres":"••••••••"}" required><button type="button" class="lp-eye" id="auEye" aria-label="Mostrar palavra-passe">Mostrar</button></span></label>`}
   <div class="msg err" id="auMsg" ${msg?"":"hidden"}>${esc(msg||"")}</div>
   <button class="btn primary lp-go" type="submit" id="auGo">${isUp?"Criar conta":isReset?"Enviar email de recuperação":"Entrar"}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
  </form>
  ${isReset||isUp?"":`<button type="button" class="linkb lp-forgot" data-m="reset">Esqueci-me da palavra-passe</button>`}
  <div class="lp-or"><span>ou</span></div>
  ${isUp||isReset?`<button type="button" class="btn lp-alt" data-m="login">Já tenho conta · Entrar</button>`:`<button type="button" class="btn lp-alt" data-m="signup">Criar conta nova</button>`}
  <p class="lp-note"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>${isUp?"Depois de criares a conta, a coordenação tem de a aprovar. A primeira conta criada fica como coordenação.":"Precisas de ligação à internet para entrar pela primeira vez neste aparelho."}</p></div>${landingDemo()}</div>`;
 A.querySelectorAll("[data-m]").forEach(b=>b.onclick=()=>{authMode=b.dataset.m;showAuth()});
 const eye=$("auEye");if(eye)eye.onclick=()=>{const i=$("auPass");const sh=i.type==="password";i.type=sh?"text":"password";eye.textContent=sh?"Esconder":"Mostrar"};
 $("authForm").onsubmit=async e=>{e.preventDefault();const em=$("auEmail").value.trim(),pw=$("auPass")?$("auPass").value:"",nm=$("auName")?$("auName").value.trim():"";
  const m=$("auMsg");const fail=t=>{m.hidden=false;m.className="msg err";m.textContent=t};
  if(!em||(!isReset&&pw.length<6)||(isUp&&!nm)){fail(isUp&&!nm?"Escreve o teu nome.":"Escreve o email e uma palavra-passe com pelo menos 6 caracteres.");return}
  if(!navigator.onLine){fail("Sem ligação à internet. Liga-te para entrar.");return}
  const go=$("auGo");go.disabled=true;
  try{if(isReset){const{error}=await sb.auth.resetPasswordForEmail(em,{redirectTo:location.href.split("#")[0]});if(error)throw error;m.hidden=false;m.className="msg ok";m.textContent="Enviámos um email com o link para definires nova palavra-passe."}
   else if(isUp){const{data,error}=await sb.auth.signUp({email:em,password:pw,options:{data:{name:nm}}});if(error)throw error;
    if(!data.session){m.hidden=false;m.className="msg ok";m.textContent="Conta criada. Confirma o email que recebeste e depois entra aqui."}else await startSession(data.session)}
   else{const{data,error}=await sb.auth.signInWithPassword({email:em,password:pw});if(error)throw error;await startSession(data.session)}}
  catch(err){const t=String(err.message||err);fail(/invalid login/i.test(t)?"Email ou palavra-passe errados.":/already registered/i.test(t)?"Este email já tem conta. Escolhe Entrar.":/email not confirmed/i.test(t)?"Ainda não confirmaste o email. Abre o link que recebeste.":/rate limit/i.test(t)?"Demasiadas tentativas. Espera uns minutos.":"Não foi possível: "+t)}
  finally{go.disabled=false}}}
function hideAuth(){$("auth").hidden=true;document.body.classList.remove("authing")}
function showPending(){const A=$("auth");A.hidden=false;document.body.classList.add("authing");
 A.innerHTML=`<div class="authcard"><h2>Conta à espera de aprovação</h2><p>Olá ${esc(nameOf(S.meId))}. A coordenação tem de aprovar a tua conta e escolher o teu papel (técnico ou fiscalização). Avisa-a de que já te registaste.</p>
  <button class="btn primary" id="pdCheck">Verificar de novo</button><button class="btn" id="pdOut">Sair</button></div>`;
 $("pdCheck").onclick=async()=>{await loadMembers();if(isActive()){hideAuth();await loadProjects();S.view="projects";render()}else toast("Ainda à espera de aprovação.")};$("pdOut").onclick=signOut}
async function signOut(){const n=await IDBX.count("outbox").catch(()=>0);
 if(n&&!confirmOut){confirmOut=true;toast(`Há ${n} alterações por enviar. Liga-te à internet antes de sair, ou carrega em Sair outra vez para sair na mesma.`);setTimeout(()=>{confirmOut=false},6000);return}
 if(sb)await sb.auth.signOut().catch(()=>{});
 await Promise.all(["docs","outbox","kv"].map(s=>IDBX.clear(s).catch(()=>{})));location.reload()}
let confirmOut=false;
async function startSession(session,offline){S.session=offline?null:session;S.meId=session.user.id;
 if(!offline)IDBX.put("kv","lastUser",{user:{id:session.user.id,email:session.user.email,user_metadata:session.user.user_metadata||{}}}).catch(()=>{});S.me={name:(session.user.user_metadata||{}).name||session.user.email,email:session.user.email};
 const cached=await IDBX.get("kv","members").catch(()=>null);if(cached){members=cached;applyMembers()}
 if(navigator.onLine)await loadMembers().catch(()=>{});
 if(!S.role){setRole("pendente")}
 if(!isActive()){showPending();return}
 hideAuth();S.ready=true;await loadProjects();S.view="projects";render();realtime();flush()}

/* =========================================================
   Arranque
   ========================================================= */
async function boot(){
 S.demo=!CFG.SUPABASE_URL||!CFG.SUPABASE_ANON_KEY||!window.supabase;S.local=S.demo;
 await loadLocal();
 api.sub("plans",a=>{S.plans=a.sort((x,y)=>(x.order||0)-(y.order||0)||String(x.name).localeCompare(String(y.name),"pt",{numeric:true}));pickPlan();S.ready=true;render()});
 api.sub("items",a=>{S.items=a;render()});
 api.sub("issues",a=>{S.issues=a;render()});
 api.sub("meta",a=>{const pr=a.find(x=>x.id==="project");S.meta=pr?(({id,...r})=>r)(pr):{};syncMetaName();const pp=a.find(x=>x.id==="people");legacyPeople=(pp&&pp.map)||{};render()});
 if(S.demo){S.meId="demo";S.me={name:"Demonstração"};setRole("coord");S.ready=true;await loadProjects();S.view="projects";render();return}
 sb=window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 sb.auth.onAuthStateChange((ev,session)=>{if(ev==="PASSWORD_RECOVERY")askNewPassword();
  if(ev==="SIGNED_OUT"){S.session=null;showAuth()}
  else if(session&&S.meId===session.user.id&&!S.session){S.session=session;loadMembers().then(render);loadProjects().then(render);realtime();syncNow()}});   // sessão renovada quando a rede volta
 let res=null;try{res=await sb.auth.getSession()}catch(e){res=null}
 const ses=res&&res.data&&res.data.session;
 if(ses){await startSession(ses);return}
 // sem rede (ou sessão por renovar): continua a trabalhar com a última conta usada neste aparelho
 const lu=await IDBX.get("kv","lastUser").catch(()=>null);
 if(lu&&(!navigator.onLine||(res&&res.error))){await startSession(lu,true);return}
 showAuth()}
function askNewPassword(){const A=$("auth");A.hidden=false;document.body.classList.add("authing");
 A.innerHTML=`<div class="authcard"><h2>Nova palavra-passe</h2><label class="f">Palavra-passe nova<input id="npPass" type="password" minlength="6" autocomplete="new-password"></label><div class="msg err" id="npMsg" hidden></div><button class="btn primary" id="npGo">Guardar</button></div>`;
 $("npGo").onclick=async()=>{const v=$("npPass").value;if(v.length<6){$("npMsg").hidden=false;$("npMsg").textContent="Pelo menos 6 caracteres.";return}
  const{error}=await sb.auth.updateUser({password:v});if(error){$("npMsg").hidden=false;$("npMsg").textContent=error.message;return}toast("Palavra-passe guardada.");const{data}=await sb.auth.getSession();if(data.session)startSession(data.session)}}
function pickPlan(){if(S.planId&&S.plans.some(p=>p.id===S.planId))return;
 const mine=S.plans.find(p=>(p.assignees||[]).includes(S.meId));S.planId=(mine||S.plans[0]||{}).id||null;loadPlan()}

/* =========================================================
   Render geral
   ========================================================= */
let rq=false;function render(){if(rq)return;rq=true;requestAnimationFrame(()=>{rq=false;renderNow()})}
function renderSync(){const el=$("syncBox");if(!el)return;
 if(S.demo){el.className="sync demo";el.textContent="Modo demonstração";el.title="Configura o Supabase em config.js para trabalhar em equipa";return}
 const off=!navigator.onLine;el.className="sync"+(off?" off":S.pending?" pend":S.syncing?" busy":" ok");
 el.textContent=off?(S.pending?`Sem rede · ${S.pending} por enviar`:"Sem rede"):S.syncing?"A sincronizar…":S.pending?`${S.pending} por enviar`:"Sincronizado";
 el.title=S.lastSyncAt?"Última sincronização: "+fmtDate(S.lastSyncAt):""}
function renderNow(){
 $("projName").textContent=S.meta.name||"";
 renderSync();
 const me=$("meBox");me.innerHTML=S.me?`<span class="ini lg">${esc(initials(S.me.name))}</span><span class="who"><span class="mename">${esc(S.me.name||"")}</span><small>${esc(S.demo?"Modo demonstração":ROLE_N[S.role]||"")}</small></span>${S.demo?"":`<button class="btn sm" id="btnOut">Sair</button>`}`:"";
 const bo=$("btnOut");if(bo)bo.onclick=signOut;
 const b=$("banner");
 if(S.demo){b.hidden=false;b.innerHTML=`<span>Modo demonstração: os dados ficam só neste aparelho. Preenche o ficheiro <b>config.js</b> com os dados do Supabase para trabalhar em equipa (ver LEIA-ME).</span>`}
 else if(S.isCoord&&members.some(m=>m.role==="pendente")){const n=members.filter(m=>m.role==="pendente").length;b.hidden=false;b.innerHTML=`<span>${n} pessoa${n>1?"s":""} à espera de aprovação.</span><button class="btn sm" id="goTeam">Ver equipa</button>`;$("goTeam").onclick=()=>go("team")}
 else b.hidden=true;
 renderShell();
 saveHomeCache();
}
$("tabHome").onclick=()=>{S.view="home";render();window.scrollTo(0,0)};
$("tabObra").onclick=()=>{S.view="obra";render();setTimeout(fit,30)};
$("tabCoord").onclick=()=>{S.view="coord";render()};
$("syncBox").onclick=()=>{if(S.demo){toast("Modo demonstração: os dados ficam só neste aparelho.");return}if(!navigator.onLine){toast("Sem rede. As alterações ficam guardadas e são enviadas quando voltar a ligação.");return}syncNow().then(()=>toast(S.pending?`Ainda há ${S.pending} alterações por enviar.`:"Tudo sincronizado."))};


/* =========================================================
   Planta: vista, pan/zoom e PDF nítido
   ========================================================= */
const viewer=$("viewer"),stage=$("stage"),img=$("planImg"),hi=$("hi");
let view={z:1,x:0,y:0},loadedPlan=null;
function plan(){const p=S.plans.find(x=>x.id===S.planId)||null;return p&&S.swap&&S.swap.pid===p.id&&S.swap.show==="new"?{...p,...S.swap.nd,ov:null,fw:null}:p}
function scalePins(){stage.querySelectorAll(".pin,.ghost,.alignpt").forEach(el=>el.style.scale=String(1/view.z))}
let declZ=0;
function applyView(){stage.style.transform=`translate(${view.x}px,${view.y}px) scale(${view.z})`;scalePins();scheduleHi();if(Math.abs(view.z-declZ)>1e-6)declutter()}
/* Etiquetas sem sobreposição: mostra primeiro as mais importantes; as outras aparecem com zoom */
S.labels=(()=>{try{return localStorage.getItem("po-labels")||"auto"}catch(e){return"auto"}})();
function declutter(){declZ=view.z;const p=plan();if(!p)return;const els=[...stage.querySelectorAll(".pin")];
 els.forEach(el=>el.classList.remove("tr","tl","tb"));
 if(S.labels!=="auto"){els.forEach(el=>el.classList.toggle("notag",S.labels==="none"&&!el.classList.contains("sel")));return}
 const rank=el=>el.classList.contains("sel")?0:el.classList.contains("picked")?1:el.classList.contains("dup")?1.5:el.classList.contains("issue")?2:el.classList.contains("dim")?4:3;
 const items=els.map(el=>{const x=parseFloat(el.style.left)*view.z,y=parseFloat(el.style.top)*view.z;const t=el.querySelector(".tag").textContent;const w=t.length*6.1+11,h=15,cy=y-19;
  return{el,r:rank(el),w,h,x,y,cy,dot:{x0:x-7,x1:x+7,y0:y-14,y1:y}}}).sort((a,b)=>a.r-b.r||a.cy-b.cy);
 const placed=[],dots=items.map(o=>o.dot);const hit=(a,b)=>a.x0<b.x1&&a.x1>b.x0&&a.y0<b.y1&&a.y1>b.y0;
 for(const o of items){const C=[["",{x0:o.x-o.w/2,x1:o.x+o.w/2,y0:o.y-29-o.h,y1:o.y-29}],["tr",{x0:o.x+12,x1:o.x+12+o.w,y0:o.cy-o.h/2,y1:o.cy+o.h/2}],
   ["tl",{x0:o.x-12-o.w,x1:o.x-12,y0:o.cy-o.h/2,y1:o.cy+o.h/2}],["tb",{x0:o.x-o.w/2,x1:o.x+o.w/2,y0:o.y+2,y1:o.y+2+o.h}]];
  let pick=null;for(const[c,b]of C){if(!placed.some(q=>hit(b,q))&&!dots.some(d=>d!==o.dot&&hit(b,d))){pick=[c,b];break}}
  if(!pick&&o.r===0)pick=C[0];
  o.el.classList.toggle("notag",!pick);if(pick){if(pick[0])o.el.classList.add(pick[0]);placed.push(pick[1])}}}
function fit(){const p=plan();if(!p)return;const r=viewer.getBoundingClientRect();if(!r.width)return;
 const z=Math.min((r.width-40)/p.w,(r.height-40)/p.h);view.z=z;view.x=(r.width-p.w*z)/2;view.y=(r.height-p.h*z)/2;applyView()}
function zoomAt(f,cx,cy){const nz=Math.min(10,Math.max(.05,view.z*f));view.x=cx-(cx-view.x)*nz/view.z;view.y=cy-(cy-view.y)*nz/view.z;view.z=nz;applyView()}
function loadPlan(){const p=plan();if(!p){hiReset();loadedPlan=null;img.removeAttribute("src");return}
 if(loadedPlan===p.id+":"+p.img)return;hiReset();loadedPlan=p.id+":"+p.img;img.width=p.w;img.height=p.h;
 const key=loadedPlan;let step=0;
 const busy=$("busy");busy.textContent="A carregar a planta…";busy.hidden=false;
 img.onload=()=>{if(loadedPlan!==key)return;if(!img.naturalWidth){img.onerror();return}busy.hidden=true;fit()};
 img.onerror=async()=>{if(loadedPlan!==key)return;step++;
  // 1) tentar via fetch → blob local; 2) desenhar a partir do PDF; 3) avisar
  if(step===1&&!p.img.startsWith("db:")){try{const b=await blobOf(p.img);if(loadedPlan!==key)return;img.src=URL.createObjectURL(b);return}catch(e){step++}}
  if(step===2&&p.pdf&&window.pdfjsLib){try{busy.textContent="A desenhar a planta a partir do PDF…";const pg=await pdfPage(p);if(!pg)throw 0;
   const vp0=pg.getViewport({scale:1}),vp=pg.getViewport({scale:p.w/vp0.width});const cv=document.createElement("canvas");cv.width=Math.round(vp.width);cv.height=Math.round(vp.height);
   const cx=cv.getContext("2d");cx.fillStyle="#fff";cx.fillRect(0,0,cv.width,cv.height);await pg.render({canvasContext:cx,viewport:vp}).promise;if(loadedPlan!==key)return;
   img.src=await new Promise(r=>cv.toBlob(b=>r(URL.createObjectURL(b)),"image/jpeg",.9));return}catch(e){}}
  busy.textContent=navigator.onLine?"A planta não carregou neste aparelho. Recarrega a página; se continuar, substitui a planta em Pisos…":"Esta planta ainda não foi guardada neste aparelho. Liga-te à rede uma vez para a descarregar (ou usa Coordenação → Preparar para usar sem rede).";busy.hidden=false};
 urlOf(p.img).then(u=>{if(loadedPlan===key)img.src=u}).catch(()=>{if(loadedPlan===key)img.onerror()});fit();
 setTimeout(()=>{if(loadedPlan===key&&!img.naturalWidth&&step===0)img.onerror()},8000)}
viewer.addEventListener("wheel",e=>{e.preventDefault();const r=viewer.getBoundingClientRect();zoomAt(e.deltaY<0?1.15:1/1.15,e.clientX-r.left,e.clientY-r.top)},{passive:false});
$("zIn").onclick=()=>{const r=viewer.getBoundingClientRect();zoomAt(1.3,r.width/2,r.height/2)};
$("zOut").onclick=()=>{const r=viewer.getBoundingClientRect();zoomAt(1/1.3,r.width/2,r.height/2)};
$("zFit").onclick=fit;
window.addEventListener("resize",()=>{if(S.view==="obra")fit()});

/* toque: arrastar para mover, dois dedos para zoom */
const ptrs=new Map();let drag=null,pinch=null;
viewer.addEventListener("pointerdown",e=>{
 if(e.target.closest(".zoom,.hint,.legend,.emptyplan,.mkbar,.mkpanel"))return;
 ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});viewer.setPointerCapture(e.pointerId);
 if(ptrs.size===2){const[a,b]=[...ptrs.values()];pinch={d:Math.hypot(a.x-b.x,a.y-b.y),z:view.z};drag=null;return}
 const pin=e.target.closest(".pin"),gh=e.target.closest(".ghost"),tp=e.target.closest(".tpin");
 drag={sx:e.clientX,sy:e.clientY,vx:view.x,vy:view.y,moved:false,pin:pin?pin.dataset.id:null,ghost:gh?+gh.dataset.g:null,tpin:tp?tp.dataset.t:null};
});
viewer.addEventListener("pointermove",e=>{
 if(ptrs.has(e.pointerId))ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(pinch&&ptrs.size===2){const[a,b]=[...ptrs.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);const r=viewer.getBoundingClientRect();
  zoomAt((pinch.z*d/pinch.d)/view.z,(a.x+b.x)/2-r.left,(a.y+b.y)/2-r.top);return}
 if(!drag)return;const dx=e.clientX-drag.sx,dy=e.clientY-drag.sy;
 if(!drag.moved&&Math.hypot(dx,dy)>6)drag.moved=true;if(!drag.moved)return;
 if(drag.pin&&S.canWrite&&drag.pin===S.sel){const el=stage.querySelector(`.pin[data-id="${drag.pin}"]`);const pt=toPlan(e);if(el&&pt){const p=plan();el.style.left=pt.x*p.w+"px";el.style.top=pt.y*p.h+"px";drag.pt=pt}}
 else{drag.panned=true;viewer.classList.add("panning");view.x=drag.vx+dx;view.y=drag.vy+dy;applyView()}
});
function endPtr(e){ptrs.delete(e.pointerId);if(ptrs.size<2)pinch=null;
 if(!drag)return;viewer.classList.remove("panning");const d=drag;drag=null;if(e.type==="pointercancel")return;
 if(d.pin&&d.moved&&d.pt){api.update("items",d.pin,logPatch(S.items.find(i=>i.id===d.pin),{x:d.pt.x,y:d.pt.y,updatedAt:now(),updatedBy:S.meId},"Posição alterada"));toast("Posição atualizada");return}
 if(d.moved)return;
 if(d.tpin&&!S.movingTask){openTask(d.tpin);return}
 if(S.movingTask||(S.mode==="task"&&!S.swap&&!S.align&&!S.moving)){taskClick(e);return}
 if(S.moving){const pt=toPlan(e);const id=S.moving;if(pt){S.moving=null;api.update("items",id,logPatch(S.items.find(i=>i.id===id),{x:pt.x,y:pt.y,updatedAt:now(),updatedBy:S.meId},"Posição alterada"));toast("Posição atualizada");render()}return}
 if(S.swap&&S.swap.stage>=1&&S.swap.stage<3){swapClick(e);return}
 if(S.swap)return;
 if(d.pin){if(S.multi)toggleMulti(d.pin);else select(d.pin);return}
 if(S.align){const pt=toPlan(e);if(pt){const p=plan();S.align.dst.push({x:pt.x*p.w,y:pt.y*p.h});if(S.align.dst.length===2)finishAlign();else render()}return}
 if(d.ghost!=null&&S.canWrite){createFromGhost(d.ghost);return}
 const c=cur();
 if(c&&c.x==null&&S.canWrite){const pt=toPlan(e);if(pt){api.update("items",c.id,logPatch(c,{x:pt.x,y:pt.y,planId:S.planId,updatedAt:now(),updatedBy:S.meId},"Colocado na planta"));toast(c.code+" colocado na planta");const n=nextOf(c.id,i=>i.x==null);if(n)setTimeout(()=>select(n.id),300)}return}
 if(S.mode==="mark"&&S.canWrite){const pt=toPlan(e);if(pt)addItem(pt)}else select(null)}
viewer.addEventListener("pointerup",endPtr);viewer.addEventListener("pointercancel",endPtr);
function toPlan(e){const r=img.getBoundingClientRect();if(!r.width)return null;const x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
 if(x<0||y<0||x>1||y>1)return null;return{x:+x.toFixed(4),y:+y.toFixed(4)}}

/* PDF nítido: redesenha a zona visível em vetor */
function initPdf(){if(window.pdfjsLib&&!pdfjsLib.GlobalWorkerOptions.workerSrc)pdfjsLib.GlobalWorkerOptions.workerSrc="vendor/pdf.worker.js"}
function openPdf(bytes){initPdf();return pdfjsLib.getDocument({data:new Uint8Array(bytes).slice(),useSystemFonts:true,isEvalSupported:false}).promise}
const pdfCache={};
function pdfDoc(ref){if(!pdfCache[ref])pdfCache[ref]=blobOf(ref).then(b=>b.arrayBuffer()).then(buf=>openPdf(buf)).catch(()=>null);return pdfCache[ref]}
function pdfPage(p){if(!p||!p.pdf||!window.pdfjsLib)return Promise.resolve(null);return pdfDoc(p.pdf).then(d=>d?d.getPage(Math.min(p.page||1,d.numPages)):null).catch(()=>null)}
let hiTimer=null,hiTask=null,hiTok=0,hiCv=null;
/* Camada nítida: desenhada em vetor a partir do PDF para a zona visível, colocada DENTRO da planta
   (acompanha o pan/zoom sem saltos) e trocada só quando a nova está pronta (sem piscar). */
function hiReset(){hiTok++;clearTimeout(hiTimer);if(hiTask){try{hiTask.cancel()}catch(e){}hiTask=null}if(hiCv){hiCv.remove();hiCv=null}}
function scheduleHi(){hiTok++;if(hiTask){try{hiTask.cancel()}catch(e){}hiTask=null}clearTimeout(hiTimer);const p=plan();if(!p||!p.pdf||pdfFailed[p.id+":"+p.pdf])return;hiTimer=setTimeout(renderHi,220)}
async function renderHi(){const p=plan(),tok=++hiTok;const pg=await pdfPage(p);if(!pg||tok!==hiTok)return;
 const r=viewer.getBoundingClientRect();if(!r.width||!r.height)return;const dpr=Math.min(window.devicePixelRatio||1,3);const v={...view};
 const base=pg.getViewport({scale:1}),s=v.z*p.w/base.width*dpr;
 const cv=document.createElement("canvas");cv.className="hicv";cv.width=Math.round(r.width*dpr);cv.height=Math.round(r.height*dpr);
 const ctx=cv.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(v.x*dpr,v.y*dpr,p.w*v.z*dpr,p.h*v.z*dpr);
 hiTask=pg.render({canvasContext:ctx,viewport:pg.getViewport({scale:s,offsetX:v.x*dpr,offsetY:v.y*dpr}),background:"rgba(0,0,0,0)"});
 try{await hiTask.promise}catch(e){if(e&&e.name!=="RenderingCancelledException")pdfFailed[p.id+":"+p.pdf]=true;return}
 if(tok!==hiTok)return;hiTask=null;
 if(!hasInk(ctx))return; // zona sem traços (ou desenho falhado): fica a imagem normal por baixo
 cv.style.cssText=`position:absolute;left:${-v.x/v.z}px;top:${-v.y/v.z}px;width:${r.width/v.z}px;height:${r.height/v.z}px;pointer-events:none;max-width:none`;
 img.after(cv);if(hiCv)hiCv.remove();hiCv=cv}
const pdfFailed={};
function hasInk(ctx){const W=ctx.canvas.width,H=ctx.canvas.height;let d;try{d=ctx.getImageData(0,0,W,H).data}catch(e){return true}
 for(let i=0;i<d.length;i+=4)if(d[i+3]>40&&(d[i]<215||d[i+1]<215||d[i+2]<215))return true;return false}

/* =========================================================
   Obra: render
   ========================================================= */
function planItems(pid){return S.items.filter(i=>i.planId===(pid||S.planId))}
function openIssues(itemId){return S.issues.filter(x=>x.itemId===itemId&&x.status!=="resolvida")}
function hasIssue(it){return S.issues.some(x=>x.itemId===it.id&&x.status!=="resolvida")}
function isTodo(it){return sIdx(it.stage)<3||hasIssue(it)}
function matchQ(it){const q=S.q.trim().toLowerCase();if(!q)return true;
 return[it.code,it.devId,it.mac,it.maker,it.model,it.serial,it.taskNo&&"t"+it.taskNo,it.taskNo,it.note,tOf(it.type).n].join(" ").toLowerCase().includes(q)}
function inFilter(it,f){f=f||S.filter;return f==="dups"?isDup(it):f==="mine"?(it.assignee===S.meId&&(isTodo(it)||(isClient()&&it.stage==="validado"))):f==="todo"?isTodo(it):f==="issues"?hasIssue(it):f==="unplaced"?it.x==null:true}
function workOrder(a,b){
 const ma=S.issues.some(x=>x.itemId===a.id&&x.status!=="resolvida"&&x.assignee===S.meId),mb=S.issues.some(x=>x.itemId===b.id&&x.status!=="resolvida"&&x.assignee===S.meId);
 const aa=a.assignee===S.meId,ab=b.assignee===S.meId;
 return (mb-ma)||(ab-aa)||((a.due||"9")<(b.due||"9")?-1:(a.due||"9")>(b.due||"9")?1:0)||((b.x==null)-(a.x==null))||(sIdx(a.stage)-sIdx(b.stage))||String(a.code).localeCompare(String(b.code),"pt",{numeric:true})}
function nextOf(afterId,pred){const list=planItems().filter(i=>(pred?pred(i):isTodo(i))&&i.id!==afterId).sort(workOrder);return list[0]||null}

function renderObra(){
 const p=plan();
 // pisos
 const sel=$("planSel");
 const opts=planOptionsHtml();
 sel.innerHTML=opts||`<option value="">Sem pisos</option>`;sel.value=S.planId||"";
 $("btnFloor").hidden=!S.canWrite;$("btnNewFloor").hidden=!S.canWrite||!p;$("btnNewFloor").onclick=()=>{replacing=null;uploadFolder=(plan()||{}).folder||null};$("bulkBtn").hidden=!S.canWrite||!p;
 $("mMark").disabled=!S.canWrite||!p;
 // progresso do piso
 const its=planItems();const fp=$("floorProg");
 if(p&&its.length){const done=its.filter(i=>sIdx(i.stage)>=3).length;
  fp.innerHTML=`<div class="stack">${STAGES.map(s=>{const n=its.filter(i=>i.stage===s.k||(!i.stage&&s.k==="previsto")).length;return n?`<i style="width:${n/its.length*100}%;background:${s.c}" title="${s.n}: ${n}"></i>`:""}).join("")}</div><span>${done}/${its.length} testados</span>`}
 else fp.innerHTML="";
 $("emptyPlan").hidden=!!p||!S.ready;
 $("emptyPlan").querySelector("label").hidden=!S.canWrite;
 loadPlan();
 // legenda
 $("legend").innerHTML=`<span>Etiquetas <select id="lblMode" aria-label="Etiquetas na planta"><option value="auto"${S.labels==="auto"?" selected":""}>Automático</option><option value="all"${S.labels==="all"?" selected":""}>Todas</option><option value="none"${S.labels==="none"?" selected":""}>Só ao tocar</option></select></span>`+STAGES.map(s=>`<span style="--c:${s.c}"><i></i>${s.n}</span>`).join("")+`<span><b style="color:var(--bad)">!</b> Anomalia</span><span><i style="background:none;border:1px dashed var(--muted);border-radius:2px;width:12px"></i> Sem ID lido</span>`;
 $("lblMode").onchange=e=>{S.labels=e.target.value;try{localStorage.setItem("po-labels",S.labels)}catch(x){}declutter()};
 // hint
 const c=cur();
 const gN=ghostList().length;
 $("hint").innerHTML=S.draw?mkHint():S.movingTask||S.mode==="task"?taskHint():S.swap&&S.swap.stage?swapHint():S.moving?`<b>Mover ${esc((S.items.find(i=>i.id===S.moving)||{}).code||"")}:</b> toca no novo sítio na planta. <button class="btn sm" id="mvCancel">Cancelar</button>`
  :S.align?`<b>Alinhar:</b> clica na planta base no <b>ponto ${S.align.dst.length+1}</b> (o mesmo que marcaste ${S.align.kind==="ov"?"no desenho a sobrepor":"na captura do Fieldwire"}). <button class="btn sm" id="alCancel">Cancelar</button>`
  :c&&c.x==null?`<b>Colocar ${esc(c.code)}:</b> `+(c.taskNo?`clica em cima do pin <b>${esc(c.taskNo)}</b> do Fieldwire.`:`clica na planta onde está este equipamento.`)
  :S.mode==="mark"?`<b>Marcar:</b> clica onde está o equipamento e tira a foto da etiqueta.`
  :gN?`<b>Fieldwire:</b> ${gN} pins por registar. Clica num círculo laranja e cola a foto da etiqueta com <b>Ctrl+V</b>.`
  :`<b>Navegar:</b> arrasta para mover, roda ou dois dedos para zoom. Toca num marcador para abrir.`;
 const mvc=$("mvCancel");if(mvc)mvc.onclick=()=>{S.moving=null;render()};
 viewer.classList.toggle("marking",S.mode==="mark"||S.mode==="task"||!!S.movingTask||!!S.moving||!!S.align||!!(S.swap&&S.swap.stage&&S.swap.stage<3));wireSwapHint();
 const alc=$("alCancel");if(alc)alc.onclick=()=>{S.align=null;render()};
 $("btnFw").hidden=!S.canWrite||!p;
 $("btnExp").hidden=!p;$("btnOv").hidden=!p||(!S.canWrite&&!p.ov);
 
 $("mNav").setAttribute("aria-pressed",S.mode==="nav");$("mMark").setAttribute("aria-pressed",S.mode==="mark");{const mt=$("mTask");if(mt){mt.setAttribute("aria-pressed",S.mode==="task");mt.disabled=!p}}
 renderPins();renderList();renderSheet();renderBulk();
 $("multiBtn").hidden=!S.canWrite;$("multiBtn").setAttribute("aria-pressed",!!S.multi);
 wantNames([...new Set(S.issues.flatMap(x=>[x.assignee,x.createdBy]).concat(S.items.flatMap(i=>[i.updatedBy,i.assignee,...(i.log||[]).flatMap(e=>[e.by,e.u])])).filter(Boolean))]);
}
function renderPins(){if(drag&&drag.moved&&drag.pin)return;
 stage.querySelectorAll(".pin,.ghost,.alignpt").forEach(e=>e.remove());const p=plan();if(!p){$("fwImg").hidden=true;$("ovImg").hidden=true;return}
 const frag=document.createDocumentFragment();
 for(const it of planItems()){if(it.x==null||swapHidesPins())continue;const el=document.createElement("div");const sp=swapPos(it);
  el.className="pin"+(it.id===S.sel?" sel":"")+(S.multi&&S.multi.has(it.id)?" picked":"")+(hasIssue(it)?" issue":"")+(isDup(it)?" dup":"")+(["inconclusivo","fora"].includes(readStateOf(it))?" inc":"")+(inFilter(it,S.filter==="unplaced"?"all":S.filter)&&matchQ(it)?"":" dim");
  el.dataset.id=it.id;el.style.setProperty("--c",sOf(it.stage).c);el.style.left=sp.x*p.w+"px";el.style.top=sp.y*p.h+"px";el.style.scale=String(1/view.z);
  el.innerHTML=`<span class="tag"></span><svg class="mk" viewBox="0 0 24 32" aria-hidden="true"><path d="M12 1.2C6.1 1.2 1.6 5.7 1.6 11.4c0 7.4 8.6 17.6 9.7 18.9.4.4 1 .4 1.4 0 1.1-1.3 9.7-11.5 9.7-18.9C22.4 5.7 17.9 1.2 12 1.2z"/><circle cx="12" cy="11.4" r="4.1"/></svg>`;el.querySelector(".tag").textContent=it.devId||it.mac||it.code;
  if(!it.devId&&!it.mac)el.classList.add("noid");
  el.title=(it.devId?`ID ${it.devId} · `:"")+(it.mac?`MAC ${it.mac} · `:"")+(!it.devId&&!it.mac?"Sem ID lido · ":"")+`${it.code} · ${tOf(it.type).n} · ${sOf(it.stage).n}`;frag.appendChild(el)}
 for(const g of ghostList()){const el=document.createElement("div");el.className="ghost";el.dataset.g=g.i;el.style.left=g.x*p.w+"px";el.style.top=g.y*p.h+"px";el.style.scale=String(1/view.z);el.title="Pin do Fieldwire por registar: clica e cola a foto";frag.appendChild(el)}
 if(S.align)S.align.dst.forEach(q=>{const el=document.createElement("div");el.className="alignpt ghost-like";el.style.left=q.x+"px";el.style.top=q.y+"px";el.style.scale=String(1/view.z);frag.appendChild(el)});
 swapMarkers(frag,p);stage.appendChild(frag);renderOverlay(p);renderOv(p);renderMarks(p);renderTasks(p);declutter()}
function renderList(){
 const its=planItems();
 document.querySelectorAll(".filters .chip[data-f]").forEach(ch=>{const f=ch.dataset.f;ch.setAttribute("aria-pressed",S.filter===f);ch.querySelector("b").textContent=its.filter(i=>inFilter(i,f)).length});
 const L=$("list");const list=its.filter(i=>inFilter(i)&&matchQ(i)).sort(workOrder);
 // próximo
 const nb=$("nextBox");const nx=S.canWrite?nextOf(null):null;
 if(nx&&!S.sel&&plan()){nb.hidden=false;nb.innerHTML=`<div class="t">Próximo equipamento<b>${esc(nx.code)}</b>${esc(sOf(nx.stage).n)}${nx.x==null?" · por colocar":""}${hasIssue(nx)?" · anomalia aberta":""}</div><button class="btn primary sm" id="goNext">Abrir</button>`;$("goNext").onclick=()=>{select(nx.id);centerOn(nx)}}
 else nb.hidden=true;
 if(!plan()){L.innerHTML=`<div class="empty">Ainda não há pisos nesta obra.</div>`;return}
 if(!list.length){L.innerHTML=`<div class="empty">${its.length?(S.filter==="todo"?"Tudo testado neste piso. Bom trabalho.":"Nada corresponde a este filtro."):(S.canWrite?"Ainda não há equipamentos neste piso. Escolhe <b>Marcar equipamento</b> e toca na planta onde está cada um, ou usa <b>Importar fotos</b>.":"Ainda não há equipamentos neste piso.")}</div>`;return}
 L.innerHTML="";
 for(const it of list){const d=document.createElement("div");d.className="item"+(it.id===S.sel?" sel":"")+(isDup(it)?" dupitem":"");d.style.setProperty("--c",sOf(it.stage).c);d.tabIndex=0;
  const st=it.x==null?`<span class="pill unplaced">Por colocar</span>`:`<span class="pill">${sOf(it.stage).n}</span>`;
  d.innerHTML=`<span class="sw"></span><span class="code"><span></span>${isDup(it)?`<span class="flag">ID REPETIDO</span>`:""}${hasIssue(it)?`<span class="flag">ANOMALIA</span>`:""}${isLate(it)?`<span class="flag" style="background:var(--warn)">ATRASO</span>`:""}</span>${st}<span class="meta"></span>`;
  const lab=it.devId||it.mac;d.querySelector(".code span").textContent=lab?`${lab} · ${it.code}`:it.code;
  const np=(it.photos||[]).length;
  d.querySelector(".meta").textContent=[it.assignee&&(it.assignee===S.meId?"Meu":nameOf(it.assignee)),it.due&&"Prazo "+fmtDay(it.due),it.taskNo&&"Tarefa "+it.taskNo,it.model||tOf(it.type).n,it.devId&&"ID "+it.devId,it.mac&&"MAC "+it.mac,np&&`${np} foto${np>1?"s":""}`,(st=>st&&st!=="ok"?"⚠ "+RS_N[st]:"")(readStateOf(it))].filter(Boolean).join(" · ");
  if(S.multi){d.classList.toggle("picked",S.multi.has(it.id));d.insertAdjacentHTML("afterbegin",`<span class="tick" aria-hidden="true">${S.multi.has(it.id)?"✓":""}</span>`);d.onclick=()=>toggleMulti(it.id)}
  else d.onclick=()=>{select(it.id);centerOn(it)};d.onkeydown=e=>{if(e.key==="Enter")d.onclick()};L.appendChild(d)}
}
document.querySelectorAll(".filters .chip[data-f]").forEach(ch=>ch.onclick=()=>{S.filter=ch.dataset.f;render()});
$("q").addEventListener("input",e=>{S.q=e.target.value;render()});
$("planSel").onchange=e=>{S.planId=e.target.value;S.sel=null;loadPlan();render()};
$("mNav").onclick=()=>{S.mode="nav";render()};$("mMark").onclick=()=>{S.mode="mark";render()};
document.addEventListener("keydown",e=>{if(e.target.matches("input,textarea,select"))return;if(e.key==="Escape"){if(S.moving||S.align){S.moving=null;S.align=null;render()}else if(S.multi){S.multi=null;render()}else select(null)}});
function centerOn(it){if(!it||it.x==null)return;const r=viewer.getBoundingClientRect(),p=plan();if(!p)return;
 if(view.z<.6*Math.min((r.width-40)/p.w,(r.height-40)/p.h)*2)view.z=Math.min((r.width-40)/p.w,(r.height-40)/p.h)*2;
 view.x=r.width/2-it.x*p.w*view.z;view.y=r.height/2-it.y*p.h*view.z;applyView()}

/* =========================================================
   Ficha do equipamento
   ========================================================= */
function cur(){return S.items.find(i=>i.id===S.sel)||null}
let sheetFor=null,stageArmed=null,delArmed=false,newIssue={text:"",photo:null,assignee:null};
function select(id){if(S.sel!==id){S.moving=null;stageArmed=null;delArmed=false;newIssue={text:"",photo:null,assignee:null};readMsg=null}S.sel=id;render()}
function setField(id,k,v){fieldPatch[id]=fieldPatch[id]||{};fieldPatch[id][k]=v;clearTimeout(fieldTimer[id]);
 fieldTimer[id]=setTimeout(()=>{const patch=fieldPatch[id];delete fieldPatch[id];doFlush(id,patch)},600)}
function doFlush(id,patch){const it=S.items.find(i=>i.id===id);const P={...patch,updatedAt:now(),updatedBy:S.meId};const parts=[];
 if("code" in patch)parts.push("Referência: "+patch.code);if("devId" in patch)parts.push(patch.devId?"ID: "+patch.devId:"ID apagado");if("mac" in patch)parts.push(patch.mac?"MAC: "+patch.mac:"MAC apagado");
 if(parts.length)logPatch(it,P,parts.join(" · "));api.update("items",id,P)}
const fieldPatch={},fieldTimer={};
function flushFields(){for(const id of Object.keys(fieldPatch)){clearTimeout(fieldTimer[id]);const patch=fieldPatch[id];delete fieldPatch[id];doFlush(id,patch)}}

function renderSheet(){
 const box=$("sheet"),it=cur();
 if(!it){box.hidden=true;sheetFor=null;return}
 if(S.moving&&matchMedia("(max-width:860px)").matches){box.hidden=true;sheetFor=null;return}
 box.hidden=false;
 const ro=!S.canWrite;
 // Se é o mesmo equipamento e algum campo está em foco, só atualiza o que não está a ser editado
 const focused=document.activeElement&&box.contains(document.activeElement)&&document.activeElement.matches("input[type=text],input:not([type]),textarea");
 if(sheetFor===it.id&&focused){updateSheetPassive(it);return}
 sheetFor=it.id;
 const si=sIdx(it.stage),checks=CHECKS[it.type]||CHECKS.EQ,cdone=checks.filter((_,k)=>ck(it)[k]).length;
 const log=STAGES.filter(s=>it.stageLog&&it.stageLog[s.k]).map(s=>`${s.n} por ${esc(nameOf(it.stageLog[s.k].by))} · ${fmtDate(it.stageLog[s.k].at)}`);
 const iss=S.issues.filter(x=>x.itemId===it.id).sort((a,b)=>(a.status==="resolvida")-(b.status==="resolvida")||String(b.createdAt).localeCompare(String(a.createdAt)));
 const canDel=S.canWrite&&(S.isCoord||it.createdBy===S.meId);
 box.innerHTML=`
 <div class="sh-head">
  <input class="code" id="edCode" value="${esc(it.code)}" aria-label="Referência na planta" ${ro?"readonly":""}>
  <select class="btn sm" id="edType" aria-label="Tipo" ${ro?"disabled":""}>${TYPES.map(t=>`<option value="${t.k}"${t.k===it.type?" selected":""}>${t.n}</option>`).join("")}</select>
  ${!ro&&it.x!=null?`<button class="btn sm${S.moving===it.id?" dark":""}" id="shMove" title="Mover a gota na planta">Mover</button>`:""}
  <button class="btn sm" id="shClose">Fechar</button>
 </div>
 ${it.x==null?`<div class="msg warn">Por colocar: toca na planta onde está este equipamento${it.taskNo?` (pin ${esc(it.taskNo)} do Fieldwire)`:""}.</div>`:""}
 <div class="sec"><h4><span>Etapa</span><span class="muted" style="text-transform:none;letter-spacing:0;font-weight:400">${esc(sOf(it.stage).n)}</span></h4>
  <div class="stepper">${STAGES.map((s,k)=>{const lock=!canStage(s.k);return`<button class="step${k<si?" done":""}${k===si?" cur":""}${stageArmed===s.k?" armed":""}" style="--c:${s.c}" data-st="${s.k}" ${ro||lock?"disabled":""} title="${lock?lockMsg(s.k):"Marcar "+s.n}">${s.n}</button>`}).join("")}</div>
  ${stageArmed?`<div class="msg warn" id="armMsg">Faltam ${checks.length-cdone} verificações da checklist. Toca outra vez em <b>${esc(sOf(stageArmed).n)}</b> para avançar na mesma.</div>`:""}
  ${log.length?`<div class="steplog">${log.join("<br>")}</div>`:""}
 </div>
 ${S.local?"":`<div class="sec"><h4><span>Responsável e prazo</span>${isLate(it)?`<span style="color:var(--warn);text-transform:none;letter-spacing:0">Em atraso</span>`:""}</h4>
  <div class="row"><div id="shAssign"></div><input type="date" id="shDue" value="${esc(it.due||"")}" aria-label="Prazo" ${ro||!S.isCoord&&it.assignee&&it.assignee!==S.meId?"":""} style="border:1px solid var(--line);border-radius:6px;padding:6px 9px;background:var(--panel)" ${ro?"disabled":""}></div></div>`}
 <div class="sec"><h4><span>Checklist de ensaio</span><span id="ckCount">${cdone}/${checks.length}</span></h4>
  <div class="checks">${checks.map((c,k)=>`<label><input type="checkbox" data-ck="${k}" ${ck(it)[k]?"checked":""} ${ro?"disabled":""}><span>${esc(c)}</span></label>`).join("")}</div>
 </div>
 <div class="sec"><h4><span>Identificação</span><span style="display:flex;gap:6px">
   ${sampleFn&&!ro?`<button class="btn sm dark" id="btnRead">Ler etiqueta</button>`:""}
   ${ro?"":`<label class="btn sm" for="phCam">Tirar foto</label><label class="btn sm" for="phFile">Carregar</label><button type="button" class="btn sm" id="btnShot" title="Captura de ecrã (ex.: foto aberta no Fieldwire ou no email)">Captura</button>`}</span></h4>
  <div class="row">
   <label class="f">ID do equipamento<input id="ed_devId" class="mono" value="${esc(it.devId)}" autocomplete="off" ${ro?"readonly":""}></label>
   <label class="f">MAC<input id="ed_mac" class="mono" value="${esc(it.mac)}" placeholder="AA:BB:CC:DD:EE:FF" autocomplete="off" ${ro?"readonly":""}></label>
   <label class="f">Fabricante<input id="ed_maker" value="${esc(it.maker)}" autocomplete="off" ${ro?"readonly":""}></label>
   <label class="f">Modelo<input id="ed_model" class="mono" value="${esc(it.model)}" autocomplete="off" ${ro?"readonly":""}></label>
   <label class="f">Nº série<input id="ed_serial" class="mono" value="${esc(it.serial)}" autocomplete="off" ${ro?"readonly":""}></label>
   <label class="f">Nº tarefa Fieldwire<input id="ed_taskNo" class="mono" value="${esc(it.taskNo)}" inputmode="numeric" autocomplete="off" ${ro?"readonly":""}></label>
  </div>
  <div id="readMsg"></div>
  <div class="photos" id="photos"></div>
 </div>
 <div class="sec"><h4><span>Anomalias</span><span>${iss.filter(x=>x.status!=="resolvida").length} abertas</span></h4>
  ${iss.map(x=>`<div class="issue-card${x.status==="resolvida"?" closed":""}">
    <div style="display:flex;gap:10px">${x.photo?`<img data-ref="${esc(x.photo)}" alt="Foto da anomalia" data-pv="${esc(x.photo)}">`:""}<div style="flex:1;min-width:0;white-space:pre-wrap">${esc(x.text)}</div></div>
    <div class="meta"><span>${esc(nameOf(x.createdBy))} · ${fmtDate(x.createdAt)}</span>${x.assignee?`<span>→</span>${personChip(x.assignee)}`:""}
    ${x.status==="resolvida"?`<span>· resolvida por ${esc(nameOf(x.resolvedBy))} ${fmtDate(x.resolvedAt)}</span>`:(S.canWrite?`<button class="btn sm" data-resolve="${esc(x.id)}" style="margin-left:auto">Marcar resolvida</button>`:"")}</div></div>`).join("")||`<span class="none">Sem anomalias.</span>`}
  ${ro?"":`<div class="newissue">
   <textarea id="niText" placeholder="Descreve a anomalia (ex.: base partida, sem comunicação, falta etiqueta)">${esc(newIssue.text)}</textarea>
   <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
    <label class="btn sm" for="issueCam">${newIssue.photo?"Foto anexada ✓":"Foto"}</label>
    <span id="niAssign" style="flex:1;min-width:160px"></span>
    <button class="btn sm primary" id="niGo">Registar anomalia</button>
   </div></div>`}
 </div>
 <label class="f">Notas<textarea id="ed_note" rows="2" ${ro?"readonly":""}>${esc(it.note)}</textarea></label>
 ${(it.log||[]).length?`<details class="sec hist"><summary>Histórico (${it.log.length})</summary><div class="steplog">${it.log.slice().reverse().slice(0,25).map(e=>`${fmtDate(e.at)} · <b>${esc(nameOf(e.by))}</b> · ${esc(logText(e))}`).join("<br>")}</div></details>`:""}
 <div class="sh-foot">
  ${canDel?`<button class="btn danger sm${delArmed?" armed":""}" id="edDel">${delArmed?"Confirmar apagar":"Apagar"}</button>`:"<span></span>"}
  <span class="muted" style="font-size:12px">${it.updatedAt?`Atualizado ${fmtDate(it.updatedAt)} por ${esc(nameOf(it.updatedBy))}`:""}</span>
  <button class="btn sm primary" id="edNext">Seguinte →</button>
 </div>`;
 wireSheet(it);renderPhotos(it);renderReadMsg(it);hydrate(box);decorateSheet(box,it);
 if(!ro&&$("shAssign"))mountPicker($("shAssign"),it.assignee||null,id=>{api.update("items",it.id,logPatch(it,{assignee:id||null,updatedAt:now(),updatedBy:S.meId},id?"Atribuído a":"Responsável removido",id?{u:id}:null))},"Responsável…");
 else if($("shAssign"))$("shAssign").innerHTML=it.assignee?personChip(it.assignee):`<span class="none">Sem responsável</span>`;
 const sd=$("shDue");if(sd)sd.onchange=()=>api.update("items",it.id,logPatch(it,{due:sd.value||"",updatedAt:now(),updatedBy:S.meId},sd.value?"Prazo: "+fmtDay(sd.value):"Prazo removido"));
 if(!ro)mountPicker($("niAssign"),newIssue.assignee,id=>{newIssue.assignee=id},"Atribuir a…");
}
function updateSheetPassive(it){
 const map={devId:"ed_devId",mac:"ed_mac",maker:"ed_maker",model:"ed_model",serial:"ed_serial",taskNo:"ed_taskNo",note:"ed_note"};
 for(const[k,id]of Object.entries(map)){const el=$(id);if(el&&el!==document.activeElement&&!(fieldPatch[it.id]&&k in fieldPatch[it.id]))el.value=it[k]||""}
 renderPhotos(it);renderReadMsg(it)}
function wireSheet(it){
 $("shClose").onclick=()=>select(null);
 const mv=$("shMove");if(mv)mv.onclick=()=>{S.moving=S.moving===it.id?null:it.id;sheetFor=null;render();if(S.moving&&matchMedia("(max-width:860px)").matches)$("sheet").hidden=true};
 const code=$("edCode");code.oninput=()=>setField(it.id,"code",code.value.trim()||it.code);
 $("edType").onchange=e=>{const t=e.target.value;lastType=t;const patch={type:t};if(new RegExp("^"+it.type+"-\\d{3}$").test(it.code))patch.code=nextCode(t);
  api.update("items",it.id,{...patch,updatedAt:now(),updatedBy:S.meId});sheetFor=null};
 box("sheet").querySelectorAll(".step").forEach(b=>b.onclick=()=>setStage(it,b.dataset.st));
 box("sheet").querySelectorAll("[data-ck]").forEach(cb=>cb.onchange=()=>{const k=cb.dataset.ck;api.update("items",it.id,{checks:{[it.type]:{[k]:cb.checked}},updatedAt:now(),updatedBy:S.meId});
  const checks=CHECKS[it.type]||CHECKS.EQ;const n=[...box("sheet").querySelectorAll("[data-ck]")].filter(x=>x.checked).length;$("ckCount").textContent=n+"/"+checks.length;
  if(n===checks.length&&sIdx(it.stage)<3)toast("Checklist completa. Já podes marcar Testado.")});
 for(const k of["devId","maker","model","serial","taskNo","note"]){const el=$("ed_"+k);if(el)el.oninput=()=>{el.classList.remove("auto");setField(it.id,k,el.value.trim())}}
 const dv=$("ed_devId");if(dv)dv.addEventListener("change",()=>{const v=dv.value.trim();const o=v&&findDup(it.id,"devId",v);if(o)toast(`ID ${v} repetido com ${o.code}. Ficou guardado e marcado a vermelho.`)});
 const mac=$("ed_mac");if(mac){mac.oninput=()=>{mac.classList.remove("auto");setField(it.id,"mac",mac.value.trim())};mac.onchange=()=>{const v=normMac(mac.value);mac.value=v;setField(it.id,"mac",v);const o=v&&findDup(it.id,"mac",v);if(o)toast(`MAC ${v} repetido com ${o.code}. Ficou guardado e marcado a vermelho.`)}}
 const br=$("btnRead");if(br)br.onclick=()=>readLabel(it.id,true);
 const bs=$("btnShot");if(bs)bs.onclick=()=>screenShot();
 box("sheet").querySelectorAll("[data-pv]").forEach(im=>im.onclick=()=>openPhoto(null,im.dataset.pv));
 box("sheet").querySelectorAll("[data-resolve]").forEach(b=>b.onclick=()=>resolveIssue(b.dataset.resolve));
 const nt=$("niText");if(nt)nt.oninput=()=>{newIssue.text=nt.value};
 const ng=$("niGo");if(ng)ng.onclick=()=>createIssue(it);
 const del=$("edDel");if(del)del.onclick=async()=>{if(!delArmed){delArmed=true;sheetFor=null;render();return}
  const its=S.issues.filter(x=>x.itemId===it.id);S.sel=null;await api.del("items",it.id);for(const x of its)await api.del("issues",x.id);toast("Equipamento apagado")};
 $("edNext").onclick=()=>{flushFields();const n=nextOf(it.id);if(n){select(n.id);centerOn(n)}else{toast("Não há mais equipamentos por fazer neste piso.");select(null)}};
}
const box=id=>$(id);
function setStage(it,k){if(!S.canWrite)return;if(sIdx(k)<2&&(String(it.devId||"").trim()||String(it.mac||"").trim())){toast("Com ID registado o equipamento conta sempre como Instalado e Endereçado. Apaga o ID para voltar atrás.");return}const ti=sIdx(k),ci=sIdx(it.stage);
 if(!canStage(k)){toast(lockMsg(k));return}
 const checks=CHECKS[it.type]||CHECKS.EQ,cdone=checks.filter((_,j)=>ck(it)[j]).length;
 if(ti>=3&&ci<3&&cdone<checks.length&&stageArmed!==k){stageArmed=k;sheetFor=null;render();return}
 stageArmed=null;
 const patch={stage:k,updatedAt:now(),updatedBy:S.meId};
 if(ti>ci)patch.stageLog={[k]:{by:S.meId,at:now()}};
 logPatch(it,patch,(ti<ci?"Voltou a ":"Etapa: ")+sOf(k).n);
 api.update("items",it.id,patch);sheetFor=null;
 if(ti>ci&&ti>=3){const n=nextOf(it.id);if(n)toast(`${it.code}: ${sOf(k).n}. Seguinte: ${n.code}`)}}
function nextCode(type){const n=S.items.filter(i=>i.type===type).map(i=>parseInt((String(i.code).match(/(\d+)$/)||[])[1]||0)).reduce((a,b)=>Math.max(a,b),0);return`${type}-${String(n+1).padStart(3,"0")}`}
let lastType="DI";
function newItem(pt){return{log:[{at:now(),by:S.meId,t:"Criado"}],planId:S.planId,code:nextCode(lastType),type:lastType,stage:"instalado",stageLog:{instalado:{by:S.meId,at:now()}},checks:{},x:pt.x,y:pt.y,
 devId:"",mac:"",maker:"",model:"",serial:"",taskNo:"",note:"",photos:[],createdBy:S.meId,createdAt:now(),updatedAt:now(),updatedBy:S.meId}}
async function addItem(pt){const id=uid();const it={log:[{at:now(),by:S.meId,t:"Criado"}],planId:S.planId,code:nextCode(lastType),type:lastType,stage:"instalado",stageLog:{instalado:{by:S.meId,at:now()}},checks:{},x:pt.x,y:pt.y,
 devId:"",mac:"",maker:"",model:"",serial:"",taskNo:"",note:"",photos:[],createdBy:S.meId,createdAt:now(),updatedAt:now(),updatedBy:S.meId};
 await api.set("items",id,it);S.sel=id;sheetFor=null;render();$("dpTitle").textContent="Foto de "+it.code;$("dlgPhoto").showModal()}
$("dpSkip").onclick=()=>$("dlgPhoto").close();

/* fotos do equipamento */
function renderPhotos(it){const bx=$("photos");if(!bx)return;const ids=it.photos||[];
 const key=ids.join("|");if(bx.dataset.k===key)return;bx.dataset.k=key;
 if(!ids.length){bx.innerHTML=`<span class="none" style="grid-column:1/-1">Sem fotos. Fotografa a etiqueta para registar o ID e o MAC.</span>`;return}
 const can=S.canWrite;
 bx.innerHTML=ids.map(r=>`<div class="phw"><button type="button" data-ph="${esc(r)}" aria-label="Ver foto"><img data-ref="${esc(r)}" alt=""></button>${can?`<button type="button" class="rm" data-rmph="${esc(r)}" aria-label="Remover foto" title="Remover foto">×</button>`:""}</div>`).join("");hydrate(bx);
 bx.querySelectorAll("[data-ph]").forEach(b=>b.onclick=()=>openPhoto(it.id,b.dataset.ph));
 bx.querySelectorAll("[data-rmph]").forEach(b=>b.onclick=e=>{e.stopPropagation();
  if(!b.classList.contains("armed")){b.classList.add("armed");b.textContent="Remover?";setTimeout(()=>{if(b.isConnected){b.classList.remove("armed");b.textContent="×"}},3500);return}
  removePhoto(it.id,b.dataset.rmph)})}
function removePhoto(itemId,ref){const it=S.items.find(i=>i.id===itemId);if(!it)return;
 api.update("items",it.id,logPatch(it,{photos:(it.photos||[]).filter(x=>x!==ref),updatedAt:now(),updatedBy:S.meId},"Foto removida"));toast("Foto removida")}
let viewing=null,phArmed=false;
function openPhoto(itemId,ref){viewing={itemId,ref};phArmed=false;$("pvDel").textContent="Remover foto";$("pvDel").classList.remove("armed");
 $("pvDel").hidden=!itemId||!S.canWrite;$("pvTitle").textContent=itemId?((S.items.find(i=>i.id===itemId)||{}).code||"Foto"):"Foto";$("pvImg").removeAttribute("src");urlOf(ref).then(u=>{$("pvImg").src=u}).catch(()=>toast("Foto indisponível"));$("dlgView").showModal()}
$("pvClose").onclick=()=>$("dlgView").close();
$("pvDel").onclick=()=>{if(!phArmed){phArmed=true;$("pvDel").classList.add("armed");$("pvDel").textContent="Confirmar remover";return}
 removePhoto(viewing.itemId,viewing.ref);$("dlgView").close()};
["phCam","phFile","dpCam","dpFile"].forEach(id=>$(id).onchange=e=>{const fs=[...e.target.files];e.target.value="";if($("dlgPhoto").open)$("dlgPhoto").close();const it=cur();if(it)addPhotos(it,fs)});
async function addPhotos(it,fs){if(!it||!fs.length)return;const blobs=[],refs=[];
 setReadMsgFor(it.id,"A guardar foto…","busy");
 for(const f of fs){try{const hi=await hiRes(f);const b=await shrink(hi,2048,.9);const r=await putFile(b,"image/jpeg");await origPut(r,hi);blobs.push(hi);refs.push(r)}catch(err){toast("Foto não guardada: "+err.message)}}
 if(!refs.length){setReadMsgFor(it.id,"");return}
 const fresh=S.items.find(i=>i.id===it.id)||it;
 await api.update("items",it.id,logPatch(fresh,{photos:[...(fresh.photos||[]),...refs],updatedAt:now(),updatedBy:S.meId},refs.length>1?`${refs.length} fotos adicionadas`:"Foto adicionada"));
 if(sampleFn)readLabel(it.id,false,blobs);else setReadMsgFor(it.id,refs.length>1?`${refs.length} fotos guardadas.`:"Foto guardada.","ok")}

/* anomalias */
async function resolveIssue(xid){const x=S.issues.find(i=>i.id===xid);await api.update("issues",xid,{status:"resolvida",resolvedBy:S.meId,resolvedAt:now()});
 const it=x&&S.items.find(i=>i.id===x.itemId);if(it)await api.update("items",it.id,logPatch(it,{updatedAt:now(),updatedBy:S.meId},"Anomalia resolvida: "+String(x.text).slice(0,60)))}
$("issueCam").onchange=async e=>{const f=e.target.files[0];e.target.value="";if(!f)return;try{newIssue.photo=await putFile(await shrink(f),"image/jpeg");sheetFor=null;render()}catch(err){toast("Foto não guardada: "+err.message)}};
async function createIssue(it){const text=(newIssue.text||"").trim();if(!text){toast("Escreve o que se passa antes de registar.");$("niText").focus();return}
 await api.set("issues",uid(),{itemId:it.id,planId:it.planId,text,photo:newIssue.photo||null,assignee:newIssue.assignee||null,status:"aberta",createdBy:S.meId,createdAt:now()});
 await api.update("items",it.id,logPatch(it,{updatedAt:now(),updatedBy:S.meId},"Anomalia registada: "+text.slice(0,80)));
 newIssue={text:"",photo:null,assignee:null};sheetFor=null;render();toast("Anomalia registada")}

/* =========================================================
   Leitura da etiqueta no próprio aparelho (gratuita, funciona sem rede
   depois da primeira utilização):
   - texto: Tesseract.js (OCR)
   - códigos DataMatrix / QR / barras: BarcodeDetector do navegador ou ZXing
   ========================================================= */
let readMsg=null,readingId=null,lastReadErr=null;
const LIB={tess:"https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js",zx:"https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js"};
const libP={};
function loadScript(u){if(!libP[u])libP[u]=new Promise((res,rej)=>{const s=document.createElement("script");s.src=u;s.async=true;s.crossOrigin="anonymous";s.onload=res;
 s.onerror=()=>{delete libP[u];s.remove();rej(new Error(navigator.onLine?"não foi possível carregar o leitor de etiquetas":"o leitor de etiquetas ainda não foi guardado neste aparelho. Abre a app uma vez com rede e carrega em Coordenação → Preparar para usar sem rede"))};document.head.appendChild(s)});return libP[u]}
let tessP=null;
const T_NORMAL={tessedit_pageseg_mode:"11",tessedit_char_whitelist:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789:-./# ",preserve_interword_spaces:"1"};
/* leitores em paralelo: 2 para a página inteira (se o aparelho aguentar) + 1 para linhas recortadas */
const T_LINE={tessedit_pageseg_mode:"7",tessedit_char_whitelist:"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789: ",preserve_interword_spaces:"1"};
let poolP=null;
function pool(){if(!poolP)poolP=(async()=>{await loadScript(LIB.tess);
  const n=(navigator.hardwareConcurrency||2)>=4&&(navigator.deviceMemory||4)>=3?2:1;
  const mk=async P=>{const w=await Tesseract.createWorker("eng",1);await w.setParameters(P);return w};
  const ws=await Promise.all([...Array(n)].map(()=>mk(T_NORMAL)).concat([mk(T_LINE)]));const line=ws.pop();return{a:ws,line}})().catch(e=>{poolP=null;throw e});return poolP}
function tess(){return pool().then(P=>P.a[0])}
async function prepareReader(){await pool();try{await loadScript(LIB.zx)}catch(e){}}
function initSample(){}
/* prepara a imagem para os códigos de barras: tamanho adequado, tons de cinzento e contraste */
async function prepCanvas(blob,rot){const bm=await createImageBitmap(blob);const L=Math.max(bm.width,bm.height);const k=Math.min(2.2,Math.max(1,1700/L))*(L>2400?2400/L:1);
 const w=Math.round(bm.width*k),h=Math.round(bm.height*k);const cv=document.createElement("canvas");const sw=rot%180!==0;cv.width=sw?h:w;cv.height=sw?w:h;
 const cx=cv.getContext("2d",{willReadFrequently:true});cx.fillStyle="#fff";cx.fillRect(0,0,cv.width,cv.height);cx.translate(cv.width/2,cv.height/2);cx.rotate(rot*Math.PI/180);cx.drawImage(bm,-w/2,-h/2,w,h);cx.setTransform(1,0,0,1,0,0);
 const im=cx.getImageData(0,0,cv.width,cv.height),d=im.data;let lo=255,hi=0;const g=new Uint8ClampedArray(d.length/4);
 for(let i=0,j=0;i<d.length;i+=4,j++){const v=(d[i]*.299+d[i+1]*.587+d[i+2]*.114)|0;g[j]=v;if(v<lo)lo=v;if(v>hi)hi=v}
 const span=Math.max(40,hi-lo);for(let i=0,j=0;i<d.length;i+=4,j++){const v=Math.max(0,Math.min(255,(g[j]-lo)*255/span));d[i]=d[i+1]=d[i+2]=v}
 cx.putImageData(im,0,0);return cv}
/* prepara a imagem para o texto: qualquer orientação (rot), canal de cor (lum = normal; g = verde, para
   placas verdes / fundos coloridos) e binarização adaptativa (cada zona compara com a sua vizinhança,
   por isso texto escuro sobre verde, branco ou reflexos fica preto sobre branco) */
const bmCache=new WeakMap();
/* tamanho da tela para qualquer ângulo (inclui inclinações, ex.: 187°) */
function rotDims(w,h,rot){const a=rot*Math.PI/180,c=Math.abs(Math.cos(a)),s=Math.abs(Math.sin(a));return[Math.round(w*c+h*s),Math.round(w*s+h*c)]}
async function bitmapOf(blob){let b=bmCache.get(blob);if(!b){b=await createImageBitmap(blob);bmCache.set(blob,b)}return b}
function adaptiveBW(cx,W,H,ch,winFrac,C){const im=cx.getImageData(0,0,W,H),d=im.data,n=W*H;const g=new Float32Array(n);
 for(let i=0,j=0;j<n;i+=4,j++)g[j]=ch==="g"?d[i+1]:d[i]*.299+d[i+1]*.587+d[i+2]*.114;
 const I=new Float64Array((W+1)*(H+1));for(let y=0;y<H;y++){let row=0;for(let x=0;x<W;x++){row+=g[y*W+x];I[(y+1)*(W+1)+x+1]=I[y*(W+1)+x+1]+row}}
 const r=Math.max(4,Math.round(Math.max(W,H)*winFrac/2));
 for(let y=0;y<H;y++){const y0=Math.max(0,y-r),y1=Math.min(H,y+r+1);for(let x=0;x<W;x++){const x0=Math.max(0,x-r),x1=Math.min(W,x+r+1);
  const sum=I[y1*(W+1)+x1]-I[y0*(W+1)+x1]-I[y1*(W+1)+x0]+I[y0*(W+1)+x0];const m=sum/((x1-x0)*(y1-y0));const v=g[y*W+x]<m-C?0:255;const k=(y*W+x)*4;d[k]=d[k+1]=d[k+2]=v;d[k+3]=255}}
 cx.putImageData(im,0,0)}
async function rotCanvas(blob,rot,maxL){const bm=await bitmapOf(blob);const L=Math.max(bm.width,bm.height);const k=Math.min(1,maxL/L);
 const w=Math.round(bm.width*k),h=Math.round(bm.height*k);const cv=document.createElement("canvas");[cv.width,cv.height]=rotDims(w,h,rot);
 const cx=cv.getContext("2d",{willReadFrequently:true});cx.fillStyle="#fff";cx.fillRect(0,0,cv.width,cv.height);cx.imageSmoothingQuality="high";
 cx.translate(cv.width/2,cv.height/2);cx.rotate(rot*Math.PI/180);cx.drawImage(bm,-w/2,-h/2,w,h);return cv}
async function textCanvas(blob,rot,ch,maxL){maxL=maxL||1700;const bm=await bitmapOf(blob);const L=Math.max(bm.width,bm.height);const k=maxL/L;
 const w=Math.round(bm.width*k),h=Math.round(bm.height*k);const cv=document.createElement("canvas");[cv.width,cv.height]=rotDims(w,h,rot);
 const cx=cv.getContext("2d",{willReadFrequently:true});cx.fillStyle="#fff";cx.fillRect(0,0,cv.width,cv.height);cx.imageSmoothingQuality="high";
 cx.translate(cv.width/2,cv.height/2);cx.rotate(rot*Math.PI/180);cx.drawImage(bm,-w/2,-h/2,w,h);cx.setTransform(1,0,0,1,0,0);
 adaptiveBW(cx,cv.width,cv.height,ch,.03,12);return cv}
async function readCodes(blob){const out=[];
 try{if("BarcodeDetector" in window){const fm=await BarcodeDetector.getSupportedFormats();const want=fm.filter(f=>["data_matrix","qr_code","code_128","code_39","aztec","ean_13"].includes(f));
   if(want.length){const bm=await createImageBitmap(blob);const r=await new BarcodeDetector({formats:want}).detect(bm);r.forEach(x=>x.rawValue&&out.push(x.rawValue))}}}catch(e){}
 if(out.length)return out;
 try{await loadScript(LIB.zx);const cv=await prepCanvas(blob,0);const cx=cv.getContext("2d");const d=cx.getImageData(0,0,cv.width,cv.height).data;const lum=new Uint8ClampedArray(cv.width*cv.height);for(let i=0,j=0;i<d.length;i+=4,j++)lum[j]=d[i];
  const hints=new Map();hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS,[ZXing.BarcodeFormat.DATA_MATRIX,ZXing.BarcodeFormat.QR_CODE,ZXing.BarcodeFormat.CODE_128,ZXing.BarcodeFormat.CODE_39,ZXing.BarcodeFormat.AZTEC]);hints.set(ZXing.DecodeHintType.TRY_HARDER,true);
  const rd=new ZXing.MultiFormatReader();rd.setHints(hints);const src=new ZXing.RGBLuminanceSource(lum,cv.width,cv.height);
  try{out.push(rd.decode(new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(src))).getText())}catch(e){try{out.push(rd.decode(new ZXing.BinaryBitmap(new ZXing.GlobalHistogramBinarizer(src))).getText())}catch(e2){}}}catch(e){}
 return out}
/* candidatos a ID / MAC a partir do texto e dos códigos */
const hexFix=t=>String(t).toUpperCase().replace(/O/g,"0").replace(/[IL]/g,"1");
/* valor depois de "ID:": hexadecimal com 6 a 8 caracteres é o caso típico (pontuação alta); corta lixo no fim ("TDSF23y" → 7D5F23) */
function idVal(raw){const u=String(raw).toUpperCase();let v=hexFixId(u);
 if(!/^[0-9A-F]+$/.test(v)){for(let n=u.length-1;n>=5;n--){const t=hexFixId(u.slice(0,n));if(/^[0-9A-F]+$/.test(t)){v=t;break}}}
 const hex=/^[0-9A-F]+$/.test(v);return{v,s:hex&&v.length>=6&&v.length<=8?10:hex?7:8}}
/* depois de "ID:" o valor é quase sempre hexadecimal: corrige confusões típicas do OCR (S→5, T→7, Z→2, G→6, Q→0) */
const hexFixId=t=>{const u=String(t).toUpperCase();const v=u.replace(/[OQ]/g,"0").replace(/[IL]/g,"1").replace(/S/g,"5").replace(/T/g,"7").replace(/Z/g,"2").replace(/G/g,"6");return /^[0-9A-F]+$/.test(v)&&/\d/.test(v)?v:u};
function candsFrom(text,codes){const C=[];
 const add=(k,v,s)=>{v=String(v||"").trim().toUpperCase();if(!v)return;if(k==="mac")v=normMac(v);const o=C.find(c=>c.k===k&&c.v===v);if(o){o.s=Math.max(o.s,s);return}C.push({k,v,s})};
 const scan=(T,boost)=>{T=" "+String(T||"").replace(/[|\\]/g," ")+" ";
  // MAC com separadores, ou 12 hex depois de "MAC"
  for(const m of T.matchAll(/(?:[0-9A-FOIL]{2}[:\-]){5}[0-9A-FOIL]{2}/gi)){const v=hexFix(m[0]).replace(/[^0-9A-F]/g,"");if(v.length===12)add("mac",v,9+boost)}
  for(const m of T.matchAll(/MAC[^0-9A-Z]{0,4}([0-9A-FOIL]{12})(?![0-9A-Z])/gi)){const v=hexFix(m[1]);if(/^[0-9A-F]{12}$/.test(v))add("mac",v,9+boost)}
  // ID com prefixo: "ID:", "ID-Nr.", "ID No.", "Device ID" (pode vir colado: "25/51ID:8B281B")
  for(const m of T.matchAll(/(?:^|[^A-Za-z])[I1l]D(?:[-\s]?N[RO°º]\.?|\s+NO\.?)?\s*[:;#.]\s*([0-9A-Z]{4,12})(?![0-9A-Z])/gi)){const r=idVal(m[1]);add("id",r.v,r.s+boost)}
  for(const m of T.matchAll(/(?:^|[^A-Z0-9])[I1l]D\s+([0-9A-Z]{5,10})(?![0-9A-Z])/gi)){const v=hexFixId(m[1]);if(/^[0-9A-F]+$/.test(v)&&/\d/.test(v))add("id",v,9+boost)}};
 scan(text,0);
 for(const c of codes||[]){const t=String(c).trim();scan(t,0);
  if(/^[0-9A-F]{12}$/i.test(t))add("mac",t,8);else if(/^[0-9A-F]{5,10}$/i.test(t))add("id",t,8);else if(/^[0-9A-Z\-]{4,16}$/i.test(t)&&/\d/.test(t))add("id",t,6)}
 // códigos curtos isolados (ex.: 4EB655, 95F4528), muitas vezes ao lado do DataMatrix
 const macs=C.filter(c=>c.k==="mac").map(c=>c.v.replace(/:/g,""));
 const words=String(text||"").toUpperCase().split(/[^0-9A-Z]+/).filter(Boolean);
 words.forEach((w,i)=>{if(w.length<6||w.length>8)return;let sub=0;
  if(!/^[0-9A-FOIL]+$/.test(w)){if(!/^[0-9A-FOILGSZQ]+$/.test(w)||!/[0-9]/.test(w)||(w.match(/[GSZQ]/g)||[]).length>2)return;w=w.replace(/G/g,"6").replace(/S/g,"5").replace(/Z/g,"2").replace(/Q/g,"0");sub=1}
  const v=hexFix(w);
  if(!/\d/.test(v)||macs.some(m=>m.includes(v)))return;const prev=words[i-1]||"";
  if(/^(EN|G|CPR|VDS|SN|S|N|LOT|REF|PN|P|ART|TYPE|TIPO|MOD|MODEL|DATE|DATA|V|VDC|VAC|IP|IK)$/.test(prev))return;
  const letters=/[A-F]/.test(v);if(/^(19|20)\d{4,6}$/.test(v))return;
  add("id",v,(letters?(v.length===6?5:4):2)-sub*.5)});
 return C.sort((a,b)=>b.s-a.s).slice(0,6)}
/* padrão dos IDs desta obra (ex.: 6 caracteres hexadecimais) — serve para validar a leitura sozinha */
function idPattern(){const L={};let hex=0,n=0;for(const i of S.items){const v=String(i.devId||"").trim().toUpperCase();if(!v)continue;n++;L[v.length]=(L[v.length]||0)+1;if(/^[0-9A-F]+$/.test(v))hex++}
 const len=+(Object.entries(L).sort((a,b)=>b[1]-a[1])[0]||[6])[0];return{len:n>=3?len:6,hex:n<3||hex/n>.6}}
function applyPattern(cands){const P=idPattern();const out=[];
 for(const c of cands){if(c.k!=="id"){out.push(c);continue}let v=c.v,s=c.s;
  if(P.hex&&/^[0-9A-F]+$/.test(v)&&v.length===P.len+1)out.push({k:"id",v:v.slice(0,P.len),s:s+2});   // um carácter a mais lido no fim
  if(v.length===P.len&&(!P.hex||/^[0-9A-F]+$/.test(v)))s+=1.5;else if(Math.abs(v.length-P.len)>1)s-=1.5;
  if(S.items.some(i=>String(i.devId||"").toUpperCase()===v))s-=.5;
  out.push({...c,s})}
 const m={};for(const c of out){const k=c.k+"|"+c.v;if(!m[k]||m[k].s<c.s)m[k]=c}return Object.values(m).sort((a,b)=>b.s-a.s).slice(0,6)}
function wordsOf(d){if(d&&d.words&&d.words.length)return d.words;const out=[];for(const b of (d&&d.blocks)||[])for(const p of b.paragraphs||[])for(const l of p.lines||[])for(const w of l.words||[])out.push(w);return out}
/* linha recortada em alta resolução, binarizada, para ler o valor do ID */
function lineCut(full,box,H,ch,soft){const sw=box.x1-box.x0,sh=box.y1-box.y0;const W=Math.max(8,Math.round(sw*H/sh));const cv=document.createElement("canvas");cv.width=W;cv.height=H;
 const cx=cv.getContext("2d",{willReadFrequently:true});cx.fillStyle="#fff";cx.fillRect(0,0,W,H);cx.imageSmoothingQuality="high";
 if(soft){const t=document.createElement("canvas");t.width=Math.max(4,Math.round(W/1.8));t.height=Math.max(4,Math.round(H/1.8));t.getContext("2d").drawImage(full,box.x0,box.y0,sw,sh,0,0,t.width,t.height);cx.drawImage(t,0,0,W,H)}
 else cx.drawImage(full,box.x0,box.y0,sw,sh,0,0,W,H);
 adaptiveBW(cx,W,H,ch,.6*H/Math.max(W,H),10);return cv}
function lineVotes(t,votes,wgt){t=String(t||"").toUpperCase();
 for(const m of t.matchAll(/[I1L|]?[D0O]?\s*[:;.]\s*([0-9A-Z]{5,10})(?![0-9A-Z])/g)){const r=idVal(m[1]);if(/^[0-9A-F]{5,9}$/.test(r.v))votes[r.v]=(votes[r.v]||0)+wgt*1.5}
 for(const m of t.matchAll(/(?:^|[^0-9A-Z])([0-9A-Z]{6,8})(?![0-9A-Z])/g)){const v=hexFixId(m[1]);if(/^[0-9A-F]{6,8}$/.test(v)&&/\d/.test(v)&&!/^[I1L]D/.test(m[1]))votes[v]=(votes[v]||0)+wgt}}
async function refineAt(P,full,k,w,votes){const b=w.bbox||{};const h=(b.y1-b.y0)*k;if(!(h>4))return;const isId=/^[I1l|][DO0]/.test(w.text||"");
 const box={x0:Math.max(0,b.x0*k-h*.5),y0:Math.max(0,b.y0*k-h*.6),x1:Math.min(full.width,(isId?b.x0*k+h*11:b.x1*k+h*.6)),y1:Math.min(full.height,b.y1*k+h*.6)};
 if(box.x1-box.x0<h||box.y1-box.y0<4)return;
 for(const[H,ch,soft]of[[56,"lum",0],[56,"g",0],[80,"lum",1]]){const r=await P.line.recognize(lineCut(full,box,H,ch,soft));lineVotes(r.data&&r.data.text,votes,1)}}
async function readOne(blob,onStep,deep){const codes=await readCodes(blob);let cands=applyPattern(candsFrom("",codes));if(cands.length&&cands[0].s>=9)return{cands,codes,text:""};
 const P=await pool();let text="";const votes={};
 const strongNow=()=>{const best=Object.entries(votes).sort((a,b)=>b[1]-a[1])[0];return best&&best[1]>=2.5};
 // 1) leitura rápida da foto inteira (imagem reduzida) em cada orientação, normal e pelo canal verde, em paralelo
 /* etiquetas fotografadas tortas (ex.: ao contrário e inclinadas 5–10°): depois das 4 orientações, tenta também ±7° (e ±14° na leitura profunda) */
 const ROTS=[0,90,270,180,187,173,7,353,...(deep?[194,166,14,346,97,83,277,263]:[])];
 for(const rot of ROTS){onStep&&onStep(rot%360,"");
  const run=async(ch,w)=>(await w.recognize(await textCanvas(blob,rot,ch,1000),{},{text:true,blocks:true})).data;
  let ds=[];if(P.a.length>1)ds=await Promise.all(["lum","g"].map((ch,i)=>run(ch,P.a[i])));else{ds.push(await run("lum",P.a[0]));if(!/(?:^|[^A-Za-z])[I1l][DO0]\s*[:;.]/.test(ds[0].text||""))ds.push(await run("g",P.a[0]))}
  for(const d of ds)text+="\n"+(d.text||"");
  // 2) onde aparece "ID" ou um código, recorta essa linha em alta resolução e lê de novo (várias vezes) para confirmar
  const anchors=[];for(const d of ds)for(const w of wordsOf(d)){const t=String(w.text||"");const c=t.replace(/[^0-9A-Za-z]/g,"");
   if(/^[I1l|][DO0]/.test(t)||(/^[0-9A-FOILS]{5,9}$/i.test(c)&&/\d/.test(c)))anchors.push(w)}
  if(anchors.length){onStep&&onStep(rot,"zoom");const full=await rotCanvas(blob,rot,3600);const k=full.width/(await textCanvas(blob,rot,"lum",1000)).width;const seen=[];
   for(const w of anchors.sort((a,b)=>(/^[I1l|][DO0]/.test(b.text)?1:0)-(/^[I1l|][DO0]/.test(a.text)?1:0)).slice(0,3)){const b=w.bbox||{};if(seen.some(q=>Math.abs(q.y0-b.y0)<(b.y1-b.y0)&&Math.abs(q.x0-b.x0)<(b.y1-b.y0)*6))continue;seen.push(b);await refineAt(P,full,k,w,votes);if(strongNow())break}}
  cands=applyPattern([...candsFrom(text,codes),...Object.entries(votes).map(([v,n])=>({k:"id",v,s:n>=2.5?10.5:n>=1.5?8:6}))]);
  if(cands.length&&cands[0].s>=10)return{cands,codes,text}}
 // 3) último recurso: foto inteira em alta resolução, direita
 for(const[rot,ch]of deep?[[0,"lum"],[0,"g"],[90,"lum"],[270,"lum"],[180,"lum"],[90,"g"],[270,"g"]]:[[0,"lum"],[0,"g"]]){onStep&&onStep(rot,ch);const r=await P.a[0].recognize(await textCanvas(blob,rot,ch,deep?2200:1700));text+="\n"+(r.data.text||"");cands=applyPattern([...candsFrom(text,codes),...Object.entries(votes).map(([v,n])=>({k:"id",v,s:n>=2.5?10.5:n>=1.5?8:6}))]);if(cands.length&&cands[0].s>=10)break}
 return{cands,codes,text}}
/* zona recortada (só a linha do ID): várias leituras com tamanhos e nitidez diferentes, e votação */
function lineCanvas(bm,Ht,soft){const s=Ht/bm.height;const w=Math.max(8,Math.round(bm.width*s));const cv=document.createElement("canvas");cv.width=w;cv.height=Ht;
 const cx=cv.getContext("2d",{willReadFrequently:true});cx.fillStyle="#fff";cx.fillRect(0,0,w,Ht);cx.imageSmoothingQuality="high";
 if(soft>1){const t=document.createElement("canvas");t.width=Math.max(4,Math.round(w/soft));t.height=Math.max(4,Math.round(Ht/soft));t.getContext("2d").drawImage(bm,0,0,t.width,t.height);cx.drawImage(t,0,0,w,Ht)}else cx.drawImage(bm,0,0,w,Ht);
 const im=cx.getImageData(0,0,w,Ht),d=im.data;const g=new Uint8ClampedArray(d.length/4);const hist=new Array(256).fill(0);
 for(let i=0,j=0;i<d.length;i+=4,j++){const v=(d[i]*.299+d[i+1]*.587+d[i+2]*.114)|0;g[j]=v;hist[v]++}
 let acc=0,lo=0,hi=255;const n=g.length;for(let v=0;v<256;v++){acc+=hist[v];if(acc>n*.01){lo=v;break}}acc=0;for(let v=255;v>=0;v--){acc+=hist[v];if(acc>n*.01){hi=v;break}}
 const span=Math.max(30,hi-lo);for(let i=0,j=0;i<d.length;i+=4,j++){const v=Math.max(0,Math.min(255,(g[j]-lo)*255/span));d[i]=d[i+1]=d[i+2]=v}
 cx.putImageData(im,0,0);return cv}
async function readCrop(blob,onStep){const first=await readOne(blob);if(first.cands.length&&first.cands[0].s>=9)return first;
 const w=await tess();const bm=await createImageBitmap(blob);const votes={};const add=(v,n)=>{votes[v]=(votes[v]||0)+n};let text=first.text,k=0;
 try{for(const Ht of[60,90,130])for(const soft of[1,2]){k++;onStep&&onStep(k,6);const cv=lineCanvas(bm,Ht,soft);
   if(soft===1)adaptiveBW(cv.getContext("2d",{willReadFrequently:true}),cv.width,cv.height,k%2?"lum":"g",.6,10);
   await w.setParameters({tessedit_pageseg_mode:"7",tessedit_char_whitelist:"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789: "});
   const t=((await w.recognize(cv)).data.text||"").toUpperCase();text+="\n"+t;
   for(const m of t.matchAll(/[I1L|]?[D0O]?\s*[:;.]\s*([0-9A-Z]{5,10})(?![0-9A-Z])/g)){const v=hexFixId(m[1]);if(/^[0-9A-F]+$/.test(v))add(v,2)}
   await w.setParameters({tessedit_char_whitelist:"0123456789ABCDEF"});
   let h=((await w.recognize(cv)).data.text||"").replace(/\s/g,"").toUpperCase();h=h.replace(/^1?D(?=[0-9A-F]{6})/,"");if(h.length>=5&&h.length<=10)add(h,1)}}
 finally{await w.setParameters(T_NORMAL).catch(()=>{})}
 // consenso letra a letra entre as leituras do comprimento mais frequente (6 ou mais)
 const byLen={};for(const[v,n]of Object.entries(votes))if(v.length>=6)byLen[v.length]=(byLen[v.length]||0)+n;
 const ml=+(Object.entries(byLen).sort((a,b)=>b[1]-a[1])[0]||[0])[0];
 if(ml){let cons="";for(let i=0;i<ml;i++){const c={};for(const[v,n]of Object.entries(votes))if(v.length===ml)c[v[i]]=(c[v[i]]||0)+n;cons+=Object.entries(c).sort((a,b)=>b[1]-a[1])[0][0]}add(cons,1)}
 const ranked=Object.entries(votes).map(([v,n])=>({v,n:n*(v.length>=6&&v.length<=8?2:1)})).sort((a,b)=>b.n-a.n);
 const cands=[...first.cands];ranked.slice(0,5).forEach((r,i)=>{const strong=i===0&&r.n>=6&&(!ranked[1]||r.n>=ranked[1].n*1.5);if(!cands.some(c=>c.v===r.v))cands.push({k:"id",v:r.v,s:strong?8:6-i*.5})});
 cands.sort((a,b)=>b.s-a.s);return{cands:cands.slice(0,6),codes:first.codes,text}}

/* leitura com IA (Google Gemini, plano gratuito) — opcional, só com rede */
const READ_PROMPT=`As imagens são fotografias da etiqueta ou placa de UM equipamento técnico instalado numa obra (podem ser fotografias de um ecrã, estar rodadas, de lado ou de pernas para o ar, e ter fundo verde de placa eletrónica). Copia apenas o identificador do equipamento.

Responde só com um objeto JSON neste formato:
{"id":string|null,"mac":string|null,"confianca":"alta"|"media"|"baixa","obs":string|null}

Regras:
- Copia os caracteres exatamente como estão impressos. Não inventes nem completes caracteres ilegíveis: se não tens a certeza, devolve null e explica em "obs". Atenção a confusões 0/O, 1/I, 5/S, 8/B, E/F.
- "id": o identificador único do dispositivo, marcado "ID", "ID:", "ID-Nr.", "ID No." ou "Device ID" (devolve só o valor, sem o prefixo). Pode vir colado a outro código sem espaço: em "25/51ID:8B281B" o id é "8B281B". Muitos equipamentos mostram o ID sem prefixo: um código curto alfanumérico isolado (tipicamente 6 a 8 caracteres hexadecimais, ex.: 4EB655, 7D5F23, 95F4528), muitas vezes ao lado de um DataMatrix ou QR; nesse caso esse código é o id.
- Não confundas o id com modelos, números de série, certificações (VdS G…, 0786-CPR-…, EN 54-…), datas, lotes ou referências de encomenda.
- "mac": só se a etiqueta tiver um endereço MAC (12 dígitos hexadecimais); formato AA:BB:CC:DD:EE:FF. Caso contrário null.
- Se aparecerem vários equipamentos, lê só o que está em primeiro plano ou na mão. Ignora texto da câmara (data, hora, coordenadas GPS).
- "obs": uma frase curta em português só se houver algo a confirmar.`;
function aiCfg(){const a=L.meta&&L.meta.ai;return a&&a.key?a:null}
const AI_MODELS=["gemini-2.5-flash","gemini-flash-latest","gemini-2.0-flash"];
async function aiRead(blobs,cfg){const ai=cfg||aiCfg();if(!ai||!navigator.onLine)return null;
 const parts=[{text:READ_PROMPT}];for(const b of blobs.slice(-2)){const sm=await shrink(b,2400,.92);parts.push({inline_data:{mime_type:"image/jpeg",data:(await blobToDataUrl(sm)).split(",")[1]}})}
 let lastErr=null;
 for(const m of[...new Set([ai.model||AI_MODELS[0],...AI_MODELS])]){const ctl=new AbortController();const tm=setTimeout(()=>ctl.abort(),35000);
  try{const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(ai.key)}`,
    {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{role:"user",parts}],generationConfig:{temperature:0,responseMimeType:"application/json"}}),signal:ctl.signal});
   const j=await r.json().catch(()=>({}));
   if(r.status===404){lastErr=new Error("modelo de IA indisponível");continue}
   if(!r.ok)throw new Error(r.status===429?"limite gratuito da IA atingido por agora":(r.status===400||r.status===403)&&/key|API_KEY|permission/i.test(JSON.stringify(j))?"chave da IA inválida ou sem permissão":(j.error&&j.error.message)||"erro "+r.status);
   const txt=((((j.candidates||[])[0]||{}).content||{}).parts||[]).map(p=>p.text||"").join("").replace(/^\s*```(?:json)?|```\s*$/g,"").trim();
   if(!txt)throw new Error("a IA não devolveu resposta");const o=JSON.parse(txt);o.model=m;return o}
  catch(e){lastErr=e.name==="AbortError"?new Error("a IA demorou demasiado a responder"):e;break}finally{clearTimeout(tm)}}
 throw lastErr||new Error("IA indisponível")}
/* recortar a zona do ID numa foto já guardada e ler só essa zona */
async function cropFromPhoto(id){const it=S.items.find(i=>i.id===id);const ref=it&&(it.photos||[]).slice(-1)[0];if(!ref){toast("Tira primeiro uma foto da etiqueta.");return}
 try{const b=await blobOf(ref);const bm=await createImageBitmap(b);const cv=document.createElement("canvas");cv.width=bm.width;cv.height=bm.height;cv.getContext("2d").drawImage(bm,0,0);openCrop(cv,id,"read")}
 catch(e){toast("A foto não está disponível neste aparelho.")}}
function normMac(v){const h=String(v||"").replace(/[^0-9a-f]/gi,"").toUpperCase();return h.length===12?h.match(/../g).join(":"):String(v||"").trim()}
function dupes(it){const out=[];for(const o of S.items){if(o.id===it.id)continue;
 if(it.devId&&o.devId&&String(o.devId).toUpperCase()===String(it.devId).toUpperCase())out.push(`ID ${it.devId} já usado em ${o.code}`);
 if(it.mac&&o.mac&&normMac(o.mac)===normMac(it.mac))out.push(`MAC ${it.mac} já usado em ${o.code}`)}return out}
function setReadMsgFor(id,t,cls,action){readMsg=t?{id,t,cls,action}:null;const it=cur();if(it)renderReadMsg(it)}
function renderReadMsg(it){const h=$("readMsg");if(!h)return;let m=readMsg&&readMsg.id===it.id?readMsg:null;
 if(!m){const d=dupes(it);if(d.length){const o=findDup(it.id,"devId",it.devId||"")||findDup(it.id,"mac",it.mac||"");const fld=findDup(it.id,"devId",it.devId||"")?"devId":"mac";
  m={t:"Repetido: "+d.join("; ")+". Confirma a etiqueta.",cls:"err",action:o&&S.canWrite?{label:"Comparar e escolher a qual pertence",fn:()=>askDup(fld,it[fld],it.id,o.id)}:null}}else if(it.readNote)m={t:it.readNote,cls:it.readConf==="alta"?"ok":"warn"}}
 const alt=(it.readCands||[]).filter(c=>c.k==="id"?c.v!==String(it.devId||"").toUpperCase():c.v!==normMac(it.mac));
 const wantCrop=S.canWrite&&(it.photos||[]).length&&!(m&&m.cls==="busy")&&(it.readConf==="baixa"||it.readConf==="media"||alt.length||(!it.devId&&!it.mac&&it.readAt));
 if(!m&&!alt.length&&!wantCrop){h.innerHTML="";return}
 h.innerHTML=`<div class="msg ${m?m.cls||"":""}"></div>`;const el=h.firstChild;el.textContent=m?m.t:"";
 if(m&&m.action){const b=document.createElement("button");b.className="btn sm dark";b.style.cssText="margin-top:8px;display:block";b.textContent=m.action.label;b.onclick=m.action.fn;el.appendChild(b)}
 if(alt.length&&S.canWrite&&!(m&&m.cls==="busy")){const w=document.createElement("div");w.className="cands";w.innerHTML=`<span>${it.devId||it.mac?"Outras leituras:":"Escolhe o ID certo:"}</span>`;
  alt.forEach(c=>{const b=document.createElement("button");b.type="button";b.className="cand";b.textContent=(c.k==="mac"?"MAC ":"ID ")+c.v;b.title="Usar este valor";
   b.onclick=()=>{const fld=c.k==="mac"?"mac":"devId";const cur0=S.items.find(i=>i.id===it.id)||it;const patch={[fld]:c.v,readConf:"alta",readNote:`${c.k==="mac"?"MAC":"ID"} ${c.v} escolhido da leitura.`,updatedAt:now(),updatedBy:S.meId};
    logPatch(cur0,patch,(c.k==="mac"?"MAC: ":"ID: ")+c.v);api.update("items",it.id,patch);readMsg=null;const o=findDup(it.id,fld,c.v);if(o)toast(`${c.k==="mac"?"MAC":"ID"} ${c.v} repetido com ${o.code}. Ficou guardado e marcado a vermelho.`);sheetFor=null;render()};w.appendChild(b)});
  el.appendChild(w)}
 if(wantCrop){const b=document.createElement("button");b.type="button";b.className="btn sm";b.style.cssText="margin-top:8px;display:block";b.textContent="Recortar a zona do ID e ler de novo";b.onclick=()=>cropFromPhoto(it.id);el.appendChild(b)}}
/* fila de leitura: as fotos continuam a ser lidas em segundo plano, mesmo com a ficha fechada ou noutro piso.
   1.ª tentativa normal; se não chegar, 2.ª tentativa mais profunda (todas as fotos, todas as orientações em alta resolução).
   Se mesmo assim não houver certeza, o equipamento fica "Leitura inconclusiva" com as leituras possíveis para escolher. */
const RQ=[];let rqBusy=false;const rqFail={};
function readLabel(id,overwrite,blobsIn,opts){opts=opts||{};if(!S.items.some(i=>i.id===id))return;
 const user=!!(overwrite||opts.crop);const i=RQ.findIndex(x=>x.id===id);if(i>=0)RQ.splice(i,1);
 const o={id,overwrite,blobs:blobsIn,opts,pid:S.projectId};if(user)RQ.unshift(o);else RQ.push(o);
 if(rqBusy&&readingId!==id)setReadMsgFor(id,RQ.indexOf(o)>0?`Na fila de leitura (${RQ.indexOf(o)+1}.º)… podes fechar a ficha, a leitura continua.`:"A seguir: leitura desta etiqueta… podes fechar a ficha.","busy");
 bgBadge();runRQ()}
async function runRQ(){if(rqBusy)return;rqBusy=true;
 try{while(RQ.length){const o=RQ.shift();bgBadge();if(o.pid!==S.projectId||!S.items.some(i=>i.id===o.id))continue;
   const deepNext=!o.opts.deep&&!o.opts.crop;
   let r=await readLabelNow(o.id,o.overwrite,o.blobs,{...o.opts,willRetry:deepNext});
   if(r&&r.state==="retry"&&o.pid===S.projectId){bgBadge(o.id);r=await readLabelNow(o.id,o.overwrite,null,{...o.opts,deep:true})}
   if(r&&r.state==="erro")rqFail[o.id]=Date.now()}}
 finally{rqBusy=false;bgBadge()}}
/* estado da leitura de cada equipamento */
function readStateOf(it){const id=String(it.devId||"").trim().toUpperCase();
 if(id||String(it.mac||"").trim()){const R=refSet();return id&&R&&!R.has(id)?"fora":"ok"}
 if(!(it.photos||[]).length)return"";
 if(readingId===it.id||RQ.some(x=>x.id===it.id)||it.readState==="a_ler"&&!it.readAt)return"a_ler";
 return it.readAt?"inconclusivo":"pendente"}
const RS_N={ok:"Lido",fora:"Não consta da lista",a_ler:"A ler…",inconclusivo:"Inconclusivo",pendente:"Por ler"};
/* procura fotos que ainda não foram lidas (ex.: tiradas e fechadas sem ler) e põe-nas na fila */
function bgScan(){if(!S.canWrite||!S.projectId||!sampleFn)return;const t=Date.now();let n=0;
 for(const it of S.items){if(readStateOf(it)!=="pendente"||RQ.some(x=>x.id===it.id)||rqFail[it.id]&&t-rqFail[it.id]<6e5)continue;RQ.push({id:it.id,overwrite:false,blobs:null,opts:{},pid:S.projectId});n++}
 if(n){bgBadge();runRQ()}}
setInterval(()=>{if(document.visibilityState==="visible")bgScan()},45000);
function bgBadge(){let b=$("bgRead");if(!b){const s=$("syncBox");if(!s)return;b=document.createElement("button");b.type="button";b.id="bgRead";b.className="bgread";b.title="Leitura de etiquetas em segundo plano";s.after(b);b.onclick=()=>{if(S.projectId)go("ids")}}
 const n=RQ.length+(rqBusy?1:0);b.hidden=!n;b.innerHTML=`<i></i>A ler etiquetas${n>1?` · ${n}`:""}`}
async function readLabelNow(id,overwrite,blobsIn,opts){opts=opts||{};const it0=S.items.find(i=>i.id===id);if(!it0)return null;
 const refs=(it0.photos||[]).slice(opts.deep?-4:-sampleMax);if(!refs.length&&!blobsIn){setReadMsgFor(id,"Tira primeiro uma foto da etiqueta.","warn");return null}
 readingId=id;lastReadErr=null;const br=$("btnRead");if(br)br.disabled=true;setReadMsgFor(id,opts.deep?"Ainda sem certeza: a ler de novo com mais detalhe (todas as fotos e orientações)…":"A ler a etiqueta no aparelho…","busy");
 let aiErr=null;
 try{let blobs=blobsIn&&blobsIn.length?blobsIn.slice(opts.deep?-4:-sampleMax):[];
  if(!blobs.length)for(const r of refs){try{blobs.push(await bestBlobOf(r))}catch(e){}}
  if(!blobs.length)throw new Error("a foto não está disponível neste aparelho");
  let all=[],src="local",aiObs="";aiErr=null;
  if(aiCfg()&&navigator.onLine){setReadMsgFor(id,"A ler a etiqueta com IA…","busy");
   try{const o=await aiRead(blobs);if(o){src="ai";const val=v=>typeof v==="string"&&v.trim()&&!/^null$/i.test(v.trim())?v.trim().toUpperCase():"";
     const sc=o.confianca==="alta"?11:o.confianca==="baixa"?6:8.5;if(val(o.id))all.push({k:"id",v:val(o.id),s:sc});if(val(o.mac))all.push({k:"mac",v:normMac(val(o.mac)),s:sc});aiObs=typeof o.obs==="string"?o.obs.trim():""}}
   catch(e){aiErr=e.message||"erro"}}
  if(!all.length){src="local";
   if(!poolP)setReadMsgFor(id,navigator.onLine?"A preparar o leitor (só na primeira vez, pode demorar um pouco)…":"A preparar o leitor…","busy");
   // começa pela foto principal (a mais recente, em qualidade máxima); só lê as outras se esta não chegar
   const order=blobs.map((b,i)=>i).reverse();
   for(let n=0;n<order.length;n++){const k=order[n];if(n>0&&all.some(c=>c.k==="id"&&c.s>=10))break;const r=opts.crop?await readCrop(blobs[k],(a,n)=>setReadMsgFor(id,`A ler a zona recortada (${a} de ${n})…`,"busy"))
     :await readOne(blobs[k],(rot,ch)=>setReadMsgFor(id,`${opts.deep?"Leitura detalhada":"A ler a etiqueta"}${blobs.length>1?` (foto ${n+1} de ${blobs.length})`:""}${rot?` · a rodar ${rot}°`:""}${ch==="zoom"?" · a confirmar o código":""}…`,"busy"),opts.deep);
    for(const c of r.cands){const o=all.find(x=>x.k===c.k&&x.v===c.v);if(o)o.s=Math.max(o.s,c.s)+1;else all.push({...c})}}}
  all=refFix(all,id);all.sort((a,b)=>b.s-a.s);all=all.slice(0,6);
  const it=S.items.find(i=>i.id===id)||it0;
  const ids=all.filter(c=>c.k==="id"),macs=all.filter(c=>c.k==="mac");
  let bestId=ids[0]&&ids[0].s>=5?ids[0]:null;   // validação automática: fica o melhor candidato; os outros ficam para corrigir com um toque
  const RF=refSet();let incWhy="";
  if(bestId&&RF&&!RF.has(bestId.v)){incWhy=`li ${bestId.v}, mas não consta da lista de IDs do projeto`;bestId=null}
  else if(bestId&&!RF&&ids[1]&&ids[1].s>=5&&bestId.s-ids[1].s<1&&!bestId.v.startsWith(ids[1].v)&&!ids[1].v.startsWith(bestId.v)){incWhy=`há duas leituras possíveis (${ids[0].v} ou ${ids[1].v})`;bestId=null}
  const bestMac=macs[0]&&macs[0].s>=8?macs[0]:null;
  const patch={},filled=[];let dup=null;
  const got={devId:bestId?bestId.v:"",mac:!bestId&&bestMac?bestMac.v:""};
  if(bestId&&bestMac&&!it.mac)got.mac=bestMac.v;
  for(const[k,v]of Object.entries(got))if(v&&(overwrite||!it[k])){const o=findDup(it.id,k,v);if(o&&!dup)dup={field:k,value:v,other:o};patch[k]=v;filled.push(k)}
  const conf=bestId&&(bestId.s>=10||bestId.ref)||(!bestId&&bestMac)?"alta":"media";
  const txt=got.devId?"ID "+got.devId:got.mac?"MAC "+got.mac:"";
  patch.readCands=all.map(({k,v,s})=>({k,v,s}));patch.readAt=now();patch.readConf=txt?conf:"baixa";
  const by=src==="ai"?"Lido pela IA":"Lido no aparelho";
  const retry=!txt&&opts.willRetry;
  patch.readState=txt?"ok":retry?"a_ler":"inconclusivo";if(retry)delete patch.readAt;
  patch.readNote=txt?`${by}: ${txt}`+(bestId&&bestId.ref==="fix"?` (a foto dizia ${bestId.from}; corrigido pela lista de IDs)`:"")+(conf!=="alta"?". Se não estiver certo, toca na leitura correta abaixo ou escreve o ID.":bestId&&bestId.ref?" (confirmado pela lista de IDs).":" (validado automaticamente)."):retry?"Ainda sem certeza: vou ler de novo com mais detalhe…":incWhy?`Leitura inconclusiva: ${incWhy}. Escolhe abaixo o ID certo, ou escreve-o.`:all.length?"Leitura inconclusiva: não tenho a certeza de qual é o ID. Escolhe abaixo o valor certo, ou escreve-o.":opts.crop?"Não consegui ler a zona recortada. Escreve o ID, ou tira outra foto mais nítida.":"Leitura inconclusiva: não consegui ler o ID nas fotos. Recorta a zona do ID, tira outra foto mais perto e nítida, ou escreve o ID.";
  if(dup)patch.readNote=`${by}: ${dup.field==="mac"?"MAC":"ID"} ${dup.value}. Atenção: está repetido com ${dup.other.code}.`;
  if(src==="ai"&&aiObs)patch.readNote+=" "+aiObs;
  if(aiErr)patch.readNote+=` (Leitura com IA indisponível: ${aiErr}.)`;
  patch.updatedAt=now();patch.updatedBy=S.meId;
  if(patch.devId||patch.mac)logPatch(it,patch,"Lido da foto: "+(patch.devId?"ID "+patch.devId:"MAC "+patch.mac));
  if(!txt)lastReadErr="none";
  await api.update("items",id,patch);readMsg=null;
  if(dup)toast(`${dup.field==="mac"?"MAC":"ID"} ${dup.value} repetido com ${dup.other.code}. Ficou guardado e marcado a vermelho.`);
  if(S.sel===id){sheetFor=null;S.shTab="det";render();requestAnimationFrame(()=>requestAnimationFrame(()=>{filled.forEach(k=>{const el=$("ed_"+k);if(el)el.classList.add("auto")});
   if(!txt&&!retry){const el=$("ed_devId");if(el){el.focus();el.classList.add("need")}}}))}
  return{state:txt?"ok":retry?"retry":"inconclusivo"}
 }catch(e){lastReadErr="error";setReadMsgFor(id,(aiErr?`A leitura com IA falhou (${aiErr}) e o leitor do telemóvel também: `:"Não foi possível ler a etiqueta: ")+(e.message||"erro")+". Escreve o ID ou tenta mais tarde.","err");return{state:"erro"}}
 finally{readingId=null;const b2=$("btnRead");if(b2)b2.disabled=false}}
async function askPermission(){}

/* =========================================================
   ID ou MAC repetido: perguntar a qual equipamento pertence
   ========================================================= */
function findDup(selfId,field,v){const key=field==="mac"?normMac(v):String(v).trim().toUpperCase();if(!key)return null;
 return S.items.find(o=>o.id!==selfId&&o[field]&&(field==="mac"?normMac(o[field]):String(o[field]).trim().toUpperCase())===key)||null}
const dupQueue=[];let dupOpen=false;
function askDup(field,value,newId,otherId){dupQueue.push({field,value,newId,otherId});if(!dupOpen)nextDup()}
function nextDup(){const q=dupQueue.shift();if(!q){dupOpen=false;return}dupOpen=true;
 const a=S.items.find(i=>i.id===q.newId),b=S.items.find(i=>i.id===q.otherId);if(!a||!b){nextDup();return}
 const lab=q.field==="mac"?"MAC":"ID";const pn=id=>(S.plans.find(p=>p.id===id)||{}).name||"";
 $("dupTitle").textContent=`${lab} repetido: ${q.value}`;
 $("dupText").textContent=`O ${lab} ${q.value} foi encontrado em dois equipamentos. Compara as fotos e escolhe a qual pertence; o outro fica sem ${lab} para corrigires.`;
 const card=(it,isNew)=>{const ph=(it.photos||[]).slice(-1)[0];return`<div class="dupcard${isNew?" new":""}">
   ${ph?`<img data-ref="${esc(ph)}" alt="Foto de ${esc(it.code)}">`:`<div class="nophoto">Sem foto</div>`}
   <div><b>${esc(it.code)}</b>${isNew?" <small>(este equipamento)</small>":""}<br><small>${esc(pn(it.planId))}${it.x==null?" · por colocar":""} · ${esc(tOf(it.type).n)}</small></div>
   <button class="btn ${isNew?"primary":""}" data-keep="${esc(it.id)}">O ${lab} é deste</button></div>`};
 $("dupGrid").innerHTML=card(a,true)+card(b,false);hydrate($("dupGrid"));
 $("dupGrid").querySelectorAll("[data-keep]").forEach(btn=>btn.onclick=async()=>{const keep=btn.dataset.keep,drop=keep===a.id?b:a,kept=keep===a.id?a:b;
  $("dlgDup").close();
  await api.update("items",kept.id,logPatch(kept,{[q.field]:q.value,readNote:`${lab} ${q.value} confirmado (estava repetido com ${drop.code}).`,readConf:"alta",updatedAt:now(),updatedBy:S.meId},`${lab} ${q.value} confirmado (repetido com ${drop.code})`));
  await api.update("items",drop.id,logPatch(drop,{[q.field]:"",readNote:`${lab} ${q.value} pertence a ${kept.code}. Verifica a etiqueta deste equipamento e lê de novo.`,readConf:"baixa",updatedAt:now(),updatedBy:S.meId},`${lab} ${q.value} retirado (pertence a ${kept.code})`));
  sheetFor=null;toast(`${lab} ${q.value} ficou em ${kept.code}.`);nextDup()});
 $("dupCancel").onclick=async()=>{$("dlgDup").close();
  await api.update("items",a.id,{[q.field]:"",readNote:`${lab} ${q.value} já existe em ${b.code}. Não foi guardado: verifica qual está certo.`,readConf:"baixa",updatedAt:now(),updatedBy:S.meId});sheetFor=null;nextDup()};
 $("dlgDup").showModal()}
$("dlgDup").addEventListener("cancel",e=>e.preventDefault());

/* =========================================================
   Importação em lote (fotos do Fieldwire, galeria…)
   ========================================================= */
let bulkRunning=false;
function taskFromName(name){const n=String(name).replace(/\.[^.]+$/,"");
 if(/^(img|dsc|dscn|pxl|photo|foto|whatsapp|screenshot|captura|image)[\s_-]?/i.test(n)&&!/(tarefa|task|^t\d|#)/i.test(n))return"";
 const m=n.match(/(?:^|[^a-z0-9])(?:tarefa|task|tsk|t|#)[\s_.-]*(\d{1,5})(?!\d)/i)||n.match(/^#?(\d{1,5})(?=[\s_.-]|$)/);return m?String(+m[1]):""}
function bulkMsg(t,cls,action){const m=$("bulkNote");m.hidden=!t;m.className="msg "+(cls||"");m.textContent=t||"";
 if(action){const b=document.createElement("button");b.className="btn sm dark";b.style.cssText="margin-top:8px;display:block";b.textContent=action.label;b.onclick=action.fn;m.appendChild(b)}}
$("bulkIn").onchange=async e=>{const files=[...e.target.files];e.target.value="";if(!files.length||bulkRunning||!S.planId)return;
 bulkRunning=true;const created=[],blobsById={};
 for(let k=0;k<files.length;k++){const f=files[k];bulkMsg(`A enviar fotos: ${k+1} de ${files.length}…`,"busy");
  try{const b=await shrink(f);const ref=await putFile(b,"image/jpeg");const id=uid();
   await api.set("items",id,{log:[{at:now(),by:S.meId,t:"Criado (importação de fotos)"}],planId:S.planId,code:nextCode("EQ"),type:"EQ",stage:"instalado",stageLog:{instalado:{by:S.meId,at:now()}},checks:{},x:null,y:null,
    devId:"",mac:"",maker:"",model:"",serial:"",taskNo:taskFromName(f.name),note:"Foto: "+f.name,photos:[ref],createdBy:S.meId,createdAt:now(),updatedAt:now(),updatedBy:S.meId});
   created.push(id);blobsById[id]=b}catch(err){toast(f.name+": "+err.message)}}
 bulkRunning=false;S.filter="unplaced";render();runRead(created,blobsById)};
async function runRead(ids,blobsById){if(!sampleFn){finishBulk(ids,0,ids.length);return}
 bulkRunning=true;let ok=0,fail=0;
 for(let k=0;k<ids.length;k++){bulkMsg(`A ler etiquetas: ${k+1} de ${ids.length}…`,"busy");await readLabel(ids[k],false,blobsById&&blobsById[ids[k]]?[blobsById[ids[k]]]:null);
  if(lastReadErr==="not_granted"){bulkRunning=false;const rest=ids.slice(k);bulkMsg(`Leitura parada: falta autorização. ${rest.length} fotos por ler.`,"err",{label:"Autorizar e continuar",fn:async()=>{await askPermission();bulkMsg("");runRead(rest,blobsById)}});return}
  lastReadErr?fail++:ok++}
 bulkRunning=false;finishBulk(ids,ok,fail)}
function finishBulk(ids,ok,fail){const its=ids.map(i=>S.items.find(x=>x.id===i)).filter(Boolean);const d=its.filter(i=>dupes(i).length).length,noTask=its.filter(i=>!i.taskNo).length;
 bulkMsg(`${ok} etiquetas lidas`+(fail?`, ${fail} por ler`:"")+(d?`, ${d} com ID ou MAC repetido`:"")+(noTask?`, ${noTask} sem nº de tarefa no nome da foto`:"")+`. Agora coloca cada equipamento: escolhe-o em "Por colocar" e toca no sítio dele na planta.`,fail||d||noTask?"warn":"ok");
 if(its[0])select(its[0].id)}

/* =========================================================
   Pisos: carregar, substituir, renomear, apagar
   ========================================================= */
let replacing=null;
$("btnFloor").onclick=()=>{const p=plan();$("flName").value=p?p.name:"";$("flName").disabled=!p;$("flReplace").hidden=!p;$("flDel").hidden=!p||!S.isCoord;$("flDel").classList.remove("armed");$("flDel").textContent="Apagar piso";flDelArmed=false;$("dlgFloor").showModal()};
$("flClose").onclick=()=>{const p=plan(),v=$("flName").value.trim();if(p&&v&&v!==p.name)api.update("plans",p.id,{name:v});$("dlgFloor").close()};
$("flAdd").onclick=()=>{replacing=null};
$("flReplace").onclick=()=>{replacing=S.planId;$("dlgFloor").close();$("planIn").click()};
let flDelArmed=false;
$("flDel").onclick=async()=>{const p=plan();if(!p)return;if(!flDelArmed){flDelArmed=true;$("flDel").classList.add("armed");$("flDel").textContent=`Confirmar: apagar ${p.name} e ${planItems().length} equipamentos`;return}
 $("dlgFloor").close();const its=planItems(),iss=S.issues.filter(x=>x.planId===p.id);S.planId=null;S.sel=null;
 for(const i of its)await api.del("items",i.id);for(const x of iss)await api.del("issues",x.id);await api.del("plans",p.id);toast("Piso apagado");pickPlan();render()};
/* nomes: "OBRA - PISO.pdf" → obra + piso; o nome da obra não se repete em cada piso */
function cleanName(t){return String(t).replace(/\.[^.]+$/,"").replace(/_+/g," ").replace(/\s+/g," ").trim()}
function splitName(fname){const base=cleanName(fname);const ob=(S.meta.name||"").trim();
 if(ob&&base.toLowerCase().startsWith(ob.toLowerCase())){const rest=base.slice(ob.length).replace(/^[\s\-–—_.:]+/,"").trim();return{obra:ob,floor:rest||base}}
 const parts=base.split(/\s+[-–—]\s+/);if(parts.length>=2)return{obra:parts.slice(0,-1).join(" - "),floor:parts[parts.length-1]};return{obra:"",floor:base}}
function setProjectName(v){if(!v||S.meta.name)return;S.meta={...S.meta,name:v};api.set("meta","project",{...S.meta})}
async function rasterPage(pg){const vp0=pg.getViewport({scale:1});const k=Math.min(4000/Math.max(vp0.width,vp0.height),Math.sqrt(14e6/(vp0.width*vp0.height)));const vp=pg.getViewport({scale:k});
 const cv=document.createElement("canvas");cv.width=Math.round(vp.width);cv.height=Math.round(vp.height);const cx=cv.getContext("2d");cx.fillStyle="#fff";cx.fillRect(0,0,cv.width,cv.height);
 await pg.render({canvasContext:cx,viewport:vp}).promise;return{blob:await new Promise(r=>cv.toBlob(r,"image/jpeg",.9)),w:cv.width,h:cv.height}}
$("planIn2").onchange=e=>{$("dlgFloor").close();$("planIn").onchange(e)};
$("planIn").onchange=async e=>{let files=[...e.target.files];e.target.value="";if(!files.length){replacing=null;return}
 const rep=replacing&&S.plans.some(p=>p.id===replacing)?replacing:null;if(rep)files=files.slice(0,1);
 const busy=$("busy");busy.hidden=false;let created=0,firstId=null,order=S.plans.length;const fail=[];
 try{for(let fi=0;fi<files.length;fi++){const f=files[fi];const tag=files.length>1?` (${fi+1}/${files.length})`:"";
   try{const nm=splitName(f.name);if(nm.obra)setProjectName(nm.obra);
    if(f.type==="application/pdf"||/\.pdf$/i.test(f.name)){
     if(!window.pdfjsLib)throw new Error("leitor de PDF indisponível");
     busy.textContent="A abrir "+cleanName(f.name)+tag+"…";
     const buf=await f.arrayBuffer();const doc=await openPdf(buf);const n=rep?1:Math.min(doc.numPages,60);
     let pdfRef=null;
     if(f.size<=50e6){busy.textContent="A guardar o PDF"+tag+"…";try{pdfRef=await putFile(new Blob([buf],{type:"application/pdf"}),"application/pdf");pdfCache[pdfRef]=Promise.resolve(doc)}catch(err){toast("PDF guardado só como imagem: "+err.message)}}
     else toast(cleanName(f.name)+": PDF com mais de 50 MB, fica guardado só como imagem.");
     for(let pn=1;pn<=n;pn++){busy.textContent=`A preparar ${n>1?"página "+pn+" de "+n:"a planta"}${tag}…`;
      const pg=await doc.getPage(pn);const r=await rasterPage(pg);busy.textContent="A enviar a planta"+tag+"…";const imgRef=await putFile(r.blob,"image/jpeg");
      const data={img:imgRef,pdf:pdfRef,page:pn,w:r.w,h:r.h};
      if(rep){await api.update("plans",rep,data);created++;firstId=rep}
      else{const id=uid();await api.set("plans",id,{name:n>1?`${nm.floor} – pág. ${pn}`:nm.floor,order:order++,assignees:[],folder:uploadFolder||null,createdAt:now(),...data});created++;firstId=firstId||id}}
    }else{busy.textContent="A preparar "+cleanName(f.name)+tag+"…";
     const im=new Image();const u=URL.createObjectURL(f);await new Promise((res,rej)=>{im.onload=res;im.onerror=()=>rej(new Error("imagem inválida"));im.src=u});
     let w=im.naturalWidth,h=im.naturalHeight;URL.revokeObjectURL(u);const raster=(f.size>15e6||!/^image\/(png|jpeg|webp|gif)$/.test(f.type))?await shrink(f,6000,.9):f;
     if(raster!==f){const t=await createImageBitmap(raster);w=t.width;h=t.height}
     busy.textContent="A enviar a planta"+tag+"…";const imgRef=await putFile(raster,raster.type||"image/jpeg");const data={img:imgRef,pdf:null,page:1,w,h};
     if(rep){await api.update("plans",rep,data);created++;firstId=rep}
     else{const id=uid();await api.set("plans",id,{name:nm.floor,order:order++,assignees:[],folder:uploadFolder||null,createdAt:now(),...data});created++;firstId=firstId||id}}
   }catch(err){fail.push(cleanName(f.name)+": "+err.message)}}
  if(firstId){S.planId=firstId;S.sel=null;loadedPlan=null}
  if(rep&&created)toast("Planta substituída. Os marcadores mantêm a posição.");
  else if(created)toast(created>1?`${created} pisos criados na obra. Escolhe o piso na lista do topo.`:"Piso criado. Escolhe Marcar equipamento para começar.");
  if(fail.length)toast("Não foi possível usar: "+fail.join("; "));
  render()}
 finally{replacing=null;uploadFolder=null;busy.hidden=true}};

/* =========================================================
   Gestão: técnicos, fiscalização, resumo do dia, fecho de piso
   ========================================================= */
function techSection(){const ids=[...new Set(S.items.map(i=>i.assignee).filter(Boolean))];const td=today();
 const rows=ids.map(id=>{const its=S.items.filter(i=>i.assignee===id);const todo=its.filter(isTodo).length,late=its.filter(isLate).length,done=its.filter(i=>sIdx(i.stage)>=3).length;
  const act=S.items.reduce((n,i)=>n+(i.log||[]).filter(e=>e.by===id&&dayOf(e.at)===td).length,0);
  return`<tr><td>${personChip(id)}</td><td class="num">${its.length}</td><td class="num">${todo}</td><td class="num" style="${late?"color:var(--warn);font-weight:600":""}">${late||""}</td><td class="num">${done}</td><td class="num">${act||""}</td></tr>`}).join("");
 return`<section class="block"><h2>Técnicos</h2>
  <div class="tbl"><table><thead><tr><th>Técnico</th><th class="num">Atribuídos</th><th class="num">Por fazer</th><th class="num">Em atraso</th><th class="num">Testados</th><th class="num">Ações hoje</th></tr></thead><tbody>
  ${rows||`<tr><td colspan="6" class="muted">Ainda não há equipamentos atribuídos. No separador Obra usa <b>Selecionar vários</b> → <b>Atribuir a técnico</b>, ou escolhe o responsável na ficha de cada equipamento.</td></tr>`}</tbody></table></div>
 </section>`}
let dayPick=null;
function dayStats(d){const ev=[];for(const it of S.items)for(const e of it.log||[])if(dayOf(e.at)===d)ev.push({...e,it});
 const st=k=>ev.filter(e=>e.t==="Etapa: "+sOf(k).n).length;
 const issNew=S.issues.filter(x=>dayOf(x.createdAt)===d),issRes=S.issues.filter(x=>dayOf(x.resolvedAt)===d);
 const ids=ev.filter(e=>/^Lido da foto|^ID: /.test(e.t)).length;const people={};ev.forEach(e=>{people[e.by]=(people[e.by]||0)+1});
 return{ev,st,issNew,issRes,ids,people}}
function daySection(){const d=dayPick||today();const x=dayStats(d);
 return`<section class="block"><h2><span>Resumo do dia</span><span style="display:flex;gap:8px;align-items:center;font-family:var(--f-body);font-size:13px;text-transform:none;letter-spacing:0"><input type="date" id="dayPick" value="${d}" style="border:1px solid var(--line);border-radius:6px;padding:5px 8px;background:var(--panel)"><button class="btn sm" id="dayCopy">Copiar resumo</button></span></h2>
  <div class="daygrid">${["instalado","enderecado","testado","validado","aceite"].map(k=>`<div class="tile"><span>${sOf(k).n}s</span><b>${x.st(k)}</b></div>`).join("")}
   <div class="tile"><span>IDs registados</span><b>${x.ids}</b></div><div class="tile${x.issNew.length?" bad":""}"><span>Anomalias novas</span><b>${x.issNew.length}</b></div><div class="tile"><span>Anomalias resolvidas</span><b>${x.issRes.length}</b></div></div>
  ${x.ev.length?`<div class="tbl"><table><thead><tr><th>Hora</th><th>Quem</th><th>Equipamento</th><th>Piso</th><th>O quê</th></tr></thead><tbody>
   ${x.ev.sort((a,b)=>String(b.at).localeCompare(String(a.at))).slice(0,60).map(e=>`<tr><td class="mono">${new Date(e.at).toLocaleTimeString("pt-PT",{hour:"2-digit",minute:"2-digit"})}</td><td>${esc(nameOf(e.by))}</td><td class="mono"><button class="btn sm" data-goto="${esc(e.it.id)}">${esc(e.it.code)}</button></td><td>${esc((S.plans.find(p=>p.id===e.it.planId)||{}).name||"")}</td><td>${esc(logText(e))}</td></tr>`).join("")}
  </tbody></table></div>`:`<p class="muted" style="margin:0">Sem atividade registada neste dia.</p>`}
 </section>`}
function dayText(d){const x=dayStats(d);const lines=[`Resumo do dia ${fmtDay(d)}/${d.slice(0,4)} – ${S.meta.name||"Obra"}`,""];
 for(const k of["instalado","enderecado","testado","validado","aceite"])lines.push(`${sOf(k).n}s: ${x.st(k)}`);
 lines.push(`IDs registados: ${x.ids}`,`Anomalias novas: ${x.issNew.length}`,`Anomalias resolvidas: ${x.issRes.length}`,"");
 const c=counts(S.items);lines.push(`Progresso total: ${c.ge(1)}/${c.total} instalados, ${c.ge(3)}/${c.total} testados, ${c.ge(4)}/${c.total} validados, ${c.aceite}/${c.total} aceites.`);
 if(x.issNew.length){lines.push("","Anomalias novas:");x.issNew.forEach(i=>{const it=S.items.find(q=>q.id===i.itemId);lines.push(`- ${it?it.code:"?"}: ${i.text}`)})}
 const pp=Object.entries(x.people);if(pp.length){lines.push("","Por pessoa:");pp.forEach(([id,n])=>lines.push(`- ${nameOf(id)}: ${n} ações`))}
 return lines.join("\n")}
function wireCoordExtras(W){const dp=$("dayPick");if(dp)dp.onchange=()=>{dayPick=dp.value;render()};
 const dc=$("dayCopy");if(dc)dc.onclick=()=>{const t=dayText(dayPick||today());navigator.clipboard.writeText(t).then(()=>toast("Resumo copiado")).catch(()=>toast("Não foi possível copiar nesta vista."))};
}


/* fecho por piso */
const CLOSE_MANUAL=["Etiquetas de identificação colocadas em todos os equipamentos","Planta com IDs verificada em obra","Fichas técnicas e certificados entregues","Sistema explicado à fiscalização / cliente"];
const FLOOR_ST={aberto:"Em curso",fecho:"Em fecho",entregue:"Entregue"};
function floorPill(p){const st=(p.close&&p.close.status)||"aberto";return`<span class="pill fl ${st}">${FLOOR_ST[st]}</span>`}
function closeAuto(p){const its=S.items.filter(i=>i.planId===p.id),oi=S.issues.filter(x=>x.planId===p.id&&x.status!=="resolvida").length;const n=its.length;
 const un=its.filter(i=>i.x==null).length,noid=its.filter(i=>!i.devId&&!i.mac).length,nt=its.filter(i=>sIdx(i.stage)<3).length,nv=its.filter(i=>sIdx(i.stage)<4).length,na=its.filter(i=>i.stage!=="aceite").length;
 return[[n>0,"Há equipamentos registados",`${n}`],[un===0,"Todos colocados na planta",un?`${un} por colocar`:""],[noid===0,"Todos com ID ou MAC",noid?`${noid} sem ID`:""],
  [nt===0,"Todos testados",nt?`${nt} por testar`:""],[oi===0,"Sem anomalias abertas",oi?`${oi} abertas`:""],[!its.some(isDup),"Sem IDs ou MAC repetidos",its.filter(isDup).length?`${its.filter(isDup).length} repetidos`:""],[nv===0,"Todos validados pela coordenação",nv?`${nv} por validar`:""],[na===0,"Todos aceites pela fiscalização / cliente",na?`${na} por aceitar`:""]]}
let closeFor=null,closeArmed=false;
function openClose(pid){closeFor=pid;closeArmed=false;drawClose();$("dlgClose").showModal()}
function drawClose(){const p=S.plans.find(x=>x.id===closeFor);if(!p)return;const cl=p.close||{};const st=cl.status||"aberto";const auto=closeAuto(p);const allOk=auto.every(a=>a[0]);
 const canEdit=S.isCoord||(S.canWrite&&st!=="entregue");
 $("clTitle").textContent="Fecho do piso: "+p.name;
 $("clBody").innerHTML=`<div>${floorPill(p)}${cl.at&&st==="entregue"?` <span class="muted" style="font-size:12px">entregue ${fmtDate(cl.at)} por ${esc(nameOf(cl.by))}</span>`:""}</div>
  <div class="sec"><h4 style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted)">Verificações automáticas</h4><div class="cklist">${auto.map(a=>`<div class="ck"><span class="${a[0]?"ok":"no"}">${a[0]?"✓":"✗"}</span><span>${esc(a[1])}${a[2]&&!a[0]?` <span class="muted">(${esc(a[2])})</span>`:""}</span></div>`).join("")}</div></div>
  <div class="sec"><h4 style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted)">Verificações em obra</h4><div class="cklist">${CLOSE_MANUAL.map((t,k)=>`<label><input type="checkbox" data-cm="${k}"${cl.checks&&cl.checks[k]?" checked":""}${canEdit?"":" disabled"}><span>${esc(t)}</span></label>`).join("")}</div></div>
  <label class="f">Observações para o auto de entrega<textarea id="clNotes" rows="3"${canEdit?"":" readonly"}>${esc(cl.notes||"")}</textarea></label>`;
 $("clBody").querySelectorAll("[data-cm]").forEach(cb=>cb.onchange=()=>api.update("plans",p.id,{close:{checks:{[cb.dataset.cm]:cb.checked},status:st==="aberto"?"fecho":st}}));
 const nt=$("clNotes");if(nt)nt.onchange=()=>api.update("plans",p.id,{close:{notes:nt.value}});
 $("clActs").innerHTML=`<button class="btn" id="clX">Fechar</button><button class="btn" id="clPdf">Gerar auto de entrega (PDF)</button>`+
  (S.isCoord?(st==="entregue"?`<button class="btn danger" id="clReopen">Reabrir piso</button>`:`<button class="btn primary${closeArmed?" danger armed":""}" id="clDone">${closeArmed?"Há pendentes: confirmar entrega na mesma":"Marcar piso como entregue"}</button>`):"");
 $("clX").onclick=()=>$("dlgClose").close();
 $("clPdf").onclick=()=>autoPdf(p);
 const dn=$("clDone");if(dn)dn.onclick=async()=>{if(!allOk&&!closeArmed){closeArmed=true;drawClose();return}
  await api.update("plans",p.id,{close:{status:"entregue",at:now(),by:S.meId}});toast("Piso marcado como entregue.");$("dlgClose").close()};
 const ro=$("clReopen");if(ro)ro.onclick=async()=>{await api.update("plans",p.id,{close:{status:"fecho"}});drawClose()}}
async function autoPdf(p){if(!window.jspdf){toast("Gerador de PDF indisponível nesta vista.");return}const btn=$("clPdf");btn.disabled=true;btn.textContent="A preparar…";
 try{const{jsPDF}=window.jspdf;const doc=new jsPDF({unit:"mm",format:"a4",compress:true});const M=15,W=doc.internal.pageSize.getWidth();let y=M+4;
  const its=S.items.filter(i=>i.planId===p.id).sort((a,b)=>String(a.code).localeCompare(String(b.code),"pt",{numeric:true}));const c=counts(its),cl=p.close||{};
  doc.setFont("helvetica","bold");doc.setFontSize(18);doc.text("Auto de entrega",M,y);y+=9;
  doc.setFont("helvetica","normal");doc.setFontSize(11);[["Obra",S.meta.name||"—"],["Piso / planta",p.name],["Data",new Date().toLocaleDateString("pt-PT")],["Estado",FLOOR_ST[cl.status||"aberto"]]].forEach(([k,v])=>{doc.setFont("helvetica","bold");doc.text(k+":",M,y);doc.setFont("helvetica","normal");doc.text(String(v),M+35,y);y+=6.5});
  y+=3;doc.setFont("helvetica","bold");doc.setFontSize(12);doc.text("Resumo dos equipamentos",M,y);y+=7;doc.setFontSize(10);doc.setFont("helvetica","normal");
  doc.text(`Total: ${c.total}   ·   Instalados: ${c.ge(1)}   ·   Testados: ${c.ge(3)}   ·   Validados: ${c.ge(4)}   ·   Aceites: ${c.aceite}`,M,y);y+=6;
  const bySys=TYPES.map(t=>[t.n,its.filter(i=>i.type===t.k).length]).filter(x=>x[1]);doc.text("Por sistema: "+bySys.map(x=>`${x[0]} ${x[1]}`).join("  ·  "),M,y,{maxWidth:W-2*M});y+=10;
  doc.setFont("helvetica","bold");doc.setFontSize(12);doc.text("Verificações",M,y);y+=7;doc.setFontSize(10);doc.setFont("helvetica","normal");
  for(const a of closeAuto(p)){doc.text(`[${a[0]?"X":" "}]  ${a[1]}${a[2]&&!a[0]?" ("+a[2]+")":""}`,M,y);y+=5.5}
  CLOSE_MANUAL.forEach((t,k)=>{doc.text(`[${cl.checks&&cl.checks[k]?"X":" "}]  ${t}`,M,y);y+=5.5});
  const oi=S.issues.filter(x=>x.planId===p.id&&x.status!=="resolvida");if(oi.length){y+=3;doc.setFont("helvetica","bold");doc.text("Anomalias em aberto",M,y);y+=6;doc.setFont("helvetica","normal");
   oi.slice(0,12).forEach(x=>{const it=S.items.find(q=>q.id===x.itemId);const t=`- ${it?it.code:"?"}: ${x.text}`;const ls=doc.splitTextToSize(t,W-2*M);doc.text(ls,M,y);y+=5*ls.length})}
  if(cl.notes){y+=3;doc.setFont("helvetica","bold");doc.text("Observações",M,y);y+=6;doc.setFont("helvetica","normal");const ls=doc.splitTextToSize(cl.notes,W-2*M);doc.text(ls,M,y);y+=5*ls.length}
  y=Math.max(y+12,232);const bw=(W-2*M-10)/3;["Empreiteiro","Fiscalização","Dono de obra"].forEach((t,k)=>{const x=M+k*(bw+5);doc.setDrawColor(150);doc.rect(x,y,bw,32);doc.setFontSize(9);doc.text(t,x+3,y+5);doc.text("Nome / assinatura / data",x+3,y+29)});
  btn.textContent="A desenhar a planta…";
  const cv=drawMarkers(await planCanvas(p),its.filter(i=>i.x!=null),"id","stage");
  doc.addPage("a3","landscape");const PW=doc.internal.pageSize.getWidth(),PH=doc.internal.pageSize.getHeight(),m=10;doc.setFont("helvetica","bold");doc.setFontSize(12);doc.text(`${p.name} · planta com identificação dos equipamentos`,m,m+4);
  const aw=PW-2*m,ah=PH-m-16,k=Math.min(aw/cv.width,ah/cv.height);doc.addImage(cv.toDataURL("image/jpeg",.9),"JPEG",m+(aw-cv.width*k)/2,m+8,cv.width*k,cv.height*k,undefined,"FAST");
  doc.addPage("a4","portrait");let yy=M;doc.setFontSize(12);doc.text("Lista de equipamentos",M,yy);yy+=8;const cols=[["Ref.",M],["ID",M+36],["MAC",M+64],["Tipo",M+104],["Etapa",M+144]];
  const head=()=>{doc.setFont("helvetica","bold");doc.setFontSize(9);cols.forEach(([t,x])=>doc.text(t,x,yy));yy+=2;doc.setDrawColor(180);doc.line(M,yy,W-M,yy);yy+=5;doc.setFont("helvetica","normal")};head();
  for(const it of its){if(yy>285){doc.addPage("a4","portrait");yy=M;head()}[it.code,it.devId||"",it.mac||"",tOf(it.type).n,sOf(it.stage).n].forEach((t,c2)=>doc.text(String(t).slice(0,26),cols[c2][1],yy));yy+=5.2}
  await saveBlob(`Auto_entrega_${(p.name||"piso").replace(/[^\p{L}\p{N}]+/gu,"_").slice(0,50)}_${today()}.pdf`,doc.output("blob"))}
 catch(e){toast("Não foi possível gerar o auto: "+(e.message||"erro"))}finally{btn.disabled=false;btn.textContent="Gerar auto de entrega (PDF)"}}

/* =========================================================
   Descarregar a planta com os IDs (PDF ou imagem em alta resolução)
   ========================================================= */
const STAGE_HEX={previsto:"#7d8883",instalado:"#2f63b0",enderecado:"#7a5cc0",testado:"#2f8a5b",validado:"#1d5c3c",aceite:"#0e7490"};
$("btnExp").onclick=()=>{const p=plan();if(!p)return;$("exPrev").hidden=true;$("exInfo").textContent=`${planItems().filter(i=>i.x!=null).length} equipamentos colocados neste piso. A planta é gerada com a melhor resolução disponível.`;
 $("exOvWrap").hidden=!p.ov;$("exWhich").querySelector('[value="picked"]').disabled=!(S.multi&&S.multi.size);$("dlgExp").showModal()};
$("exClose").onclick=()=>$("dlgExp").close();
async function planCanvas(p){// melhor resolução: redesenha o PDF; senão usa a imagem guardada
 const pg=await pdfPage(p).catch(()=>null);
 if(pg){const v0=pg.getViewport({scale:1});const k=Math.min(6000/Math.max(v0.width,v0.height),Math.sqrt(16e6/(v0.width*v0.height)));const vp=pg.getViewport({scale:k});
  const cv=document.createElement("canvas");cv.width=Math.round(vp.width);cv.height=Math.round(vp.height);const cx=cv.getContext("2d");cx.fillStyle="#fff";cx.fillRect(0,0,cv.width,cv.height);
  try{await pg.render({canvasContext:cx,viewport:vp}).promise;if(hasInk(cx))return cv}catch(e){}}
 const b=await blobOf(p.img);const bm=await createImageBitmap(b);const cv=document.createElement("canvas");cv.width=bm.width;cv.height=bm.height;const cx=cv.getContext("2d");cx.fillStyle="#fff";cx.fillRect(0,0,cv.width,cv.height);cx.drawImage(bm,0,0);return cv}
function exportItems(){const w=$("exWhich").value;let its=planItems().filter(i=>i.x!=null);
 if(w==="visible")its=its.filter(i=>inFilter(i)&&matchQ(i));if(w==="picked"&&S.multi)its=its.filter(i=>S.multi.has(i.id));
 return its.sort((a,b)=>String(a.code).localeCompare(String(b.code),"pt",{numeric:true}))}
function labelOf(it,mode){const id=it.devId||it.mac;return mode==="ref"?it.code:mode==="both"?(id?`${id} · ${it.code}`:it.code):(id||it.code)}
function pinPath(cx,x,y,h){const R=h*.36,cy=y-h+R;cx.beginPath();cx.moveTo(x,y);cx.bezierCurveTo(x-R*.3,y-R*.9,x-R,cy+R*.85,x-R,cy);cx.arc(x,cy,R,Math.PI,0);cx.bezierCurveTo(x+R,cy+R*.85,x+R*.3,y-R*.9,x,y);cx.closePath();return{R,cy}}
function drawMarkers(cv,its,mode,colorMode,noText){const cx=cv.getContext("2d"),W=cv.width,H=cv.height;const Lg=Math.max(W,H);
 const fs=Math.max(12,Math.round(Lg/260*(window.__lblScale||1))),ph=Math.round(fs*1.9),pad=Math.round(fs*.32);cx.font=`700 ${fs}px Consolas, "IBM Plex Mono", monospace`;cx.textBaseline="middle";
 const PR=ph*.36;const colOf=it=>colorMode==="one"?"#d9480f":(STAGE_HEX[it.stage]||STAGE_HEX.instalado);
 const pts=its.map(it=>{const x=it.x*W,y=it.y*H;return{it,x,y,hx:x,hy:y-ph+PR,t:labelOf(it,mode),col:colOf(it)}});
 const pins=pts.map(q=>({x0:q.x-PR-2,x1:q.x+PR+2,y0:q.y-ph-2,y1:q.y+1}));const boxes=[],lines=[];
 const hit=(a,b)=>a.x0<b.x1&&a.x1>b.x0&&a.y0<b.y1&&a.y1>b.y0;
 const segHit=(ax,ay,bx,by,cx2,cy2,dx,dy)=>{const o=(px,py,qx,qy,rx,ry)=>Math.sign((qx-px)*(ry-py)-(qy-py)*(rx-px));return o(ax,ay,bx,by,cx2,cy2)!==o(ax,ay,bx,by,dx,dy)&&o(cx2,cy2,dx,dy,ax,ay)!==o(cx2,cy2,dx,dy,bx,by)};
 const near=(b,x,y)=>[Math.max(b.x0,Math.min(x,b.x1)),Math.max(b.y0,Math.min(y,b.y1))];
 pts.forEach((q,k)=>{q.k=k;q.crowd=pts.filter(o=>Math.hypot(o.x-q.x,o.y-q.y)<fs*8).length});const order=pts.slice().sort((a,b)=>b.crowd-a.crowd);
 for(const q of order){const tw=cx.measureText(q.t).width+pad*2,th=fs+pad*1.3,g=PR+fs*.3;const C=[];
  for(const ring of[1,2.2,3.6,5.2])for(const[ax,ay]of[[1,0],[-1,0],[0,-1],[1,-1],[-1,-1],[0,1],[1,1],[-1,1]]){
   const dx=ax>0?g*ring:ax<0?-g*ring-tw:-tw/2,dy=ay>0?(ph-PR)+g*(ring-1)+fs*.2:ay<0?-g*ring-th:-th/2;C.push({dx,dy,ring})}
  let best=null,bs=1e18;
  for(const c of C){const b={x0:q.hx+c.dx,y0:q.hy+c.dy,x1:q.hx+c.dx+tw,y1:q.hy+c.dy+th};let sc=c.ring*4;
   for(const o of boxes)if(hit(b,o))sc+=100;for(let k=0;k<pins.length;k++)if(k!==q.k&&hit(b,pins[k]))sc+=40;if(hit(b,pins[q.k]))sc+=60;
   if(b.x0<0||b.y0<0||b.x1>W||b.y1>H)sc+=200;
   const[ex,ey]=near(b,q.hx,q.hy);for(const l of lines)if(segHit(q.hx,q.hy,ex,ey,l[0],l[1],l[2],l[3]))sc+=30;
   if(sc<bs){bs=sc;best=b}}
  q.box=best;boxes.push(best);const[ex,ey]=near(best,q.hx,q.hy);q.lx=ex;q.ly=ey;lines.push([q.hx,q.hy,ex,ey])}
 // 1) ligações, 2) etiquetas com a cor do pino, 3) pinos (ponta = posição exata)
 if(noText!=="layout"){
 for(const q of pts){cx.strokeStyle="#fff";cx.lineWidth=Math.max(3,fs/4);cx.beginPath();cx.moveTo(q.hx,q.hy);cx.lineTo(q.lx,q.ly);cx.stroke();
  cx.strokeStyle=q.col;cx.lineWidth=Math.max(1.5,fs/9);cx.beginPath();cx.moveTo(q.hx,q.hy);cx.lineTo(q.lx,q.ly);cx.stroke()}
 for(const q of pts){const b=q.box,rr=fs*.25,dp=isDup(q.it);cx.fillStyle=dp?"#c2402f":"#fff";cx.strokeStyle=dp?"#c2402f":q.col;cx.lineWidth=Math.max(2,fs/7);cx.beginPath();
  cx.roundRect?cx.roundRect(b.x0,b.y0,b.x1-b.x0,b.y1-b.y0,rr):cx.rect(b.x0,b.y0,b.x1-b.x0,b.y1-b.y0);cx.fill();cx.stroke();
  cx.fillStyle=dp?"#fff":"#111";if(!noText)cx.fillText(q.t,b.x0+pad,(b.y0+b.y1)/2+1)}
 for(const q of pts.slice().sort((a,b)=>a.y-b.y)){cx.save();cx.shadowColor="rgba(0,0,0,.35)";cx.shadowBlur=fs*.3;cx.shadowOffsetY=fs*.08;const{R,cy}=pinPath(cx,q.x,q.y,ph);cx.fillStyle=q.col;cx.fill();cx.restore();
  pinPath(cx,q.x,q.y,ph);cx.lineWidth=Math.max(1.5,fs/8);cx.strokeStyle="#fff";cx.stroke();
  cx.beginPath();cx.arc(q.x,cy,R*.42,0,7);cx.fillStyle=hasIssue(q.it)?"#c2402f":"#fff";cx.fill()}}
 cv._labels=pts.map(q=>({t:q.t,b:q.box,x:q.x,y:q.y,hx:q.hx,hy:q.hy,lx:q.lx,ly:q.ly,col:q.col,dup:isDup(q.it),iss:hasIssue(q.it)}));cv._mk={fs,pad,ph,PR,W,H};return cv}
$("exGo").onclick=async()=>{const p=plan();if(!p)return;const btn=$("exGo");btn.disabled=true;const fmt=$("exFmt").value,mode=$("exLbl").value,colorMode=$("exColor").value;
 try{const its=exportItems();if(!its.length&&!marksFor(p.id).length){toast("Não há equipamentos nem marcações para incluir.");return}
  btn.textContent="A desenhar a planta…";const base0=await planCanvas(p);if(p.ov&&$("exOv").value==="1")await drawOvOn(base0,p);const cv=drawMarkers(base0,its,mode,colorMode);
  const base=`Planta_${(p.name||"piso").replace(/[^\p{L}\p{N}]+/gu,"_").slice(0,50)}_${new Date().toISOString().slice(0,10)}`;
  btn.textContent="A preparar o ficheiro…";
  const prevUrl=await new Promise(r=>cv.toBlob(b=>r(URL.createObjectURL(b)),"image/jpeg",.7));$("exPrev").src=prevUrl;$("exPrev").hidden=false;
  let blob,name;
  if(fmt==="png"){blob=await new Promise(r=>cv.toBlob(r,"image/png"));name=base+".png"}
  else if(fmt==="jpg"){blob=await new Promise(r=>cv.toBlob(r,"image/jpeg",.92));name=base+".jpg"}
  else{if(!window.jspdf){toast("Gerador de PDF indisponível. Escolhe PNG ou JPG.");return}blob=await planPdf(p,cv,its,mode,fmt==="pdf");name=base+".pdf"}
  await saveBlob(name,blob)}
 catch(e){toast("Não foi possível gerar: "+(e.message||"erro"))}finally{btn.disabled=false;btn.textContent="Gerar e descarregar"}};
async function planPdf(p,cv,its,mode,withList){const{jsPDF}=window.jspdf;const land=cv.width>=cv.height;
 const doc=new jsPDF({orientation:land?"landscape":"portrait",unit:"mm",format:"a3",compress:true});const PW=doc.internal.pageSize.getWidth(),PH=doc.internal.pageSize.getHeight(),M=10;
 doc.setFont("helvetica","bold");doc.setFontSize(13);doc.text(`${S.meta.name?S.meta.name+" · ":""}${p.name}`,M,M+4);
 doc.setFont("helvetica","normal");doc.setFontSize(9);doc.setTextColor(90);doc.text(`${its.length} equipamentos · gerado em ${new Date().toLocaleString("pt-PT")}`,M,M+9);doc.setTextColor(0);
 const top=M+13,aw=PW-2*M,ah=PH-top-M,k=Math.min(aw/cv.width,ah/cv.height),iw=cv.width*k,ih=cv.height*k;
 doc.addImage(cv.toDataURL("image/jpeg",.92),"JPEG",M+(aw-iw)/2,top+(ah-ih)/2,iw,ih,undefined,"FAST");
 if(!withList)return doc.output("blob");
 // lista
 doc.addPage("a4","portrait");const W2=doc.internal.pageSize.getWidth(),H2=doc.internal.pageSize.getHeight();let y=M+6;
 const cols=[["Ref.",M],["ID",M+38],["MAC",M+68],["Tipo",M+108],["Etapa",M+148]];
 const head=()=>{doc.setFont("helvetica","bold");doc.setFontSize(9);cols.forEach(([t,x])=>doc.text(t,x,y));y+=2;doc.setDrawColor(180);doc.line(M,y,W2-M,y);y+=5;doc.setFont("helvetica","normal")};
 doc.setFont("helvetica","bold");doc.setFontSize(12);doc.text(`Lista de equipamentos · ${p.name}`,M,y);y+=8;head();
 for(const it of its){if(y>H2-M){doc.addPage("a4","portrait");y=M+6;head()}
  const row=[it.code,it.devId||"",it.mac||"",tOf(it.type).n,sOf(it.stage).n];doc.setFontSize(9);row.forEach((t,c)=>doc.text(String(t).slice(0,c===0?22:28),cols[c][1],y));y+=5.2}
 return doc.output("blob")}

/* =========================================================
   Edição em conjunto: nome (referência), tipo e etapa
   ========================================================= */
S.multi=null;
const BB={pre:"",start:1,dig:3,order:"pos",type:"IL",stage:"instalado",assignee:null,due:""};
$("multiBtn").onclick=()=>{S.multi=S.multi?null:new Set();if(S.multi){S.sel=null;S.moving=null}render()};
function toggleMulti(id){if(!S.multi)return;S.multi.has(id)?S.multi.delete(id):S.multi.add(id);render()}
function multiItems(){if(!S.multi)return[];return S.items.filter(i=>S.multi.has(i.id))}
function orderPicked(list){if(BB.order==="pos")return list.slice().sort((a,b)=>{const ay=a.y==null?9:Math.round(a.y*25),by=b.y==null?9:Math.round(b.y*25);return ay-by||(a.x??9)-(b.x??9)});
 return list.slice().sort(workOrder)}
function bbName(k){return BB.pre+String(BB.start+k).padStart(BB.dig,"0")}
function renderBulk(){const bar=$("bulkBar");if(!S.multi){bar.hidden=true;bar.dataset.k="";return}bar.hidden=false;
 const n=S.multi.size,picked=orderPicked(multiItems());
 const ex=n?`${esc(bbName(0))}${n>1?" … "+esc(bbName(n-1)):""}`:"seleciona primeiro os equipamentos";
 if(bar.contains(document.activeElement)&&bar.dataset.k){$("bbCount").textContent=`${n} selecionado${n===1?"":"s"}`;$("bbEx").innerHTML="Fica: "+ex;return}
 bar.dataset.k="1";
 bar.innerHTML=`<div class="bb-head"><b id="bbCount">${n} selecionado${n===1?"":"s"}</b>
   <button class="btn sm" id="bbAll">Selecionar os da lista</button><button class="btn sm" id="bbNone">Limpar</button><button class="btn sm dark" id="bbExit">Terminar</button></div>
  <p class="muted" style="margin:0;font-size:12px">Toca nos equipamentos na lista ou nas gotas da planta para os escolher.</p>
  <div class="bb-sec"><h4>Mudar o nome (referência)</h4>
   <div class="r3"><input id="bbPre" placeholder="Prefixo, ex.: BE-P11-" value="${esc(BB.pre)}" aria-label="Prefixo">
    <input id="bbStart" type="number" min="0" value="${BB.start}" aria-label="Começa em" title="Começa em">
    <select id="bbDig" aria-label="Dígitos">${[1,2,3,4].map(d=>`<option value="${d}"${d===BB.dig?" selected":""}>${"0".repeat(d-1)}1</option>`).join("")}</select></div>
   <select id="bbOrder" aria-label="Ordem da numeração"><option value="pos"${BB.order==="pos"?" selected":""}>Numerar pela posição na planta (cima → baixo, esquerda → direita)</option><option value="list"${BB.order==="list"?" selected":""}>Numerar pela ordem da lista</option></select>
   <span class="muted" style="font-size:12px" id="bbEx">Fica: ${ex}</span>
   <button class="btn primary sm" id="bbName" style="justify-self:start">Aplicar nomes</button></div>
  ${S.local?"":`<div class="bb-sec"><h4>Atribuir a técnico</h4><div id="bbPick"></div><div class="r2"><input type="date" id="bbDue" value="${esc(BB.due)}" aria-label="Prazo"><button class="btn sm" id="bbAssignGo">Atribuir</button></div></div>`}
  <div class="bb-sec"><h4>Mudar o tipo</h4><div class="r2"><select id="bbType">${TYPES.map(t=>`<option value="${t.k}"${t.k===BB.type?" selected":""}>${t.n}</option>`).join("")}</select><button class="btn sm" id="bbTypeGo">Aplicar tipo</button></div></div>
  <div class="bb-sec"><h4>Mudar a etapa</h4><div class="r2"><select id="bbStage">${STAGES.map(s2=>`<option value="${s2.k}"${s2.k===BB.stage?" selected":""}${!canStage(s2.k)?" disabled":""}>${s2.n}</option>`).join("")}</select><button class="btn sm" id="bbStageGo">Aplicar etapa</button></div></div>`;
 const upd=()=>{BB.pre=$("bbPre").value;BB.start=Math.max(0,parseInt($("bbStart").value)||0);BB.dig=+$("bbDig").value;BB.order=$("bbOrder").value;const n2=S.multi.size;$("bbEx").innerHTML="Fica: "+(n2?`${esc(bbName(0))}${n2>1?" … "+esc(bbName(n2-1)):""}`:"seleciona primeiro os equipamentos")};
 ["bbPre","bbStart","bbDig","bbOrder"].forEach(id=>{$(id).oninput=upd;$(id).onchange=upd});
 $("bbType").onchange=e=>{BB.type=e.target.value};$("bbStage").onchange=e=>{BB.stage=e.target.value};
 $("bbAll").onclick=()=>{planItems().filter(i=>inFilter(i)&&matchQ(i)).forEach(i=>S.multi.add(i.id));bar.dataset.k="";render()};
 $("bbNone").onclick=()=>{S.multi.clear();bar.dataset.k="";render()};
 $("bbExit").onclick=()=>{S.multi=null;render()};
 if($("bbPick")){mountPicker($("bbPick"),BB.assignee,id=>{BB.assignee=id},"Técnico responsável…");$("bbDue").onchange=e=>{BB.due=e.target.value};$("bbAssignGo").onclick=()=>bulkApply("assign")}
 $("bbName").onclick=()=>bulkApply("name");$("bbTypeGo").onclick=()=>bulkApply("type");$("bbStageGo").onclick=()=>bulkApply("stage")}
let bulkBusy=false;
async function bulkApply(kind){if(bulkBusy||!S.multi||!S.multi.size){if(S.multi&&!S.multi.size)toast("Seleciona primeiro os equipamentos.");return}
 const list=orderPicked(multiItems());
 if(kind==="name"){if(!BB.pre.trim()){toast("Escreve um prefixo para o nome, por exemplo BE-P11-.");$("bbPre").focus();return}
  const names=list.map((_,k)=>bbName(k));const others=new Set(S.items.filter(i=>!S.multi.has(i.id)).map(i=>String(i.code).toUpperCase()));
  const clash=names.find(n=>others.has(n.toUpperCase()));if(clash){toast(`O nome ${clash} já existe noutro equipamento. Muda o prefixo ou o número inicial.`);return}}
 if(kind==="stage"&&!canStage(BB.stage)){toast(lockMsg(BB.stage));return}
 if(kind==="assign"&&!BB.assignee&&!BB.due){toast("Escolhe um técnico ou um prazo.");return}
 bulkBusy=true;const btn=$(kind==="name"?"bbName":kind==="type"?"bbTypeGo":kind==="assign"?"bbAssignGo":"bbStageGo");if(btn)btn.disabled=true;let k=0;
 try{for(const it of list){k++;if(btn)btn.textContent=`A aplicar ${k}/${list.length}…`;
   const patch={updatedAt:now(),updatedBy:S.meId};
   if(kind==="name")patch.code=bbName(k-1);
   if(kind==="type"){patch.type=BB.type;if(new RegExp("^"+it.type+"-\\d{3}$").test(it.code)&&!BB.pre)patch.code=it.code.replace(it.type+"-",BB.type+"-")}
   if(kind==="stage"){patch.stage=BB.stage;if(sIdx(BB.stage)>sIdx(it.stage))patch.stageLog={[BB.stage]:{by:S.meId,at:now()}}}
   if(kind==="assign"){if(BB.assignee)patch.assignee=BB.assignee;if(BB.due)patch.due=BB.due}
   const lt=kind==="name"?"Referência: "+patch.code:kind==="type"?"Tipo: "+tOf(BB.type).n:kind==="stage"?"Etapa: "+sOf(BB.stage).n:(BB.assignee?"Atribuído a":"Prazo: "+fmtDay(BB.due));
   logPatch(it,patch,lt+(kind==="assign"&&BB.assignee&&BB.due?"":""),kind==="assign"&&BB.assignee?{u:BB.assignee}:null);
   if(kind==="assign"&&BB.assignee&&BB.due)patch.log[patch.log.length-1].t="Atribuído (prazo "+fmtDay(BB.due)+") a";
   await api.update("items",it.id,patch)}
  if(kind==="type")lastType=BB.type;
  toast(`${list.length} equipamento${list.length>1?"s":""} atualizado${list.length>1?"s":""}.`)}
 finally{bulkBusy=false;const bar=$("bulkBar");bar.dataset.k="";render()}}

/* =========================================================
   Sobrepor outro desenho (outro piso da obra ou ficheiro), alinhado à planta
   ========================================================= */
S.ovShow=true;S.ovOp=.75;S.ovTint="red";
const TINT={red:[205,35,35],blue:[25,85,215],green:[15,140,60]};
/* o branco do desenho fica transparente e as linhas ficam com a cor escolhida (ou a original) */
const ovProc={};
function ovProcessed(ref,tint){const key=ref+"|"+tint;if(ovProc[key])return ovProc[key];
 ovProc[key]=(async()=>{const bm=await createImageBitmap(await blobOf(ref));const cv=document.createElement("canvas");cv.width=bm.width;cv.height=bm.height;const cx=cv.getContext("2d");cx.drawImage(bm,0,0);
  const im=cx.getImageData(0,0,cv.width,cv.height),d=im.data,col=TINT[tint];
  for(let i=0;i<d.length;i+=4){const r=d[i],g=d[i+1],b=d[i+2];const mn=Math.min(r,g,b);let a=255-mn;if(a<18){d[i+3]=0;continue}a=Math.min(255,a*1.25);
   if(col){d[i]=col[0];d[i+1]=col[1];d[i+2]=col[2]}else{const k=255/Math.max(1,255-mn);d[i]=Math.max(0,255-(255-r)*k);d[i+1]=Math.max(0,255-(255-g)*k);d[i+2]=Math.max(0,255-(255-b)*k)}d[i+3]=a}
  cx.putImageData(im,0,0);const url=await new Promise(r=>cv.toBlob(b=>r(URL.createObjectURL(b)),"image/png"));return{cv,url}})();
 return ovProc[key]}
let ovKey=null,ov={step:"pick",ref:null,blob:null,url:null,w:0,h:0,name:"",pts:[]};
function renderOv(p){const el=$("ovImg");if(!p||!p.ov||!p.ov.ref||!S.ovShow){el.hidden=true;return}
 const[a,b,tx,ty]=p.ov.T;el.style.width=p.ov.w+"px";el.style.height=p.ov.h+"px";el.style.transform=`matrix(${a},${b},${-b},${a},${tx},${ty})`;el.style.opacity=S.ovOp;
 const k=p.ov.ref+"|"+S.ovTint;if(ovKey!==k){ovKey=k;el.hidden=true;ovProcessed(p.ov.ref,S.ovTint).then(o=>{if(ovKey===k){el.src=o.url;el.hidden=false}}).catch(()=>{})}else if(el.getAttribute("src"))el.hidden=false}
$("btnOv").onclick=()=>{const p=plan();if(!p)return;ov={step:p.ov?"manage":"pick",ref:null,blob:null,url:null,w:0,h:0,name:"",pts:[]};drawOv();$("dlgOv").showModal()};
$("ovClose").onclick=()=>$("dlgOv").close();
$("ovFile").onchange=async e=>{const f=e.target.files[0];e.target.value="";if(!f)return;const B=$("ovBody");B.innerHTML=`<p class="muted">A preparar o desenho…</p>`;
 try{let blob,w,h;if(f.type==="application/pdf"||/\.pdf$/i.test(f.name)){const d=await openPdf(await f.arrayBuffer());const r=await rasterPage(await d.getPage(1));blob=r.blob;w=r.w;h=r.h}
  else{blob=await shrink(f,4000,.9);const bm=await createImageBitmap(blob);w=bm.width;h=bm.height}
  Object.assign(ov,{ref:null,blob,w,h,name:cleanName(f.name),url:URL.createObjectURL(blob),pts:[],step:"align"});drawOv()}
 catch(err){toast("Não foi possível abrir o desenho: "+err.message);ov.step="pick";drawOv()}};
function drawOv(){const B=$("ovBody"),p=plan();if(!p)return;
 if(ov.step==="pick"){const others=S.plans.filter(q=>q.id!==p.id);
  B.innerHTML=`<p>Escolhe o desenho a pôr por cima de <b>${esc(p.name)}</b>, por exemplo a arquitetura por baixo da instalação elétrica, ou duas especialidades do mesmo piso.</p>
   ${others.length?`<div class="oplist">${others.map(q=>`<button class="btn" data-ovp="${esc(q.id)}"><span>${esc(q.name)}</span><span class="muted">usar este piso</span></button>`).join("")}</div>`:""}
   ${S.canWrite?`<label class="btn primary" for="ovFile" style="justify-self:start">Carregar outro desenho (PDF ou imagem)</label>`:""}`;
  B.querySelectorAll("[data-ovp]").forEach(b=>b.onclick=async()=>{const q=S.plans.find(x=>x.id===b.dataset.ovp);if(!q)return;try{Object.assign(ov,{ref:q.img,blob:null,w:q.w,h:q.h,name:q.name,url:await urlOf(q.img),pts:[],step:"align"});drawOv()}catch(e){toast("Esse desenho não está disponível.")}});return}
 if(ov.step==="align"){B.innerHTML=`<p>Como encaixar <b>${esc(ov.name)}</b> na planta?</p>
   <div class="fwrow"><button class="btn primary" id="ovFit">Encaixar na folha inteira</button><button class="btn" id="ovTwo">Alinhar por 2 pontos</button><button class="btn" id="ovBack">Escolher outro</button></div>
   <p class="muted" style="font-size:12px">Usa "folha inteira" quando os dois desenhos têm o mesmo formato e enquadramento (folhas do mesmo projeto). Se não coincidirem, usa "2 pontos": clicas em dois pontos no desenho e depois nos mesmos dois na planta.</p>`;
  $("ovBack").onclick=()=>{ov.step="pick";drawOv()};
  $("ovFit").onclick=async()=>{const a=Math.min(p.w/ov.w,p.h/ov.h);await saveOv([a,0,(p.w-ov.w*a)/2,(p.h-ov.h*a)/2])};
  $("ovTwo").onclick=()=>{ov.step="pts";ov.pts=[];drawOv()};return}
 if(ov.step==="pts"){B.innerHTML=`<p>Clica em <b>dois pontos fáceis de reconhecer</b> e afastados (cantos do edifício, eixos, pilares) neste desenho.</p><div class="fwcanvas"><canvas id="ovCv"></canvas></div><span id="ovStep" class="muted">Ponto 1 de 2</span>`;
  const cv=$("ovCv"),im=new Image();const draw=()=>{const cx=cv.getContext("2d");cx.drawImage(im,0,0);const Rr=Math.max(8,ov.w/120);ov.pts.forEach((q,i)=>{cx.lineWidth=Rr/3;cx.strokeStyle="#c2402f";cx.fillStyle="rgba(194,64,47,.25)";cx.beginPath();cx.arc(q.x,q.y,Rr,0,7);cx.fill();cx.stroke();cx.fillStyle="#c2402f";cx.font=`bold ${Rr*1.6}px sans-serif`;cx.fillText(String(i+1),q.x+Rr*1.2,q.y-Rr*1.2)})};
  im.onload=()=>{cv.width=ov.w;cv.height=ov.h;draw()};im.src=ov.url;
  cv.onclick=e=>{const r=cv.getBoundingClientRect();ov.pts.push({x:(e.clientX-r.left)*ov.w/r.width,y:(e.clientY-r.top)*ov.h/r.height});draw();
   if(ov.pts.length===1)$("ovStep").textContent="Ponto 2 de 2";else{$("dlgOv").close();S.align={kind:"ov",src:ov.pts.slice(),dst:[]};S.view="obra";render();toast("Agora clica nos mesmos 2 pontos na planta.")}};return}
 const o=p.ov;B.innerHTML=`<p>Por cima desta planta: <b>${esc(o.name||"desenho")}</b>.</p>
  <div class="fwrow"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="ovShow"${S.ovShow?" checked":""}> Mostrar</label>
   <label style="display:flex;gap:8px;align-items:center">Transparência <input type="range" id="ovOp" min="0.15" max="1" step="0.05" value="${S.ovOp}"></label>
   <label style="display:flex;gap:8px;align-items:center">Cor <select id="ovTint" style="border:1px solid var(--line);border-radius:6px;padding:4px 6px;background:var(--panel)"><option value="red"${S.ovTint==="red"?" selected":""}>Vermelho</option><option value="blue"${S.ovTint==="blue"?" selected":""}>Azul</option><option value="green"${S.ovTint==="green"?" selected":""}>Verde</option><option value="orig"${S.ovTint==="orig"?" selected":""}>Original</option></select></label></div>
  ${S.canWrite?`<div class="fwrow"><button class="btn" id="ovRealign">Refazer encaixe</button><button class="btn" id="ovSwap">Trocar desenho</button><button class="btn danger" id="ovDel">Remover</button></div>`:""}
  <p class="muted" style="font-size:12px">A cor e a transparência são só no teu ecrã; o encaixe fica guardado para toda a equipa.</p>`;
 $("ovShow").onchange=e=>{S.ovShow=e.target.checked;render()};$("ovOp").oninput=e=>{S.ovOp=+e.target.value;render()};$("ovTint").onchange=e=>{S.ovTint=e.target.value;render()};
 if(!S.canWrite)return;
 $("ovRealign").onclick=async()=>{try{Object.assign(ov,{ref:o.ref,blob:null,w:o.w,h:o.h,name:o.name,url:await urlOf(o.ref),pts:[],step:"align"});drawOv()}catch(e){toast("Desenho indisponível")}};
 $("ovSwap").onclick=()=>{ov.step="pick";drawOv()};
 let armed=false;$("ovDel").onclick=()=>{if(!armed){armed=true;$("ovDel").classList.add("armed");$("ovDel").textContent="Confirmar remover";return}api.update("plans",p.id,{ov:null});ovKey=null;$("dlgOv").close()}}
async function saveOv(T){const p=plan();if(!p)return;const busy=$("busy");busy.textContent="A guardar o desenho sobreposto…";busy.hidden=false;
 try{let ref=ov.ref;if(!ref&&ov.blob)ref=await putFile(ov.blob,"image/jpeg");if(!ref)throw new Error("sem desenho");
  await api.update("plans",p.id,{ov:{ref,w:ov.w,h:ov.h,T,name:ov.name,at:now(),by:S.meId}});ovKey=null;S.ovShow=true;if($("dlgOv").open)$("dlgOv").close();toast("Desenho sobreposto. Ajusta a transparência e a cor em Sobrepor…")}
 catch(e){toast("Não foi possível sobrepor: "+(e.message||"erro"))}finally{busy.hidden=true;render()}}
async function drawOvOn(cv,p){try{const o=await ovProcessed(p.ov.ref,S.ovTint);const k=cv.width/p.w;const[a,b,tx,ty]=p.ov.T;const cx=cv.getContext("2d");
 cx.save();cx.globalAlpha=S.ovOp;cx.setTransform(a*k,b*k,-b*k,a*k,tx*k,ty*k);cx.drawImage(o.cv,0,0,p.ov.w,p.ov.h);cx.restore()}catch(e){}}

/* =========================================================
   Fieldwire: captura sobreposta, alinhamento por 2 pontos, deteção de pins
   ========================================================= */
let fw={step:1,blob:null,url:null,w:0,h:0,pts:[]};S.fwShow=true;S.fwOp=.45;S.align=null;
function ghostList(){const p=plan();if(!p||!p.fw||!p.fw.pins)return[];const its=planItems().filter(i=>i.x!=null);const tol=.012*Math.max(p.w,p.h);
 return p.fw.pins.map((g,i)=>({...g,i})).filter(g=>!its.some(it=>Math.hypot((it.x-g.x)*p.w,(it.y-g.y)*p.h)<tol))}
let fwKey=null;
function renderOverlay(p){const el=$("fwImg");if(!p||!p.fw||!p.fw.img||!S.fwShow){el.hidden=true;return}
 const[a,b,tx,ty]=p.fw.T;el.style.width=p.fw.w+"px";el.style.height=p.fw.h+"px";el.style.transform=`matrix(${a},${b},${-b},${a},${tx},${ty})`;el.style.opacity=S.fwOp;
 if(fwKey!==p.fw.img){fwKey=p.fw.img;urlOf(p.fw.img).then(u=>{if(fwKey===p.fw.img){el.src=u;el.hidden=false}}).catch(()=>{el.hidden=true})}else if(el.src)el.hidden=false}
$("btnFw").onclick=()=>{const p=plan();if(!p)return;fw={step:p.fw&&p.fw.img?3:1,blob:null,url:null,w:0,h:0,pts:[]};drawFw();$("dlgFw").showModal()};
$("fwClose").onclick=()=>$("dlgFw").close();
$("fwFile").onchange=e=>{const f=e.target.files[0];e.target.value="";if(f)loadShot(f)};
async function loadShot(file){try{const b=await shrink(file,2600,.9);const bm=await createImageBitmap(b);fw.blob=b;fw.w=bm.width;fw.h=bm.height;if(fw.url)URL.revokeObjectURL(fw.url);fw.url=URL.createObjectURL(b);fw.pts=[];fw.step=2;drawFw()}
 catch(e){toast("Não foi possível abrir a captura: "+e.message)}}
function drawFw(){const B=$("fwBody"),p=plan();
 if(fw.step===1){B.innerHTML=`<p>1. No segundo ecrã abre a planta <b>${esc(p.name)}</b> no Fieldwire, com o desenho inteiro e os pins visíveis.<br>2. Tira uma captura dessa zona (<b>Win+Shift+S</b> no Windows, <b>Cmd+Shift+4</b> no Mac).<br>3. Clica na caixa abaixo e cola com <b>Ctrl+V</b>.</p>
  <div class="pastebox" id="fwPaste" tabindex="0">Clica aqui e cola a captura (Ctrl+V)</div>
  <div class="fwrow"><label class="btn" for="fwFile">Ou escolher ficheiro</label></div>`;setTimeout(()=>{const pb=$("fwPaste");if(pb)pb.focus()},50);return}
 if(fw.step===2){B.innerHTML=`<p>Clica em <b>dois pontos fáceis de reconhecer</b> e afastados um do outro (por exemplo dois cantos opostos do desenho). A seguir vais clicar nos mesmos dois pontos na tua planta base.</p>
  <div class="fwcanvas"><canvas id="fwCv"></canvas></div><div class="fwrow"><span id="fwStep" class="muted">Ponto 1 de 2</span><button class="btn sm" id="fwBack">Outra captura</button></div>`;
  const cv=$("fwCv"),im=new Image();im.onload=()=>{cv.width=fw.w;cv.height=fw.h;drawShot(cv,im)};im.src=fw.url;
  cv.onclick=e=>{const r=cv.getBoundingClientRect();fw.pts.push({x:(e.clientX-r.left)*fw.w/r.width,y:(e.clientY-r.top)*fw.h/r.height});drawShot(cv,im);
   if(fw.pts.length===1)$("fwStep").textContent="Ponto 2 de 2";
   else{$("dlgFw").close();S.align={src:fw.pts.slice(),dst:[],shot:{blob:fw.blob,w:fw.w,h:fw.h}};S.view="obra";render();toast("Agora clica nos mesmos 2 pontos na planta base.")}};
  $("fwBack").onclick=()=>{fw.step=1;drawFw()};return}
 const f=p.fw,gN=ghostList().length;
 B.innerHTML=`<p>Captura do Fieldwire alinhada com esta planta. <b>${f.pins.length}</b> pins detetados, <b>${gN}</b> ainda por registar.</p>
  <div class="fwrow"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="fwShow"${S.fwShow?" checked":""}> Mostrar a captura por cima</label>
   <label style="display:flex;gap:8px;align-items:center">Transparência <input type="range" id="fwOp" min="0.1" max="0.9" step="0.05" value="${S.fwOp}"></label></div>
  <div class="fwrow"><button class="btn" id="fwRedetect">Voltar a detetar pins</button><button class="btn" id="fwRealign">Refazer alinhamento</button><button class="btn" id="fwNew">Nova captura</button><button class="btn danger" id="fwDel">Remover</button></div>
  <p>Se faltar algum pin, ativa <b>Marcar equipamento</b> e clica em cima dele na planta.</p>`;
 $("fwShow").onchange=e=>{S.fwShow=e.target.checked;render()};$("fwOp").oninput=e=>{S.fwOp=+e.target.value;render()};
 $("fwRedetect").onclick=async()=>{const b=$("fwRedetect");b.disabled=true;b.textContent="A detetar…";try{const blob=await blobOf(f.img);const tips=await detectPins(blob);const pins=mapPins(tips,f.T,p);await api.update("plans",p.id,{fw:{pins}});toast(pins.length+" pins detetados");$("dlgFw").close()}catch(e){toast("Não foi possível detetar: "+(e.message||"erro"))}finally{b.disabled=false}};
 $("fwRealign").onclick=async()=>{try{const blob=await blobOf(f.img);fw.blob=blob;fw.w=f.w;fw.h=f.h;fw.url=URL.createObjectURL(blob);fw.pts=[];fw.step=2;drawFw()}catch(e){toast("Captura indisponível")}};
 $("fwNew").onclick=()=>{fw.step=1;drawFw()};
 let armed=false;$("fwDel").onclick=()=>{if(!armed){armed=true;$("fwDel").classList.add("armed");$("fwDel").textContent="Confirmar remover";return}api.update("plans",p.id,{fw:null});fwKey=null;$("dlgFw").close()}}
function drawShot(cv,im){const cx=cv.getContext("2d");cx.drawImage(im,0,0);const R=Math.max(8,fw.w/120);
 fw.pts.forEach((q,i)=>{cx.lineWidth=R/3;cx.strokeStyle="#c2402f";cx.fillStyle="rgba(194,64,47,.25)";cx.beginPath();cx.arc(q.x,q.y,R,0,7);cx.fill();cx.stroke();cx.fillStyle="#c2402f";cx.font=`bold ${R*1.6}px sans-serif`;cx.fillText(String(i+1),q.x+R*1.2,q.y-R*1.2)})}
async function finishAlign(){const A=S.align;S.align=null;const p=plan();if(!p||!A)return;
 const[s1,s2]=A.src,[d1,d2]=A.dst;const sx=s2.x-s1.x,sy=s2.y-s1.y,dx=d2.x-d1.x,dy=d2.y-d1.y,den=sx*sx+sy*sy;
 if(den<25){toast("Os dois pontos da captura estão demasiado próximos. Refaz o alinhamento.");render();return}
 const a=(dx*sx+dy*sy)/den,b=(dy*sx-dx*sy)/den,tx=d1.x-(a*s1.x-b*s1.y),ty=d1.y-(b*s1.x+a*s1.y);const T=[a,b,tx,ty];
 if(A.kind==="ov"){await saveOv(T);render();return}
 const busy=$("busy");busy.textContent="A detetar os pins do Fieldwire…";busy.hidden=false;
 try{const tips=await detectPins(A.shot.blob);const pins=mapPins(tips,T,p);busy.textContent="A guardar a captura…";
  const ref=await putFile(A.shot.blob,"image/jpeg");await api.update("plans",p.id,{fw:{img:ref,w:A.shot.w,h:A.shot.h,T,pins,at:now(),by:S.meId}});
  fwKey=null;S.fwShow=true;toast(`${pins.length} pins do Fieldwire colocados na planta. Clica num círculo laranja e cola a foto.`)}
 catch(e){toast("Não foi possível concluir: "+(e.message||"erro"))}finally{busy.hidden=true;render()}}
function mapPins(tips,T,p){const[a,b,tx,ty]=T;const out=[];
 for(const t of tips){const X=a*t.x-b*t.y+tx,Y=b*t.x+a*t.y+ty;const x=X/p.w,y=Y/p.h;if(x<0||y<0||x>1||y>1)continue;
  if(out.some(o=>Math.hypot((o.x-x)*p.w,(o.y-y)*p.h)<4))continue;out.push({x:+x.toFixed(4),y:+y.toFixed(4)})}
 return out}
/* deteção por cor: pins laranja (e pretos do mesmo tamanho); a ponta da gota é a posição */
async function detectPins(blob){const bm=await createImageBitmap(blob);const W=bm.width,H=bm.height;const cv=document.createElement("canvas");cv.width=W;cv.height=H;
 const cx=cv.getContext("2d");cx.drawImage(bm,0,0);const d=cx.getImageData(0,0,W,H).data;const N=W*H;const cls=new Uint8Array(N);
 for(let i=0,k=0;i<N;i++,k+=4){const r=d[k],g=d[k+1],b=d[k+2];
  // laranja pelo tom (hue ~12–42°), saturação alta, brilho moderado: aguenta fotos de ecrã e capturas
  if(r>110&&r>=g&&g>=b&&(r-b)>r*.6){const h=60*(g-b)/(r-b);if(h>12&&h<42)cls[i]=1}
  if(cls[i]){}else if(r<75&&g<75&&b<80&&Math.abs(r-g)<22&&Math.abs(g-b)<22)cls[i]=2}
 const lab=new Uint8Array(N),stack=new Int32Array(N);const comps=[];
 for(let i=0;i<N;i++){if(!cls[i]||lab[i])continue;const c=cls[i];let sp=0;stack[sp++]=i;lab[i]=1;let n=0,minx=W,maxx=0,miny=H,maxy=0;const px=[];
  while(sp){const j=stack[--sp];n++;const x=j%W,y=(j/W)|0;if(x<minx)minx=x;if(x>maxx)maxx=x;if(y<miny)miny=y;if(y>maxy)maxy=y;if(px.length<40000)px.push(j);
   if(x>0&&cls[j-1]===c&&!lab[j-1]){lab[j-1]=1;stack[sp++]=j-1}if(x<W-1&&cls[j+1]===c&&!lab[j+1]){lab[j+1]=1;stack[sp++]=j+1}
   if(y>0&&cls[j-W]===c&&!lab[j-W]){lab[j-W]=1;stack[sp++]=j-W}if(y<H-1&&cls[j+W]===c&&!lab[j+W]){lab[j+W]=1;stack[sp++]=j+W}}
  const w=maxx-minx+1,h=maxy-miny+1;comps.push({c,n,w,h,fill:n/(w*h),px})}
 const single=comps.filter(o=>o.c===1&&o.n>=25&&o.fill>.4&&o.h/o.w>.9&&o.h/o.w<2.4);if(!single.length)return[];
 const areas=single.map(o=>o.n).sort((a,b)=>a-b),med=areas[Math.floor(areas.length/2)];const wmed=single.map(o=>o.w).sort((a,b)=>a-b)[Math.floor(single.length/2)];
 const tips=[];
 const tipOf=pxs=>{let my=-1;for(const j of pxs){const y=(j/W)|0;if(y>my)my=y}let sx=0,cn=0;for(const j of pxs){const y=(j/W)|0;if(y>=my-Math.max(2,wmed*.12)){sx+=j%W;cn++}}return{x:sx/cn,y:my}};
 for(const o of comps){
  if(o.c===1){if(o.n<med*.35)continue;const k=Math.min(8,Math.max(1,Math.round(o.n/med)));
   if(k===1){tips.push(tipOf(o.px));continue}
   // gotas sobrepostas: separa por k-médias
   const pts=o.px.map(j=>[j%W,(j/W)|0]);pts.sort((a,b)=>a[0]-b[0]);let cen=[];for(let q=0;q<k;q++)cen.push(pts[Math.floor((q+.5)*pts.length/k)].slice());
   let asg=new Int32Array(pts.length);
   for(let it=0;it<10;it++){for(let q=0;q<pts.length;q++){let bi=0,bd=1e18;for(let z=0;z<k;z++){const dd=(pts[q][0]-cen[z][0])**2+(pts[q][1]-cen[z][1])**2;if(dd<bd){bd=dd;bi=z}}asg[q]=bi}
    const acc=cen.map(()=>[0,0,0]);for(let q=0;q<pts.length;q++){const z=asg[q];acc[z][0]+=pts[q][0];acc[z][1]+=pts[q][1];acc[z][2]++}cen=acc.map((a,z)=>a[2]?[a[0]/a[2],a[1]/a[2]]:cen[z])}
   for(let z=0;z<k;z++){const sub=[];for(let q=0;q<pts.length;q++)if(asg[q]===z)sub.push(pts[q][1]*W+pts[q][0]);if(sub.length>med*.3)tips.push(tipOf(sub))}}
  else if(o.n>med*.45&&o.n<med*2.2&&o.fill>.4&&o.h/o.w>.9&&o.h/o.w<2.4&&o.w<wmed*1.6)tips.push(tipOf(o.px))}
 return tips}
function createFromGhost(i){const p=plan();if(!p||!p.fw||!p.fw.pins[i])return;const g=p.fw.pins[i];const id=uid();
 api.set("items",id,newItem({x:g.x,y:g.y}));S.sel=id;sheetFor=null;render();
 setTimeout(()=>setReadMsgFor(id,"No Fieldwire abre este pin, recorta a foto da etiqueta (Win+Shift+S) e cola aqui com Ctrl+V.","busy"),60)}
/* colar imagens: captura do Fieldwire (no diálogo) ou foto do equipamento selecionado */
document.addEventListener("paste",e=>{const items=[...(e.clipboardData&&e.clipboardData.items||[])];const f=items.filter(i=>i.type&&i.type.startsWith("image/")).map(i=>i.getAsFile()).filter(Boolean);
 if(!f.length)return;if(!S.canWrite)return;e.preventDefault();
 if($("dlgFw").open&&fw.step===1){loadShot(f[0]);return}
 const it=cur();if(it&&S.view==="obra"){if($("dlgPhoto").open)$("dlgPhoto").close();addPhotos(it,f);return}
 toast("Seleciona um equipamento (ou um círculo laranja) antes de colar a foto.")});

/* =========================================================
   Coordenação
   ========================================================= */
const R={plan:"",type:"",stage:"",photos:false};
function counts(items){const c={total:items.length};for(const s of STAGES)c[s.k]=items.filter(i=>(i.stage||"previsto")===s.k).length;
 c.ge=k=>items.filter(i=>sIdx(i.stage)>=k).length;return c}
function stackBar(items){if(!items.length)return`<div class="stack"></div>`;return`<div class="stack">${STAGES.map(s=>{const n=items.filter(i=>(i.stage||"previsto")===s.k).length;return n?`<i style="width:${n/items.length*100}%;background:${s.c}" title="${s.n}: ${n}"></i>`:""}).join("")}</div>`}
const pct=(a,b)=>b?Math.round(a/b*100):0;
function renderCoord(){
 const W=$("coordWrap");const all=S.items,c=counts(all),openI=S.issues.filter(x=>x.status!=="resolvida");
 wantNames([...new Set(S.plans.flatMap(p=>p.assignees||[]).concat(openI.flatMap(x=>[x.assignee,x.createdBy]),S.items.flatMap(i=>[i.assignee,...(i.log||[]).map(e=>e.by)]),S.meta.clients||[]).filter(Boolean))]);
 const rItems=all.filter(i=>(!R.plan||i.planId===R.plan)&&(!R.type||i.type===R.type)&&(!R.stage||(i.stage||"previsto")===R.stage)).sort((a,b)=>{const pa=S.plans.findIndex(p=>p.id===a.planId),pb=S.plans.findIndex(p=>p.id===b.planId);return pa-pb||String(a.code).localeCompare(String(b.code),"pt",{numeric:true})});
 const planName=id=>(S.plans.find(p=>p.id===id)||{}).name||"—";
 W.innerHTML=`
 <section class="block"><h2><span>Progresso da obra</span>${S.isCoord?`<span style="display:flex;gap:8px;align-items:center;font-family:var(--f-body);font-size:13px;text-transform:none;letter-spacing:0"><label for="pjName" class="muted">Nome da obra</label><input type="text" id="pjName" value="${esc(S.meta.name||"")}" placeholder="ex.: HCI - Fit-out Sede CGD" style="border:1px solid var(--line);border-radius:6px;padding:6px 9px;background:var(--panel);min-width:0;width:240px"></span>`:""}</h2>
  <div class="tiles">
   <div class="tile"><span>Equipamentos</span><b>${c.total}</b><small>${S.plans.length} pisos</small></div>
   <div class="tile"><span>Instalados</span><b>${pct(c.ge(1),c.total)}%</b><small>${c.ge(1)} de ${c.total}</small></div>
   <div class="tile"><span>Testados</span><b>${pct(c.ge(3),c.total)}%</b><small>${c.ge(3)} de ${c.total}</small></div>
   <div class="tile"><span>Validados</span><b>${pct(c.ge(4),c.total)}%</b><small>${c.ge(4)} de ${c.total}</small></div>
   <div class="tile"><span>Aceites (cliente)</span><b>${pct(c.aceite,c.total)}%</b><small>${c.aceite} de ${c.total}</small></div>
   <div class="tile${dupCount()?" bad":""}"><span>IDs repetidos</span><b>${dupCount()}</b><small>${dupCount()?"equipamentos a verificar":"nenhum"}</small></div>
   <div class="tile${openI.length?" bad":""}"><span>Anomalias abertas</span><b>${openI.length}</b><small>${S.issues.length-openI.length} resolvidas</small></div>
  </div>
 </section>
 <section class="block"><h2><span>Por piso</span>${S.canWrite?`<label class="btn primary" for="planIn" style="font-family:var(--f-body);font-size:13px;text-transform:none;letter-spacing:0" onclick="replacing=null">+ Novo piso</label>`:""}</h2>
  <div class="tbl"><table><thead><tr><th>Piso</th><th>Técnicos</th><th>Progresso</th>${STAGES.map(s=>`<th class="num">${s.n}</th>`).join("")}<th class="num">Anomalias</th><th>Estado</th><th></th></tr></thead><tbody>
  ${S.plans.map(p=>{const its=all.filter(i=>i.planId===p.id),cc=counts(its),oi=openI.filter(x=>x.planId===p.id).length,un=its.filter(i=>i.x==null).length;
   return`<tr><td><b>${esc(p.name)}</b>${un?`<div class="muted" style="font-size:12px">${un} por colocar</div>`:""}</td>
   <td><div class="people">${(p.assignees||[]).map(id=>personChip(id)).join("")||`<span class="muted">—</span>`}${S.isCoord&&!S.local?`<button class="btn sm" data-assign="${esc(p.id)}">Atribuir</button>`:""}</div></td>
   <td>${stackBar(its)}<div class="muted" style="font-size:12px;margin-top:3px">${pct(cc.ge(3),cc.total)}% testado</div></td>
   ${STAGES.map(s=>`<td class="num">${cc[s.k]||""}</td>`).join("")}<td class="num" style="${oi?"color:var(--bad);font-weight:600":""}">${oi||""}</td>
   <td>${floorPill(p)}</td>
   <td style="white-space:nowrap"><button class="btn sm" data-open="${esc(p.id)}">Abrir</button> <button class="btn sm" data-close="${esc(p.id)}">Fecho…</button></td></tr>`}).join("")||`<tr><td colspan="12" class="muted">Ainda não há pisos. Carrega a primeira planta no separador Obra.</td></tr>`}
  </tbody></table></div>
 </section>
 ${techSection()}
 ${daySection()}
 <section class="block"><h2>Por sistema</h2>
  <div class="tbl"><table><thead><tr><th>Sistema</th><th class="num">Total</th><th>Progresso</th>${STAGES.map(s=>`<th class="num">${s.n}</th>`).join("")}</tr></thead><tbody>
  ${TYPES.map(t=>{const its=all.filter(i=>i.type===t.k);if(!its.length)return"";const cc=counts(its);return`<tr><td>${esc(t.n)}</td><td class="num">${its.length}</td><td>${stackBar(its)}</td>${STAGES.map(s=>`<td class="num">${cc[s.k]||""}</td>`).join("")}</tr>`}).join("")||`<tr><td colspan="8" class="muted">Sem equipamentos registados.</td></tr>`}
  </tbody></table></div>
 </section>
 <section class="block"><h2>Anomalias abertas</h2>
  <div class="tbl"><table><thead><tr><th>Equipamento</th><th>Piso</th><th>Descrição</th><th>Atribuída a</th><th>Registada</th><th></th></tr></thead><tbody>
  ${openI.sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt))).map(x=>{const it=S.items.find(i=>i.id===x.itemId);const days=Math.floor((Date.now()-new Date(x.createdAt))/864e5);
   return`<tr><td class="mono">${esc(it?it.code:"(apagado)")}</td><td>${esc(planName(x.planId))}</td><td style="max-width:340px">${esc(x.text)}</td><td>${x.assignee?personChip(x.assignee):`<span class="muted">—</span>`}</td>
   <td>${esc(nameOf(x.createdBy))}<div class="muted" style="font-size:12px">${days?`há ${days} dia${days>1?"s":""}`:"hoje"}</div></td>
   <td style="white-space:nowrap">${it?`<button class="btn sm" data-goto="${esc(it.id)}">Ver</button>`:""} ${S.canWrite?`<button class="btn sm" data-resolve="${esc(x.id)}">Resolvida</button>`:""}</td></tr>`}).join("")||`<tr><td colspan="6" class="muted">Sem anomalias abertas.</td></tr>`}
  </tbody></table></div>
 </section>
 
 <section class="block"><h2><span>Relatório para o cliente</span>
  <span style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="rpCsv">Descarregar CSV</button><button class="btn primary" id="rpHtml">Descarregar relatório</button></span></h2>
  <div class="rfilters">
   <select id="rfPlan" aria-label="Piso"><option value="">Todos os pisos</option>${S.plans.map(p=>`<option value="${esc(p.id)}"${R.plan===p.id?" selected":""}>${esc(p.name)}</option>`).join("")}</select>
   <select id="rfType" aria-label="Sistema"><option value="">Todos os sistemas</option>${TYPES.map(t=>`<option value="${t.k}"${R.type===t.k?" selected":""}>${t.n}</option>`).join("")}</select>
   <select id="rfStage" aria-label="Etapa"><option value="">Todas as etapas</option>${STAGES.map(s=>`<option value="${s.k}"${R.stage===s.k?" selected":""}>${s.n}</option>`).join("")}</select>
   <label style="display:flex;gap:6px;align-items:center;font-size:13px"><input type="checkbox" id="rfPhotos"${R.photos?" checked":""}> Incluir fotos no relatório</label>
   <span class="muted" style="font-size:12px">${rItems.length} equipamentos</span>
  </div>
  <div class="tbl"><table><thead><tr><th>Ref.</th><th>Piso</th><th>Sistema</th><th>ID</th><th>MAC</th><th>Fabricante / modelo</th><th>Nº série</th><th>Etapa</th><th>Fotos</th></tr></thead><tbody>
  ${rItems.slice(0,300).map(i=>`<tr><td class="mono">${esc(i.code)}</td><td>${esc(planName(i.planId))}</td><td>${esc(tOf(i.type).n)}</td><td class="mono">${esc(i.devId)}</td><td class="mono">${esc(i.mac)}</td><td>${esc([i.maker,i.model].filter(Boolean).join(" "))}</td><td class="mono">${esc(i.serial)}</td>
   <td><span class="pill" style="--c:${sOf(i.stage).c}">${sOf(i.stage).n}</span></td><td><div class="thumbs">${(i.photos||[]).slice(0,3).map(r=>`<img data-ref="${esc(r)}" alt="">`).join("")}</div></td></tr>`).join("")||`<tr><td colspan="9" class="muted">Nada corresponde aos filtros.</td></tr>`}
  ${rItems.length>300?`<tr><td colspan="9" class="muted">A mostrar 300 de ${rItems.length}. O ficheiro descarregado inclui todos.</td></tr>`:""}
  </tbody></table></div>
 </section>`;
 const pj=$("pjName");if(pj)pj.onchange=()=>{const v=pj.value.trim();api.set("meta","project",{...S.meta,name:v})};
 hydrate(W);
 W.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>{S.planId=b.dataset.open;S.sel=null;S.view="obra";loadedPlan=null;render();setTimeout(fit,40)});
 W.querySelectorAll("[data-goto]").forEach(b=>b.onclick=()=>{const it=S.items.find(i=>i.id===b.dataset.goto);if(!it)return;S.planId=it.planId;S.view="obra";S.filter="issues";loadedPlan=null;select(it.id);setTimeout(()=>{fit();centerOn(it)},60)});
 W.querySelectorAll("[data-resolve]").forEach(b=>b.onclick=()=>resolveIssue(b.dataset.resolve));
 W.querySelectorAll("[data-assign]").forEach(b=>b.onclick=()=>openAssign(b.dataset.assign));
 W.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>openClose(b.dataset.close));
 wireCoordExtras(W);
 $("rfPlan").onchange=e=>{R.plan=e.target.value;render()};$("rfType").onchange=e=>{R.type=e.target.value;render()};$("rfStage").onchange=e=>{R.stage=e.target.value;render()};$("rfPhotos").onchange=e=>{R.photos=e.target.checked};
 wireTeam(W);wireMail(W);wireData(W);wireAi(W);
 $("rpCsv").onclick=()=>saveFile(`Equipamentos_${slug()}.csv`,"﻿"+reportCsv(rItems));
 $("rpHtml").onclick=async()=>{const b=$("rpHtml");b.disabled=true;b.textContent="A preparar…";try{await saveFile(`Relatorio_${slug()}.html`,await reportHtml(rItems))}finally{b.disabled=false;b.textContent="Descarregar relatório"}};
}
const slug=()=>(S.meta.name||"Obra").replace(/[^\p{L}\p{N}]+/gu,"_").slice(0,40)+"_"+new Date().toISOString().slice(0,10);
function reportCsv(items){const e=v=>{v=String(v??"");return/[;"\n]/.test(v)?`"${v.replace(/"/g,'""')}"`:v};const pn=id=>(S.plans.find(p=>p.id===id)||{}).name||"";
 const rows=[["Ref_planta","Piso","Sistema","ID_equipamento","MAC","Fabricante","Modelo","N_serie","Tarefa_Fieldwire","Etapa","Responsavel","Prazo","Instalado_em","Testado_em","Validado_em","Aceite_em","Checklist","Anomalias_abertas","Fotos","X_%","Y_%","Notas"]];
 for(const i of items){const ch=CHECKS[i.type]||CHECKS.EQ;const cd=ch.filter((_,k)=>ck(i)[k]).length;const lg=k=>i.stageLog&&i.stageLog[k]?fmtDate(i.stageLog[k].at):"";
  rows.push([i.code,pn(i.planId),tOf(i.type).n,i.devId,i.mac,i.maker,i.model,i.serial,i.taskNo,sOf(i.stage).n,i.assignee?nameOf(i.assignee):"",i.due||"",lg("instalado"),lg("testado"),lg("validado"),lg("aceite"),`${cd}/${ch.length}`,openIssues(i.id).length,(i.photos||[]).length,i.x==null?"":(i.x*100).toFixed(2),i.y==null?"":(i.y*100).toFixed(2),i.note])}
 return rows.map(r=>r.map(e).join(";")).join("\r\n")}
async function thumbData(ref){try{const b=await blobOf(ref);const bm=await createImageBitmap(b);const k=Math.min(1,360/Math.max(bm.width,bm.height));const cv=document.createElement("canvas");cv.width=Math.round(bm.width*k);cv.height=Math.round(bm.height*k);cv.getContext("2d").drawImage(bm,0,0,cv.width,cv.height);return cv.toDataURL("image/jpeg",.78)}catch(e){return""}}
async function reportHtml(items){const pn=id=>(S.plans.find(p=>p.id===id)||{}).name||"";const c=counts(items);
 const rows=[];for(const i of items){let ph="";if(R.photos){for(const r of (i.photos||[]).slice(0,2)){const d=await thumbData(r);if(d)ph+=`<img src="${d}">`}}
  rows.push(`<tr><td class=m>${esc(i.code)}</td><td>${esc(pn(i.planId))}</td><td>${esc(tOf(i.type).n)}</td><td class=m>${esc(i.devId)}</td><td class=m>${esc(i.mac)}</td><td>${esc([i.maker,i.model].filter(Boolean).join(" "))}</td><td class=m>${esc(i.serial)}</td><td>${esc(sOf(i.stage).n)}</td>${R.photos?`<td>${ph}</td>`:""}</tr>`)}
 return`<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório de equipamentos – ${esc(S.meta.name||"Obra")}</title>
<style>body{font-family:Arial,Helvetica,sans-serif;color:#1d2421;margin:32px;font-size:12px}h1{font-size:20px;margin:0 0 4px}p{color:#5e6b66;margin:0 0 16px}.k{display:flex;gap:24px;margin:0 0 18px}.k div{border:1px solid #d3d9d5;border-radius:6px;padding:8px 12px}.k b{display:block;font-size:18px}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #d3d9d5;padding:6px 8px;text-align:left;vertical-align:top}th{background:#eef0ee;font-size:11px;text-transform:uppercase}.m{font-family:Consolas,monospace}img{width:110px;margin:0 4px 4px 0;border-radius:4px}@media print{body{margin:12mm}}</style></head><body>
<h1>Relatório de equipamentos</h1><p>${esc(S.meta.name||"Obra")} · ${new Date().toLocaleDateString("pt-PT")}${R.plan?" · "+esc(pn(R.plan)):""}${R.type?" · "+esc(tOf(R.type).n):""}</p>
<div class="k"><div>Equipamentos<b>${c.total}</b></div><div>Instalados<b>${c.ge(1)}</b></div><div>Testados<b>${c.ge(3)}</b></div><div>Validados<b>${c.validado}</b></div></div>
<table><thead><tr><th>Ref.</th><th>Piso</th><th>Sistema</th><th>ID</th><th>MAC</th><th>Fabricante / modelo</th><th>Nº série</th><th>Etapa</th>${R.photos?"<th>Fotos</th>":""}</tr></thead><tbody>${rows.join("")}</tbody></table></body></html>`}

/* atribuir pisos */
let assignPlan=null;
function openAssign(pid){assignPlan=pid;const p=S.plans.find(x=>x.id===pid);$("asTitle").textContent="Atribuir "+(p?p.name:"piso");drawAssign();$("dlgAssign").showModal()}
function drawAssign(){const p=S.plans.find(x=>x.id===assignPlan);if(!p)return;const ids=p.assignees||[];
 $("asPeople").innerHTML=ids.map(id=>personChip(id,true)).join("")||`<span class="none">Ninguém atribuído.</span>`;
 $("asPeople").querySelectorAll("[data-rm]").forEach(b=>b.onclick=async()=>{await api.update("plans",p.id,{assignees:ids.filter(x=>x!==b.dataset.rm)});setTimeout(drawAssign,50)});
 mountPicker($("asPicker"),null,async id=>{if(!id||ids.includes(id))return;await api.update("plans",p.id,{assignees:[...ids,id]});setTimeout(drawAssign,50)},"Procurar técnico pelo nome…")}
$("asClose").onclick=()=>$("dlgAssign").close();

/* =========================================================
   Equipa (contas e papéis)
   ========================================================= */
const PERMS=[["Ver plantas, equipamentos e relatórios",["admin","coord","tecnico","fiscal","leitura"]],
 ["Marcar equipamentos, fotos, ler etiquetas, checklists",["admin","coord","tecnico","fiscal"]],
 ["Registar e resolver anomalias",["admin","coord","tecnico","fiscal"]],
 ["Marcar Testado",["admin","coord","tecnico","fiscal"]],
 ["Marcar Validado",["admin","coord"]],
 ["Marcar Aceite",["admin","coord","fiscal"]],
 ["Carregar e trocar plantas, pastas",["admin","coord","tecnico","fiscal"]],
 ["Atribuir pisos e equipamentos, fecho de piso",["admin","coord"]],
 ["Aprovar técnicos, fiscalização e só leitura",["admin","coord"]],
 ["Nomear coordenação e administradores",["admin"]],
 ["Configurar emails e leitura com IA, importar dados",["admin"]]];
function isMgr(){return S.isAdmin||(S.isCoord&&!hasV2())||S.demo}
function hasV2(){return members.some(m=>m.role==="admin")}
function rolesICanGive(target){if(S.isAdmin)return ROLE_ORDER;if(S.isCoord&&!["admin","coord"].includes(target.role))return["tecnico","fiscal","leitura","pendente"];return[]}
function teamSection(){if(S.demo)return"";
 const sorted=members.slice().sort((a,b)=>ROLE_ORDER.indexOf(a.role)-ROLE_ORDER.indexOf(b.role)||String(a.name).localeCompare(String(b.name),"pt"));
 const rows=sorted.map(m=>{const me=m.user_id===S.meId;const pend=m.role==="pendente";const can=me?[]:rolesICanGive(m);
  return`<tr${pend?' class="pendrow"':""}><td>${personChip(m.user_id)}${me?` <small class="muted">(eu)</small>`:""}</td><td class="muted">${esc(m.email)}</td>
   <td>${can.length?`<select data-role="${esc(m.user_id)}" aria-label="Papel de ${esc(m.name)}">${can.map(k=>`<option value="${k}"${m.role===k?" selected":""}>${k==="pendente"?"Sem acesso / por aprovar":ROLE_N[k]}</option>`).join("")}</select>`:`<span class="rolepill r-${esc(m.role)}">${esc(ROLE_N[m.role]||m.role)}</span>`}</td>
   <td>${can.length&&pend?`<button class="btn sm primary" data-approve="${esc(m.user_id)}">Aprovar como técnico</button>`:""}</td></tr>`}).join("");
 const cols=ROLE_ORDER.filter(r=>r!=="pendente");
 return`<section class="block" id="teamSec"><h2><span>Equipa e acessos</span><span class="muted" style="font-family:var(--f-body);font-size:13px;text-transform:none;letter-spacing:0">${members.filter(m=>m.role!=="pendente").length} com acesso</span></h2>
  ${S.isCoord&&!hasV2()?`<div class="msg warn">Para usar a hierarquia completa (Administrador e Só leitura) e as notificações por email, corre no Supabase o ficheiro <b>supabase/atualizacao-2-acessos-notificacoes.sql</b> (ver LEIA-ME).</div>`:""}
  <p class="muted" style="margin:0;font-size:13px">Cada pessoa cria a sua conta na página de entrada. Depois é aprovada aqui com um papel. O <b>Administrador</b> pode dar qualquer papel; a <b>Coordenação</b> aprova técnicos, fiscalização e só leitura.</p>
  <div class="tbl"><table><thead><tr><th>Pessoa</th><th>Email</th><th>Papel</th><th></th></tr></thead><tbody>${rows||`<tr><td colspan="4" class="muted">Sem pessoas.</td></tr>`}</tbody></table></div>
  <details class="perm"><summary>O que cada papel pode fazer</summary><div class="tbl"><table class="permt"><thead><tr><th></th>${cols.map(r=>`<th>${esc(ROLE_N[r])}</th>`).join("")}</tr></thead><tbody>
   ${PERMS.map(([t,rs])=>`<tr><td>${esc(t)}</td>${cols.map(r=>`<td class="c">${rs.includes(r)?"✓":"–"}</td>`).join("")}</tr>`).join("")}</tbody></table></div></details></section>`}
async function setMemberRole(uid0,role){if(!sb||!navigator.onLine){toast("Precisas de rede para mudar a equipa.");return}
 const t=members.find(m=>m.user_id===uid0);
 if(t&&t.role==="admin"&&role!=="admin"&&members.filter(m=>m.role==="admin").length<=1){toast("Tem de existir pelo menos um administrador.");render();return}
 const{data,error}=await sb.from("members").update({role}).eq("user_id",uid0).select("user_id");
 if(error||!data||!data.length){toast(error&&/check constraint/i.test(error.message)?"Este papel ainda não existe no servidor: corre a atualização 2 no Supabase (ver LEIA-ME).":error&&/administrador/i.test(error.message)?"Tem de existir pelo menos um administrador.":"Não tens permissão para dar este papel.");await loadMembers();render();return}
 await loadMembers();toast(`${t?t.name:"Pessoa"}: ${ROLE_N[role]}.`);render()}
function wireTeam(W){W.querySelectorAll("[data-role]").forEach(s=>s.onchange=()=>setMemberRole(s.dataset.role,s.value));
 W.querySelectorAll("[data-approve]").forEach(b=>b.onclick=()=>setMemberRole(b.dataset.approve,"tecnico"))}

/* =========================================================
   Notificações por email
   - cada pessoa escolhe no Início se quer receber e o quê (tabela notif_prefs)
   - o administrador configura o envio (Brevo, gratuito) em Coordenação
   ========================================================= */
let myPrefs=null,prefsState="";   // "", "loading", "missing" (sem atualização 2), "ok"
const EV_N={ev_mencao:"Quando me identificam com @ numa nota, pendência ou no diário",ev_atribuido:"Quando me atribuem equipamentos, pendências ou pisos",ev_anomalia:"Anomalias novas e resolvidas",ev_etapas:"Mudanças de etapa que me dizem respeito (para validar, para aceitar, aceites)",ev_plantas:"Plantas novas ou trocadas"};
async function loadPrefs(){if(!sb||S.demo||!navigator.onLine||prefsState==="loading")return;prefsState="loading";
 const{data,error}=await sb.from("notif_prefs").select("*").eq("user_id",S.meId).maybeSingle();
 if(error){prefsState=/does not exist|relation|schema cache/i.test(error.message)?"missing":"";myPrefs=null}else{prefsState="ok";myPrefs=data||{enabled:true,mode:"imediato",ev_atribuido:true,ev_anomalia:true,ev_etapas:true,ev_plantas:false,ev_mencao:true}}render()}
function notifCard(){if(S.demo||!isActive())return"";if(!prefsState&&navigator.onLine)setTimeout(loadPrefs,0);
 const P=myPrefs;
 return`<section class="block" id="notifSec"><h2><span>Notificações por email</span>${P&&P.enabled?`<span class="pill" style="--c:var(--ok)">Ligadas</span>`:""}</h2>
  ${prefsState==="missing"?`<p class="muted" style="margin:0;font-size:13px">As notificações ainda não estão ativas no servidor. ${S.isCoord?"Corre a atualização 2 no Supabase (ver LEIA-ME).":"Fala com a coordenação."}</p>`
  :!P?`<p class="muted" style="margin:0;font-size:13px">${navigator.onLine?"A carregar…":"Liga-te à rede para ver as tuas notificações."}</p>`
  :`<div class="notif">
    <label class="sw"><input type="checkbox" id="nfOn"${P.enabled?" checked":""}><span>Receber emails em <b>${esc(S.me&&S.me.email||"")}</b></span></label>
    <div class="nfopts"${P.enabled?"":" hidden"}>
     <div class="seg" role="group" aria-label="Frequência"><button type="button" data-nfmode="imediato" aria-pressed="${P.mode!=="diario"}">Na hora (cerca de 1 min)</button><button type="button" data-nfmode="diario" aria-pressed="${P.mode==="diario"}">Resumo diário (~18h)</button></div>
     ${Object.entries(EV_N).map(([k,t])=>`<label class="ck"><input type="checkbox" data-nfev="${k}"${P[k]?" checked":""}><span>${esc(t)}</span></label>`).join("")}
    </div></div>`}</section>`}
async function savePrefs(patch){if(!sb||!navigator.onLine){toast("Precisas de rede para mudar as notificações.");return}
 myPrefs={...myPrefs,...patch};let{error}=await sb.from("notif_prefs").upsert({user_id:S.meId,...myPrefs,updated_at:new Date().toISOString()},{onConflict:"user_id"});
 if(error&&/ev_mencao/.test(error.message||"")){const{ev_mencao,...rest}=myPrefs;({error}=await sb.from("notif_prefs").upsert({user_id:S.meId,...rest,updated_at:new Date().toISOString()},{onConflict:"user_id"}))}
 if(error){toast("Não foi possível guardar: "+error.message);prefsState="";loadPrefs();return}render()}
function wireNotif(W){const on=$("nfOn");if(!on)return;on.onchange=()=>{savePrefs({enabled:on.checked});toast(on.checked?"Notificações por email ligadas.":"Notificações por email desligadas.")};
 W.querySelectorAll("[data-nfmode]").forEach(b=>b.onclick=()=>savePrefs({mode:b.dataset.nfmode}));
 W.querySelectorAll("[data-nfev]").forEach(c=>c.onchange=()=>savePrefs({[c.dataset.nfev]:c.checked}))}
/* configuração do envio (Administrador) */
let mailSt=null,mailMsg="";
async function loadMailStatus(){if(!sb||!navigator.onLine)return;const{data,error}=await sb.rpc("mail_status");mailSt=error?{missing:true}:data||{};render()}
function mailSection(){if(S.demo||!S.isCoord)return"";if(mailSt===null&&navigator.onLine){mailSt={loading:true};setTimeout(loadMailStatus,0)}
 const m=mailSt||{};
 return`<section class="block" id="mailSec"><h2><span>Envio de emails</span><span class="pill" style="--c:${m.configured?"var(--ok)":"var(--muted)"}">${m.configured?"Configurado":"Por configurar"}</span></h2>
  ${m.missing?`<div class="msg warn">Corre primeiro no Supabase a <b>atualização 2</b> (supabase/atualizacao-2-acessos-notificacoes.sql).</div>`:""}
  <p class="muted" style="margin:0;font-size:13px">Os emails são enviados pelo <b>Brevo</b> (gratuito até 300 por dia), a partir do servidor da obra, de 5 em 5 minutos, com tudo junto num só email por pessoa. ${m.configured?`Remetente: <b>${esc(m.sender||"")}</b>.`:""}</p>
  ${S.isAdmin?`<ol class="muted" style="margin:0;font-size:13px;padding-left:18px"><li>Cria conta grátis em <b>brevo.com</b>.</li><li>Em <b>Senders, domains &amp; dedicated IPs → Senders</b> junta o teu email (ex.: o teu Gmail) e confirma-o.</li><li>Em <b>SMTP &amp; API → API keys</b> carrega em <b>Generate a new API key</b> e cola-a aqui.</li></ol>
  <div class="mailform"><input type="password" id="mlKey" autocomplete="off" placeholder="${m.configured?"Chave guardada. Cola outra para trocar":"Chave API do Brevo (xkeysib-…)"}">
   <input type="email" id="mlFrom" placeholder="Email remetente confirmado no Brevo" value="${esc(m.sender||(S.me&&S.me.email)||"")}">
   <input type="text" id="mlName" placeholder="Nome do remetente" value="${esc(m.name||"ObraFlow")}">
   <span style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" id="mlSave">Guardar</button><button class="btn" id="mlTest"${m.configured?"":" disabled"}>Enviar email de teste</button></span></div>
  <p id="mlMsg" class="muted" style="margin:0;font-size:13px">${esc(mailMsg)}</p>`:`<p class="muted" style="margin:0;font-size:13px">Só o administrador configura o envio.</p>`}</section>`}
function wireMail(W){const say=t=>{mailMsg=t;const e=$("mlMsg");if(e)e.textContent=t};
 const sv=$("mlSave");if(sv)sv.onclick=async()=>{const key=$("mlKey").value.trim(),from=$("mlFrom").value.trim(),name=$("mlName").value.trim();
  if(!from||!/@/.test(from)){say("Escreve o email remetente (o mesmo que confirmaste no Brevo).");return}if(!key&&!(mailSt&&mailSt.configured)){say("Cola a chave API do Brevo.");return}
  const{error}=await sb.rpc("set_mail_config",{p_key:key,p_sender:from,p_name:name,p_site:location.href.split("#")[0].split("?")[0]});
  if(error){say("Não foi possível guardar: "+error.message);return}say("Guardado. Envia um email de teste.");mailSt=null;loadMailStatus()};
 const ts=$("mlTest");if(ts)ts.onclick=async()=>{ts.disabled=true;say("A enviar…");const{error}=await sb.rpc("mail_test");
  if(error){say("Não foi possível: "+error.message);ts.disabled=false;return}
  setTimeout(async()=>{const{data}=await sb.rpc("mail_last_result");const st=data&&data.status;
   say(st>=200&&st<300?`Enviado para ${S.me&&S.me.email}. Vê a caixa de correio (e o spam).`:st?`O Brevo recusou (código ${st}): ${String(data.body||"").slice(0,160)}. Confirma a chave e o remetente.`:"Pedido feito. Vê a caixa de correio daqui a um minuto.");ts.disabled=false},4000)}}

/* =========================================================
   Importar os dados da Planta de Obra (Claude) ou uma cópia de segurança
   ========================================================= */
function dataSection(){if(!isMgr())return"";
 return`<section class="block"><h2><span>Dados da obra</span></h2>
  <div class="datagrid">
   <div><b>Importar dados</b><p class="muted">Escolhe o ficheiro .zip criado na Planta de Obra do Claude (Coordenação → Exportar tudo) ou uma cópia de segurança desta app. Os pisos, plantas, equipamentos, fotos, anomalias e histórico ficam nesta obra. Importar o mesmo ficheiro duas vezes não duplica nada.</p>
    <label class="btn primary" for="impIn">Importar .zip…</label><input id="impIn" type="file" accept=".zip,application/zip" hidden></div>
   <div><b>Cópia de segurança</b><p class="muted">Descarrega tudo (dados e ficheiros) num .zip para guardares no computador.</p><button class="btn" id="exApp">Descarregar cópia (.zip)</button></div>
  </div><p id="exAppMsg" class="muted" style="margin:0;font-size:13px">${esc(dataMsg)}</p></section>`}
let dataMsg="";
function offlineSection(){
 return`<section class="block"><h2><span>Usar sem rede</span></h2>
  <p class="muted" style="margin:0;font-size:13px">A app guarda neste aparelho tudo o que abres. Antes de ir para uma zona sem rede, carrega aqui para guardar as plantas e fotos dos pisos e o leitor de etiquetas. O que fizeres sem rede é enviado sozinho quando a ligação voltar.</p>
  <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><select id="offPlan" aria-label="Piso"><option value="*">Todos os pisos</option>${S.plans.map(p=>`<option value="${esc(p.id)}"${p.id===S.planId?" selected":""}>${esc(p.name)}</option>`).join("")}</select>
   <button class="btn primary" id="offGo">Preparar para usar sem rede</button><span id="offMsg" class="muted" style="font-size:13px"></span></div></section>`}
function wireData(W){const ii=$("impIn");if(ii)ii.onchange=e=>{const f=e.target.files[0];e.target.value="";if(f)importZip(f)};
 const xa=$("exApp");if(xa)xa.onclick=()=>exportAll(xa);
 const og=$("offGo");if(og)og.onclick=async()=>{const sel=$("offPlan").value;const ps=sel==="*"?S.plans:S.plans.filter(p=>p.id===sel);const msg=$("offMsg");og.disabled=true;
  try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{});
   let ok=0,tot=0;for(const p of ps){const r=await keepOffline(p,(k,n)=>{msg.textContent=`${p.name}: ficheiro ${k} de ${n}…`});ok+=r.ok;tot+=r.total}
   msg.textContent="A preparar o leitor de etiquetas…";let rd=true;try{await prepareReader()}catch(e){rd=false}
   msg.textContent=`Pronto: ${ok} de ${tot} ficheiros guardados neste aparelho${rd?", leitor de etiquetas pronto":", o leitor de etiquetas precisa de rede para ser preparado"}.`}
  catch(e){msg.textContent="Parou: "+(e.message||"erro")}finally{og.disabled=false}}}
async function importZip(file){const say=t=>{dataMsg=t;const m=$("exAppMsg");if(m)m.textContent=t};
 if(!window.JSZip){toast("Leitor de .zip indisponível.");return}
 try{say("A abrir o ficheiro…");const zip=await JSZip.loadAsync(file);const dj=zip.file("data.json");if(!dj)throw new Error("o .zip não tem data.json (não é uma exportação da Planta de Obra)");
  const D=JSON.parse(await dj.async("string"));if(D.format!=="planta-obra-export")throw new Error("formato desconhecido");
  const map={};const ents=Object.entries(D.files||{});let k=0,miss=0;
  for(const[ref,f]of ents){k++;say(`A importar ficheiros: ${k} de ${ents.length}…`);const zf=zip.file("files/"+f.name);if(!zf){miss++;continue}
   const b=await zf.async("blob");map[ref]=await putFile(new Blob([b],{type:f.type||"image/jpeg"}),f.type||"image/jpeg")}
  const R=r=>r?(map[r]||(/^(sb:|data:)/.test(r)?r:null)):r;
  let n=0;const tot=(D.plans||[]).length+(D.items||[]).length+(D.issues||[]).length;
  const step=()=>{n++;if(n%25===0)say(`A importar registos: ${n} de ${tot}…`)};
  for(const p0 of D.plans||[]){const{id,...p}=p0;p.img=R(p.img);p.pdf=R(p.pdf);if(p.ov)p.ov={...p.ov,ref:R(p.ov.ref)};if(p.fw)p.fw={...p.fw,img:R(p.fw.img)};await api.set("plans",id,p);step()}
  for(const i0 of D.items||[]){const{id,...i}=i0;i.photos=(i.photos||[]).map(R).filter(Boolean);await api.set("items",id,i);step()}
  for(const x0 of D.issues||[]){const{id,...x}=x0;x.photo=R(x.photo)||null;await api.set("issues",id,x);step()}
  const pr=D.project||{};const{clients,...keep}=pr;await api.set("meta","project",{...S.meta,...keep,name:S.meta.name||pr.name||""});
  const people={...((L.meta.people||{}).map||{}),...(D.people||{})};await api.set("meta","people",{map:people});
  say(`Importado: ${(D.plans||[]).length} pisos, ${(D.items||[]).length} equipamentos, ${(D.issues||[]).length} anomalias, ${ents.length-miss} ficheiros${miss?` (${miss} em falta no .zip)`:""}. ${S.demo?"":"O envio para o servidor continua em segundo plano (vê o estado no topo)."}`);
  toast("Dados importados.");S.planId=null;pickPlan();render()}
 catch(e){say("Não foi possível importar: "+(e.message||"erro"))}}
async function exportAll(btn){if(!window.JSZip){toast("Compressor indisponível.");return}btn.disabled=true;const msg=$("exAppMsg");
 try{const zip=new JSZip();const refs=new Set();
  for(const p of S.plans){for(const k of["img","pdf"])if(p[k])refs.add(p[k]);if(p.ov&&p.ov.ref)refs.add(p.ov.ref);if(p.fw&&p.fw.img)refs.add(p.fw.img)}
  for(const i of S.items)(i.photos||[]).forEach(r=>refs.add(r));for(const x of S.issues)if(x.photo)refs.add(x.photo);
  const ids=new Set();S.items.forEach(i=>{[i.createdBy,i.updatedBy,i.assignee].forEach(v=>v&&ids.add(v));(i.log||[]).forEach(e=>{e.by&&ids.add(e.by);e.u&&ids.add(e.u)})});
  S.issues.forEach(x=>[x.createdBy,x.assignee,x.resolvedBy].forEach(v=>v&&ids.add(v)));S.plans.forEach(p=>(p.assignees||[]).forEach(v=>ids.add(v)));
  const people={};ids.forEach(id=>{people[id]=nameOf(id)});
  const files={};let k=0,fail=0;const list=[...refs];
  for(const r of list){k++;if(msg)msg.textContent=`A juntar ficheiros: ${k} de ${list.length}…`;btn.textContent=`A preparar ${k}/${list.length}…`;
   try{const b=await blobOf(r);const ext=fileExt(b.type);const name=`f${k}.${ext}`;zip.file("files/"+name,b);files[r]={name,type:b.type||"image/jpeg"}}catch(e){fail++}}
  const strip=o=>JSON.parse(JSON.stringify(o));
  zip.file("data.json",JSON.stringify({format:"planta-obra-export",version:1,exportedAt:now(),project:strip(S.meta),people,files,plans:S.plans.map(strip),items:S.items.map(strip),issues:S.issues.map(strip)},null,1));
  if(msg)msg.textContent="A comprimir…";const blob=await zip.generateAsync({type:"blob",compression:"STORE"});
  if(msg)msg.textContent=`Cópia pronta: ${S.plans.length} pisos, ${S.items.length} equipamentos, ${list.length-fail} ficheiros${fail?` (${fail} não disponíveis neste aparelho)`:""}.`;
  await saveBlob(`Obra_${slug()}.zip`,blob)}
 catch(e){if(msg)msg.textContent="Não foi possível exportar: "+(e.message||"erro")}finally{btn.disabled=false;btn.textContent="Descarregar cópia (.zip)"}}

/* descarregar ficheiros (funciona no computador, Android e iPhone) */
async function saveBlob(name,blob){
 try{const f=new File([blob],name,{type:blob.type||"application/octet-stream"});
  if(/iPhone|iPad|iPod/.test(navigator.userAgent)&&navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:name});return}}catch(e){if(e&&e.name==="AbortError")return}
 const u=URL.createObjectURL(blob);const a=document.createElement("a");a.href=u;a.download=name;a.rel="noopener";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000);toast("Ficheiro descarregado: "+name)}
async function saveFile(name,text){const t=/\.csv$/i.test(name)?"text/csv;charset=utf-8":/\.html?$/i.test(name)?"text/html;charset=utf-8":"text/plain;charset=utf-8";return saveBlob(name,new Blob([text],{type:t}))}

/* =========================================================
   Leitura de etiquetas com IA (Google Gemini, plano gratuito)
   ========================================================= */
let aiMsg="";
function aiSection(){if(!isMgr())return"";const a=aiCfg();
 return`<section class="block" id="aiSec"><h2><span>Leitura de etiquetas com IA</span><span class="pill" style="--c:${a?"var(--ok)":"var(--muted)"}">${a?"Ligada":"Desligada"}</span></h2>
  <p class="muted" style="margin:0;font-size:13px">Opcional. Com uma chave gratuita da Google (Gemini), as fotos são lidas por IA quando há rede: lê muito melhor fotos desfocadas, de lado ou tiradas a um ecrã. Sem rede, ou se a IA falhar, a app usa o leitor do telemóvel. As fotos enviadas para leitura passam pelos servidores da Google.</p>
  <ol class="muted" style="margin:0;font-size:13px;padding-left:18px"><li>Abre <b>aistudio.google.com/apikey</b> com a tua conta Google e carrega em <b>Create API key</b>.</li><li>Copia a chave (começa por <b>AIza…</b>) e cola-a aqui.</li><li>Carrega em <b>Guardar</b> e depois em <b>Testar</b>.</li></ol>
  <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
   <input type="password" id="aiKey" autocomplete="off" placeholder="${a?"Chave guardada (…"+esc(a.key.slice(-4))+"). Cola outra para trocar":"Cola aqui a chave AIza…"}" style="flex:1;min-width:220px;border:1px solid var(--line);border-radius:6px;padding:7px 9px;background:var(--panel)">
   <select id="aiModel" aria-label="Modelo" style="border:1px solid var(--line);border-radius:6px;padding:6px 8px;background:var(--panel)">${AI_MODELS.map(m=>`<option${a&&a.model===m?" selected":""}>${m}</option>`).join("")}</select>
   <button class="btn primary" id="aiSave">Guardar</button><button class="btn" id="aiTest"${a?"":" disabled"}>Testar</button>${a?`<button class="btn danger" id="aiDel">Desligar</button>`:""}</div>
  <p id="aiMsg" class="muted" style="margin:0;font-size:13px">${esc(aiMsg)}</p>
  <p class="muted" style="margin:0;font-size:12px">A chave fica guardada na base de dados da obra e só as contas aprovadas a recebem. Para mais segurança, no Google Cloud podes limitar a chave ao endereço da app.</p></section>`}
function wireAi(W){const say=t=>{aiMsg=t;const m=$("aiMsg");if(m)m.textContent=t};
 const sv=$("aiSave");if(sv)sv.onclick=async()=>{const k=$("aiKey").value.trim();const model=$("aiModel").value;const old=aiCfg();
  if(!k&&!old){say("Cola primeiro a chave.");return}if(k&&!/^[A-Za-z0-9_\-]{20,}$/.test(k)){say("Esta chave não parece válida. Copia-a de novo do Google AI Studio.");return}
  await api.set("meta","ai",{key:k||old.key,model,by:S.meId,at:now()});say("Guardado. Carrega em Testar para confirmar.");render()};
 const ts=$("aiTest");if(ts)ts.onclick=async()=>{ts.disabled=true;say("A testar com uma etiqueta de exemplo (ID: 4EB655)…");
  try{const cv=document.createElement("canvas");cv.width=640;cv.height=260;const x=cv.getContext("2d");x.fillStyle="#f4f4f0";x.fillRect(0,0,640,260);x.fillStyle="#111";x.font="bold 34px Arial";x.fillText("DETECTOR OPTICO",40,70);x.font="30px monospace";x.fillText("25/51  ID: 4EB655",40,150);x.font="20px Arial";x.fillText("EN 54-7  0786-CPR-21",40,210);
   const b=await new Promise(r=>cv.toBlob(r,"image/jpeg",.9));const o=await aiRead([b]);
   say(o&&String(o.id||"").toUpperCase()==="4EB655"?`A funcionar: a IA leu ID 4EB655 (modelo ${o.model}).`:`A IA respondeu, mas leu "${o&&o.id}". Experimenta outro modelo.`)}
  catch(e){say("Não funcionou: "+(e.message||"erro")+".")}finally{ts.disabled=false}};
 const dl=$("aiDel");if(dl)dl.onclick=async()=>{await api.set("meta","ai",{});say("Leitura com IA desligada.");render()}}

/* =========================================================
   Captura de ecrã: escolher janela/ecrã (ex.: Fieldwire, email,
   PDF) e recortar a etiqueta; ou colar uma captura (Ctrl+V)
   ========================================================= */
const canShot=!!(navigator.mediaDevices&&navigator.mediaDevices.getDisplayMedia);
async function screenShot(){const it=cur();if(!it){toast("Seleciona primeiro um equipamento.");return}const id=it.id;
 if($("dlgPhoto").open)$("dlgPhoto").close();
 if(!canShot){await pasteShot(id);return}
 let st;try{st=await navigator.mediaDevices.getDisplayMedia({video:{displaySurface:"window"},audio:false,selfBrowserSurface:"include",surfaceSwitching:"exclude"})}
 catch(e){if(!e||e.name!=="NotAllowedError")toast("Não foi possível capturar o ecrã neste navegador.");return}
 try{const v=document.createElement("video");v.srcObject=st;v.muted=true;v.playsInline=true;await v.play();await new Promise(r=>setTimeout(r,400));
  const cv=document.createElement("canvas");cv.width=v.videoWidth;cv.height=v.videoHeight;cv.getContext("2d").drawImage(v,0,0);openCrop(cv,id)}
 catch(e){toast("Não foi possível capturar o ecrã.")}finally{st.getTracks().forEach(t=>t.stop())}}
async function pasteShot(id){try{if(!navigator.clipboard||!navigator.clipboard.read)throw 0;const items=await navigator.clipboard.read();
  for(const i of items){const t=i.types.find(x=>x.startsWith("image/"));if(t){const b=await i.getType(t);const im=await createImageBitmap(b);const cv=document.createElement("canvas");cv.width=im.width;cv.height=im.height;cv.getContext("2d").drawImage(im,0,0);openCrop(cv,id);return}}
  toast("Não há nenhuma imagem copiada. Faz a captura (no computador: Win+Shift+S; no telemóvel: botões de ligar + volume) e tenta de novo, ou usa Carregar ficheiro.")}
 catch(e){toast("Faz a captura e cola com Ctrl+V. No telemóvel: tira a captura com os botões e escolhe-a em Carregar ficheiro.")}}
let crop=null;
function openCrop(cv,itemId,mode){const D=$("dlgCrop"),box=$("crBox"),im=$("crImg"),sel=$("crSel");crop={cv,itemId,r:null,mode:mode||"photo"};
 im.src=cv.toDataURL("image/png");sel.hidden=true;$("crUse").textContent=crop.mode==="read"?"Ler a foto toda":"Usar a captura toda";$("crTitle").textContent=crop.mode==="read"?"Recortar a zona do ID":"Recortar a etiqueta";D.showModal();
 let st=null;const pt=e=>{const r=im.getBoundingClientRect();return{x:Math.max(0,Math.min(r.width,e.clientX-r.left)),y:Math.max(0,Math.min(r.height,e.clientY-r.top)),w:r.width,h:r.height}};
 box.onpointerdown=e=>{e.preventDefault();box.setPointerCapture(e.pointerId);st=pt(e);crop.r=null;sel.hidden=true};
 box.onpointermove=e=>{if(!st)return;const p=pt(e);const x=Math.min(st.x,p.x),y=Math.min(st.y,p.y),w=Math.abs(p.x-st.x),h=Math.abs(p.y-st.y);
  sel.hidden=false;sel.style.cssText=`left:${x+im.offsetLeft}px;top:${y+im.offsetTop}px;width:${w}px;height:${h}px`;crop.r={x:x/p.w,y:y/p.h,w:w/p.w,h:h/p.h}};
 box.onpointerup=()=>{st=null;if(crop.r&&(crop.r.w<.01||crop.r.h<.01)){crop.r=null;sel.hidden=true}$("crUse").textContent=crop.r?(crop.mode==="read"?"Ler a zona selecionada":"Usar a zona selecionada"):(crop.mode==="read"?"Ler a foto toda":"Usar a captura toda")}}
$("crCancel").onclick=()=>{crop=null;$("dlgCrop").close()};
$("crUse").onclick=async()=>{if(!crop)return;const{cv,itemId,r}=crop;let out=cv;
 if(r){const x=Math.round(r.x*cv.width),y=Math.round(r.y*cv.height),w=Math.max(8,Math.round(r.w*cv.width)),h=Math.max(8,Math.round(r.h*cv.height));
  out=document.createElement("canvas");out.width=w;out.height=h;out.getContext("2d").drawImage(cv,x,y,w,h,0,0,w,h)}
 // etiquetas pequenas: aumentar para a leitura ficar mais fiável
 if(Math.max(out.width,out.height)<900){const k=900/Math.max(out.width,out.height);const up=document.createElement("canvas");up.width=Math.round(out.width*k);up.height=Math.round(out.height*k);const c=up.getContext("2d");c.imageSmoothingQuality="high";c.drawImage(out,0,0,up.width,up.height);out=up}
 const mode=crop.mode;$("dlgCrop").close();crop=null;
 const b=await new Promise(res=>out.toBlob(res,"image/jpeg",.92));const it=S.items.find(i=>i.id===itemId);if(!it||!b)return;
 if(mode==="read"){readLabel(itemId,true,[b],{crop:true});return}
 addPhotos(it,[new File([b],"captura.jpg",{type:"image/jpeg"})])};
$("dpShot").onclick=()=>screenShot();
if(!canShot){const s=$("dpShot").querySelector("small");if(s)s.textContent="Cola uma captura que já tenhas copiado"}

/* =========================================================
   Início: apresentação do projeto, pastas e plantas
   ========================================================= */
let uploadFolder=null;
function folders(){const f=L.meta&&L.meta.folders;return((f&&f.list)||[]).slice().sort((a,b)=>(a.order||0)-(b.order||0)||String(a.name).localeCompare(String(b.name),"pt",{numeric:true}))}
function folderName(id){const f=folders().find(x=>x.id===id);return f?f.name:""}
function plansIn(fid){const ids=new Set(folders().map(f=>f.id));return S.plans.filter(p=>fid?p.folder===fid:!(p.folder&&ids.has(p.folder)))}
async function saveFolders(list){await api.set("meta","folders",{list})}
/* seletor de plantas agrupado por pasta */
function planOptionsHtml(){const opt=x=>{const mine=(x.assignees||[]).includes(S.meId);return`<option value="${esc(x.id)}">${mine?"● ":""}${esc(x.name)}</option>`};
 const fs=folders();if(!fs.length)return S.plans.map(opt).join("");
 let h=fs.map(f=>{const ps=plansIn(f.id);return ps.length?`<optgroup label="${esc(f.name)}">${ps.map(opt).join("")}</optgroup>`:""}).join("");
 const loose=plansIn(null);if(loose.length)h+=`<optgroup label="Sem pasta">${loose.map(opt).join("")}</optgroup>`;return h}
/* miniaturas das plantas (geradas e guardadas só neste aparelho) */
const thumbUrl={},thumbWait={};
async function thumbOf(ref){if(!ref)return"";if(thumbUrl[ref])return thumbUrl[ref];if(thumbWait[ref])return thumbWait[ref];
 thumbWait[ref]=(async()=>{const key="thumb:"+ref;let b=await IDBX.get("files",key).catch(()=>null);
  if(!b){const src=await blobOf(ref);const bm=await createImageBitmap(src);const k=Math.min(1,520/Math.max(bm.width,bm.height));const cv=document.createElement("canvas");cv.width=Math.round(bm.width*k);cv.height=Math.round(bm.height*k);
   const cx=cv.getContext("2d");cx.fillStyle="#fff";cx.fillRect(0,0,cv.width,cv.height);cx.drawImage(bm,0,0,cv.width,cv.height);b=await new Promise(r=>cv.toBlob(r,"image/jpeg",.8));IDBX.put("files",key,b).catch(()=>{})}
  thumbUrl[ref]=URL.createObjectURL(b);return thumbUrl[ref]})();
 try{return await thumbWait[ref]}finally{delete thumbWait[ref]}}
function hydrateThumbs(root){root.querySelectorAll("img[data-thumb]").forEach(im=>{const r=im.dataset.thumb;if(im.dataset.done===r)return;im.dataset.done=r;
 thumbOf(r).then(u=>{im.src=u;im.parentElement.classList.add("ok")}).catch(()=>{im.parentElement.classList.add("off")})})}
const homeOpen=(()=>{try{return JSON.parse(localStorage.getItem("cp-folders-closed")||"{}")}catch(e){return{}}})();
function renderHome(){const W=$("homeWrap");const its=S.items,c=counts(its),openI=S.issues.filter(x=>x.status!=="resolvida");
 const mine=its.filter(i=>i.assignee===S.meId&&isTodo(i)).length,un=its.filter(i=>i.x==null).length;
 const last=S.plans.find(p=>p.id===S.planId)||S.plans[0];
 const fs=folders();const groups=fs.map(f=>({id:f.id,name:f.name,plans:plansIn(f.id)}));const loose=plansIn(null);
 if(loose.length||!fs.length)groups.push({id:"",name:fs.length?"Sem pasta":"Plantas",plans:loose});
 const card=p=>{const pi=its.filter(i=>i.planId===p.id),pc=counts(pi),oi=openI.filter(x=>x.planId===p.id).length,st=(p.close&&p.close.status)||"aberto";
  return`<div class="pcard" data-open="${esc(p.id)}" tabindex="0" role="button" aria-label="Abrir ${esc(p.name)}">
   <div class="pthumb"><img data-thumb="${esc(p.img||"")}" alt=""><span class="pdoc">${p.pdf?"PDF":"IMG"}</span>${oi?`<span class="pbad">${oi} anomalia${oi>1?"s":""}</span>`:""}</div>
   <div class="pbody"><b>${esc(p.name)}</b>${stackBar(pi)}<div class="pmeta"><span>${pc.total} equip.</span><span>${pct(pc.ge(3),pc.total)}% testado</span>${st!=="aberto"?`<span>${FLOOR_ST[st]}</span>`:""}</div>
   ${S.canWrite&&fs.length?`<select class="pmove" data-move="${esc(p.id)}" aria-label="Mover para a pasta"><option value="">Sem pasta</option>${fs.map(f=>`<option value="${esc(f.id)}"${p.folder===f.id?" selected":""}>${esc(f.name)}</option>`).join("")}</select>`:""}</div></div>`};
 const withId=its.filter(i=>String(i.devId||"").trim()||String(i.mac||"").trim()).length,noId=c.total-withId,photos=its.filter(i=>(i.photos||[]).length).length;
 const td=today(),newToday=its.filter(i=>dayOf(i.createdAt)===td).length,late=its.filter(isLate).length;
 W.innerHTML=`
 <div class="crumb"><span>Projetos</span><span>›</span><b>${esc(S.meta.name||"A minha obra")}</b></div>
 <div class="phead"><div><h2>${esc(S.meta.name||"A minha obra")} <span class="stchip">${c.total&&c.aceite===c.total?"Entregue":"Em andamento"}</span></h2>
   <p>${S.plans.length} planta${S.plans.length===1?"":"s"} · ${c.total} equipamentos${fs.length?` · ${fs.length} pasta${fs.length===1?"":"s"}`:""}${S.me&&!S.demo?` · ${esc(S.me.name||"")} · ${esc(ROLE_N[S.role]||"")}`:""}</p></div>
  <div class="toolrow">${last?`<button class="btn" id="hmGo">Abrir ${esc(last.name)} →</button>`:""}${S.canWrite?`<button class="btn primary" id="hmNewP2">+ Nova planta</button>`:""}</div></div>
 <div class="kpis">
  ${kpi("var(--accent)",'<path d="M4 6h16M4 12h16M4 18h10"/>',"Total de equipamentos",c.total,newToday?`+${newToday} hoje`:"&nbsp;",null,"hmK1")}
  ${kpi("var(--ok)",'<path d="M20 6L9 17l-5-5"/>',"Com ID identificado",withId,`${pct(withId,c.total)}% do total`,pct(withId,c.total),"hmK2")}
  ${kpi("#9333ea",'<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>',"Pendentes de ID",noId,`${pct(noId,c.total)}% do total`,pct(noId,c.total),"hmK3")}
  ${kpi("var(--warn)",'<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',"Anomalias abertas",openI.length,"ver lista",null,"hmIss")}
  ${kpi("#0891b2",'<rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/>',"Com fotos",photos,`${pct(photos,c.total)}% do total`,pct(photos,c.total),"hmK5")}
 </div>
 <div class="homegrid">
  <div class="card hcard"><h3>Progresso por etapa</h3>${stackBar(its)}
   <div class="stlegend">${STAGES.map(st=>`<span style="--c:${st.c}"><i></i>${st.n} <b>${c[st.k]||0}</b></span>`).join("")}</div>
   <div class="hmini"><button type="button" class="${mine?"warn":""}" id="hmMine"><span>Os meus por fazer</span><b>${mine}</b></button><div><span>Em atraso</span><b class="${late?"bad":""}">${late}</b></div><div><span>Por colocar na planta</span><b>${un}</b></div><div><span>Testados</span><b>${pct(c.ge(3),c.total)}%</b></div></div></div>
  <div class="card hcard"><h3><span>Atividade recente</span><button class="linkb" id="hmFeed">ver tudo</button></h3><div class="hfeed">${feedItems().slice(0,6).map(e=>`<div class="fe" data-fit="${esc(e.item||"")}"><span class="ini" style="--h:${hue(e.by||"x")}">${esc(initials(nameOf(e.by)))}</span><div><b>${esc(nameOf(e.by))}</b> ${esc(e.t)}<small>${esc(e.code||"")}${e.code?" · ":""}${fmtDate(e.at)}</small></div></div>`).join("")||`<div class="empty">Sem atividade ainda.</div>`}</div></div>
 </div>
 <section class="block"><h2><span>Pastas e plantas</span>${S.canWrite?`<span class="hacts"><button class="btn" id="hmNewF">+ Nova pasta</button><button class="btn primary" id="hmNewP">+ Planta</button></span>`:""}</h2>
  ${!S.plans.length?`<div class="empty">Ainda não há plantas. ${S.canWrite?"Cria uma pasta (ex.: <b>Piso 3</b>, <b>AVAC</b>, <b>Incêndio</b>) e carrega as plantas em PDF ou imagem.":""}</div>`:""}
  ${groups.map(g=>{const closed=!!homeOpen[g.id||"_"];return`<div class="folder${closed?" closed":""}">
   <div class="fhead"><button type="button" class="ftog" data-tog="${esc(g.id||"_")}" aria-expanded="${!closed}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.3l2 2h8.7A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z"/></svg><b>${esc(g.name)}</b><span class="fcount">${g.plans.length}</span></button>
    ${S.canWrite?`<span class="facts">${g.id?`<button class="btn sm" data-fedit="${esc(g.id)}">Renomear</button>`:""}<button class="btn sm" data-fadd="${esc(g.id)}">+ Planta</button></span>`:""}</div>
   <div class="pgrid">${g.plans.map(card).join("")||`<div class="none">Pasta vazia. ${S.canWrite?"Carrega em + Planta para juntar plantas.":""}</div>`}</div></div>`}).join("")}
 </section>`;
 hydrateThumbs(W);
 W.querySelectorAll("[data-fit]").forEach(el=>el.onclick=()=>{if(el.dataset.fit)openItem(el.dataset.fit)});
 const hf=$("hmFeed");if(hf)hf.onclick=e=>{e.stopPropagation();openFeed()};
 const np2=$("hmNewP2");if(np2)np2.onclick=()=>{uploadFolder=null;replacing=null;$("planIn").click()};
 $("hmK1").onclick=()=>go("equip");$("hmK2").onclick=()=>go("ids");$("hmK3").onclick=()=>{IDF.only="noid";go("ids")};$("hmK5").onclick=()=>go("equip");
 const goP=id=>{S.planId=id;S.sel=null;S.view="obra";loadedPlan=null;render();setTimeout(fit,60)};
 W.querySelectorAll("[data-open]").forEach(el=>{el.onclick=e=>{if(e.target.closest("select"))return;goP(el.dataset.open)};el.onkeydown=e=>{if(e.key==="Enter")goP(el.dataset.open)}});
 const hg=$("hmGo");if(hg)hg.onclick=()=>goP(last.id);
 $("hmMine").onclick=()=>{S.filter="mine";const m=its.find(i=>i.assignee===S.meId&&isTodo(i));if(m)S.planId=m.planId;S.view="obra";loadedPlan=null;render();setTimeout(fit,60)};
 $("hmIss").onclick=()=>go("issues");
 W.querySelectorAll("[data-tog]").forEach(b=>b.onclick=()=>{const k=b.dataset.tog;homeOpen[k]=!homeOpen[k];try{localStorage.setItem("cp-folders-closed",JSON.stringify(homeOpen))}catch(e){}b.closest(".folder").classList.toggle("closed",!!homeOpen[k]);b.setAttribute("aria-expanded",!homeOpen[k])});
 W.querySelectorAll("[data-move]").forEach(s=>{s.onclick=e=>e.stopPropagation();s.onchange=()=>{api.update("plans",s.dataset.move,{folder:s.value||null});toast(s.value?"Planta movida para "+folderName(s.value):"Planta tirada da pasta")}});
 W.querySelectorAll("[data-fadd]").forEach(b=>b.onclick=()=>{uploadFolder=b.dataset.fadd||null;replacing=null;$("planIn").click()});
 W.querySelectorAll("[data-fedit]").forEach(b=>b.onclick=()=>openFolder(b.dataset.fedit));
 const nf=$("hmNewF");if(nf)nf.onclick=()=>openFolder(null);
 const np=$("hmNewP");if(np)np.onclick=()=>{uploadFolder=null;replacing=null;$("planIn").click()}}
/* criar / renomear / apagar pasta */
let fdFor=null,fdArmed=false;
function openFolder(id){fdFor=id;fdArmed=false;const f=folders().find(x=>x.id===id);$("fdTitle").textContent=f?"Pasta: "+f.name:"Nova pasta";$("fdName").value=f?f.name:"";
 $("fdDel").hidden=!f||!S.isCoord;$("fdDel").textContent="Apagar pasta";$("fdDel").classList.remove("armed");$("dlgFolder").showModal();setTimeout(()=>$("fdName").focus(),50)}
$("fdCancel").onclick=()=>$("dlgFolder").close();
$("fdOk").onclick=async()=>{const n=$("fdName").value.trim();if(!n){$("fdName").focus();return}const list=folders();
 if(fdFor){const f=list.find(x=>x.id===fdFor);if(f)f.name=n}else list.push({id:uid(),name:n,order:list.length});
 await saveFolders(list);$("dlgFolder").close();toast(fdFor?"Pasta renomeada":"Pasta criada: "+n);render()};
$("fdName").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();$("fdOk").click()}};
$("fdDel").onclick=async()=>{const n=plansIn(fdFor).length;if(!fdArmed){fdArmed=true;$("fdDel").classList.add("armed");$("fdDel").textContent=n?`Confirmar: apagar a pasta (as ${n} plantas ficam em Sem pasta)`:"Confirmar apagar";return}
 for(const p of plansIn(fdFor))await api.update("plans",p.id,{folder:null});await saveFolders(folders().filter(f=>f.id!==fdFor));$("dlgFolder").close();toast("Pasta apagada");render()};
/* pasta da planta no diálogo Pisos */
(()=>{const open0=$("btnFloor").onclick,close0=$("flClose").onclick;
 $("btnFloor").onclick=()=>{open0();const p=plan();const sel=$("flFolder");sel.innerHTML=`<option value="">Sem pasta</option>`+folders().map(f=>`<option value="${esc(f.id)}">${esc(f.name)}</option>`).join("");sel.value=p&&p.folder||"";sel.disabled=!p;$("flFolderWrap").hidden=!folders().length};
 $("flClose").onclick=()=>{const p=plan(),v=$("flFolder").value||null;if(p&&(p.folder||null)!==v&&folders().length)api.update("plans",p.id,{folder:v});close0()};
 $("flAdd").onclick=()=>{replacing=null;const p=plan();uploadFolder=p&&p.folder||null}})();

function kpi(c,ic,label,val,sub,bar,id){return`<button type="button" class="kpi" id="${id}" style="--c:${c}"><span class="ki"><svg viewBox="0 0 24 24">${ic}</svg></span><span class="kb"><span>${label}</span><b>${val}</b><small>${sub}</small>${bar!=null?`<span class="kbar"><i style="width:${bar}%"></i></span>`:""}</span></button>`}

/* =========================================================
   Trocar a planta de um piso sem perder a posição dos IDs
   - "mesmo enquadramento": revisão do desenho com a mesma folha → posições mantêm-se
   - "alinhar com 2 pontos": desenho recortado, com outra escala ou rodado → as posições
     são recalculadas a partir de 2 pontos de referência marcados nas duas plantas
   A planta anterior fica guardada e pode ser reposta.
   ========================================================= */
S.swap=null;   // {pid, nd:{img,pdf,page,w,h}, od:{...}, stage:1|2|3, show:"old"|"new", src:[], dst:[], T}
function simFrom(src,dst){const[s1,s2]=src,[d1,d2]=dst;const sx=s2.x-s1.x,sy=s2.y-s1.y,dx=d2.x-d1.x,dy=d2.y-d1.y,den=sx*sx+sy*sy;if(den<25)return null;
 const a=(dx*sx+dy*sy)/den,b=(dy*sx-dx*sy)/den;return[a,b,d1.x-(a*s1.x-b*s1.y),d1.y-(b*s1.x+a*s1.y)]}
const simApply=(T,x,y)=>({x:T[0]*x-T[1]*y+T[2],y:T[1]*x+T[0]*y+T[3]});
const simCompose=(S2,T1)=>[S2[0]*T1[0]-S2[1]*T1[1],S2[0]*T1[1]+S2[1]*T1[0],S2[0]*T1[2]-S2[1]*T1[3]+S2[2],S2[1]*T1[2]+S2[0]*T1[3]+S2[3]];
function simInv(T){const[a,b,tx,ty]=T,d=a*a+b*b,ia=a/d,ib=-b/d;return[ia,ib,-(ia*tx-ib*ty),-(ib*tx+ia*ty)]}
/* posição de um equipamento na planta que está a ser mostrada (na pré-visualização da troca) */
function swapPos(it){const W=S.swap;if(!W||W.show!=="new"||W.pid!==it.planId||!W.T)return{x:it.x,y:it.y};
 const q=simApply(W.T,it.x*W.od.w,it.y*W.od.h);return{x:q.x/W.nd.w,y:q.y/W.nd.h}}
function swapHidesPins(){const W=S.swap;return !!(W&&W.show==="new"&&!W.T)}
function swapHint(){const W=S.swap;const n=(W.stage===1?W.src:W.dst).length+1;
 if(W.stage===1)return`<b>Trocar planta · 1/3:</b> na planta <b>atual</b>, toca no <b>ponto ${n} de 2</b> (ex.: canto de um pilar, eixo de uma porta). Usa pontos afastados. <button class="btn sm" id="swCancel">Cancelar</button>`;
 if(W.stage===2)return`<b>Trocar planta · 2/3:</b> agora na planta <b>nova</b>, toca no <b>mesmo ponto ${n}</b>. <button class="btn sm" id="swRedo">Recomeçar</button> <button class="btn sm" id="swCancel">Cancelar</button>`;
 const out=swapOutside();
 return`<b>Trocar planta · 3/3:</b> confere se os IDs ficaram no sítio certo na planta nova.${out?` <span style="color:var(--warn)">${out} ficam fora da planta.</span>`:""}
  <span style="display:inline-flex;gap:6px;flex-wrap:wrap;margin-top:4px"><button class="btn sm primary" id="swApply">Aplicar</button><button class="btn sm" id="swOld">${W.show==="new"?"Ver planta antiga":"Ver planta nova"}</button><button class="btn sm" id="swRedo">Refazer pontos</button><button class="btn sm" id="swCancel">Cancelar</button></span>`}
function swapOutside(){const W=S.swap;if(!W||!W.T)return 0;let n=0;for(const it of S.items)if(it.planId===W.pid&&it.x!=null){const q=simApply(W.T,it.x*W.od.w,it.y*W.od.h);if(q.x<0||q.y<0||q.x>W.nd.w||q.y>W.nd.h)n++}return n}
function wireSwapHint(){const W=S.swap;if(!W)return;
 const c=$("swCancel");if(c)c.onclick=()=>{S.swap=null;loadedPlan=null;render();toast("Troca cancelada. A planta não mudou.")};
 const r=$("swRedo");if(r)r.onclick=()=>{Object.assign(W,{stage:1,show:"old",src:[],dst:[],T:null});loadedPlan=null;render()};
 const o=$("swOld");if(o)o.onclick=()=>{W.show=W.show==="new"?"old":"new";loadedPlan=null;render()};
 const a=$("swApply");if(a)a.onclick=()=>commitSwap("pontos")}
function swapClick(e){const W=S.swap;const pt=toPlan(e);if(!pt)return;
 if(W.stage===1){W.src.push(pt);if(W.src.length===2){W.stage=2;W.show="new";loadedPlan=null;toast("Agora toca nos mesmos 2 pontos na planta nova.")}render();return}
 if(W.stage===2){W.dst.push(pt);if(W.dst.length===2){
   const T=simFrom(W.src.map(q=>({x:q.x*W.od.w,y:q.y*W.od.h})),W.dst.map(q=>({x:q.x*W.nd.w,y:q.y*W.nd.h})));
   if(!T){toast("Os dois pontos estão demasiado próximos. Escolhe pontos mais afastados.");Object.assign(W,{stage:1,show:"old",src:[],dst:[]});loadedPlan=null;render();return}
   W.T=T;W.stage=3}render()}}
function swapMarkers(frag,p){const W=S.swap;if(!W||W.pid!==p.id)return;const pts=W.show==="old"?W.src:W.stage>=2?W.dst:[];
 pts.forEach((q,i)=>{const el=document.createElement("div");el.className="alignpt swpt";el.dataset.n=i+1;el.style.left=q.x*p.w+"px";el.style.top=q.y*p.h+"px";el.style.scale=String(1/view.z);frag.appendChild(el)})}
/* carregar o ficheiro da planta nova */
async function swapFile(f){const p=plan();if(!p)return;const busy=$("busy");busy.hidden=false;
 try{let nd;
  if(f.type==="application/pdf"||/\.pdf$/i.test(f.name)){if(!window.pdfjsLib)throw new Error("leitor de PDF indisponível");busy.textContent="A abrir a planta nova…";
   const buf=await f.arrayBuffer();const doc=await openPdf(buf);let pdfRef=null;
   if(f.size<=50e6){pdfRef=await putFile(new Blob([buf],{type:"application/pdf"}),"application/pdf");pdfCache[pdfRef]=Promise.resolve(doc)}
   busy.textContent="A preparar a planta nova…";const r=await rasterPage(await doc.getPage(1));const img=await putFile(r.blob,"image/jpeg");
   nd={img,pdf:pdfRef,page:1,w:r.w,h:r.h};if(doc.numPages>1)toast(`O PDF tem ${doc.numPages} páginas: foi usada a página 1.`)}
  else{busy.textContent="A preparar a planta nova…";const im=new Image();const u=URL.createObjectURL(f);await new Promise((res,rej)=>{im.onload=res;im.onerror=()=>rej(new Error("imagem inválida"));im.src=u});
   let w=im.naturalWidth,h=im.naturalHeight;URL.revokeObjectURL(u);const raster=(f.size>15e6||!/^image\/(png|jpeg|webp|gif)$/.test(f.type))?await shrink(f,6000,.9):f;
   if(raster!==f){const t=await createImageBitmap(raster);w=t.width;h=t.height}nd={img:await putFile(raster,raster.type||"image/jpeg"),pdf:null,page:1,w,h}}
  S.swap={pid:p.id,nd,od:{img:p.img,pdf:p.pdf||null,page:p.page||1,w:p.w,h:p.h},stage:0,show:"old",src:[],dst:[],T:null};
  const same=Math.abs(nd.w/nd.h-p.w/p.h)<.01;
  $("swInfo").textContent=`Planta nova: ${nd.w}×${nd.h} px${same?" (mesma proporção da atual)":" (proporção diferente da atual: recomenda-se alinhar com 2 pontos)"}. ${planItems(p.id).filter(i=>i.x!=null).length} IDs colocados neste piso.`;
  $("swSame").classList.toggle("primary",same);$("swPts").classList.toggle("primary",!same);$("dlgSwap").showModal()}
 catch(err){S.swap=null;toast("Não foi possível usar a planta nova: "+(err.message||"erro"))}finally{busy.hidden=true}}
$("swSame").onclick=()=>{$("dlgSwap").close();commitSwap("igual")};
$("swPts").onclick=()=>{$("dlgSwap").close();Object.assign(S.swap,{stage:1,show:"old"});S.sel=null;S.mode="nav";S.view="obra";loadedPlan=null;render();setTimeout(fit,40)};
$("swNo").onclick=()=>{$("dlgSwap").close();S.swap=null;loadedPlan=null;render()};
async function commitSwap(mode){const W=S.swap;if(!W)return;const p=S.plans.find(x=>x.id===W.pid);if(!p){S.swap=null;return}
 const T=mode==="igual"?[W.nd.w/W.od.w,0,0,0]:W.T;  // "igual": as posições em percentagem mantêm-se
 const its=S.items.filter(i=>i.planId===p.id&&i.x!=null);let moved=0;
 if(mode!=="igual")for(const it of its){const q=simApply(T,it.x*W.od.w,it.y*W.od.h);const x=+(q.x/W.nd.w).toFixed(4),y=+(q.y/W.nd.h).toFixed(4);
  if(x!==it.x||y!==it.y){moved++;await api.update("items",it.id,logPatch(it,{x,y,updatedAt:now(),updatedBy:S.meId},"Planta trocada: posição ajustada"))}}
 const hist=[...(p.history||[]).slice(-9),{...W.od,at:now(),by:S.meId,mode,T}];
 const patch={...W.nd,history:hist,updatedAt:now()};
 if(p.ov&&p.ov.T)patch.ov={T:simCompose(T,p.ov.T)};if(p.fw&&p.fw.T)patch.fw={T:simCompose(T,p.fw.T)};
 await api.update("plans",p.id,patch);S.swap=null;loadedPlan=null;render();setTimeout(fit,60);
 toast(mode==="igual"?`Planta trocada. Os ${its.length} IDs mantêm a posição.`:`Planta trocada. ${moved} IDs reposicionados pelos 2 pontos de referência.`)}
async function revertSwap(){const p=plan();const h=p&&(p.history||[]).slice(-1)[0];if(!h)return;const cur={w:p.w,h:p.h};
 const Ti=h.mode==="igual"||!h.T?null:simInv(h.T);
 if(Ti)for(const it of S.items.filter(i=>i.planId===p.id&&i.x!=null)){const q=simApply(Ti,it.x*cur.w,it.y*cur.h);
  await api.update("items",it.id,logPatch(it,{x:+(q.x/h.w).toFixed(4),y:+(q.y/h.h).toFixed(4),updatedAt:now(),updatedBy:S.meId},"Planta anterior reposta: posição ajustada"))}
 const patch={img:h.img,pdf:h.pdf,page:h.page||1,w:h.w,h:h.h,history:(p.history||[]).slice(0,-1),updatedAt:now()};
 const Tb=h.T?simInv(h.T):null;if(Tb&&p.ov&&p.ov.T)patch.ov={T:simCompose(Tb,p.ov.T)};if(Tb&&p.fw&&p.fw.T)patch.fw={T:simCompose(Tb,p.fw.T)};
 await api.update("plans",p.id,patch);loadedPlan=null;render();setTimeout(fit,60);toast("Planta anterior reposta.")}
(()=>{const inp=document.createElement("input");inp.type="file";inp.accept="image/*,application/pdf";inp.hidden=true;inp.id="swapIn";$("dlgFloor").querySelector(".dlg").appendChild(inp);
 inp.onchange=e=>{const f=e.target.files[0];e.target.value="";$("dlgFloor").close();if(f)swapFile(f)};
 const rep=$("flReplace");rep.textContent="Trocar planta (manter os IDs no sítio)";rep.onclick=()=>inp.click();
 const open1=$("btnFloor").onclick;$("btnFloor").onclick=()=>{open1();const p=plan();const n=(p&&p.history||[]).length;const b=$("flRevert");b.hidden=!n||!S.canWrite;
  if(n){const h=p.history[n-1];b.textContent=`Repor planta anterior (${fmtDate(h.at)})`}};
 $("flRevert").onclick=()=>{$("dlgFloor").close();revertSwap()}})();

/* =========================================================
   Assinalar no desenho: caneta, seta, linha, retângulo, elipse,
   nuvem de revisão e texto, com cor, espessura e nota.
   Cada marcação é um registo próprio (meta "mk_…"), por isso várias
   pessoas podem assinalar ao mesmo tempo sem se apagarem umas às outras.
   ========================================================= */
const MK_TOOLS=[["select","Selecionar","M5 3l12 9-5 1 3 6-2 1-3-6-4 3z"],["pen","Caneta","M3 21l3-1 12-12-2-2L4 18zM15 5l2-2 4 4-2 2"],["arrow","Seta","M4 20L20 4M11 4h9v9"],["line","Linha","M4 20L20 4"],
 ["rect","Retângulo","M4 6h16v12H4z"],["ellipse","Elipse","M12 5c5 0 9 3 9 7s-4 7-9 7-9-3-9-7 4-7 9-7z"],["cloud","Nuvem de revisão","M6 18a3 3 0 0 1 0-6 4 4 0 0 1 7-3 3 3 0 0 1 5 2 3 3 0 0 1 0 7z"],["text","Texto","M5 5h14M12 5v14"]];
const MK_COLORS=["#d62d20","#f08c00","#1971c2","#2f9e44","#7048e8","#1d2421"];
const MK_W=[["Fina",.0012],["Média",.0025],["Grossa",.005]];
S.draw=null;     // {tool,color,w}
S.mkSel=null;
S.marksShow=(()=>{try{return localStorage.getItem("cp-marks")!=="0"}catch(e){return true}})();
let mkLast=(()=>{try{return JSON.parse(localStorage.getItem("cp-mk-style")||"null")}catch(e){return null}})()||{color:MK_COLORS[0],w:1};
const myMarks=[];   // criadas nesta sessão (para desfazer)
function marksFor(pid){return Object.entries(L.meta||{}).filter(([id,v])=>id.startsWith("mk_")&&v&&v.planId===pid).map(([id,v])=>({id,...v})).sort((a,b)=>String(a.at).localeCompare(String(b.at)))}
function mkStroke(m,p){return(MK_W[m.w]||MK_W[1])[1]*Math.max(p.w,p.h)}
/* caminho SVG (em píxeis da planta) de cada marcação; serve também para o canvas das exportações */
function mkPath(m,p){const P=(m.pts||[]).map(q=>[q[0]*p.w,q[1]*p.h]);if(!P.length)return"";const sw=mkStroke(m,p);
 if(m.type==="pen")return P.map((q,i)=>(i?"L":"M")+q[0].toFixed(1)+" "+q[1].toFixed(1)).join("");
 const[a,b]=[P[0],P[P.length-1]];
 if(m.type==="line")return`M${a[0]} ${a[1]}L${b[0]} ${b[1]}`;
 if(m.type==="arrow"){const ang=Math.atan2(b[1]-a[1],b[0]-a[0]),h=Math.max(sw*5,8),s=.45;
  return`M${a[0]} ${a[1]}L${b[0]} ${b[1]}M${b[0]-h*Math.cos(ang-s)} ${b[1]-h*Math.sin(ang-s)}L${b[0]} ${b[1]}L${b[0]-h*Math.cos(ang+s)} ${b[1]-h*Math.sin(ang+s)}`}
 const x0=Math.min(a[0],b[0]),y0=Math.min(a[1],b[1]),x1=Math.max(a[0],b[0]),y1=Math.max(a[1],b[1]);
 if(m.type==="rect")return`M${x0} ${y0}H${x1}V${y1}H${x0}Z`;
 if(m.type==="ellipse"){const cx=(x0+x1)/2,cy=(y0+y1)/2,rx=(x1-x0)/2||1,ry=(y1-y0)/2||1;return`M${cx-rx} ${cy}A${rx} ${ry} 0 1 0 ${cx+rx} ${cy}A${rx} ${ry} 0 1 0 ${cx-rx} ${cy}Z`}
 if(m.type==="cloud"){const r=Math.max(sw*4,Math.min(x1-x0,y1-y0)/10,6);let d=`M${x0} ${y0}`;
  const edge=(ax,ay,bx,by)=>{const L=Math.hypot(bx-ax,by-ay),n=Math.max(1,Math.round(L/(r*2)));for(let i=1;i<=n;i++){const x=ax+(bx-ax)*i/n,y=ay+(by-ay)*i/n,rr=L/n/2*1.15;d+=`A${rr} ${rr} 0 0 1 ${x} ${y}`}};
  edge(x0,y0,x1,y0);edge(x1,y0,x1,y1);edge(x1,y1,x0,y1);edge(x0,y1,x0,y0);return d+"Z"}
 return""}
function mkFont(m,p){return Math.max(p.w,p.h)*({0:.010,1:.014,2:.022}[m.w]??.014)}
/* desenho no ecrã (SVG dentro da planta: acompanha o zoom) */
function renderMarks(p){mkSync();let svg=$("mkSvg");if(!svg){svg=document.createElementNS("http://www.w3.org/2000/svg","svg");svg.id="mkSvg";stage.appendChild(svg)}
 if(!p||!S.marksShow&&!S.draw){svg.innerHTML="";svg.style.display="none";renderMkBar();return}
 svg.style.display="";svg.setAttribute("viewBox",`0 0 ${p.w} ${p.h}`);svg.setAttribute("width",p.w);svg.setAttribute("height",p.h);
 const sel=S.draw&&S.draw.tool==="select";svg.classList.toggle("selecting",!!sel);
 const ms=marksFor(p.id).map(m=>{const T=swapMarkPos(m,p);return T});
 svg.innerHTML=ms.map(m=>{const sw=mkStroke(m,p);const pick=m.id===S.mkSel;
  if(m.type==="text"){const q=m.pts[0],fs=mkFont(m,p),x=q[0]*p.w,y=q[1]*p.h;const lines=String(m.text||"").split("\n");const wch=Math.max(...lines.map(l=>l.length),1)*fs*.58+fs*.8,hh=lines.length*fs*1.25+fs*.5;
   return`<g data-mk="${esc(m.id)}" class="mk${pick?" pick":""}"><rect x="${x}" y="${y-fs*1.05}" width="${wch}" height="${hh}" rx="${fs*.25}" fill="#fff" fill-opacity=".88" stroke="${esc(m.color)}" stroke-width="${sw*.8}"/>
    <text x="${x+fs*.4}" y="${y}" font-size="${fs}" fill="${esc(m.color)}" font-family="Arial,Helvetica,sans-serif" font-weight="700">${lines.map((l,i)=>`<tspan x="${x+fs*.4}" dy="${i?fs*1.25:0}">${esc(l)}</tspan>`).join("")}</text></g>`}
  const d=mkPath(m,p);const note=m.text?`<title>${esc(m.text)}</title>`:"";
  return`<g data-mk="${esc(m.id)}" class="mk${pick?" pick":""}">${note}<path d="${d}" fill="none" stroke="transparent" stroke-width="${Math.max(sw*8,14/view.z)}" class="hit"/><path d="${d}" fill="${m.type==="rect"||m.type==="ellipse"||m.type==="cloud"?esc(m.color):"none"}" fill-opacity="${m.fill?.12:0}" stroke="${esc(m.color)}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>${m.text&&m.type!=="pen"?mkNoteTag(m,p):""}</g>`}).join("")+(mkDraft?mkDraftSvg(p):"");
 renderMkBar()}
function mkNoteTag(m,p){const q=m.pts[m.pts.length-1],fs=mkFont({w:0},p);const t=String(m.text).split("\n")[0].slice(0,40);
 return`<g class="mknote"><rect x="${q[0]*p.w+fs*.4}" y="${q[1]*p.h-fs*1.1}" width="${t.length*fs*.56+fs*.8}" height="${fs*1.5}" rx="${fs*.3}" fill="${esc(m.color)}"/><text x="${q[0]*p.w+fs*.8}" y="${q[1]*p.h}" font-size="${fs}" fill="#fff" font-family="Arial,Helvetica,sans-serif" font-weight="700">${esc(t)}</text></g>`}
function swapMarkPos(m,p){const W=S.swap;if(!W||W.show!=="new"||W.pid!==m.planId||!W.T)return m;return{...m,pts:m.pts.map(q=>{const r=simApply(W.T,q[0]*W.od.w,q[1]*W.od.h);return[r.x/W.nd.w,r.y/W.nd.h]})}}
/* barra de ferramentas */
function renderMkBar(){let bar=$("mkBar");if(!bar){bar=document.createElement("div");bar.id="mkBar";bar.className="mkbar";viewer.appendChild(bar)}
 if(!S.draw||S.view!=="obra"){bar.hidden=true;renderMkPanel();return}bar.hidden=false;const D=S.draw;
 bar.innerHTML=`<div class="mkrow">${MK_TOOLS.map(([k,n,ic])=>`<button type="button" class="mkt${D.tool===k?" on":""}" data-tool="${k}" title="${n}" aria-label="${n}" aria-pressed="${D.tool===k}"><svg viewBox="0 0 24 24"><path d="${ic}"/></svg></button>`).join("")}</div>
  <div class="mkrow">${MK_COLORS.map(c=>`<button type="button" class="mkc${D.color===c?" on":""}" data-color="${c}" style="--k:${c}" aria-label="Cor"></button>`).join("")}
   <select id="mkW" aria-label="Espessura">${MK_W.map(([n],i)=>`<option value="${i}"${D.w===i?" selected":""}>${n}</option>`).join("")}</select>
   <label class="mkfill"><input type="checkbox" id="mkFill"${D.fill?" checked":""}> Preencher</label></div>
  <div class="mkrow"><button type="button" class="btn sm" id="mkUndo"${myMarks.length?"":" disabled"}>Desfazer</button><label class="mkfill"><input type="checkbox" id="mkShow"${S.marksShow?" checked":""}> Mostrar marcações</label><button type="button" class="btn sm primary" id="mkDone">Concluir</button></div>`;
 bar.querySelectorAll("[data-tool]").forEach(b=>b.onclick=()=>{D.tool=b.dataset.tool;if(D.tool!=="select")S.mkSel=null;render()});
 bar.querySelectorAll("[data-color]").forEach(b=>b.onclick=()=>{D.color=b.dataset.color;saveMkStyle();const m=selMark();if(m)updMark(m.id,{color:D.color});render()});
 $("mkW").onchange=e=>{D.w=+e.target.value;saveMkStyle();const m=selMark();if(m)updMark(m.id,{w:D.w});render()};
 $("mkFill").onchange=e=>{D.fill=e.target.checked;saveMkStyle();const m=selMark();if(m)updMark(m.id,{fill:D.fill});render()};
 $("mkShow").onchange=e=>{S.marksShow=e.target.checked;try{localStorage.setItem("cp-marks",S.marksShow?"1":"0")}catch(x){}render()};
 $("mkUndo").onclick=()=>{const id=myMarks.pop();if(id&&L.meta[id]){api.del("meta",id);if(S.mkSel===id)S.mkSel=null;toast("Marcação desfeita")}render()};
 $("mkDone").onclick=()=>{S.draw=null;S.mkSel=null;render()};
 renderMkPanel()}
function saveMkStyle(){mkLast={color:S.draw.color,w:S.draw.w,fill:!!S.draw.fill};try{localStorage.setItem("cp-mk-style",JSON.stringify(mkLast))}catch(e){}}
/* painel da marcação selecionada: nota, apagar */
function selMark(){return S.mkSel&&L.meta[S.mkSel]?{id:S.mkSel,...L.meta[S.mkSel]}:null}
function renderMkPanel(){let pn=$("mkPanel");if(!pn){pn=document.createElement("div");pn.id="mkPanel";pn.className="mkpanel";viewer.appendChild(pn)}
 const m=selMark();if(!m||S.view!=="obra"){pn.hidden=true;return}pn.hidden=false;
 const mine=m.by===S.meId,canEd=S.canWrite&&(mine||S.isCoord);const tn={pen:"Traço",arrow:"Seta",line:"Linha",rect:"Retângulo",ellipse:"Elipse",cloud:"Nuvem",text:"Texto"}[m.type]||"Marcação";
 if(pn.dataset.for===m.id&&pn.contains(document.activeElement))return;pn.dataset.for=m.id;
 pn.innerHTML=`<div class="mkph"><b>${tn}</b><span class="muted">${esc(nameOf(m.by))} · ${fmtDate(m.at)}</span><button type="button" class="btn sm" id="mkpX" aria-label="Fechar">×</button></div>
  <textarea id="mkpT" rows="${m.type==="text"?3:2}" placeholder="${m.type==="text"?"Texto":"Nota (opcional): o que se passa aqui?"}"${canEd?"":" readonly"}>${esc(m.text||"")}</textarea>
  ${canEd?`<div class="mkpa"><button type="button" class="btn sm danger" id="mkpDel">Apagar</button><button type="button" class="btn sm primary" id="mkpOk">Guardar</button></div>`:""}`;
 $("mkpX").onclick=()=>{S.mkSel=null;render()};
 const ok=$("mkpOk");if(ok)ok.onclick=()=>{const t=$("mkpT").value.trim();if(m.type==="text"&&!t){api.del("meta",m.id);S.mkSel=null;render();return}updMark(m.id,{text:t});S.mkSel=null;render();toast("Marcação guardada")};
 const dl=$("mkpDel");if(dl)dl.onclick=()=>{api.del("meta",m.id);S.mkSel=null;render();toast("Marcação apagada")};
 if(m.type==="text"&&!m.text&&canEd)setTimeout(()=>$("mkpT")&&$("mkpT").focus(),30)}
function updMark(id,patch){if(!S.canWrite){toast("Sem permissão para alterar.");return}api.update("meta",id,{...patch,editedAt:now(),editedBy:S.meId})}
/* desenhar com o dedo / rato */
let mkDraft=null;
function mkDraftSvg(p){const m=mkDraft;const d=mkPath(m,p);return d?`<path d="${d}" fill="none" stroke="${m.color}" stroke-width="${mkStroke(m,p)}" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>`:""}
function mkPt(e){const r=img.getBoundingClientRect();if(!r.width)return null;return[+Math.min(1,Math.max(0,(e.clientX-r.left)/r.width)).toFixed(5),+Math.min(1,Math.max(0,(e.clientY-r.top)/r.height)).toFixed(5)]}
viewer.addEventListener("pointerdown",e=>{if(!S.draw||e.button>0)return;if(e.target.closest(".zoom,.hint,.legend,#mkBar,#mkPanel"))return;
 const p=plan();if(!p)return;const D=S.draw;
 if(D.tool==="select"){const g=e.target.closest("[data-mk]");if(g){e.stopPropagation();e.stopImmediatePropagation();S.mkSel=g.dataset.mk;render()}else if(S.mkSel){S.mkSel=null;render()}return}
 if(!S.canWrite){toast("Sem permissão para assinalar.");return}
 e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();const q=mkPt(e);if(!q)return;
 if(D.tool==="text"){createMark({type:"text",pts:[q],text:""},true);return}
 mkDraft={type:D.tool,pts:[q,q],color:D.color,w:D.w};if(D.tool==="pen")mkDraft.pts=[q];
 const id=e.pointerId;try{viewer.setPointerCapture(id)}catch(x){}
 const mv=ev=>{if(ev.pointerId!==id||!mkDraft)return;const r=mkPt(ev);if(!r)return;
  if(mkDraft.type==="pen"){const l=mkDraft.pts[mkDraft.pts.length-1];if(Math.hypot((r[0]-l[0])*p.w,(r[1]-l[1])*p.h)>Math.max(p.w,p.h)*.002/Math.max(view.z,.2)*.5)mkDraft.pts.push(r)}else mkDraft.pts[1]=r;renderMarks(p)};
 const up=ev=>{if(ev.pointerId!==id)return;viewer.removeEventListener("pointermove",mv,true);viewer.removeEventListener("pointerup",up,true);viewer.removeEventListener("pointercancel",up,true);
  const m=mkDraft;mkDraft=null;if(!m){render();return}
  const span=Math.max(...m.pts.map(q=>q[0]))-Math.min(...m.pts.map(q=>q[0]))+Math.max(...m.pts.map(q=>q[1]))-Math.min(...m.pts.map(q=>q[1]));
  if(span<.004||ev.type==="pointercancel"){render();return}
  if(m.type==="pen"&&m.pts.length>400)m.pts=m.pts.filter((_,i)=>i%Math.ceil(m.pts.length/400)===0||i===m.pts.length-1);
  createMark({type:m.type,pts:m.pts},false)};
 viewer.addEventListener("pointermove",mv,true);viewer.addEventListener("pointerup",up,true);viewer.addEventListener("pointercancel",up,true)},true);
viewer.addEventListener("pointermove",e=>{if(mkDraft)e.stopPropagation()},true);
async function createMark(m,openPanel){const p=plan();if(!p)return;const id="mk_"+uid();const D=S.draw;
 await api.set("meta",id,{planId:p.id,type:m.type,pts:m.pts,text:m.text||"",color:D.color,w:D.w,fill:!!D.fill,by:S.meId,at:now()});myMarks.push(id);
 if(openPanel){D.tool="select";S.mkSel=id}render()}
/* botão "Assinalar" na barra da obra */
(()=>{const b=document.createElement("button");b.className="btn";b.id="btnMk";b.textContent="Assinalar";b.title="Desenhar e escrever notas na planta";$("btnExp").before(b);
 b.onclick=()=>{if(S.draw){S.draw=null;S.mkSel=null}else{S.draw={tool:"pen",color:mkLast.color,w:mkLast.w??1,fill:!!mkLast.fill};S.mode="nav";S.sel=null;S.marksShow=true}render()}})();
function mkSync(){const b=$("btnMk");if(b){b.hidden=!plan();b.classList.toggle("dark",!!S.draw);b.setAttribute("aria-pressed",!!S.draw)}}
/* exportações: as marcações entram na planta descarregada e no auto de entrega */
function drawMarksOn(cv,p){const k=cv.width/p.w,cx=cv.getContext("2d");cx.save();cx.scale(k,k);
 for(const m of marksFor(p.id)){const sw=mkStroke(m,p);cx.lineCap="round";cx.lineJoin="round";
  if(m.type==="text"){const q=m.pts[0],fs=mkFont(m,p),x=q[0]*p.w,y=q[1]*p.h,lines=String(m.text||"").split("\n");cx.font=`bold ${fs}px Arial`;const w=Math.max(...lines.map(l=>cx.measureText(l).width))+fs*.8,h=lines.length*fs*1.25+fs*.5;
   cx.fillStyle="rgba(255,255,255,.88)";cx.strokeStyle=m.color;cx.lineWidth=sw*.8;cx.beginPath();cx.rect(x,y-fs*1.05,w,h);cx.fill();cx.stroke();cx.fillStyle=m.color;lines.forEach((l,i)=>cx.fillText(l,x+fs*.4,y+i*fs*1.25));continue}
  const path=new Path2D(mkPath(m,p));if(m.fill&&["rect","ellipse","cloud"].includes(m.type)){cx.globalAlpha=.12;cx.fillStyle=m.color;cx.fill(path);cx.globalAlpha=1}
  cx.strokeStyle=m.color;cx.lineWidth=sw;cx.stroke(path);
  if(m.text){const q=m.pts[m.pts.length-1],fs=mkFont({w:0},p),t=String(m.text).split("\n")[0].slice(0,40);cx.font=`bold ${fs}px Arial`;const w=cx.measureText(t).width+fs*.8;cx.fillStyle=m.color;cx.fillRect(q[0]*p.w+fs*.4,q[1]*p.h-fs*1.1,w,fs*1.5);cx.fillStyle="#fff";cx.fillText(t,q[0]*p.w+fs*.8,q[1]*p.h)}}
 cx.restore();return cv}
const planCanvas0=planCanvas;
planCanvas=async function(p){const cv=await planCanvas0(p);const inc=$("dlgExp").open?($("exMk")?$("exMk").value==="1":true):S.marksShow;if(inc&&marksFor(p.id).length)drawMarksOn(cv,p);return cv};
/* trocar planta: as marcações acompanham os IDs */
const commitSwap0=commitSwap;
commitSwap=async function(mode){const W=S.swap;if(W&&mode!=="igual"&&W.T){for(const m of marksFor(W.pid)){const pts=m.pts.map(q=>{const r=simApply(W.T,q[0]*W.od.w,q[1]*W.od.h);return[+(r.x/W.nd.w).toFixed(5),+(r.y/W.nd.h).toFixed(5)]});await api.update("meta",m.id,{pts})}}return commitSwap0(mode)};
const revertSwap0=revertSwap;
revertSwap=async function(){const p=plan();const h=p&&(p.history||[]).slice(-1)[0];if(h&&h.mode!=="igual"&&h.T){const Ti=simInv(h.T);for(const m of marksFor(p.id)){const pts=m.pts.map(q=>{const r=simApply(Ti,q[0]*p.w,q[1]*p.h);return[+(r.x/h.w).toFixed(5),+(r.y/h.h).toFixed(5)]});await api.update("meta",m.id,{pts})}}return revertSwap0()};
document.addEventListener("keydown",e=>{if(!S.draw||e.target.matches("input,textarea,select"))return;if((e.key==="Delete"||e.key==="Backspace")&&S.mkSel){const m=selMark();if(m&&(m.by===S.meId||S.isCoord)){api.del("meta",m.id);S.mkSel=null;render()}}
 if((e.ctrlKey||e.metaKey)&&e.key==="z"){e.preventDefault();$("mkUndo")&&$("mkUndo").click()}});
function mkHint(){const t=S.draw.tool;return t==="select"?`<b>Assinalar · Selecionar:</b> toca numa marcação para lhe juntar uma nota, mudar a cor ou apagar. Arrasta fora das marcações para mover a planta.`
 :t==="text"?`<b>Assinalar · Texto:</b> toca na planta onde queres escrever.`:`<b>Assinalar:</b> desenha na planta com o dedo ou o rato. Para mover a planta escolhe <b>Selecionar</b> (seta) ou usa os botões + e −.`}

/* =========================================================
   ObraFlow 2 · moldura: menu lateral, pesquisa global, notificações,
   páginas de gestão (equipamentos, IDs, anomalias, diário, documentos,
   equipa, configurações) e a área de trabalho da planta em 3 colunas
   ========================================================= */
const PAGE_VIEWS=["equip","ids","issues","diary","docs","team","settings"];
function go(v){if(v==="more"){document.body.classList.toggle("sideopen");return}
 if(v!=="obra")S.draw=null;S.view=v;document.body.classList.remove("sideopen");$("gres").hidden=true;$("feed").hidden=true;render();
 const pg=$("viewPage");if(pg)pg.scrollTop=0;if(v==="obra")setTimeout(fit,50)}
document.querySelectorAll("[data-nav]").forEach(b=>b.onclick=e=>{e.stopPropagation();go(b.dataset.nav)});
$("sideTog").onclick=e=>{e.stopPropagation();document.body.classList.toggle("sideopen")};
document.addEventListener("click",e=>{if(document.body.classList.contains("sideopen")&&!e.target.closest("#side,#sideTog"))document.body.classList.remove("sideopen");
 if(!e.target.closest(".gsearch"))$("gres").hidden=true;if(!e.target.closest("#feed,#bell"))$("feed").hidden=true});
function openItem(id){const it=S.items.find(i=>i.id===id);if(!it)return;S.planId=it.planId;S.view="obra";loadedPlan=null;S.draw=null;
 if(S.filter!=="all"&&!inFilter(it))S.filter="all";S.sel=id;render();setTimeout(()=>{fit();centerOn(it)},90)}
function openPlan(pid){S.planId=pid;S.sel=null;S.view="obra";loadedPlan=null;render();setTimeout(fit,60)}
function renderShell(){const v=S.view;
 $("tabHome").setAttribute("aria-selected",v==="home");$("tabObra").setAttribute("aria-selected",v==="obra");$("tabCoord").setAttribute("aria-selected",v==="coord");
 $("viewObra").style.display=v==="obra"?"contents":"none";$("viewCoord").hidden=v!=="coord";$("viewHome").hidden=v!=="home";$("viewPage").hidden=!PAGE_VIEWS.includes(v);
 document.body.dataset.view=v;document.querySelectorAll("[data-nav]").forEach(b=>b.classList.toggle("on",b.dataset.nav===v));
 $("sideProj").textContent=S.meta.name||"A minha obra";
 const oi=S.issues.filter(x=>x.status!=="resolvida").length,dc=dupCount();
 const cnt=(k,n,bad)=>{const e=$("cnt_"+k);if(!e)return;e.hidden=!n;e.textContent=n;e.style.background=bad?"#dc2626":""};
 cnt("issues",oi,oi>0);cnt("ids",dc,dc>0);cnt("equip",S.items.length);cnt("obra",S.plans.length);
 const tip=$("sideTip");if(tip)tip.hidden=v==="settings";
 if(v==="obra"){renderObra();renderObraExtras();warmReader()}else if(v==="coord")renderCoord();else if(v==="home")renderHome();else renderPage(v);
 renderBell()}

/* ---------- pesquisa global ---------- */
let gSel=0,gHits=[];
function gSearch(q){q=q.trim().toLowerCase();if(q.length<2)return[];const out=[];
 for(const i of S.items){const hay=[i.devId,i.mac,i.code,i.model,i.serial,i.taskNo,i.maker].join(" ").toLowerCase();if(hay.includes(q))out.push({k:"item",id:i.id,t:i.devId||i.mac||i.code,s:`${i.code} · ${(S.plans.find(p=>p.id===i.planId)||{}).name||""} · ${sOf(i.stage).n}`,score:(String(i.devId||"").toLowerCase()===q?0:1)})}
 for(const p of S.plans)if(String(p.name).toLowerCase().includes(q))out.push({k:"plan",id:p.id,t:p.name,s:`Planta · ${planItems(p.id).length} equipamentos`,score:2});
 for(const d of docsAll())if(String(d.name).toLowerCase().includes(q))out.push({k:"doc",id:d.id,t:d.name,s:"Documento · "+d.cat,score:3});
 for(const x of S.issues)if(String(x.text).toLowerCase().includes(q))out.push({k:"issue",id:x.id,t:String(x.text).slice(0,60),s:"Anomalia · "+(x.status==="resolvida"?"resolvida":"aberta"),score:4});
 return out.sort((a,b)=>a.score-b.score).slice(0,14)}
function renderGres(){const R=$("gres");if(!gHits.length){R.innerHTML=`<div class="empty">Sem resultados.</div>`;R.hidden=false;return}
 const lab={item:"Equipamentos",plan:"Plantas",doc:"Documentos",issue:"Anomalias",ptext:"Texto nas plantas (PDF)"},icn={item:"ID",plan:"PL",doc:"DOC",issue:"!",ptext:"TXT"};let last="";
 R.innerHTML=gHits.map((h,i)=>{const hd=h.k!==last?`<h5>${lab[h.k]}</h5>`:"";last=h.k;return hd+`<button type="button" data-g="${i}" class="${i===gSel?"on":""}"><span class="gi">${icn[h.k]}</span><span><b>${esc(h.t)}</b><small>${esc(h.s)}</small></span></button>`}).join("");
 R.hidden=false;R.querySelectorAll("[data-g]").forEach(b=>b.onclick=()=>gOpen(gHits[+b.dataset.g]))}
function gOpen(h){if(!h)return;$("gres").hidden=true;$("gq").value="";$("gq").blur();
 if(h.k==="item")openItem(h.id);else if(h.k==="plan")openPlan(h.id);else if(h.k==="doc")openDoc(h.id);else{const x=S.issues.find(i=>i.id===h.id);if(x&&x.itemId)openItem(x.itemId);else go("issues")}}
$("gq").oninput=e=>{gHits=gSearch(e.target.value);gSel=0;if(e.target.value.trim().length<2){$("gres").hidden=true;return}renderGres()};
$("gq").onkeydown=e=>{if(e.key==="ArrowDown"){gSel=Math.min(gHits.length-1,gSel+1);renderGres();e.preventDefault()}else if(e.key==="ArrowUp"){gSel=Math.max(0,gSel-1);renderGres();e.preventDefault()}
 else if(e.key==="Enter"){gOpen(gHits[gSel]);e.preventDefault()}else if(e.key==="Escape"){$("gres").hidden=true;e.target.blur()}};
document.addEventListener("keydown",e=>{if(e.key==="/"&&!e.target.matches("input,textarea,select")){e.preventDefault();$("gq").focus()}});

/* ---------- atividade recente (sino) ---------- */
function feedItems(){const ev=[];
 for(const it of S.items)for(const e of (it.log||[]).slice(-8))ev.push({at:e.at,by:e.by,t:e.t,code:it.devId||it.code,item:it.id});
 for(const x of S.issues){ev.push({at:x.createdAt,by:x.createdBy,t:"registou anomalia: "+String(x.text).slice(0,60),code:(S.items.find(i=>i.id===x.itemId)||{}).code||"",item:x.itemId});
  if(x.resolvedAt)ev.push({at:x.resolvedAt,by:x.resolvedBy,t:"resolveu anomalia: "+String(x.text).slice(0,60),code:(S.items.find(i=>i.id===x.itemId)||{}).code||"",item:x.itemId})}
 for(const d of docsAll())ev.push({at:d.at,by:d.by,t:"juntou o documento "+d.name,code:d.cat,doc:d.id});
 return ev.filter(e=>e.at).sort((a,b)=>String(b.at).localeCompare(String(a.at))).slice(0,60)}
let feedSeen=(()=>{try{return localStorage.getItem("cp-feed-seen")||""}catch(e){return""}})();
function renderBell(){const n=feedItems().filter(e=>e.at>feedSeen&&e.by!==S.meId).length;const b=$("bellN");b.hidden=!n;b.textContent=n>99?"99+":n}
function openFeed(){const F=$("feed");const ev=feedItems();const seen=feedSeen;
 F.innerHTML=`<h4><span>Atividade recente</span><button class="linkb" id="feedX">Fechar</button></h4>`+(ev.map((e,i)=>`<div class="fe${e.at>seen&&e.by!==S.meId?" new":""}" data-fe="${i}"><span class="ini" style="--h:${hue(e.by||"x")}">${esc(initials(nameOf(e.by)))}</span><div><b>${esc(nameOf(e.by))}</b> ${esc(e.t)}<small>${esc(e.code||"")}${e.code?" · ":""}${fmtDate(e.at)}</small></div></div>`).join("")||`<div class="empty">Sem atividade ainda.</div>`);
 F.hidden=false;F.querySelectorAll("[data-fe]").forEach(el=>el.onclick=()=>{const e=ev[+el.dataset.fe];F.hidden=true;if(e.item)openItem(e.item);else if(e.doc)openDoc(e.doc)});$("feedX").onclick=()=>{F.hidden=true};
 feedSeen=now();try{localStorage.setItem("cp-feed-seen",feedSeen)}catch(x){}renderBell()}
$("bell").onclick=e=>{e.stopPropagation();if(!$("feed").hidden){$("feed").hidden=true;return}openFeed()};

/* ---------- área da planta: cabeçalho, lista de plantas, barra de estado ---------- */
let plQ="";
function renderObraExtras(){const p=plan();const its=planItems();
 const withId=its.filter(i=>String(i.devId||"").trim()||String(i.mac||"").trim()).length,oi=S.issues.filter(x=>x.planId===(p&&p.id)&&x.status!=="resolvida").length,ph=its.reduce((n,i)=>n+(i.photos||[]).length,0),tst=its.filter(i=>sIdx(i.stage)>=3).length;
 $("oHead").innerHTML=p?`<div class="crumb"><button type="button" data-go="home">Projeto</button><span>›</span>${p.folder&&folderName(p.folder)?`<span>${esc(folderName(p.folder))}</span><span>›</span>`:""}<b>${esc(p.name)}</b></div>
  <span class="stchip" style="--c:${(p.close&&p.close.status)==="entregue"?"var(--ok)":(p.close&&p.close.status)==="fecho"?"var(--warn)":"var(--info)"}">${FLOOR_ST[(p.close&&p.close.status)||"aberto"]}</span>`:"";
 $("oHead").querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>go(b.dataset.go));
 // lista de plantas
 const P=$("plansPane");const q=plQ.trim().toLowerCase();const fs=folders();const grp=[];
 fs.forEach(f=>{const ps=plansIn(f.id).filter(x=>!q||x.name.toLowerCase().includes(q));if(ps.length)grp.push([f.name,ps])});
 const loose=plansIn(null).filter(x=>!q||x.name.toLowerCase().includes(q));if(loose.length)grp.push([fs.length?"Sem pasta":"",loose]);
 const focused=P.contains(document.activeElement);
 if(!focused||!P.querySelector("#plQ"))P.innerHTML=`<div class="ph"><b><span>Plantas</span>${S.canWrite?`<button class="btn sm primary" id="plAdd" title="Carregar plantas">+</button>`:""}</b><input type="search" id="plQ" placeholder="Pesquisar planta…" value="${esc(plQ)}"></div><div class="pl" id="plList"></div>`;
 $("plList").innerHTML=grp.map(([n,ps])=>(n?`<div class="fgrp">${esc(n)}</div>`:"")+ps.map(x=>{const pi=planItems(x.id),pc=counts(pi);
  return`<div class="prow${x.id===S.planId?" on":""}" data-pl="${esc(x.id)}" role="button" tabindex="0"><span class="pt"><img data-thumb="${esc(x.img||"")}" alt=""></span><span><b>${esc(x.name)}</b><small>${pi.length} equipamentos</small><span class="pp">${stackBar(pi)}<span>${pct(pc.ge(3),pc.total)}% testado</span></span></span></div>`}).join("")).join("")||`<div class="empty">Sem plantas.</div>`;
 P.querySelectorAll("img[data-thumb]").forEach(im=>{const r=im.dataset.thumb;if(!r||im.dataset.done===r)return;im.dataset.done=r;thumbOf(r).then(u=>{im.src=u;im.parentElement.classList.add("ok")}).catch(()=>{})});
 P.querySelectorAll("[data-pl]").forEach(el=>{el.onclick=()=>openPlan(el.dataset.pl);el.onkeydown=e=>{if(e.key==="Enter")openPlan(el.dataset.pl)}});
 const pq=$("plQ");if(pq)pq.oninput=e=>{plQ=e.target.value;renderObraExtras()};
 const pa=$("plAdd");if(pa)pa.onclick=()=>{replacing=null;uploadFolder=(p&&p.folder)||null;$("planIn").click()};
 // barra de estado
 $("sBar").innerHTML=p?`<b style="color:var(--ink)">${esc(p.name)}</b><span class="sc" style="--c:var(--muted)"><i></i>${its.length} equip.</span><span class="sc" style="--c:var(--ok)"><i></i>Identificados ${withId}</span><span class="sc" style="--c:#9333ea"><i></i>Pendentes de ID ${its.length-withId}</span><span class="sc" style="--c:var(--st3)"><i></i>Testados ${tst}</span><span class="sc" style="--c:var(--bad)"><i></i>Anomalias ${oi}</span><span class="sc" style="--c:#0891b2"><i></i>Fotos ${ph}</span>
  <span class="grow"></span><span class="zm">Zoom <button class="btn sm" id="sbOut">−</button><b id="sbZ">${Math.round(view.z*100)}%</b><button class="btn sm" id="sbIn">+</button></span>`:"";
 const so=$("sbOut");if(so){so.onclick=()=>$("zOut").click();$("sbIn").onclick=()=>$("zIn").click()}}
setInterval(()=>{const z=$("sbZ");if(z&&S.view==="obra")z.textContent=Math.round(view.z*100)+"%"},400);

/* ---------- ficha do equipamento: cabeçalho e separadores ---------- */
S.shTab="det";
function decorateSheet(box,it){const kids=[...box.children];const head=box.querySelector(".sh-head");if(!head)return;
 const tabOf=el=>{const h=el.querySelector&&el.querySelector(":scope>h4");const t=h?h.textContent.toLowerCase():"";
  if(el.classList.contains("hist"))return"hist";if(t.startsWith("checklist"))return"ens";if(t.startsWith("anomalias"))return"iss";if(el.classList.contains("sh-foot"))return"";return"det"};
 const nIss=S.issues.filter(x=>x.itemId===it.id&&x.status!=="resolvida").length,nDocs=docsFor(it).length,nLog=(it.log||[]).length,ckl=CHECKS[it.type]||CHECKS.EQ,ckd=ckl.filter((_,k)=>ck(it)[k]).length;
 const top=document.createElement("div");top.className="shtop";
 top.innerHTML=`<h3>${it.devId?"ID "+esc(it.devId):it.mac?"MAC "+esc(it.mac):"Sem ID"} <span class="stchip" style="--c:${sOf(it.stage).c}">${esc(sOf(it.stage).n)}</span>${isDup(it)?`<span class="stchip" style="--c:var(--bad)">Repetido</span>`:""}</h3>`;
 const tabs=document.createElement("div");tabs.className="shtabs";
 const T=[["det","Detalhes"],["ens",`Ensaio<span class="n">${ckd}/${ckl.length}</span>`],["iss",`Anomalias${nIss?`<span class="n" style="background:#fee2e2;color:#b91c1c">${nIss}</span>`:""}`],["docs",`Documentos${nDocs?`<span class="n">${nDocs}</span>`:""}`],["hist",`Histórico${nLog?`<span class="n">${nLog}</span>`:""}`]];
 tabs.innerHTML=T.map(([k,n])=>`<button type="button" data-st="${k}" class="${S.shTab===k?"on":""}">${n}</button>`).join("");
 head.before(top);head.after(tabs);
 const docsSec=document.createElement("div");docsSec.className="sec";docsSec.dataset.tab="docs";docsSec.innerHTML=docsTabHtml(it);
 const foot=box.querySelector(".sh-foot");foot.before(docsSec);
 kids.forEach(el=>{if(el===head)return;const t=tabOf(el);if(!t)return;el.dataset.tab=t});
 const hist=box.querySelector(".hist");if(hist)hist.open=true;
 const apply=()=>{box.querySelectorAll("[data-tab]").forEach(el=>el.hidden=el.dataset.tab!==S.shTab);tabs.querySelectorAll("button").forEach(b=>b.classList.toggle("on",b.dataset.st===S.shTab))};
 tabs.querySelectorAll("button").forEach(b=>b.onclick=()=>{S.shTab=b.dataset.st;apply()});apply();wireDocsTab(it);
 const nx=$("edNext");if(nx)nx.textContent="Seguinte →";
 if(!box.querySelector("#edPrev")){const pv=document.createElement("button");pv.className="btn sm";pv.id="edPrev";pv.textContent="← Anterior";
  pv.onclick=()=>{flushFields();const L2=planItems().filter(i=>inFilter(i)&&matchQ(i)).sort(workOrder);const k=L2.findIndex(i=>i.id===it.id);const pr=L2[k-1];if(pr){select(pr.id);centerOn(pr)}else toast("Este é o primeiro da lista.")};
  nx&&nx.before(pv)}}

/* ---------- Documentos (biblioteca da obra) ---------- */
const DOC_CATS=["Projeto e desenhos","Fichas técnicas","Certificados e ensaios","Atas e correspondência","Fotografias","Outros"];
function docsAll(){return Object.entries(L.meta||{}).filter(([id,v])=>id.startsWith("doc_")&&v&&v.ref).map(([id,v])=>({id,...v})).sort((a,b)=>String(b.at).localeCompare(String(a.at)))}
function docsFor(it){return docsAll().filter(d=>(d.items||[]).includes(it.id)||(d.types||[]).includes(it.type))}
function docExt(n){return(String(n).match(/\.([a-z0-9]{1,5})$/i)||[])[1]?.toUpperCase()||"FICH"}
const DOC_COL={PDF:"#dc2626",DOC:"#2563eb",DOCX:"#2563eb",XLS:"#16a34a",XLSX:"#16a34a",DWG:"#9333ea",JPG:"#0891b2",JPEG:"#0891b2",PNG:"#0891b2"};
function fmtSize(b){return b>1e6?(b/1e6).toFixed(1)+" MB":Math.max(1,Math.round(b/1e3))+" KB"}
async function uploadDocs(files,cat,link){if(!S.canWrite){toast("Sem permissão para juntar documentos.");return[]}const ids=[];
 for(const f of files){try{if(f.size>50e6)throw new Error("máximo 50 MB");const type=f.type||"application/octet-stream";const ref=await putFile(f,type);const id="doc_"+uid();
   await api.set("meta",id,{name:f.name,cat:cat||"Outros",ref,type,size:f.size,by:S.meId,at:now(),items:link?[link]:[],types:[]});ids.push(id)}catch(e){toast(f.name+": "+(e.message||"erro"))}}
 if(ids.length)toast(ids.length>1?`${ids.length} documentos guardados.`:"Documento guardado.");return ids}
async function openDoc(id){const d=L.meta[id];if(!d)return;try{const b=await blobOf(d.ref);const blob=b.type?b:new Blob([b],{type:d.type});
  if(/pdf|image\//.test(d.type)){const u=URL.createObjectURL(blob);const w=window.open(u,"_blank");if(!w)saveBlob(d.name,blob);setTimeout(()=>URL.revokeObjectURL(u),120000)}else saveBlob(d.name,blob)}
 catch(e){toast("Documento indisponível"+(navigator.onLine?".":" sem rede."))}}
function docRow(d,actions){const ex=docExt(d.name);return`<div class="docrow"><span class="dt" style="--c:${DOC_COL[ex]||"#64748b"}">${esc(ex.slice(0,4))}</span><span class="dn"><b>${esc(d.name)}</b><small>${esc(d.cat||"")} · ${fmtSize(d.size||0)} · ${esc(nameOf(d.by))} · ${fmtDate(d.at)}</small></span>${actions}</div>`}
function docsTabHtml(it){const ds=docsFor(it);const others=docsAll().filter(d=>!ds.includes(d));
 return`<h4><span>Documentos do equipamento</span></h4><div class="doclist">${ds.map(d=>docRow(d,`<button class="btn sm" data-dopen="${esc(d.id)}">Abrir</button>${S.canWrite&&(d.items||[]).includes(it.id)?`<button class="btn sm" data-dunl="${esc(d.id)}" title="Desligar">×</button>`:""}`)).join("")||`<span class="none">Sem documentos. Junta fichas técnicas, certificados ou manuais.</span>`}</div>
  ${S.canWrite?`<div class="toolrow">${others.length?`<select id="dLink"><option value="">Ligar documento da obra…</option>${others.map(d=>`<option value="${esc(d.id)}">${esc(d.name)}</option>`).join("")}</select>`:""}<label class="btn sm" for="dUp">Carregar documento</label><input type="file" id="dUp" multiple hidden></div>
  <label class="mkfill"><input type="checkbox" id="dType"> Ao ligar, aplicar a todos os equipamentos do tipo ${esc(tOf(it.type).n)}</label>`:""}`}
function wireDocsTab(it){const box=$("sheet");box.querySelectorAll("[data-dopen]").forEach(b=>b.onclick=()=>openDoc(b.dataset.dopen));
 box.querySelectorAll("[data-dunl]").forEach(b=>b.onclick=()=>{const d=L.meta[b.dataset.dunl];api.update("meta",b.dataset.dunl,{items:(d.items||[]).filter(x=>x!==it.id)});sheetFor=null;render()});
 const dl=$("dLink");if(dl)dl.onchange=()=>{const d=L.meta[dl.value];if(!d)return;const all=$("dType")&&$("dType").checked;
  api.update("meta",dl.value,all?{types:[...new Set([...(d.types||[]),it.type])]}:{items:[...new Set([...(d.items||[]),it.id])]});toast("Documento ligado.");sheetFor=null;render()};
 const up=$("dUp");if(up)up.onchange=async e=>{const fs=[...e.target.files];e.target.value="";await uploadDocs(fs,"Fichas técnicas",it.id);sheetFor=null;render()}}

/* ---------- páginas ---------- */
const EQ={q:"",plan:"",type:"",stage:"",who:"",only:""},IDF={q:"",only:""},ISF={q:"",st:"open",prio:"",who:"",plan:""};
let diaryDay=null,docF={q:"",cat:""};
function pageHead(crumb,title,sub,actions){return`<div class="crumb"><button type="button" data-go="home">${esc(S.meta.name||"Projeto")}</button><span>›</span><b>${esc(crumb)}</b></div>
 <div class="phead"><div><h2>${title}</h2>${sub?`<p>${sub}</p>`:""}</div><div class="toolrow">${actions||""}</div></div>`}
const planName=id=>(S.plans.find(p=>p.id===id)||{}).name||"—";
function renderPage(v){const W=$("pageWrap");
 if(v==="equip")W.innerHTML=equipPage();else if(v==="ids")W.innerHTML=idsPage();else if(v==="issues")W.innerHTML=issuesPage();
 else if(v==="diary")W.innerHTML=diaryPage();else if(v==="docs")W.innerHTML=docsPage();else if(v==="team")W.innerHTML=pageHead("Equipa","Equipa e acessos","Quem trabalha na obra, o papel de cada pessoa e o trabalho atribuído.")+teamSection()+techSection();
 else if(v==="settings")W.innerHTML=settingsPage();
 W.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>go(b.dataset.go));
 W.querySelectorAll("[data-item]").forEach(r=>r.onclick=e=>{if(e.target.closest("select,input,button:not([data-item]),a"))return;openItem(r.dataset.item)});
 hydrate(W);
 ({equip:wireEquip,ids:wireIds,issues:wireIssues,diary:wireDiary,docs:wireDocs,team:()=>wireTeam(W),settings:()=>wireSettings(W)})[v](W)}

function equipList(){const q=EQ.q.trim().toLowerCase();return S.items.filter(i=>(!EQ.plan||i.planId===EQ.plan)&&(!EQ.type||i.type===EQ.type)&&(!EQ.stage||(i.stage||"previsto")===EQ.stage)&&(!EQ.who||(EQ.who==="-"?!i.assignee:i.assignee===EQ.who))
 &&(EQ.only!=="iss"||hasIssue(i))&&(EQ.only!=="noid"||!(i.devId||i.mac))&&(EQ.only!=="late"||isLate(i))&&(EQ.only!=="unpl"||i.x==null)
 &&(!q||[i.code,i.devId,i.mac,i.model,i.maker,i.serial,i.taskNo,i.note].join(" ").toLowerCase().includes(q)))
 .sort((a,b)=>S.plans.findIndex(p=>p.id===a.planId)-S.plans.findIndex(p=>p.id===b.planId)||String(a.code).localeCompare(String(b.code),"pt",{numeric:true}))}
function equipPage(){const L2=equipList();const ppl=[...new Set(S.items.map(i=>i.assignee).filter(Boolean))];
 return pageHead("Equipamentos","Equipamentos",`${S.items.length} equipamentos em ${S.plans.length} plantas`,`<button class="btn" id="eqCsv">Exportar CSV</button>`)+`
 <div class="card" style="padding:12px;display:grid;gap:10px"><div class="toolrow">
  <input type="search" id="eqQ" placeholder="Pesquisar referência, ID, MAC, modelo…" value="${esc(EQ.q)}">
  <select id="eqP"><option value="">Todas as plantas</option>${S.plans.map(p=>`<option value="${esc(p.id)}"${EQ.plan===p.id?" selected":""}>${esc(p.name)}</option>`).join("")}</select>
  <select id="eqT"><option value="">Todos os sistemas</option>${TYPES.map(t=>`<option value="${t.k}"${EQ.type===t.k?" selected":""}>${t.n}</option>`).join("")}</select>
  <select id="eqS"><option value="">Todas as etapas</option>${STAGES.map(s=>`<option value="${s.k}"${EQ.stage===s.k?" selected":""}>${s.n}</option>`).join("")}</select>
  <select id="eqW"><option value="">Todos os responsáveis</option><option value="-"${EQ.who==="-"?" selected":""}>Sem responsável</option>${ppl.map(id=>`<option value="${esc(id)}"${EQ.who===id?" selected":""}>${esc(nameOf(id))}</option>`).join("")}</select>
  <select id="eqO"><option value="">Todos</option><option value="noid"${EQ.only==="noid"?" selected":""}>Sem ID</option><option value="iss"${EQ.only==="iss"?" selected":""}>Com anomalia</option><option value="late"${EQ.only==="late"?" selected":""}>Em atraso</option><option value="unpl"${EQ.only==="unpl"?" selected":""}>Por colocar na planta</option></select>
  <span class="muted" style="font-size:13px">${L2.length} resultados</span>${vToggle(pageView("eq"))}</div>
 ${pageView("eq")==="grid"?eqGrid(L2):`<div class="tbl"><table><thead><tr><th>Ref.</th><th>ID</th><th>MAC</th><th>Planta</th><th>Sistema</th><th>Etapa</th><th>Responsável</th><th>Prazo</th><th class="num">Fotos</th><th class="num">Anom.</th></tr></thead><tbody>
 ${L2.slice(0,500).map(i=>`<tr class="click${isDup(i)?" dup":""}" data-item="${esc(i.id)}"><td class="mono">${esc(i.code)}</td><td class="mono">${esc(i.devId)}</td><td class="mono">${esc(i.mac)}</td><td>${esc(planName(i.planId))}</td><td>${esc(tOf(i.type).n)}</td>
  <td><span class="stchip" style="--c:${sOf(i.stage).c}">${sOf(i.stage).n}</span></td><td>${i.assignee?esc(nameOf(i.assignee)):`<span class="muted">—</span>`}</td><td${isLate(i)?' style="color:var(--bad);font-weight:600"':""}>${i.due?fmtDay(i.due):""}</td><td class="num">${(i.photos||[]).length||""}</td><td class="num"${openIssues(i.id).length?' style="color:var(--bad);font-weight:700"':""}>${openIssues(i.id).length||""}</td></tr>`).join("")||`<tr><td colspan="10" class="empty2">Nada corresponde aos filtros.</td></tr>`}
 ${L2.length>500?`<tr><td colspan="10" class="muted">A mostrar 500 de ${L2.length}. O CSV inclui todos.</td></tr>`:""}</tbody></table></div>`}</div>`}
/* apresentação em grelha ou lista (lembrada neste aparelho) */
function pageView(k){return getPref("of-v-"+k,k==="doc"?"list":"list")}
function wireVT(k,page){document.querySelectorAll("#pageWrap .vtog [data-vt]").forEach(b=>b.onclick=()=>{setPref("of-v-"+k,b.dataset.vt);renderPage(page)});hydrateThumbs($("pageWrap"))}
function eqGrid(L2){const R0=typeof refSet==="function"?refSet():null;
 return`<div class="eqgrid">${L2.slice(0,240).map(i=>{const ph=(i.photos||[]).slice(-1)[0],st=sOf(i.stage),oi=openIssues(i.id).length,rs=readStateOf(i);
  return`<div class="eqc${isDup(i)?" dup":""}" data-item="${esc(i.id)}" role="button" tabindex="0">
   <div class="eqph">${ph?`<img data-thumb="${esc(ph)}" alt="">`:`<span class="eqno"><svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/></svg>Sem foto</span>`}
    <span class="stchip" style="--c:${st.c}">${st.n}</span>${oi?`<span class="eqbad">${oi} anomalia${oi>1?"s":""}</span>`:""}</div>
   <div class="eqb"><div class="eqt"><b class="mono">${esc(i.code)}</b><span class="muted">${esc(tOf(i.type).n)}</span></div>
    <div class="eqid mono">${i.devId?`<b${rs==="fora"?' class="bad"':""}>${esc(i.devId)}</b>`:`<span class="muted">Sem ID</span>`}${rs&&rs!=="ok"?` <span class="rs rs-${rs}">${RS_N[rs]}</span>`:""}${isDup(i)?` <span class="rs rs-fora">Repetido</span>`:""}</div>
    <small class="muted">${esc(planName(i.planId))}${i.assignee?" · "+esc(nameOf(i.assignee)):""}${i.due?` · <span${isLate(i)?' class="bad"':""}>${fmtDay(i.due)}</span>`:""}</small></div></div>`}).join("")||`<div class="empty2">Nada corresponde aos filtros.</div>`}</div>${L2.length>240?`<p class="muted">A mostrar 240 de ${L2.length}. Usa os filtros ou a vista em lista.</p>`:""}`}
function isGrid(L2){const td=today();
 return`<div class="isgrid">${L2.map(x=>{const it=S.items.find(i=>i.id===x.itemId);const late=x.status!=="resolvida"&&x.due&&x.due<td;const pr=x.prio||"media";
  return`<div class="isc${x.status==="resolvida"?" done":""}"${it?` data-item="${esc(it.id)}" role="button" tabindex="0"`:(x.kind==="tarefa"||x.kind==="duvida")?` data-task="${esc(x.id)}" role="button" tabindex="0"`:""}>
   ${x.photo?`<div class="isph"><img data-thumb="${esc(x.photo)}" alt=""></div>`:""}
   <div class="isb"><div class="ist"><span class="prio ${pr}">${PRIO[pr]}</span><span class="stchip" style="--c:${x.status==="resolvida"?"var(--ok)":x.status==="curso"?"var(--info)":"var(--warn)"}">${x.status==="resolvida"?"Resolvida":x.status==="curso"?"Em curso":"Aberta"}</span></div>
    ${x.kind==="tarefa"||x.kind==="duvida"?`<b class="ist2"><span class="tkind k-${x.kind}"${x.cat&&typeof TCAT!=="undefined"&&TCAT[x.cat]?` style="background:${TCAT[x.cat].c}" title="${esc(TCAT[x.cat].n)}"`:""}>${x.kind==="duvida"?"Dúvida":"Tarefa"} ${x.seq?"#"+x.seq:""}</span> ${esc(x.title||"")}</b>`:""}<p>${esc(x.text)}</p>
    <small class="muted">${it?`<span class="mono">${esc(it.devId||it.code)}</span> · `:"Geral · "}${esc(planName(x.planId))}</small>
    <div class="isf"><span>${x.assignee?esc(nameOf(x.assignee)):`<span class="muted">Sem responsável</span>`}</span>${x.due?`<span${late?' class="bad"':""}>Prazo ${fmtDay(x.due)}</span>`:""}</div></div></div>`}).join("")||`<div class="empty2">Sem pendências ${ISF.st==="open"?"abertas":""}.</div>`}</div>`}
function docTile(d){const ex=docExt(d.name),n=(d.items||[]).length;
 return`<div class="doct"><span class="dti" style="--c:${DOC_COL[ex]||"#64748b"}">${esc(ex.slice(0,4))}</span><b title="${esc(d.name)}">${esc(d.name)}</b><small class="muted">${esc(d.cat||"")} · ${fmtSize(d.size||0)}${n?" · "+n+" equip.":""}</small><small class="muted">${esc(nameOf(d.by))} · ${fmtDate(d.at)}</small>
  <div class="dta"><button class="btn sm" data-dopen="${esc(d.id)}">Abrir</button>${S.canWrite&&(S.isCoord||d.by===S.meId)?`<button class="btn sm danger" data-ddel="${esc(d.id)}">Apagar</button>`:""}</div></div>`}
function wireEquip(){wireVT("eq","equip");const bind=(id,k)=>{const e=$(id);e.oninput=e.onchange=()=>{EQ[k]=e.value;const pos=e.selectionStart;renderPage("equip");const n=$(id);if(id==="eqQ"){n.focus();try{n.setSelectionRange(pos,pos)}catch(x){}}}};
 bind("eqQ","q");bind("eqP","plan");bind("eqT","type");bind("eqS","stage");bind("eqW","who");bind("eqO","only");
 $("eqCsv").onclick=()=>saveFile(`Equipamentos_${slug()}.csv`,"﻿"+reportCsv(equipList()))}

function idsPage(){const its=S.items;const withId=its.filter(i=>i.devId||i.mac);const dm=dupMap();const q=IDF.q.trim().toLowerCase();
 const L2=its.filter(i=>(IDF.only==="dup"?dm[i.id]:IDF.only==="noid"?!(i.devId||i.mac):true)&&(!q||[i.devId,i.mac,i.code].join(" ").toLowerCase().includes(q)))
  .sort((a,b)=>String(a.devId||a.mac||"~").localeCompare(String(b.devId||b.mac||"~"),"pt",{numeric:true}));
 return pageHead("Lista de IDs","Lista de IDs","Todos os identificadores registados na obra, com repetidos destacados.",`<button class="btn" id="idCopy">Copiar IDs</button><button class="btn" id="idCsv">Exportar CSV</button>`)+`
 <div class="kpis k4">
  ${kpi("var(--ok)",'<path d="M20 6L9 17l-5-5"/>',"Com ID ou MAC",withId.length,`${pct(withId.length,its.length)}% dos equipamentos`,pct(withId.length,its.length),"idK1")}
  ${kpi("var(--accent)",'<path d="M4 6h16M4 12h16M4 18h10"/>',"IDs únicos",new Set(withId.map(i=>String(i.devId||i.mac).toUpperCase())).size,"&nbsp;",null,"idK2")}
  ${kpi("var(--bad)",'<path d="M8 8h12v12H8z"/><path d="M4 16V4h12"/>',"Repetidos",Object.keys(dm).length,"a verificar",null,"idK3")}
  ${kpi("#9333ea",'<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>',"Sem ID",its.length-withId.length,"por identificar",null,"idK4")}</div>
 <div class="card" style="padding:12px;display:grid;gap:10px"><div class="toolrow"><input type="search" id="idQ" placeholder="Pesquisar ID, MAC ou referência…" value="${esc(IDF.q)}">
  <div class="seg"><button type="button" data-io="" aria-pressed="${!IDF.only}">Todos</button><button type="button" data-io="dup" aria-pressed="${IDF.only==="dup"}">Repetidos</button><button type="button" data-io="noid" aria-pressed="${IDF.only==="noid"}">Sem ID</button></div><span class="muted" style="font-size:13px">${L2.length} linhas</span></div>
 <div class="tbl"><table><thead><tr><th>ID</th><th>MAC</th><th>Ref.</th><th>Planta</th><th>Sistema</th><th>Etapa</th><th>Leitura</th><th></th></tr></thead><tbody>
 ${L2.slice(0,800).map(i=>`<tr class="click${dm[i.id]?" dup":""}" data-item="${esc(i.id)}"><td class="mono"><b>${esc(i.devId)||`<span class="muted">—</span>`}</b></td><td class="mono">${esc(i.mac)}</td><td class="mono">${esc(i.code)}</td><td>${esc(planName(i.planId))}</td><td>${esc(tOf(i.type).n)}</td><td><span class="stchip" style="--c:${sOf(i.stage).c}">${sOf(i.stage).n}</span></td><td class="muted" style="font-size:12px">${(()=>{const st=readStateOf(i);return st&&st!=="ok"?`<span class="rs rs-${st}">${RS_N[st]}</span>`:esc(i.readConf==="alta"?"Confirmado":i.readConf?"A confirmar":i.devId?"Manual":"")})()}</td><td>${dm[i.id]?`<span class="stchip" style="--c:var(--bad)">Repetido ×${dm[i.id]}</span>`:""}</td></tr>`).join("")||`<tr><td colspan="8" class="empty2">Sem resultados.</td></tr>`}</tbody></table></div></div>`}
function wireIds(){const q=$("idQ");q.oninput=()=>{IDF.q=q.value;const pos=q.selectionStart;renderPage("ids");$("idQ").focus();try{$("idQ").setSelectionRange(pos,pos)}catch(x){}};
 document.querySelectorAll("[data-io]").forEach(b=>b.onclick=()=>{IDF.only=b.dataset.io;renderPage("ids")});
 $("idK3").onclick=()=>{IDF.only="dup";renderPage("ids")};$("idK4").onclick=()=>{IDF.only="noid";renderPage("ids")};$("idK1").onclick=$("idK2").onclick=()=>{IDF.only="";renderPage("ids")};
 $("idCopy").onclick=()=>{const t=S.items.filter(i=>i.devId||i.mac).map(i=>[i.devId||"",i.mac||"",i.code,planName(i.planId)].join("\t")).join("\n");navigator.clipboard.writeText("ID\tMAC\tRef\tPlanta\n"+t).then(()=>toast("Lista copiada: cola no Excel.")).catch(()=>toast("Não foi possível copiar."))};
 $("idCsv").onclick=()=>{const e=v=>{v=String(v??"");return/[;"\n]/.test(v)?`"${v.replace(/"/g,'""')}"`:v};const dm=dupMap();
  saveFile(`IDs_${slug()}.csv`,"﻿"+[["ID","MAC","Ref","Planta","Sistema","Etapa","Repetido"],...S.items.map(i=>[i.devId,i.mac,i.code,planName(i.planId),tOf(i.type).n,sOf(i.stage).n,dm[i.id]?"sim":""])].map(r=>r.map(e).join(";")).join("\r\n"))}}

/* anomalias e pendências (punch list) */
const PRIO={alta:"Alta",media:"Média",baixa:"Baixa"};
function issueList(){const q=ISF.q.trim().toLowerCase();return S.issues.filter(x=>(ISF.st==="open"?x.status!=="resolvida":ISF.st==="done"?x.status==="resolvida":true)&&(!ISF.prio||(x.prio||"media")===ISF.prio)&&(!ISF.who||(ISF.who==="-"?!x.assignee:x.assignee===ISF.who))&&(!ISF.plan||x.planId===ISF.plan)&&(!ISF.kind||(x.kind||"anomalia")===ISF.kind)
 &&(!q||[x.title,x.text,(S.items.find(i=>i.id===x.itemId)||{}).code].join(" ").toLowerCase().includes(q))).sort((a,b)=>(a.status==="resolvida")-(b.status==="resolvida")||["alta","media","baixa"].indexOf(a.prio||"media")-["alta","media","baixa"].indexOf(b.prio||"media")||String(a.due||"9").localeCompare(String(b.due||"9"))||String(a.createdAt).localeCompare(String(b.createdAt)))}
function issuesPage(){const L2=issueList();const open=S.issues.filter(x=>x.status!=="resolvida");const td=today();const over=open.filter(x=>x.due&&x.due<td).length;const ppl=[...new Set(S.issues.map(x=>x.assignee).filter(Boolean))];
 return pageHead("Tarefas e anomalias","Tarefas, dúvidas e anomalias","Tudo o que há para fazer ou esclarecer na obra: tarefas e dúvidas marcadas na planta, anomalias dos equipamentos e pendências.",S.canWrite?`<button class="btn primary" id="isNew">+ Nova pendência</button>`:"")+`
 <div class="ptabs">${[["","Tudo"],["tarefa","Tarefas"],["duvida","Dúvidas"],["anomalia","Anomalias e pendências"]].map(([k,n])=>`<button type="button" data-ikind="${k}" class="${(ISF.kind||"")===k?"on":""}">${n} <span class="muted">${S.issues.filter(x=>x.status!=="resolvida"&&(!k||(x.kind||"anomalia")===k)).length}</span></button>`).join("")}</div>
 <div class="kpis k4">
  ${kpi("var(--warn)",'<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',"Abertas",open.length,"&nbsp;",null,"isK1")}
  ${kpi("var(--bad)",'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',"Fora de prazo",over,"&nbsp;",null,"isK2")}
  ${kpi("#b91c1c",'<path d="M12 2v20M2 12h20"/>',"Prioridade alta",open.filter(x=>x.prio==="alta").length,"&nbsp;",null,"isK3")}
  ${kpi("var(--ok)",'<path d="M20 6L9 17l-5-5"/>',"Resolvidas",S.issues.length-open.length,`${pct(S.issues.length-open.length,S.issues.length)}% do total`,pct(S.issues.length-open.length,S.issues.length),"isK4")}</div>
 <div id="isForm"></div>
 <div class="card" style="padding:12px;display:grid;gap:10px"><div class="toolrow"><input type="search" id="isQ" placeholder="Pesquisar descrição ou equipamento…" value="${esc(ISF.q)}">
  <div class="seg"><button type="button" data-ist="open" aria-pressed="${ISF.st==="open"}">Abertas</button><button type="button" data-ist="done" aria-pressed="${ISF.st==="done"}">Resolvidas</button><button type="button" data-ist="all" aria-pressed="${ISF.st==="all"}">Todas</button></div>
  <select id="isP"><option value="">Todas as prioridades</option>${Object.entries(PRIO).map(([k,n])=>`<option value="${k}"${ISF.prio===k?" selected":""}>${n}</option>`).join("")}</select>
  <select id="isW"><option value="">Todos</option><option value="-"${ISF.who==="-"?" selected":""}>Sem responsável</option>${ppl.map(id=>`<option value="${esc(id)}"${ISF.who===id?" selected":""}>${esc(nameOf(id))}</option>`).join("")}</select>
  <select id="isPl"><option value="">Todas as plantas</option>${S.plans.map(p=>`<option value="${esc(p.id)}"${ISF.plan===p.id?" selected":""}>${esc(p.name)}</option>`).join("")}</select>${vToggle(pageView("is"))}</div>
 ${pageView("is")==="grid"?isGrid(L2):`<div class="tbl"><table><thead><tr><th>Prioridade</th><th>Descrição</th><th>Equipamento</th><th>Planta</th><th>Responsável</th><th>Prazo</th><th>Estado</th><th>Registada</th></tr></thead><tbody>
 ${L2.map(x=>{const it=S.items.find(i=>i.id===x.itemId);const late=x.status!=="resolvida"&&x.due&&x.due<td;const can=S.canWrite;
  return`<tr${it?` class="click" data-item="${esc(it.id)}"`:(x.kind==="tarefa"||x.kind==="duvida")?` class="click" data-task="${esc(x.id)}"`:""}><td>${can?`<select data-iprio="${esc(x.id)}">${Object.entries(PRIO).map(([k,n])=>`<option value="${k}"${(x.prio||"media")===k?" selected":""}>${n}</option>`).join("")}</select>`:`<span class="prio ${x.prio||"media"}">${PRIO[x.prio||"media"]}</span>`}</td>
  <td style="max-width:340px">${x.kind==="tarefa"||x.kind==="duvida"?`<span class="tkind k-${x.kind}"${x.cat&&typeof TCAT!=="undefined"&&TCAT[x.cat]?` style="background:${TCAT[x.cat].c}" title="${esc(TCAT[x.cat].n)}"`:""}>${x.kind==="duvida"?"Dúvida":"Tarefa"} ${x.seq?"#"+x.seq:""}</span> <b>${esc(x.title||"")}</b><br>`:""}${x.photo?`<img data-ref="${esc(x.photo)}" alt="" style="width:34px;height:34px;object-fit:cover;border-radius:6px;float:left;margin-right:8px">`:""}${esc(x.text)}</td><td class="mono">${it?esc(it.devId||it.code):`<span class="muted">Geral</span>`}</td><td>${esc(planName(x.planId))}</td>
  <td>${x.assignee?esc(nameOf(x.assignee)):`<span class="muted">—</span>`}</td><td>${can?`<input type="date" data-idue="${esc(x.id)}" value="${esc(x.due||"")}"${late?' style="color:var(--bad);border-color:var(--bad)"':""}>`:x.due?fmtDay(x.due):""}</td>
  <td>${can?`<select data-ist2="${esc(x.id)}"><option value="aberta"${x.status==="aberta"||!x.status?" selected":""}>Aberta</option><option value="curso"${x.status==="curso"?" selected":""}>Em curso</option><option value="resolvida"${x.status==="resolvida"?" selected":""}>Resolvida</option></select>`:esc(x.status||"aberta")}</td>
  <td style="font-size:12px">${esc(nameOf(x.createdBy))}<div class="muted">${fmtDate(x.createdAt)}</div></td></tr>`}).join("")||`<tr><td colspan="8" class="empty2">Sem pendências ${ISF.st==="open"?"abertas":""}.</td></tr>`}</tbody></table></div>`}</div>`}
function wireIssues(){wireVT("is","issues");document.querySelectorAll("[data-ikind]").forEach(b=>b.onclick=()=>{ISF.kind=b.dataset.ikind;renderPage("issues")});const q=$("isQ");q.oninput=()=>{ISF.q=q.value;const pos=q.selectionStart;renderPage("issues");$("isQ").focus();try{$("isQ").setSelectionRange(pos,pos)}catch(x){}};
 document.querySelectorAll("[data-ist]").forEach(b=>b.onclick=()=>{ISF.st=b.dataset.ist;renderPage("issues")});
 $("isP").onchange=e=>{ISF.prio=e.target.value;renderPage("issues")};$("isW").onchange=e=>{ISF.who=e.target.value;renderPage("issues")};$("isPl").onchange=e=>{ISF.plan=e.target.value;renderPage("issues")};
 $("isK1").onclick=()=>{ISF.st="open";ISF.prio="";renderPage("issues")};$("isK3").onclick=()=>{ISF.st="open";ISF.prio="alta";renderPage("issues")};$("isK4").onclick=()=>{ISF.st="done";renderPage("issues")};$("isK2").onclick=()=>{ISF.st="open";renderPage("issues")};
 document.querySelectorAll("[data-iprio]").forEach(s=>s.onchange=()=>api.update("issues",s.dataset.iprio,{prio:s.value}));
 document.querySelectorAll("[data-idue]").forEach(s=>s.onchange=()=>api.update("issues",s.dataset.idue,{due:s.value||""}));
 document.querySelectorAll("[data-ist2]").forEach(s=>s.onchange=()=>{const id=s.dataset.ist2;if(s.value==="resolvida")resolveIssue(id);else api.update("issues",id,{status:s.value,resolvedAt:null,resolvedBy:null})});
 const nb=$("isNew");if(nb)nb.onclick=()=>{const F=$("isForm");let who=null;
  F.innerHTML=`<div class="card" style="padding:14px;display:grid;gap:10px"><b>Nova pendência</b><textarea id="nfT" rows="2" placeholder="O que é preciso fazer ou corrigir?" style="border:1px solid var(--line);border-radius:8px;padding:8px"></textarea>
   <div class="toolrow"><select id="nfPl">${S.plans.map(p=>`<option value="${esc(p.id)}"${p.id===S.planId?" selected":""}>${esc(p.name)}</option>`).join("")}</select><select id="nfPr">${Object.entries(PRIO).map(([k,n])=>`<option value="${k}"${k==="media"?" selected":""}>Prioridade ${n.toLowerCase()}</option>`).join("")}</select><input type="date" id="nfD"><span id="nfW" style="min-width:200px"></span><label class="btn sm" for="nfPh">Foto</label><input type="file" id="nfPh" accept="image/*" hidden></div>
   <div class="toolrow"><button class="btn" id="nfX">Cancelar</button><button class="btn primary" id="nfOk">Registar</button></div></div>`;
  mountPicker($("nfW"),null,id=>{who=id},"Responsável…");let photo=null;$("nfPh").onchange=async e=>{const f=e.target.files[0];if(f){photo=await putFile(await shrink(f),"image/jpeg");toast("Foto anexada")}};
  $("nfX").onclick=()=>{F.innerHTML=""};$("nfOk").onclick=async()=>{const t=$("nfT").value.trim();if(!t){$("nfT").focus();return}
   await api.set("issues",uid(),{itemId:null,planId:$("nfPl").value,text:t,photo,assignee:who,prio:$("nfPr").value,due:$("nfD").value||"",status:"aberta",createdBy:S.meId,createdAt:now()});F.innerHTML="";toast("Pendência registada")};$("nfT").focus()}}

/* diário de obra */
const WEATHER=["☀️ Sol","⛅ Nublado","🌧️ Chuva","💨 Vento","🥵 Calor","🥶 Frio"];
function diaryDoc(d){return L.meta["diary_"+d]||{}}
function diaryPage(){const d=diaryDay||today();const D=diaryDoc(d);const x=dayStats(d);const ro=!S.canWrite;
 const days=[...new Set([...Object.keys(L.meta||{}).filter(k=>k.startsWith("diary_")).map(k=>k.slice(6)),...S.items.flatMap(i=>(i.log||[]).map(e=>dayOf(e.at)))])].filter(Boolean).sort().reverse().slice(0,40);
 return pageHead("Diário de obra","Diário de obra","Registo diário: tempo, equipa em obra, trabalhos realizados e ocorrências. A atividade da app entra automaticamente.",`<input type="date" id="dyD" value="${d}" style="border:1px solid var(--line);border-radius:8px;padding:7px 9px"><button class="btn" id="dyCopy">Copiar resumo</button><button class="btn primary" id="dyPdf">Descarregar PDF</button>`)+`
 <div class="diary"><div class="card" style="padding:16px;display:grid;gap:12px">
  <div class="toolrow" style="justify-content:space-between"><b style="font-size:16px">${new Date(d+"T12:00").toLocaleDateString("pt-PT",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</b>${D.at?`<span class="muted" style="font-size:12px">Atualizado por ${esc(nameOf(D.by))} · ${fmtDate(D.at)}</span>`:""}</div>
  <div class="dyrow"><label class="f">Tempo<select id="dyW"${ro?" disabled":""}><option value="">—</option>${WEATHER.map(w=>`<option${D.weather===w?" selected":""}>${w}</option>`).join("")}</select></label>
   <label class="f">Temperatura (°C)<input id="dyT" type="number" value="${esc(D.temp??"")}"${ro?" readonly":""}></label>
   <label class="f">Pessoas em obra<input id="dyN" type="number" min="0" value="${esc(D.workers??"")}"${ro?" readonly":""}></label>
   <label class="f">Empresas / equipas<input id="dyE" value="${esc(D.crews||"")}" placeholder="ex.: Elétrica 4, AVAC 2"${ro?" readonly":""}></label></div>
  <label class="f">Trabalhos realizados<textarea id="dyWk" rows="4"${ro?" readonly":""}>${esc(D.works||"")}</textarea></label>
  ${ro?"":`<button class="btn sm" id="dyFill" style="justify-self:start">Preencher com a atividade registada na app</button>`}
  <label class="f">Ocorrências, segurança e condicionantes<textarea id="dyOc" rows="3"${ro?" readonly":""}>${esc(D.events||"")}</textarea></label>
  <label class="f">Visitas e fiscalização<input id="dyV" value="${esc(D.visits||"")}"${ro?" readonly":""}></label>
  <div class="sec"><h4><span>Fotos do dia</span>${ro?"":`<label class="btn sm" for="dyPh">+ Fotos</label><input type="file" id="dyPh" accept="image/*" multiple hidden>`}</h4><div class="photos">${(D.photos||[]).map(r=>`<div class="phw"><button type="button" data-dph="${esc(r)}"><img data-ref="${esc(r)}" alt=""></button></div>`).join("")||`<span class="none">Sem fotos.</span>`}</div></div>
  ${ro?"":`<div class="toolrow" style="justify-content:flex-end"><button class="btn primary" id="dySave">Guardar diário</button></div>`}</div>
 <div style="display:grid;gap:14px;align-content:start"><div class="card" style="padding:14px;display:grid;gap:8px"><b>Atividade registada na app</b>
  <div class="daygrid">${["instalado","enderecado","testado","validado","aceite"].map(k=>`<div class="tile"><span>${sOf(k).n}s</span><b>${x.st(k)}</b></div>`).join("")}<div class="tile"><span>IDs registados</span><b>${x.ids}</b></div><div class="tile${x.issNew.length?" bad":""}"><span>Anomalias novas</span><b>${x.issNew.length}</b></div><div class="tile"><span>Resolvidas</span><b>${x.issRes.length}</b></div></div>
  ${Object.keys(x.people).length?`<div class="muted" style="font-size:13px">${Object.entries(x.people).map(([id,n])=>`${esc(nameOf(id))}: ${n} ações`).join(" · ")}</div>`:""}</div>
  <div class="card" style="padding:14px;display:grid;gap:6px"><b>Dias</b><div class="dydays">${days.map(k=>`<button type="button" data-dd="${k}" class="${k===d?"on":""}">${fmtDay(k)}/${k.slice(2,4)}${L.meta["diary_"+k]?" ✓":""}</button>`).join("")||`<span class="none">Sem registos.</span>`}</div></div></div></div>`}
function dayWorksText(d){const x=dayStats(d);const by={};for(const e of x.ev){const k=(S.plans.find(p=>p.id===e.it.planId)||{}).name||"?";by[k]=by[k]||{};const t=e.t.replace(/\s*\(.*\)$/,"");by[k][t]=(by[k][t]||0)+1}
 return Object.entries(by).map(([pl,ts])=>`${pl}: `+Object.entries(ts).map(([t,n])=>`${t} (${n})`).join(", ")).join("\n")}
function wireDiary(){const d=diaryDay||today();
 $("dyD").onchange=e=>{diaryDay=e.target.value||today();renderPage("diary")};
 document.querySelectorAll("[data-dd]").forEach(b=>b.onclick=()=>{diaryDay=b.dataset.dd;renderPage("diary")});
 document.querySelectorAll("[data-dph]").forEach(b=>b.onclick=()=>openPhoto(null,b.dataset.dph));
 const f=$("dyFill");if(f)f.onclick=()=>{const t=dayWorksText(d);const ta=$("dyWk");ta.value=(ta.value?ta.value+"\n":"")+(t||"Sem atividade registada na app neste dia.")};
 const read=()=>({weather:$("dyW").value,temp:$("dyT").value,workers:$("dyN").value,crews:$("dyE").value,works:$("dyWk").value,events:$("dyOc").value,visits:$("dyV").value});
 const sv=$("dySave");if(sv)sv.onclick=async()=>{await api.set("meta","diary_"+d,{...diaryDoc(d),...read(),day:d,by:S.meId,at:now()});toast("Diário guardado.");renderPage("diary")};
 const ph=$("dyPh");if(ph)ph.onchange=async e=>{const fs=[...e.target.files];e.target.value="";const refs=[];for(const f2 of fs){try{refs.push(await putFile(await shrink(f2),"image/jpeg"))}catch(x){}}
  await api.set("meta","diary_"+d,{...diaryDoc(d),...read(),day:d,photos:[...(diaryDoc(d).photos||[]),...refs],by:S.meId,at:now()});renderPage("diary")};
 $("dyCopy").onclick=()=>{const D=diaryDoc(d);const t=[dayText(d),"",D.weather?"Tempo: "+D.weather+(D.temp?` (${D.temp} °C)`:""):"",D.workers?"Pessoas em obra: "+D.workers:"",D.crews?"Equipas: "+D.crews:"",D.works?"\nTrabalhos:\n"+D.works:"",D.events?"\nOcorrências:\n"+D.events:"",D.visits?"Visitas: "+D.visits:""].filter(Boolean).join("\n");
  navigator.clipboard.writeText(t).then(()=>toast("Resumo copiado")).catch(()=>toast("Não foi possível copiar."))};
 $("dyPdf").onclick=()=>diaryPdf(d)}
async function diaryPdf(d){if(!window.jspdf){toast("Gerador de PDF indisponível.");return}const D=diaryDoc(d),x=dayStats(d);const{jsPDF}=window.jspdf;const doc=new jsPDF({unit:"mm",format:"a4"});const M=15,W=doc.internal.pageSize.getWidth();let y=M+4;
 const line=(k,v)=>{if(!v)return;doc.setFont("helvetica","bold");doc.text(k+":",M,y);doc.setFont("helvetica","normal");const ls=doc.splitTextToSize(String(v),W-2*M-40);doc.text(ls,M+40,y);y+=5.5*ls.length+1};
 const para=(k,v)=>{if(!v)return;y+=2;doc.setFont("helvetica","bold");doc.text(k,M,y);y+=6;doc.setFont("helvetica","normal");const ls=doc.splitTextToSize(String(v),W-2*M);doc.text(ls,M,y);y+=5*ls.length+2};
 doc.setFont("helvetica","bold");doc.setFontSize(18);doc.text("Diário de obra",M,y);y+=9;doc.setFontSize(11);
 line("Obra",S.meta.name||"—");line("Data",new Date(d+"T12:00").toLocaleDateString("pt-PT",{weekday:"long",day:"numeric",month:"long",year:"numeric"}));
 line("Tempo",(D.weather||"").replace(/^\S+\s/,"")+(D.temp?` · ${D.temp} °C`:""));line("Pessoas em obra",D.workers);line("Equipas",D.crews);line("Visitas",D.visits);
 para("Trabalhos realizados",D.works);para("Ocorrências e segurança",D.events);
 para("Atividade registada na app",["instalado","enderecado","testado","validado","aceite"].map(k=>`${sOf(k).n}s: ${x.st(k)}`).join("  ·  ")+`\nIDs registados: ${x.ids}  ·  Anomalias novas: ${x.issNew.length}  ·  Resolvidas: ${x.issRes.length}`);
 const ph=(D.photos||[]).slice(0,6);if(ph.length){y+=2;let col=0;for(const r of ph){try{const t=await thumbData(r);if(!t)continue;if(y>235){doc.addPage();y=M}doc.addImage(t,"JPEG",M+col*62,y,58,42);col++;if(col===3){col=0;y+=46}}catch(e){}}if(col)y+=46}
 y=Math.max(y+8,250);if(y>270){doc.addPage();y=M+10}doc.setDrawColor(150);doc.line(M,y+12,M+70,y+12);doc.setFontSize(9);doc.text("Diretor de obra / responsável",M,y+17);
 await saveBlob(`Diario_obra_${d}.pdf`,doc.output("blob"))}

/* documentos */
function docsPage(){const q=docF.q.trim().toLowerCase();const all=docsAll();const L2=all.filter(d=>(!docF.cat||d.cat===docF.cat)&&(!q||String(d.name).toLowerCase().includes(q)));
 return pageHead("Documentos","Documentos","Projeto, fichas técnicas, certificados, atas e outros ficheiros da obra. Ficam disponíveis para toda a equipa e podem ser ligados aos equipamentos.",S.canWrite?`<select id="docCat">${DOC_CATS.map(c=>`<option>${c}</option>`).join("")}</select><label class="btn primary" for="docUp">+ Carregar documentos</label><input type="file" id="docUp" multiple hidden>`:"")+`
 <div class="ptabs">${["",...DOC_CATS].map(c=>`<button type="button" data-dc="${esc(c)}" class="${docF.cat===c?"on":""}">${c||"Todos"} <span class="muted">${(c?all.filter(d=>d.cat===c):all).length}</span></button>`).join("")}</div>
 <div class="card" style="padding:12px;display:grid;gap:10px"><div class="toolrow"><input type="search" id="docQ" placeholder="Pesquisar documento…" value="${esc(docF.q)}"><span class="muted" style="font-size:13px">${L2.length} documento${L2.length===1?"":"s"}</span>${vToggle(pageView("doc"))}</div>
 <div class="${pageView("doc")==="grid"?"docgrid":"doclist"}">${L2.map(d=>{if(pageView("doc")==="grid")return docTile(d);const n=(d.items||[]).length,tp=(d.types||[]).map(t=>tOf(t).n);return docRow(d,`${n||tp.length?`<span class="muted" style="font-size:12px">${n?n+" equip.":""}${tp.length?" "+tp.join(", "):""}</span>`:""}<button class="btn sm" data-dopen="${esc(d.id)}">Abrir</button>${S.canWrite&&(S.isCoord||d.by===S.meId)?`<button class="btn sm danger" data-ddel="${esc(d.id)}">Apagar</button>`:""}`)}).join("")||`<div class="empty2">Ainda não há documentos${docF.cat?" nesta categoria":""}.</div>`}</div></div>`}
function wireDocs(){wireVT("doc","docs");const q=$("docQ");q.oninput=()=>{docF.q=q.value;const pos=q.selectionStart;renderPage("docs");$("docQ").focus();try{$("docQ").setSelectionRange(pos,pos)}catch(x){}};
 document.querySelectorAll("[data-dc]").forEach(b=>b.onclick=()=>{docF.cat=b.dataset.dc;renderPage("docs")});
 document.querySelectorAll("[data-dopen]").forEach(b=>b.onclick=()=>openDoc(b.dataset.dopen));
 document.querySelectorAll("[data-ddel]").forEach(b=>b.onclick=()=>{if(!b.classList.contains("armed")){b.classList.add("armed");b.textContent="Confirmar";return}api.del("meta",b.dataset.ddel);toast("Documento apagado")});
 const up=$("docUp");if(up){if(docF.cat)$("docCat").value=docF.cat;up.onchange=async e=>{const fs=[...e.target.files];e.target.value="";await uploadDocs(fs,$("docCat").value,null);renderPage("docs")}}}

/* configurações */
function settingsPage(){return pageHead("Configurações","Configurações","Projeto, notificações, envio de emails, leitura com IA, dados e utilização sem rede.")+`
 ${S.isCoord?`<section class="block"><h2>Projeto</h2><div class="card" style="padding:14px;display:grid;gap:10px;max-width:640px"><label class="f">Nome da obra<input id="stName" value="${esc(S.meta.name||"")}" placeholder="ex.: HCI - Fit-out Sede CGD"></label>
  <label class="f">Cliente / dono de obra<input id="stClient" value="${esc(S.meta.client||"")}"></label><label class="f">Morada<input id="stAddr" value="${esc(S.meta.address||"")}"></label>
  <div class="toolrow"><button class="btn primary" id="stSave">Guardar</button></div></div></section>`:""}
 ${notifCard()}${mailSection()}${aiSection()}${dataSection()}${offlineSection()}`}
function wireSettings(W){const sv=$("stSave");if(sv)sv.onclick=async()=>{const row={name:$("stName").value.trim()||S.meta.name||"Obra",client:$("stClient").value.trim(),address:$("stAddr").value.trim()};
  await saveProjectRow(row);api.set("meta","project",{...S.meta,...row});toast("Projeto guardado.")};
 wireNotif(W);wireMail(W);wireAi(W);wireData(W)}
/* menu "Ações" na barra da planta (agrupa as opções menos usadas) */
(()=>{const bar=document.querySelector("#viewObra .bar");if(!bar)return;const w=document.createElement("div");w.className="actwrap";
 w.innerHTML=`<button type="button" class="btn" id="btnAct" aria-haspopup="true">Ações ▾</button><div class="actmenu" id="actMenu" hidden></div>`;
 const grow=bar.querySelector(".grow");(grow||bar.lastChild).after(w);const m=w.querySelector("#actMenu");
 ["btnExp","btnOv","btnFw","btnFloor"].forEach(id=>{const b=$(id);if(b)m.appendChild(b)});
 const imp=bar.querySelector('label[for="bulkIn"]');if(imp)m.prepend(imp);
 $("btnAct").onclick=e=>{e.stopPropagation();m.hidden=!m.hidden};m.addEventListener("click",()=>{setTimeout(()=>{m.hidden=true},0)});
 document.addEventListener("click",e=>{if(!e.target.closest(".actwrap"))m.hidden=true})})();

/* preparar o leitor de etiquetas em segundo plano quando se abre a planta (a 1.ª leitura fica rápida) */
let warmDone=false;
function warmReader(){if(warmDone||!S.canWrite||!navigator.onLine&&!poolP)return;warmDone=true;const f=()=>pool().catch(()=>{warmDone=false});("requestIdleCallback" in window)?requestIdleCallback(f,{timeout:8000}):setTimeout(f,4000)}
/* aviso se o styles.css publicado não corresponde a esta versão da app (envio incompleto ou cache antiga) */
const APP_VER="46";
setTimeout(()=>{const v=getComputedStyle(document.documentElement).getPropertyValue("--cp-ver").replace(/["'\s]/g,"");
 if(v!==APP_VER){const b=$("banner");b.hidden=false;b.innerHTML=`<span><b>Atualização incompleta:</b> o ficheiro <b>styles.css</b> publicado é de outra versão${v?" ("+esc(v)+")":""}. Envia para o GitHub os ficheiros index.html, app.js e styles.css da mesma versão e recarrega a página.</span><button class="btn sm" id="hardReload">Recarregar</button>`;
  $("hardReload").onclick=async()=>{try{const ks=await caches.keys();await Promise.all(ks.map(k=>caches.delete(k)));const rs=await navigator.serviceWorker.getRegistrations();await Promise.all(rs.map(r=>r.update()))}catch(e){}location.reload()}}},1500);

/* =========================================================
   Modo foco na planta: só a planta e o essencial à vista.
   Menu, lista de plantas, lista de equipamentos, legenda e resumo
   abrem-se com botões (e ficam lembrados neste aparelho).
   ========================================================= */
(()=>{const bar=document.querySelector("#viewObra .bar");if(!bar)return;const B=document.body;
 const KEY="cp-focus";let st={};try{st=JSON.parse(localStorage.getItem(KEY)||"{}")||{}}catch(e){}
 const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(st))}catch(e){}};
 const apply=()=>{B.classList.toggle("pl-open",!!st.pl);B.classList.toggle("ls-open",!!st.ls);B.classList.toggle("lg-open",!!st.lg);B.classList.toggle("sb-open",!!st.sb);
  const set=(id,on)=>{const b=$(id);if(b)b.setAttribute("aria-pressed",on?"true":"false")};set("fPlans",st.pl);set("fList",st.ls);set("fLeg",st.lg)};
 const tog=k=>{st[k]=!st[k];save();apply();if(k==="ls"||k==="pl")setTimeout(()=>{try{fit()}catch(e){}},220)};
 // botões novos
 const mk=(id,html,title)=>{const b=document.createElement("button");b.type="button";b.className="btn fbtn";b.id=id;b.innerHTML=html;b.title=title;return b};
 const ic=d=>`<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
 const bPl=mk("fPlans",ic('<rect x="3" y="4" width="7" height="16" rx="1.5"/><path d="M14 6h7M14 12h7M14 18h7"/>')+"<span>Plantas</span>","Mostrar ou esconder a lista de plantas");
 const bLs=mk("fList",ic('<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>')+'<span>Lista</span><b class="fcnt" id="fListN"></b>',"Mostrar ou esconder a lista de equipamentos");
 bar.prepend(bPl);
 const seg=bar.querySelector(".seg");(seg||bar.lastChild).after(bLs);
 bPl.onclick=()=>tog("pl");bLs.onclick=()=>tog("ls");
 // "Ações" com ícone (no telemóvel fica só o ícone)
 const ba=$("btnAct");if(ba){ba.classList.add("fbtn");ba.innerHTML=ic('<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>')+"<span>Ações</span>"}
 // "Marcar equipamento" mais curto
 const mm=$("mMark");if(mm)mm.textContent="Marcar";
 // menos usados para dentro de "Ações"
 const m=$("actMenu");
 if(m){const nf=$("btnNewFloor"),mkb=$("btnMk");if(mkb)m.prepend(mkb);if(nf){nf.classList.remove("primary");m.prepend(nf)}
  const lg=document.createElement("button");lg.type="button";lg.className="btn";lg.id="fLeg";lg.textContent="Legenda das cores";lg.onclick=()=>tog("lg");
  const sb=document.createElement("button");sb.type="button";sb.className="btn";sb.id="fSum";sb.textContent="Resumo do piso (barra inferior)";sb.onclick=()=>tog("sb");
  m.append(lg,sb)}
 // botão de legenda na planta, junto ao zoom
 const z=document.querySelector("#viewer .zoom");if(z){const b=document.createElement("button");b.className="btn";b.id="zLeg";b.type="button";b.title="Legenda das cores";b.setAttribute("aria-label","Legenda");b.textContent="?";b.onclick=e=>{e.stopPropagation();tog("lg")};z.appendChild(b)}
 // a dica "Navegar: arrasta…" só aparece nos primeiros usos; as dos outros modos ficam sempre
 const h=$("hint");if(h){let seen=0;try{seen=+localStorage.getItem("cp-navhint")||0}catch(e){}
  const chk=()=>{const nav=/^Navegar/.test((h.textContent||"").trim());h.classList.toggle("fhide",nav&&seen>=3)};
  new MutationObserver(chk).observe(h,{childList:true,subtree:true,characterData:true});chk();
  if(seen<3){seen++;try{localStorage.setItem("cp-navhint",seen)}catch(e){}}}
 // contador "por fazer" no botão Lista
 setInterval(()=>{const n=$("fListN");if(!n||S.view!=="obra")return;const c=document.querySelector('.filters [data-f="todo"] b');const t=c?c.textContent.trim():"";if(n.textContent!==t)n.textContent=t},700);
 // ao abrir a ficha de um equipamento num ecrã pequeno, a lista de plantas fecha-se
 document.addEventListener("click",e=>{if(st.pl&&innerWidth<1100&&e.target.closest("#plansPane [data-pl]")){st.pl=false;save();apply()}});
 apply()})();

/* =========================================================
   ObraFlow · Projetos e plantas
   1) ao entrar aparecem os projetos a que a pessoa tem acesso;
   2) ao escolher um projeto aparecem as plantas e as pastas desse projeto;
   apresentação em grelha ou em lista; carregar ficheiros e criar pastas.
   ========================================================= */
PAGE_VIEWS.push("projects","plans");
const PJ_ST={em_curso:"Em curso",pausa:"Em pausa",concluido:"Concluído"};
const PST={};                                   // estatísticas por projeto {plans,items,tested}
(async()=>{try{Object.assign(PST,(await IDBX.get("kv","pstats"))||{})}catch(e){}})();
let pstTimer=null;function savePst(){clearTimeout(pstTimer);pstTimer=setTimeout(()=>IDBX.put("kv","pstats",PST).catch(()=>{}),800)}
function curProject(){return S.projects.find(p=>p.id===S.projectId)||null}
/* no servidor com projetos manda a tabela de projetos; sem ela (ou na demonstração) manda o nome guardado nos dados da obra */
function syncMetaName(){const p=curProject();if(!p)return;
 if(S.mp&&!S.demo){if(p.name)S.meta={...S.meta,name:p.name,client:p.client||S.meta.client||"",address:p.address||S.meta.address||""};return}
 if(S.meta.name&&S.meta.name!==p.name){p.name=S.meta.name;IDBX.put("kv","projects",S.projects).catch(()=>{})}
 else if(!S.meta.name&&p.name)S.meta={...S.meta,name:p.name}}
const isAdminRole=()=>S.isAdmin||S.role==="admin"||S.demo;

/* ---------- carregar a lista de projetos ---------- */
async function loadProjects(){let list=null;
 if(S.demo){list=(await IDBX.get("kv","projects").catch(()=>null))||[{id:"p0",name:"Obra de demonstração",client:"",address:"",status:"em_curso"}];S.mp=true}
 else if(sb&&S.session&&navigator.onLine){
  try{const r=await sb.from("projects").select("id,name,client,address,status,created_at").order("created_at",{ascending:true});
   if(r.error)throw r.error;S.mp=true;list=r.data||[];
   let m=await sb.from("project_members").select("project_id,user_id,role");if(m.error)m=await sb.from("project_members").select("project_id,user_id");S.pm=m.error?[]:(m.data||[]);IDBX.put("kv","pm",S.pm).catch(()=>{})}
  catch(e){S.mp=false;list=null}
  IDBX.put("kv","mp",S.mp).catch(()=>{})}
 else{S.mp=!!(await IDBX.get("kv","mp").catch(()=>false));S.pm=(await IDBX.get("kv","pm").catch(()=>null))||[];list=await IDBX.get("kv","projects").catch(()=>null)}
 if(!list||!S.mp&&!S.demo){   // servidor sem a atualização 3: há um só projeto
  const m=await IDBX.get("docs","p0|meta|project").catch(()=>null);const c=list&&list[0];
  list=[{id:"p0",name:(m&&m.data&&m.data.name)||(c&&c.name)||"A minha obra",client:(m&&m.data&&m.data.client)||"",address:(m&&m.data&&m.data.address)||"",status:"em_curso"}]}
 S.projects=list;IDBX.put("kv","projects",list).catch(()=>{});
 if(S.projectId&&!list.some(p=>p.id===S.projectId)){S.projectId=null;await loadLocal();COLS.forEach(c=>emit(c));if(S.view!=="projects")S.view="projects"}
 syncMetaName();loadRemoteStats();return list}
let statsBusy=false;
async function loadRemoteStats(){if(statsBusy||S.demo||!S.mp||!sb||!S.session||!navigator.onLine)return;statsBusy=true;
 try{for(const p of S.projects){if(p.id===S.projectId)continue;
   const base=c=>sb.from("docs").select("id",{count:"exact",head:true}).eq("project",p.id).eq("col",c).eq("deleted",false);
   const[a,b,t]=await Promise.all([base("plans"),base("items"),base("items").in("data->>stage",["testado","validado","aceite"])]);
   if(a.error||b.error)continue;PST[p.id]={plans:a.count||0,items:b.count||0,tested:(t&&!t.error&&t.count)||0}}
  savePst();if(S.view==="projects")render()}
 catch(e){}finally{statsBusy=false}}
function curStats(){if(!S.projectId)return;const its=S.items;const o={plans:S.plans.length,items:its.length,tested:its.filter(i=>sIdx(i.stage)>=3).length};
 const p=PST[S.projectId];if(!p||p.plans!==o.plans||p.items!==o.items||p.tested!==o.tested){PST[S.projectId]=o;savePst()}}

/* ---------- abrir um projeto ---------- */
async function openProject(id,view){if(!S.projects.some(p=>p.id===id))return;
 if(S.projectId!==id){S.projectId=id;try{localStorage.setItem("of-last-project",id)}catch(e){}
  S.planId=null;S.sel=null;S.draw=null;loadedPlan=null;plFolder=null;plQ2="";autoDone=false;
  await loadLocal();COLS.forEach(c=>emit(c));syncMetaName()}
 setRole(S.role);
 go(view||"plans");syncNow().then(()=>{autoStageAll&&autoStageAll();setTimeout(bgScan,1500)})}

/* sem projeto escolhido só se pode estar na lista de projetos */
const goBase=go;
go=function(v){if(!S.projectId&&v!=="projects"&&v!=="more")v="projects";goBase(v)};

/* ---------- moldura: estado da vista de projetos ---------- */
const renderShellBase=renderShell;
renderShell=function(){renderShellBase();const v=S.view;document.body.dataset.view=v;
 const pc=$("sideProj");if(pc)pc.textContent=(curProject()||{}).name||S.meta.name||"Escolher projeto";
 const cp=$("cnt_plans");if(cp){cp.hidden=!S.plans.length;cp.textContent=S.plans.length}
 curStats()};
const renderPageBase=renderPage;
renderPage=function(v){if(v==="projects")return renderProjects();if(v==="plans")return renderPlansPage();return renderPageBase(v)};
/* o "Projeto ›" da planta volta à lista de plantas */
document.addEventListener("click",e=>{const b=e.target.closest('#oHead [data-go="home"]');if(b){e.stopImmediatePropagation();e.preventDefault();go("plans")}},true);

/* ---------- ícones e botões de apresentação ---------- */
const IC={grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
 list:'<path d="M9 6h12M9 12h12M9 18h12"/><rect x="3" y="4.5" width="3" height="3" rx=".8"/><rect x="3" y="10.5" width="3" height="3" rx=".8"/><rect x="3" y="16.5" width="3" height="3" rx=".8"/>',
 folder:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
 fplus:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 10.5v5M9.5 13h5"/>',
 up:'<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
 dots:'<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
 users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.9.7 3.1 2.4 3.5 5.2"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/>',back:'<path d="M15 18l-6-6 6-6"/>'};
const ico=k=>`<svg viewBox="0 0 24 24" aria-hidden="true">${IC[k]}</svg>`;
const getPref=(k,d)=>{try{return localStorage.getItem(k)||d}catch(e){return d}},setPref=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
function vToggle(cur){return`<div class="vtog" role="group" aria-label="Apresentação"><button type="button" data-vt="grid" aria-pressed="${cur==="grid"}" title="Grelha">${ico("grid")}<span>Grelha</span></button><button type="button" data-vt="list" aria-pressed="${cur==="list"}" title="Lista">${ico("list")}<span>Lista</span></button></div>`}
function hueOf(s){let h=0;for(const ch of String(s))h=(h*31+ch.charCodeAt(0))%360;return h}
function initials(n){const w=String(n||"?").replace(/[^\p{L}\p{N} ]/gu," ").split(/\s+/).filter(x=>x&&!/^(de|da|do|das|dos|e|-)$/i.test(x));return((w[0]||"?")[0]+((w[1]||"")[0]||"")).toUpperCase()}
function peopleIn(pid){if(!S.mp||S.demo)return null;return new Set(S.pm.filter(x=>x.project_id===pid).map(x=>x.user_id)).size}

/* ---------- página: projetos ---------- */
let pjQ="";
function renderProjects(){const W=$("pageWrap");const v=getPref("of-pj-view","grid");const q=pjQ.trim().toLowerCase();
 const list=S.projects.filter(p=>!q||[p.name,p.client,p.address].join(" ").toLowerCase().includes(q));
 const first=String((S.me&&S.me.name)||"").split(/[\s@]/)[0];
 const canNew=S.isCoord&&(S.mp||S.demo);
 W.innerHTML=`<div class="pjhead"><div><span class="pjk">ObraFlow</span><h2>Os meus projetos</h2><p>${first?`Olá ${esc(first)}. `:""}Escolhe a obra para veres as plantas.</p></div>
  ${canNew?`<button type="button" class="btn primary bigb" id="pjNew">${ico("plus")}Novo projeto</button>`:""}</div>
 <div class="ftool"><label class="fsearch">${ico("search")}<input id="pjQ" type="search" placeholder="Procurar projeto, cliente ou morada…" value="${esc(pjQ)}" aria-label="Procurar projeto"></label><span class="fcount">${list.length} projeto${list.length===1?"":"s"}</span>${vToggle(v)}</div>
 ${list.length?(v==="grid"?`<div class="pjgrid">${list.map(pjCard).join("")}</div>`:`<div class="pjlist card"><div class="pjr pjrh"><span></span><span>Projeto</span><span>Plantas</span><span>Equipam.</span><span>Testado</span><span>Estado</span><span></span></div>${list.map(pjRow).join("")}</div>`)
  :`<div class="empty3">${ico("folder")}<b>${q?"Nenhum projeto encontrado.":"Ainda não tens acesso a nenhum projeto."}</b><span>${q?"Experimenta outra pesquisa.":S.isCoord?"Cria o primeiro projeto para começar.":"Pede à coordenação para te dar acesso a uma obra."}</span></div>`}
 ${!S.mp&&!S.demo&&S.isCoord?`<div class="msg warn" style="margin-top:14px">Para criar mais projetos e escolher quem tem acesso a cada um, corre no Supabase o ficheiro <b>supabase/atualizacao-3-projetos.sql</b> (ver LEIA-ME).</div>`:""}`;
 const qi=$("pjQ");qi.oninput=e=>{pjQ=e.target.value;const pos=e.target.selectionStart;renderProjects();const n=$("pjQ");n.focus();try{n.setSelectionRange(pos,pos)}catch(x){}};
 W.querySelectorAll("[data-vt]").forEach(b=>b.onclick=()=>{setPref("of-pj-view",b.dataset.vt);renderProjects()});
 W.querySelectorAll("[data-pj]").forEach(el=>{el.onclick=e=>{if(e.target.closest("[data-pjedit],[data-pjacc]"))return;openProject(el.dataset.pj)};el.onkeydown=e=>{if(e.key==="Enter")openProject(el.dataset.pj)}});
 W.querySelectorAll("[data-pjedit]").forEach(b=>b.onclick=e=>{e.stopPropagation();projDialog(b.dataset.pjedit)});
 W.querySelectorAll("[data-pjacc]").forEach(b=>b.onclick=e=>{e.stopPropagation();accessDialog(b.dataset.pjacc)});
 const nb=$("pjNew");if(nb)nb.onclick=()=>projDialog(null)}
/* papel de cada pessoa em cada obra: Administrador (gere a obra e as pessoas), Membro (trabalha), Seguidor (só vê e recebe avisos) */
const PR_N={admin:"Administrador",membro:"Membro",seguidor:"Seguidor"};
function projRoleOf(uid,pid){if(S.demo)return"admin";const m=members.find(x=>x.user_id===uid);if(m&&m.role==="admin")return"admin";
 const r=S.pm.find(x=>x.project_id===pid&&x.user_id===uid);if(!r)return S.mp?"":"membro";
 return r.role||(m&&(m.role==="coord")?"admin":m&&m.role==="leitura"?"seguidor":"membro")}
function myProjRole(pid){if(S.demo||!S.mp)return S.isAdmin||S.isCoord||S.demo?"admin":S.canWrite?"membro":"seguidor";return projRoleOf(S.meId,pid||S.projectId)||"seguidor"}
/* o papel na obra limita o que se pode fazer: Seguidor só vê */
const setRoleBase=setRole;
setRole=function(r){setRoleBase(r);const pr=S.projectId?myProjRole():"";S.projRole=pr;S.isProjAdmin=pr==="admin";
 if(S.projectId&&S.mp&&!S.demo&&isActive()){S.canWrite=pr==="admin"||pr==="membro";if(pr==="admin")S.isCoord=true}
 else if(S.projectId&&pr==="seguidor")S.canWrite=false};
function pjCard(p){const st=PST[p.id]||{},pc=st.items?Math.round(st.tested/st.items*100):0,np=peopleIn(p.id),cur=p.id===S.projectId;
 const manage=S.isCoord&&(S.mp||S.demo);
 return`<div class="pjc${cur?" on":""}" data-pj="${esc(p.id)}" role="button" tabindex="0" aria-label="Abrir ${esc(p.name)}">
  <div class="pjcov" style="--h:${hueOf(p.id+p.name)}"><span class="pjini">${esc(initials(p.name))}</span><span class="pjst s-${esc(p.status||"em_curso")}">${PJ_ST[p.status]||"Em curso"}</span>${cur?`<span class="pjcur">Aberto</span>`:""}</div>
  <div class="pjb"><b>${esc(p.name)}</b><small>${esc([p.client,p.address].filter(Boolean).join(" · ")||"Sem cliente definido")}</small>
   <div class="pjstats"><span><b>${st.plans??"–"}</b>plantas</span><span><b>${st.items??"–"}</b>equipamentos</span><span><b>${st.items?pc+"%":"–"}</b>testado</span></div>
   <div class="pjbar"><i style="width:${pc}%"></i></div>
   <div class="pjfoot">${np!=null?`<span class="pjm">${ico("users")}${np} pessoa${np===1?"":"s"}</span>`:"<span></span>"}
    <span class="pjrole r-${myProjRole(p.id)}">${PR_N[myProjRole(p.id)]}</span></div></div></div>`}
function pjRow(p){const st=PST[p.id]||{},pc=st.items?Math.round(st.tested/st.items*100):0,manage=S.isCoord&&(S.mp||S.demo);
 return`<div class="pjr${p.id===S.projectId?" on":""}" data-pj="${esc(p.id)}" role="button" tabindex="0">
  <span class="pjdot" style="--h:${hueOf(p.id+p.name)}">${esc(initials(p.name))}</span>
  <span class="pjn"><b>${esc(p.name)}</b><small>${esc([p.client,p.address].filter(Boolean).join(" · ")||"—")}</small></span>
  <span data-l="Plantas">${st.plans??"–"}</span><span data-l="Equipam.">${st.items??"–"}</span>
  <span class="pjpc" data-l="Testado"><span class="pjbar"><i style="width:${pc}%"></i></span>${st.items?pc+"%":"–"}</span>
  <span><span class="pjst s-${esc(p.status||"em_curso")}">${PJ_ST[p.status]||"Em curso"}</span></span>
  <span><span class="pjrole r-${myProjRole(p.id)}">${PR_N[myProjRole(p.id)]}</span></span></div>`}

/* ---------- diálogos: projeto e acessos ---------- */
(()=>{const d=document.createElement("dialog");d.id="dlgProj";d.innerHTML=`<form class="dlg" method="dialog" id="pjForm">
  <h3 id="pjTitle">Novo projeto</h3>
  <label class="f">Nome da obra<input id="pjName" required placeholder="ex.: HCI - FIT-OUT SEDE CGD - LISBOA"></label>
  <label class="f">Cliente / dono de obra<input id="pjClient" placeholder="opcional"></label>
  <label class="f">Morada<input id="pjAddr" placeholder="opcional"></label>
  <label class="f">Estado<select id="pjStatus"><option value="em_curso">Em curso</option><option value="pausa">Em pausa</option><option value="concluido">Concluído</option></select></label>
  <div class="msg err" id="pjMsg" hidden></div>
  <div class="toolrow" style="justify-content:space-between"><button type="button" class="btn danger" id="pjDel" hidden>Apagar projeto</button><span style="flex:1"></span><button type="button" class="btn" id="pjCancel">Cancelar</button><button type="submit" class="btn primary" id="pjSave">Guardar</button></div></form>`;
 document.body.appendChild(d);
 const a=document.createElement("dialog");a.id="dlgAcc";a.innerHTML=`<div class="dlg"><h3 id="acTitle">Acessos</h3><p class="muted" style="margin:0">Escolhe quem pode ver e trabalhar neste projeto. O Administrador vê sempre todos os projetos.</p>
  <label class="fsearch">${ico("search")}<input id="acQ" type="search" placeholder="Procurar pessoa…"></label><div class="aclist" id="acList"></div><div class="msg err" id="acMsg" hidden></div>
  <div class="toolrow" style="justify-content:flex-end"><button type="button" class="btn" id="acCancel">Cancelar</button><button type="button" class="btn primary" id="acSave">Guardar acessos</button></div></div>`;
 document.body.appendChild(a);
 $("pjCancel").onclick=()=>d.close();$("acCancel").onclick=()=>a.close()})();
let pjEdit=null,pjDelArmed=false;
function projDialog(id){pjEdit=id;pjDelArmed=false;const p=id&&S.projects.find(x=>x.id===id);
 $("pjTitle").textContent=p?"Editar projeto":"Novo projeto";$("pjName").value=p?p.name:"";$("pjClient").value=p?p.client||"":"";$("pjAddr").value=p?p.address||"":"";$("pjStatus").value=p?p.status||"em_curso":"em_curso";
 $("pjMsg").hidden=true;const del=$("pjDel");del.hidden=!p||!isAdminRole()||S.projects.length<2;del.textContent="Apagar projeto";del.classList.remove("armed");
 $("dlgProj").showModal();setTimeout(()=>$("pjName").focus(),50)}
$("pjForm").onsubmit=async e=>{e.preventDefault();const name=$("pjName").value.trim();const m=$("pjMsg");if(!name){m.hidden=false;m.textContent="Escreve o nome da obra.";return}
 const row={name,client:$("pjClient").value.trim(),address:$("pjAddr").value.trim(),status:$("pjStatus").value};const btn=$("pjSave");btn.disabled=true;
 try{let id=pjEdit;
  if(S.demo){let list=S.projects.slice();if(id)list=list.map(p=>p.id===id?{...p,...row}:p);else{id=uid();list.push({id,...row})}S.projects=list;await IDBX.put("kv","projects",list)}
  else{if(!navigator.onLine||!S.session)throw new Error("precisas de ligação à internet para criar ou alterar projetos");
   if(id){const{error}=await sb.from("projects").update(row).eq("id",id);if(error)throw error}
   else{id=uid();const{error}=await sb.from("projects").insert({id,...row});if(error)throw error}
   await loadProjects()}
  if(id===S.projectId){syncMetaName();if(S.canWrite)api.set("meta","project",{...S.meta,...row})}
  $("dlgProj").close();toast(pjEdit?"Projeto guardado.":"Projeto criado: "+name);
  if(!pjEdit)openProject(id);else render()}
 catch(err){m.hidden=false;m.textContent="Não foi possível guardar: "+(/row-level|permission/i.test(err.message||"")?"não tens permissão.":err.message)}
 finally{btn.disabled=false}};
$("pjDel").onclick=async()=>{const p=S.projects.find(x=>x.id===pjEdit);if(!p)return;const b=$("pjDel");
 if(!pjDelArmed){pjDelArmed=true;b.classList.add("armed");b.textContent="Confirmar: apagar "+p.name+" e todos os dados";return}
 try{if(S.demo){S.projects=S.projects.filter(x=>x.id!==p.id);await IDBX.put("kv","projects",S.projects)}
  else{const{error}=await sb.from("projects").delete().eq("id",p.id);if(error)throw error;await loadProjects()}
  if(S.projectId===p.id){S.projectId=null;await loadLocal();COLS.forEach(c=>emit(c))}
  $("dlgProj").close();toast("Projeto apagado.");go("projects")}
 catch(err){$("pjMsg").hidden=false;$("pjMsg").textContent="Não foi possível apagar: "+err.message}};
let acFor=null,acSel=new Set();
function accessDialog(pid){if(!S.mp||S.demo)return;acFor=pid;const p=S.projects.find(x=>x.id===pid);$("acTitle").textContent="Acessos · "+(p?p.name:"");
 acSel=new Set(S.pm.filter(x=>x.project_id===pid).map(x=>x.user_id));$("acQ").value="";$("acMsg").hidden=true;drawAcc();$("dlgAcc").showModal()}
function drawAcc(){const q=$("acQ").value.trim().toLowerCase();
 const ppl=members.filter(m=>m.role!=="pendente"&&(!q||(m.name+" "+m.email).toLowerCase().includes(q))).sort((a,b)=>String(a.name).localeCompare(String(b.name),"pt"));
 $("acList").innerHTML=ppl.map(m=>{const adm=m.role==="admin";return`<label class="acrow"><input type="checkbox" data-u="${esc(m.user_id)}"${adm||acSel.has(m.user_id)?" checked":""}${adm?" disabled":""}><span class="ini">${esc(initials(m.name||m.email))}</span><span><b>${esc(m.name||m.email)}</b><small>${esc(ROLE_N[m.role]||m.role)}${adm?" · vê todos os projetos":""} · ${esc(m.email||"")}</small></span></label>`}).join("")||`<div class="empty">Ninguém encontrado.</div>`;
 $("acList").querySelectorAll("[data-u]").forEach(c=>c.onchange=()=>{if(c.checked)acSel.add(c.dataset.u);else acSel.delete(c.dataset.u)})}
$("acQ").oninput=drawAcc;
$("acSave").onclick=async()=>{const before=new Set(S.pm.filter(x=>x.project_id===acFor).map(x=>x.user_id));
 const add=[...acSel].filter(u=>!before.has(u)),rem=[...before].filter(u=>!acSel.has(u)&&u!==S.meId);const b=$("acSave");b.disabled=true;
 try{if(add.length){const{error}=await sb.from("project_members").insert(add.map(u=>({project_id:acFor,user_id:u})));if(error)throw error}
  for(const u of rem){const{error}=await sb.from("project_members").delete().eq("project_id",acFor).eq("user_id",u);if(error)throw error}
  await loadProjects();$("dlgAcc").close();toast("Acessos guardados.");render()}
 catch(err){$("acMsg").hidden=false;$("acMsg").textContent="Não foi possível guardar: "+err.message}finally{b.disabled=false}};

/* nome, cliente e morada alterados nas Configurações também mudam na lista de projetos */
async function saveProjectRow(row){const id=S.projectId;if(!id)return;
 S.projects=S.projects.map(p=>p.id===id?{...p,...row}:p);IDBX.put("kv","projects",S.projects).catch(()=>{});
 if(!S.demo&&S.mp&&sb&&S.session&&navigator.onLine){const{error}=await sb.from("projects").update(row).eq("id",id);if(error)toast("A lista de projetos não foi atualizada: "+error.message)}
 syncMetaName()}

/* ---------- página: plantas e pastas do projeto ---------- */
let plFolder=null,plQ2="";
function renderPlansPage(){const W=$("pageWrap");const v=getPref("of-pl-view","grid");const fs=folders();
 if(plFolder&&!fs.some(f=>f.id===plFolder))plFolder=null;const f=plFolder&&fs.find(x=>x.id===plFolder);
 const q=plQ2.trim().toLowerCase();const pj=curProject();
 const showF=!plFolder&&!q?fs:[];
 const plans=q?S.plans.filter(p=>String(p.name).toLowerCase().includes(q)):plansIn(plFolder);
 const its=S.items,openI=S.issues.filter(x=>x.status!=="resolvida");
 const fCard=x=>{const ps=plansIn(x.id),n=ps.length,pi=its.filter(i=>ps.some(p=>p.id===i.planId)),pc=counts(pi);
  return v==="grid"?`<div class="fcard" data-fo="${esc(x.id)}" role="button" tabindex="0"><span class="fic">${ico("folder")}</span>
    <span class="fthumbs">${ps.slice(0,3).map(p=>`<span><img data-thumb="${esc(p.img||"")}" alt=""></span>`).join("")}</span>
    <b>${esc(x.name)}</b><small>${n} planta${n===1?"":"s"} · ${pc.total} equip. · ${pct(pc.ge(3),pc.total)}% testado</small>
    ${S.isCoord?`<button type="button" class="fmenu" data-fedit="${esc(x.id)}" aria-label="Renomear ou apagar a pasta">${ico("dots")}</button>`:""}</div>`
   :`<div class="lrow" data-fo="${esc(x.id)}" role="button" tabindex="0"><span class="lic fold">${ico("folder")}</span><span class="ln"><b>${esc(x.name)}</b><small>Pasta · ${n} planta${n===1?"":"s"}</small></span><span data-l="Equipam.">${pc.total} equip.</span><span data-l="Progresso" class="lst">${stackBar(pi)}</span><span data-l="Testado">${pct(pc.ge(3),pc.total)}%</span><span class="lact">${S.isCoord?`<button type="button" class="btn sm" data-fedit="${esc(x.id)}">Renomear</button>`:""}</span></div>`};
 const moveSel=p=>S.canWrite&&fs.length?`<select class="pmove" data-move="${esc(p.id)}" aria-label="Mover para a pasta"><option value="">Sem pasta</option>${fs.map(x=>`<option value="${esc(x.id)}"${p.folder===x.id?" selected":""}>${esc(x.name)}</option>`).join("")}</select>`:"";
 const pCard=p=>{const pi=its.filter(i=>i.planId===p.id),pc=counts(pi),oi=openI.filter(x=>x.planId===p.id).length,st=(p.close&&p.close.status)||"aberto";
  return v==="grid"?`<div class="pcard" data-open="${esc(p.id)}" tabindex="0" role="button" aria-label="Abrir ${esc(p.name)}">
   <div class="pthumb"><img data-thumb="${esc(p.img||"")}" alt=""><span class="pdoc">${p.pdf?"PDF":"IMG"}</span>${oi?`<span class="pbad">${oi} anomalia${oi>1?"s":""}</span>`:""}</div>
   <div class="pbody"><b>${esc(p.name)}</b>${stackBar(pi)}<div class="pmeta"><span>${pc.total} equip.</span><span>${pct(pc.ge(3),pc.total)}% testado</span>${st!=="aberto"?`<span>${FLOOR_ST[st]}</span>`:""}${q&&p.folder&&folderName(p.folder)?`<span>${ico("folder")}${esc(folderName(p.folder))}</span>`:""}</div>${moveSel(p)}</div></div>`
   :`<div class="lrow" data-open="${esc(p.id)}" role="button" tabindex="0"><span class="lic"><img data-thumb="${esc(p.img||"")}" alt=""></span><span class="ln"><b>${esc(p.name)}</b><small>${p.pdf?"PDF":"Imagem"}${p.folder&&folderName(p.folder)?" · "+esc(folderName(p.folder)):""}${oi?` · <span class="bad">${oi} anomalia${oi>1?"s":""}</span>`:""}</small></span>
    <span data-l="Equipam.">${pc.total} equip.</span><span data-l="Progresso" class="lst">${stackBar(pi)}</span><span data-l="Testado">${pct(pc.ge(3),pc.total)}%</span><span class="lact">${moveSel(p)}</span></div>`};
 const nP=plans.length,nF=showF.length;
 W.innerHTML=`<div class="crumb"><button type="button" data-go="projects">Projetos</button><span>›</span>${f?`<button type="button" id="plRoot">${esc(pj?pj.name:S.meta.name||"Obra")}</button><span>›</span><b>${esc(f.name)}</b>`:`<b>${esc(pj?pj.name:S.meta.name||"Obra")}</b>`}</div>
 <div class="pjhead"><div>${f?`<button type="button" class="backb" id="plBack">${ico("back")}Todas as plantas</button>`:""}<h2>${f?esc(f.name):"Plantas"}</h2><p>${S.plans.length} planta${S.plans.length===1?"":"s"}${fs.length?` · ${fs.length} pasta${fs.length===1?"":"s"}`:""} · ${its.length} equipamentos</p></div>
  ${S.canWrite?`<div class="pjact"><button type="button" class="btn bigb" id="plNewF">${ico("fplus")}Nova pasta</button><button type="button" class="btn primary bigb" id="plUp">${ico("up")}Carregar ficheiro</button></div>`:""}</div>
 <div class="ftool"><label class="fsearch">${ico("search")}<input id="plQ2" type="search" placeholder="Procurar planta…" value="${esc(plQ2)}" aria-label="Procurar planta"></label><span class="fcount">${q?`${nP} resultado${nP===1?"":"s"}`:`${nF?nF+" pasta"+(nF===1?"":"s")+" · ":""}${nP} planta${nP===1?"":"s"}`}</span>${vToggle(v)}</div>
 <div class="msg busy" id="plBusy" hidden></div>
 <div class="dropz" id="plDrop">
 ${nF||nP?(v==="grid"?`${nF?`<div class="fgrid">${showF.map(fCard).join("")}</div>`:""}${nP?`${nF?`<div class="gsub">Plantas ${f?"nesta pasta":"sem pasta"}</div>`:""}<div class="pgrid">${plans.map(pCard).join("")}</div>`:""}`
   :`<div class="llist card"><div class="lrow lrh"><span></span><span>Nome</span><span>Equipam.</span><span class="lst">Progresso</span><span>Testado</span><span></span></div>${showF.map(fCard).join("")}${plans.map(pCard).join("")}</div>`)
  :`<div class="empty3">${ico(q?"search":"up")}<b>${q?"Nenhuma planta encontrada.":f?"Esta pasta está vazia.":"Ainda não há plantas neste projeto."}</b><span>${q?"Experimenta outra pesquisa.":S.canWrite?"Carrega plantas em PDF ou imagem (podes escolher vários ficheiros) ou arrasta-os para aqui.":"Quando a equipa carregar plantas, aparecem aqui."}</span>${!q&&S.canWrite?`<button type="button" class="btn primary bigb" id="plUp2">${ico("up")}Carregar ficheiro</button>`:""}</div>`}
 </div>`;
 W.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>go(b.dataset.go));
 const back=()=>{plFolder=null;renderPlansPage()};const r0=$("plRoot");if(r0)r0.onclick=back;const bb=$("plBack");if(bb)bb.onclick=back;
 W.querySelectorAll("[data-vt]").forEach(b=>b.onclick=()=>{setPref("of-pl-view",b.dataset.vt);renderPlansPage()});
 const qi=$("plQ2");qi.oninput=e=>{plQ2=e.target.value;const pos=e.target.selectionStart;renderPlansPage();const n=$("plQ2");n.focus();try{n.setSelectionRange(pos,pos)}catch(x){}};
 W.querySelectorAll("[data-fo]").forEach(el=>{el.onclick=e=>{if(e.target.closest("[data-fedit]"))return;plFolder=el.dataset.fo;plQ2="";renderPlansPage();$("pageWrap").scrollIntoView({block:"start"})};el.onkeydown=e=>{if(e.key==="Enter")el.click()}});
 W.querySelectorAll("[data-fedit]").forEach(b=>b.onclick=e=>{e.stopPropagation();openFolder(b.dataset.fedit)});
 W.querySelectorAll("[data-open]").forEach(el=>{el.onclick=e=>{if(e.target.closest("select"))return;openPlan(el.dataset.open)};el.onkeydown=e=>{if(e.key==="Enter")openPlan(el.dataset.open)}});
 W.querySelectorAll("[data-move]").forEach(s=>{s.onclick=e=>e.stopPropagation();s.onchange=()=>{api.update("plans",s.dataset.move,{folder:s.value||null});toast(s.value?"Planta movida para "+folderName(s.value):"Planta sem pasta")}});
 const up=()=>{replacing=null;uploadFolder=plFolder;$("planIn").click()};["plUp","plUp2"].forEach(id=>{const b=$(id);if(b)b.onclick=up});
 const nf=$("plNewF");if(nf)nf.onclick=()=>openFolder(null);
 hydrateThumbs(W);syncBusy()}
/* arrastar ficheiros para a página de plantas */
(()=>{const W=$("pageWrap");let dep=0;
 W.addEventListener("dragenter",e=>{if(S.view!=="plans"||!S.canWrite||!e.dataTransfer||![...e.dataTransfer.types].includes("Files"))return;dep++;const z=$("plDrop");if(z)z.classList.add("over")});
 W.addEventListener("dragleave",()=>{dep=Math.max(0,dep-1);if(!dep){const z=$("plDrop");if(z)z.classList.remove("over")}});
 W.addEventListener("dragover",e=>{if(S.view==="plans"&&S.canWrite)e.preventDefault()});
 W.addEventListener("drop",e=>{if(S.view!=="plans"||!S.canWrite)return;e.preventDefault();dep=0;const z=$("plDrop");if(z)z.classList.remove("over");
  const fl=[...(e.dataTransfer.files||[])].filter(f=>/^image\/|application\/pdf/.test(f.type)||/\.(pdf|png|jpe?g|webp)$/i.test(f.name));if(!fl.length){toast("Só PDF ou imagens.");return}
  replacing=null;uploadFolder=plFolder;const dt=new DataTransfer();fl.forEach(f=>dt.items.add(f));const inp=$("planIn");inp.files=dt.files;inp.dispatchEvent(new Event("change"))})})();
/* progresso do carregamento também visível na página de plantas */
function syncBusy(){const b=$("busy"),p=$("plBusy");if(!b||!p)return;p.hidden=b.hidden;p.textContent=b.textContent}
new MutationObserver(syncBusy).observe($("busy"),{attributes:true,childList:true,characterData:true,subtree:true});
/* a pasta criada a partir da página de plantas fica logo aberta? não: a lista mostra-a */

/* =========================================================
   Pessoas da obra (Administrador · Membro · Seguidor) e Definições da obra
   ========================================================= */
let ppQ="",ppAddRole="membro";
function peopleSection(){const pid=S.projectId;if(!pid)return"";
 if(!S.mp||S.demo)return`<section class="block"><h2>Pessoas nesta obra</h2><div class="msg warn">${S.demo?"Na demonstração não há equipa.":"Para dar acessos por obra (Administrador, Membro, Seguidor), corre no Supabase o ficheiro <b>supabase/atualizacao-3-projetos.sql</b>."}</div></section>`;
 const canManage=S.isAdmin||S.isProjAdmin;const inP=new Set(S.pm.filter(x=>x.project_id===pid).map(x=>x.user_id));
 const admins=members.filter(m=>m.role==="admin");admins.forEach(m=>inP.add(m.user_id));
 const rows=members.filter(m=>inP.has(m.user_id)).sort((a,b)=>["admin","membro","seguidor"].indexOf(projRoleOf(a.user_id,pid))-["admin","membro","seguidor"].indexOf(projRoleOf(b.user_id,pid))||String(a.name).localeCompare(String(b.name),"pt"));
 const out=members.filter(m=>!inP.has(m.user_id)&&m.role!=="pendente");
 const cnt=k=>rows.filter(m=>projRoleOf(m.user_id,pid)===k).length;
 return`<section class="block"><h2><span>Pessoas nesta obra</span><span class="muted" style="font-size:13px;font-weight:500">${rows.length} pessoa${rows.length===1?"":"s"}</span></h2>
 <div class="prole-help"><span><b>Administrador</b> gere a obra, as definições e as pessoas</span><span><b>Membro</b> trabalha: marca, fotografa, lê etiquetas, ensaios</span><span><b>Seguidor</b> só vê e recebe avisos</span></div>
 <div class="kpis k4" style="margin:4px 0 10px">${["admin","membro","seguidor"].map(k=>`<div class="kpi" style="--c:${k==="admin"?"var(--accent)":k==="membro"?"var(--ok)":"var(--info)"}"><span class="kb"><span>${{admin:"Administradores",membro:"Membros",seguidor:"Seguidores"}[k]}</span><b>${cnt(k)}</b></span></div>`).join("")}</div>
 <div class="card"><div class="pplist">${rows.map(m=>{const r=projRoleOf(m.user_id,pid),glob=m.role==="admin";
  return`<div class="pprow"><span class="ini">${esc(initials(m.name||m.email))}</span><span class="ppn"><b>${esc(m.name||m.email)}${m.user_id===S.meId?" (eu)":""}</b><small>${esc(m.email||"")}${glob?" · administrador da plataforma (vê todas as obras)":""}</small></span>
   ${canManage&&!glob&&m.user_id!==S.meId?`<select data-pprole="${esc(m.user_id)}" aria-label="Papel nesta obra">${["admin","membro","seguidor"].map(k=>`<option value="${k}"${r===k?" selected":""}>${PR_N[k]}</option>`).join("")}</select><button type="button" class="btn sm danger" data-pprem="${esc(m.user_id)}">Retirar</button>`:`<span class="pjrole r-${r}">${PR_N[r]}</span>`}</div>`}).join("")||`<div class="empty2">Ninguém ainda.</div>`}</div>
 ${canManage?`<div class="ppadd"><b>Adicionar pessoa</b>${out.length?`<select id="ppWho"><option value="">Escolher…</option>${out.map(m=>`<option value="${esc(m.user_id)}">${esc(m.name||m.email)} · ${esc(m.email||"")}</option>`).join("")}</select>
  <select id="ppRole">${["membro","seguidor","admin"].map(k=>`<option value="${k}"${ppAddRole===k?" selected":""}>${PR_N[k]}</option>`).join("")}</select><button type="button" class="btn primary" id="ppAdd">Adicionar</button>`:`<span class="muted">Todas as contas aprovadas já estão nesta obra. Para juntar alguém novo, usa <b>Convidar para esta obra</b> (QR code ou email).</span>`}<div class="msg err" id="ppMsg" hidden></div></div>`:""}</div></section>`}
function wirePeople(W){const pid=S.projectId;const m=$("ppMsg");const fail=e=>{if(m){m.hidden=false;m.textContent="Não foi possível: "+(/row-level|permission/i.test(e.message||"")?"não tens permissão.":e.message)}};
 W.querySelectorAll("[data-pprole]").forEach(sel=>sel.onchange=async()=>{try{const{error}=await sb.from("project_members").update({role:sel.value}).eq("project_id",pid).eq("user_id",sel.dataset.pprole);if(error)throw error;await loadProjects();toast("Papel atualizado: "+PR_N[sel.value]);renderPage("team")}catch(e){fail(e)}});
 W.querySelectorAll("[data-pprem]").forEach(b=>b.onclick=async()=>{if(!b.classList.contains("armed")){b.classList.add("armed");b.textContent="Confirmar";return}
  try{const{error}=await sb.from("project_members").delete().eq("project_id",pid).eq("user_id",b.dataset.pprem);if(error)throw error;await loadProjects();toast("Pessoa retirada desta obra.");renderPage("team")}catch(e){fail(e)}});
 const ad=$("ppAdd");if(ad)ad.onclick=async()=>{const u=$("ppWho").value,r=$("ppRole").value;ppAddRole=r;if(!u){$("ppWho").focus();return}
  try{const{error}=await sb.from("project_members").insert({project_id:pid,user_id:u,role:r});if(error)throw error;await loadProjects();toast("Pessoa adicionada como "+PR_N[r]+".");renderPage("team")}catch(e){fail(e)}}}

/* Definições da obra */
const OBRA_F=[["name","Nome da obra","ex.: HCI - FIT-OUT SEDE CGD - LISBOA"],["code","N.º da obra / contrato",""],["client","Cliente / dono de obra",""],["address","Morada",""],
 ["fisc","Fiscalização",""],["contractor","Empreiteiro / instalador",""],["designer","Projetista",""],["manager","Diretor de obra",""],["start","Data de início",""],["end","Data prevista de conclusão",""]];
function obraSection(){const M=S.meta||{},pj=curProject()||{};const can=S.isAdmin||S.isProjAdmin||(!S.mp&&S.isCoord);const st=pj.status||M.status||"em_curso";
 const val=k=>esc(k==="name"?(pj.name||M.name||""):k==="client"?(pj.client||M.client||""):k==="address"?(pj.address||M.address||""):(M[k]||""));
 return`<section class="block"><h2>Definições da obra</h2><div class="card obraf">
  ${OBRA_F.map(([k,l,ph])=>`<label class="f${k==="name"?" wide":""}">${l}<input id="ob_${k}"${k==="start"||k==="end"?' type="date"':""} value="${val(k)}" placeholder="${esc(ph)}"${can?"":" disabled"}></label>`).join("")}
  <label class="f">Estado<select id="ob_status"${can?"":" disabled"}>${Object.entries(PJ_ST).map(([k,n])=>`<option value="${k}"${st===k?" selected":""}>${n}</option>`).join("")}</select></label>
  <label class="f wide">Descrição / notas da obra<textarea id="ob_notes" rows="3"${can?"":" disabled"}>${esc(M.notes||"")}</textarea></label>
  ${can?`<div class="toolrow wide"><button class="btn primary" id="obSave">Guardar definições</button>${S.isAdmin&&S.mp&&S.projects.length>1?`<span style="flex:1"></span><button class="btn danger" id="obDel">Apagar esta obra</button>`:""}</div>`:`<p class="muted wide" style="margin:0">Só o Administrador da obra pode alterar estas definições.</p>`}</div></section>`}
function wireObra(W){const sv=$("obSave");if(sv)sv.onclick=async()=>{const v=k=>($("ob_"+k)||{}).value?.trim()||"";
  const row={name:v("name")||S.meta.name||"Obra",client:v("client"),address:v("address"),status:$("ob_status").value};
  const extra={};OBRA_F.forEach(([k])=>extra[k]=v(k));extra.name=row.name;extra.notes=$("ob_notes").value.trim();extra.status=row.status;
  sv.disabled=true;try{await saveProjectRow(row);await api.set("meta","project",{...S.meta,...extra});toast("Definições da obra guardadas.");render()}finally{sv.disabled=false}};
 const dl=$("obDel");if(dl)dl.onclick=()=>{projDialog(S.projectId);setTimeout(()=>{const b=$("pjDel");if(b)b.scrollIntoView({block:"center"})},100)}}
/* páginas: "Pessoas" (antiga Equipa) e "Definições" (antiga Configurações) */
const renderPageBase2=renderPage;
renderPage=function(v){renderPageBase2(v);const W=$("pageWrap");
 if(v==="team"){const h=W.querySelector(".phead");const ps=document.createElement("div");ps.innerHTML=peopleSection();
  if(h){h.querySelector("h2")&&(h.querySelector("h2").textContent="Pessoas");const p=h.querySelector("p");if(p)p.textContent="Quem trabalha nesta obra e o que cada pessoa pode fazer. Em baixo: contas da plataforma e trabalho atribuído.";h.after(ps)}else W.prepend(ps);
  const cr=W.querySelector(".crumb b");if(cr)cr.textContent="Pessoas";
  // a parte das contas da plataforma fica com um título claro
  [...W.querySelectorAll("section.block h2")].forEach(x=>{if(/^Equipa/.test(x.textContent.trim()))x.firstChild&&(x.firstChild.textContent="Contas da plataforma")});
  wirePeople(W)}
 if(v==="settings"){const h=W.querySelector(".phead");if(h){h.querySelector("h2")&&(h.querySelector("h2").textContent="Definições");const p=h.querySelector("p");if(p)p.textContent="Informação da obra, notificações, envio de emails, leitura com IA, dados e utilização sem rede."}
  const cr=W.querySelector(".crumb b");if(cr)cr.textContent="Definições";
  const old=$("stName");const sec=old&&old.closest("section.block");const box=document.createElement("div");box.innerHTML=obraSection();
  if(sec)sec.replaceWith(box);else if(h)h.after(box);else W.prepend(box);wireObra(W)}};
/* nomes no menu lateral */
(()=>{const t=document.querySelector('.side [data-nav="team"] span:not(.cnt)');if(t)t.textContent="Pessoas";const c=document.querySelector('.side [data-nav="settings"] span:not(.cnt)');if(c)c.textContent="Definições da obra"})();

/* =========================================================
   ObraFlow · Lista de IDs de referência (PDF, Excel, CSV ou texto)
   - compara os IDs lidos nas etiquetas com a lista do projeto;
   - a leitura passa a usar a lista: confirma IDs e corrige erros de 1 carácter;
   - os equipamentos inconclusivos voltam a ser lidos com a ajuda da lista.
   ========================================================= */
function idRef(){const r=L.meta&&L.meta.idref;return r&&Array.isArray(r.ids)&&r.ids.length?r:null}
let refKey="",refS=null,refT=null;
function refSet(){const r=idRef();if(!r)return null;const k=(r.at||"")+"|"+r.ids.length;
 if(k!==refKey){refKey=k;refS=new Set(r.ids.map(x=>x.id));refT=new Map(r.ids.map(x=>[x.id,x.t||""]))}return refS}
function refText(id){refSet();return(refT&&refT.get(id))||""}
/* distância de edição (para no limite) */
function editDist(a,b,max){if(a===b)return 0;if(Math.abs(a.length-b.length)>max)return max+1;
 let prev=[...Array(b.length+1).keys()];for(let i=1;i<=a.length;i++){const cur=[i];let best=i;
  for(let j=1;j<=b.length;j++){cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));if(cur[j]<best)best=cur[j]}
  if(best>max)return max+1;prev=cur}return prev[b.length]}
function usedIds(exceptItem){const m=new Set();for(const i of S.items)if(i.id!==exceptItem&&i.devId)m.add(String(i.devId).toUpperCase());return m}
/* IDs da lista parecidos com o lido (1 carácter de diferença; 2 em IDs compridos), de preferência ainda não usados */
function nearRef(v,itemId,maxD){const R=refSet();if(!R)return[];v=String(v||"").toUpperCase();if(!v)return[];const used=usedIds(itemId);
 const md=maxD!=null?maxD:v.length>=8?2:1;const out=[];
 for(const x of R){if(Math.abs(x.length-v.length)>md)continue;const d=editDist(v,x,md);if(d<=md)out.push({id:x,d,used:used.has(x)})}
 return out.sort((a,b)=>a.d-b.d||a.used-b.used)}
/* aplica a lista aos candidatos da leitura */
function refFix(cands,itemId){const R=refSet();if(!R)return cands;const out=[];const used=usedIds(itemId);
 for(const c of cands){if(c.k!=="id"){out.push(c);continue}
  if(R.has(c.v)){out.push({...c,s:c.s+6-(used.has(c.v)?4:0),ref:used.has(c.v)?"":"ok"});continue}
  const near=nearRef(c.v,itemId,1).filter(x=>!x.used);
  if(near.length===1)out.push({k:"id",v:near[0].id,s:c.s+3,ref:"fix",from:c.v});
  out.push({...c,s:c.s-3})}
 const m={};for(const c of out){const k=c.k+"|"+c.v;if(!m[k]||m[k].s<c.s)m[k]=c}return Object.values(m).sort((a,b)=>b.s-a.s)}

/* ---------- ler o ficheiro da lista ---------- */
const XLSX_URL="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
async function fileLines(f,onStep){const name=f.name.toLowerCase();
 if(f.type==="application/pdf"||name.endsWith(".pdf")){
  if(!window.pdfjsLib)throw new Error("leitor de PDF indisponível");initPdf();
  const doc=await openPdf(await f.arrayBuffer());const n=Math.min(doc.numPages,300);let lines=[],tokens=0;
  for(let p=1;p<=n;p++){onStep&&onStep(`A ler a página ${p} de ${n}…`);const pg=await doc.getPage(p);const tc=await pg.getTextContent();
   const rows=new Map();for(const it of tc.items){const s=String(it.str||"").trim();if(!s)continue;tokens++;const y=Math.round(it.transform[5]/3);
    if(!rows.has(y))rows.set(y,[]);rows.get(y).push({x:it.transform[4],s})}
   [...rows.entries()].sort((a,b)=>b[0]-a[0]).forEach(([,r])=>lines.push(r.sort((a,b)=>a.x-b.x).map(x=>x.s).join(" ")))}
  if(tokens<10){   // PDF digitalizado (só imagem): lê o texto das páginas com o leitor do aparelho
   lines=[];const P=await pool();const m=Math.min(n,40);
   for(let p=1;p<=m;p++){onStep&&onStep(`PDF digitalizado: a reconhecer o texto da página ${p} de ${m} (pode demorar)…`);
    const pg=await doc.getPage(p);const vp=pg.getViewport({scale:1});const sc=Math.min(3,2400/Math.max(vp.width,vp.height));const v2=pg.getViewport({scale:sc});
    const cv=document.createElement("canvas");cv.width=Math.round(v2.width);cv.height=Math.round(v2.height);const cx=cv.getContext("2d");cx.fillStyle="#fff";cx.fillRect(0,0,cv.width,cv.height);
    await pg.render({canvasContext:cx,viewport:v2}).promise;const r=await P.a[0].recognize(cv);lines.push(...String(r.data.text||"").split(/\n/))}}
  return lines}
 if(/\.(xlsx|xlsm|xls|ods)$/.test(name)){onStep&&onStep("A abrir a folha de cálculo…");await loadScript(XLSX_URL);
  const wb=XLSX.read(await f.arrayBuffer(),{type:"array"});const lines=[];
  for(const sn of wb.SheetNames){const rows=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,raw:false,defval:""});for(const r of rows)lines.push(r.map(x=>String(x).trim()).filter(Boolean).join(" | "))}
  return lines}
 return String(await f.text()).split(/\r?\n/)}
/* tira os IDs das linhas: hexadecimais com o comprimento dos IDs da obra (ex.: 6) */
function idsFromLines(lines){const P=idPattern();const found=new Map();const byLen={};
 const toks=[];for(const raw of lines){const line=String(raw||"").replace(/\s+/g," ").trim();if(!line)continue;
  for(const w of line.toUpperCase().split(/[^0-9A-Z]+/)){if(w.length<5||w.length>10||!/^[0-9A-F]+$/.test(w)||!/\d/.test(w))continue;
   if(/^(19|20)\d{2}(0[1-9]|1[0-2])\d{0,2}$/.test(w))continue;     // datas
   if(/^\d+$/.test(w)&&/(total|data|date|p[áa]g|page|tel|nif|contrib|c[óo]digo postal|qtd|quant)/i.test(line))continue;   // totais, datas, telefones
   toks.push({w,line});byLen[w.length]=(byLen[w.length]||0)+(/[A-F]/.test(w)?3:1)}}
 // comprimento: o dos IDs já registados na obra; senão o mais frequente (com letras pesa mais)
 const len=S.items.filter(i=>i.devId).length>=3?P.len:+(Object.entries(byLen).sort((a,b)=>b[1]-a[1])[0]||[6])[0];
 let sel=toks.filter(t=>t.w.length===len);
 const digits=sel.filter(t=>/^\d+$/.test(t.w)).length;
 // muitos números só com algarismos: são provavelmente outros números (endereços, quantidades) e não IDs
 let dropped=0;if(sel.length&&digits/sel.length>.3){dropped=new Set(sel.filter(t=>/^\d+$/.test(t.w)).map(t=>t.w)).size;sel=sel.filter(t=>/[A-F]/.test(t.w))}
 for(const t of sel)if(!found.has(t.w))found.set(t.w,t.line.replace(new RegExp(t.w,"i"),"").replace(/\s*\|\s*\|\s*/g," | ").replace(/^[\s|·:-]+|[\s|·:-]+$/g,"").slice(0,140));
 return{ids:[...found.entries()].map(([id,t])=>({id,t})),len,dropped}}

/* ---------- diálogo de confirmação ---------- */
(()=>{const d=document.createElement("dialog");d.id="dlgRef";d.innerHTML=`<div class="dlg"><h3>Lista de IDs</h3><div id="rfBody"></div>
 <div class="toolrow" style="justify-content:flex-end"><button type="button" class="btn" id="rfCancel">Cancelar</button><button type="button" class="btn primary" id="rfOk">Usar esta lista</button></div></div>`;
 document.body.appendChild(d);$("rfCancel").onclick=()=>d.close();
 const inp=document.createElement("input");inp.type="file";inp.id="refIn";inp.hidden=true;inp.accept=".pdf,.xlsx,.xls,.xlsm,.ods,.csv,.txt,application/pdf,text/csv,text/plain";document.body.appendChild(inp);
 inp.onchange=async()=>{const f=inp.files[0];inp.value="";if(!f)return;const msg=$("refMsg");const show=t=>{if(msg){msg.hidden=false;msg.className="msg busy";msg.textContent=t}};
  try{show("A abrir "+f.name+"…");const lines=await fileLines(f,show);const r=idsFromLines(lines);if(msg)msg.hidden=true;
   if(!r.ids.length){if(msg){msg.hidden=false;msg.className="msg err";msg.textContent=`Não encontrei IDs em ${f.name}. Se o PDF for uma digitalização pouco nítida, exporta a lista em Excel ou CSV.`}return}
   const sample=r.ids.slice(0,8).map(x=>x.id).join(", ");const R0=new Set(r.ids.map(x=>x.id));const its=S.items.filter(i=>i.devId);const ok=its.filter(i=>R0.has(String(i.devId).toUpperCase())).length;
   $("rfBody").innerHTML=`<p style="margin:0">Encontrei <b>${r.ids.length} IDs</b> com ${r.len} caracteres em <b>${esc(f.name)}</b>.</p>
    <p class="muted" style="margin:0">Exemplos: <span class="mono">${esc(sample)}${r.ids.length>8?"…":""}</span></p>
    ${r.dropped?`<p class="muted" style="margin:0;font-size:12px">Ignorei ${r.dropped} números só com algarismos (parecem endereços ou quantidades).</p>`:""}
    ${its.length?`<div class="msg ${ok===its.length?"ok":"warn"}">${ok} de ${its.length} IDs já lidos na obra constam desta lista.</div>`:""}
    <p class="muted" style="margin:0;font-size:13px">Ao usar a lista, a leitura das etiquetas passa a confirmar os IDs por ela, corrige erros de um carácter e volta a tentar os equipamentos com leitura inconclusiva.</p>`;
   $("rfOk").onclick=async()=>{d.close();await api.set("meta","idref",{name:f.name,at:now(),by:S.meId,len:r.len,ids:r.ids});toast(`Lista de IDs carregada: ${r.ids.length} IDs.`);
    setTimeout(()=>{refResolve();retryInconclusive();render()},300)};d.showModal()}
  catch(e){if(msg){msg.hidden=false;msg.className="msg err";msg.textContent="Não foi possível ler o ficheiro: "+(e.message||e)}}}})();

/* inconclusivos com uma leitura que bate certo com a lista (e ainda não usada) ficam resolvidos */
async function refResolve(){const R=refSet();if(!R||!S.canWrite)return 0;let n=0;const used=usedIds(null);
 for(const it of S.items){if(readStateOf(it)!=="inconclusivo")continue;
  const hits=[...new Set((it.readCands||[]).filter(c=>c.k==="id").flatMap(c=>R.has(c.v)?[c.v]:nearRef(c.v,it.id,1).filter(x=>!x.used).map(x=>x.id)))].filter(v=>!used.has(v));
  if(hits.length===1){const v=hits[0];used.add(v);const patch={devId:v,readConf:"alta",readState:"ok",readNote:`ID ${v} confirmado pela lista de IDs (a leitura estava inconclusiva).`,updatedAt:now(),updatedBy:S.meId};
   logPatch(it,patch,"ID "+v+" (lista de IDs)");await api.update("items",it.id,patch);n++}}
 if(n)toast(`${n} equipamento${n>1?"s":""} com leitura inconclusiva ficaram resolvidos pela lista de IDs.`);return n}
function retryInconclusive(){if(!S.canWrite)return;let n=0;for(const it of S.items){if(readStateOf(it)==="inconclusivo"&&!RQ.some(x=>x.id===it.id)){RQ.push({id:it.id,overwrite:false,blobs:null,opts:{deep:true},pid:S.projectId});n++}}if(n){bgBadge();runRQ()}return n}

/* ---------- cartão na Lista de IDs ---------- */
let REFV="";
function refCard(){const r=idRef();const its=S.items;const R=refSet();
 const inc=its.filter(i=>["inconclusivo","a_ler","pendente"].includes(readStateOf(i)));
 if(!r)return`<section class="card refc"><div class="refh"><div><h3>Verificar com a lista de IDs do projeto</h3><p class="muted">Carrega o PDF (ou Excel/CSV) com todos os IDs da instalação para ver se as etiquetas lidas batem certo. A leitura passa também a usar esta lista para corrigir erros e resolver leituras inconclusivas.</p></div>
  ${S.canWrite?`<button type="button" class="btn primary bigb" id="refUp">Carregar lista de IDs</button>`:""}</div>
  ${inc.length?`<div class="msg warn">${inc.length} equipamento${inc.length>1?"s":""} com foto ainda sem ID certo (leitura inconclusiva ou por ler). <button type="button" class="linkb" data-ref-tab="inc" id="refIncGo">Ver</button></div>`:""}
  <div class="msg" id="refMsg" hidden></div>${REFV==="inc"?refTable("inc"):""}</section>`;
 const withId=its.filter(i=>i.devId);const okI=withId.filter(i=>R.has(String(i.devId).toUpperCase()));const fora=withId.filter(i=>!R.has(String(i.devId).toUpperCase()));
 const used=new Set(withId.map(i=>String(i.devId).toUpperCase()));const falta=r.ids.filter(x=>!used.has(x.id));
 const tab=REFV||(fora.length?"fora":inc.length?"inc":"falta");
 const tile=(k,c,n,l,s)=>`<button type="button" class="reft${tab===k?" on":""}" data-ref-tab="${k}" style="--c:${c}"><b>${n}</b><span>${l}</span><small>${s}</small></button>`;
 return`<section class="card refc"><div class="refh"><div><h3>Lista de IDs: ${esc(r.name||"lista")}</h3><p class="muted">${r.ids.length} IDs · carregada ${fmtDate(r.at)}${r.by?" por "+esc(nameOf(r.by)):""}</p></div>
  <div class="toolrow">${S.canWrite?`<button type="button" class="btn" id="refUp">Substituir lista</button>`:""}<button type="button" class="btn" id="refCsv">Exportar comparação</button>${S.isCoord?`<button type="button" class="btn danger" id="refDel">Remover</button>`:""}</div></div>
  <div class="msg" id="refMsg" hidden></div>
  <div class="refts">${tile("ok","var(--ok)",okI.length,"Batem certo","lidos e na lista")}${tile("fora","var(--bad)",fora.length,"Não constam da lista","ID lido a confirmar")}${tile("falta","#2563eb",falta.length,"Por encontrar","na lista, ainda sem equipamento")}${tile("inc","#d97706",inc.length,"Inconclusivos","foto sem ID certo")}</div>
  ${refTable(tab,{okI,fora,falta,inc})}</section>`}
function refTable(tab,D){const its=S.items;D=D||{inc:its.filter(i=>["inconclusivo","a_ler","pendente"].includes(readStateOf(i)))};
 const open=i=>`<button type="button" class="btn sm" data-item="${esc(i.id)}">Abrir</button>`;
 if(tab==="fora"){const rows=D.fora.slice(0,300).map(i=>{const nr=nearRef(i.devId,i.id).filter(x=>!x.used).slice(0,2);
   return`<tr><td class="mono"><b class="bad">${esc(i.devId)}</b></td><td class="mono">${esc(i.code)}</td><td>${esc(planName(i.planId))}</td><td>${nr.length?nr.map(x=>`<button type="button" class="cand" data-fix="${esc(i.id)}" data-v="${esc(x.id)}" title="${esc(refText(x.id))}">Corrigir para ${esc(x.id)}</button>`).join(" "):`<span class="muted">sem ID parecido livre na lista</span>`}</td><td>${open(i)}</td></tr>`}).join("");
  return`<div class="tbl"><table><thead><tr><th>ID lido</th><th>Ref.</th><th>Planta</th><th>Sugestão da lista</th><th></th></tr></thead><tbody>${rows||`<tr><td colspan="5" class="empty2">Todos os IDs lidos constam da lista.</td></tr>`}</tbody></table></div>`}
 if(tab==="falta"){const rows=D.falta.slice(0,500).map(x=>`<tr><td class="mono"><b>${esc(x.id)}</b></td><td class="muted" style="font-size:12.5px">${esc(x.t||"")}</td></tr>`).join("");
  return`<div class="tbl"><table><thead><tr><th>ID na lista</th><th>Descrição na lista</th></tr></thead><tbody>${rows||`<tr><td colspan="2" class="empty2">Todos os IDs da lista já têm equipamento.</td></tr>`}</tbody></table></div>${D.falta.length>500?`<p class="muted">… e mais ${D.falta.length-500}.</p>`:""}`}
 if(tab==="ok"){const rows=D.okI.slice(0,500).map(i=>`<tr><td class="mono"><b>${esc(i.devId)}</b></td><td class="mono">${esc(i.code)}</td><td>${esc(planName(i.planId))}</td><td class="muted" style="font-size:12.5px">${esc(refText(String(i.devId).toUpperCase()))}</td></tr>`).join("");
  return`<div class="tbl"><table><thead><tr><th>ID</th><th>Ref.</th><th>Planta</th><th>Descrição na lista</th></tr></thead><tbody>${rows||`<tr><td colspan="4" class="empty2">Ainda nenhum.</td></tr>`}</tbody></table></div>`}
 const R=refSet();
 const rows=D.inc.slice(0,300).map(i=>{const st=readStateOf(i);const cs=(i.readCands||[]).filter(c=>c.k==="id").slice(0,4);
  return`<tr><td class="mono">${esc(i.code)}</td><td>${esc(planName(i.planId))}</td><td><span class="rs rs-${st}">${RS_N[st]}</span></td><td>${S.canWrite&&cs.length?cs.map(c=>`<button type="button" class="cand${R&&R.has(c.v)?" inref":""}" data-fix="${esc(i.id)}" data-v="${esc(c.v)}">Usar ${esc(c.v)}${R&&R.has(c.v)?" ✓":""}</button>`).join(" "):`<span class="muted">${st==="a_ler"||st==="pendente"?"na fila de leitura":"sem leituras: recorta a zona ou tira outra foto"}</span>`}</td><td>${open(i)}</td></tr>`}).join("");
 return`<div class="tbl"><table><thead><tr><th>Ref.</th><th>Planta</th><th>Estado</th><th>Leituras possíveis</th><th></th></tr></thead><tbody>${rows||`<tr><td colspan="5" class="empty2">Sem leituras inconclusivas.</td></tr>`}</tbody></table></div>
  ${S.canWrite&&D.inc.length?`<div class="toolrow"><button type="button" class="btn" id="refRetry">Ler de novo todos os inconclusivos</button></div>`:""}`}
function wireRef(W){const up=$("refUp");if(up)up.onclick=()=>$("refIn").click();
 W.querySelectorAll("[data-ref-tab]").forEach(b=>b.onclick=()=>{REFV=b.dataset.refTab;renderPage("ids")});
 W.querySelectorAll("[data-fix]").forEach(b=>b.onclick=async e=>{e.stopPropagation();const it=S.items.find(i=>i.id===b.dataset.fix);if(!it)return;const v=b.dataset.v;
  const o=findDup(it.id,"devId",v);const patch={devId:v,readConf:"alta",readState:"ok",readNote:`ID ${v} escolhido${refSet()&&refSet().has(v)?" (consta da lista de IDs)":""}.`,updatedAt:now(),updatedBy:S.meId};
  logPatch(it,patch,"ID: "+v);await api.update("items",it.id,patch);toast(o?`ID ${v} guardado, mas está repetido com ${o.code}.`:`ID ${v} guardado em ${it.code}.`);renderPage("ids")});
 const rr=$("refRetry");if(rr)rr.onclick=()=>{const n=retryInconclusive();toast(n?`${n} equipamento${n>1?"s":""} voltaram à fila de leitura (em segundo plano).`:"Já estão na fila.")};
 const dl=$("refDel");if(dl)dl.onclick=async()=>{if(!dl.classList.contains("armed")){dl.classList.add("armed");dl.textContent="Confirmar remover";return}await api.del("meta","idref");REFV="";toast("Lista de IDs removida.");renderPage("ids")};
 const cv=$("refCsv");if(cv)cv.onclick=()=>{const r=idRef();const R=refSet();const e=v=>{v=String(v??"");return/[;"\n]/.test(v)?`"${v.replace(/"/g,'""')}"`:v};const rows=[["ID","Estado","Ref. equipamento","Planta","Descrição na lista"]];
  const seen=new Set();for(const i of S.items.filter(i=>i.devId)){const v=String(i.devId).toUpperCase();seen.add(v);rows.push([v,R.has(v)?"Bate certo":"Não consta da lista",i.code,planName(i.planId),refText(v)])}
  for(const x of r.ids)if(!seen.has(x.id))rows.push([x.id,"Por encontrar","","",x.t||""]);
  for(const i of S.items.filter(i=>["inconclusivo","a_ler","pendente"].includes(readStateOf(i))))rows.push(["","Inconclusivo",i.code,planName(i.planId),""]);
  saveFile(`Comparacao_IDs_${slug()}.csv`,"﻿"+rows.map(r=>r.map(e).join(";")).join("\r\n"))}}
const idsPageBase=idsPage;
idsPage=function(){const h=idsPageBase();const k='<div class="card" style="padding:12px;display:grid;gap:10px"><div class="toolrow"><input type="search" id="idQ"';const i=h.indexOf(k);return i<0?h+refCard():h.slice(0,i)+refCard()+h.slice(i)};
const wireIdsBase=wireIds;
wireIds=function(W){wireIdsBase(W);wireRef(W||$("pageWrap"))};

/* ---------- filtro "Inconclusivos" na lista da planta ---------- */
const inFilterBase=inFilter;
inFilter=function(it,f){f=f||S.filter;if(f==="inc")return["inconclusivo","a_ler","pendente","fora"].includes(readStateOf(it));return inFilterBase(it,f)};
(()=>{const all=document.querySelector('.filters .chip[data-f="all"]');if(!all)return;const b=document.createElement("button");b.className="chip";b.dataset.f="inc";b.setAttribute("aria-pressed","false");b.innerHTML="Inconclusivos <b></b>";
 b.title="Fotos sem ID certo, IDs fora da lista e leituras em curso";all.before(b);b.onclick=()=>{S.filter="inc";render()}})();

/* =========================================================
   ObraFlow · PDF com texto pesquisável
   1) a planta descarregada em PDF leva o texto (IDs das etiquetas, referências e o texto do
      desenho original) como texto real: no leitor de PDF, Ctrl+F encontra os IDs;
   2) a pesquisa da app procura também no texto das plantas em PDF (ex.: IDs escritos no desenho).
   ========================================================= */
/* texto invisível junto ao pino: só o que a etiqueta ainda não mostra (para o Ctrl+F não encontrar o mesmo ID duas vezes) */
function extraTxt(it,mode){const t=String(labelOf(it,mode)||"");return[it.devId,it.mac,it.code].filter(v=>v&&!t.includes(String(v))).join(" ")}
/* texto de uma página de PDF com posições na imagem (0–1) */
const PTX={};
async function planText(p){if(!p||!p.pdf)return null;const key="ptx:"+p.pdf+"|"+(p.page||1);if(PTX[key])return PTX[key];
 let a=await IDBX.get("kv",key).catch(()=>null);
 if(!a){const pg=await pdfPage(p);if(!pg)return null;const vp=pg.getViewport({scale:1});const tc=await pg.getTextContent();a=[];
  for(const it of tc.items){const s=String(it.str||"").replace(/\s+/g," ").trim();if(!s)continue;
   const tr=pdfjsLib.Util.transform(vp.transform,it.transform);const fh=Math.hypot(tr[2],tr[3])||8;const ang=Math.atan2(tr[1],tr[0]);
   const w=Math.max(fh*s.length*.5,(it.width||0)*vp.scale);
   a.push({t:s,x:tr[4]/vp.width,y:(tr[5]-fh*.85)/vp.height,w:w/vp.width,h:fh/vp.height,r:Math.round(ang*180/Math.PI)})}
  IDBX.put("kv",key,a).catch(()=>{})}
 PTX[key]=a;return a}
const normQ=s=>String(s||"").toUpperCase().replace(/[\s:._\-\/]/g,"");
/* procura em todas as plantas com PDF (a atual primeiro) */
async function planTextHits(q,limit){const Q=normQ(q);if(Q.length<3)return[];const out=[];const cur=plan();
 const ps=S.plans.filter(p=>p.pdf).sort((a,b)=>(b.id===(cur&&cur.id))-(a.id===(cur&&cur.id)));
 for(const p of ps){let a=null;try{a=await planText(p)}catch(e){}if(!a)continue;
  for(const t of a){if(normQ(t.t).includes(Q)){out.push({k:"ptext",id:p.id,plan:p.id,x:t.x,y:t.y,w:t.w,h:t.h,t:t.t,s:`Texto no desenho · ${p.name}`,score:5});if(out.length>=(limit||12))return out}}}
 return out}
/* pesquisa global: junta os resultados do texto das plantas */
(()=>{const g=$("gq");if(!g)return;let tok=0;
 g.addEventListener("input",()=>{const q=g.value;const my=++tok;if(normQ(q).length<3||!S.projectId)return;
  setTimeout(async()=>{if(my!==tok)return;const h=await planTextHits(q,10);if(my!==tok||!h.length||g.value!==q)return;
   gHits=gHits.filter(x=>x.k!=="ptext").concat(h);renderGres()},250)})})();
const renderGresBase=renderGres;
renderGres=function(){renderGresBase();const R=$("gres");if(!R)return;
};
const gOpenBase=gOpen;
gOpen=function(h){if(h&&h.k==="ptext"){$("gres").hidden=true;$("gq").value="";$("gq").blur();showPlanText(h);return}gOpenBase(h)};
/* abre a planta e destaca o texto encontrado */
let ptxHL=null;
function showPlanText(h){openPlan(h.plan);ptxHL={...h};
 const tryShow=(n)=>{const p=plan();if(!p||p.id!==h.plan||!p.w||!$("planImg").naturalWidth){if(n<40)setTimeout(()=>tryShow(n+1),150);return}
  let el=$("ptxHl");if(!el){el=document.createElement("div");el.id="ptxHl";el.className="ptxhl";$("stage").appendChild(el)}
  const pad=Math.max(6,h.h*p.h*.6);el.style.left=(h.x*p.w-pad)+"px";el.style.top=(h.y*p.h-pad)+"px";el.style.width=(h.w*p.w+pad*2)+"px";el.style.height=(h.h*p.h+pad*2)+"px";
  el.hidden=false;el.classList.remove("blink");void el.offsetWidth;el.classList.add("blink");
  centerOn({x:h.x+h.w/2,y:h.y+h.h/2});const r=viewer.getBoundingClientRect();
  const z=Math.min(4,Math.max(view.z,Math.min(r.width,r.height)/(Math.max(h.w*p.w,h.h*p.h)*10)));view.z=z;view.x=r.width/2-(h.x+h.w/2)*p.w*z;view.y=r.height/2-(h.y+h.h/2)*p.h*z;applyView();
  toast(`Encontrado no desenho: "${h.t}"`)};
 setTimeout(()=>tryShow(0),120)}
setInterval(()=>{const el=$("ptxHl");if(el&&!el.hidden){const p=plan();if(!p||!ptxHL||p.id!==ptxHL.plan||S.view!=="obra")el.hidden=true}},800);

/* ---------- planta em PDF: marcadores e etiquetas em vetor (nítidos com qualquer zoom) e texto pesquisável ---------- */
/* tamanho do texto das etiquetas, escolhido no diálogo de descarregar */
(()=>{const l=$("exLbl");if(!l)return;const lab=l.closest("label");const w=document.createElement("label");w.className="f";
 w.innerHTML=`Tamanho do texto das etiquetas<select id="exSize"><option value="1">Normal</option><option value="1.4">Grande</option><option value="1.9">Muito grande</option><option value="0.75">Pequeno (plantas muito cheias)</option></select>`;
 (lab||l).after(w);try{const v=localStorage.getItem("of-exsize");if(v)$("exSize").value=v}catch(e){}
 $("exSize").onchange=()=>{try{localStorage.setItem("of-exsize",$("exSize").value)}catch(e){}}})();
function hexRgb(h){h=String(h||"#d9480f").replace("#","");if(h.length===3)h=h.split("").map(c=>c+c).join("");const n=parseInt(h,16);return[(n>>16)&255,(n>>8)&255,n&255]}
/* desenha os marcadores (a partir da disposição calculada) num canvas — usado na pré-visualização */
function drawLayout(cx,L,M,s,mode){cx.save();cx.scale(s,s);const fs=M.fs,pad=M.pad;cx.font=`700 ${fs}px Consolas, "IBM Plex Mono", monospace`;cx.textBaseline="middle";
 for(const q of L){cx.strokeStyle=q.col;cx.lineWidth=Math.max(1.5,fs/9);cx.beginPath();cx.moveTo(q.hx,q.hy);cx.lineTo(q.lx,q.ly);cx.stroke()}
 for(const q of L){const b=q.b;if(!b)continue;cx.fillStyle=q.dup?"#c2402f":"#fff";cx.strokeStyle=q.dup?"#c2402f":q.col;cx.lineWidth=Math.max(2,fs/7);cx.beginPath();cx.rect(b.x0,b.y0,b.x1-b.x0,b.y1-b.y0);cx.fill();cx.stroke();cx.fillStyle=q.dup?"#fff":"#111";cx.fillText(q.t,b.x0+pad,(b.y0+b.y1)/2+1)}
 for(const q of L){const{R,cy}=pinPath(cx,q.x,q.y,M.ph);cx.fillStyle=q.col;cx.fill();cx.lineWidth=Math.max(1.5,fs/8);cx.strokeStyle="#fff";cx.stroke();cx.beginPath();cx.arc(q.x,cy,R*.42,0,7);cx.fillStyle=q.iss?"#c2402f":"#fff";cx.fill()}
 cx.restore()}
planPdf=async function(p,cv,its,mode,withList){const{jsPDF}=window.jspdf;const land=cv.width>=cv.height;
 const L=cv._labels||[],MK=cv._mk||{fs:14,pad:4,ph:27,PR:10};
 // folha: A3 por defeito; plantas grandes com muitas etiquetas vão para A1 para o texto ficar legível impresso
 const big=its.length>60||(window.__lblScale||1)>1.3;const fmt=big?"a1":"a3";
 const doc=new jsPDF({orientation:land?"landscape":"portrait",unit:"mm",format:fmt,compress:true});const PW=doc.internal.pageSize.getWidth(),PH=doc.internal.pageSize.getHeight(),M=10;
 doc.setProperties({title:`${S.meta.name?S.meta.name+" · ":""}${p.name}`,subject:"Planta com equipamentos e IDs",creator:"ObraFlow",keywords:its.map(i=>i.devId||i.mac||i.code).filter(Boolean).join(" ")});
 doc.setFont("helvetica","bold");doc.setFontSize(big?20:13);doc.text(`${S.meta.name?S.meta.name+" · ":""}${p.name}`,M,M+5);
 doc.setFont("helvetica","normal");doc.setFontSize(big?12:9);doc.setTextColor(90);doc.text(`${its.length} equipamentos · gerado em ${new Date().toLocaleString("pt-PT")} · texto pesquisável (Ctrl+F)`,M,M+(big?12:10));doc.setTextColor(0);
 const top=M+(big?18:14),aw=PW-2*M,ah=PH-top-M,k=Math.min(aw/cv.width,ah/cv.height),iw=cv.width*k,ih=cv.height*k,ox=M+(aw-iw)/2,oy=top+(ah-ih)/2;
 doc.addImage(cv.toDataURL("image/jpeg",.9),"JPEG",ox,oy,iw,ih,undefined,"FAST");
 const X=v=>ox+v*k,Y=v=>oy+v*k,PT=72/25.4;
 const inv=(t,x,y,sizeMm,ang)=>{try{doc.setFontSize(Math.max(1,sizeMm*PT));doc.text(String(t),x,y,{renderingMode:"invisible",baseline:"alphabetic",angle:ang||0})}catch(e){}};
 // 1) texto do desenho original (invisível, por cima do desenho): permite procurar salas, IDs do projeto…
 if(p.pdf){try{const pg=await pdfPage(p);if(pg){const v1=pg.getViewport({scale:1});const s=cv.width/v1.width;if(Math.abs(cv.height/v1.height-s)/s<.02){
   const tc=await pg.getTextContent();doc.setFont("helvetica","normal");
   for(const it of tc.items){const str=String(it.str||"").trim();if(!str)continue;const tr=pdfjsLib.Util.transform(v1.transform,it.transform);const fh=Math.hypot(tr[2],tr[3]);if(!fh)continue;
    inv(str,X(tr[4]*s),Y(tr[5]*s),fh*s*k*.95,Math.round(-Math.atan2(tr[1],tr[0])*180/Math.PI))}}}}catch(e){console.warn("texto do PDF",e)}}
 // 2) marcadores em vetor: ligação, caixa da etiqueta, texto real (visível e pesquisável), pino
 const fsMm=MK.fs*k,padMm=MK.pad*k,lw=Math.max(.12,MK.fs/9*k);
 for(const q of L){if(!q.b)continue;doc.setDrawColor(255,255,255);doc.setLineWidth(lw*2.2);doc.line(X(q.hx),Y(q.hy),X(q.lx),Y(q.ly));doc.setDrawColor(...hexRgb(q.col));doc.setLineWidth(lw);doc.line(X(q.hx),Y(q.hy),X(q.lx),Y(q.ly))}
 doc.setFont("courier","bold");doc.setFontSize(fsMm*PT);
 for(const q of L){const b=q.b;if(!b)continue;const tw=doc.getTextWidth(q.t);const bw=Math.max((b.x1-b.x0)*k,tw+padMm*2),bh=(b.y1-b.y0)*k;
  doc.setLineWidth(Math.max(.15,MK.fs/7*k));if(q.dup){doc.setFillColor(194,64,47);doc.setDrawColor(194,64,47)}else{doc.setFillColor(255,255,255);doc.setDrawColor(...hexRgb(q.col))}
  doc.roundedRect(X(b.x0),Y(b.y0),bw,bh,bh*.18,bh*.18,"FD");
  if(q.dup)doc.setTextColor(255,255,255);else doc.setTextColor(17,17,17);
  doc.text(q.t,X(b.x0)+padMm,Y(b.y0)+bh/2,{baseline:"middle"})}
 doc.setTextColor(0);
 for(const q of L){const ph=MK.ph*k,R=ph*.36,cx0=X(q.x),tip=Y(q.y),cy=tip-ph+R;doc.setFillColor(...hexRgb(q.col));doc.setDrawColor(255,255,255);doc.setLineWidth(Math.max(.12,R*.18));
  doc.triangle(cx0-R*.82,cy+R*.45,cx0+R*.82,cy+R*.45,cx0,tip,"F");doc.circle(cx0,cy,R,"FD");if(q.iss)doc.setFillColor(194,64,47);else doc.setFillColor(255,255,255);doc.circle(cx0,cy,R*.42,"F")}
 // 3) ID, MAC e referência junto a cada pino (invisível) — Ctrl+F encontra qualquer um deles
 doc.setFont("helvetica","normal");for(const it of its){if(it.x==null||!extraTxt(it,mode))continue;inv(extraTxt(it,mode),X(it.x*cv.width),Y(it.y*cv.height),Math.max(1,fsMm*.6),0)}
 if(!withList)return doc.output("blob");
 doc.addPage("a4","portrait");const W2=doc.internal.pageSize.getWidth(),H2=doc.internal.pageSize.getHeight();let y=M+6;
 const cols=[["Ref.",M],["ID",M+34],["MAC",M+62],["Tipo",M+104],["Etapa",M+144],["Leitura",M+170]];
 const head=()=>{doc.setFont("helvetica","bold");doc.setFontSize(9);cols.forEach(([t,x])=>doc.text(t,x,y));y+=2;doc.setDrawColor(180);doc.line(M,y,W2-M,y);y+=5;doc.setFont("helvetica","normal")};
 doc.setFont("helvetica","bold");doc.setFontSize(12);doc.text(`Lista de equipamentos · ${p.name}`,M,y);y+=8;head();
 for(const it of its){if(y>H2-M){doc.addPage("a4","portrait");y=M+6;head()}const st=typeof readStateOf==="function"?readStateOf(it):"";
  const row=[it.code,it.devId||"",it.mac||"",tOf(it.type).n,sOf(it.stage).n,st&&st!=="ok"?RS_N[st]:""];doc.setFontSize(9);row.forEach((t,c)=>doc.text(String(t).slice(0,c===0?20:c===3?24:22),cols[c][1],y));y+=5.2}
 return doc.output("blob")};
/* gerar: no PDF a planta vai limpa e os marcadores em vetor; PNG/JPG continuam como imagem */
$("exGo").onclick=async()=>{const p=plan();if(!p)return;const btn=$("exGo");btn.disabled=true;const fmt=$("exFmt").value,mode=$("exLbl").value,colorMode=$("exColor").value;
 window.__lblScale=+(($("exSize")||{}).value||1);
 try{const its=exportItems();if(!its.length&&!(typeof marksFor==="function"&&marksFor(p.id).length)){toast("Não há equipamentos nem marcações para incluir.");return}
  btn.textContent="A desenhar a planta…";const base0=await planCanvas(p);if(p.ov&&$("exOv").value==="1")await drawOvOn(base0,p);
  const base=`Planta_${(p.name||"piso").replace(/[^\p{L}\p{N}]+/gu,"_").slice(0,50)}_${new Date().toISOString().slice(0,10)}`;let blob,name;
  if(fmt==="png"||fmt==="jpg"){const cv=drawMarkers(base0,its,mode,colorMode);btn.textContent="A preparar o ficheiro…";
   const prevUrl=await new Promise(r=>cv.toBlob(b=>r(URL.createObjectURL(b)),"image/jpeg",.7));$("exPrev").src=prevUrl;$("exPrev").hidden=false;
   blob=await new Promise(r=>cv.toBlob(r,fmt==="png"?"image/png":"image/jpeg",.92));name=base+"."+fmt}
  else{const cv=drawMarkers(base0,its,mode,colorMode,"layout");   // só calcula onde ficam as etiquetas
   const sc=Math.min(1,1600/Math.max(cv.width,cv.height));const pv=document.createElement("canvas");pv.width=Math.round(cv.width*sc);pv.height=Math.round(cv.height*sc);
   const px=pv.getContext("2d");px.drawImage(cv,0,0,pv.width,pv.height);drawLayout(px,cv._labels,cv._mk,sc,mode);
   $("exPrev").src=pv.toDataURL("image/jpeg",.75);$("exPrev").hidden=false;
   btn.textContent="A preparar o PDF…";name=base+".pdf";
   const wOv=!!(p.ov&&$("exOv").value==="1");let how="";
   try{blob=await vecPlanPdf(p,its,mode,colorMode,fmt==="pdf",wOv);how=p.pdf?"vetor":"imagem original"}
   catch(e){console.warn("PDF vetorial",e);const why=e&&e.message||"erro";
    try{if(!window.jspdf)throw new Error("gerador de PDF indisponível");blob=await rasterPlanPdf(p,its,mode,colorMode,fmt==="pdf",wOv,t=>{btn.textContent=t});how="alta resolução ("+why+")"}
    catch(e2){console.warn("PDF alta resolução",e2);if(!window.jspdf){toast("Gerador de PDF indisponível. Escolhe PNG ou JPG.");return}blob=await planPdf(p,cv,its,mode,fmt==="pdf");how="simples"}}
   setTimeout(()=>toast(how==="vetor"?"PDF com o desenho original em vetor (nítido com qualquer zoom).":how==="imagem original"?"PDF com a imagem original da planta.":how.startsWith("alta")?"PDF com a planta em alta resolução (300 ppp). Não foi possível usar o desenho em vetor: "+how.slice(16,-1)+".":"PDF simples."),1500)}
  await saveBlob(name,blob)}
 catch(e){toast("Não foi possível gerar: "+(e.message||"erro"))}finally{btn.disabled=false;btn.textContent="Gerar e descarregar";window.__lblScale=1}};

/* ---------- alternativa: planta desenhada em alta resolução (300 ppp, em mosaico), mesma folha, sem margens ---------- */
async function rasterPlanPdf(p,its,mode,colorMode,withList,withOv,onStep){const{jsPDF}=window.jspdf;let VW,VH,tiles=[];
 const pg=await pdfPage(p).catch(()=>null);
 if(pg){const v1=pg.getViewport({scale:1});VW=v1.width;VH=v1.height;
  let sc=300/72;const maxPx=90e6;if(VW*VH*sc*sc>maxPx)sc=Math.sqrt(maxPx/(VW*VH));const vp=pg.getViewport({scale:sc});const TW=3072;
  const nx=Math.ceil(vp.width/TW),ny=Math.ceil(vp.height/TW);let n=0;
  for(let ty=0;ty<ny;ty++)for(let tx=0;tx<nx;tx++){n++;onStep&&onStep(`A desenhar a planta em alta resolução (${n} de ${nx*ny})…`);
   const x0=tx*TW,y0=ty*TW,w=Math.min(TW,Math.ceil(vp.width-x0)),h=Math.min(TW,Math.ceil(vp.height-y0));const c=document.createElement("canvas");c.width=w;c.height=h;const cx=c.getContext("2d");cx.fillStyle="#fff";cx.fillRect(0,0,w,h);
   await pg.render({canvasContext:cx,viewport:vp,transform:[1,0,0,1,-x0,-y0]}).promise;tiles.push({u:c.toDataURL("image/jpeg",.93),x:x0/sc,y:y0/sc,w:w/sc,h:h/sc});c.width=c.height=1}}
 else{const b=await blobOf(p.img);const bm=await createImageBitmap(b);const L=841*72/25.4,s2=L/Math.max(bm.width,bm.height);VW=bm.width*s2;VH=bm.height*s2;
  tiles.push({u:await blobToDataUrl(b),x:0,y:0,w:VW,h:VH,fmt:/png/.test(b.type)?"PNG":"JPEG"})}
 const doc=new jsPDF({orientation:VW>=VH?"landscape":"portrait",unit:"pt",format:[VW,VH],compress:true});
 for(const t of tiles)doc.addImage(t.u,t.fmt||"JPEG",t.x,t.y,t.w+.4,t.h+.4,undefined,"FAST");
 const wantMk=typeof marksFor==="function"&&marksFor(p.id).length&&($("exMk")?$("exMk").value==="1":true);
 if((withOv&&p.ov)||wantMk){const kk=Math.min(1,3000/Math.max(p.w,p.h));const oc=document.createElement("canvas");oc.width=Math.round(p.w*kk);oc.height=Math.round(p.h*kk);if(withOv&&p.ov)await drawOvOn(oc,p);if(wantMk)drawMarksOn(oc,p);doc.addImage(oc.toDataURL("image/png"),"PNG",0,0,VW,VH)}
 // texto do desenho (invisível) para Ctrl+F
 if(pg){try{const v1=pg.getViewport({scale:1});const tc=await pg.getTextContent();doc.setFont("helvetica","normal");
  for(const it of tc.items){const str=String(it.str||"").trim();if(!str)continue;const tr=pdfjsLib.Util.transform(v1.transform,it.transform);const fh=Math.hypot(tr[2],tr[3]);if(!fh)continue;
   try{doc.setFontSize(fh*.95);doc.text(str,tr[4],tr[5],{renderingMode:"invisible",angle:Math.round(-Math.atan2(tr[1],tr[0])*180/Math.PI)})}catch(e){}}}catch(e){}}
 // marcadores em vetor
 const LW=4000,s=VW/LW,LH=Math.round(VH/s);const lc=document.createElement("canvas");lc.width=LW;lc.height=LH;const cv=drawMarkers(lc,its,mode,colorMode,"layout");const L=cv._labels||[],MK=cv._mk;
 const fsPt=MK.fs*s,padPt=MK.pad*s,lw=Math.max(.3,MK.fs/9*s);
 for(const q of L){if(!q.b)continue;doc.setDrawColor(255,255,255);doc.setLineWidth(lw*2.2);doc.line(q.hx*s,q.hy*s,q.lx*s,q.ly*s);doc.setDrawColor(...hexRgb(q.col));doc.setLineWidth(lw);doc.line(q.hx*s,q.hy*s,q.lx*s,q.ly*s)}
 doc.setFont("courier","bold");doc.setFontSize(fsPt);
 for(const q of L){const b=q.b;if(!b)continue;const tw=doc.getTextWidth(q.t);const bw=Math.max((b.x1-b.x0)*s,tw+padPt*2),bh=(b.y1-b.y0)*s;doc.setLineWidth(Math.max(.4,MK.fs/7*s));
  if(q.dup){doc.setFillColor(194,64,47);doc.setDrawColor(194,64,47)}else{doc.setFillColor(255,255,255);doc.setDrawColor(...hexRgb(q.col))}doc.rect(b.x0*s,b.y0*s,bw,bh,"FD");
  if(q.dup)doc.setTextColor(255,255,255);else doc.setTextColor(17,17,17);doc.text(q.t,b.x0*s+padPt,b.y0*s+bh/2,{baseline:"middle"})}
 doc.setTextColor(0);
 for(const q of L){const ph=MK.ph*s,R=ph*.36,x=q.x*s,tip=q.y*s,cy=tip-ph+R;doc.setFillColor(...hexRgb(q.col));doc.setDrawColor(255,255,255);doc.setLineWidth(Math.max(.3,R*.18));
  doc.triangle(x-R*.82,cy+R*.45,x+R*.82,cy+R*.45,x,tip,"F");doc.circle(x,cy,R,"FD");if(q.iss)doc.setFillColor(194,64,47);else doc.setFillColor(255,255,255);doc.circle(x,cy,R*.42,"F")}
 doc.setFont("helvetica","normal");for(const it of its){if(it.x==null||!extraTxt(it,mode))continue;try{doc.setFontSize(Math.max(1,fsPt*.5));doc.text(extraTxt(it,mode),it.x*VW,it.y*VH,{renderingMode:"invisible"})}catch(e){}}
 doc.setProperties({title:`${S.meta.name?S.meta.name+" · ":""}${p.name}`,creator:"ObraFlow",subject:"Planta com equipamentos e IDs",keywords:its.map(i=>i.devId||i.mac||i.code).filter(Boolean).join(" ")});
 if(withList){doc.addPage("a4","portrait");let y=50;doc.setFont("helvetica","bold");doc.setFontSize(13);doc.text(`Lista de equipamentos · ${p.name}`,40,y);y+=24;
  const cols=[["Ref.",40],["ID",135],["MAC",215],["Tipo",335],["Etapa",450],["Leitura",520]];const head=()=>{doc.setFont("helvetica","bold");doc.setFontSize(9);cols.forEach(([t,x])=>doc.text(t,x,y));y+=6;doc.setDrawColor(180);doc.line(40,y,555,y);y+=12;doc.setFont("helvetica","normal")};head();
  for(const it of its){if(y>800){doc.addPage("a4","portrait");y=50;head()}const st=typeof readStateOf==="function"?readStateOf(it):"";[it.code,it.devId||"",it.mac||"",tOf(it.type).n,sOf(it.stage).n,st&&st!=="ok"?RS_N[st]:""].forEach((t,c)=>doc.text(String(t).slice(0,c===3?22:20),cols[c][1],y));y+=14}}
 return doc.output("blob")}
/* ---------- PDF "limpo": a planta original em vetor (sem perder qualidade), sem margens nem faixas extra,
   com pinos, ligações e etiquetas em vetor e o texto pesquisável ---------- */
async function loadPdfLib(){if(window.PDFLib)return;try{await loadScript("vendor/pdf-lib.min.js")}catch(e){}if(!window.PDFLib)await loadScript("https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js").catch(()=>{});
 if(!window.PDFLib)throw new Error("falta o ficheiro vendor/pdf-lib.min.js no GitHub")}
async function vecPlanPdf(p,its,mode,colorMode,withList,withOv){await loadPdfLib();const{PDFDocument,StandardFonts,rgb,degrees}=window.PDFLib;
 const out=await PDFDocument.create();let VW,VH,page;
 if(p.pdf){const bytes=new Uint8Array(await (await blobOf(p.pdf)).arrayBuffer());const src=await PDFDocument.load(bytes,{ignoreEncryption:true,updateMetadata:false});
  if(src.isEncrypted)throw new Error("o PDF original está protegido (encriptado) e não pode ser copiado em vetor");
  const sp=src.getPage(Math.min((p.page||1),src.getPageCount())-1);const cb=sp.getCropBox(),mb=sp.getMediaBox();
  const l=Math.max(cb.x,mb.x),b=Math.max(cb.y,mb.y),r=Math.min(cb.x+cb.width,mb.x+mb.width),t=Math.min(cb.y+cb.height,mb.y+mb.height);
  const W0=r-l,H0=t-b,rot=((sp.getRotation().angle%360)+360)%360;const ep=await out.embedPage(sp,{left:l,bottom:b,right:r,top:t});
  if(rot===90||rot===270){VW=H0;VH=W0}else{VW=W0;VH=H0}
  page=out.addPage([VW,VH]);
  if(rot===0)page.drawPage(ep,{x:0,y:0});else if(rot===90)page.drawPage(ep,{x:0,y:W0,rotate:degrees(-90)});else if(rot===180)page.drawPage(ep,{x:W0,y:H0,rotate:degrees(180)});else page.drawPage(ep,{x:H0,y:0,rotate:degrees(90)})}
 else{const blob=await blobOf(p.img);const bm=await createImageBitmap(blob);const L=841*72/25.4;const s=L/Math.max(bm.width,bm.height);VW=bm.width*s;VH=bm.height*s;page=out.addPage([VW,VH]);
  const img=/png/.test(blob.type)?await out.embedPng(await blob.arrayBuffer()):/jpe?g/.test(blob.type)?await out.embedJpg(await blob.arrayBuffer()):await out.embedJpg(await (await new Promise(r=>{const c=document.createElement("canvas");c.width=bm.width;c.height=bm.height;c.getContext("2d").drawImage(bm,0,0);c.toBlob(r,"image/jpeg",.95)})).arrayBuffer());
  page.drawImage(img,{x:0,y:0,width:VW,height:VH})}
 // desenho sobreposto e marcações (se pedidos): camada transparente por cima
 const wantMk=typeof marksFor==="function"&&marksFor(p.id).length&&($("exMk")?$("exMk").value==="1":true);
 if((withOv&&p.ov)||wantMk){const kk=Math.min(1,3000/Math.max(p.w,p.h));const oc=document.createElement("canvas");oc.width=Math.round(p.w*kk);oc.height=Math.round(p.h*kk);
  if(withOv&&p.ov)await drawOvOn(oc,p);if(wantMk)drawMarksOn(oc,p);
  const png=await out.embedPng(await (await new Promise(r=>oc.toBlob(r,"image/png"))).arrayBuffer());page.drawImage(png,{x:0,y:0,width:VW,height:VH})}
 // disposição das etiquetas (mesmo algoritmo da app) numa grelha de ~4000 px
 const LW=4000,s=VW/LW,LH=Math.round(VH/s);const lc=document.createElement("canvas");lc.width=LW;lc.height=LH;
 const cv=drawMarkers(lc,its,mode,colorMode,"layout");const L=cv._labels||[],MK=cv._mk;
 const X=v=>v*s,Y=v=>VH-v*s,C=h=>{const[a,b,c]=hexRgb(h);return rgb(a/255,b/255,c/255)},white=rgb(1,1,1);
 const font=await out.embedFont(StandardFonts.CourierBold),helv=await out.embedFont(StandardFonts.Helvetica);
 const fsPt=MK.fs*s,padPt=MK.pad*s,lw=Math.max(.3,MK.fs/9*s);
 for(const q of L){if(!q.b)continue;page.drawLine({start:{x:X(q.hx),y:Y(q.hy)},end:{x:X(q.lx),y:Y(q.ly)},thickness:lw*2.2,color:white});page.drawLine({start:{x:X(q.hx),y:Y(q.hy)},end:{x:X(q.lx),y:Y(q.ly)},thickness:lw,color:C(q.col)})}
 const safe=t=>String(t).replace(/[^\x20-\x7E -ÿ·–]/g,"?");
 for(const q of L){const b=q.b;if(!b)continue;const t=safe(q.t);const tw=font.widthOfTextAtSize(t,fsPt);const bw=Math.max((b.x1-b.x0)*s,tw+padPt*2),bh=(b.y1-b.y0)*s;
  page.drawRectangle({x:X(b.x0),y:Y(b.y0)-bh,width:bw,height:bh,color:q.dup?rgb(.76,.25,.18):white,borderColor:q.dup?rgb(.76,.25,.18):C(q.col),borderWidth:Math.max(.4,MK.fs/7*s)});
  page.drawText(t,{x:X(b.x0)+padPt,y:Y(b.y0)-bh/2-fsPt*.33,size:fsPt,font,color:q.dup?white:rgb(.07,.07,.07)})}
 for(const q of L){const ph=MK.ph*s,R=ph*.36,x=X(q.x),tip=Y(q.y),cy=tip+ph-R;
  page.drawSvgPath(`M ${-R*.82} ${-(ph-R)+R*.45} L ${R*.82} ${-(ph-R)+R*.45} L 0 0 Z`,{x,y:tip,color:C(q.col)});
  page.drawCircle({x,y:cy,size:R,color:C(q.col),borderColor:white,borderWidth:Math.max(.3,R*.18)});page.drawCircle({x,y:cy,size:R*.42,color:q.iss?rgb(.76,.25,.18):white})}
 // ID, MAC e referência junto a cada pino (texto invisível para Ctrl+F)
 for(const it of its){if(it.x==null||!extraTxt(it,mode))continue;try{page.drawText(safe(extraTxt(it,mode)),{x:X(it.x*LW),y:Y(it.y*LH),size:Math.max(1,fsPt*.5),font:helv,opacity:0})}catch(e){}}
 out.setTitle(`${S.meta.name?S.meta.name+" · ":""}${p.name}`);out.setCreator("ObraFlow");out.setProducer("ObraFlow");out.setSubject("Planta com equipamentos e IDs");out.setKeywords(its.map(i=>i.devId||i.mac||i.code).filter(Boolean));
 if(withList){const A4=[595.28,841.89];let pg=out.addPage(A4),y=800;const bold=await out.embedFont(StandardFonts.HelveticaBold);
  const cols=[["Ref.",40],["ID",135],["MAC",215],["Tipo",335],["Etapa",450],["Leitura",520]];
  const head=()=>{cols.forEach(([t,x])=>pg.drawText(t,{x,y,size:9,font:bold}));y-=6;pg.drawLine({start:{x:40,y},end:{x:555,y},thickness:.5,color:rgb(.7,.7,.7)});y-=12};
  pg.drawText(safe(`Lista de equipamentos · ${p.name}`),{x:40,y,size:13,font:bold});y-=22;head();
  for(const it of its){if(y<40){pg=out.addPage(A4);y=800;head()}const st=typeof readStateOf==="function"?readStateOf(it):"";
   const row=[it.code,it.devId||"",it.mac||"",tOf(it.type).n,sOf(it.stage).n,st&&st!=="ok"?RS_N[st]:""];row.forEach((t,c)=>pg.drawText(safe(String(t).slice(0,c===3?22:20)),{x:cols[c][1],y,size:9,font:helv}));y-=14}}
 return new Blob([await out.save({useObjectStreams:true})],{type:"application/pdf"})}

/* =========================================================
   ObraFlow · Convites para entrar numa obra (link, QR code ou email)
   ========================================================= */
const INV_KEY="of-invite";
function inviteUrl(tok){return location.origin+location.pathname+"#convite="+tok}
function newToken(){const a=new Uint8Array(18);crypto.getRandomValues(a);return[...a].map(b=>"abcdefghijkmnpqrstuvwxyz23456789"[b%32]).join("")}
/* guardar o convite que veio no link (antes de entrar) */
(()=>{const m=location.hash.match(/convite=([a-z0-9]{16,})/i);if(m){try{localStorage.setItem(INV_KEY,m[1])}catch(e){}history.replaceState(null,"",location.pathname+location.search)}})();
function pendingInvite(){try{return localStorage.getItem(INV_KEY)||""}catch(e){return""}}
function clearInvite(){try{localStorage.removeItem(INV_KEY)}catch(e){}}
/* página de entrada: mostra para que obra é o convite */
const showAuthBase=showAuth;
showAuth=function(msg){showAuthBase(msg);const tok=pendingInvite();if(!tok||!sb)return;
 sb.rpc("invite_info",{p_token:tok}).then(({data,error})=>{const card=document.querySelector(".lp-card");if(!card||error||!data)return;
  const b=document.createElement("div");b.className="invban "+(data.ok?"ok":"bad");
  b.innerHTML=data.ok?`<b>Convite para a obra</b><span>${esc(data.name||"")}</span><small>como ${esc(PR_N[data.role]||data.role)}${data.email?` · para ${esc(data.email)}`:""}. Entra ou cria conta para aceitar.</small>`:`<b>Este convite já não é válido.</b><small>Pede um novo convite ao administrador da obra.</small>`;
  card.prepend(b);if(data.ok&&data.email){const e=$("auEmail");if(e&&!e.value)e.value=data.email}
  if(!data.ok)clearInvite()}).catch(()=>{})};
/* depois de entrar: aceita o convite (a conta nova fica aprovada) e abre a obra */
let invOpen=null;
const startSessionBase=startSession;
startSession=async function(session,offline){const tok=pendingInvite();
 if(tok&&!offline&&sb&&navigator.onLine){try{const{data,error}=await sb.rpc("accept_invite",{p_token:tok});
   if(!error&&data&&data.ok){invOpen=data.project;clearInvite();setTimeout(()=>toast(`Entraste na obra ${data.name||""} como ${PR_N[data.role]||data.role}.`),900)}
   else if(data&&data.erro){clearInvite();setTimeout(()=>toast("Convite: "+data.erro),900)}}catch(e){}}
 await startSessionBase(session,offline);
 if(invOpen&&S.projects.some(p=>p.id===invOpen)){const id=invOpen;invOpen=null;openProject(id)}};
/* quem já tem sessão e abre um link de convite */
window.addEventListener("hashchange",async()=>{const m=location.hash.match(/convite=([a-z0-9]{16,})/i);if(!m)return;try{localStorage.setItem(INV_KEY,m[1])}catch(e){}
 history.replaceState(null,"",location.pathname+location.search);if(S.session&&sb){const{data}=await sb.rpc("accept_invite",{p_token:m[1]}).catch(()=>({data:null}));clearInvite();
  if(data&&data.ok){await loadMembers();await loadProjects();toast(`Entraste na obra ${data.name||""}.`);openProject(data.project)}else if(data&&data.erro)toast("Convite: "+data.erro)}});

/* ---------- desenhar o QR code ---------- */
let qrP=null;function qrLib(){if(!qrP)qrP=loadScript("vendor/qrcode.js").catch(e=>{qrP=null;throw e});return qrP}
async function qrCanvas(text,px){await qrLib();const{QRCode,ECL}=window.QRCodeLib;const q=new QRCode(-1,ECL.M);q.addData(text);q.make();const n=q.getModuleCount(),m=4,s=Math.max(4,Math.floor((px||320)/(n+m*2)));
 const c=document.createElement("canvas");c.width=c.height=(n+m*2)*s;const x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,c.width,c.height);x.fillStyle="#1d2421";
 for(let r=0;r<n;r++)for(let k=0;k<n;k++)if(q.isDark(r,k))x.fillRect((k+m)*s,(r+m)*s,s,s);return c}

/* ---------- convidar (página Pessoas) ---------- */
let invList=[],invLast=null;
async function loadInvites(){if(!sb||!S.mp||S.demo||!S.projectId)return;const{data,error}=await sb.from("project_invites").select("token,role,email,max_uses,uses,revoked,expires_at,created_at").eq("project_id",S.projectId).order("created_at",{ascending:false});
 invList=error?[]:(data||[]).filter(i=>!i.revoked&&(!i.expires_at||new Date(i.expires_at)>new Date())&&(i.max_uses==null||i.uses<i.max_uses))}
function inviteSection(){if(!S.mp||S.demo||!(S.isAdmin||S.isProjAdmin))return"";
 return`<section class="block" id="invSec"><h2>Convidar para esta obra</h2><div class="card invc">
  <div class="invform"><label class="f">Papel<select id="ivRole"><option value="membro">Membro — trabalha na obra</option><option value="seguidor">Seguidor — só vê e recebe avisos</option><option value="admin">Administrador — gere a obra e as pessoas</option></select></label>
   <label class="f">Email (opcional)<input id="ivEmail" type="email" placeholder="nome@empresa.pt"></label>
   <div class="toolrow"><button type="button" class="btn primary" id="ivQr">Criar QR code / link</button><button type="button" class="btn" id="ivMail">Enviar por email</button></div>
   <p class="muted" style="margin:0;font-size:12.5px">O <b>QR code / link</b> serve para várias pessoas durante 30 dias. Com <b>email</b>, o convite só funciona para esse endereço e uma vez. Quem aceitar entra logo nesta obra com o papel escolhido — não precisa de aprovação.</p>
   <div class="msg err" id="ivMsg" hidden></div></div>
  <div class="invout" id="ivOut" hidden></div>
  ${invList.length?`<div class="invlist"><b>Convites ativos</b>${invList.map(i=>`<div class="invrow"><span class="pjrole r-${i.role}">${PR_N[i.role]}</span><span>${i.email?esc(i.email):"QR code / link"}${i.max_uses==null?` · ${i.uses} uso${i.uses===1?"":"s"}`:""}</span><small class="muted">${i.expires_at?"até "+fmtDay(String(i.expires_at).slice(0,10)):""}</small><button type="button" class="btn sm" data-ivshow="${esc(i.token)}">Mostrar</button><button type="button" class="btn sm danger" data-ivrev="${esc(i.token)}">Anular</button></div>`).join("")}</div>`:""}
 </div></section>`}
async function createInvite(withEmail){const m=$("ivMsg");m.hidden=true;const role=$("ivRole").value,email=$("ivEmail").value.trim().toLowerCase();
 if(withEmail&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){m.hidden=false;m.textContent="Escreve o email da pessoa.";$("ivEmail").focus();return null}
 const row={token:newToken(),project_id:S.projectId,role,email:withEmail?email:"",max_uses:withEmail?1:null};
 const{error}=await sb.from("project_invites").insert(row);if(error){m.hidden=false;m.textContent="Não foi possível criar o convite: "+(/row-level|permission/i.test(error.message)?"só o Administrador da obra pode convidar.":/project_invites/.test(error.message)?"corre de novo no Supabase o ficheiro atualizacao-3-projetos.sql.":error.message);return null}
 invLast=row;return row}
async function showInvite(row){const o=$("ivOut");if(!o)return;const url=inviteUrl(row.token);const pj=curProject()||{};
 o.hidden=false;o.innerHTML=`<div class="qrbox" id="ivQrBox"></div><div class="invinfo"><b>Convite para ${esc(pj.name||"a obra")}</b><span class="pjrole r-${row.role}">${PR_N[row.role]}</span>
  <p class="muted" style="margin:0">Aponta a câmara do telemóvel para o QR code, ou envia o link.${row.email?` Só funciona para <b>${esc(row.email)}</b>.`:""}</p>
  <input readonly id="ivLink" value="${esc(url)}"><div class="toolrow"><button type="button" class="btn" id="ivCopy">Copiar link</button>${navigator.share?`<button type="button" class="btn" id="ivShare">Partilhar…</button>`:""}<a class="btn" id="ivMailto">Abrir no email</a><button type="button" class="btn" id="ivPng">Descarregar QR</button></div></div>`;
 try{const c=await qrCanvas(url,300);c.className="qrimg";$("ivQrBox").appendChild(c);$("ivPng").onclick=()=>c.toBlob(b=>saveBlob(`Convite_${slug()}.png`,b))}catch(e){$("ivQrBox").innerHTML=`<span class="muted">QR code indisponível: ${esc(e.message)}</span>`}
 const subj=`Convite para a obra ${pj.name||""} no ObraFlow`,body=`Olá,\n\nConvido-te para a obra "${pj.name||""}" no ObraFlow como ${PR_N[row.role]}.\n\nAbre este link (no telemóvel ou no computador), cria conta ou entra com o teu email, e ficas logo com acesso:\n${url}\n\nO convite é válido durante 30 dias.\n\n${(S.me&&S.me.name)||""}`;
 $("ivMailto").href=`mailto:${encodeURIComponent(row.email||"")}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
 $("ivCopy").onclick=()=>navigator.clipboard.writeText(url).then(()=>toast("Link copiado.")).catch(()=>{$("ivLink").select();toast("Seleciona e copia o link.")});
 const sh=$("ivShare");if(sh)sh.onclick=()=>navigator.share({title:subj,text:`Convite para a obra ${pj.name||""} no ObraFlow`,url}).catch(()=>{});
 o.scrollIntoView({block:"nearest",behavior:"smooth"})}
function wireInvites(W){const q=$("ivQr");if(!q)return;
 q.onclick=async()=>{q.disabled=true;try{const r=await createInvite(false);if(r){await loadInvites();renderPage("team");setTimeout(()=>showInvite(r),50)}}finally{q.disabled=false}};
 $("ivMail").onclick=async()=>{const r=await createInvite(true);if(r){await loadInvites();renderPage("team");setTimeout(async()=>{await showInvite(r);const a=$("ivMailto");if(a)a.click()},50)}};
 W.querySelectorAll("[data-ivshow]").forEach(b=>b.onclick=()=>{const i=invList.find(x=>x.token===b.dataset.ivshow);if(i)showInvite(i)});
 W.querySelectorAll("[data-ivrev]").forEach(b=>b.onclick=async()=>{if(!b.classList.contains("armed")){b.classList.add("armed");b.textContent="Confirmar";return}
  await sb.from("project_invites").update({revoked:true}).eq("token",b.dataset.ivrev);await loadInvites();toast("Convite anulado.");renderPage("team")})}
/* junta a secção de convites à página Pessoas */
const renderPageBase3=renderPage;let invLoadedFor=null;
renderPage=function(v){renderPageBase3(v);if(v!=="team")return;const W=$("pageWrap");
 if(invLoadedFor!==S.projectId){invLoadedFor=S.projectId;loadInvites().then(()=>{if(S.view==="team")renderPage("team")})}
 const ps=W.querySelector(".pplist");const sec=ps&&ps.closest("section.block");const box=document.createElement("div");box.innerHTML=inviteSection();
 if(sec)sec.after(box);wireInvites(W);if(invLast&&W.querySelector("#ivOut")&&invList.some(i=>i.token===invLast.token)){}};

/* =========================================================
   ObraFlow · Identificar pessoas com @ (notas, pendências, diário)
   O texto guarda "@Nome"; o documento guarda a lista "mentions" (ids) e o servidor
   envia o email só às pessoas acabadas de identificar.
   ========================================================= */
function projPeople(){const pid=S.projectId;if(!pid)return[];const inP=new Set(S.pm.filter(x=>x.project_id===pid).map(x=>x.user_id));
 return members.filter(m=>m.role!=="pendente"&&(!S.mp||m.role==="admin"||inP.has(m.user_id))).map(m=>({id:m.user_id,name:m.name||m.email,email:m.email}))}
const normN=t=>String(t||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
function findMentions(text){const T=normN(text);if(!T.includes("@"))return[];const ppl=projPeople();const out=new Set();
 const firsts={};ppl.forEach(p=>{const f=normN(p.name).split(/\s+/)[0];firsts[f]=(firsts[f]||0)+1});
 for(const p of ppl){const full=normN(p.name),first=full.split(/\s+/)[0];
  const re=s=>new RegExp("@"+s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"(?![\\p{L}\\p{N}])","u");
  if(re(full).test(T)||(firsts[first]===1&&re(first).test(T))||(p.email&&T.includes("@"+normN(p.email).split("@")[0]+" ")))out.add(p.id)}
 return[...out]}
const MENTION_F=["note","text","notes"];
function withMentions(c,id,data,base){if(!["items","issues","meta"].includes(c))return data;const txt=MENTION_F.map(f=>data[f]).filter(v=>typeof v==="string").join("\n");if(!txt)return data;
 const found=findMentions(txt);if(!found.length)return data;const prev=((base&&base.mentions)||[]).filter(Boolean);
 return{...data,mentions:[...new Set([...prev,...found])],mentionText:txt.slice(0,400)}}
const apiSetBase=api.set,apiUpdateBase=api.update;
api.set=function(c,id,data){return apiSetBase.call(api,c,id,withMentions(c,id,data,L[c]&&L[c][id]))};
api.update=function(c,id,patch){return apiUpdateBase.call(api,c,id,withMentions(c,id,patch,L[c]&&L[c][id]))};
/* lista de sugestões ao escrever "@" */
let mBox=null,mFor=null,mSel=0,mList=[];
function mentionField(el){return el&&(el.tagName==="TEXTAREA"||(el.tagName==="INPUT"&&/(^niText$|text|note|desc|obs)/i.test(el.id||"")&&el.type!=="search"))&&!el.readOnly&&!el.disabled}
function mClose(){if(mBox)mBox.hidden=true;mFor=null}
function mOpen(el,q){const ppl=projPeople().filter(p=>p.id!==S.meId&&(!q||normN(p.name).includes(normN(q))||normN(p.email).startsWith(normN(q)))).slice(0,6);
 if(!ppl.length){mClose();return}mList=ppl;mSel=0;mFor=el;
 if(!mBox){mBox=document.createElement("div");mBox.className="mbox";document.body.appendChild(mBox);mBox.addEventListener("mousedown",e=>{const b=e.target.closest("[data-mi]");if(b){e.preventDefault();mPick(+b.dataset.mi)}})}
 mBox.innerHTML=`<small>Identificar (recebe email)</small>`+ppl.map((p,i)=>`<button type="button" data-mi="${i}" class="${i===mSel?"on":""}"><span class="ini">${esc(initials(p.name))}</span><span><b>${esc(p.name)}</b><small>${esc(p.email||"")}</small></span></button>`).join("");
 const r=el.getBoundingClientRect();mBox.style.left=Math.min(r.left,innerWidth-280)+"px";mBox.style.top=(r.bottom+4+scrollY)+"px";mBox.style.minWidth=Math.min(320,r.width)+"px";mBox.hidden=false}
function mPick(i){const el=mFor,p=mList[i];if(!el||!p)return;const pos=el.selectionStart,before=el.value.slice(0,pos),after=el.value.slice(pos);
 const at=before.lastIndexOf("@");const nb=before.slice(0,at)+"@"+p.name+" ";el.value=nb+after;el.setSelectionRange(nb.length,nb.length);mClose();
 el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}));el.focus();
 toast(`${p.name} vai receber um email quando guardares.`)}
document.addEventListener("input",e=>{const el=e.target;if(!mentionField(el)||!S.projectId||S.demo)return;const pos=el.selectionStart||0,b=el.value.slice(0,pos);
 const m=b.match(/(?:^|\s)@([\p{L}\p{N}._-]{0,24})$/u);if(m)mOpen(el,m[1]);else if(mFor===el)mClose()},true);
document.addEventListener("keydown",e=>{if(!mBox||mBox.hidden||e.target!==mFor)return;
 if(e.key==="ArrowDown"||e.key==="ArrowUp"){mSel=(mSel+(e.key==="ArrowDown"?1:-1)+mList.length)%mList.length;mBox.querySelectorAll("[data-mi]").forEach((b,i)=>b.classList.toggle("on",i===mSel));e.preventDefault()}
 else if(e.key==="Enter"||e.key==="Tab"){mPick(mSel);e.preventDefault();e.stopPropagation()}else if(e.key==="Escape")mClose()},true);
document.addEventListener("focusout",e=>{if(e.target===mFor)setTimeout(()=>{if(document.activeElement!==mFor)mClose()},150)});
/* dica nos campos de texto */
document.addEventListener("focusin",e=>{const el=e.target;if(!mentionField(el)||el.dataset.mhint||S.demo||!S.mp)return;el.dataset.mhint="1";if(el.placeholder&&!/@/.test(el.placeholder))el.placeholder+=" · @ para avisar alguém";else if(!el.placeholder)el.placeholder="Escreve @ para avisar alguém por email"});

/* =========================================================
   ObraFlow · Tarefas e dúvidas na planta (gotas) — ficha completa ao estilo Fieldwire
   Cada gota: tipo (tarefa/dúvida), estado (Aberta → Em curso → Concluída → Verificada),
   especialidade, prioridade, responsável, seguidores, início/prazo, horas e custo,
   etiquetas, checklist (com modelos), fotos e ficheiros, equipamento ligado,
   tarefas relacionadas e histórico com conversa (@ avisa por email).
   Integrações: ligação direta, WhatsApp, email, Google Calendar / Outlook (.ics),
   relatório PDF com recorte da planta, Excel/CSV e importação de tarefas do Fieldwire.
   Guardam-se na coleção "issues" (kind "tarefa"/"duvida"; x,y na planta).
   ========================================================= */
const TK={tarefa:{n:"Tarefa",c:"#2563eb",g:"✓"},duvida:{n:"Dúvida",c:"#7c3aed",g:"?"}};
const TST={aberta:"Aberta",curso:"Em curso",resolvida:"Concluída",verificada:"Verificada"};
const TCAT={sadi:{n:"SADI / Deteção de incêndio",c:"#e11d48"},ele:{n:"Eletricidade",c:"#d97706"},avac:{n:"AVAC",c:"#0284c7"},hid:{n:"Hidráulica / Águas",c:"#1d4ed8"},
 tel:{n:"Telecomunicações / ITED",c:"#7c3aed"},seg:{n:"Segurança (CCTV / Intrusão / Acessos)",c:"#0f766e"},cc:{n:"Construção civil",c:"#78716c"},arq:{n:"Arquitetura / Acabamentos",c:"#a16207"},out:{n:"Outros",c:"#475569"}};
const tSt=t=>t.status==="resolvida"&&t.verifiedAt?"verificada":(t.status||"aberta");
const tStN=(t,st)=>(st||tSt(t))==="resolvida"&&t.kind==="duvida"?"Respondida":TST[st||tSt(t)];
const tCol=t=>(TCAT[t.cat]||{}).c||(TK[t.kind]||TK.tarefa).c;
const isTk=x=>x&&(x.kind==="tarefa"||x.kind==="duvida");
S.movingTask=null;
const TFILT=["todas","abertas","minhas","nenhuma"],TFILT_N={todas:"Todas",abertas:"Só abertas",minhas:"Só as minhas",nenhuma:"Escondidas"};
let tFilt=(()=>{try{const v=localStorage.getItem("of-tasks-f");return TFILT.includes(v)?v:"todas"}catch(e){return"todas"}})();
function planTasks(pid){return S.issues.filter(x=>isTk(x)&&x.planId===(pid||S.planId)&&x.x!=null)}
function nextSeq(){return S.issues.reduce((m,x)=>Math.max(m,+x.seq||0),0)+1}
const tRef=t=>`${(TK[t.kind]||TK.tarefa).n} #${t.seq||""}`;
const tLink=t=>location.origin+location.pathname+`#tarefa=${encodeURIComponent(t.id)}${S.projectId?"&obra="+encodeURIComponent(S.projectId):""}`;

/* ---------- botão de modo e filtro das gotas ---------- */
(()=>{const mk=$("mMark");if(!mk)return;const b=document.createElement("button");b.id="mTask";b.type="button";b.setAttribute("aria-pressed","false");b.title="Toca na planta para criar uma tarefa ou uma dúvida nesse ponto";
 b.innerHTML=`<svg class="gico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s-7-6.4-7-12a7 7 0 0 1 14 0c0 5.6-7 12-7 12z"/></svg>Tarefa / dúvida`;mk.after(b);
 b.onclick=()=>{S.mode=S.mode==="task"?"nav":"task";S.movingTask=null;render()}})();
function taskHint(){return S.movingTask?`<b>Colocar/mover:</b> toca no sítio da tarefa/dúvida na planta. <button class="btn sm" id="tmCancel">Cancelar</button>`:`<b>Tarefa / dúvida:</b> toca no ponto da planta onde queres criar uma tarefa ou colocar uma dúvida.`}
document.addEventListener("click",e=>{if(e.target.id==="tmCancel"){S.movingTask=null;render()}});
/* v43: no telemóvel a ficha ocupa a planta toda — ao escolher Marcar/Tarefa fecha-se a ficha aberta para se poder tocar na planta */
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("#mMark,#mTask");if(b&&S.sel&&innerWidth<1100)S.sel=null},true);
(()=>{const m=$("actMenu");if(!m)return;const b=document.createElement("button");b.type="button";b.className="btn";b.id="tkShow";const lab=()=>b.textContent="Gotas na planta: "+TFILT_N[tFilt]+" ▸";lab();
 b.onclick=()=>{tFilt=TFILT[(TFILT.indexOf(tFilt)+1)%TFILT.length];try{localStorage.setItem("of-tasks-f",tFilt)}catch(e){}lab();toast("Gotas na planta: "+TFILT_N[tFilt]);render()};m.appendChild(b)})();

/* ---------- desenhar as gotas ---------- */
function renderTasks(p){stage.querySelectorAll(".tpin").forEach(e=>e.remove());if(!p||tFilt==="nenhuma"||S.swap)return;const td=today();
 for(const t of planTasks(p.id)){const done=t.status==="resolvida";if(tFilt==="abertas"&&done)continue;if(tFilt==="minhas"&&t.assignee!==S.meId&&t.createdBy!==S.meId&&!(t.followers||[]).includes(S.meId))continue;
  const k=TK[t.kind];const el=document.createElement("div");const late=!done&&t.due&&t.due<td;const ck=t.checklist||[],cd=ck.filter(c=>c.done).length;
  el.className="tpin"+(done?" done":"")+(t.verifiedAt?" ver":"")+(late?" late":"")+(S.taskSel===t.id?" sel":"")+(t.prio==="alta"?" hi":"");el.dataset.t=t.id;el.style.left=t.x*p.w+"px";el.style.top=t.y*p.h+"px";el.style.scale=String(1/view.z);el.style.setProperty("--c",tCol(t));
  el.title=`${tRef(t)} · ${t.title||t.text||""}${t.assignee?" · "+nameOf(t.assignee):""}${ck.length?` · checklist ${cd}/${ck.length}`:""}`;
  el.innerHTML=`<svg viewBox="0 0 30 40" aria-hidden="true"><path d="M15 39C15 39 2.5 25.5 2.5 14.5a12.5 12.5 0 0 1 25 0C27.5 25.5 15 39 15 39z"/><text x="15" y="19.5">${done?"✓":k.g}</text></svg><span>${k.n.slice(0,1)}${t.seq||""}${ck.length&&!done?` <em>${cd}/${ck.length}</em>`:""}</span>`;stage.appendChild(el)}}
const scalePinsBase=scalePins;scalePins=function(){scalePinsBase();stage.querySelectorAll(".tpin").forEach(el=>el.style.scale=String(1/view.z))};
function taskClick(e){const pt=toPlan(e);if(!pt)return;
 if(S.movingTask){const id=S.movingTask;S.movingTask=null;const t=S.issues.find(x=>x.id===id);tUpd(t,{x:pt.x,y:pt.y,planId:S.planId},t&&t.x==null?"colocou na planta "+planName(S.planId):"mudou a posição na planta");toast("Posição guardada.");render();return}
 if(!S.canWrite){toast("Não tens permissão para criar tarefas nesta obra.");return}
 newTask(pt)}
/* gravar com histórico */
function tUpd(t,patch,logT){if(!t)return;const p={...patch,updatedAt:now(),updatedBy:S.meId};if(logT)p.log=[...(t.log||[]),{at:now(),by:S.meId,t:logT}].slice(-80);return api.update("issues",t.id,p)}

/* ---------- diálogo ---------- */
(()=>{const d=document.createElement("dialog");d.id="dlgTask";d.innerHTML=`<div class="dlg tdlg" id="tkBody"></div>`;document.body.appendChild(d);
 const inp=document.createElement("input");inp.type="file";inp.id="tkFile";inp.hidden=true;document.body.appendChild(inp);
 d.addEventListener("close",()=>{S.taskSel=null;render()})})();
function pickFile(accept){return new Promise(res=>{const i=$("tkFile");i.accept=accept||"";i.multiple=true;i.value="";i.onchange=()=>res([...i.files]);i.click()})}
function peopleOpts(sel,none){return`<option value="">${none||"Sem responsável"}</option>`+projPeople().map(p=>`<option value="${esc(p.id)}"${sel===p.id?" selected":""}>${esc(p.name)}</option>`).join("")}
const catOpts=sel=>`<option value="">Sem especialidade</option>`+Object.entries(TCAT).map(([k,v])=>`<option value="${k}"${sel===k?" selected":""}>${esc(v.n)}</option>`).join("");
const prioOpts=sel=>Object.entries(PRIO).map(([k,n])=>`<option value="${k}"${(sel||"media")===k?" selected":""}>${n}</option>`).join("");
let tkDraft=null;
function newTask(pt,base){tkDraft={kind:"tarefa",title:"",text:"",assignee:"",due:"",start:"",prio:"media",cat:"",photos:[],checklist:[],x:pt?pt.x:null,y:pt?pt.y:null,planId:S.planId,...(base||{})};
 if(!base){try{const last=JSON.parse(localStorage.getItem("of-tk-last")||"{}");if(last.kind)tkDraft.kind=last.kind;if(last.cat)tkDraft.cat=last.cat}catch(e){}}
 drawNew();$("dlgTask").showModal();setTimeout(()=>$("tkTitle").focus(),60)}
function tplList(){return(S.meta&&S.meta.taskTpl)||[]}
function drawNew(){const D=tkDraft;const tpls=tplList();$("tkBody").innerHTML=`<div class="tdh"><h3>Novo ponto na planta</h3><button type="button" class="btn sm" id="tkX">Fechar</button></div>
 <div class="tkinds">${Object.entries(TK).map(([k,v])=>`<button type="button" data-tk="${k}" class="${D.kind===k?"on":""}" style="--c:${v.c}"><i><b>${v.g}</b></i><span><b>${v.n}</b><small>${k==="duvida"?"Pergunta a esclarecer (cota, material, localização…)":"Trabalho a fazer neste ponto"}</small></span></button>`).join("")}</div>
 <label class="f">Título<input id="tkTitle" value="${esc(D.title)}" placeholder="${D.kind==="duvida"?"ex.: Confirmar altura do detetor no corredor":"ex.: Passar cabo até ao quadro"}"></label>
 <label class="f">Descrição<textarea id="tkText" rows="3" placeholder="Detalhes. Escreve @ para avisar alguém por email.">${esc(D.text)}</textarea></label>
 <div class="tgrid"><label class="f">Responsável<select id="tkWho">${peopleOpts(D.assignee)}</select></label><label class="f">Especialidade<select id="tkCat">${catOpts(D.cat)}</select></label>
  <label class="f">Prioridade<select id="tkPrio">${prioOpts(D.prio)}</select></label><label class="f">Início<input type="date" id="tkStart" value="${esc(D.start)}"></label><label class="f">Prazo<input type="date" id="tkDue" value="${esc(D.due)}"></label>
  ${tpls.length?`<label class="f">Checklist<select id="tkTpl"><option value="">Sem modelo</option>${tpls.map((t,i)=>`<option value="${i}"${D.tpl===String(i)?" selected":""}>${esc(t.name)} (${t.items.length})</option>`).join("")}</select></label>`:""}</div>
 <div class="tph">${D.photos.map(r=>`<img data-ref="${esc(r)}" alt="">`).join("")}<button type="button" class="btn sm" id="tkAddPh">+ Foto</button></div>
 <div class="toolrow" style="justify-content:flex-end"><button type="button" class="btn" id="tkCancel">Cancelar</button><button type="button" class="btn primary" id="tkCreate">Criar ${TK[D.kind].n.toLowerCase()}</button></div>`;
 hydrate($("tkBody"));const keep=()=>{D.title=$("tkTitle").value;D.text=$("tkText").value;D.assignee=$("tkWho").value;D.due=$("tkDue").value;D.start=$("tkStart").value;D.prio=$("tkPrio").value;D.cat=$("tkCat").value;const tp=$("tkTpl");if(tp)D.tpl=tp.value};
 $("tkBody").querySelectorAll("[data-tk]").forEach(b=>b.onclick=()=>{keep();D.kind=b.dataset.tk;drawNew()});
 $("tkX").onclick=$("tkCancel").onclick=()=>$("dlgTask").close();
 $("tkAddPh").onclick=async()=>{keep();const fs=await pickFile("image/*");for(const f of fs){try{D.photos.push(await putFile(await shrink(f,2048,.9),"image/jpeg"))}catch(err){toast("Foto não guardada: "+err.message)}}drawNew()};
 $("tkCreate").onclick=async()=>{keep();if(!D.title.trim()){$("tkTitle").focus();toast("Escreve um título.");return}const id=uid();
  const tp=D.tpl!==undefined&&D.tpl!==""?tplList()[+D.tpl]:null;const checklist=[...(D.checklist||[]),...(tp?tp.items.map(t=>({id:uid(),t,done:false})):[])];
  try{localStorage.setItem("of-tk-last",JSON.stringify({kind:D.kind,cat:D.cat}))}catch(e){}
  await api.set("issues",id,{kind:D.kind,seq:nextSeq(),title:D.title.trim(),text:D.text.trim(),assignee:D.assignee||null,due:D.due||"",start:D.start||"",prio:D.prio,cat:D.cat||"",
   photo:D.photos[0]||null,photos:D.photos,files:D.files||[],planId:D.planId,x:D.x,y:D.y,itemId:null,linkItem:D.linkItem||null,status:"aberta",comments:[],checklist,followers:[],tags:D.tags||[],related:D.related||[],
   hours:D.hours||"",cost:D.cost||"",log:[{at:now(),by:S.meId,t:D.dupOf?"criou (cópia de "+D.dupOf+")":"criou"}],createdBy:S.meId,createdAt:now()});
  S.mode="nav";toast(`${TK[D.kind].n} criada${D.assignee&&D.assignee!==S.meId?" — "+nameOf(D.assignee)+" vai ser avisado":""}.`);openTask(id)}}
function openTask(id){const t=S.issues.find(x=>x.id===id);if(!t)return;S.taskSel=id;drawTask();const d=$("dlgTask");if(!d.open)d.showModal();render()}
function canEditTask(t){return S.canWrite&&(S.isCoord||S.isProjAdmin||t.createdBy===S.meId||t.assignee===S.meId||(t.followers||[]).includes(S.meId))}
const canVerify=t=>S.canWrite&&(S.isCoord||S.isProjAdmin||t.createdBy===S.meId);
function tFiles(t){return[...new Set([...(t.photos||[]),t.photo].filter(Boolean))]}
function drawTask(){const t=S.issues.find(x=>x.id===S.taskSel);if(!t){$("dlgTask").close();return}const k=TK[t.kind]||TK.tarefa,can=canEditTask(t),td=today(),st=tSt(t);
 const late=t.status!=="resolvida"&&t.due&&t.due<td;const cm=t.comments||[],ck=t.checklist||[],cd=ck.filter(c=>c.done).length,fol=t.followers||[],fls=t.files||[],rel=(t.related||[]).map(id=>S.issues.find(x=>x.id===id)).filter(Boolean);
 const items=S.items.filter(i=>i.planId===t.planId).sort((a,b)=>String(a.code).localeCompare(String(b.code)));const li=t.linkItem&&S.items.find(i=>i.id===t.linkItem);
 const tl=[...cm.map(c=>({...c,ty:"c"})),...(t.log||[]).map(l=>({...l,ty:"l"}))].sort((a,b)=>String(a.at).localeCompare(String(b.at)));
 const dis=can?"":" disabled";
 $("tkBody").innerHTML=`<div class="tdh"><span class="tkind k-${t.kind}" style="background:${tCol(t)}">${tRef(t)}</span><span class="tst s-${st}">${tStN(t)}</span>${late?`<span class="tst s-late">Atrasada</span>`:""}<span style="flex:1"></span>
  <div class="actwrap tkshare"><button type="button" class="btn sm" id="tkSh">Partilhar ▾</button><div class="actmenu" id="tkShM" hidden>
   <button class="btn" data-sh="link">Copiar ligação</button><button class="btn" data-sh="wa">Enviar por WhatsApp</button><button class="btn" data-sh="mail">Enviar por email</button>
   <button class="btn" data-sh="gcal"${t.due||t.start?"":" disabled"}>Adicionar ao Google Calendar</button><button class="btn" data-sh="ics"${t.due||t.start?"":" disabled"}>Calendário Outlook / iPhone (.ics)</button>
   <button class="btn" data-sh="pdf">Relatório PDF da ${t.kind==="duvida"?"dúvida":"tarefa"}</button></div></div>
  <button type="button" class="btn sm" id="tkX">Fechar</button></div>
 ${can?`<input class="tti" id="tkT" value="${esc(t.title||"")}" aria-label="Título">`:`<h3 class="tt">${esc(t.title||"(sem título)")}</h3>`}
 <small class="muted">Criada por ${esc(nameOf(t.createdBy))} · ${fmtDate(t.createdAt)} · ${esc(planName(t.planId))}${t.x==null?" · <b>sem posição na planta</b>":""}</small>
 ${can?`<textarea id="tkD" class="tdi" rows="2" placeholder="Descrição (@ para avisar alguém)">${esc(t.text||"")}</textarea>`:t.text?`<p class="tdesc">${esc(t.text)}</p>`:""}
 ${can?`<div class="seg tstseg">${["aberta","curso","resolvida","verificada"].map(s=>`<button type="button" data-tst="${s}" aria-pressed="${st===s}"${s==="verificada"&&!canVerify(t)?' disabled title="Só quem criou ou a coordenação pode verificar"':""}>${tStN(t,s)}</button>`).join("")}</div>`:""}
 <div class="tgrid">
  <label class="f">Responsável<select id="tkWho"${dis}>${peopleOpts(t.assignee||"")}</select></label>
  <label class="f">Especialidade<select id="tkCat"${dis}>${catOpts(t.cat||"")}</select></label>
  <label class="f">Prioridade<select id="tkPrio"${dis}>${prioOpts(t.prio)}</select></label>
  <label class="f">Início<input type="date" id="tkStart" value="${esc(t.start||"")}"${dis}></label>
  <label class="f">Prazo<input type="date" id="tkDue" value="${esc(t.due||"")}"${dis}${late?' class="late"':""}></label>
  <label class="f">Horas (mão de obra)<input type="number" min="0" step="0.5" id="tkHrs" value="${esc(t.hours||"")}" placeholder="0"${dis}></label>
  <label class="f">Custo (€)<input type="number" min="0" step="0.01" id="tkCost" value="${esc(t.cost||"")}" placeholder="0,00"${dis}></label>
  <label class="f">Equipamento ligado<select id="tkItem"${dis}><option value="">Nenhum</option>${items.map(i=>`<option value="${esc(i.id)}"${t.linkItem===i.id?" selected":""}>${esc(i.code||"")}${i.devId?" · "+esc(i.devId):""}</option>`).join("")}</select></label>
  <label class="f">Etiquetas<input id="tkTags" value="${esc((t.tags||[]).join(", "))}" placeholder="ex.: piso 3, urgente"${dis}></label></div>
 ${li?`<div class="tli"><button type="button" class="linkb" id="tkOpenItem">Abrir equipamento ${esc(li.code||"")}</button></div>`:""}
 <div class="tsec"><h4>Seguidores <small>recebem os avisos</small></h4><div class="tfol">${fol.map(u=>`<span class="pchip">${esc(nameOf(u))}${can?`<button type="button" data-unf="${esc(u)}" aria-label="Retirar">×</button>`:""}</span>`).join("")||`<span class="muted">Ninguém.</span>`}
  ${can?`<select id="tkFol"><option value="">+ Adicionar…</option>${projPeople().filter(p=>!fol.includes(p.id)).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("")}</select>`:""}
  ${S.meId&&!fol.includes(S.meId)&&t.assignee!==S.meId?`<button type="button" class="btn sm" id="tkFollow">Seguir</button>`:fol.includes(S.meId)?`<button type="button" class="btn sm" id="tkUnfollow">Deixar de seguir</button>`:""}</div></div>
 <div class="tsec"><h4>Checklist <small>${ck.length?`${cd}/${ck.length} · ${Math.round(cd/ck.length*100)}%`:""}</small>${can&&tplList().length?`<select id="tkTplA" class="sm"><option value="">Aplicar modelo…</option>${tplList().map((x,i)=>`<option value="${i}">${esc(x.name)}</option>`).join("")}</select>`:""}${can&&ck.length?`<button type="button" class="linkb" id="tkTplS">Guardar como modelo</button>`:""}</h4>
  ${ck.length?`<div class="tbar"><i style="width:${cd/ck.length*100}%"></i></div>`:""}
  <div class="tck">${ck.map(c=>`<label class="${c.done?"done":""}"><input type="checkbox" data-ck="${esc(c.id)}"${c.done?" checked":""}${dis}><span>${esc(c.t)}</span>${c.done&&c.by?`<small>${esc(initials(nameOf(c.by)))}</small>`:""}${can?`<button type="button" data-ckx="${esc(c.id)}" aria-label="Apagar">×</button>`:""}</label>`).join("")}</div>
  ${can?`<div class="tcadd"><input id="tkCkN" placeholder="Novo ponto da checklist… (Enter)"><button type="button" class="btn sm" id="tkCkA">Adicionar</button></div>`:""}</div>
 <div class="tsec"><h4>Fotos e ficheiros</h4><div class="tph">${tFiles(t).map(r=>`<img data-ref="${esc(r)}" data-pv="${esc(r)}" alt="">`).join("")}
  ${fls.map((f,i)=>`<button type="button" class="tfile" data-fo="${i}"><b>${esc(docExt(f.name).slice(0,4))}</b><span>${esc(f.name)}</span></button>`).join("")}
  ${can?`<button type="button" class="btn sm" id="tkAddPh">+ Foto</button><button type="button" class="btn sm" id="tkAddF">+ Ficheiro</button>`:""}${!tFiles(t).length&&!fls.length&&!can?`<span class="muted">Sem anexos.</span>`:""}</div></div>
 <div class="tsec"><h4>Relacionadas</h4><div class="tfol">${rel.map(r=>`<span class="pchip tlink" data-rel="${esc(r.id)}" style="--c:${tCol(r)}"><i></i>${esc(tRef(r))} ${esc(String(r.title||"").slice(0,30))}${can?`<button type="button" data-unrel="${esc(r.id)}" aria-label="Retirar">×</button>`:""}</span>`).join("")||`<span class="muted">Nenhuma.</span>`}
  ${can?`<select id="tkRel"><option value="">+ Ligar…</option>${S.issues.filter(x=>isTk(x)&&x.id!==t.id&&!(t.related||[]).includes(x.id)).map(x=>`<option value="${esc(x.id)}">${esc(tRef(x))} · ${esc(String(x.title||"").slice(0,40))}</option>`).join("")}</select>`:""}</div></div>
 <div class="tconv"><h4>${t.kind==="duvida"?"Respostas e histórico":"Conversa e histórico"} <small>${cm.length} mensage${cm.length===1?"m":"ns"}</small></h4>
  ${tl.map(c=>c.ty==="l"?`<div class="tlog"><b>${esc(nameOf(c.by))}</b> ${esc(c.t)} · ${fmtDate(c.at)}</div>`:`<div class="tc${c.by===S.meId?" me":""}"><span class="ini">${esc(initials(nameOf(c.by)))}</span><div><small><b>${esc(nameOf(c.by))}</b> · ${fmtDate(c.at)}</small><p>${esc(c.text)}</p>${c.photo?`<img data-ref="${esc(c.photo)}" data-pv="${esc(c.photo)}" class="tcph" alt="">`:""}</div></div>`).join("")}
  ${S.meId?`<div class="tcin"><textarea id="tkMsg" rows="2" placeholder="${t.kind==="duvida"?"Responder…":"Escrever mensagem…"} (@ para avisar alguém)"></textarea><div class="tcb"><button type="button" class="btn sm" id="tkMsgPh" title="Juntar foto à mensagem">📷</button><button type="button" class="btn primary" id="tkSend">Enviar</button></div></div>`:""}</div>
 <div class="toolrow"><button type="button" class="btn sm" id="tkGo">${t.x==null?"Colocar na planta":"Ver na planta"}</button>${can?`<button type="button" class="btn sm" id="tkMove">Mover</button><button type="button" class="btn sm" id="tkDup">Duplicar</button><span style="flex:1"></span><button type="button" class="btn sm danger" id="tkDel">Apagar</button>`:""}</div>`;
 hydrate($("tkBody"));const B=$("tkBody");
 B.querySelectorAll("[data-pv]").forEach(im=>im.onclick=()=>openPhoto(null,im.dataset.pv));
 $("tkX").onclick=()=>$("dlgTask").close();
 const up=(patch,msg,logT)=>{tUpd(t,patch,logT);if(msg)toast(msg);setTimeout(drawTask,60)};
 /* partilhar / integrações */
 $("tkSh").onclick=e=>{e.stopPropagation();$("tkShM").hidden=!$("tkShM").hidden};
 B.querySelectorAll("[data-sh]").forEach(b=>b.onclick=()=>{$("tkShM").hidden=true;tShare(t,b.dataset.sh)});
 if(can){
  $("tkT").onchange=e=>{const v=e.target.value.trim();if(v)up({title:v},null,"mudou o título")};
  $("tkD").onchange=e=>up({text:e.target.value.trim()},null,"editou a descrição");
  $("tkWho").onchange=e=>up({assignee:e.target.value||null},e.target.value?nameOf(e.target.value)+" vai ser avisado.":"Sem responsável.",e.target.value?"atribuiu a "+nameOf(e.target.value):"retirou o responsável");
  $("tkCat").onchange=e=>up({cat:e.target.value},null,"especialidade: "+((TCAT[e.target.value]||{}).n||"nenhuma"));
  $("tkPrio").onchange=e=>up({prio:e.target.value},null,"prioridade: "+PRIO[e.target.value]);
  $("tkStart").onchange=e=>up({start:e.target.value||""},null,"início: "+(e.target.value?fmtDay(e.target.value):"—"));
  $("tkDue").onchange=e=>up({due:e.target.value||""},null,"prazo: "+(e.target.value?fmtDay(e.target.value):"—"));
  $("tkHrs").onchange=e=>up({hours:e.target.value},null,"horas: "+(e.target.value||"—"));
  $("tkCost").onchange=e=>up({cost:e.target.value},null,"custo: "+(e.target.value?e.target.value+" €":"—"));
  $("tkItem").onchange=e=>up({linkItem:e.target.value||null},null,e.target.value?"ligou ao equipamento "+((S.items.find(i=>i.id===e.target.value)||{}).code||""):"desligou o equipamento");
  $("tkTags").onchange=e=>up({tags:[...new Set(e.target.value.split(/[,;#]/).map(s=>s.trim()).filter(Boolean))]},null,"etiquetas: "+(e.target.value||"—"));
  B.querySelectorAll("[data-tst]").forEach(b=>b.onclick=()=>{const s=b.dataset.tst;if(s===st)return;
   const p=s==="verificada"?{status:"resolvida",resolvedBy:t.resolvedBy||S.meId,resolvedAt:t.resolvedAt||now(),verifiedBy:S.meId,verifiedAt:now()}:s==="resolvida"?{status:s,resolvedBy:S.meId,resolvedAt:now(),verifiedBy:null,verifiedAt:null}:{status:s,resolvedBy:null,resolvedAt:null,verifiedBy:null,verifiedAt:null};
   if(s==="resolvida"&&ck.length&&cd<ck.length&&!confirm(`A checklist tem ${ck.length-cd} ponto(s) por fazer. Marcar como ${tStN(t,s).toLowerCase()} mesmo assim?`))return;
   up(p,tStN(t,s),"estado: "+tStN(t,s))});
  const fs=$("tkFol");if(fs)fs.onchange=e=>{const u=e.target.value;if(u)up({followers:[...fol,u]},nameOf(u)+" passa a seguir.","adicionou "+nameOf(u)+" aos seguidores")};
  B.querySelectorAll("[data-unf]").forEach(b=>b.onclick=()=>up({followers:fol.filter(x=>x!==b.dataset.unf)},null,"retirou "+nameOf(b.dataset.unf)+" dos seguidores"));
  B.querySelectorAll("[data-ck]").forEach(c=>c.onchange=()=>{const it=ck.find(x=>x.id===c.dataset.ck);up({checklist:ck.map(x=>x.id===it.id?{...x,done:c.checked,by:c.checked?S.meId:null,at:c.checked?now():null}:x)},null,(c.checked?"concluiu":"reabriu")+" «"+it.t+"»")});
  B.querySelectorAll("[data-ckx]").forEach(b=>b.onclick=e=>{e.preventDefault();const it=ck.find(x=>x.id===b.dataset.ckx);up({checklist:ck.filter(x=>x.id!==it.id)},null,"apagou «"+it.t+"» da checklist")});
  const addCk=()=>{const v=$("tkCkN").value.trim();if(!v)return;const lines=v.split(/\n/).map(s=>s.trim()).filter(Boolean);up({checklist:[...ck,...lines.map(x=>({id:uid(),t:x,done:false}))]},null,"juntou à checklist: "+lines.join(", "));setTimeout(()=>{const n=$("tkCkN");if(n)n.focus()},120)};
  $("tkCkA").onclick=addCk;$("tkCkN").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();addCk()}};
  const ta=$("tkTplA");if(ta)ta.onchange=e=>{const tp=tplList()[+e.target.value];if(tp)up({checklist:[...ck,...tp.items.map(x=>({id:uid(),t:x,done:false}))]},"Modelo aplicado.","aplicou o modelo «"+tp.name+"»")};
  const ts=$("tkTplS");if(ts)ts.onclick=()=>{const name=prompt("Nome do modelo de checklist:",(TCAT[t.cat]||{}).n||t.title);if(!name)return;const list=[...tplList().filter(x=>x.name!==name),{name,items:ck.map(c=>c.t)}];S.meta={...S.meta,taskTpl:list};api.set("meta","project",{...S.meta});toast("Modelo «"+name+"» guardado para esta obra.")};
  $("tkAddPh").onclick=async()=>{const fs=await pickFile("image/*");const refs=[];for(const f of fs){try{refs.push(await putFile(await shrink(f,2048,.9),"image/jpeg"))}catch(err){toast("Foto não guardada: "+err.message)}}if(refs.length)up({photos:[...(t.photos||[]),...refs],photo:t.photo||refs[0]},refs.length+" foto(s) juntada(s).","juntou "+refs.length+" foto(s)")};
  $("tkAddF").onclick=async()=>{const fs=await pickFile("");const add=[];for(const f of fs){try{add.push({ref:await putFile(f,f.type||"application/octet-stream"),name:f.name,type:f.type||"",size:f.size})}catch(err){toast(f.name+": "+err.message)}}if(add.length)up({files:[...fls,...add]},"Ficheiro juntado.","juntou "+add.map(f=>f.name).join(", "))};
  const rs=$("tkRel");if(rs)rs.onchange=e=>{const id=e.target.value;if(!id)return;const o=S.issues.find(x=>x.id===id);up({related:[...(t.related||[]),id]},null,"ligou a "+tRef(o));if(o&&!(o.related||[]).includes(t.id))tUpd(o,{related:[...(o.related||[]),t.id]},"ligou a "+tRef(t))};
  B.querySelectorAll("[data-unrel]").forEach(b=>b.onclick=e=>{e.stopPropagation();const id=b.dataset.unrel,o=S.issues.find(x=>x.id===id);up({related:(t.related||[]).filter(x=>x!==id)},null,"desligou "+(o?tRef(o):""));if(o)tUpd(o,{related:(o.related||[]).filter(x=>x!==t.id)})});
  $("tkMove").onclick=()=>{S.movingTask=t.id;$("dlgTask").close();if(S.view!=="obra"||S.planId!==t.planId)openPlan(t.planId);toast("Toca no novo sítio na planta.")};
  $("tkDup").onclick=()=>{$("dlgTask").close();newTask(t.x!=null?{x:Math.min(.99,t.x+.02),y:t.y}:null,{kind:t.kind,title:t.title,text:t.text,assignee:t.assignee||"",prio:t.prio,cat:t.cat||"",start:t.start||"",due:t.due||"",tags:t.tags||[],hours:t.hours,cost:t.cost,photos:[],files:[],planId:t.planId,linkItem:t.linkItem,checklist:(t.checklist||[]).map(c=>({id:uid(),t:c.t,done:false})),dupOf:tRef(t)})};
  $("tkDel").onclick=()=>{const b=$("tkDel");if(!b.classList.contains("armed")){b.classList.add("armed");b.textContent="Confirmar apagar";return}api.del("issues",t.id);$("dlgTask").close();toast(k.n+" apagada.")}}
 B.querySelectorAll("[data-fo]").forEach(b=>b.onclick=async()=>{const f=fls[+b.dataset.fo];try{const bl=await blobOf(f.ref);const blob=bl.type?bl:new Blob([bl],{type:f.type});if(/pdf|image\//.test(f.type)){const u=URL.createObjectURL(blob);if(!window.open(u,"_blank"))saveBlob(f.name,blob)}else saveBlob(f.name,blob)}catch(e){toast("Ficheiro indisponível.")}});
 B.querySelectorAll("[data-rel]").forEach(el=>el.onclick=e=>{if(e.target.closest("button"))return;openTask(el.dataset.rel)});
 const oi=$("tkOpenItem");if(oi)oi.onclick=()=>{$("dlgTask").close();openItem(t.linkItem)};
 const fw=$("tkFollow");if(fw)fw.onclick=()=>{tUpd(t,{followers:[...fol,S.meId]},"passou a seguir");toast("Vais receber os avisos desta "+(t.kind==="duvida"?"dúvida":"tarefa")+".");setTimeout(drawTask,60)};
 const uf=$("tkUnfollow");if(uf)uf.onclick=()=>{tUpd(t,{followers:fol.filter(x=>x!==S.meId)},"deixou de seguir");setTimeout(drawTask,60)};
 let msgPh=null;const mp=$("tkMsgPh");if(mp)mp.onclick=async()=>{const fs=await pickFile("image/*");if(!fs[0])return;try{msgPh=await putFile(await shrink(fs[0],2048,.9),"image/jpeg");mp.textContent="📷 1";toast("Foto pronta: escreve a mensagem e envia.")}catch(err){toast("Foto não guardada: "+err.message)}};
 const sd=$("tkSend");if(sd)sd.onclick=async()=>{const txt=$("tkMsg").value.trim();if(!txt&&!msgPh)return;const found=findMentions(txt);
  const c={id:uid(),by:S.meId,at:now(),text:txt||"(foto)"};if(msgPh)c.photo=msgPh;
  const patch={comments:[...(t.comments||[]),c],lastComment:c.text.slice(0,300),lastCommentBy:S.meId};
  if(found.length){patch.mentions=[...new Set([...(t.mentions||[]),...found])];patch.mentionText=txt.slice(0,400);patch.followers=[...new Set([...(t.followers||[]),...found.filter(u=>u!==t.assignee)])]}
  if(t.kind==="duvida"&&t.status==="aberta"&&t.createdBy!==S.meId)patch.status="curso";
  await api.update("issues",t.id,{...patch,updatedAt:now(),updatedBy:S.meId});toast(found.length?"Enviado. "+found.map(nameOf).join(", ")+" vai ser avisado.":"Enviado.");setTimeout(drawTask,60)};
 $("tkGo").onclick=()=>{$("dlgTask").close();if(t.x==null){S.movingTask=t.id;openPlan(t.planId||S.planId||(S.plans[0]||{}).id);toast("Toca no sítio da planta onde fica.");return}showTaskOnPlan(t)}}
document.addEventListener("click",e=>{const m=$("tkShM");if(m&&!m.hidden&&!e.target.closest(".tkshare"))m.hidden=true});
function showTaskOnPlan(t){const go1=()=>{const p=plan();if(!p||p.id!==t.planId||!$("planImg").naturalWidth){setTimeout(go1,150);return}
  const r=viewer.getBoundingClientRect();const z=Math.max(view.z,Math.min((r.width-40)/p.w,(r.height-40)/p.h)*2.5);view.z=z;view.x=r.width/2-t.x*p.w*z;view.y=r.height/2-t.y*p.h*z;applyView();S.taskSel=t.id;render();setTimeout(()=>{S.taskSel=null},2500)};
 if(S.view!=="obra"||S.planId!==t.planId)openPlan(t.planId);setTimeout(go1,150)}

/* ---------- integrações ---------- */
function tSummary(t){return`${tRef(t)} — ${t.title||""}\n${S.meta&&S.meta.name?"Obra: "+S.meta.name+"\n":""}Planta: ${planName(t.planId)}\nEstado: ${tStN(t)}${t.assignee?"\nResponsável: "+nameOf(t.assignee):""}${t.due?"\nPrazo: "+fmtDay(t.due):""}${t.text?"\n\n"+t.text:""}`}
const ymd=d=>d.replace(/-/g,"");
const addDay=d=>{const x=new Date(d+"T12:00:00");x.setDate(x.getDate()+1);return x.toISOString().slice(0,10)};
async function tShare(t,how){const link=tLink(t),txt=tSummary(t);
 if(how==="link"){try{await navigator.clipboard.writeText(link);toast("Ligação copiada. Quem tem acesso à obra abre diretamente esta "+(t.kind==="duvida"?"dúvida.":"tarefa."))}catch(e){prompt("Copia a ligação:",link)}}
 else if(how==="wa")window.open("https://wa.me/?text="+encodeURIComponent(txt+"\n\n"+link),"_blank");
 else if(how==="mail"){const to=[t.assignee,...(t.followers||[])].map(u=>(members.find(m=>m.user_id===u)||{}).email).filter(Boolean).join(",");location.href=`mailto:${encodeURIComponent(to).replace(/%2C/g,",")}?subject=${encodeURIComponent((S.meta.name?S.meta.name+" · ":"")+tRef(t)+": "+(t.title||""))}&body=${encodeURIComponent(txt+"\n\nAbrir no ObraFlow: "+link)}`}
 else if(how==="gcal"){const a=t.start||t.due,b=t.due||t.start;window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(tRef(t)+": "+(t.title||""))}&dates=${ymd(a)}/${ymd(addDay(b))}&details=${encodeURIComponent(txt+"\n\n"+link)}&location=${encodeURIComponent((S.meta.address||S.meta.name||"")+" · "+planName(t.planId))}`,"_blank")}
 else if(how==="ics"){const a=t.start||t.due,b=t.due||t.start;const e=s=>String(s).replace(/[\\;,]/g,m=>"\\"+m).replace(/\n/g,"\\n");
  const ics=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//ObraFlow//PT","BEGIN:VEVENT",`UID:${t.id}@obraflow`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,"").slice(0,15)}Z`,`DTSTART;VALUE=DATE:${ymd(a)}`,`DTEND;VALUE=DATE:${ymd(addDay(b))}`,
   `SUMMARY:${e(tRef(t)+": "+(t.title||""))}`,`DESCRIPTION:${e(txt+"\n\n"+link)}`,`LOCATION:${e(planName(t.planId))}`,`URL:${link}`,"BEGIN:VALARM","TRIGGER:-PT9H","ACTION:DISPLAY",`DESCRIPTION:${e(tRef(t))}`,"END:VALARM","END:VEVENT","END:VCALENDAR"].join("\r\n");
  saveBlob(`${tRef(t).replace(/\W+/g,"_")}.ics`,new Blob([ics],{type:"text/calendar"}))}
 else if(how==="pdf")taskReport([t])}
/* recorte da planta à volta da gota */
function tCrop(t){try{const im=$("planImg");const p=S.plans.find(x=>x.id===t.planId);if(t.x==null||!im||!im.naturalWidth||!p||(S.planId!==t.planId))return null;
 const W=im.naturalWidth,H=im.naturalHeight,cw=Math.min(W,Math.max(700,W*.4)),ch=cw*.62,sx=Math.max(0,Math.min(W-cw,t.x*W-cw/2)),sy=Math.max(0,Math.min(H-ch,t.y*H-ch/2));
 const cv=document.createElement("canvas");cv.width=900;cv.height=Math.round(900*ch/cw);const cx=cv.getContext("2d");cx.fillStyle="#fff";cx.fillRect(0,0,cv.width,cv.height);cx.drawImage(im,sx,sy,cw,ch,0,0,cv.width,cv.height);
 const px=(t.x*W-sx)/cw*cv.width,py=(t.y*H-sy)/ch*cv.height;cx.save();cx.translate(px,py);cx.scale(1.6,1.6);cx.translate(-15,-39);const P=new Path2D("M15 39C15 39 2.5 25.5 2.5 14.5a12.5 12.5 0 0 1 25 0C27.5 25.5 15 39 15 39z");
 cx.fillStyle=tCol(t);cx.strokeStyle="#fff";cx.lineWidth=2;cx.fill(P);cx.stroke(P);cx.fillStyle="#fff";cx.font="800 14px sans-serif";cx.textAlign="center";cx.textBaseline="middle";cx.fillText((TK[t.kind]||TK.tarefa).g,15,15);cx.restore();
 return cv.toDataURL("image/jpeg",.85)}catch(e){return null}}
async function taskReport(list){const w=window.open("","_blank");if(!w){toast("O navegador bloqueou a janela do relatório. Permite janelas para este site.");return}
 w.document.write("<p style='font-family:sans-serif'>A preparar o relatório…</p>");
 const imgs={};for(const t of list)for(const r of tFiles(t).slice(0,6)){try{imgs[r]=await new Promise(async(res)=>{const b=await blobOf(r);const fr=new FileReader();fr.onload=()=>res(fr.result);fr.readAsDataURL(b)})}catch(e){}}
 const e=esc,row=(a,b)=>b?`<tr><th>${a}</th><td>${b}</td></tr>`:"";
 const body=list.map(t=>{const ck=t.checklist||[],crop=tCrop(t);return`<section><div class="h"><span class="k" style="background:${tCol(t)}">${e(tRef(t))}</span><span class="s">${e(tStN(t))}</span></div><h2>${e(t.title||"")}</h2>
  ${t.text?`<p>${e(t.text).replace(/\n/g,"<br>")}</p>`:""}
  <table>${row("Planta",e(planName(t.planId)))}${row("Especialidade",e((TCAT[t.cat]||{}).n||""))}${row("Prioridade",e(PRIO[t.prio]||""))}${row("Responsável",e(t.assignee?nameOf(t.assignee):""))}${row("Seguidores",e((t.followers||[]).map(nameOf).join(", ")))}
  ${row("Início",t.start?fmtDay(t.start):"")}${row("Prazo",t.due?fmtDay(t.due):"")}${row("Horas",e(t.hours||""))}${row("Custo",t.cost?e(t.cost)+" €":"")}${row("Etiquetas",e((t.tags||[]).join(", ")))}
  ${row("Equipamento",e(((S.items.find(i=>i.id===t.linkItem)||{}).code)||""))}${row("Criada",e(nameOf(t.createdBy))+" · "+fmtDate(t.createdAt))}${row("Concluída",t.resolvedAt?e(nameOf(t.resolvedBy))+" · "+fmtDate(t.resolvedAt):"")}${row("Verificada",t.verifiedAt?e(nameOf(t.verifiedBy))+" · "+fmtDate(t.verifiedAt):"")}</table>
  ${crop?`<h3>Localização na planta</h3><img class="crop" src="${crop}">`:""}
  ${ck.length?`<h3>Checklist (${ck.filter(c=>c.done).length}/${ck.length})</h3><ul class="ck">${ck.map(c=>`<li>${c.done?"☑":"☐"} ${e(c.t)}</li>`).join("")}</ul>`:""}
  ${tFiles(t).some(r=>imgs[r])?`<h3>Fotos</h3><div class="ph">${tFiles(t).filter(r=>imgs[r]).map(r=>`<img src="${imgs[r]}">`).join("")}</div>`:""}
  ${(t.comments||[]).length?`<h3>${t.kind==="duvida"?"Respostas":"Mensagens"}</h3>${t.comments.map(c=>`<p class="c"><b>${e(nameOf(c.by))}</b> <small>${fmtDate(c.at)}</small><br>${e(c.text)}</p>`).join("")}`:""}</section>`}).join("");
 w.document.open();w.document.write(`<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>${e(list.length===1?tRef(list[0])+" "+(list[0].title||""):"Tarefas e dúvidas")} — ObraFlow</title><style>
 body{font-family:Arial,sans-serif;color:#1d2421;margin:24px;font-size:13px}header{display:flex;justify-content:space-between;border-bottom:3px solid #e8a317;padding-bottom:8px;margin-bottom:16px}header b{font-size:20px}header b i{color:#e8a317;font-style:normal}
 section{page-break-inside:avoid;margin-bottom:28px;border-bottom:1px solid #ddd;padding-bottom:16px}section+section{page-break-before:always}.h{display:flex;gap:8px}.k{color:#fff;font-weight:bold;padding:3px 10px;border-radius:99px}.s{background:#eee;padding:3px 10px;border-radius:99px;font-weight:bold}
 h2{margin:10px 0 6px}h3{margin:16px 0 6px;font-size:14px}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:4px 8px;border-bottom:1px solid #eee;vertical-align:top}th{width:130px;color:#5e6b66;font-weight:normal}
 .crop{width:100%;max-width:640px;border:1px solid #ccc;border-radius:6px}.ph{display:flex;flex-wrap:wrap;gap:8px}.ph img{width:200px;height:150px;object-fit:cover;border-radius:6px}.ck{list-style:none;padding:0}.c{background:#f5f5f2;padding:6px 10px;border-radius:6px}
 @media print{.np{display:none}}</style></head><body><header><b>Obra<i>Flow</i></b><span>${e(S.meta.name||"Obra")} · ${fmtDate(now())}</span></header>
 <p class="np"><button onclick="print()">Imprimir / Guardar como PDF</button></p>${body}<script>setTimeout(()=>print(),600)<\/script></body></html>`);w.document.close()}

/* ---------- abrir pela ligação (#tarefa=…) ---------- */
let tDeep=(()=>{const m=location.hash.match(/tarefa=([^&]+)(?:&obra=([^&]+))?/);if(m){try{sessionStorage.setItem("of-deep",JSON.stringify({t:decodeURIComponent(m[1]),p:m[2]?decodeURIComponent(m[2]):null}))}catch(e){}history.replaceState(null,"",location.pathname+location.search)}
 try{return JSON.parse(sessionStorage.getItem("of-deep")||"null")}catch(e){return null}})();
window.addEventListener("hashchange",()=>{const m=location.hash.match(/tarefa=([^&]+)(?:&obra=([^&]+))?/);if(!m)return;tDeep={t:decodeURIComponent(m[1]),p:m[2]?decodeURIComponent(m[2]):null};history.replaceState(null,"",location.pathname+location.search)});
let tDeepTries=0;
setInterval(()=>{if(!tDeep||!S.meId)return;if(++tDeepTries>120){tDeep=null;try{sessionStorage.removeItem("of-deep")}catch(e){}return}
 if(tDeep.p&&S.projectId!==tDeep.p){if(typeof openProject==="function"&&(S.projects||[]).some(p=>p.id===tDeep.p)&&!tDeep.opening){tDeep.opening=1;openProject(tDeep.p)}return}
 const t=S.issues.find(x=>x.id===tDeep.t);if(!t)return;tDeep=null;try{sessionStorage.removeItem("of-deep")}catch(e){}
 if(t.x!=null){showTaskOnPlan(t);setTimeout(()=>openTask(t.id),700)}else openTask(t.id)},500);

/* ---------- página de tarefas: abrir, exportar e importar do Fieldwire ---------- */
const renderPageBase4=renderPage;
renderPage=function(v){renderPageBase4(v);if(v!=="issues")return;const W=$("pageWrap");
 W.querySelectorAll("[data-task]").forEach(el=>el.onclick=e=>{if(e.target.closest("select,input,button"))return;const t=S.issues.find(x=>x.id===el.dataset.task);if(!t)return;if(t.x!=null){showTaskOnPlan(t);setTimeout(()=>openTask(t.id),700)}else openTask(t.id)});
 const tabs=W.querySelector(".ptabs");if(tabs&&!$("tkTools")){const d=document.createElement("div");d.className="toolrow tktools";d.id="tkTools";
  d.innerHTML=`<span class="muted">Tarefas e dúvidas:</span><button class="btn sm" id="tkXls">Exportar Excel</button><button class="btn sm" id="tkCsv">CSV</button><button class="btn sm" id="tkRep">Relatório PDF</button>${S.canWrite?`<button class="btn sm" id="tkImp" title="Importa a exportação de tarefas do Fieldwire (Excel ou CSV)">Importar do Fieldwire</button>`:""}`;
  tabs.after(d);$("tkXls").onclick=()=>tExport("xlsx");$("tkCsv").onclick=()=>tExport("csv");$("tkRep").onclick=()=>{const l=tList();if(!l.length){toast("Não há tarefas nem dúvidas.");return}taskReport(l)};const im=$("tkImp");if(im)im.onclick=fwImport}};
function tList(){const k=(typeof ISF!=="undefined"&&ISF.kind)||"";return S.issues.filter(x=>isTk(x)&&(!k||k==="anomalia"||x.kind===k)).sort((a,b)=>(+a.seq||0)-(+b.seq||0))}
function tRows(){return tList().map(t=>({"Nº":t.seq||"","Tipo":(TK[t.kind]||{}).n,"Título":t.title||"","Descrição":t.text||"","Estado":tStN(t),"Especialidade":(TCAT[t.cat]||{}).n||"","Prioridade":PRIO[t.prio]||"","Responsável":t.assignee?nameOf(t.assignee):"","Seguidores":(t.followers||[]).map(nameOf).join(", "),
 "Início":t.start||"","Prazo":t.due||"","Horas":t.hours||"","Custo (€)":t.cost||"","Etiquetas":(t.tags||[]).join(", "),"Checklist":(t.checklist||[]).length?`${t.checklist.filter(c=>c.done).length}/${t.checklist.length}`:"","Planta":planName(t.planId),"Equipamento":((S.items.find(i=>i.id===t.linkItem)||{}).code)||"",
 "Mensagens":(t.comments||[]).length,"Criada por":nameOf(t.createdBy),"Criada em":String(t.createdAt||"").slice(0,10),"Concluída em":String(t.resolvedAt||"").slice(0,10),"Ligação":tLink(t)}))}
async function tExport(fmt){const rows=tRows();if(!rows.length){toast("Não há tarefas nem dúvidas para exportar.");return}const name=`Tarefas_${slug()}`;
 if(fmt==="xlsx"){try{await loadScript(XLSX_URL);const ws=XLSX.utils.json_to_sheet(rows);ws["!cols"]=Object.keys(rows[0]).map(k=>({wch:Math.min(50,Math.max(8,k.length+2,...rows.map(r=>String(r[k]).length/1.6)))}));const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Tarefas");
  saveBlob(name+".xlsx",new Blob([XLSX.write(wb,{bookType:"xlsx",type:"array"})],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));return}catch(e){toast("Excel indisponível sem rede — a descarregar CSV.")}}
 const c=v=>{v=String(v??"");return/[;"\n]/.test(v)?`"${v.replace(/"/g,'""')}"`:v};saveFile(name+".csv","﻿"+[Object.keys(rows[0]).join(";"),...rows.map(r=>Object.values(r).map(c).join(";"))].join("\n"))}
/* importação: aceita a exportação de tarefas do Fieldwire (colunas em inglês ou português) */
const FWCOL={title:/^(title|name|task( name)?|t[ií]tulo|nome|tarefa)$/i,status:/^(status|estado)$/i,cat:/^(category|categoria|especialidade|trade)$/i,who:/^(assignee|assigned to|owner|respons[aá]vel|atribu[ií]da a)$/i,
 prio:/^(priority|prioridade)$/i,start:/^(start( date)?|in[ií]cio|data de in[ií]cio)$/i,due:/^(end( date)?|due( date)?|prazo|fim|data de fim)$/i,plan:/^(plan|sheet|planta|folha|location|localiza[cç][aã]o)$/i,text:/^(description|descri[cç][aã]o|notes|notas|message|mensagem)$/i,
 tags:/^(tags?|etiquetas?)$/i,hours:/^(manpower|man ?hours|horas)$/i,cost:/^(cost|custo)$/i,id:/^(id|task id|n[ºo°]?|number)$/i,check:/^(checklist|checklists)$/i};
const fwStatus=s=>{s=normN(s);return/verif/.test(s)?"verificada":/complet|conclu|done|feito|fechad|closed/.test(s)?"resolvida":/progress|curso|andamento/.test(s)?"curso":"aberta"};
const fwPrio=s=>{s=normN(s);return/1|high|alta|urg/.test(s)?"alta":/3|low|baixa/.test(s)?"baixa":"media"};
const fwCat=s=>{const n=normN(s);if(!n)return"";const hit=Object.entries(TCAT).find(([k,v])=>normN(v.n).includes(n)||n.includes(normN(v.n).split(/[ /]/)[0]));if(hit)return hit[0];
 return/fire|incend|sadi|deteç|detec/.test(n)?"sadi":/elec|eletr|electr/.test(n)?"ele":/hvac|avac|clima/.test(n)?"avac":/plumb|hidra|agua/.test(n)?"hid":/tele|ited|data|rede/.test(n)?"tel":/cctv|secur|segur|intrus|acess/.test(n)?"seg":/civil|struct|estrut/.test(n)?"cc":/arch|arquit|acaba|finish/.test(n)?"arq":"out"};
const fwDate=s=>{s=String(s||"").trim();if(!s)return"";let m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)return m.slice(1).join("-");m=s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);if(m){const y=m[3].length===2?"20"+m[3]:m[3];return`${y}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`}
 const d=new Date(s);return isNaN(d)?"":d.toISOString().slice(0,10)};
async function fwImport(){const fs=await pickFile(".xlsx,.xls,.csv,text/csv");const f=fs[0];if(!f)return;let rows=[];
 try{if(/\.csv$/i.test(f.name)){const txt=await f.text();const sep=(txt.split("\n")[0].match(/;/g)||[]).length>(txt.split("\n")[0].match(/,/g)||[]).length?";":",";rows=csvParse(txt,sep)}
  else{await loadScript(XLSX_URL);const wb=XLSX.read(await f.arrayBuffer(),{type:"array"});const ws=wb.Sheets[wb.SheetNames.find(n=>/task|tarefa/i.test(n))||wb.SheetNames[0]];rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:""})}}
 catch(e){toast("Não foi possível ler o ficheiro: "+e.message);return}
 const hi=rows.findIndex(r=>r.some(c=>FWCOL.title.test(String(c).trim())));if(hi<0){toast("Não encontrei a coluna do título (Title / Título).");return}
 const H=rows[hi].map(c=>String(c).trim());const col={};for(const[k,re]of Object.entries(FWCOL)){const i=H.findIndex(h=>re.test(h));if(i>=0)col[k]=i}
 const ppl=projPeople();const findP=s=>{const n=normN(s);if(!n)return null;const p=ppl.find(p=>normN(p.name)===n||normN(p.email)===n||normN(p.name).startsWith(n)||n.startsWith(normN(p.name)));return p?p.id:null};
 const findPlan=s=>{const n=normN(s);if(!n)return null;const p=S.plans.find(p=>normN(p.name)===n)||S.plans.find(p=>normN(p.name).includes(n)||n.includes(normN(p.name)));return p?p.id:null};
 const data=rows.slice(hi+1).filter(r=>String(r[col.title]||"").trim());if(!data.length){toast("O ficheiro não tem tarefas.");return}
 const v=(r,k)=>col[k]!=null?String(r[col[k]]??"").trim():"";const noPlan=data.filter(r=>!findPlan(v(r,"plan"))).length;
 if(!confirm(`Importar ${data.length} tarefa(s) de «${f.name}»?${noPlan?`\n${noPlan} sem planta reconhecida ficam na planta atual (${planName(S.planId)||"—"}), sem posição: depois usas «Colocar na planta».`:""}\nAs tarefas importadas ficam sem posição até as colocares na planta.`))return;
 let seq=nextSeq(),n=0;for(const r of data){const st=fwStatus(v(r,"status"));const ref=v(r,"id");
  await api.set("issues",uid(),{kind:/d[uú]vida|rfi|question|pergunta/i.test(v(r,"cat")+" "+v(r,"tags"))?"duvida":"tarefa",seq:seq++,title:v(r,"title").slice(0,200),text:v(r,"text"),status:st==="verificada"?"resolvida":st,
   resolvedAt:st==="resolvida"||st==="verificada"?now():null,resolvedBy:st==="resolvida"||st==="verificada"?S.meId:null,verifiedAt:st==="verificada"?now():null,verifiedBy:st==="verificada"?S.meId:null,
   cat:fwCat(v(r,"cat")),prio:fwPrio(v(r,"prio")),assignee:findP(v(r,"who")),start:fwDate(v(r,"start")),due:fwDate(v(r,"due")),planId:findPlan(v(r,"plan"))||S.planId||(S.plans[0]||{}).id||null,x:null,y:null,itemId:null,
   tags:[...v(r,"tags").split(/[,;#]/).map(s=>s.trim()).filter(Boolean),"fieldwire"],hours:v(r,"hours"),cost:v(r,"cost"),checklist:v(r,"check")?v(r,"check").split(/\n|;|\|/).map(s=>s.replace(/^\s*[-☐☑✓x\[\]]+\s*/i,"").trim()).filter(Boolean).map(t=>({id:uid(),t,done:false})):[],
   comments:[],followers:[],related:[],photos:[],files:[],fwId:ref||null,log:[{at:now(),by:S.meId,t:"importou do Fieldwire"+(ref?" (ID "+ref+")":"")+(v(r,"who")&&!findP(v(r,"who"))?" · responsável original: "+v(r,"who"):"")}],createdBy:S.meId,createdAt:now()});n++}
 toast(n+" tarefa(s) importada(s) do Fieldwire.");renderPage("issues")}
function csvParse(txt,sep){const out=[];let row=[],cell="",q=false;for(let i=0;i<txt.length;i++){const ch=txt[i];if(q){if(ch==='"'){if(txt[i+1]==='"'){cell+='"';i++}else q=false}else cell+=ch}
 else if(ch==='"')q=true;else if(ch===sep){row.push(cell);cell=""}else if(ch==="\n"||ch==="\r"){if(ch==="\r"&&txt[i+1]==="\n")i++;row.push(cell);out.push(row);row=[];cell=""}else cell+=ch}
 if(cell||row.length){row.push(cell);out.push(row)}return out.map(r=>r.map(c=>c.replace(/^﻿/,"")))}
/* nomes no menu */
(()=>{const t=document.querySelector('.side [data-nav="issues"] span:not(.cnt)');if(t)t.textContent="Tarefas e anomalias";const b=document.querySelector('.bnav [data-nav="issues"] span');if(b)b.textContent="Tarefas"})();

/* =========================================================
   ObraFlow · Notificações da plataforma (sino)
   "Para mim": menções, atribuições, respostas e comentários nas minhas tarefas/dúvidas,
   tarefas concluídas, prazos de hoje/ultrapassados e (coordenação) novas dúvidas.
   "Atividade": o que acontece na obra.
   Também aparecem como notificação do aparelho (telemóvel/computador) se a pessoa ativar.
   ========================================================= */
/* registo de quando alguém é identificado (@) ou recebe uma atribuição — para a notificação ter hora certa */
const apiSetN=api.set,apiUpdN=api.update;
function withNLog(c,id,data){if(!["items","issues","meta"].includes(c)||!data)return data;const base=(L[c]&&L[c][id])||{};const at=now(),by=S.meId;let out=data;
 const prevM=new Set((base.mentions||[]).filter(Boolean));const newM=(data.mentions||[]).filter(u=>u&&!prevM.has(u)&&u!==by);
 if(newM.length)out={...out,mlog:[...(base.mlog||[]),...newM.map(u=>({u,at,by,t:String(data.mentionText||"").slice(0,160)}))].slice(-30)};
 if("assignee" in data&&data.assignee&&data.assignee!==base.assignee&&data.assignee!==by)out={...out,alog:[...(base.alog||[]),{u:data.assignee,at,by}].slice(-20)};
 return out}
api.set=function(c,id,data){const b=L[c]&&L[c][id];return apiSetN.call(api,c,id,withNLog(c,id,withMentions(c,id,data,b)))};
api.update=function(c,id,patch){const b=L[c]&&L[c][id];return apiUpdN.call(api,c,id,withNLog(c,id,withMentions(c,id,patch,b)))};

const isTaskK=x=>x.kind==="tarefa"||x.kind==="duvida";
const issueLabel=x=>isTaskK(x)?`${x.kind==="duvida"?"dúvida":"tarefa"} #${x.seq||""} «${String(x.title||"").slice(0,50)}»`:`pendência${(S.items.find(i=>i.id===x.itemId)||{}).code?" "+(S.items.find(i=>i.id===x.itemId)).code:""} «${String(x.text||"").slice(0,50)}»`;
function myNotifs(){const me=S.meId;if(!me)return[];const out=[];const td=today();
 const add=(o)=>{if(o.at&&o.by!==me)out.push(o)};
 for(const it of S.items){const w=`o equipamento ${it.devId||it.code||""}`.trim();
  for(const m of it.mlog||[])if(m.u===me)add({id:`m|i|${it.id}|${m.at}`,ty:"mencao",at:m.at,by:m.by,t:`identificou-te n${w.startsWith("o ")?w:"o "+w}`,d:m.t,go:{item:it.id}});
  for(const a of it.alog||[])if(a.u===me)add({id:`a|i|${it.id}|${a.at}`,ty:"atribuido",at:a.at,by:a.by,t:`atribuiu-te ${w}`,go:{item:it.id}});
  if(it.assignee===me&&isLate(it))out.push({id:`p|i|${it.id}|${it.due}`,ty:"prazo",at:it.due+"T08:00:00.000Z",by:null,t:`Prazo ultrapassado: ${w}`,go:{item:it.id}})}
 for(const x of S.issues){const lab=issueLabel(x),mine=x.createdBy===me,asg=x.assignee===me,open=x.status!=="resolvida";const go=isTaskK(x)&&x.x!=null?{task:x.id}:x.itemId?{item:x.itemId}:{view:"issues"};
  for(const m of x.mlog||[])if(m.u===me)add({id:`m|x|${x.id}|${m.at}`,ty:"mencao",at:m.at,by:m.by,t:`identificou-te na ${lab}`,d:m.t,go});
  const alog=x.alog||[];for(const a of alog)if(a.u===me)add({id:`a|x|${x.id}|${a.at}`,ty:"atribuido",at:a.at,by:a.by,t:`atribuiu-te a ${lab}`,d:x.due?"Prazo "+fmtDay(x.due):"",go});
  if(asg&&!alog.length&&x.createdAt)add({id:`a|x|${x.id}|c`,ty:"atribuido",at:x.createdAt,by:x.createdBy,t:`atribuiu-te a ${lab}`,d:x.due?"Prazo "+fmtDay(x.due):"",go});
  const fol=(x.followers||[]).includes(me);const involved=mine||asg||fol||(x.comments||[]).some(c=>c.by===me);
  if(fol){const fl=(x.log||[]).filter(l=>/aos seguidores$/.test(l.t||"")&&l.by!==me&&(l.t||"").includes(nameOf(me))).pop();if(fl)add({id:`f|${x.id}|${fl.at}`,ty:"atribuido",at:fl.at,by:fl.by,t:`adicionou-te como seguidor da ${lab}`,go})}
  if((mine||asg||fol)&&x.verifiedAt)add({id:`v|${x.id}|${x.verifiedAt}`,ty:"resolvida",at:x.verifiedAt,by:x.verifiedBy,t:`verificou a ${lab}`,go});
  if(involved)for(const c of x.comments||[])if(c.by!==me&&!(x.mlog||[]).some(m=>m.u===me&&Math.abs(Date.parse(m.at)-Date.parse(c.at))<15000))add({id:`c|${x.id}|${c.id||c.at}`,ty:"comentario",at:c.at,by:c.by,t:`${x.kind==="duvida"?"respondeu à":"comentou na"} ${lab}`,d:String(c.text||"").slice(0,140),go});
  if((mine||asg||fol)&&x.resolvedAt&&!open)add({id:`r|${x.id}|${x.resolvedAt}`,ty:"resolvida",at:x.resolvedAt,by:x.resolvedBy,t:`${x.kind==="duvida"?"marcou como respondida":x.kind==="tarefa"?"concluiu":"resolveu"} a ${lab}`,go});
  if(asg&&open&&x.due&&x.due<=td)out.push({id:`p|x|${x.id}|${x.due}|${x.due<td?"l":"h"}`,ty:"prazo",at:x.due+"T08:00:00.000Z",by:null,t:`${x.due<td?"Prazo ultrapassado":"Prazo hoje"}: ${lab}`,go});
  if((S.isCoord||S.isProjAdmin)&&x.kind==="duvida"&&!mine&&!asg&&x.createdAt)add({id:`n|${x.id}`,ty:"nova",at:x.createdAt,by:x.createdBy,t:`colocou uma nova ${lab}`,d:x.text?String(x.text).slice(0,140):"",go})}
 for(const[id,v]of Object.entries(L.meta||{}))for(const m of (v&&v.mlog)||[])if(m.u===me)add({id:`m|d|${id}|${m.at}`,ty:"mencao",at:m.at,by:m.by,t:id.startsWith("diary_")?`identificou-te no diário de ${fmtDay(id.slice(6))}`:"identificou-te na obra",d:m.t,go:{view:id.startsWith("diary_")?"diary":"home"}});
 const seen=new Set();return out.filter(o=>!seen.has(o.id)&&seen.add(o.id)).sort((a,b)=>String(b.at).localeCompare(String(a.at))).slice(0,80)}

/* estado de leitura: por pessoa e por obra, neste aparelho */
const nKey=k=>`of-n-${k}:${S.projectId||"p0"}:${S.meId||""}`;
const nGet=(k,d)=>{try{return JSON.parse(localStorage.getItem(nKey(k)))??d}catch(e){return d}};
const nPut=(k,v)=>{try{localStorage.setItem(nKey(k),JSON.stringify(v))}catch(e){}};
function nState(){return{all:nGet("all",""),ids:new Set(nGet("ids",[]))}}
function nIsNew(o,st){return !(o.at<=st.all)&&!st.ids.has(o.id)}
function nMark(ids){const st=nState();ids.forEach(i=>st.ids.add(i));nPut("ids",[...st.ids].slice(-400))}
function nMarkAll(){nPut("all",now());nPut("ids",[])}
const NTY={mencao:{c:"#7c3aed",g:"@"},atribuido:{c:"#2563eb",g:"→"},comentario:{c:"#0e7490",g:"💬"},resolvida:{c:"#15803d",g:"✓"},prazo:{c:"#c2402f",g:"!"},nova:{c:"#7c3aed",g:"?"}};
let nTab="me";
/* contador no sino, no título da página e no ícone da app */
renderBell=function(){const b=$("bellN");if(!b)return;const st=nState();const n=myNotifs().filter(o=>nIsNew(o,st)).length;
 const act=feedItems().filter(e=>e.at>feedSeen&&e.by!==S.meId).length;
 b.hidden=!n&&!act;b.textContent=n?(n>99?"99+":n):"";b.classList.toggle("dot",!n&&!!act);
 $("bell").title=n?`${n} notificaç${n>1?"ões":"ão"} para ti`:"Notificações";
 const t=document.title.replace(/^\(\d+\+?\)\s*/,"");document.title=n?`(${n>99?"99+":n}) ${t}`:t;
 try{if(navigator.setAppBadge){n?navigator.setAppBadge(n):navigator.clearAppBadge()}}catch(e){}
 nPush()};
openFeed=function(){const F=$("feed");const st=nState();const mine=myNotifs(),ev=feedItems(),seen=feedSeen;const nNew=mine.filter(o=>nIsNew(o,st)).length,aNew=ev.filter(e=>e.at>seen&&e.by!==S.meId).length;
 const perm=("Notification" in window)?Notification.permission:"na";
 const rowMe=(o,i)=>{const k=NTY[o.ty]||NTY.mencao;return`<div class="fe nf${nIsNew(o,st)?" new":""}" data-nf="${i}"><span class="nic" style="--c:${k.c}">${o.by?esc(initials(nameOf(o.by))):k.g}</span><div><span>${o.by?`<b>${esc(nameOf(o.by))}</b> `:""}${esc(o.t)}</span>${o.d?`<q>${esc(o.d)}</q>`:""}<small>${o.ty==="prazo"?"Lembrete":fmtDate(o.at)}</small></div>${nIsNew(o,st)?'<i class="ndot"></i>':""}</div>`};
 const rowAct=(e,i)=>`<div class="fe${e.at>seen&&e.by!==S.meId?" new":""}" data-fe="${i}"><span class="ini" style="--h:${hue(e.by||"x")}">${esc(initials(nameOf(e.by)))}</span><div><b>${esc(nameOf(e.by))}</b> ${esc(e.t)}<small>${esc(e.code||"")}${e.code?" · ":""}${fmtDate(e.at)}</small></div></div>`;
 F.innerHTML=`<h4><span>Notificações</span><span class="nh">${nTab==="me"&&nNew?`<button class="linkb" id="nfAll">Marcar todas como lidas</button>`:""}<button class="linkb" id="feedX">Fechar</button></span></h4>
 <div class="ntabs"><button data-nt="me" class="${nTab==="me"?"on":""}">Para mim${nNew?` <b>${nNew}</b>`:""}</button><button data-nt="act" class="${nTab==="act"?"on":""}">Atividade da obra${aNew?` <b class="g">${aNew}</b>`:""}</button></div>
 ${perm==="default"&&nTab==="me"?`<div class="npush"><span>Recebe estes avisos também no ecrã do aparelho.</span><button class="btn sm primary" id="nfPush">Ativar</button></div>`:""}
 <div class="nlist">${nTab==="me"?(mine.map(rowMe).join("")||`<div class="empty">Sem notificações para ti.<br><small>Aparecem aqui quando alguém te identifica com @, te atribui uma tarefa, responde às tuas dúvidas ou um prazo chega.</small></div>`)
  :(ev.map(rowAct).join("")||`<div class="empty">Sem atividade ainda.</div>`)}</div>`;
 F.hidden=false;
 F.querySelectorAll("[data-nt]").forEach(b=>b.onclick=e=>{e.stopPropagation();nTab=b.dataset.nt;openFeed()});
 F.querySelectorAll("[data-nf]").forEach(el=>el.onclick=()=>{const o=mine[+el.dataset.nf];nMark([o.id]);F.hidden=true;nGo(o.go);renderBell()});
 F.querySelectorAll("[data-fe]").forEach(el=>el.onclick=()=>{const e=ev[+el.dataset.fe];F.hidden=true;if(e.item)openItem(e.item);else if(e.doc)openDoc(e.doc)});
 $("feedX").onclick=()=>{F.hidden=true};const ma=$("nfAll");if(ma)ma.onclick=e=>{e.stopPropagation();nMarkAll();openFeed();renderBell()};
 const np=$("nfPush");if(np)np.onclick=async e=>{e.stopPropagation();await nAskPush();openFeed()};
 if(nTab==="act"){feedSeen=now();try{localStorage.setItem("cp-feed-seen",feedSeen)}catch(x){}}
 renderBell()};
function nGo(g){if(!g)return;if(g.task){const t=S.issues.find(x=>x.id===g.task);if(t){showTaskOnPlan(t);setTimeout(()=>openTask(t.id),700)}}else if(g.item)openItem(g.item);else if(g.view)go(g.view)}

/* notificações do aparelho (enquanto a app está aberta ou em segundo plano) */
async function nAskPush(){if(!("Notification" in window)){toast("Este navegador não permite notificações. No iPhone, instala a app no ecrã principal primeiro.");return}
 const r=await Notification.requestPermission();if(r==="granted"){nPut("pushed",myNotifs().map(o=>o.id));toast("Notificações ativadas neste aparelho.");nShow({t:"Notificações ativadas",d:"Vais ver aqui os avisos do ObraFlow.",id:"test"})}
 else toast("Notificações bloqueadas. Podes ativá-las nas definições do navegador.")}
async function nShow(o){try{const title=o.by?`${nameOf(o.by)} ${o.t}`:o.t;const opt={body:o.d||(S.meta&&S.meta.name)||"ObraFlow",tag:o.id,icon:"icons/icon-192.png",badge:"icons/icon-192.png",data:{n:o.id,p:S.projectId}};
 const reg=navigator.serviceWorker&&await navigator.serviceWorker.getRegistration();if(reg&&reg.showNotification)await reg.showNotification(title,opt);else new Notification(title,opt)}catch(e){}}
let nPushT=0;
function nPush(){if(!("Notification" in window)||Notification.permission!=="granted"||!S.meId||!S.projectId||S.demo)return;clearTimeout(nPushT);nPushT=setTimeout(()=>{
 const pushed=nGet("pushed",null);const list=myNotifs();if(pushed===null){nPut("pushed",list.map(o=>o.id));return}
 const done=new Set(pushed),st=nState(),lim=new Date(Date.now()-2*864e5).toISOString();
 const fresh=list.filter(o=>!done.has(o.id)&&nIsNew(o,st)&&(o.ty==="prazo"||o.at>lim));fresh.slice(0,3).forEach(nShow);
 if(fresh.length)nPut("pushed",[...pushed,...fresh.map(o=>o.id)].slice(-500))},800)}
/* tocar numa notificação do aparelho abre o sítio certo */
if(navigator.serviceWorker)navigator.serviceWorker.addEventListener("message",e=>{const d=e.data||{};if(d.type!=="notif")return;const go1=()=>{const o=myNotifs().find(x=>x.id===d.n);if(o){nMark([o.id]);nGo(o.go);renderBell()}};
 if(d.p&&d.p!==S.projectId&&typeof openProject==="function"){openProject(d.p);setTimeout(go1,1500)}else go1()});
/* ao abrir o sino a partir do email/aparelho: #notificacoes */
window.addEventListener("hashchange",()=>{if(location.hash==="#notificacoes"&&S.meId){nTab="me";openFeed()}});

/* cartão nas Definições: notificações no aparelho */
function pushCard(){const ok="Notification" in window,perm=ok?Notification.permission:"na";
 return`<section class="block" id="pushCard"><h2>Notificações na plataforma</h2><p class="muted" style="margin:0 0 10px">O sino <b>🔔</b> no topo mostra o que é para ti: quando te identificam com @, te atribuem uma tarefa, respondem às tuas dúvidas, concluem uma tarefa tua ou um prazo chega.</p>
 <div class="toolrow"><span>${perm==="granted"?"✅ Avisos no ecrã deste aparelho: <b>ativos</b>":perm==="denied"?"⛔ Avisos no ecrã bloqueados no navegador (desbloqueia nas definições do site).":perm==="na"?"Este navegador não mostra avisos no ecrã (no iPhone: instala a app no ecrã principal).":"Avisos no ecrã deste aparelho: desligados"}</span>
 ${perm==="default"?`<button class="btn primary sm" id="pcOn">Ativar neste aparelho</button>`:perm==="granted"?`<button class="btn sm" id="pcTest">Enviar teste</button>`:""}</div>
 <small class="muted">Com a app fechada continuas a receber por email (ver “Notificações por email”).</small></section>`}
const renderPageN=renderPage;
renderPage=function(v){renderPageN(v);if(v!=="settings")return;const W=$("pageWrap");if(!W||$("pushCard"))return;const nc=[...W.querySelectorAll("section.block")].find(s=>/Notificações por email/i.test(s.querySelector("h2")?.textContent||""));
 const h=document.createElement("div");h.innerHTML=pushCard();const el=h.firstElementChild;if(nc)nc.before(el);else W.appendChild(el);
 const on=$("pcOn");if(on)on.onclick=async()=>{await nAskPush();renderPage("settings")};const ts=$("pcTest");if(ts)ts.onclick=()=>nShow({id:"t"+Date.now(),t:"Teste do ObraFlow",d:"As notificações estão a funcionar."})};

/* =========================================================
   ObraFlow · (1) Seleção múltipla: "todos" de uma vez
              (2) Captura de ecrã contínua: manter o ecrã escolhido e ler sozinho
                  cada etiqueta nova que aparecer nele (ex.: Fieldwire)
   ========================================================= */
/* ---------- 1) seleção múltipla: barra flutuante na planta ---------- */
(()=>{const v=$("viewer");if(!v)return;const b=document.createElement("div");b.className="mfloat";b.id="mFloat";b.hidden=true;v.appendChild(b)})();
function renderMFloat(){const b=$("mFloat");if(!b)return;if(!S.multi||S.view!=="obra"){b.hidden=true;return}b.hidden=false;
 const all=planItems(),vis=all.filter(i=>inFilter(i)&&matchQ(i)),noId=all.filter(i=>!String(i.devId||"").trim()),n=S.multi.size,allOn=all.length&&all.every(i=>S.multi.has(i.id));
 const k=[n,all.length,vis.length,noId.length,allOn].join("|");if(b.dataset.k===k)return;b.dataset.k=k;
 b.innerHTML=`<b>${n} selecionado${n===1?"":"s"}</b>
  <button type="button" class="btn sm ${allOn?"":"primary"}" data-mf="all">${allOn?"✓ Todos":"Selecionar todos"} (${all.length})</button>
  ${vis.length!==all.length?`<button type="button" class="btn sm" data-mf="vis">Só os filtrados (${vis.length})</button>`:""}
  ${noId.length&&noId.length!==all.length?`<button type="button" class="btn sm" data-mf="noid">Sem ID (${noId.length})</button>`:""}
  ${n?`<button type="button" class="btn sm" data-mf="none">Limpar</button>`:""}<button type="button" class="btn sm dark" data-mf="exit">Terminar</button>`;
 b.querySelectorAll("[data-mf]").forEach(x=>x.onclick=e=>{e.stopPropagation();const m=x.dataset.mf;
  if(m==="all"){if(allOn)S.multi.clear();else all.forEach(i=>S.multi.add(i.id))}else if(m==="vis")vis.forEach(i=>S.multi.add(i.id));else if(m==="noid"){S.multi.clear();noId.forEach(i=>S.multi.add(i.id))}
  else if(m==="none")S.multi.clear();else if(m==="exit")S.multi=null;const bb=$("bulkBar");if(bb)bb.dataset.k="";render()})}
["pointerdown","pointerup","click"].forEach(t=>document.addEventListener(t,e=>{if(e.target.closest&&e.target.closest("#mFloat")&&t!=="click")e.stopPropagation()},true));
const renderBulkW=renderBulk;renderBulk=function(){renderBulkW();renderMFloat();const a=$("bbAll");if(a&&S.multi){const n=planItems().length;a.textContent=`Selecionar todos (${n})`;
 a.onclick=()=>{planItems().forEach(i=>S.multi.add(i.id));$("bulkBar").dataset.k="";render()}}};
/* Ctrl+A na planta com a seleção múltipla ativa = todos */
document.addEventListener("keydown",e=>{if(!S.multi||S.view!=="obra"||e.target.matches("input,textarea,select"))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="a"){e.preventDefault();planItems().forEach(i=>S.multi.add(i.id));const bb=$("bulkBar");if(bb)bb.dataset.k="";render()}});

/* ---------- 2) captura de ecrã contínua ---------- */
let shotStream=null;   // ecrã partilhado da última captura
const WT={on:false,stream:null,video:null,r:null,timer:0,last:null,stable:0,busy:false,n:0,seen:new Set(),pending:null,lastId:"",fails:0};
let wKeep=(()=>{try{return localStorage.getItem("of-watch-keep")==="1"}catch(e){return false}})();
/* captura: o ecrã fica aberto até se decidir no recorte */
screenShot=async function(){const it=cur()||(WT.on?wTarget():null);if(!it&&!WT.on){toast("Seleciona primeiro um equipamento.");return}const id=it&&it.id;
 if($("dlgPhoto").open)$("dlgPhoto").close();
 if(!canShot){await pasteShot(id);return}
 let st=WT.on&&WT.stream&&WT.stream.active?WT.stream:null;
 if(!st){try{st=await navigator.mediaDevices.getDisplayMedia({video:{displaySurface:"window"},audio:false,selfBrowserSurface:"include",surfaceSwitching:"include"})}
  catch(e){if(!e||e.name!=="NotAllowedError")toast("Não foi possível capturar o ecrã neste navegador.");return}}
 try{const v=WT.on&&WT.video?WT.video:document.createElement("video");if(!WT.on){v.srcObject=st;v.muted=true;v.playsInline=true;await v.play();await new Promise(r=>setTimeout(r,400))}
  const cv=document.createElement("canvas");cv.width=v.videoWidth;cv.height=v.videoHeight;cv.getContext("2d").drawImage(v,0,0);
  if(!WT.on){shotStream={st,v}}openCrop(cv,id)}
 catch(e){toast("Não foi possível capturar o ecrã.");if(!WT.on)st.getTracks().forEach(t=>t.stop())}};
/* opção no recorte: manter o ecrã e ler sozinho */
(()=>{const acts=document.querySelector("#dlgCrop .acts");if(!acts)return;const w=document.createElement("label");w.className="wkeep";w.id="wKeepW";
 w.innerHTML=`<input type="checkbox" id="wKeep"><span><b>Manter este ecrã e ler automaticamente</b><small>Cada etiqueta nova que aparecer nesta zona é lida sozinha e o ID vai para o equipamento selecionado (ou para o próximo sem ID). Seleciona a zona onde aparece o ID.</small></span>`;
 acts.before(w);$("wKeep").checked=wKeep;$("wKeep").onchange=e=>{wKeep=e.target.checked;try{localStorage.setItem("of-watch-keep",wKeep?"1":"0")}catch(x){}}})();
const openCropW=openCrop;openCrop=function(cv,itemId,mode){openCropW(cv,itemId,mode);const w=$("wKeepW");if(w)w.hidden=!(shotStream&&(mode||"photo")==="photo")||WT.on};
const crUseBase=$("crUse").onclick,crCancelBase=$("crCancel").onclick;
$("crUse").onclick=async e=>{if(WT.zoneMode){WT.zoneMode=false;WT.r=crop&&crop.r||null;crop=null;$("dlgCrop").close();WT.last=frameSig();WT.cand=null;drawChip(WT.r?"zona atualizada":"ecrã inteiro","");WT.last=null;WT.stable=9;setTimeout(()=>tick(true),300);return}
 const keep=shotStream&&$("wKeep")&&$("wKeep").checked&&!$("wKeepW").hidden;const r=crop&&crop.r;const ss=shotStream;shotStream=null;
 await crUseBase(e);
 if(keep){startWatch(ss,r)}else if(ss&&!WT.on)ss.st.getTracks().forEach(t=>t.stop())};
$("crCancel").onclick=e=>{WT.zoneMode=false;const ss=shotStream;shotStream=null;crCancelBase(e);if(ss&&!WT.on)ss.st.getTracks().forEach(t=>t.stop())};
$("dlgCrop").addEventListener("close",()=>{if(shotStream&&!$("dlgCrop").open){const ss=shotStream;shotStream=null;if(!WT.on)ss.st.getTracks().forEach(t=>t.stop())}});
/* janela de estado (canto da planta) */
(()=>{const d=document.createElement("div");d.className="wchip";d.id="wChip";d.hidden=true;document.body.appendChild(d)})();
function drawChip(msg,kind){const d=$("wChip");if(!d)return;if(!WT.on){d.hidden=true;return}d.hidden=false;if(msg!=null)WT.msg=msg;if(kind!==undefined)WT.kind=kind;
 d.className="wchip"+(WT.kind?" w-"+WT.kind:"")+(WT.open?" open":"");const tgt=wTarget();
 const sub=WT.pending?`ID lido <b>${esc(WT.pending)}</b> — escolhe o equipamento`:tgt?`→ <b>${esc(tgt.code||"")}</b>`:"sem equipamentos sem ID";
 d.innerHTML=`<button class="wmain" id="wTog" title="Leitura do ecrã partilhado — tocar para ver opções"><span class="wdot"></span><span class="wtx"><b>Ecrã</b> ${WT.msg||"à espera de etiqueta nova"}</span><span class="wsub">${sub}</span></button>
  ${WT.pending&&cur()?`<button class="wb pri" id="wAssign" title="Atribuir ao selecionado">${esc(cur().code||"")}</button>`:""}
  <button class="wb" id="wNow" title="Ler agora"><svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4v4h4"/></svg></button>
  <button class="wb" id="wZone" title="Escolher a zona do ID"><svg viewBox="0 0 24 24"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg></button>
  <button class="wb stop" id="wStop" title="Parar a leitura do ecrã"><svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg></button>`;
 $("wTog").onclick=()=>{WT.open=!WT.open;drawChip()};$("wStop").onclick=stopWatch;$("wNow").onclick=()=>{WT.last=null;WT.stable=9;tick(true)};$("wZone").onclick=()=>{WT.zoneMode=true;screenShot()};
 const a=$("wAssign");if(a)a.onclick=()=>{const it=cur();if(it&&WT.pendingBlob){const b=WT.pendingBlob,v=WT.pending;WT.pending=null;WT.pendingBlob=null;applyShot(it,b,v)}}}
/* equipamento a preencher: o selecionado (se ainda não tiver ID) ou o próximo sem ID desta planta */
function wTarget(){const c=cur();if(c&&!String(c.devId||"").trim())return c;
 const hasId=i=>String(i.devId||"").trim();return nextOf(c?c.id:null,i=>!hasId(i)&&i.x!=null)||nextOf(null,i=>!hasId(i))}
async function startWatch(ss,r){if(!ss)return;WT.on=true;WT.stream=ss.st;WT.video=ss.v;WT.r=r||null;WT.last=null;WT.stable=0;WT.n=0;WT.seen=new Set(S.items.map(i=>String(i.devId||"").toUpperCase()).filter(Boolean));WT.fails=0;
 ss.st.getVideoTracks().forEach(t=>t.addEventListener("ended",stopWatch,{once:true}));
 // a captura que acabou de ser usada já conta como vista (não volta a ser lida)
 WT.last=frameSig();toast(r?"A ler a zona escolhida sempre que mudar.":"A ler o ecrã sempre que mudar (escolhe uma zona para ser mais rápido).");drawChip();
 clearInterval(WT.timer);WT.timer=setInterval(()=>tick(false),900)}
function stopWatch(){if(!WT.on)return;WT.on=false;clearInterval(WT.timer);try{WT.stream.getTracks().forEach(t=>t.stop())}catch(e){}WT.stream=null;WT.video=null;WT.pending=null;drawChip();toast(`Leitura do ecrã terminada${WT.n?` — ${WT.n} ID${WT.n>1?"s":""} registado${WT.n>1?"s":""}`:""}.`)}
function regionCanvas(maxW){const v=WT.video;if(!v||!v.videoWidth)return null;const r=WT.r||{x:0,y:0,w:1,h:1};
 const sx=Math.round(r.x*v.videoWidth),sy=Math.round(r.y*v.videoHeight),sw=Math.max(8,Math.round(r.w*v.videoWidth)),sh=Math.max(8,Math.round(r.h*v.videoHeight));
 const k=maxW?Math.min(1,maxW/sw):1;const cv=document.createElement("canvas");cv.width=Math.max(4,Math.round(sw*k));cv.height=Math.max(4,Math.round(sh*k));
 const cx=cv.getContext("2d",{willReadFrequently:true});cx.imageSmoothingQuality="high";cx.drawImage(v,sx,sy,sw,sh,0,0,cv.width,cv.height);return cv}
/* "assinatura" pequena da zona, para saber se mudou */
function frameSig(){const cv=regionCanvas(160);if(!cv)return null;const d=cv.getContext("2d").getImageData(0,0,cv.width,cv.height).data;const g=new Uint8Array(d.length/4);for(let i=0,j=0;i<d.length;i+=4,j++)g[j]=(d[i]*3+d[i+1]*6+d[i+2])/10;return g}
/* % de pontos que mudaram claramente (sensível a um código novo, insensível a ruído de vídeo) */
function sigDiff(a,b){if(!a||!b||a.length!==b.length)return 100;let n=0;for(let i=0;i<a.length;i++)if(Math.abs(a[i]-b[i])>40)n++;return n*100/a.length}
async function tick(force){if(!WT.on||WT.busy)return;if(!WT.stream||!WT.stream.active){stopWatch();return}
 const sig=frameSig();if(!sig)return;const d=sigDiff(sig,WT.last);
 if(!force){if(d>0.4){WT.cand=sig;WT.stable=0;WT.last=sig;drawChip("mudou… a estabilizar","busy");return}   // mudou: espera que estabilize
  if(!WT.cand)return;if(++WT.stable<1)return;WT.cand=null}
 WT.busy=true;try{drawChip("a ler a etiqueta…","busy");
  let cv=regionCanvas(0);if(Math.max(cv.width,cv.height)<900){const k=900/Math.max(cv.width,cv.height);const up=document.createElement("canvas");up.width=Math.round(cv.width*k);up.height=Math.round(cv.height*k);const c=up.getContext("2d");c.imageSmoothingQuality="high";c.drawImage(cv,0,0,up.width,up.height);cv=up}
  const blob=await new Promise(res=>cv.toBlob(res,"image/jpeg",.92));if(!blob)return;
  const r=await (WT.r?readCrop(blob):readOne(blob));let cands=r.cands||[];if(typeof refFix==="function"){try{cands=refFix(cands,null)}catch(e){}}
  let best=cands.filter(c=>c.k==="id").sort((a,b)=>b.s-a.s)[0];
  if(!best||best.s<6){WT.fails++;drawChip("não encontrei o ID","warn");
   if((force||WT.fails>=2)&&!WT.zoneAsked&&!$("dlgCrop").open){WT.zoneAsked=true;toast("Não encontrei o ID no ecrã — escolhe a zona onde ele aparece.");WT.zoneMode=true;screenShot()}return}
  WT.zoneAsked=false;
  WT.fails=0;WT.zoneAsked=false;const v=best.v.toUpperCase();
  if(WT.seen.has(v)||S.items.some(i=>String(i.devId||"").toUpperCase()===v)){const ex=S.items.find(i=>String(i.devId||"").toUpperCase()===v);drawChip(`${v} já registado${ex?" ("+esc(ex.code||"")+")":""}`,"warn");return}
  if(v===WT.lastId){drawChip(`${v} já lido`,"ok");return}
  const it=wTarget();if(!it){WT.pending=v;WT.pendingBlob=blob;drawChip(`li ${v}`,"warn");return}
  await applyShot(it,blob,v)}
 catch(e){drawChip("erro na leitura","warn")}finally{WT.busy=false}}
/* guarda a captura como foto do equipamento e regista o ID (pelo fluxo normal de leitura) */
async function applyShot(it,blob,v){WT.lastId=v;if(v)WT.seen.add(v);WT.n++;
 if(S.sel!==it.id)select(it.id);
 await addPhotos(it,[new File([blob],"captura.jpg",{type:"image/jpeg"})]);
 toast(`${v||"Captura"} → ${it.code||"equipamento"}`);
 // a seguir, o próximo sem ID fica selecionado para a próxima etiqueta
 setTimeout(()=>{const n=wTarget();if(n&&n.id!==it.id&&String((S.items.find(i=>i.id===it.id)||{}).devId||"").trim()){select(n.id);if(typeof centerOn==="function")centerOn(n)}drawChip(`${v||"—"} → ${esc(it.code||"")}`,"ok")},2500)}
setInterval(()=>{if(WT.on&&!WT.busy)drawChip()},4000);

/* com a leitura do ecrã ativa, marcar um equipamento novo não abre as opções de foto: lê logo o ecrã para ele */
const addItemW=addItem;addItem=async function(pt){if(!WT.on)return addItemW(pt);const dp=$("dlgPhoto"),sm=dp.showModal;dp.showModal=()=>{};try{await addItemW(pt)}finally{dp.showModal=sm}const it=cur();
 if(WT.pending&&WT.pendingBlob&&it){const b=WT.pendingBlob,v=WT.pending;WT.pending=null;WT.pendingBlob=null;applyShot(it,b,v);return}
 drawChip("a ler para "+esc(it?it.code:""),"busy");WT.last=null;WT.stable=9;setTimeout(()=>tick(true),250)};

boot();
