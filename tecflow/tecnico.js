/* =========================================================
   ObraFlow · Técnico — Manual, Calculadoras e Assistente (RTIEBT)
   Funciona sem rede: tudo o que está aqui (tabelas, regras, esquemas e o
   assistente) corre no aparelho, sem depender de outros sites.

   TABELAS: estão todas em TEC_DATA (abaixo), com a fonte de cada valor.
   Devem ser revistas pelo técnico responsável. A coordenação da obra pode
   exportar/importar uma versão corrigida (JSON) em Consultar → Tabelas e fontes,
   sem mexer no código.
   ========================================================= */
(function(){
"use strict";
const TEC_VERSION="2026-10";
/* nome da plataforma: "ObraFlow" dentro da gestão de obra; "TecFlow" na plataforma técnica separada */
const BRAND=(typeof window!=="undefined"&&window.TEC_BRAND)||"ObraFlow";
/* ---------------------------------------------------------
   1) TABELAS (fontes indicadas em cada uma)
   --------------------------------------------------------- */
const BASE={
 fontes:{
  rtiebt:"RTIEBT — Portaria n.º 949-A/2006 (alterada pela Portaria n.º 252/2015, secção 722 — VE)",
  iec52:"RTIEBT secção 52 / IEC 60364-5-52 (correntes admissíveis, fatores de correção)",
  utec:"Guia de cálculo de quedas de tensão (método UTE C 15-105, usado com as RTIEBT)",
  isep:"A. Gomes, H. Silva (ISEP) — «Instalações Elétricas de BT – Dimensionamento de Condutas», revista Neutro à Terra",
  proj:"Projeto tipo de instalação de utilização (habitação) segundo as RTIEBT — valores de prática corrente",
  hd308:"HD 308 S2 / RTIEBT 514 — identificação dos condutores por cores",
  hd21:"HD 21.3 / EN 50525-2-31 — condutores H07V (diâmetro exterior médio máximo)",
  iec61008:"EN/IEC 61008 e 61009 — interruptores e disjuntores diferenciais (tempos de disparo)",
  eredes:"E-REDES — escalões de potência contratada em BTN",
  iec434:"RTIEBT 434 / IEC 60364-4-43 — fator k para curto-circuito"
 },
 /* queda de tensão admissível (RTIEBT 525, instalações alimentadas pela rede pública de BT) */
 quedaMax:{iluminacao:3,outros:5,fonte:"rtiebt"},
 rho:{cu:0.0225,al:0.036,fonte:"utec",nota:"resistividade a usar no cálculo (≈1,25 × ρ a 20 °C)"},
 lambda:0.00008, // Ω/m (0,08 mΩ/m) reatância linear
 U0:230,U:400,
 seccoes:[1.5,2.5,4,6,10,16,25,35,50,70,95,120,150,185,240],
 /* correntes admissíveis (A), cobre, 30 °C ar ambiente — IEC 60364-5-52 quadros B.52.2 a B.52.5 */
 iz:{
  fonte:"iec52",
  metodos:{A1:"Condutores isolados em tubo embebido em parede termicamente isolante",A2:"Cabo multicondutor em tubo em parede termicamente isolante",
   B1:"Condutores isolados em tubo (à vista ou embebido em alvenaria) — caso habitual dos VD com H07V",B2:"Cabo multicondutor em tubo à vista ou calha",C:"Cabo fixado diretamente à parede ou ao teto"},
  pvc:{A1:{2:[14.5,19.5,26,34,46,61,80,99,119,151,182,210,240,273,321],3:[13.5,18,24,31,42,56,73,89,108,136,164,188,216,245,286]},
       A2:{2:[14,18.5,25,32,43,57,75,92,110,139,167,192,219,248,291],3:[13,17.5,23,29,39,52,68,83,99,125,150,172,196,223,261]},
       B1:{2:[17.5,24,32,41,57,76,101,125,151,192,232,269,300,341,400],3:[15.5,21,28,36,50,68,89,110,134,171,207,239,262,296,346]},
       B2:{2:[16.5,23,30,38,52,69,90,111,133,168,201,232,258,294,344],3:[15,20,27,34,46,62,80,99,118,149,179,206,225,255,297]},
       C:{2:[19.5,27,36,46,63,85,112,138,168,213,258,299,344,392,461],3:[17.5,24,32,41,57,76,96,119,144,184,223,259,299,341,403]}},
  xlpe:{A1:{2:[19,26,35,45,61,81,106,131,158,200,241,278,318,362,424],3:[17,23,31,40,54,73,95,117,141,179,216,249,285,324,380]},
       A2:{2:[18.5,25,33,42,57,76,99,121,145,183,220,253,290,329,386],3:[16.5,22,30,38,51,68,89,109,130,164,197,227,259,295,346]},
       B1:{2:[23,31,42,54,75,100,133,164,198,253,306,354,393,449,528],3:[20,28,37,48,66,88,117,144,175,222,269,312,342,384,450]},
       B2:{2:[22,30,40,51,69,91,119,146,175,221,265,305,334,384,459],3:[19.5,26,35,44,60,80,105,128,154,194,233,268,300,340,398]},
       C:{2:[24,33,45,58,80,107,138,171,209,269,328,382,441,506,599],3:[22,30,40,52,71,96,119,147,179,229,278,322,371,424,500]}}
 },
 /* fator de correção da temperatura ambiente (ar) */
 kt:{fonte:"iec52",t:[10,15,20,25,30,35,40,45,50,55,60],pvc:[1.22,1.17,1.12,1.06,1,0.94,0.87,0.79,0.71,0.61,0.5],xlpe:[1.15,1.12,1.08,1.04,1,0.96,0.91,0.87,0.82,0.76,0.71]},
 /* fator de agrupamento (circuitos agrupados / embebidos) */
 kg:{fonte:"iec52",n:[1,2,3,4,5,6,7,8,9,12,16,20],f:[1,0.8,0.7,0.65,0.6,0.57,0.54,0.52,0.5,0.45,0.41,0.38]},
 calibres:[6,10,13,16,20,25,32,40,50,63,80,100,125],
 /* prática corrente por tipo de circuito (habitação) */
 circuitos:{fonte:"proj",l:[
  {t:"Sinalização e comando",s:0.5,i:"—"},{t:"Iluminação, estores elétricos",s:1.5,i:10},
  {t:"Tomadas de uso geral (máx. 8 pontos por circuito)",s:2.5,i:16},{t:"Máquinas de lavar / secar, termoacumulador",s:2.5,i:16},
  {t:"Climatização (máx. 5 aparelhos por circuito)",s:2.5,i:16},{t:"Fogão / forno / placa",s:"4 ou 6",i:"20 ou 32"},{t:"Entrada (H07V-R/U em tubo ≥ 32 mm)",s:"≥ 6",i:"DCP"}]},
 entradas:{fonte:"proj",l:[[30,6],[45,10],[60,16]]},
 /* E-REDES — escalões BTN (kVA) */
 eredes:{fonte:"eredes",kva:[1.15,2.3,3.45,4.6,5.75,6.9,10.35,13.8,17.25,20.7,27.6,34.5,41.4],monoMax:10.35,triMin:6.9,
  nota:"Monofásica em regra até 10,35 kVA (há casos até 13,8 kVA); trifásica a partir de 6,9 kVA. Corrente do disjuntor de controlo = S / 230 V (mono) ou S / (√3 × 400 V) (tri)."},
 habitacao:{fonte:"proj",min:[[1,3.45],[6,6.9],[99,10.35]],especificas:[["Iluminação e tomadas de uso geral","25 VA/m²"],["Climatização elétrica","80 VA/m²"],["Máquina de lavar","3,3 kVA"],["Fogão elétrico","3 kVA (até 3 compart.), 4, 5 ou 8 kVA (6 ou mais)"],["Aquecimento de água","1,5 kVA (até 3), 2 kVA (4–5), 3 kVA (6 ou mais)"]]},
 /* H07V — diâmetro exterior médio máximo (mm) */
 dext:{fonte:"hd21",U:{1.5:3.3,2.5:3.9,4:4.4,6:5.0,10:6.4},R:{1.5:3.4,2.5:4.2,4:4.8,6:5.4,10:6.8,16:8.0,25:9.8,35:11.0,50:13.0,70:15.0,95:17.0,120:19.0,150:21.0,185:23.5,240:26.5}},
 /* tubos: diâmetro nominal → diâmetro interior de cálculo (mm). Confirmar na ficha do fabricante. */
 tubos:{fonte:"proj",dn:[12,16,20,25,32,40,50,63,75,90,110],di:[9.8,13.6,17.4,22.0,28.4,35.8,45.0,57.6,68.6,82.6,101.6]},
 ocupacao:{fonte:"isep",embebida:33,vista:40,coluna:20,colunaAumento:40,entradaMin:32},
 /* tubos VD em colunas e entradas — 1.º estabelecimento (diâmetro nominal, mm) */
 tuboColuna:{fonte:"isep",n:[1,2,3,4,5],l:{10:[32,32,32,40,40],16:[32,32,40,40,50],25:[32,40,50,50,63],35:[32,50,63,63,63],50:[40,50,63,75,75],70:[40,63,75,75,90],95:[50,63,90,90,90],120:[50,75,90,110,110],150:[63,90,110,110,110],185:[63,90,110,110,null],240:[75,110,null,null,null]}},
 dr:{fonte:"proj",ul:{geral:50,humido:25},sens:[{n:"Alta sensibilidade",v:[0.006,0.012,0.03]},{n:"Média",v:[0.1,0.3,0.5]},{n:"Baixa",v:[1,3,5,10,20]}],
  tempos:{fonte:"iec61008",l:[["IΔn","≤ 300 ms (tipo S: 130–500 ms)"],["2 × IΔn","≤ 150 ms (tipo S: 60–200 ms)"],["5 × IΔn","≤ 40 ms (tipo S: 50–150 ms)"],["0,5 × IΔn","não deve disparar"]]},
  tipos:[["AC","Correntes de defeito alternadas sinusoidais. Cargas resistivas simples."],["A","AC + contínua pulsante. Máquinas de lavar, placas de indução, eletrónica monofásica, carregadores de VE (mínimo exigido na secção 722)."],
   ["F","A + frequências mistas. Variadores de frequência monofásicos (bombas de calor, AVAC)."],["B","F + contínua lisa. Variadores trifásicos, carregadores de VE trifásicos sem deteção DC, alguns inversores fotovoltaicos."]]},
 kcc:{fonte:"iec434",l:[["Cobre / PVC",115],["Cobre / XLPE-EPR",143],["Alumínio / PVC",76],["Alumínio / XLPE-EPR",94]]},
 cores:{fonte:"hd308",l:[["Proteção (PE)","Verde/amarelo","#2e9d4b"],["Neutro (N)","Azul claro","#4f9ad6"],["Fase L1","Castanho","#7a4a21"],["Fase L2","Preto","#111"],["Fase L3","Cinzento","#8a8f94"]]},
 alturas:{fonte:"proj",l:[["Interruptores e comandos","1,10 – 1,20 m"],["Tomadas nas divisões principais","0,05 – 0,30 m"],["Tomadas de bancada da cozinha","1,10 – 1,20 m"],["Tomadas de casa de banho (fora dos volumes 0–2)","1,50 – 1,60 m"],["Pontos de carregamento de VE (bordo inferior)","0,50 – 1,50 m"]]},
 ip:{fonte:"proj",l:[["Locais secos em geral","IP20 / IK04"],["Casa de banho — volume 2","IP23 / IK04"],["Lavagem com jato, pátios, terraços descobertos","IP25 / IK04"],["Carregamento de VE no exterior","IPX4 (e IK07 em locais públicos)"]]}
};
let D=BASE;try{const o=S&&S.meta&&S.meta.tecData;if(o&&typeof o==="object")D=deepMerge(BASE,o)}catch(e){}
function deepMerge(a,b){if(Array.isArray(b)||typeof b!=="object"||!b)return b;const o={...a};for(const k of Object.keys(b))o[k]=k in a&&typeof a[k]==="object"&&!Array.isArray(a[k])?deepMerge(a[k],b[k]):b[k];return o}
const F=k=>D.fontes[k]||k;

/* ---------------------------------------------------------
   2) CÁLCULOS (puros; usados pelas calculadoras e pelo assistente)
   --------------------------------------------------------- */
const n2=(v,d=2)=>v==null||isNaN(v)?"—":Number(v).toLocaleString("pt-PT",{maximumFractionDigits:d,minimumFractionDigits:0});
const num=v=>{if(v==null)return NaN;const s=String(v).trim().replace(/\s/g,"").replace(",",".");return s===""?NaN:+s};
function corrente({sis,P,cos}){cos=cos||1;return sis==="tri"?P/(Math.sqrt(3)*D.U*cos):P/(D.U0*cos)}
function queda({sis="mono",I,L,S,mat="cu",cos=1,tipo="outros",lim}){const b=sis==="tri"?1:2,rho=D.rho[mat]||D.rho.cu,sin=Math.sqrt(Math.max(0,1-cos*cos));
 const dU=b*(rho*L/S*cos+D.lambda*L*sin)*I,pct=100*dU/D.U0,max=lim||D.quedaMax[tipo]||5;
 const kAm=(max/100*D.U0)/(b*(rho/S*cos+D.lambda*sin));
 const smin=D.seccoes.find(s=>100*b*(rho*L/s*cos+D.lambda*L*sin)*I/D.U0<=max)||null;
 return{dU,pct,max,ok:pct<=max,kAm,Lmax:kAm/I,smin,b,rho}}
function izDe({iso="pvc",met="B1",nc=2,S,t=30,ng=1}){const i=D.seccoes.indexOf(+S);const tab=((D.iz[iso]||{})[met]||{})[nc];if(i<0||!tab)return null;
 const kt=interp(D.kt.t,D.kt[iso],t),kg=step(D.kg.n,D.kg.f,ng);return{iz0:tab[i],kt,kg,iz:tab[i]*kt*kg}}
function interp(xs,ys,x){if(x<=xs[0])return ys[0];for(let i=1;i<xs.length;i++)if(x<=xs[i]){const t=(x-xs[i-1])/(xs[i]-xs[i-1]);return ys[i-1]+t*(ys[i]-ys[i-1])}return ys[ys.length-1]}
function step(xs,ys,x){let r=ys[0];for(let i=0;i<xs.length;i++)if(x>=xs[i])r=ys[i];return r}
function protecao({IB,S,iso="pvc",met="B1",nc=2,t=30,ng=1,dev="disj"}){const z=S?izDe({iso,met,nc,S,t,ng}):null;const lim=z?(dev==="fus"?0.9*z.iz:z.iz):null;
 const In=D.calibres.find(c=>c>=IB)||null;const ok=z&&In&&In<=lim+1e-9;
 const sug=D.seccoes.find(s=>{const zz=izDe({iso,met,nc,S:s,t,ng});if(!zz)return false;const l=dev==="fus"?0.9*zz.iz:zz.iz;return In&&In<=l+1e-9})||null;
 return{z,In,lim,ok,sug}}
function tubo({linhas,inst="embebida"}){let area=0;const det=[];for(const l of linhas){const d=l.d||(D.dext[l.tipo||"U"]||{})[l.s]||(D.dext.R||{})[l.s];if(!d||!l.n)continue;const a=l.n*Math.PI*d*d/4;area+=a;det.push({...l,d,a})}
 const pct=D.ocupacao[inst]||33;const need=area*100/pct;const T=D.tubos;let dn=null,di=null,occ=null;
 for(let i=0;i<T.dn.length;i++){const ai=Math.PI*T.di[i]*T.di[i]/4;if(ai>=need){dn=T.dn[i];di=T.di[i];occ=area/ai*100;break}}
 if(inst==="coluna"&&dn&&dn<D.ocupacao.entradaMin){dn=D.ocupacao.entradaMin;const i=T.dn.indexOf(dn);di=T.di[i];occ=area/(Math.PI*di*di/4)*100}
 const all=T.dn.map((x,i)=>({dn:x,occ:area/(Math.PI*T.di[i]*T.di[i]/4)*100}));
 return{area,need,pct,dn,di,occ,det,all}}
/* corte do tubo com os condutores (desenho à escala) */
function tuboSvg(r){const R=50,k=R/(r.di/2);const cs=[];r.det.forEach(l=>{for(let i=0;i<l.n;i++)cs.push(l.d/2*k)});
 const pts=[];cs.sort((a,b)=>b-a).forEach((c,i)=>{let best=null;for(let a=0;a<360&&!best;a+=7)for(let d=0;d<=R-c&&!best;d+=1.5){const x=60+Math.cos(a*Math.PI/180)*(R-c-d),y=60+Math.sin(a*Math.PI/180)*(R-c-d);if(pts.every(p=>Math.hypot(p.x-x,p.y-y)>=p.r+c-.3))best={x,y,r:c}}if(best)pts.push(best)});
 const col=["#7a4a21","#4f9ad6","#2e9d4b","#111","#8a8f94"];
 return`<svg class="ttubo" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="${R+5}" class="tt-w"/><circle cx="60" cy="60" r="${R}" class="tt-i"/>${pts.map((p,i)=>`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.r.toFixed(1)}" fill="${col[i%5]}" class="tt-c" style="animation-delay:${i*60}ms"/><circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(p.r*.55).toFixed(1)}" class="tt-cu"/>`).join("")}<text x="60" y="${R*2+20}" class="g-lb">VD ${r.dn}</text></svg>`}
function tuboTabela(S,n){const r=D.tuboColuna.l[S];return r?r[n-1]:null}
function eredes({kva,sis}){return{kva,I:sis==="tri"?kva*1000/(Math.sqrt(3)*D.U):kva*1000/D.U0}}
function escalao({P,sis}){const kva=P/1000;const l=D.eredes.kva.filter(k=>sis==="tri"?k>=D.eredes.triMin:k<=13.8);return l.find(k=>k>=kva-1e-9)||null}
function habMin(c){return(D.habitacao.min.find(x=>c<=x[0])||D.habitacao.min[D.habitacao.min.length-1])[1]}

/* ---------------------------------------------------------
   3) GUIA DE BOLSO (conteúdo de consulta + base do assistente)
   --------------------------------------------------------- */
const KB=[
 {id:"queda",t:"Queda de tensão máxima",k:"queda tensao maxima limite 3% 5% iluminacao outros usos percentagem",
  h:()=>`<p>Instalações alimentadas diretamente pela rede pública de BT (RTIEBT 525): <b>${D.quedaMax.iluminacao}%</b> nos circuitos de iluminação e <b>${D.quedaMax.outros}%</b> nos restantes usos, medida entre a origem da instalação e o ponto de utilização.</p>
   <p class="tf">ΔU = b × (ρ₁ × L / S × cos φ + λ × L × sen φ) × I<br><small>b = 2 monofásico, 1 trifásico · ρ₁ = ${n2(D.rho.cu,4)} Ω·mm²/m (Cu), ${n2(D.rho.al,3)} (Al) · λ = 0,08 mΩ/m · ΔU% = 100 × ΔU / ${D.U0} V</small></p>`,f:"rtiebt",calc:"qt"},
 {id:"fatork",t:"Fator K (A·m) — distância máxima",k:"fator k amperes metro am momento distancia maxima comprimento",h:()=>fatorKTable(),f:"utec",calc:"qt"},
 {id:"coord",t:"Coordenação proteção / cabo",k:"coordenacao protecao disjuntor fusivel ib in iz 1,45 sobrecarga calibre",
  h:()=>`<p>Proteção contra sobrecargas (RTIEBT 433): <b>I<sub>B</sub> ≤ I<sub>n</sub> ≤ I<sub>Z</sub></b> e <b>I₂ ≤ 1,45 × I<sub>Z</sub></b>.</p><ul><li><b>Disjuntores</b> (I₂ = 1,45 I<sub>n</sub>): basta I<sub>n</sub> ≤ I<sub>Z</sub>.</li><li><b>Fusíveis gG</b> (I₂ ≈ 1,6 I<sub>n</sub>): I<sub>n</sub> ≤ 0,9 × I<sub>Z</sub>.</li><li>I<sub>Z</sub> = corrente admissível do quadro × fator de temperatura × fator de agrupamento.</li></ul>
   <p><b>Curvas dos disjuntores:</b> B (3–5 I<sub>n</sub>) circuitos resistivos e cabos longos · C (5–10 I<sub>n</sub>) uso geral, motores pequenos · D (10–20 I<sub>n</sub>) transformadores, motores com arranque pesado.</p>`,f:"rtiebt",calc:"prot"},
 {id:"circ",t:"Secções e calibres por circuito (habitação)",k:"seccao minima calibre circuito iluminacao tomadas fogao maquina 1,5 2,5 10a 16a 8 pontos",
  h:()=>`<table class="tt2"><tr><th>Circuito</th><th>Secção mín.</th><th>Proteção</th></tr>${D.circuitos.l.map(c=>`<tr><td>${c.t}</td><td>${c.s} mm²</td><td>${c.i}${typeof c.i==="number"?" A":""}</td></tr>`).join("")}</table><p class="mut">Iluminação e tomadas: no máximo <b>8 pontos de utilização</b> por circuito. Climatização: no máximo 5 aparelhos.</p>`,f:"proj",calc:"prot"},
 {id:"entrada",t:"Entradas e colunas",k:"entrada coluna 6 mm2 tubo 32 mm dcp seccao entrada 30a 45a 60a",
  h:()=>`<ul><li>Secção mínima da entrada: <b>6 mm²</b> (H07V-R ou H07V-U).</li><li>Tubos de entrada de locais residenciais ou de uso profissional: diâmetro nominal <b>≥ ${D.ocupacao.entradaMin} mm</b>.</li><li>Ocupação em colunas e entradas (1.º estabelecimento): soma das secções exteriores ≤ <b>${D.ocupacao.coluna}%</b> da secção interior do tubo.</li></ul>
   <table class="tt2"><tr><th>DCP / corrente</th><th>Secção mínima</th></tr>${D.entradas.l.map(r=>`<tr><td>${r[0]} A</td><td>${r[1]} mm²</td></tr>`).join("")}</table>`,f:"proj",calc:"tubo"},
 {id:"tubos",t:"Tubos — regras de ocupação",k:"tubo tubos vd ocupacao 1/3 terco 40% 20% embebida vista enfiamento condutores diametro",
  h:()=>`<ul><li><b>Canalizações embebidas:</b> ocupação ≤ <b>${D.ocupacao.embebida}%</b> (≈ ⅓) da secção interior — facilita enfiar e desenfiar.</li><li><b>À vista:</b> ≤ <b>${D.ocupacao.vista}%</b>.</li><li><b>Colunas e entradas (1.º estabelecimento):</b> ≤ <b>${D.ocupacao.coluna}%</b>; em aumentos de potência admite-se até ${D.ocupacao.colunaAumento}%.</li><li>Entradas: tubo ≥ ${D.ocupacao.entradaMin} mm.</li></ul><p class="mut">A calculadora usa o diâmetro exterior médio máximo dos condutores (HD 21.3) e o diâmetro interior típico do tubo — confirma na ficha do fabricante.</p>`,f:"isep",calc:"tubo"},
 {id:"dr",t:"Diferenciais (DR / DDR)",k:"diferencial dr ddr 30 ma 300 ma sensibilidade resistencia terra ul 50 25 tipo a ac f b disparo tempo",
  h:()=>`<p>Condição de proteção (regime TT): <b>R<sub>A</sub> × I<sub>Δn</sub> ≤ U<sub>L</sub></b> — U<sub>L</sub> = 50 V (geral) ou 25 V (cozinhas, casas de banho, locais húmidos). Sempre que possível, R<sub>A</sub> ≤ 100 Ω.</p>${drTable()}
   <h5>Tipos</h5><table class="tt2">${D.dr.tipos.map(t=>`<tr><td><b>${t[0]}</b></td><td>${t[1]}</td></tr>`).join("")}</table>
   <h5>Tempos máximos de disparo (diferencial geral)</h5><table class="tt2">${D.dr.tempos.l.map(t=>`<tr><td>${t[0]}</td><td>${t[1]}</td></tr>`).join("")}</table><p class="mut">Tempos: ${F(D.dr.tempos.fonte)}</p>`,f:"proj"},
 {id:"ve",t:"Carregamento de veículos elétricos (secção 722)",k:"ve veiculo eletrico carregamento wallbox 722 portaria 252/2015 tipo a tipo b",
  h:()=>`<ul><li>Cada ponto de ligação: <b>circuito dedicado</b> e proteção contra sobreintensidades própria.</li><li>Cada ponto protegido individualmente por um <b>DR ≤ 30 mA</b> que corte todos os condutores ativos (incluindo neutro); <b>tipo A no mínimo</b>, tipo B quando aplicável (ex.: alimentação trifásica sem deteção DC no carregador).</li><li>Fator de simultaneidade 1 em circuitos de um só ponto (menor só com gestor de carga).</li><li>Tomada/conector fixos, bordo inferior a 0,5–1,5 m do pavimento. No exterior IPX4; em locais públicos IK07.</li><li>Recomendado descarregador de sobretensões no circuito de carregamento.</li></ul>`,f:"rtiebt"},
 {id:"cores",t:"Cores dos condutores",k:"cores cor condutor fase neutro terra pe azul castanho preto cinzento verde amarelo",
  h:()=>`<div class="tcores">${D.cores.l.map(c=>`<span><i style="background:${c[2]}${c[0].startsWith("Prot")?";background:repeating-linear-gradient(45deg,#2e9d4b 0 6px,#f2c618 6px 12px)":""}"></i><b>${c[0]}</b> ${c[1]}</span>`).join("")}</div><p class="mut">O verde/amarelo é exclusivo do condutor de proteção. O azul claro só pode ser usado como neutro (ou, sem neutro no circuito, como condutor ativo devidamente identificado nas extremidades).</p>`,f:"hd308"},
 {id:"h07v",t:"Checklist H07V (condutores isolados)",k:"h07v h07v-u h07v-r h07v-k h05v condutor rigido flexivel 450/750 70 graus checklist",
  h:()=>`<table class="tt2"><tr><td><b>H</b></td><td>Norma harmonizada</td></tr><tr><td><b>07</b></td><td>Tensão 450/750 V (05 = 300/500 V)</td></tr><tr><td><b>V</b></td><td>Isolamento PVC, 70 °C em serviço</td></tr><tr><td><b>-U</b></td><td>Rígido maciço (1 fio) — até 10 mm²</td></tr><tr><td><b>-R</b></td><td>Rígido multifilar (cableado)</td></tr><tr><td><b>-K</b></td><td>Flexível (classe 5) — quadros e ligações móveis</td></tr></table>
   <h5>Antes de fechar o circuito</h5><ul class="tchk"><li>Secção de acordo com o calibre da proteção e a queda de tensão</li><li>Cores corretas (verde/amarelo = PE; azul = N)</li><li>Tubo com ocupação ≤ ⅓ (embebido) e curvas sem esmagamento</li><li>H07V sempre dentro de tubo, calha ou quadro — nunca à vista sem proteção</li><li>Ligações apertadas ao binário do fabricante; ponteiras nos condutores -K</li><li>Condutor de proteção presente em todas as tomadas e aparelhos classe I</li><li>Circuito identificado no quadro (etiqueta) e no esquema</li></ul>`,f:"hd21"},
 {id:"alturas",t:"Alturas de montagem",k:"altura alturas interruptor tomada cozinha casa de banho montagem",h:()=>simpleT(D.alturas.l),f:"proj"},
 {id:"ip",t:"Índices de proteção (IP / IK)",k:"ip ik indice protecao casa de banho volume exterior agua poeira",h:()=>simpleT(D.ip.l),f:"proj"},
 {id:"pot",t:"Potências E-REDES (BTN)",k:"potencia contratada kva e-redes eredes btn disjuntor controlo dcp monofasico trifasico escalao",
  h:()=>`<table class="tt2"><tr><th>kVA</th><th>Monofásico (230 V)</th><th>Trifásico (400 V)</th></tr>${D.eredes.kva.map(k=>`<tr><td><b>${n2(k)}</b></td><td>${k<=13.8?n2(eredes({kva:k,sis:"mono"}).I,1)+" A":"—"}</td><td>${k>=D.eredes.triMin?n2(eredes({kva:k,sis:"tri"}).I,1)+" A":"—"}</td></tr>`).join("")}</table><p class="mut">${D.eredes.nota}</p>`,f:"eredes",calc:"pot"},
 {id:"hab",t:"Potência mínima de uma habitação",k:"potencia minima habitacao compartimentos t0 t1 t2 t3 t4 va/m2 previsao",
  h:()=>`<table class="tt2"><tr><th>Compartimentos</th><th>Potência mínima</th></tr><tr><td>1</td><td>3,45 kVA</td></tr><tr><td>2 a 6</td><td>6,9 kVA</td></tr><tr><td>mais de 6</td><td>10,35 kVA</td></tr></table>${simpleT(D.habitacao.especificas)}`,f:"proj",calc:"pot"},
 {id:"kcc",t:"Fator k (curto-circuito)",k:"curto circuito k 115 143 i2t s2 seccao termica",h:()=>`<p>Verificação térmica: <b>k² × S² ≥ I² × t</b> → S ≥ I × √t / k.</p>${simpleT(D.kcc.l.map(r=>[r[0],"k = "+r[1]]))}`,f:"iec434"},
 /* esquemas e automação (para o assistente encontrar) */
 {id:"esc",t:"Comutador de escada (2 pontos)",k:"comutador escada lustre 2 pontos dois lugares ligacao retorno ponte",go:["cons","esq","escada"]},
 {id:"inv",t:"Inversor de grupo (3 ou mais pontos)",k:"inversor cruzamento 3 pontos tres lugares corredor",go:["cons","esq","inversor"]},
 {id:"qe",t:"Quadro elétrico de habitação (QE)",k:"quadro eletrico qe unifilar disjuntor geral diferencial barramento terra montagem",go:["cons","esq","quadro"]},
 {id:"sens",t:"Sensor de movimento / fotocélula",k:"sensor movimento presenca fotocelula crepuscular detetor ligacao l n saida",go:["cons","esq","sensor"]},
 {id:"proto",t:"Protocolos de automação (KNX, DALI, Modbus…)",k:"knx dali modbus bacnet dmx mbus protocolo bus automacao domotica gtc",go:["cons","auto","tab"]}
];
function simpleT(l){return`<table class="tt2">${l.map(r=>`<tr><td>${r[0]}</td><td><b>${r[1]}</b></td></tr>`).join("")}</table>`}
function drTable(){const v=[0.03,0.1,0.3,0.5,1];return`<table class="tt2"><tr><th>I<sub>Δn</sub></th><th>R<sub>A</sub> máx. (50 V)</th><th>R<sub>A</sub> máx. (25 V)</th></tr>${v.map(i=>`<tr><td>${i<1?n2(i*1000)+" mA":i+" A"}</td><td>${n2(D.dr.ul.geral/i,0)} Ω</td><td>${n2(D.dr.ul.humido/i,0)} Ω</td></tr>`).join("")}</table>`}
function fatorKTable(){const ss=[1.5,2.5,4,6,10,16,25,35];const row=(sis,lim)=>ss.map(s=>n2(queda({sis,I:1,L:1,S:s,tipo:"outros",lim}).kAm,0));
 return`<p>Produto máximo <b>corrente × comprimento</b> (A·m) para não passar o limite, cobre, cos φ = 1. Distância máxima = K ÷ corrente.</p>
 <div class="tscroll"><table class="tt2 num"><tr><th>mm²</th>${ss.map(s=>`<th>${n2(s)}</th>`).join("")}</tr><tr><td>Mono 3%</td>${row("mono",3).map(x=>`<td>${x}</td>`).join("")}</tr><tr><td>Mono 5%</td>${row("mono",5).map(x=>`<td>${x}</td>`).join("")}</tr><tr><td>Tri 3%</td>${row("tri",3).map(x=>`<td>${x}</td>`).join("")}</tr><tr><td>Tri 5%</td>${row("tri",5).map(x=>`<td>${x}</td>`).join("")}</tr></table></div>
 <p class="mut">Ex.: 2,5 mm² monofásico a 5% → K ≈ ${n2(queda({sis:"mono",I:1,L:1,S:2.5,lim:5}).kAm,0)} A·m; com 16 A, distância máx. ≈ ${n2(queda({sis:"mono",I:16,L:1,S:2.5,lim:5}).Lmax,0)} m.</p>`}

/* ---------------------------------------------------------
   4) ESQUEMAS (SVG desenhado aqui — sem imagens externas)
   --------------------------------------------------------- */
const C={L:"#8a4b1f",N:"#2f7fd0",PE:"#2e9d4b",T:"#e8a317",K:"var(--ink,#1d2421)"};
const W=(d,c,w=3)=>`<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const Tx=(x,y,t,o="")=>`<text x="${x}" y="${y}" ${o} class="sv">${t}</text>`;
const dot=(x,y,c="#fff")=>`<circle cx="${x}" cy="${y}" r="4.5" fill="${c}" stroke="${C.K}" stroke-width="2"/>`;
const lamp=(x,y)=>`<circle cx="${x}" cy="${y}" r="16" fill="#fff8db" stroke="${C.K}" stroke-width="2.5"/>${W(`M${x-11} ${y-11}L${x+11} ${y+11}M${x+11} ${y-11}L${x-11} ${y+11}`,C.K,2.5)}`;
function comut(x,y,lab,pos=0,fl=0){const f=fl?-1:1;return`<rect x="${x-28}" y="${y-30}" width="56" height="60" rx="8" fill="var(--panel,#fff)" stroke="${C.K}" stroke-width="2"/>${dot(x-14*f,y+18)}${dot(x+14*f,y-18)}${dot(x+14*f,y+18)}${W(`M${x-14*f} ${y+18}L${x+12*f} ${pos?y+16:y-16}`,C.K,3)}${lab?Tx(x,y-38,lab,'text-anchor="middle"'):""}${Tx(x-14*f,y+44,"C",'text-anchor="middle"')}${Tx(x+(fl?-34:26),y-14,"1")}${Tx(x+(fl?-34:26),y+22,"2")}`}
function inver(x,y,lab){return`<rect x="${x-30}" y="${y-30}" width="60" height="60" rx="8" fill="var(--panel,#fff)" stroke="${C.K}" stroke-width="2"/>${dot(x-16,y-18)}${dot(x-16,y+18)}${dot(x+16,y-18)}${dot(x+16,y+18)}${W(`M${x-16} ${y-18}L${x+16} ${y+18}M${x-16} ${y+18}L${x+16} ${y-18}`,C.K,2.5)}${Tx(x,y-38,lab,'text-anchor="middle"')}`}
const legend=`<g class="svl">${[["Fase (L)",C.L],["Neutro (N)",C.N],["Retornos / pontes",C.T],["Terra (PE)",C.PE]].map((l,i)=>`<g transform="translate(${20+i*150},16)"><line x1="0" y1="0" x2="26" y2="0" stroke="${l[1]}" stroke-width="4"/>${Tx(34,5,l[0])}</g>`).join("")}</g>`;

const ESQ2={
 escada:{t:"Comutador de escada — 2 pontos de comando",
  svg:()=>`<svg viewBox="0 0 640 330" class="esq" role="img" aria-label="Esquema do comutador de escada">${legend}
   ${Tx(16,72,"L")}${W("M36 68H110V218H156",C.L)}
   ${comut(184,200,"Comutador 1")}
   ${W("M198 182V130H436V182",C.T)}${W("M198 218V262H436V218",C.T)}
   ${comut(450,200,"Comutador 2",1,1)}
   ${W("M464 218H540V176",C.L)}${lamp(540,160)}${W("M540 144V96",C.N)}${W("M540 96H600V300H36",C.N)}${Tx(16,304,"N")}
   ${Tx(300,122,"retorno 1",'text-anchor="middle"')}${Tx(300,282,"retorno 2",'text-anchor="middle"')}</svg>`,
  passos:["A fase (L) entra no borne comum (C) do comutador 1.","Os bornes 1 e 2 do comutador 1 ligam aos bornes 1 e 2 do comutador 2 — são os dois «retornos» (pontes).","O comum (C) do comutador 2 vai para a lâmpada.","O neutro (N) vai direto à lâmpada; o condutor de proteção (PE) liga à armadura se for classe I.","Teste: cada comutador deve acender e apagar, em qualquer posição do outro."],
  erros:["Ligar a fase a um borne 1/2 em vez do comum — a lâmpada só funciona numa combinação.","Passar o neutro pelo comutador (o comutador deve cortar sempre a fase).","Trocar o comum com um retorno no segundo comutador."],
  mat:"3 condutores entre comutadores (2 retornos + PE se necessário) · 1,5 mm² · proteção 10 A"},
 inversor:{t:"Inversor de grupo — 3 ou mais pontos de comando",
  svg:()=>`<svg viewBox="0 0 640 330" class="esq" role="img" aria-label="Esquema com inversor">${legend}
   ${Tx(16,72,"L")}${W("M36 68H90V218H122",C.L)}${comut(150,200,"Comutador")}
   ${W("M164 182V140H274V182",C.T)}${W("M164 218V258H274V218",C.T)}${inver(290,200,"Inversor")}
   ${W("M306 182V140H416V182",C.T)}${W("M306 218V258H416V218",C.T)}
   ${comut(430,200,"Comutador",1,1)}
   ${W("M444 218H540V176",C.L)}${lamp(540,160)}${W("M540 144V96H600V300H36",C.N)}${Tx(16,304,"N")}</svg>`,
  passos:["Nas pontas ficam sempre dois comutadores; no meio, um inversor por cada ponto de comando extra.","A fase entra no comum do primeiro comutador; o comum do último vai para a lâmpada.","Os dois retornos atravessam cada inversor (entrada por um lado, saída pelo outro).","Neutro direto à lâmpada.","Para muitos pontos (5 ou mais), considerar telerruptor com botões de pressão — menos condutores e mais simples de manter."],
  erros:["Ligar um retorno de entrada e um de saída do mesmo lado do inversor (o inversor não inverte).","Usar um inversor na ponta do circuito."],mat:"Retornos em 1,5 mm² · proteção 10 A"},
 quadro:{t:"Quadro elétrico de habitação (esquema unifilar tipo)",
  svg:()=>{const cs=[["Iluminação","10 A","1,5"],["Tomadas","16 A","2,5"],["Tomadas cozinha","16 A","2,5"],["Máq. lavar","16 A","2,5"],["Termo.","16 A","2,5"],["Fogão/placa","32 A","6"]];
   return`<svg viewBox="0 0 640 404" class="esq" role="img" aria-label="Esquema unifilar de quadro">
   ${Tx(20,30,"Rede E-REDES → contador → DCP (controlador de potência)")}${W("M60 40V70",C.L)}
   <rect x="30" y="70" width="60" height="44" rx="6" fill="var(--panel,#fff)" stroke="${C.K}" stroke-width="2"/>${Tx(60,96,"IG",'text-anchor="middle" font-weight="700"')}${Tx(100,90,"Interruptor geral / disjuntor geral (corte de todos os condutores ativos)")}
   ${W("M60 114V140",C.L)}<rect x="30" y="140" width="60" height="44" rx="6" fill="#eef6ff" stroke="${C.N}" stroke-width="2"/>${Tx(60,160,"DR",'text-anchor="middle" font-weight="700"')}${Tx(60,176,"30 mA",'text-anchor="middle" font-size="11"')}${Tx(100,160,"Diferencial 40 A / 30 mA (tipo A para máquinas e placas)")}
   ${W("M60 184V214H"+(60+(cs.length-1)*100),C.L)}
   ${cs.map((c,i)=>{const x=60+i*100;return`${W(`M${x} 214V236`,C.L)}<rect x="${x-26}" y="236" width="52" height="40" rx="6" fill="var(--panel,#fff)" stroke="${C.K}" stroke-width="2"/>${Tx(x,261,c[1],'text-anchor="middle" font-weight="700"')}${W(`M${x} 276V306`,C.L)}${Tx(x,322,c[0],'text-anchor="middle" font-size="12"')}${Tx(x,338,c[2]+" mm²",'text-anchor="middle" font-size="11" class="sv mutd"')}`}).join("")}
   ${W("M30 392H610",C.PE,4)}${Tx(30,380,"Barramento de terra (PE) — liga a todos os circuitos e ao elétrodo de terra",'font-size="12"')}</svg>`},
  passos:["Entrada → interruptor/disjuntor geral → diferencial(is) → disjuntores dos circuitos.","Separar os circuitos por diferenciais diferentes quando possível (ex.: iluminação num, tomadas noutro) para que um disparo não deixe a casa toda às escuras.","Neutro de cada circuito no mesmo diferencial da sua fase.","Barramento de terra ligado ao elétrodo e a todos os PE; medir a resistência de terra (R × IΔn ≤ 50 V).","Identificar cada circuito na porta do quadro e deixar o esquema dentro do quadro.","Descarregador de sobretensões (DST) recomendado em redes aéreas."],
  erros:["Neutro de um circuito ligado a outro diferencial (disparos «fantasma»).","Disjuntor de calibre superior ao permitido pela secção do cabo.","Barramento de terra sem ligação ao elétrodo."],mat:"Valores típicos — confirmar no projeto"},
 sensor:{t:"Sensor de movimento / fotocélula (crepuscular)",
  svg:()=>`<svg viewBox="0 0 640 320" class="esq" role="img" aria-label="Esquema de sensor">${legend}
   ${Tx(16,72,"L")}${W("M36 68H200V150",C.L)}${Tx(16,292,"N")}${W("M36 288H560V196",C.N)}${W("M260 288V190",C.N)}
   <rect x="180" y="130" width="120" height="70" rx="10" fill="var(--panel,#fff)" stroke="${C.K}" stroke-width="2"/>${Tx(240,122,"Sensor / fotocélula",'text-anchor="middle" font-weight="700"')}
   ${dot(200,150)}${dot(260,190)}${dot(280,150)}${Tx(194,176,"L")}${Tx(266,178,"N")}${Tx(286,146,"L'")}
   ${W("M280 150H560V164",C.L)}${lamp(560,180)}
   <g opacity=".85">${W("M120 68V100H400V150",C.L,2)}${W("M400 100",C.L,0)}<rect x="378" y="88" width="44" height="24" rx="5" fill="var(--panel,#fff)" stroke="${C.K}" stroke-width="1.5" stroke-dasharray="4 3"/>${Tx(400,82,"interruptor opcional (forçar ligado)",'text-anchor="middle" font-size="11"')}</g>
   ${Tx(560,226,"carga",'text-anchor="middle"')}</svg>`,
  passos:["L (fase) e N (neutro) alimentam o sensor.","A saída L' (contacto do relé) vai à lâmpada; o outro lado da lâmpada ao neutro.","Opcional: interruptor em paralelo com o sensor (entre L e L') para forçar a luz ligada.","Ajustar tempo (TIME), sensibilidade de luz (LUX) e alcance (SENS) depois de montado.","Fotocélula: virada a norte, longe da própria luz que comanda."],
  erros:["Ultrapassar a potência do contacto — LED tem picos de arranque; ver a potência máx. LED na ficha.","Montar o sensor virado para fontes de calor (radiadores, saídas de AVAC) — disparos falsos.","Esquecer o neutro em sensores de 3 fios."],mat:"1,5 mm² · proteção 10 A · IP adequado no exterior"}
};
/* ---------------------------------------------------------
   5) AUTOMAÇÃO
   --------------------------------------------------------- */
const PROTO=[
 {n:"KNX TP",uso:"Automação completa de edifícios: iluminação, estores, AVAC, cenas, alarmes técnicos",meio:"Par entrançado 2×2×0,8 mm (YCYM / J-Y(St)Y), SELV 30 V DC",vel:"9 600 bit/s",lim:"64 dispositivos por segmento (até 256 com repetidores); 1 000 m de cabo por segmento; 350 m fonte→dispositivo; 700 m entre dispositivos",top:"Linha, árvore, estrela (não em anel)",term:"Não",norma:"EN 50090 / ISO/IEC 14543"},
 {n:"DALI / DALI-2",uso:"Controlo e regulação de iluminação (drivers LED, balastros), sensores",meio:"2 fios sem polaridade; pode ir no mesmo cabo da energia (isolamento básico, não é SELV)",vel:"1 200 bit/s",lim:"64 endereços por linha, 16 grupos, 16 cenas; fonte ≤ 250 mA; queda ≤ 2 V → até 300 m com 1,5 mm²",top:"Livre (linha, árvore, estrela; não em anel)",term:"Não",norma:"IEC 62386"},
 {n:"Modbus RTU",uso:"Contadores de energia, analisadores, variadores, autómatos",meio:"RS-485, par entrançado blindado (120 Ω)",vel:"9 600 – 115 200 bit/s",lim:"32 cargas unitárias por segmento (até 247 endereços com repetidores); até 1 200 m",top:"Barramento (daisy-chain) — derivações curtas",term:"120 Ω nas duas pontas + polarização",norma:"Modbus.org / EIA-485"},
 {n:"Modbus TCP",uso:"Integração em rede IP: GTC, SCADA, gateways",meio:"Ethernet (cobre Cat 5e/6 ou fibra)",vel:"10/100/1000 Mbit/s",lim:"100 m por troço de cobre; porta TCP 502",top:"Estrela (switches)",term:"—",norma:"Modbus.org"},
 {n:"BACnet MS/TP · BACnet/IP",uso:"Gestão técnica centralizada (GTC/BMS), AVAC de grande porte",meio:"MS/TP: RS-485 · IP: Ethernet (UDP 47808)",vel:"MS/TP 9 600 – 76 800 bit/s",lim:"MS/TP: 32 nós por segmento, 1 200 m",top:"MS/TP barramento · IP estrela",term:"MS/TP: 120 Ω nas pontas",norma:"ISO 16484-5"},
 {n:"DMX512",uso:"Iluminação cénica, fachadas e LED RGB",meio:"RS-485, cabo 120 Ω (XLR ou RJ45)",vel:"250 kbit/s",lim:"512 canais por universo; 32 dispositivos por linha; ≈300 m recomendado",top:"Barramento (daisy-chain)",term:"120 Ω no último aparelho",norma:"ANSI E1.11"},
 {n:"M-Bus",uso:"Leitura de contadores (água, energia térmica, gás, eletricidade)",meio:"2 fios sem polaridade, alimenta os escravos",vel:"300 – 9 600 bit/s",lim:"Até 250 escravos por mestre; distâncias de centenas de metros a ≈1 km (depende do cabo e da velocidade)",top:"Livre (barramento, estrela, árvore)",term:"Não",norma:"EN 13757"}
];
/* detalhe de cada protocolo: exemplo, demonstração, vantagens, desvantagens, erros frequentes e site oficial */
const PX={
 "KNX TP":{url:"https://www.knx.org",site:"knx.org (KNX Association)",
  ex:"Escritório: a botoneira da sala envia «ligar» para o grupo 1/0/1; o atuador no quadro liga o circuito da iluminação. O sensor de presença apaga quando a sala fica vazia e a estação meteorológica recolhe os estores quando há vento.",
  demo:{n:["Fonte KNX 640 mA (com bobina)","Botoneira 1.1.3","Telegrama → grupo 1/0/1","Atuador 1.1.10","Iluminação"],p:["A fonte alimenta a linha com ≈ 29 V DC (vermelho +, preto −).","Ao carregar, a botoneira envia um telegrama para o endereço de grupo 1/0/1 «Luz sala ON».","Todos os dispositivos ouvem; só os que estão associados a 1/0/1 reagem — o atuador fecha o relé.","O atuador pode responder com o estado (1/0/101) para o visor ou a GTC."]},
  pro:["Norma aberta (EN 50090) — centenas de fabricantes compatíveis","Descentralizado: sem controlador central, uma avaria não pára o edifício","Uma só ferramenta (ETS) para todos os fabricantes","Cobre iluminação, estores, AVAC, energia e alarmes técnicos"],
  con:["Custo por ponto mais alto que soluções convencionais","Programação com ETS (licença paga) e formação","Velocidade baixa (9 600 bit/s) — não serve para vídeo ou dados pesados","Precisa de cabo de bus dedicado"],
  err:[["O dispositivo não aparece no ETS","Polaridade trocada ou falta de bus: medir 21–30 V DC nos bornes vermelho(+)/preto(−)."],["Tensão da linha baixa, falhas aleatórias","Demasiados dispositivos ou fonte pequena: máx. 64 por linha, dividir com acoplador de linha ou fonte maior."],
   ["Telegramas repetidos / colisões","Duas fontes muito próximas: manter ≥ 200 m de cabo entre fontes na mesma linha."],["Comportamento errático depois de alterações","Endereço físico duplicado: usar «Verificar endereço físico» no ETS."],
   ["Linha a falhar após ampliação","Foi fechado um anel: a topologia é livre mas sem anéis — abrir o laço."],["Interferências ou não conformidade","Respeitar a separação do cabo de energia (EN 50174) ou usar cabo KNX certificado com o isolamento indicado."]]},
 "DALI / DALI-2":{url:"https://www.dali-alliance.org",site:"dali-alliance.org (DiiA)",
  ex:"Open space com 40 luminárias LED: cada driver tem um endereço (0–63); 4 grupos por zona e cenas «reunião» e «limpeza». O sensor DALI-2 regula a luz pela luz do dia e a avaria de uma luminária aparece logo na GTC.",
  demo:{n:["Fonte / controlador DALI","DA+ DA− (no mesmo cabo 5G1,5)","Driver LED end. 0","Driver LED end. 1…63","Grupos e cenas"],p:["A fonte do bus dá ≈ 16 V (máx. 250 mA) — os dois fios DALI não têm polaridade.","O controlador endereça cada driver (endereço curto 0–63).","Comando «Grupo 2 → 60%»: todos os drivers do grupo 2 regulam ao mesmo tempo.","O controlador pergunta «avaria?» e o driver responde — manutenção sabe qual a luminária a trocar."]},
  pro:["Endereçamento individual e retorno de estado / avarias","Fios DALI sem polaridade e no mesmo cabo da alimentação","Regulação suave e cenas memorizadas nos próprios drivers","DALI-2 certificado: sensores e botões de fabricantes diferentes funcionam juntos"],
  con:["Só 64 endereços por linha (mais linhas = mais controladores)","Comunicação lenta (1 200 bit/s) — muitos comandos individuais atrasam","Não é SELV: os fios DALI precisam de isolamento como a rede","Equipamento DALI-1 antigo pode não ser totalmente compatível"],
  err:[["Luminárias não respondem a nada","Falta a fonte do bus ou está dupla (> 250 mA): confirmar uma só fonte e ≈ 16 V nos DA."],["Funciona perto e falha ao fundo da linha","Queda de tensão > 2 V: usar 1,5 mm² até 300 m e encurtar a linha."],
   ["Endereços trocados depois de substituir drivers","Endereços duplicados: fazer novo endereçamento só dos novos."],["Driver avariado na montagem","Foi ligada a fase (230 V) aos bornes DA: verificar antes de ligar."],["Regulação estranha ou sem regulação","Mistura de drivers 1–10 V / Push-dim com DALI: confirmar a referência do driver."]]},
 "Modbus RTU":{url:"https://modbus.org",site:"modbus.org (Modbus Organization)",
  ex:"Dez analisadores de energia nos quadros parciais ligados em série por RS-485 a um autómato/GTC, que lê de 5 em 5 s tensão, corrente e kWh de cada um.",
  demo:{n:["Mestre (GTC / autómato)","Pergunta: escravo 5 · função 03 · registo 3000","RS-485 em série (120 Ω nas pontas)","Analisador end. 5","Resposta: 2 registos = 231,4 V"],p:["Só o mestre fala por iniciativa própria — pergunta a um escravo de cada vez (polling).","Trama: endereço do escravo + função (03 = ler registos) + registo inicial + quantidade + CRC.","Só o escravo 5 responde, com os valores e o CRC.","O mestre passa ao escravo seguinte; com muitos escravos o ciclo fica mais lento."]},
  pro:["Simples, aberto e gratuito","Suportado por quase todos os contadores, analisadores e variadores","Barato e robusto: até 1 200 m em par entrançado","Fácil de diagnosticar com um conversor USB-RS485"],
  con:["Um só mestre e polling — lento com muitos equipamentos","Cada fabricante tem o seu mapa de registos (sem significado normalizado)","Sem segurança nem autenticação","Erros de configuração (paridade, ordem dos bytes) são frequentes"],
  err:[["Nenhum escravo responde","A/B trocados (os fabricantes não usam a mesma letra): trocar os dois fios e testar."],["Respostas intermitentes / erros de CRC","Terminação errada: 120 Ω só nas duas pontas do bus; confirmar polarização."],
   ["Funciona com um e falha com vários","Ligação em estrela ou derivações longas: refazer em série (daisy-chain)."],["Timeout em todos","Parâmetros diferentes: velocidade, paridade e stop bits iguais em todos."],
   ["Valores deslocados ou sem sentido","Registo base 0 vs 1 (tentar ±1) e ordem dos bytes/palavras nos valores float (word swap)."],["Ruído / avarias de portas","Laço de terra: ligar a blindagem à terra num só ponto."]]},
 "Modbus TCP":{url:"https://modbus.org",site:"modbus.org (Modbus Organization)",
  ex:"Gateway Modbus TCP no quadro geral: o SCADA lê pela rede IP os analisadores RS-485 ligados por trás da gateway.",
  demo:{n:["SCADA / GTC (cliente)","Rede IP · porta 502","Gateway (Unit ID = escravo)","Bus RS-485","Analisadores"],p:["O cliente abre uma ligação TCP à porta 502 do servidor.","Envia a mesma pergunta Modbus (sem CRC) com o Unit ID.","A gateway traduz para RTU e devolve a resposta.","Vários clientes podem ler ao mesmo tempo."]},
  pro:["Usa a rede Ethernet existente","Rápido e com vários clientes em simultâneo","Mesmo modelo de dados do Modbus RTU","Fácil de integrar em SCADA e IoT"],
  con:["Sem segurança nativa (porta 502 aberta)","Precisa de IP fixo e gestão de rede","Mapa de registos continua a ser do fabricante","100 m máximo por troço de cobre"],
  err:[["Sem ligação","IP, máscara ou gateway de rede errados; testar com ping."],["Liga mas não lê através da gateway","Unit ID errado (deve ser o endereço do escravo RTU)."],["Bloqueado na rede da empresa","Firewall a bloquear a porta 502: pedir regra à informática."],["Timeouts com muitos pedidos","Reduzir a frequência ou agrupar registos num só pedido."]]},
 "BACnet MS/TP · BACnet/IP":{url:"https://bacnet.org",site:"bacnet.org (ASHRAE SSPC 135)",
  ex:"Chillers, UTA e quadros de AVAC integrados na GTC: cada equipamento expõe objetos (temperatura de ida = Analog Input, ordem de marcha = Binary Output) com alarmes e horários.",
  demo:{n:["GTC (BACnet/IP)","Router / BBMD","Bus MS/TP (RS-485)","Controlador UTA (Device 1201)","Objetos AI/AO/BI/BO"],p:["A GTC descobre os equipamentos com «Who-Is» / «I-Am».","Lê propriedades dos objetos (ex.: AI-1 Present_Value = 7,2 °C).","Pode subscrever alterações (COV) em vez de perguntar sempre.","Alarmes, calendários e tendências são normalizados."]},
  pro:["Modelo de dados rico e normalizado (objetos e propriedades)","Norma ISO 16484-5, independente do fabricante","Alarmes, horários e tendências nativos","IP e RS-485 na mesma rede com routers"],
  con:["Mais complexo de configurar","MS/TP é lento em redes grandes","Atravessar sub-redes IP exige BBMD","Equipamentos suportam partes diferentes da norma (ver PICS)"],
  err:[["Equipamentos aparecem e desaparecem","Device Instance duplicado: cada dispositivo com número único na rede."],["MS/TP muito lento ou parado","MAC duplicado ou «Max Master» mal configurado; mesma velocidade em todos."],["GTC não vê equipamentos noutra sub-rede","Configurar BBMD / Foreign Device."],["Erros no bus MS/TP","Terminação e polarização nas pontas, como no RS-485."]]},
 "DMX512":{url:"https://tsp.esta.org",site:"ESTA Technical Standards (ANSI E1.11)",
  ex:"Fachada com 50 projetores LED RGB: cada um usa 3 canais (R, G, B) → 150 canais num universo; a consola ou o controlador corre cenas e efeitos.",
  demo:{n:["Controlador DMX","Universo 1 (512 canais)","Projetor 1 · canais 1–3","Projetor 2 · canais 4–6","…terminador 120 Ω"],p:["O controlador envia continuamente os 512 canais (≈ 44 vezes por segundo).","Cada aparelho lê os canais a partir do seu endereço inicial.","O último aparelho da linha leva terminador de 120 Ω.","Com RDM (E1.20) é possível configurar endereços à distância."]},
  pro:["Muito simples e rápido para efeitos de luz","Padrão no espetáculo e na iluminação arquitetural","Equipamento barato e abundante","512 canais por universo, vários universos por Art-Net/sACN"],
  con:["Só num sentido (sem retorno, exceto RDM)","Sem deteção de erros nem endereçamento automático","Sensível a interferências e a cabo errado","Máx. 32 aparelhos por linha sem splitter"],
  err:[["Luzes a piscar ou a mudar sozinhas","Falta o terminador de 120 Ω no último aparelho."],["Falhas com cabos longos","Cabo de microfone (impedância errada): usar cabo DMX/dados de 120 Ω."],["Uma parte da instalação não funciona","Derivações em Y: usar splitter DMX para ramificar."],["Dois aparelhos fazem o mesmo","Endereços iniciais sobrepostos: rever a tabela de canais."]]},
 "M-Bus":{url:"https://m-bus.com",site:"m-bus.com (documentação M-Bus / EN 13757)",
  ex:"Leitura de 120 contadores de água e energia térmica de um edifício: o mestre M-Bus lê todos de hora a hora e envia para a plataforma de gestão.",
  demo:{n:["Mestre M-Bus (concentrador)","2 fios sem polaridade (alimentam os contadores)","Contador água end. 12","Contador térmico end. 13","Leitura → plataforma"],p:["O mestre alimenta o bus e pergunta a cada contador pelo endereço primário ou secundário (n.º de série).","O contador responde com os registos (volume, energia, data).","Muitos contadores funcionam anos sem bateria graças à alimentação pelo bus.","Os dados seguem por IP ou Modbus para a gestão."]},
  pro:["Os contadores são alimentados pelo bus","Sem polaridade e topologia livre","Norma europeia para contagem (EN 13757)","Muitos fabricantes de contadores"],
  con:["Lento — feito para leituras periódicas","Distância limitada pela capacidade do cabo","O mestre tem de ser dimensionado ao número de cargas","Só leitura, pouco controlo"],
  err:[["Alguns contadores não respondem","Mestre subdimensionado (cargas unitárias) — usar mestre maior ou repetidor."],["Erros com cabo longo","Capacidade do cabo alta: baixar a velocidade (ex.: 2 400 bit/s) ou usar cabo melhor."],["Dois contadores com o mesmo endereço","Ler pelo endereço secundário (n.º de série) ou reendereçar."],["Um contador específico não lê","Velocidade do contador diferente da do mestre."]]}
};
/* demonstração animada: os blocos em sequência e um «pacote» a percorrer a linha */
function demoSvg(n){return demoOne(n,false)+demoOne(n,true)}
function demoOne(n,V){const wrap=(t,m)=>{const w=t.split(" ");const L=[""];w.forEach(x=>{if((L[L.length-1]+" "+x).trim().length>m)L.push(x);else L[L.length-1]=(L[L.length-1]+" "+x).trim()});return L.slice(0,3)};
 if(!V){const W=640,bw=112,gap=(W-20-bw*n.length)/(n.length-1),y=46;const xs=n.map((_,i)=>10+i*(bw+gap));const path=`M${xs[0]+bw/2} ${y}H${xs[xs.length-1]+bw/2}`;
  return`<svg class="pdemo h" viewBox="0 0 ${W} 100" role="img"><path d="${path}" class="pd-l"/><circle r="6" class="pd-p"><animateMotion dur="3.2s" repeatCount="indefinite" path="${path}"/></circle><circle r="6" class="pd-p b"><animateMotion dur="3.2s" begin="1.6s" repeatCount="indefinite" path="${path}"/></circle>
  ${n.map((t,i)=>`<g><rect x="${xs[i]}" y="${y-30}" width="${bw}" height="60" rx="10" class="pd-b${i===0?" a":i===n.length-1?" z":""}"/>${wrap(t,17).map((l,k,a)=>`<text x="${xs[i]+bw/2}" y="${y-((a.length-1)*7)+k*14+4}" class="pd-t">${esc(l)}</text>`).join("")}</g>`).join("")}</svg>`}
 const H=62,gap=22,W=300,bw=240,x0=30;const ys=n.map((_,i)=>8+i*(H+gap));const tot=ys[ys.length-1]+H+8;const path=`M${W/2} ${ys[0]+H/2}V${ys[ys.length-1]+H/2}`;
 return`<svg class="pdemo v" viewBox="0 0 ${W} ${tot}" role="img"><path d="${path}" class="pd-l"/><circle r="6" class="pd-p"><animateMotion dur="3.2s" repeatCount="indefinite" path="${path}"/></circle>
  ${n.map((t,i)=>`<g><rect x="${x0}" y="${ys[i]}" width="${bw}" height="${H}" rx="10" class="pd-b${i===0?" a":i===n.length-1?" z":""}"/><text x="${x0+12}" y="${ys[i]+18}" class="pd-n">${i+1}</text>${wrap(t,26).map((l,k,a)=>`<text x="${W/2}" y="${ys[i]+H/2-((a.length-1)*8)+k*16+5}" class="pd-t v">${esc(l)}</text>`).join("")}</g>`).join("")}</svg>`}
function protoDetail(p){const x=PX[p.n]||{};return`<div class="pdx">
 <div class="pdtabs" data-pd>${[["car","Características"],["ex","Exemplo"],["demo","Demonstração"],["pc","Vantagens / desvantagens"],["err","Erros frequentes"]].map((t,i)=>`<button type="button" data-pdt="${t[0]}" class="${i===0?"on":""}">${t[1]}</button>`).join("")}</div>
 <div class="pdp" data-pdp="car"><table class="tt2">${[["Uso típico",p.uso],["Meio / cabo",p.meio],["Velocidade",p.vel],["Limites",p.lim],["Topologia",p.top],["Terminação",p.term],["Norma",p.norma]].map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join("")}</table></div>
 <div class="pdp" data-pdp="ex" hidden><p class="pdex">${x.ex||"—"}</p></div>
 <div class="pdp" data-pdp="demo" hidden>${x.demo?demoSvg(x.demo.n)+`<ol class="pdst">${x.demo.p.map(s=>`<li>${s}</li>`).join("")}</ol>`:"—"}</div>
 <div class="pdp" data-pdp="pc" hidden><div class="pdpc"><div class="pro"><h5>Vantagens</h5><ul>${(x.pro||[]).map(s=>`<li>${s}</li>`).join("")}</ul></div><div class="con"><h5>Desvantagens</h5><ul>${(x.con||[]).map(s=>`<li>${s}</li>`).join("")}</ul></div></div></div>
 <div class="pdp" data-pdp="err" hidden><div class="pderr">${(x.err||[]).map(e=>`<div><b>⚠ ${e[0]}</b><span>✔ ${e[1]}</span></div>`).join("")}</div></div>
 ${x.url?`<a class="btn sm pdmore" href="${x.url}" target="_blank" rel="noopener">Ler mais — ${esc(x.site)} ↗</a><span class="mut"> (abre o site oficial; precisa de rede)</span>`:""}</div>`}
function wireProto(root){root.querySelectorAll("[data-pd]").forEach(t=>t.querySelectorAll("[data-pdt]").forEach(b=>b.onclick=()=>{const box=t.parentElement;t.querySelectorAll("[data-pdt]").forEach(x=>x.classList.toggle("on",x===b));box.querySelectorAll("[data-pdp]").forEach(p=>p.hidden=p.dataset.pdp!==b.dataset.pdt)}))}
const SELEC=[
 {q:"Regular a luz (dimming) e cenas de iluminação",r:["DALI / DALI-2","KNX TP"],p:"DALI para a iluminação; ligar ao KNX por gateway se houver mais sistemas."},
 {q:"Automação completa (luz, estores, AVAC, cenas) num edifício",r:["KNX TP"],p:"KNX como espinha dorsal; DALI nas luminárias através de gateway KNX-DALI."},
 {q:"Ler contadores e analisadores de energia",r:["Modbus RTU","M-Bus"],p:"Modbus RTU para analisadores elétricos; M-Bus para contadores de água/térmica."},
 {q:"Integrar tudo numa gestão técnica (GTC/BMS)",r:["BACnet MS/TP · BACnet/IP","Modbus TCP"],p:"Rede IP dedicada; gateways de KNX/DALI/Modbus para BACnet/IP."},
 {q:"Fachadas e LED RGB com efeitos",r:["DMX512"],p:"DMX512 com divisores (splitters) para ramificar e terminação no fim de cada linha."},
 {q:"Pequena reabilitação sem passar cabos",r:["—"],p:"Soluções sem fios (Zigbee, Thread/Matter, KNX RF) — confirmar alcance e alimentação dos sensores."}
];
const TOPO={
 bus:{t:"Barramento (daisy-chain)",p:"RS-485: Modbus RTU, BACnet MS/TP, DMX512. Terminação de 120 Ω nas duas pontas; derivações curtas.",
  svg:()=>`<svg viewBox="0 0 520 120" class="esq sm">${W("M30 60H490",C.K,3)}${[90,190,290,390].map(x=>`<rect x="${x-24}" y="22" width="48" height="26" rx="5" fill="var(--panel,#fff)" stroke="${C.K}" stroke-width="2"/>${W(`M${x} 48V60`,C.K,2)}`).join("")}<rect x="16" y="50" width="16" height="20" fill="${C.T}"/><rect x="488" y="50" width="16" height="20" fill="${C.T}"/>${Tx(24,96,"120 Ω",'text-anchor="middle" font-size="11"')}${Tx(496,96,"120 Ω",'text-anchor="middle" font-size="11"')}</svg>`},
 arvore:{t:"Linha / árvore",p:"KNX TP e DALI: topologia livre em árvore; sem anéis fechados. KNX: áreas → linhas → dispositivos.",
  svg:()=>`<svg viewBox="0 0 520 150" class="esq sm">${W("M260 20V60M100 60H420M100 60V100M260 60V100M420 60V100M60 100H140M220 100H300M380 100H460",C.K,3)}${[60,140,220,300,380,460].map(x=>`<rect x="${x-20}" y="104" width="40" height="22" rx="5" fill="var(--panel,#fff)" stroke="${C.K}" stroke-width="2"/>`).join("")}<rect x="236" y="4" width="48" height="20" rx="5" fill="${C.T}"/>${Tx(260,18,"fonte",'text-anchor="middle" font-size="11"')}</svg>`},
 estrela:{t:"Estrela",p:"Ethernet (Modbus TCP, BACnet/IP, KNX IP): cada equipamento com o seu cabo até ao switch (≤ 100 m).",
  svg:()=>`<svg viewBox="0 0 520 150" class="esq sm">${[[80,30],[80,120],[440,30],[440,120],[260,130]].map(p=>`${W(`M260 70L${p[0]} ${p[1]}`,C.K,3)}<rect x="${p[0]-20}" y="${p[1]-11}" width="40" height="22" rx="5" fill="var(--panel,#fff)" stroke="${C.K}" stroke-width="2"/>`).join("")}<rect x="230" y="56" width="60" height="28" rx="6" fill="${C.T}"/>${Tx(260,75,"switch",'text-anchor="middle" font-size="12"')}</svg>`},
 anel:{t:"Anel",p:"Não permitido em KNX TP nem em DALI. Usado só em redes industriais com redundância (ex.: Ethernet com protocolo de anel).",
  svg:()=>`<svg viewBox="0 0 520 150" class="esq sm"><ellipse cx="260" cy="75" rx="200" ry="52" fill="none" stroke="${C.K}" stroke-width="3" stroke-dasharray="8 6"/>${[[60,75],[260,23],[460,75],[260,127]].map(p=>`<rect x="${p[0]-20}" y="${p[1]-11}" width="40" height="22" rx="5" fill="var(--panel,#fff)" stroke="${C.K}" stroke-width="2"/>`).join("")}${W("M236 64L284 86M284 64L236 86",C.L,4)}</svg>`}
};

/* ---------------------------------------------------------
   6) ESTADO E UI
   --------------------------------------------------------- */
const ICO={
 qt:'<path d="M3 12c2.5-6 5.5-6 8 0s5.5 6 8 0"/><path d="M19 4v6m0 0-2.5-2.5M19 10l2.5-2.5"/>',
 tubo:'<circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="2"/><circle cx="15" cy="10" r="2"/><circle cx="12" cy="15.2" r="2"/>',
 prot:'<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M12 7v5"/><rect x="9.5" y="12" width="5" height="4" rx="1"/>',
 pot:'<path d="M4 17a8 8 0 1 1 16 0"/><path d="m12 17 4-6"/><path d="M7 17h0M17 17h0"/>',
 guia:'<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6a3 3 0 0 0-3 3"/><path d="M20 4v14h-7"/>',
 esq:'<circle cx="5" cy="12" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 12h4l6-6M11 12l6 6"/>',
 auto:'<rect x="9" y="3" width="6" height="5" rx="1"/><rect x="3" y="16" width="6" height="5" rx="1"/><rect x="15" y="16" width="6" height="5" rx="1"/><path d="M12 8v4M6 16v-4h12v4"/>',
 ia:'<path d="M4 5h16v11H9l-5 4z"/><path d="m13 7-3 4h4l-3 4"/>',
 inicio:'<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/>',calc:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M8 18h2M12 18h4"/>',cons:'<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6a3 3 0 0 0-3 3"/><path d="M20 4v14h-7"/>'};
const ic=k=>`<svg viewBox="0 0 24 24" aria-hidden="true" class="tic">${ICO[k]||""}</svg>`;
/* mostrador analógico (0 → max; zona verde até ao limite) */
function gauge(v,lim,max,unit,lab){const cl=x=>Math.max(0,Math.min(1,x/max));const P=t=>{const a=Math.PI*(1-t);return[60+48*Math.cos(a),60-48*Math.sin(a)]};const arc=(t0,t1)=>{const[a,b]=P(t0),[c,d]=P(t1);return`M${a.toFixed(1)} ${b.toFixed(1)}A48 48 0 0 1 ${c.toFixed(1)} ${d.toFixed(1)}`};
 const tl=lim!=null?cl(lim):1,tv=cl(v),ang=-90+180*tv,over=lim!=null&&v>lim;
 return`<svg class="tgauge" viewBox="0 0 120 74" aria-hidden="true"><path d="${arc(0,1)}" class="g-bg"/><path d="${arc(0,tl)}" class="g-ok"/>${lim!=null&&tl<1?`<path d="${arc(tl,1)}" class="g-bad"/>`:""}
  ${[0,.25,.5,.75,1].map(t=>{const[a,b]=P(t),[c,d]=[60+(a-60)*.82,60+(b-60)*.82];return`<line x1="${a.toFixed(1)}" y1="${b.toFixed(1)}" x2="${c.toFixed(1)}" y2="${d.toFixed(1)}" class="g-tk"/>`}).join("")}
  <g class="g-nd${over?" over":""}" style="--a:${ang.toFixed(1)}deg"><line x1="60" y1="60" x2="60" y2="18"/><circle cx="60" cy="60" r="5"/></g>
  <text x="60" y="72" class="g-lb">${lab||""}</text><text x="10" y="72" class="g-mm">0</text><text x="110" y="72" class="g-mm" text-anchor="end">${n2(max,0)}${unit||""}</text></svg>`}
const st={tab:"inicio",sub:{calc:"qt",cons:"guia",auto:"tab",esq:"escada"},guia:null,pre:{},ctx:null,chat:[]};
const HKEY="of-tec-hist";
const hist=()=>{try{return JSON.parse(localStorage.getItem(HKEY)||"[]")}catch(e){return[]}};
const histAdd=h=>{try{localStorage.setItem(HKEY,JSON.stringify([h,...hist()].slice(0,30)))}catch(e){}};
const TABS=[["inicio","Início"],["calc","Calcular"],["cons","Consultar"],["ia","Assistente"]];
const CALCS=[["qt","Queda de tensão","ΔU %"],["tubo","Ocupação de tubos","VD"],["prot","Proteções / amperagem","IZ"],["pot","Potências E-REDES","kVA"]];
const CONS=[["guia","Guia de bolso"],["banc","Bancada de ligações"],["esq","Esquemas"],["auto","Automação"],["seg","Segurança (SADI)"],["tab","Tabelas e fontes"]];
let root=null;
function render(Wr,opts){root=Wr;try{D=S.meta&&S.meta.tecData&&typeof S.meta.tecData==="object"?deepMerge(BASE,S.meta.tecData):BASE}catch(e){D=BASE}if(opts){if(opts.tab)st.tab=opts.tab;if(opts.sub)st.sub[opts.tab==="cons"?"cons":"calc"]=opts.sub;if(opts.pre)st.pre=opts.pre;if(opts.ctx!==undefined)st.ctx=opts.ctx;if(opts.q){st.tab="ia";setTimeout(()=>ask(opts.q),50)}if(opts.esq){st.sub.esq=opts.esq}if(opts.auto)st.sub.auto=opts.auto}
 const ctx=st.ctx?`<div class="tecctx">A trabalhar para <b>${esc(st.ctx.label)}</b> — os resultados podem ser guardados aí. <button class="linkb" id="tcCtxX">Limpar</button></div>`:"";
 Wr.innerHTML=`<div class="crumb"><button type="button" data-go="home">${esc(S.meta.name||"Projeto")}</button><span>›</span><b>Técnico</b></div>
 <section class="techero"><svg class="thwave" viewBox="0 0 600 120" preserveAspectRatio="none" aria-hidden="true"><path class="w1" d="M0 60 Q37.5 0 75 60 T150 60 T225 60 T300 60 T375 60 T450 60 T525 60 T600 60"/><path class="w2" d="M0 60 Q37.5 110 75 60 T150 60 T225 60 T300 60 T375 60 T450 60 T525 60 T600 60"/><path class="w3" d="M0 60 Q50 20 100 60 T200 60 T300 60 T400 60 T500 60 T600 60"/></svg>
  <div class="thtxt"><span class="thk">${BRAND} · bancada técnica</span><h2>Técnico <em>RTIEBT</em></h2><p>Calcular, consultar e perguntar — tudo neste aparelho, mesmo sem rede.</p>
  <div class="thchips"><span class="on">● Sem rede OK</span><span>Tabelas ${TEC_VERSION}</span><span>${hist().length} cálculo${hist().length===1?"":"s"} guardado${hist().length===1?"":"s"}</span></div></div>
  <div class="thsym" aria-hidden="true"><span>Ω</span><span>⏚</span><span>~</span><span>Δ</span></div></section>`+ctx+
  `<nav class="tectabs2">${TABS.map(([k,n])=>`<button data-tt="${k}" class="${st.tab===k?"on":""}">${ic(k==="ia"?"ia":k)}<span>${n}</span></button>`).join("")}</nav><div class="tecbody" id="tecBody"></div>`;
 Wr.querySelectorAll("[data-tt]").forEach(b=>b.onclick=()=>{st.tab=b.dataset.tt;render(Wr)});
 const cx=$("tcCtxX");if(cx)cx.onclick=()=>{st.ctx=null;render(Wr)};
 Wr.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>go(b.dataset.go));
 const B=$("tecBody");({inicio:pInicio,calc:pCalc,cons:pCons,ia:pIA})[st.tab](B)}
const goTec=(tab,sub,extra)=>{if(window.TEC&&typeof TEC.onGo==="function"&&TEC.onGo(tab,sub,extra)!==false)return;st.tab=tab;if(sub){if(tab==="calc")st.sub.calc=sub;else if(tab==="cons")st.sub.cons=sub}if(extra)Object.assign(st,extra);render(root);const pg=$("viewPage");if(pg)pg.scrollTop=0};

/* ---------- Início ---------- */
const DEST=[["Queda de tensão","3% iluminação · 5% outros usos","cons","guia","queda"],["Coordenação","IB ≤ In ≤ IZ (fusível gG: In ≤ 0,9 IZ)","cons","guia","coord"],["Diferencial","R × IΔn ≤ 50 V (25 V em locais húmidos)","cons","guia","dr"],
 ["Circuitos","Iluminação 1,5 mm²/10 A · Tomadas 2,5 mm²/16 A · máx. 8 pontos","cons","guia","circ"],["Tubos embebidos","Ocupação ≤ ⅓ da secção interior","cons","guia","tubos"],["Entradas","≥ 6 mm² · tubo ≥ 32 mm","cons","guia","entrada"]];
function pInicio(B){const h=hist();
 const card=(attr,k,code,t,sub,cls="")=>`<button class="teccard ${cls}" ${attr}><span class="tcode">${code}</span><span class="tci">${ic(k)}</span><b>${t}</b><small>${sub}</small><i class="tgo">→</i></button>`;
 B.innerHTML=`<h3 class="tsec-h"><span>Calcular</span><i></i></h3><div class="tecgrid">${CALCS.map((c,i)=>card(`data-c="${c[0]}"`,c[0],"CALC-0"+(i+1),c[1],{qt:"ΔU %, fator K, secção mínima",tubo:"VD embebido, à vista, colunas",prot:"IZ, disjuntor, fusível gG",pot:"kVA ↔ A, habitação"}[c[0]],"c-"+c[0])).join("")}</div>
  <h3 class="tsec-h"><span>Consultar e perguntar</span><i></i></h3><div class="tecgrid">${card('data-cs="guia"',"guia","DOC-01","Guia de bolso","Regras rápidas e tabelas","c-guia")}${card('data-cs="banc"',"esq","LAB-06","Bancada de ligações","Liga os fios e testa (6 exercícios)","c-banc")}${card('data-cs="seg"',"prot","SEG-01","Segurança · SADI","Protocolos de deteção de incêndio","c-seg")}${card('data-cs="esq"',"esq","ESQ-04","Esquemas","Escada, inversor, quadro, sensor","c-esq")}
  ${card('data-cs="auto"',"auto","BUS-07","Automação","KNX · DALI · Modbus · BACnet","c-auto")}${card('data-ia="1"',"ia","IA-00","Assistente","Pergunta em português","c-ia")}</div>
  <section class="block"><h2>Destaques</h2><div class="tecdest">${DEST.map(d=>`<button data-dg="${d[4]}"><b>${d[0]}</b><span>${d[1]}</span></button>`).join("")}</div></section>
  <section class="block"><h2>Últimos cálculos <small class="muted">neste aparelho</small></h2>${h.length?`<div class="techist">${h.slice(0,8).map((x,i)=>`<div><b>${esc(x.t)}</b><span>${esc(x.r)}</span><small>${fmtDate(x.at)}${x.dest?" · guardado em "+esc(x.dest):""}</small><button class="btn sm" data-hr="${i}">Abrir</button></div>`).join("")}</div>`:`<p class="muted">Ainda sem cálculos. Os resultados que guardares aparecem aqui.</p>`}</section>`;
 B.querySelectorAll("[data-c]").forEach(b=>b.onclick=()=>goTec("calc",b.dataset.c));B.querySelectorAll("[data-cs]").forEach(b=>b.onclick=()=>goTec("cons",b.dataset.cs));
 B.querySelector("[data-ia]").onclick=()=>goTec("ia");B.querySelectorAll("[data-dg]").forEach(b=>b.onclick=()=>goTec("cons","guia",{guia:b.dataset.dg}));
 B.querySelectorAll("[data-hr]").forEach(b=>b.onclick=()=>{const x=h[+b.dataset.hr];st.pre=x.pre||{};goTec("calc",x.c)})}

/* ---------- Calcular ---------- */
function pCalc(B){const c=st.sub.calc;B.innerHTML=`<div class="tecsub">${CALCS.map(x=>`<button data-sc="${x[0]}" class="${c===x[0]?"on":""}">${x[1]}</button>`).join("")}</div><div class="teccalc" id="tcC"></div>`;
 B.querySelectorAll("[data-sc]").forEach(b=>b.onclick=()=>{st.sub.calc=b.dataset.sc;st.pre={};pCalc(B)});({qt:cQueda,tubo:cTubo,prot:cProt,pot:cPot})[c]($("tcC"));st.pre={}}
const fld=(id,lab,val,o="")=>`<label class="f">${lab}<input id="${id}" inputmode="decimal" value="${esc(val??"")}" ${o}></label>`;
const sel=(id,lab,opts,val)=>`<label class="f">${lab}<select id="${id}">${opts.map(o=>`<option value="${o[0]}"${String(val)===String(o[0])?" selected":""}>${o[1]}</option>`).join("")}</select></label>`;
const segB=(name,opts,val)=>`<div class="seg tecseg" data-seg="${name}">${opts.map(o=>`<button type="button" data-v="${o[0]}" aria-pressed="${String(val)===String(o[0])}">${o[1]}</button>`).join("")}</div>`;
function wireSeg(E,cb){E.querySelectorAll("[data-seg]").forEach(g=>g.querySelectorAll("[data-v]").forEach(b=>b.onclick=()=>{g.querySelectorAll("[data-v]").forEach(x=>x.setAttribute("aria-pressed",x===b));cb()}))}
const bindIn=(el,fn)=>{if(el.tagName==="SELECT")el.onchange=fn;else el.oninput=fn};
const segV=(E,n)=>{const b=E.querySelector(`[data-seg="${n}"] [aria-pressed="true"]`);return b?b.dataset.v:null};
const resBox=(ok,big,lines,save,g)=>`<div class="tecres ${ok===true?"ok":ok===false?"bad":""}${g?" hasg":""}">${g?`<div class="tecg">${g}</div>`:""}<div class="trb"><span class="tled"></span>${big}</div>${lines.map(l=>`<p>${l}</p>`).join("")}${save?`<div class="toolrow"><button class="btn sm primary" id="tcSave">Guardar resultado</button><button class="btn sm" id="tcAsk">Explicar</button></div>`:""}</div>`;
function cQueda(E){const p={sis:"mono",modo:"I",I:16,P:"",cos:1,L:25,S:2.5,mat:"cu",tipo:"outros",...st.pre};
 E.innerHTML=`<div class="tecform">${segB("sis",[["mono","Monofásico 230 V"],["tri","Trifásico 400 V"]],p.sis)}${segB("tipo",[["iluminacao","Iluminação (3%)"],["outros","Outros usos (5%)"]],p.tipo)}
  <div class="tgrid">${fld("qI","Corrente de serviço (A)",p.I)}${fld("qP","ou Potência (W)",p.P,'placeholder="opcional"')}${fld("qCos","cos φ",p.cos)}${fld("qL","Comprimento L (m)",p.L)}
  ${sel("qS","Secção S (mm²)",D.seccoes.map(s=>[s,n2(s)]),p.S)}${sel("qM","Condutor",[["cu","Cobre"],["al","Alumínio"]],p.mat)}</div></div><div id="qR"></div>
  <details class="tecwhy"><summary>Fórmula e fonte</summary>${KB.find(k=>k.id==="queda").h()}<p class="mut">${F("utec")}</p></details>`;
 const run=()=>{const sis=segV(E,"sis"),tipo=segV(E,"tipo"),cos=num($("qCos").value)||1,P=num($("qP").value);let I=num($("qI").value);if(P>0){I=corrente({sis,P,cos});$("qI").value=n2(I,2)}
  const L=num($("qL").value),S=num($("qS").value),mat=$("qM").value;if(!(I>0&&L>0&&S>0)){$("qR").innerHTML=resBox(null,"Preenche corrente, comprimento e secção.",[]);return}
  const r=queda({sis,I,L,S,mat,cos,tipo});const pre={sis,tipo,I,cos,L,S,mat};
  const txt=`ΔU = ${n2(r.dU,2)} V (${n2(r.pct,2)}%) — limite ${r.max}% · ${sis==="tri"?"tri":"mono"} · I=${n2(I,1)} A · L=${n2(L)} m · S=${n2(S)} mm² ${mat==="al"?"Al":"Cu"}`;
  $("qR").innerHTML=resBox(r.ok,`${n2(r.pct,2)} %<small>${n2(r.dU,2)} V</small>`,[r.ok?`✓ Dentro do limite de <b>${r.max}%</b>.`:`✗ Acima do limite de <b>${r.max}%</b>.`,
   `Fator K desta secção: <b>${n2(r.kAm,0)} A·m</b> → distância máxima com ${n2(I,1)} A: <b>${n2(r.Lmax,0)} m</b>.`,r.smin?`Secção mínima para ${n2(L)} m: <b>${n2(r.smin)} mm²</b>${r.smin>S?" — aumentar a secção":""}.`:"Nem 240 mm² chega — rever o traçado ou a alimentação."],true,gauge(r.pct,r.max,r.max*2,"%","ΔU"));
  wireRes("Queda de tensão",txt,"qt",pre,`queda de tensão ${n2(I,0)} A ${n2(L)} m ${n2(S)} mm2`)};
 E.querySelectorAll("input,select").forEach(i=>bindIn(i,run));wireSeg(E,run);run()}
function cTubo(E){const p={inst:"embebida",linhas:[{n:3,s:2.5,tipo:"U"}],...st.pre};let L=p.linhas.map(x=>({...x}));
 const draw=()=>{E.innerHTML=`<div class="tecform">${segB("inst",[["embebida","Embebida (≤ ⅓)"],["vista","À vista (≤ 40%)"],["coluna","Coluna / entrada (≤ 20%)"]],p.inst)}
  <div class="tclines">${L.map((l,i)=>`<div class="tcl"><input data-li="${i}" data-k="n" inputmode="numeric" value="${esc(l.n)}" aria-label="Número"><span>×</span><select data-li="${i}" data-k="s">${D.seccoes.map(s=>`<option value="${s}"${+l.s===s?" selected":""}>${n2(s)} mm²</option>`).join("")}</select>
   <select data-li="${i}" data-k="tipo"><option value="U"${l.tipo==="U"?" selected":""}>H07V-U</option><option value="R"${l.tipo==="R"?" selected":""}>H07V-R</option><option value="D"${l.tipo==="D"?" selected":""}>Outro (Ø)</option></select>
   ${l.tipo==="D"?`<input data-li="${i}" data-k="d" inputmode="decimal" placeholder="Ø ext. mm" value="${esc(l.d||"")}">`:""}<button class="btn sm" data-lx="${i}" aria-label="Retirar">×</button></div>`).join("")}</div>
  <button class="btn sm" id="tcAdd">+ Outra secção / cabo</button></div><div id="tR"></div><details class="tecwhy"><summary>Regras e fonte</summary>${KB.find(k=>k.id==="tubos").h()}<p class="mut">${F("isep")} · ${F("hd21")}</p></details>`;
  E.querySelectorAll("[data-li]").forEach(el=>bindIn(el,()=>{const l=L[+el.dataset.li];const k=el.dataset.k;l[k]=k==="tipo"?el.value:num(el.value);if(k==="tipo"){if(el.value!=="D")delete l.d;draw()}else run()}));
  E.querySelectorAll("[data-lx]").forEach(b=>b.onclick=()=>{L.splice(+b.dataset.lx,1);if(!L.length)L.push({n:1,s:1.5,tipo:"U"});draw()});
  $("tcAdd").onclick=()=>{L.push({n:1,s:2.5,tipo:"U"});draw()};wireSeg(E,()=>{p.inst=segV(E,"inst");run()});run()};
 const run=()=>{const inst=segV(E,"inst");const ls=L.map(l=>l.tipo==="D"?{n:l.n,s:l.s,d:num(l.d)}:{n:l.n,s:l.s,tipo:l.s>10&&l.tipo==="U"?"R":l.tipo});const r=tubo({linhas:ls,inst});
  const desc=ls.map(l=>`${l.n}×${n2(l.s)}${l.d?" (Ø"+n2(l.d,1)+")":""}`).join(" + ");
  let tab="";if(inst==="coluna"&&ls.length===1&&!ls[0].d){const v=tuboTabela(ls[0].s,ls[0].n);if(v)tab=`Tabela de colunas/entradas (1.º estabelecimento): <b>VD ${v} mm</b>.`}
  const txt=`Tubo mínimo VD ${r.dn||"> 110"} mm para ${desc} (${inst==="embebida"?"embebida ≤ ⅓":inst==="vista"?"à vista ≤ 40%":"coluna/entrada ≤ 20%"}) — ocupação ${n2(r.occ,0)}%`;
  $("tR").innerHTML=resBox(r.dn?true:false,r.dn?`VD ${r.dn} mm<small>ocupação ${n2(r.occ,0)}%</small>`:"> 110 mm",[`Área dos condutores: <b>${n2(r.area,0)} mm²</b> · área interior necessária: ${n2(r.need,0)} mm².`,tab,inst==="coluna"&&r.dn===D.ocupacao.entradaMin?`Mínimo de ${D.ocupacao.entradaMin} mm em entradas aplicado.`:"",
   `<span class="tocc">${r.all.filter(a=>a.dn<=110).map(a=>`<i class="${a.occ<=r.pct?"y":"n"}" title="${n2(a.occ,0)}%">${a.dn}<em>${n2(a.occ,0)}%</em></i>`).join("")}</span>`].filter(Boolean),true,r.dn?tuboSvg(r):gauge(r.occ||100,r.pct,100,"%","ocupação"));
  wireRes("Ocupação de tubos",txt,"tubo",{inst,linhas:L},`tubo para ${desc}`)};
 draw()}
function cProt(E){const p={IB:14,P:"",sis:"mono",cos:1,S:2.5,iso:"pvc",met:"B1",nc:2,t:30,ng:1,dev:"disj",...st.pre};
 E.innerHTML=`<div class="tecform">${segB("dev",[["disj","Disjuntor"],["fus","Fusível gG"]],p.dev)}${segB("iso",[["pvc","PVC 70 °C (H07V, VV)"],["xlpe","XLPE 90 °C (XV)"]],p.iso)}
  <div class="tgrid">${fld("pIB","Corrente de serviço (A)",p.IB)}${fld("pP","ou Potência (W)",p.P,'placeholder="opcional"')}${sel("pSis","Sistema",[["mono","Monofásico"],["tri","Trifásico"]],p.sis)}
  ${sel("pS","Secção (mm²)",D.seccoes.map(s=>[s,n2(s)]),p.S)}${sel("pMet","Método de instalação",Object.entries(D.iz.metodos).map(([k,v])=>[k,k+" — "+v.split(" — ")[0]]),p.met)}${sel("pNc","Condutores carregados",[[2,"2 (mono)"],[3,"3 (tri)"]],p.nc)}
  ${sel("pT","Temperatura ambiente (°C)",D.kt.t.map(t=>[t,t+" °C"]),p.t)}${sel("pNg","Circuitos agrupados",D.kg.n.map(n=>[n,n]),p.ng)}</div></div><div id="pR"></div>
  <details class="tecwhy"><summary>Regras e fonte</summary>${KB.find(k=>k.id==="coord").h()}${KB.find(k=>k.id==="circ").h()}<p class="mut">${F("iec52")}</p></details>`;
 $("pSis").onchange=()=>{$("pNc").value=$("pSis").value==="tri"?3:2;run()};
 const run=()=>{const dev=segV(E,"dev"),iso=segV(E,"iso"),sis=$("pSis").value;const P=num($("pP").value);let IB=num($("pIB").value);if(P>0){IB=corrente({sis,P,cos:1});$("pIB").value=n2(IB,1)}
  const S=num($("pS").value),met=$("pMet").value,nc=+$("pNc").value,t=+$("pT").value,ng=+$("pNg").value;if(!(IB>0)){$("pR").innerHTML=resBox(null,"Indica a corrente de serviço.",[]);return}
  const r=protecao({IB,S,iso,met,nc,t,ng,dev});if(!r.z){$("pR").innerHTML=resBox(null,"Sem valor tabelado para esta combinação.",[]);return}
  const txt=`${dev==="fus"?"Fusível gG":"Disjuntor"} ${r.In||"—"} A para IB=${n2(IB,1)} A em ${n2(S)} mm² ${iso.toUpperCase()} ${met} (IZ=${n2(r.z.iz,1)} A)${r.ok?" ✓":" ✗"}`;
  $("pR").innerHTML=resBox(r.ok,`${r.In?r.In+" A":"—"}<small>I<sub>Z</sub> = ${n2(r.z.iz,1)} A</small>`,[
   `I<sub>Z</sub> = ${n2(r.z.iz0,1)} A (quadro, ${met}, ${nc} carregados) × ${n2(r.z.kt,2)} (temp.) × ${n2(r.z.kg,2)} (agrupamento).`,
   r.ok?`✓ I<sub>B</sub> ${n2(IB,1)} ≤ I<sub>n</sub> ${r.In} ≤ ${dev==="fus"?"0,9 × ":""}I<sub>Z</sub> ${n2(r.lim,1)} A.`:`✗ ${r.In?`I<sub>n</sub> ${r.In} A > ${dev==="fus"?"0,9 × I<sub>Z</sub>":"I<sub>Z</sub>"} (${n2(r.lim,1)} A).`:"Corrente acima dos calibres da tabela."}`,
   r.sug?`Secção mínima nestas condições: <b>${n2(r.sug)} mm²</b> (e nunca menos de 1,5 mm² em iluminação ou 2,5 mm² em tomadas).`:"",`Não esquecer: verificar também a queda de tensão. <button class="linkb" id="pGoQ">Calcular queda →</button>`].filter(Boolean),true,r.z&&r.In?gauge(r.In,dev==="fus"?r.lim:r.z.iz,Math.max(r.z.iz,r.In)*1.4,"A","In / IZ"):"");
  const gq=$("pGoQ");if(gq)gq.onclick=()=>{st.pre={sis,I:IB,S:r.ok?S:(r.sug||S),tipo:"outros"};goTec("calc","qt")};
  wireRes("Proteção / amperagem",txt,"prot",{IB,sis,S,iso,met,nc,t,ng,dev},`que disjuntor para ${n2(IB,0)} A em ${n2(S)} mm2`)};
 E.querySelectorAll("input,select").forEach(i=>{if(i.id!=="pSis"){bindIn(i,run)}});wireSeg(E,run);run()}
function cPot(E){const p={modo:"kva",kva:6.9,sis:"mono",P:"",comp:3,...st.pre};
 E.innerHTML=`<div class="tecform">${segB("modo",[["kva","Escalão → corrente"],["carga","Cargas → escalão"],["hab","Habitação (mínimo)"]],p.modo)}<div id="pmF"></div></div><div id="pmR"></div>
  <details class="tecwhy"><summary>Tabela E-REDES</summary>${KB.find(k=>k.id==="pot").h()}${KB.find(k=>k.id==="hab").h()}</details>`;
 const form=()=>{const m=segV(E,"modo");$("pmF").innerHTML=m==="kva"?`<div class="tgrid">${sel("mK","Potência contratada",D.eredes.kva.map(k=>[k,n2(k)+" kVA"]),p.kva)}${sel("mS","Alimentação",[["mono","Monofásica 230 V"],["tri","Trifásica 400 V"]],p.sis)}</div>`
  :m==="carga"?`<div class="tgrid">${fld("mP","Potência total prevista (W)",p.P||"")}${fld("mF","Fator de simultaneidade",p.f||"1")}${sel("mS","Alimentação",[["mono","Monofásica 230 V"],["tri","Trifásica 400 V"]],p.sis)}</div>`
  :`<div class="tgrid">${fld("mC","Número de compartimentos",p.comp)}${fld("mA","Área útil (m²)",p.A||"",'placeholder="opcional"')}</div>`;
  $("pmF").querySelectorAll("input,select").forEach(i=>bindIn(i,run));run()};
 const run=()=>{const m=segV(E,"modo");let big,lines,ok=null,txt,pre;
  if(m==="kva"){const k=num($("mK").value),sis=$("mS").value;const r=eredes({kva:k,sis});const mo=sis==="mono"&&k>D.eredes.monoMax,tr=sis==="tri"&&k<D.eredes.triMin;ok=!(mo||tr);
   big=`${n2(r.I,1)} A<small>${n2(k)} kVA ${sis==="tri"?"trifásico":"monofásico"}</small>`;lines=[`I = ${n2(k*1000,0)} VA ÷ ${sis==="tri"?"(√3 × 400 V)":"230 V"} = <b>${n2(r.I,2)} A</b>${sis==="tri"?" por fase":""}.`,mo?"⚠ Acima do habitual em monofásico — confirmar com a E-REDES ou passar a trifásico.":tr?"⚠ Abaixo do mínimo trifásico (6,9 kVA).":"",
    `Secção mínima da entrada: <b>${(D.entradas.l.find(e=>r.I<=e[0])||[0,"≥ 16"])[1]} mm²</b>.`].filter(Boolean);txt=`${n2(k)} kVA ${sis} → ${n2(r.I,1)} A`;pre={modo:m,kva:k,sis}}
  else if(m==="carga"){const P=num($("mP").value),f=num($("mF").value)||1,sis=$("mS").value;if(!(P>0)){$("pmR").innerHTML=resBox(null,"Indica a potência prevista.",[]);return}
   const Pt=P*f,e=escalao({P:Pt,sis});ok=!!e;big=e?`${n2(e)} kVA<small>${sis==="tri"?"trifásico":"monofásico"}</small>`:"Acima de BTN";
   lines=[`Potência simultânea: ${n2(P,0)} W × ${n2(f,2)} = <b>${n2(Pt,0)} W</b> (${n2(Pt/1000,2)} kVA, com cos φ ≈ 1).`,e?`Escalão mínimo: <b>${n2(e)} kVA</b> → ${n2(eredes({kva:e,sis}).I,1)} A.`:"Acima de 41,4 kVA: BTE / outra solução."];txt=`${n2(Pt,0)} W simultâneos → ${e?n2(e)+" kVA":"> BTN"} ${sis}`;pre={modo:m,P,f,sis}}
  else{const c=num($("mC").value),A=num($("mA").value);if(!(c>0)){$("pmR").innerHTML=resBox(null,"Indica o número de compartimentos.",[]);return}const k=habMin(c);ok=true;
   big=`${n2(k)} kVA<small>mínimo (monofásico)</small>`;lines=[`Habitação com ${c} compartimento${c>1?"s":""}: potência mínima <b>${n2(k)} kVA</b>.`,A>0?`Iluminação e tomadas de uso geral: ${n2(A,0)} m² × 25 VA/m² = <b>${n2(A*25,0)} VA</b>.`:""].filter(Boolean);txt=`Habitação ${c} compart. → mínimo ${n2(k)} kVA`;pre={modo:m,comp:c,A}}
  $("pmR").innerHTML=resBox(ok,big,lines,true,m!=="hab"?gauge(m==="kva"?eredes({kva:num($("mK").value),sis:$("mS").value}).I:(eredes({kva:escalao({P:num($("mP").value)*(num($("mF").value)||1),sis:$("mS").value})||41.4,sis:$("mS").value}).I),null,$("mS").value==="tri"?63:63,"A","corrente"):"");wireRes("Potência E-REDES",txt,"pot",pre,"potencia "+txt)};
 wireSeg(E,form);form()}
function wireRes(title,txt,c,pre,q){const s=$("tcSave");if(s)s.onclick=()=>saveResult(title,txt,c,pre);const a=$("tcAsk");if(a)a.onclick=()=>{toAsk(q)}}
/* guardar numa tarefa, num equipamento ou só no histórico */
function saveResult(title,txt,c,pre){const tasks=S.issues.filter(x=>(x.kind==="tarefa"||x.kind==="duvida")&&x.status!=="resolvida");const its=S.items.filter(i=>i.planId===S.planId);
 /* sem obra aberta (Técnico público ou aberto fora de um projeto): não há tarefas nem equipamentos — guarda logo no histórico deste aparelho */
 if(!S.projectId&&!st.ctx){histAdd({t:title,r:txt,c,pre,at:now(),dest:null});toast("Guardado no histórico deste aparelho.");return}
 let d=$("dlgTec");if(!d){d=document.createElement("dialog");d.id="dlgTec";document.body.appendChild(d)}
 const cx=st.ctx;d.innerHTML=`<div class="dlg tdlg"><div class="tdh"><h3>Guardar resultado</h3><button class="btn sm" id="tsX">Fechar</button></div><p class="tecpv"><b>${esc(title)}</b><br>${esc(txt)}</p>
  ${cx?`<button class="btn primary" id="tsCtx">Guardar em ${esc(cx.label)}</button>`:""}
  <label class="f">Numa tarefa ou dúvida<select id="tsT"><option value="">—</option>${tasks.map(t=>`<option value="${esc(t.id)}">${esc(((typeof tRef==="function")?tRef(t):"#"+t.seq)+" · "+String(t.title||"").slice(0,50))}</option>`).join("")}</select></label>
  <label class="f">Num equipamento desta planta<select id="tsI"><option value="">—</option>${its.map(i=>`<option value="${esc(i.id)}">${esc(i.code||"")}${i.devId?" · "+esc(i.devId):""}</option>`).join("")}</select></label>
  <div class="toolrow" style="justify-content:flex-end"><button class="btn" id="tsH">Só no histórico</button><button class="btn primary" id="tsOk">Guardar</button></div></div>`;
 d.showModal();$("tsX").onclick=()=>d.close();
 const done=dest=>{histAdd({t:title,r:txt,c,pre,at:now(),dest});d.close();toast(dest?"Guardado em "+dest+".":"Guardado no histórico.")};
 const toTask=id=>{const t=S.issues.find(x=>x.id===id);if(!t)return;if(!S.canWrite&&!S.meId)return toast("Sem permissão.");
  api.update("issues",id,{comments:[...(t.comments||[]),{id:uid(),by:S.meId,at:now(),text:"📐 "+title+": "+txt}],updatedAt:now(),updatedBy:S.meId});return(typeof tRef==="function"?tRef(t):"tarefa")};
 const toItem=id=>{const it=S.items.find(x=>x.id===id);if(!it)return;if(!S.canWrite)return toast("Sem permissão para alterar equipamentos.");
  api.update("items",id,logPatch(it,{updatedAt:now(),updatedBy:S.meId},"📐 "+title+": "+txt));return it.code||"equipamento"};
 const ct=$("tsCtx");if(ct)ct.onclick=()=>done(cx.kind==="task"?toTask(cx.id):toItem(cx.id));
 $("tsH").onclick=()=>done(null);
 $("tsOk").onclick=()=>{const a=$("tsT").value,b=$("tsI").value;if(!a&&!b){done(null);return}const ds=[a&&toTask(a),b&&toItem(b)].filter(Boolean);done(ds.join(" e "))}}

/* ---------- Consultar ---------- */
function pCons(B){const c=st.sub.cons;B.innerHTML=`<div class="tecsub">${CONS.map(x=>`<button data-sc="${x[0]}" class="${c===x[0]?"on":""}">${x[1]}</button>`).join("")}</div><div id="tcK"></div>`;
 B.querySelectorAll("[data-sc]").forEach(b=>b.onclick=()=>{st.sub.cons=b.dataset.sc;pCons(B)});({guia:kGuia,banc:(E)=>kBanc(E),esq:kEsq,auto:kAuto,seg:(E)=>kSeg(E),tab:kTab})[c]($("tcK"))}
function kGuia(E){const items=KB.filter(k=>k.h);
 E.innerHTML=`<input class="tecq" id="kgQ" placeholder="Procurar no guia (ex.: diferencial, tubo, 2,5 mm², cores)…"><div class="tecacc" id="kgL"></div>`;
 const draw=q=>{const n=normQ(q);const l=n?items.filter(k=>score(k,n)>0).sort((a,b)=>score(b,n)-score(a,n)):items;
  $("kgL").innerHTML=l.map(k=>`<details id="kb_${k.id}"${st.guia===k.id||(n&&l.length<=3)?" open":""}><summary>${esc(k.t)}</summary><div class="tecart">${k.h()}<p class="mut">Fonte: ${esc(F(k.f))}</p>${k.calc?`<button class="btn sm" data-kc="${k.calc}">Abrir calculadora →</button>`:""}</div></details>`).join("")||`<p class="muted">Nada encontrado. Experimenta o Assistente.</p>`;
  $("kgL").querySelectorAll("[data-kc]").forEach(b=>b.onclick=()=>goTec("calc",b.dataset.kc));
  if(st.guia){const el=$("kb_"+st.guia);if(el)setTimeout(()=>el.scrollIntoView({block:"start",behavior:"smooth"}),60);st.guia=null}};
 $("kgQ").oninput=e=>draw(e.target.value);draw("")}
function kEsq(E){const k=st.sub.esq;const s=ESQ2[k];
 E.innerHTML=`<div class="tecsub sm">${Object.entries(ESQ2).map(([kk,v])=>`<button data-e="${kk}" class="${kk===k?"on":""}">${v.t.split(" — ")[0].split(" (")[0]}</button>`).join("")}</div>
  <section class="block"><h2>${s.t}</h2><div class="esqwrap">${s.svg()}</div>
  <div class="tec2"><div><h5>Como ligar</h5><ol>${s.passos.map(p=>`<li>${p}</li>`).join("")}</ol></div><div><h5>Erros comuns</h5><ul class="terr">${s.erros.map(p=>`<li>${p}</li>`).join("")}</ul><p class="mut">${s.mat}</p></div></div>
  <div class="toolrow"><button class="btn sm" id="eAsk">Perguntar sobre este esquema</button></div></section>`;
 E.querySelectorAll("[data-e]").forEach(b=>b.onclick=()=>{st.sub.esq=b.dataset.e;kEsq(E)});$("eAsk").onclick=()=>toAsk(s.t)}
function kAuto(E){const k=st.sub.auto||"tab";
 E.innerHTML=`<div class="tecsub sm">${[["tab","Tabela de protocolos"],["sel","Seleção de redes"],["topo","Tipologias bus"]].map(x=>`<button data-a="${x[0]}" class="${x[0]===k?"on":""}">${x[1]}</button>`).join("")}</div><div id="kaB"></div>`;
 E.querySelectorAll("[data-a]").forEach(b=>b.onclick=()=>{st.sub.auto=b.dataset.a;kAuto(E)});const B=$("kaB");
 if(k==="tab")B.innerHTML=`<div class="tprotos">${PROTO.map((p,i)=>`<details class="tproto"${i===0?" open":""}><summary><span class="pbadge">${esc(p.n.split(" ")[0])}</span><span class="pst"><b>${p.n}</b><span>${p.uso}</span></span></summary>${protoDetail(p)}</details>`).join("")}</div><p class="mut">Valores de referência das normas indicadas — confirmar nas fichas dos fabricantes.</p>`;
 else if(k==="sel")B.innerHTML=`<p>O que precisas de fazer?</p><div class="tsel">${SELEC.map((s,i)=>`<button data-s="${i}">${s.q}</button>`).join("")}</div><div id="ksR"></div>`;
 else B.innerHTML=Object.values(TOPO).map(t=>`<section class="block tecTopo"><h2>${t.t}</h2>${t.svg()}<p>${t.p}</p></section>`).join("");
 wireProto(B);
 B.querySelectorAll("[data-s]").forEach(b=>b.onclick=()=>{B.querySelectorAll("[data-s]").forEach(x=>x.classList.toggle("on",x===b));const s=SELEC[+b.dataset.s];
  $("ksR").innerHTML=`<div class="tecres"><div class="trb">${s.r.join(" + ")}</div><p>${s.p}</p>${s.r.map(n=>PROTO.find(p=>p.n===n)).filter(Boolean).map(p=>`<p><b>${p.n}:</b> ${p.lim}</p>`).join("")}</div>`})}
function kTab(E){const can=S.isCoord||S.isProjAdmin;const custom=!!(S.meta&&S.meta.tecData);
 E.innerHTML=`<section class="block"><h2>Tabelas e fontes</h2><p>Todos os valores usados nas calculadoras e no assistente estão nestas tabelas. Devem ser confirmados pelo técnico responsável e pela edição em vigor das RTIEBT.</p>
  <p>${custom?"✏️ Esta obra usa <b>tabelas corrigidas</b> pela coordenação.":"A usar as tabelas de base do "+BRAND+" ("+TEC_VERSION+")."}</p>
  <ul class="tfontes">${Object.entries(D.fontes).map(([k,v])=>`<li>${esc(v)}</li>`).join("")}</ul>
  <div class="toolrow"><button class="btn sm" id="tbExp">Exportar tabelas (JSON)</button>${can?`<button class="btn sm" id="tbImp">Importar tabelas corrigidas</button>${custom?`<button class="btn sm danger" id="tbRst">Repor tabelas de base</button>`:""}`:""}</div></section>
  <section class="block"><h2>Correntes admissíveis — cobre, 30 °C</h2>${izTable("pvc")}${izTable("xlpe")}<p class="mut">${F("iec52")}</p></section>
  <section class="block"><h2>Fatores de correção</h2><div class="tscroll"><table class="tt2 num"><tr><th>°C</th>${D.kt.t.map(t=>`<th>${t}</th>`).join("")}</tr><tr><td>PVC</td>${D.kt.pvc.map(v=>`<td>${n2(v)}</td>`).join("")}</tr><tr><td>XLPE</td>${D.kt.xlpe.map(v=>`<td>${n2(v)}</td>`).join("")}</tr></table></div>
  <div class="tscroll"><table class="tt2 num"><tr><th>Circuitos</th>${D.kg.n.map(t=>`<th>${t}</th>`).join("")}</tr><tr><td>Fator</td>${D.kg.f.map(v=>`<td>${n2(v)}</td>`).join("")}</tr></table></div></section>
  <section class="block"><h2>Tubos — diâmetros de cálculo</h2><div class="tscroll"><table class="tt2 num"><tr><th>VD (mm)</th>${D.tubos.dn.map(t=>`<th>${t}</th>`).join("")}</tr><tr><td>Ø interior</td>${D.tubos.di.map(v=>`<td>${n2(v,1)}</td>`).join("")}</tr></table></div>
  <div class="tscroll"><table class="tt2 num"><tr><th>H07V mm²</th>${Object.keys(D.dext.R).map(s=>`<th>${n2(+s)}</th>`).join("")}</tr><tr><td>Ø ext. -U</td>${Object.keys(D.dext.R).map(s=>`<td>${D.dext.U[s]?n2(D.dext.U[s],1):"—"}</td>`).join("")}</tr><tr><td>Ø ext. -R</td>${Object.values(D.dext.R).map(v=>`<td>${n2(v,1)}</td>`).join("")}</tr></table></div><p class="mut">${F("hd21")} · diâmetros interiores: confirmar na ficha do fabricante do tubo.</p></section>`;
 $("tbExp").onclick=()=>saveBlob("obraflow-tabelas-tecnicas.json",new Blob([JSON.stringify(D,null,1)],{type:"application/json"}));
 const im=$("tbImp");if(im)im.onclick=()=>{const i=document.createElement("input");i.type="file";i.accept=".json,application/json";i.onchange=async()=>{try{const o=JSON.parse(await i.files[0].text());if(!o||typeof o!=="object")throw new Error("ficheiro inválido");
   S.meta={...S.meta,tecData:o};api.set("meta","project",{...S.meta});D=deepMerge(BASE,o);toast("Tabelas corrigidas guardadas para esta obra.");kTab(E)}catch(e){toast("Não foi possível importar: "+e.message)}};i.click()};
 const rs=$("tbRst");if(rs)rs.onclick=()=>{if(!confirm("Repor as tabelas de base?"))return;const m={...S.meta};delete m.tecData;S.meta=m;api.set("meta","project",m);D=BASE;kTab(E)}}
function izTable(iso){const t=D.iz[iso];return`<h5>${iso==="pvc"?"PVC (70 °C)":"XLPE / EPR (90 °C)"}</h5><div class="tscroll"><table class="tt2 num"><tr><th>mm²</th>${Object.keys(t).flatMap(m=>[`<th>${m}·2</th>`,`<th>${m}·3</th>`]).join("")}</tr>${D.seccoes.map((s,i)=>`<tr><td><b>${n2(s)}</b></td>${Object.values(t).flatMap(m=>[`<td>${n2(m[2][i])}</td>`,`<td>${n2(m[3][i])}</td>`]).join("")}</tr>`).join("")}</table></div><p class="mut">·2 / ·3 = condutores carregados. ${Object.entries(D.iz.metodos).map(([k,v])=>`<b>${k}</b> ${v}`).join(" · ")}</p>`}

/* ---------------------------------------------------------
   7) ASSISTENTE (local — interpreta a pergunta, calcula e procura no guia)
   --------------------------------------------------------- */
const normQ=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/mm²/g,"mm2").replace(/[“”"«»]/g," ").trim();
const STOP=new Set("a o as os de do da dos das e em no na nos nas para por com sem um uma qual quais que como e é ser sao sao posso devo pode deve ter tem quanto quantos quantas onde entre ate mais menos ou se".split(" "));
function score(k,n){const words=n.split(/[^a-z0-9,./%]+/).filter(w=>w&&!STOP.has(w));if(!words.length)return 0;const hay=normQ(k.t+" "+k.k);let s=0;for(const w of words){if(hay.includes(w))s+=w.length>3?2:1;else if(w.length>4&&hay.includes(w.slice(0,w.length-1)))s+=1}return s}
function nums(q){const n=normQ(q).replace(/(\d),(\d)/g,"$1.$2");const g=(re)=>{const m=n.match(re);return m?+m[1]:null};
 return{A:g(/(\d+(?:\.\d+)?)\s*(?:a\b|amp|amperes?)/),m:g(/(\d+(?:\.\d+)?)\s*(?:m\b|metros?|mts?)/),mm2:g(/(\d+(?:\.\d+)?)\s*(?:mm2|mm\b|quadrados?)/),kva:g(/(\d+(?:\.\d+)?)\s*kva/),kw:g(/(\d+(?:\.\d+)?)\s*kw/),w:g(/(\d+(?:\.\d+)?)\s*(?:w\b|watts?)/),
  n:g(/(\d+)\s*(?:x|cabos?|condutores?|fios?)/),pct:g(/(\d+(?:\.\d+)?)\s*%/),ma:g(/(\d+(?:\.\d+)?)\s*ma\b/),comp:g(/(\d+)\s*(?:compartimentos?|assoalhadas?|divisoes)/)||g(/\bt(\d)\b/)}}
function interpret(q){const n=normQ(q),v=nums(q),tri=/trifas|400 ?v|tri\b/.test(n);const sis=tri?"tri":"mono";const out={html:"",acts:[],src:[]};
 const P=v.kw?v.kw*1000:v.w||null;let I=v.A||(P?corrente({sis,P,cos:1}):null);
 // queda de tensão
 if(/queda|cai |c[aá]i a tens|delta ?u|du\b/.test(n)||(I&&v.m&&!/tubo|disjunt|protec/.test(n))){const tipo=/ilumin|luz|lampad/.test(n)?"iluminacao":"outros";
  if(I&&v.m){const S=v.mm2||null;if(S){const r=queda({sis,I,L:v.m,S,tipo});out.html=`<p>Com <b>${n2(I,1)} A</b> em <b>${n2(v.m)} m</b> de ${n2(S)} mm² (${sis==="tri"?"trifásico":"monofásico"}): <b>ΔU = ${n2(r.pct,2)}%</b> (${n2(r.dU,1)} V). Limite: ${r.max}% → ${r.ok?"✓ cumpre":"✗ não cumpre"}.</p>${r.ok?"":`<p>Secção mínima: <b>${r.smin?n2(r.smin)+" mm²":"> 240 mm²"}</b>.</p>`}<p class="mut">Fator K de ${n2(S)} mm²: ${n2(r.kAm,0)} A·m → máx. ${n2(r.Lmax,0)} m com ${n2(I,1)} A.</p>`;out.acts.push(["Abrir na calculadora","calc","qt",{sis,I,L:v.m,S,tipo}])}
   else{const r=queda({sis,I,L:v.m,S:1.5,tipo});const nc=sis==="tri"?3:2;const pz=protecao({IB:I,S:null,nc});const sq=r.smin||null,sp=pz.sug||null,sf=sq&&sp?Math.max(sq,sp):null;const minT=tipo==="iluminacao"?1.5:2.5;const fin=sf?Math.max(sf,minT):null;
    out.html=`<p>Para <b>${n2(I,1)} A</b> a <b>${n2(v.m)} m</b> (${sis==="tri"?"trifásico":"monofásico"}):</p><ul><li>Pela queda de tensão (≤ ${r.max}%): <b>${sq?n2(sq)+" mm²":"> 240 mm²"}</b></li><li>Pela corrente admissível (PVC, B1, 30 °C) com disjuntor ${pz.In||"—"} A: <b>${sp?n2(sp)+" mm²":"—"}</b></li><li>Mínimo por tipo de circuito (${tipo==="iluminacao"?"iluminação":"tomadas/força"}): ${n2(minT)} mm²</li></ul><p>→ Secção a usar: <b>${fin?n2(fin)+" mm²":"rever"}</b>${pz.In?` com disjuntor de <b>${pz.In} A</b>`:""}.</p>`;
    out.acts.push(["Abrir na calculadora","calc","qt",{sis,I,L:v.m,S:fin||2.5,tipo}],["Verificar proteção","calc","prot",{IB:I,S:fin||2.5,sis,nc}])}}
  else{out.html=KB.find(k=>k.id==="queda").h()+`<p>Diz-me a corrente e o comprimento (ex.: <i>«queda de tensão 16 A 30 m 2,5 mm²»</i>) e eu calculo.</p>`;out.acts.push(["Abrir calculadora","calc","qt",{}])}
  out.src.push(F("rtiebt"),F("utec"));return out}
 // tubos
 if(/tubo|vd\b|ocupa|conduta|enfiar/.test(n)){const S=v.mm2||2.5,cnt=v.n||3,inst=/vista|calha/.test(n)?"vista":/coluna|entrada/.test(n)?"coluna":"embebida";const r=tubo({linhas:[{n:cnt,s:S,tipo:S>10?"R":"U"}],inst});
  out.html=`<p>Para <b>${cnt} × ${n2(S)} mm²</b> H07V ${inst==="embebida"?"em tubo embebido (≤ ⅓)":inst==="vista"?"à vista (≤ 40%)":"em coluna/entrada (≤ 20%)"}: tubo mínimo <b>VD ${r.dn||"> 110"} mm</b> (ocupação ${n2(r.occ,0)}%).</p>${inst==="coluna"&&tuboTabela(S,cnt)?`<p>Tabela de colunas/entradas: VD ${tuboTabela(S,cnt)} mm.</p>`:""}`;
  out.acts.push(["Abrir na calculadora","calc","tubo",{inst,linhas:[{n:cnt,s:S,tipo:S>10?"R":"U"}]}]);out.src.push(F("isep"),F("hd21"));return out}
 // E-REDES / potência
 if(v.kva||/e-?redes|potencia contratada|escal|dcp|controlador de potencia/.test(n)||(v.comp&&/potenc|habita/.test(n))){
  if(v.comp&&/potenc|habita|minim/.test(n)){const k=habMin(v.comp);out.html=`<p>Habitação com ${v.comp} compartimentos: potência mínima <b>${n2(k)} kVA</b> (monofásica).</p>`;out.acts.push(["Abrir na calculadora","calc","pot",{modo:"hab",comp:v.comp}])}
  else if(v.kva){const r=eredes({kva:v.kva,sis});out.html=`<p><b>${n2(v.kva)} kVA ${sis==="tri"?"trifásico":"monofásico"}</b> → <b>${n2(r.I,1)} A</b> ${sis==="tri"?"por fase":""}.</p><p class="mut">${D.eredes.nota}</p>`;out.acts.push(["Abrir na calculadora","calc","pot",{modo:"kva",kva:v.kva,sis}])}
  else if(P){const e=escalao({P,sis});out.html=`<p>${n2(P,0)} W simultâneos → escalão mínimo <b>${e?n2(e)+" kVA":"acima de BTN"}</b> (${sis==="tri"?"trifásico":"monofásico"}).</p>`;out.acts.push(["Abrir na calculadora","calc","pot",{modo:"carga",P,sis}])}
  else{out.html=KB.find(k=>k.id==="pot").h();out.acts.push(["Abrir calculadora","calc","pot",{}])}
  out.src.push(F("eredes"));return out}
 // proteção / secção para X A
 if(I&&(/disjunt|protec|calibre|fusivel|seccao|cabo|fio|amperag|aguenta|suporta|iz\b/.test(n))){const met=/vista|calha|parede direta|fixado/.test(n)?"C":/isolant|capoto|pladur|gesso/.test(n)?"A1":"B1";const iso=/xlpe|xv\b|90/.test(n)?"xlpe":"pvc";const nc=tri?3:2;const dev=/fusivel/.test(n)?"fus":"disj";
  const S=v.mm2;if(S){const r=protecao({IB:I,S,iso,met,nc,dev});out.html=r.z?`<p>${n2(S)} mm² ${iso.toUpperCase()}, método ${met}, ${nc} carregados: <b>I<sub>Z</sub> = ${n2(r.z.iz,1)} A</b> (30 °C, sem agrupamento).</p><p>Para I<sub>B</sub> = ${n2(I,1)} A → ${dev==="fus"?"fusível gG":"disjuntor"} <b>${r.In} A</b> ${r.ok?"✓ cumpre":"✗ não cumpre"}.${!r.ok&&r.sug?` Secção mínima: <b>${n2(r.sug)} mm²</b>.`:""}</p>`:"<p>Sem valor tabelado.</p>";out.acts.push(["Abrir na calculadora","calc","prot",{IB:I,S,iso,met,nc,dev,sis}])}
  else{const r=protecao({IB:I,S:null,iso,met,nc,dev});out.html=`<p>Para <b>${n2(I,1)} A</b> (${iso.toUpperCase()}, método ${met} — ${D.iz.metodos[met].split(" — ")[0].toLowerCase()}, ${nc} carregados, 30 °C): ${dev==="fus"?"fusível gG":"disjuntor"} <b>${r.In||"—"} A</b> e secção mínima <b>${r.sug?n2(r.sug)+" mm²":"—"}</b>.</p><p>Com agrupamento de circuitos ou temperatura mais alta a secção pode subir — e verifica a queda de tensão.</p>`;out.acts.push(["Abrir na calculadora","calc","prot",{IB:I,S:r.sug||2.5,iso,met,nc,dev,sis}],["Verificar queda de tensão","calc","qt",{sis,I,S:r.sug||2.5}])}
  out.src.push(F("iec52"),F("rtiebt"));return out}
 // diferencial
 if(/diferencial|\bdr\b|\bddr\b|\bma\b|sensibil/.test(n)&&/inducao|placa|maquina|lavar|secar|ve\b|veiculo|carreg|wallbox|bomba de calor|variador|inversor|fotovolt|ac\b|ar condicionado|elevador/.test(n)){
  const t=/variador.*tri|trifas.*(ve|carreg|wallbox)|(ve|carreg|wallbox).*trifas|fotovolt|inversor/.test(n)?"B":/bomba de calor|variador|ar condicionado|ac\b/.test(n)?"F":"A";
  out.html=`<p>Recomendado: <b>DR tipo ${t}</b>, 30 mA${/ve\b|veiculo|carreg|wallbox/.test(n)?" individual por ponto de carregamento (secção 722: tipo A no mínimo; tipo B quando o carregador não tem deteção de corrente contínua)":""}.</p><table class="tt2">${D.dr.tipos.map(x=>`<tr${x[0]===t?' style="font-weight:700"':""}><td>${x[0]}</td><td>${x[1]}</td></tr>`).join("")}</table>`;
  out.acts.push(["Ver diferenciais no guia","cons","guia",{guia:"dr"}]);out.src.push(F("rtiebt"),F("proj"));return out}
 if(/diferencial|\bdr\b|\bddr\b|\bma\b|sensibil|terra|resist/.test(n)){if(v.ma||/resist|terra/.test(n)){const i=(v.ma||30)/1000;out.html=`<p>Com I<sub>Δn</sub> = ${n2(i*1000)} mA: R<sub>A</sub> máx. = 50 V ÷ ${n2(i,3)} A = <b>${n2(50/i,0)} Ω</b> (ou ${n2(25/i,0)} Ω em locais húmidos, U<sub>L</sub> = 25 V). Recomendado R<sub>A</sub> ≤ 100 Ω.</p>`}else out.html=KB.find(k=>k.id==="dr").h();
  out.acts.push(["Ver no guia","cons","guia",{guia:"dr"}]);out.src.push(F("proj"),F("iec61008"));return out}
 // esquemas e protocolos
 const esq=/comutador|escada|lustre/.test(n)?"escada":/inversor|3 pontos|tres pontos/.test(n)?"inversor":/quadro|unifilar|\bqe\b/.test(n)?"quadro":/sensor|fotocel|crepusc|presenca|movimento/.test(n)?"sensor":null;
 if(esq){const s=ESQ2[esq];out.html=`<p><b>${s.t}</b></p><div class="esqwrap mini">${s.svg()}</div><ol>${s.passos.map(p=>`<li>${p}</li>`).join("")}</ol>`;out.acts.push(["Abrir esquema","cons","esq",{esq}]);return out}
 const pkey=p=>({"M-Bus":"mbus","DMX512":"dmx"})[p.n]||normQ(p.n).match(/[a-z]+/)[0];const nn=n.replace(/-/g,"");const pr=PROTO.find(p=>nn.includes(pkey(p))&&(!/tcp|ip\b/.test(n)||/tcp|ip/.test(normQ(p.n))));if(pr){const x=PX[pr.n]||{};
  if(/erro|problema|falha|nao funciona|avaria|nao responde|diagnost/.test(n)&&x.err)out.html=`<p><b>${pr.n} — erros frequentes</b></p><div class="pderr">${x.err.map(e=>`<div><b>⚠ ${e[0]}</b><span>✔ ${e[1]}</span></div>`).join("")}</div>`;
  else if(/vantage|desvantage|pros|contra|comparar|melhor/.test(n)&&x.pro)out.html=`<p><b>${pr.n}</b></p><div class="pdpc"><div class="pro"><h5>Vantagens</h5><ul>${x.pro.map(s=>`<li>${s}</li>`).join("")}</ul></div><div class="con"><h5>Desvantagens</h5><ul>${x.con.map(s=>`<li>${s}</li>`).join("")}</ul></div></div>`;
  else if(/exempl|como funciona|demonstr|funcionamento/.test(n)&&x.demo)out.html=`<p><b>${pr.n}</b> — ${x.ex}</p>${demoSvg(x.demo.n)}<ol class="pdst">${x.demo.p.map(s=>`<li>${s}</li>`).join("")}</ol>`;
  else out.html=`<p><b>${pr.n}</b> — ${pr.uso}.</p><table class="tt2">${[["Meio / cabo",pr.meio],["Velocidade",pr.vel],["Limites",pr.lim],["Topologia",pr.top],["Terminação",pr.term]].map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join("")}</table><p class="mut">Pergunta também «${esc(pr.n.split(" ")[0])} erros frequentes», «vantagens» ou «exemplo».</p>`;
  if(x.url)out.html+=`<p><a class="btn sm" href="${x.url}" target="_blank" rel="noopener">Ler mais — ${esc(x.site)} ↗</a></p>`;out.acts.push(["Tabela de protocolos","cons","auto",{auto:"tab"}]);out.src.push(pr.norma);return out}
 // procura no guia
 const hits=KB.map(k=>({k,s:score(k,n)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).slice(0,3);
 if(hits.length){const k=hits[0].k;if(k.go){out.html=`<p>Encontrei: <b>${k.t}</b>.</p>`;out.acts.push(["Abrir",k.go[0],k.go[1],k.go[0]==="cons"&&k.go[1]==="esq"?{esq:k.go[2]}:k.go[1]==="seg"?{segSub:k.go[2]}:{auto:k.go[2]}]);return out}
  out.html=`<p><b>${k.t}</b></p>${k.h()}`+(hits.length>1?`<p class="mut">Também relacionado: ${hits.slice(1).map(h=>`<button class="linkb" data-ask="${esc(h.k.t)}">${esc(h.k.t)}</button>`).join(" · ")}</p>`:"");if(k.calc)out.acts.push(["Abrir calculadora","calc",k.calc,{}]);out.src.push(F(k.f));return out}
 out.html=`<p>Ainda não sei responder a isso. Tenta com termos como <i>queda de tensão, disjuntor, tubo, diferencial, potência, cores, KNX, comutador de escada</i> — ou com números (ex.: <i>«que secção para 25 A a 40 m»</i>).</p><p class="mut">O assistente funciona só com o guia e as tabelas desta app, sem internet.</p>`;return out}
const QUICK=["SADI isoladores 32 dispositivos","Erros frequentes no Modbus RTU","Queda de tensão 16 A 35 m 2,5 mm²","Que secção para 32 A a 20 m?","Tubo para 5 cabos de 2,5 mm²","6,9 kVA trifásico quantos amperes?","Resistência de terra máxima com 30 mA","Que DR para placa de indução?","Cores dos condutores","Como ligar comutador de escada","DALI quantos dispositivos por linha?","Potência mínima T3 4 compartimentos"];
function pIA(B){B.innerHTML=`<div class="tecchat"><div class="tcmsgs" id="tcMsgs">${st.chat.length?"":`<div class="tcm bot"><p>Olá! Sou o assistente técnico. Respondo com base no guia e nas tabelas RTIEBT desta app — <b>sem internet</b>. Faz uma pergunta ou escolhe um atalho.</p></div>`}</div>
  <div class="tcquick">${QUICK.map(q=>`<button data-q="${esc(q)}">${esc(q)}</button>`).join("")}</div>
  <form class="tcin" id="tcF"><input id="tcQ" placeholder="Escreve a tua dúvida… (ex.: disjuntor para 20 A em 2,5 mm²)" autocomplete="off"><button class="btn primary">Perguntar</button></form>
  <p class="mut tcdisc">As respostas são de apoio didático: confirma sempre com o projeto, o técnico responsável e a edição em vigor das RTIEBT.</p></div>`;
 st.chat.forEach(m=>appendMsg(m,false));
 B.querySelectorAll("[data-q]").forEach(b=>b.onclick=()=>ask(b.dataset.q));$("tcF").onsubmit=e=>{e.preventDefault();const q=$("tcQ").value.trim();if(q){ask(q);$("tcQ").value=""}}}
/* abrir o assistente com uma pergunta (no TecFlow muda para a página do assistente) */
function toAsk(q){if(window.TEC&&typeof TEC.onGo==="function"&&TEC.onGo("ia",null,{q})!==false)return;st.tab="ia";render(root);ask(q)}
function ask(q){if(!$("tcMsgs")&&window.TEC&&typeof TEC.onGo==="function"&&TEC.onGo("ia",null,{q})!==false)return;if(!$("tcMsgs")){st.tab="ia";render(root)}const r=interpret(q);const m={q,r,at:now()};st.chat.push(m);st.chat=st.chat.slice(-30);appendMsg(m,true)}
function appendMsg(m,scroll){const box=$("tcMsgs");if(!box)return;const d=document.createElement("div");d.className="tcpair";
 d.innerHTML=`<div class="tcm me"><p>${esc(m.q)}</p></div><div class="tcm bot"><span class="tbav">${ic("ia")}</span>${m.r.html}${m.r.src.length?`<p class="tcsrc">Fonte: ${[...new Set(m.r.src)].map(esc).join(" · ")}</p>`:""}<div class="toolrow">${m.r.acts.map((a,i)=>`<button class="btn sm" data-act="${i}">${a[0]}</button>`).join("")}<button class="btn sm" data-sv="1">Guardar resposta</button></div></div>`;
 box.appendChild(d);d.querySelectorAll("[data-act]").forEach(b=>b.onclick=()=>{const a=m.r.acts[+b.dataset.act];if(a[1]==="calc"){st.pre=a[3]||{};goTec("calc",a[2])}else{const ex=a[3]||{};if(ex.esq)st.sub.esq=ex.esq;if(ex.auto)st.sub.auto=ex.auto;if(ex.segSub)st.sub.seg=ex.segSub;goTec("cons",a[2],ex.guia?{guia:ex.guia}:null)}});
 d.querySelectorAll("[data-ask]").forEach(b=>b.onclick=()=>ask(b.dataset.ask));
 d.querySelector("[data-sv]").onclick=()=>{const t=document.createElement("div");t.innerHTML=m.r.html;saveResult("Assistente: "+m.q,t.textContent.replace(/\s+/g," ").trim().slice(0,600),null,null)};
 if(scroll)d.scrollIntoView({block:"end",behavior:"smooth"})}

/* ---------------------------------------------------------
   8) INTERATIVO — esquemas que se podem ligar/desligar e simuladores de protocolos
   --------------------------------------------------------- */
const LV=(d,c,live,w=3)=>`<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" class="${live?"lv":"dd"}"/>`;
const lampI=(x,y,on)=>`<g class="lamp${on?" on":""}"><circle cx="${x}" cy="${y}" r="26" class="glow"/>${on?[0,45,90,135,180,225,270,315].map(a=>{const r=a*Math.PI/180;return`<line x1="${x+Math.cos(r)*21}" y1="${y+Math.sin(r)*21}" x2="${x+Math.cos(r)*29}" y2="${y+Math.sin(r)*29}" class="ray"/>`}).join(""):""}<circle cx="${x}" cy="${y}" r="16" class="bulb"/>${W(`M${x-11} ${y-11}L${x+11} ${y+11}M${x+11} ${y-11}L${x-11} ${y+11}`,C.K,2.5)}</g>`;
function comutI(x,y,lab,pos,fl,key){const f=fl?-1:1;return`<g class="sw" data-sw="${key}" role="button" tabindex="0" aria-label="${lab}: carregar para mudar"><rect x="${x-30}" y="${y-32}" width="60" height="64" rx="9" class="swb"/>${dot(x-14*f,y+18)}${dot(x+14*f,y-18)}${dot(x+14*f,y+18)}
 <line x1="${x-14*f}" y1="${y+18}" x2="${x+12*f}" y2="${pos?y+16:y-16}" class="lever"/>${Tx(x,y-40,lab,'text-anchor="middle"')}${Tx(x-14*f,y+46,"C",'text-anchor="middle"')}${Tx(x+(fl?-36:26),y-14,"1")}${Tx(x+(fl?-36:26),y+22,"2")}<text x="${x}" y="${y+62}" class="swhint">toca</text></g>`}
function inverI(x,y,lab,cross){return`<g class="sw" data-sw="x" role="button" tabindex="0" aria-label="${lab}: carregar para mudar"><rect x="${x-32}" y="${y-32}" width="64" height="64" rx="9" class="swb"/>${dot(x-16,y-18)}${dot(x-16,y+18)}${dot(x+16,y-18)}${dot(x+16,y+18)}
 ${cross?`<line x1="${x-16}" y1="${y-18}" x2="${x+16}" y2="${y+18}" class="lever"/><line x1="${x-16}" y1="${y+18}" x2="${x+16}" y2="${y-18}" class="lever"/>`:`<line x1="${x-16}" y1="${y-18}" x2="${x+16}" y2="${y-18}" class="lever"/><line x1="${x-16}" y1="${y+18}" x2="${x+16}" y2="${y+18}" class="lever"/>`}${Tx(x,y-40,lab,'text-anchor="middle"')}<text x="${x}" y="${y+50}" class="swhint">toca</text></g>`}
const ESQS={escada:{a:0,b:1},inversor:{a:0,x:0,b:1},sensor:{mov:0,dark:1,man:0},quadro:{dr:0,trip:{}}};
const IESQ={
 escada:s=>{const on=s.a===s.b;return{on,svg:`<svg viewBox="0 0 640 340" class="esq int" role="img">${legend}
  ${Tx(16,72,"L")}${LV("M36 68H110V218H156",C.L,1)}${LV("M198 182V130H436V182",C.T,s.a===0)}${LV("M198 218V262H436V218",C.T,s.a===1)}
  ${comutI(184,200,"Comutador 1",s.a,0,"a")}${comutI(450,200,"Comutador 2",s.b,1,"b")}
  ${LV("M464 218H540V186",C.L,on)}${lampI(540,160,on)}${LV("M540 134V96H600V300H36",C.N,on)}${Tx(16,304,"N")}
  ${Tx(300,122,"retorno 1",'text-anchor="middle"')}${Tx(300,282,"retorno 2",'text-anchor="middle"')}</svg>`,
  msg:on?`A lâmpada acende: os dois comutadores estão no <b>retorno ${s.a+1}</b> — a fase chega ao comum do comutador 2.`:`Apagada: o comutador 1 está no retorno ${s.a+1} e o comutador 2 no retorno ${s.b+1} — o circuito está aberto. Muda qualquer um para acender.`}},
 inversor:s=>{const idx=s.x?1-s.a:s.a,on=idx===s.b;return{on,svg:`<svg viewBox="0 0 640 340" class="esq int" role="img">${legend}
  ${Tx(16,72,"L")}${LV("M36 68H90V218H120",C.L,1)}${comutI(150,200,"Comutador",s.a,0,"a")}
  ${LV("M164 182V140H274V182",C.T,s.a===0)}${LV("M164 218V258H274V218",C.T,s.a===1)}${inverI(290,200,"Inversor",s.x)}
  ${LV("M306 182V140H416V182",C.T,idx===0)}${LV("M306 218V258H416V218",C.T,idx===1)}${comutI(430,200,"Comutador",s.b,1,"b")}
  ${LV("M444 218H540V186",C.L,on)}${lampI(540,160,on)}${LV("M540 134V96H600V300H36",C.N,on)}${Tx(16,304,"N")}</svg>`,
  msg:`${on?"Acesa":"Apagada"}: a fase sai do 1.º comutador pelo retorno ${s.a+1}, o inversor ${s.x?"<b>cruza</b>":"passa <b>direto</b>"} para o retorno ${idx+1} e o último comutador está no ${s.b+1}. Qualquer um dos três pontos muda o estado.`}},
 sensor:s=>{const on=!!(s.man||(s.mov&&s.dark));return{on,svg:`<svg viewBox="0 0 640 320" class="esq int" role="img">${legend}
  ${Tx(16,72,"L")}${LV("M36 68H200V150",C.L,1)}${Tx(16,292,"N")}${LV("M36 288H560V206",C.N,on)}${LV("M260 288V190",C.N,1)}
  <rect x="180" y="130" width="120" height="70" rx="10" class="swb"/>${Tx(240,122,"Sensor / fotocélula",'text-anchor="middle" font-weight="700"')}
  ${dot(200,150)}${dot(260,190)}${dot(280,150)}${Tx(194,176,"L")}${Tx(266,178,"N")}${Tx(286,146,"L'")}
  <circle cx="240" cy="168" r="9" class="${s.mov?"pir on":"pir"}"/>
  ${LV("M280 150H560V134",C.L,on&&(!s.man||(s.mov&&s.dark)))}${lampI(560,160,on)}
  ${LV("M120 68V100H378",C.L,1,2)}${LV("M422 100H560V134",C.L,!!s.man,2)}
  <g class="sw" data-sw="man" role="button" tabindex="0"><rect x="378" y="86" width="44" height="28" rx="6" class="swb${s.man?" act":""}"/><line x1="384" y1="100" x2="${s.man?416:410}" y2="${s.man?100:90}" class="lever"/></g>${Tx(400,80,"interruptor «forçar»",'text-anchor="middle" font-size="11"')}
  ${!s.dark?`<g class="sun"><circle cx="90" cy="200" r="14"/>${[0,60,120,180,240,300].map(a=>{const r=a*Math.PI/180;return`<line x1="${90+Math.cos(r)*19}" y1="${200+Math.sin(r)*19}" x2="${90+Math.cos(r)*26}" y2="${200+Math.sin(r)*26}"/>`}).join("")}</g>`:`<path d="M100 186a16 16 0 1 0 0 28a12 12 0 1 1 0-28z" class="moon"/>`}</svg>`,
  msg:on?(s.man?"Acesa pelo interruptor em paralelo (forçar ligado).":"Acesa: há movimento e está escuro — o relé do sensor fecha L → L'."):`Apagada: ${!s.dark?"há luz do dia (a fotocélula bloqueia)":"sem movimento detetado"}.`}},
 quadro:s=>{const cs=[["il","Iluminação","10 A","1,5"],["tm","Tomadas","16 A","2,5"],["tc","Tomadas cozinha","16 A","2,5"],["ml","Máq. lavar","16 A","2,5"],["tr","Termo.","16 A","2,5"],["fg","Fogão/placa","32 A","6"]];
  const live=!s.dr;return{on:live,svg:`<svg viewBox="0 0 640 404" class="esq int" role="img">
   ${Tx(20,30,"Rede E-REDES → contador → DCP")}${LV("M60 40V70",C.L,1)}
   <rect x="30" y="70" width="60" height="44" rx="6" class="swb"/>${Tx(60,96,"IG",'text-anchor="middle" font-weight="700"')}${Tx(100,96,"Interruptor geral")}
   ${LV("M60 114V140",C.L,1)}<g class="sw" data-sw="dr" role="button" tabindex="0"><rect x="30" y="140" width="60" height="44" rx="6" class="swb ${s.dr?"trip":"ok"}"/>${Tx(60,160,"DR",'text-anchor="middle" font-weight="700"')}${Tx(60,176,s.dr?"OFF":"30 mA",'text-anchor="middle" font-size="10"')}</g>${Tx(100,160,s.dr?"Diferencial disparou — toca para rearmar":"Diferencial 40 A / 30 mA")}
   ${LV("M60 184V214H"+(60+(cs.length-1)*100),C.L,live)}
   ${cs.map((c,i)=>{const x=60+i*100,t=!!s.trip[c[0]],on=live&&!t;return`${LV(`M${x} 214V236`,C.L,live)}<g class="sw" data-sw="cb:${c[0]}" role="button" tabindex="0"><rect x="${x-28}" y="236" width="56" height="42" rx="6" class="swb ${t?"trip":on?"ok":""}"/>${Tx(x,256,c[2],'text-anchor="middle" font-weight="700"')}${Tx(x,271,t?"OFF":"ON",'text-anchor="middle" font-size="10"')}</g>${LV(`M${x} 278V306`,C.L,on)}<circle cx="${x}" cy="314" r="6" class="${on?"pt on":"pt"}"/>${Tx(x,336,c[1],'text-anchor="middle" font-size="12"')}${Tx(x,352,c[3]+" mm²",'text-anchor="middle" font-size="11" class="sv mutd"')}`}).join("")}
   ${W("M30 392H610",C.PE,4)}${Tx(30,382,"Barramento de terra (PE)",'font-size="12"')}</svg>`,
  msg:s.dr?"O diferencial cortou todos os circuitos a jusante (defeito à terra). Primeiro elimina o defeito; depois toca no DR para rearmar.":Object.keys(s.trip).filter(k=>s.trip[k]).length?"Um disjuntor disparou: só esse circuito ficou sem energia. Toca nele para rearmar.":"Tudo ligado. Simula avarias com os botões abaixo, ou toca num disjuntor para o desligar."}}
};
const ESQ_ACTS={quadro:[["Defeito à terra nas tomadas","dr"],["Sobrecarga no fogão","cb:fg"],["Curto-circuito na iluminação","cb:il"],["Rearmar tudo","reset"]],sensor:[["Passar alguém","mov"],["Dia / noite","dark"]],escada:[["Comutador 1","a"],["Comutador 2","b"]],inversor:[["Comutador","a"],["Inversor","x"],["Comutador","b"]]};
kEsq=function(E){const k=st.sub.esq;const s=ESQ2[k];const S0=ESQS[k];
 E.innerHTML=`<div class="tecsub sm">${Object.entries(ESQ2).map(([kk,v])=>`<button data-e="${kk}" class="${kk===k?"on":""}">${v.t.split(" — ")[0].split(" (")[0]}</button>`).join("")}</div>
  <section class="block esqint"><h2>${s.t} <span class="livetag">● interativo</span></h2><div class="esqwrap" id="esqW"></div><div class="esqmsg" id="esqM"></div>
  <div class="esqacts">${(ESQ_ACTS[k]||[]).map(a=>`<button class="btn sm" data-ea="${a[1]}">${a[0]}</button>`).join("")}<button class="btn sm" data-ea="sim">▶ Demonstração automática</button></div>
  <div class="tec2"><div><h5>Como ligar</h5><ol>${s.passos.map(p=>`<li>${p}</li>`).join("")}</ol></div><div><h5>Erros comuns</h5><ul class="terr">${s.erros.map(p=>`<li>${p}</li>`).join("")}</ul><p class="mut">${s.mat}</p></div></div>
  <div class="toolrow"><button class="btn sm" id="eAsk">Perguntar sobre este esquema</button></div></section>`;
 let auto=null;
 const act=key=>{if(key==="mov"){S0.mov=1;clearTimeout(S0._t);S0._t=setTimeout(()=>{S0.mov=0;draw()},4000)}else if(key==="dark")S0.dark=S0.dark?0:1;else if(key==="man")S0.man=S0.man?0:1;
  else if(key==="reset"){S0.dr=0;S0.trip={}}else if(key==="dr"&&k==="quadro")S0.dr=S0.dr?0:1;else if(key.startsWith("cb:")){const c=key.slice(3);S0.trip[c]=!S0.trip[c]}else if(key in S0)S0[key]=S0[key]?0:1;draw()};
 const draw=()=>{const r=IESQ[k](S0);const w=$("esqW");if(!w)return;w.innerHTML=r.svg;$("esqM").innerHTML=`<span class="${r.on?"led on":"led"}"></span>${r.msg}`;
  w.querySelectorAll("[data-sw]").forEach(g=>{g.onclick=()=>{stopAuto();act(g.dataset.sw)};g.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();act(g.dataset.sw)}}})};
 const stopAuto=()=>{if(auto){clearInterval(auto);auto=null;const b=E.querySelector('[data-ea="sim"]');if(b)b.textContent="▶ Demonstração automática"}};
 E.querySelectorAll("[data-ea]").forEach(b=>b.onclick=()=>{if(b.dataset.ea!=="sim"){stopAuto();act(b.dataset.ea);return}
  if(auto){stopAuto();return}b.textContent="■ Parar demonstração";const seq=(ESQ_ACTS[k]||[]).map(a=>a[1]).filter(x=>x!=="reset");let i=0;auto=setInterval(()=>{if(!document.body.contains(b)){stopAuto();return}act(seq[i++%seq.length])},1800)});
 E.querySelectorAll("[data-e]").forEach(b=>b.onclick=()=>{stopAuto();st.sub.esq=b.dataset.e;kEsq(E)});$("eAsk").onclick=()=>{stopAuto();toAsk(s.t)};draw()};

/* ---------- simuladores de protocolos ---------- */
const crc16=b=>{let c=0xFFFF;for(const x of b){c^=x;for(let i=0;i<8;i++)c=c&1?(c>>1)^0xA001:c>>1}return[c&255,c>>8]};
const hx=a=>a.map(x=>x.toString(16).toUpperCase().padStart(2,"0")).join(" ");
const SIMS={
 "KNX TP":{nodes:[["PS","Fonte 640 mA"],["B1","Botão sala 1 · 1.1.3"],["B2","Botão sala 2 · 1.1.4"],["AT","Atuador 1.1.10"],["VS","Visor 1.1.20"]],
  st:()=>({l1:0,l2:0}),faults:[["pol","Polaridade trocada no botão 1.1.3"],["ps","Fonte KNX desligada"],["dup","Endereço físico 1.1.4 duplicado"]],
  ctl:s=>`<button class="btn sm primary" data-a="b1">Carregar botão sala 1</button><button class="btn sm primary" data-a="b2">Carregar botão sala 2</button><button class="btn sm" data-a="rd">Ler estado (visor)</button>`,
  out:s=>`<div class="simouts"><div class="so ${s.l1?"on":""}"><i></i>Sala 1 · 1/0/1</div><div class="so ${s.l2?"on":""}"><i></i>Sala 2 · 1/0/2</div></div>`,
  act:async(a,s,F,ui)=>{if(F.ps){ui.log("✗ Sem tensão no bus (0 V) — nenhum dispositivo comunica. Verificar a fonte.","err");ui.flash("PS","bad");return}
   if(a==="rd"){await ui.send("VS","*","GroupValueRead 1/0/101");await ui.send("AT","VS",`GroupValueResponse 1/0/101 = ${s.l1?"ON":"OFF"} · 1/0/102 = ${s.l2?"ON":"OFF"}`);return}
   const B=a==="b1"?"B1":"B2",g=a==="b1"?"1/0/1":"1/0/2",k=a==="b1"?"l1":"l2";
   if(a==="b1"&&F.pol){ui.log("✗ 1.1.3 sem bus (polaridade trocada): mede-se −29 V. Trocar vermelho/preto.","err");ui.flash("B1","bad");return}
   s[k]=s[k]?0:1;await ui.send(B,"*",`${a==="b1"?"1.1.3":"1.1.4"} → ${g} GroupValueWrite ${s[k]?"ON":"OFF"}`,{short:`${g} ${s[k]?"ON":"OFF"}`,title:"Telegrama KNX",f:[["Origem (end. físico)",a==="b1"?"1.1.3":"1.1.4","#e8a317"],["Destino (grupo)",g,"#0891b2"],["Serviço","GroupValueWrite","#7c3aed"],["Tipo de dado","DPT 1.001 (on/off)","#64748b"],["Valor",s[k]?"1 = ON":"0 = OFF",s[k]?"#16a34a":"#dc2626"]]});
   if(a==="b2"&&F.dup){ui.log("⚠ Dois dispositivos responderam como 1.1.4 — colisão; ETS: «Verificar endereço físico».","warn");ui.flash("B2","bad")}
   ui.flash("AT","ok");ui.out();await ui.send("AT","*",`1.1.10 → 1/0/10${a==="b1"?1:2} estado ${s[k]?"ON":"OFF"}`,{short:`estado ${s[k]?"ON":"OFF"}`})}},
 "DALI / DALI-2":{nodes:[["CT","Controlador + fonte DALI"],["L0","Luminária 0 · G1"],["L1","Luminária 1 · G1"],["L2","Luminária 2 · G2"],["L3","Luminária 3 · G2"],["L4","Luminária 4 · G2"]],
  st:()=>({lv:[0,0,0,0,0],g:"0"}),faults:[["nops","Sem fonte do bus DALI"],["vd","Queda de tensão > 2 V (linha longa)"],["drv","Driver da luminária 4 avariado"]],
  ctl:s=>`<label class="simf">Destino<select data-k="g"><option value="0">Todos (broadcast)</option><option value="1">Grupo 1</option><option value="2">Grupo 2</option></select></label><label class="simf">Nível <b data-v>60%</b><input type="range" min="0" max="100" step="5" value="60" data-k="lv"></label><button class="btn sm primary" data-a="go">Enviar</button><button class="btn sm" data-a="q">Perguntar avarias</button>`,
  out:s=>`<div class="simouts">${s.lv.map((v,i)=>`<div class="so lum ${v?"on":""}" style="--l:${v/100}"><i></i>L${i} · ${v}%</div>`).join("")}</div>`,
  act:async(a,s,F,ui,c)=>{if(F.nops){ui.log("✗ Bus DALI sem tensão (0 V): nenhuma luminária responde. Ligar uma fonte DALI (≈16 V, ≤250 mA).","err");ui.flash("CT","bad");return}
   if(a==="q"){await ui.send("CT","*","QUERY LAMP FAILURE (broadcast)");if(F.drv){await ui.send("L4","CT","Resposta: sim — avaria na luminária 4");ui.flash("L4","bad")}else ui.log("Sem respostas: nenhuma avaria.","ok");return}
   const g=c.g||"0",lv=+c.lv;const tgt=[0,1,2,3,4].filter(i=>g==="0"||(g==="1"?i<2:i>=2));await ui.send("CT","*",`DAPC ${g==="0"?"broadcast":"grupo "+g} → ${lv}%`,{short:`${g==="0"?"todos":"G"+g} ${lv}%`,title:"Comando DALI (forward frame 16 bits)",f:[["Endereço",g==="0"?"FE (broadcast)":`${(0x80|((+g-1)<<1)).toString(16).toUpperCase()} (grupo ${g})`,"#e8a317"],["Nível (arc power)",String(Math.round(lv/100*254))+" de 254","#0891b2"],["Percentagem",lv+"%","#16a34a"]]});
   for(const i of tgt){if(F.vd&&i>=3){ui.log(`✗ L${i} não recebeu (tensão < 9,5 V no fim da linha). Aumentar secção/encurtar.`,"err");ui.flash("L"+i,"bad");continue}if(F.drv&&i===4){ui.flash("L4","bad");continue}s.lv[i]=lv;ui.flash("L"+i,"ok")}ui.out()}},
 "Modbus RTU":{nodes:[["M","Mestre (GTC)"],["S1","Analisador 1"],["S2","Analisador 2"],["S3","Analisador 3"],["S4","Analisador 4"]],
  st:()=>({}),faults:[["ab","Fios A/B trocados"],["term","Sem terminação de 120 Ω"],["baud","Analisador 3 com outra velocidade"],["dup","Analisadores 2 e 4 com o mesmo endereço"]],
  ctl:s=>`<label class="simf">Escravo<select data-k="id"><option>1</option><option>2</option><option>3</option><option>4</option></select></label><label class="simf">Registo<select data-k="reg"><option value="3000">3000 Tensão (V)</option><option value="3002">3002 Corrente (A)</option><option value="3004">3004 Energia (kWh)</option></select></label><button class="btn sm primary" data-a="go">Ler (função 03)</button>`,
  out:s=>"",
  act:async(a,s,F,ui,c)=>{const id=+c.id||1,reg=+c.reg||3000;const req=[id,3,reg>>8,reg&255,0,2];const fr=[...req,...crc16(req)];
   await ui.send("M","S"+id,`TX ${hx(fr)}  (escravo ${id}, função 03, registo ${reg}, 2 registos)`,{short:"→ escravo "+id,title:"Pedido Modbus RTU",f:[["Escravo",hx([id]),"#e8a317"],["Função","03 ler registos","#7c3aed"],["Registo",hx([reg>>8,reg&255])+" ("+reg+")","#0891b2"],["Quantidade","00 02","#64748b"],["CRC16",hx(crc16(req)),"#16a34a"]]});
   if(F.ab){ui.log("✗ Timeout: nenhum escravo entende a trama (A/B trocados). Trocar os dois fios.","err");ui.flash("S"+id,"bad");return}
   if(F.baud&&id===3){ui.log("✗ Timeout no escravo 3: velocidade/paridade diferentes. Igualar a todos (ex.: 9600 8N1).","err");ui.flash("S3","bad");return}
   if(F.dup&&(id===2||id===4)){await ui.send("S2","M","RX ?? ?? ?? (duas respostas ao mesmo tempo)");ui.log("✗ Erro de CRC: dois escravos responderam (endereço duplicado). Dar endereços únicos.","err");ui.flash("S4","bad");return}
   const val=reg===3000?230+id*0.7:reg===3002?5+id*1.3:1200+id*311;const f32=new DataView(new ArrayBuffer(4));f32.setFloat32(0,val);const by=[0,1,2,3].map(i=>f32.getUint8(i));
   let resp=[id,3,4,...by];resp=[...resp,...crc16(resp)];if(F.term&&Math.random()<.5){resp[5]^=0x20;await ui.send("S"+id,"M",`RX ${hx(resp)}`);ui.log("✗ CRC inválido (reflexões no cabo sem terminação). Pôr 120 Ω nas duas pontas.","err");return}
   await ui.send("S"+id,"M",`RX ${hx(resp)}`,{short:"resposta",title:"Resposta Modbus RTU",f:[["Escravo",hx([id]),"#e8a317"],["Função","03","#7c3aed"],["Bytes","04","#64748b"],["Dados (float)",hx(by),"#0891b2"],["CRC16",hx(resp.slice(-2)),"#16a34a"],["Valor",val.toLocaleString("pt-PT",{maximumFractionDigits:1})+(reg===3000?" V":reg===3002?" A":" kWh"),"#dc2626"]]});ui.log(`✓ Valor (float): ${val.toLocaleString("pt-PT",{maximumFractionDigits:1})} ${reg===3000?"V":reg===3002?"A":"kWh"}`,"ok");ui.flash("S"+id,"ok")}},
 "Modbus TCP":{nodes:[["C","SCADA 192.168.1.10"],["SW","Switch"],["GW","Gateway 192.168.1.50 :502"],["S1","Analisador (Unit 1)"],["S2","Analisador (Unit 2)"]],
  st:()=>({}),faults:[["ip","IP da gateway errado no SCADA"],["fw","Firewall a bloquear a porta 502"],["uid","Unit ID errado"]],
  ctl:s=>`<label class="simf">Unit ID<select data-k="id"><option>1</option><option>2</option></select></label><button class="btn sm primary" data-a="go">Ler registo 3000</button>`,out:s=>"",
  act:async(a,s,F,ui,c)=>{const id=+c.id||1;if(F.ip){await ui.send("C","SW","TCP SYN → 192.168.1.55:502");ui.log("✗ Sem resposta: IP errado. Confirmar IP/máscara (ping).","err");return}
   await ui.send("C","GW",`MBAP 00 01 00 00 00 06 ${hx([F.uid?9:id])} | 03 0B B8 00 02`);if(F.fw){ui.log("✗ Ligação recusada: porta 502 bloqueada pela firewall.","err");ui.flash("SW","bad");return}
   if(F.uid){ui.log("✗ Exceção 0B (gateway target failed): Unit ID 9 não existe no RS-485.","err");ui.flash("GW","bad");return}
   await ui.send("GW","S"+id,"RTU → escravo "+id);await ui.send("S"+id,"GW","resposta");await ui.send("GW","C",`MBAP … 03 04 43 66 B3 33  → ${(230+id*.7).toFixed(1)} V`);ui.log("✓ Leitura OK","ok")}},
 "BACnet MS/TP · BACnet/IP":{nodes:[["G","GTC (BACnet/IP)"],["R","Router / BBMD"],["D1","UTA · Device 1201"],["D2","Chiller · Device 1202"],["D3","Quadro AVAC · 1203"]],
  st:()=>({}),faults:[["dup","Device 1203 com instância duplicada (1202)"],["bbmd","Sem BBMD (outra sub-rede)"]],
  ctl:s=>`<button class="btn sm primary" data-a="who">Who-Is (descobrir)</button><button class="btn sm" data-a="rp">ReadProperty AI-1 da UTA</button><button class="btn sm" data-a="cov">Subscrever COV</button>`,out:s=>"",
  act:async(a,s,F,ui)=>{if(F.bbmd){await ui.send("G","R","Who-Is (broadcast)");ui.log("✗ O broadcast não passa para a sub-rede dos equipamentos: configurar BBMD / Foreign Device.","err");ui.flash("R","bad");return}
   if(a==="who"){await ui.send("G","*","Who-Is");await ui.send("D1","G","I-Am 1201");await ui.send("D2","G","I-Am 1202");await ui.send("D3","G",`I-Am ${F.dup?1202:1203}`);if(F.dup){ui.log("⚠ Duas respostas «1202»: a GTC alterna entre equipamentos. Instância única por dispositivo.","warn");ui.flash("D3","bad")}else ui.log("✓ 3 dispositivos encontrados","ok");return}
   if(a==="rp"){await ui.send("G","D1","ReadProperty AI-1 Present_Value");await ui.send("D1","G","ComplexAck 7,2 °C");ui.flash("D1","ok");return}
   await ui.send("G","D1","SubscribeCOV AI-1 (60 min)");await ui.send("D1","G","SimpleAck");setTimeout(()=>ui.send("D1","G","COV-Notification AI-1 = 7,8 °C"),1500)}},
 "DMX512":{nodes:[["CT","Controlador DMX"],["F1","Projetor 1 · DMX 1"],["F2","Projetor 2 · DMX 4"],["F3","Projetor 3 · DMX 7"],["F4","Projetor 4 · DMX 10"]],
  st:()=>({c:[[0,0,0],[0,0,0],[0,0,0],[0,0,0]]}),faults:[["term","Sem terminador de 120 Ω"],["ovl","Projetor 2 com o endereço 1 (sobreposto)"]],
  ctl:s=>`<label class="simf">Projetor<select data-k="f"><option value="0">1</option><option value="1">2</option><option value="2">3</option><option value="3">4</option><option value="all">Todos</option></select></label><label class="simf">R<input type="range" min="0" max="255" value="255" data-k="r"></label><label class="simf">G<input type="range" min="0" max="255" value="120" data-k="gg"></label><label class="simf">B<input type="range" min="0" max="255" value="0" data-k="b"></label><button class="btn sm primary" data-a="go">Enviar universo</button>`,
  out:s=>`<div class="simouts">${s.c.map((c,i)=>`<div class="so rgb ${c.some(Boolean)?"on":""}" style="--c:rgb(${c.join(",")})"><i></i>P${i+1} · ${c.join("/")}</div>`).join("")}</div>`,
  act:async(a,s,F,ui,c)=>{const v=[+c.r,+c.gg,+c.b];const tg=c.f==="all"?[0,1,2,3]:[+c.f];tg.forEach(i=>s.c[i]=v.slice());if(F.ovl)s.c[1]=s.c[0].slice();
   await ui.send("CT","*",`Universo: canais ${tg.map(i=>`${i*3+1}-${i*3+3}=${v.join("/")}`).join(" · ")}`);ui.out();
   if(F.ovl)ui.log("⚠ O projetor 2 copia o 1: endereços sobrepostos. Projetor 2 deve começar no canal 4.","warn");
   if(F.term){ui.log("✗ Sem terminador: reflexões — as cores tremem. Pôr 120 Ω no último aparelho.","err");let n=0;const t=setInterval(()=>{s.c=s.c.map(x=>x.map(y=>Math.max(0,Math.min(255,y+(Math.random()*120-60)|0))));ui.out();if(++n>8)clearInterval(t)},180)}}},
 "M-Bus":{nodes:[["M","Mestre M-Bus"],["A1","Água · end. 1"],["A2","Água · end. 2"],["T3","Térmico · end. 3"],["T4","Térmico · end. 4"]],
  st:()=>({r:{}}),faults:[["pow","Mestre subdimensionado (poucas cargas)"],["dup","Contadores 2 e 3 com o mesmo endereço"]],
  ctl:s=>`<button class="btn sm primary" data-a="all">Ler todos os contadores</button>`,
  out:s=>`<div class="simouts">${["A1","A2","T3","T4"].map(k=>`<div class="so ${s.r[k]?"on":""}"><i></i>${k} · ${s.r[k]||"—"}</div>`).join("")}</div>`,
  act:async(a,s,F,ui)=>{s.r={};ui.out();const L=[["A1",1,"152,3 m³"],["A2",2,"98,7 m³"],["T3",3,"4 512 kWh"],["T4",4,"3 980 kWh"]];
   for(const[k,ad,v]of L){await ui.send("M",k,`REQ_UD2 → end. ${ad}`);if(F.pow&&ad>=3){ui.log(`✗ End. ${ad} sem resposta: tensão do bus baixa (cargas a mais). Mestre maior ou repetidor.`,"err");ui.flash(k,"bad");continue}
    if(F.dup&&ad===2){await ui.send("A2","M","RSP ?? (colisão)");ui.log("✗ Colisão: dois contadores responderam ao end. 2 — usar endereço secundário (n.º de série).","err");ui.flash("T3","bad");continue}
    await ui.send(k,"M",`RSP_UD ${v}`);s.r[k]=v;ui.flash(k,"ok");ui.out()}}}
};
const NICO={ps:'<path d="M13 2 5 13h6l-1 9 8-11h-6z"/>',btn:'<rect x="5" y="5" width="14" height="14" rx="3"/><circle cx="12" cy="12" r="3"/>',act:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 4v6M12 4v6M16 4v6M8 14h8"/>',
 disp:'<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M9 21h6M12 17v4"/>',ctl:'<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M7 20h10M8 9h3M8 12h8"/>',lum:'<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
 meter:'<circle cx="12" cy="13" r="8"/><path d="m12 13 3-4M8 5l1 2M16 5l-1 2"/>',net:'<rect x="3" y="9" width="18" height="6" rx="1"/><path d="M7 12h0M11 12h0M15 12h0"/>',gw:'<path d="M4 12h16M14 6l6 6-6 6M10 6 4 12l6 6"/>',
 proj:'<path d="M4 9h10l6-4v14l-6-4H4z"/>',hvac:'<circle cx="12" cy="12" r="8"/><path d="M12 4c2 3 2 5 0 8s-2 5 0 8M4 12c3-2 5-2 8 0s5 2 8 0"/>'};
const ntype=l=>/fonte/i.test(l)?"ps":/bot[aã]o/i.test(l)?"btn":/atuador/i.test(l)?"act":/visor/i.test(l)?"disp":/lumin/i.test(l)?"lum":/analisador|contador|água|térmico|agua/i.test(l)?"meter":/switch|router/i.test(l)?"net":/gateway/i.test(l)?"gw":/projetor/i.test(l)?"proj":/uta|chiller|quadro/i.test(l)?"hvac":"ctl";
function simHtml(p){const S=SIMS[p.n];if(!S)return"";const n=S.nodes.length;const W=640,sp=(W-130)/(n-1);
 return`<div class="sim" data-sim="${esc(p.n)}"><div class="simwrap"><svg class="simbus" viewBox="0 0 ${W} 132" role="img"><line x1="22" y1="108" x2="${W-22}" y2="108" class="sb-l"/><line x1="22" y1="114" x2="${W-22}" y2="114" class="sb-l2"/>
  ${S.nodes.map((nd,i)=>{const x=65+i*sp;const [a,b]=nd[1].split(" · ");return`<g class="sb-n" data-n="${nd[0]}" transform="translate(${x},0)"><line x1="0" y1="74" x2="0" y2="108" class="sb-t"/><circle cx="0" cy="108" r="3.5" class="sb-j"/><rect x="-52" y="8" width="104" height="66" rx="12" class="sb-b"/>
   <g transform="translate(-11,14)"><svg width="22" height="22" viewBox="0 0 24 24" class="sb-ic">${NICO[ntype(nd[1])]}</svg></g><text x="0" y="${b?52:56}" class="sb-tx">${esc(a.length>16?a.slice(0,15)+"…":a)}</text>${b?`<text x="0" y="66" class="sb-tx s">${esc(b)}</text>`:""}<circle cx="42" cy="18" r="4" class="sb-led"/></g>`}).join("")}
  <g class="sb-pk" transform="translate(-60,0)"><rect x="-34" y="80" width="68" height="16" rx="8" class="sb-pkb"/><text x="0" y="91.5" class="sb-pkl"></text><circle r="7" cx="0" cy="108" class="sb-pkd"/></g></svg></div>
  <div class="simtg" hidden></div>
  <div class="simpanel"><div class="simctl">${S.ctl({})}</div><div class="simout"></div></div>
  <details class="simf2"><summary>⚠ Simular avarias <small>(ativa um erro e vê o sintoma)</small></summary><div class="simfl">${S.faults.map(f=>`<label class="fsw"><input type="checkbox" data-f="${f[0]}"><span class="tg"></span>${f[1]}</label>`).join("")}</div></details>
  <div class="simlog" aria-live="polite"><div class="sl-h"><span>monitor do bus</span><button type="button" class="sl-clr" title="Limpar">limpar</button></div></div></div>`}
function wireSims(root){root.querySelectorAll("[data-sim]").forEach(el=>{if(el._w)return;el._w=1;const S=SIMS[el.dataset.sim];const s=S.st();const F={};const n=S.nodes.length,W=640,sp=(W-130)/(n-1);
 const X=id=>{const i=S.nodes.findIndex(x=>x[0]===id);return 65+i*sp};const pk=el.querySelector(".sb-pk");const log=el.querySelector(".simlog");let busy=false;
 const ui={log:(t,k)=>{const d=document.createElement("div");d.className="sl "+(k||"");d.innerHTML=`<time>${new Date().toLocaleTimeString("pt-PT")}</time>${esc(t).replace(/^([✓✗⚠])/,"<b>$1</b>")}`;log.appendChild(d);while(log.children.length>40)log.children[1].remove();log.scrollTop=log.scrollHeight;d.classList.add("new")},
  flash:(id,k)=>{const g=el.querySelector(`[data-n="${id}"]`);if(!g)return;g.classList.remove("ok","bad");void g.getBBox();g.classList.add(k);setTimeout(()=>g.classList.remove(k),1400)},
  send:(a,b,t,fl)=>new Promise(res=>{ui.log(t,"tx");const x0=X(a),x1=b==="*"?null:X(b);pk.setAttribute("class","sb-pk "+(b==="*"?"bc":""));
   const lab=(fl&&fl.short)||String(t).replace(/^(TX|RX)\s*/,"").split(/[ (]/).slice(0,2).join(" ");pk.querySelector(".sb-pkl").textContent=lab.slice(0,14);
   if(fl&&fl.f){const tg=el.querySelector(".simtg");tg.hidden=false;tg.innerHTML=`<span class="tgk">${esc(fl.title||"Trama")}</span>${fl.f.map(x=>`<span class="tgf" style="--c:${x[2]||"#0891b2"}"><small>${esc(x[0])}</small><b>${esc(x[1])}</b></span>`).join("")}`}
   const kf=b==="*"?[x0,22,W-22,x0]:[x0,x1];const dur=b==="*"?1100:Math.max(450,Math.abs(x1-x0)*1.9);
   const ga=el.querySelector(`[data-n="${a}"]`);ga&&ga.classList.add("tx");
   try{const an=pk.animate(kf.map(c=>({transform:`translate(${c}px,0)`})),{duration:dur,easing:"cubic-bezier(.45,.05,.35,1)"});an.onfinish=()=>{pk.setAttribute("transform","translate(-60,0)");pk.style.transform="";ga&&ga.classList.remove("tx");if(b!=="*")ui.flash(b,"rx");else el.querySelectorAll(".sb-n").forEach(g=>{if(g!==ga){g.classList.add("rx");setTimeout(()=>g.classList.remove("rx"),500)}});res()}}catch(e){ga&&ga.classList.remove("tx");res()}}),
  out:()=>{el.querySelector(".simout").innerHTML=S.out(s)}};
 ui.out();ui.log("Pronto. Usa os botões para enviar telegramas; em «Simular avarias» vês o que acontece com os erros mais comuns.","");
 el.querySelector(".sl-clr").onclick=()=>{[...log.querySelectorAll(".sl")].forEach(x=>x.remove())};
 const ctl=()=>{const c={};el.querySelectorAll(".simctl [data-k]").forEach(i=>c[i.dataset.k]=i.value);return c};
 el.querySelectorAll(".simctl input[type=range]").forEach(r=>r.oninput=()=>{const v=r.parentElement.querySelector("[data-v]");if(v)v.textContent=r.value+"%"});
 el.querySelectorAll("[data-f]").forEach(c=>c.onchange=()=>{F[c.dataset.f]=c.checked;ui.log((c.checked?"Avaria ativada: ":"Avaria removida: ")+c.parentElement.textContent.trim(),c.checked?"warn":"ok")});
 el.querySelectorAll(".simctl [data-a]").forEach(b=>b.onclick=async()=>{if(busy)return;busy=true;el.classList.add("busy");try{await S.act(b.dataset.a,s,F,ui,ctl())}finally{busy=false;el.classList.remove("busy")}})})}
/* acrescenta o separador «Simular» a cada protocolo */
const protoDetailBase=protoDetail;
protoDetail=function(p){let h=protoDetailBase(p);if(!SIMS[p.n])return h;
 h=h.replace('<button type="button" data-pdt="car" class="on">Características</button>','<button type="button" data-pdt="sim" class="on sim">▶ Simular</button><button type="button" data-pdt="car">Características</button>');
 h=h.replace('<div class="pdp" data-pdp="car">','<div class="pdp" data-pdp="sim">'+simHtml(p)+'</div><div class="pdp" data-pdp="car" hidden>');return h};
const wireProtoBase=wireProto;wireProto=function(root){wireProtoBase(root);wireSims(root)};

/* ---------------------------------------------------------
   9) BANCADA DE LIGAÇÕES — simulador quase real: liga os bornes com 2 toques,
      liga o disjuntor e vê se funciona (com diagnóstico de erros reais)
   --------------------------------------------------------- */
const WCOL={L:["Castanho","#7a4a21"],K:["Preto","#1f2937"],G:["Cinzento","#8a8f94"],N:["Azul","#2f7fd0"],PE:["Verde/amarelo","#2e9d4b"],R:["Vermelho","#dc2626"]};
/* aparelhos: cada borne tem id, posição e papel (para a cor automática) */
const DEV={
 sup:(x,y)=>({w:150,h:120,k:"sup",title:"Quadro · circuito 10 A",t:[["L",x+30,y+120,"L","L"],["N",x+75,y+120,"N","N"],["PE",x+120,y+120,"PE","PE"]]}),
 sw:(x,y,id,lab)=>({w:96,h:110,k:"sw",title:lab||"Interruptor",t:[["L",x+28,y+110,"L","L"],["1",x+68,y+110,"1","K"]]}),
 com:(x,y,id,lab)=>({w:110,h:110,k:"com",title:lab||"Comutador",t:[["C",x+22,y+110,"C","L"],["1",x+55,y+110,"1","K"],["2",x+88,y+110,"2","G"]]}),
 inv:(x,y)=>({w:120,h:110,k:"inv",title:"Inversor",t:[["E1",x+18,y+110,"E1","K"],["E2",x+46,y+110,"E2","G"],["S1",x+74,y+110,"S1","K"],["S2",x+102,y+110,"S2","G"]]}),
 lamp:(x,y)=>({w:120,h:120,k:"lamp",title:"Luminária",t:[["L",x+25,y+120,"L","L"],["N",x+60,y+120,"N","N"],["PE",x+95,y+120,"PE","PE"]]}),
 sock:(x,y)=>({w:120,h:120,k:"sock",title:"Tomada schuko",t:[["L",x+25,y+120,"L","L"],["N",x+60,y+120,"N","N"],["PE",x+95,y+120,"PE","PE"]]}),
 sens:(x,y)=>({w:120,h:110,k:"sens",title:"Sensor de movimento",t:[["L",x+25,y+110,"L","L"],["N",x+60,y+110,"N","N"],["Ls",x+95,y+110,"L'","K"]]}),
 kps:(x,y)=>({w:120,h:110,k:"kps",title:"Fonte KNX",t:[["L",x+18,y+110,"L","L"],["N",x+44,y+110,"N","N"],["P",x+80,y+110,"+","R"],["M",x+104,y+110,"−","K"]]}),
 kbt:(x,y)=>({w:96,h:110,k:"kbt",title:"Botão KNX",t:[["P",x+30,y+110,"+","R"],["M",x+66,y+110,"−","K"]]}),
 kac:(x,y)=>({w:130,h:110,k:"kac",title:"Atuador KNX",t:[["P",x+18,y+110,"+","R"],["M",x+42,y+110,"−","K"],["C",x+80,y+110,"C","L"],["1",x+110,y+110,"1","K"]]})
};
const EXS=[
 {id:"simples",n:"Interruptor simples",lv:1,d:"Uma lâmpada comandada de um ponto.",devs:[["Q","sup",30,50],["S","sw",330,60],["Lm","lamp",640,50]],
  sol:[["Q.L","S.L"],["S.1","Lm.L"],["Q.N","Lm.N"],["Q.PE","Lm.PE"]],ctrl:[["S","Interruptor"]]},
 {id:"escada",n:"Comutador de escada",lv:2,d:"Uma lâmpada comandada de dois pontos.",devs:[["Q","sup",20,50],["C1","com",250,60,"Comutador 1"],["C2","com",450,60,"Comutador 2"],["Lm","lamp",680,50]],
  sol:[["Q.L","C1.C"],["C1.1","C2.1"],["C1.2","C2.2"],["C2.C","Lm.L"],["Q.N","Lm.N"],["Q.PE","Lm.PE"]],ctrl:[["C1","Comutador 1"],["C2","Comutador 2"]]},
 {id:"inversor",n:"Inversor (3 pontos)",lv:3,d:"Comutador – inversor – comutador.",devs:[["Q","sup",10,50],["C1","com",190,60,"Comutador 1"],["I","inv",345,60],["C2","com",510,60,"Comutador 2"],["Lm","lamp",690,50]],
  sol:[["Q.L","C1.C"],["C1.1","I.E1"],["C1.2","I.E2"],["I.S1","C2.1"],["I.S2","C2.2"],["C2.C","Lm.L"],["Q.N","Lm.N"],["Q.PE","Lm.PE"]],ctrl:[["C1","Comutador 1"],["I","Inversor"],["C2","Comutador 2"]]},
 {id:"tomada",n:"Tomada com terra",lv:1,d:"Alimentar uma tomada schuko.",devs:[["Q","sup",60,50],["T","sock",520,50]],sol:[["Q.L","T.L"],["Q.N","T.N"],["Q.PE","T.PE"]],ctrl:[]},
 {id:"sensor",n:"Sensor de movimento",lv:2,d:"A luz acende quando alguém passa.",devs:[["Q","sup",30,50],["Se","sens",330,60],["Lm","lamp",640,50]],
  sol:[["Q.L","Se.L"],["Q.N","Se.N"],["Se.Ls","Lm.L"],["Q.N","Lm.N"],["Q.PE","Lm.PE"]],ctrl:[["Se","Passar alguém"]]},
 {id:"knx",n:"KNX: botão → atuador",lv:3,d:"Fonte KNX, botão e atuador que liga a lâmpada.",devs:[["Q","sup",10,50],["F","kps",190,60],["B","kbt",345,60],["A","kac",470,60],["Lm","lamp",690,50]],
  sol:[["Q.L","F.L"],["Q.N","F.N"],["F.P","B.P"],["F.M","B.M"],["B.P","A.P"],["B.M","A.M"],["Q.L","A.C"],["A.1","Lm.L"],["Q.N","Lm.N"],["Q.PE","Lm.PE"]],ctrl:[["B","Carregar no botão KNX"]]}
];
const BS={ex:"simples",w:[],sel:null,col:"auto",on:false,guided:true,st:{},msg:[],trip:null,anim:null};
function bLayout(ex){const L={};for(const[id,k,x,y,lab]of ex.devs){const d=DEV[k](x,y,id,lab);L[id]={...d,x,y,id,lab:d.title};d.t.forEach(t=>{L[id+"."+t[0]]={id:id+"."+t[0],dev:id,x:t[1],y:t[2],lab:t[3],role:t[4]}})}return L}
/* redes: une bornes ligados por fios e pelos contactos internos fechados */
function bNets(ex,L,internal){const p={};const f=a=>{while(p[a]&&p[a]!==a)a=p[a];return a};const u=(a,b)=>{a=f(a);b=f(b);if(a!==b)p[a]=b};
 Object.keys(L).filter(k=>k.includes(".")).forEach(k=>p[k]=k);BS.w.forEach(w=>u(w.a,w.b));if(internal)bInternal(ex,L).forEach(([a,b])=>u(a,b));return f}
function bInternal(ex,L){const c=[];const s=BS.st;
 for(const[id,k]of ex.devs){if(k==="sw"&&s[id])c.push([id+".L",id+".1"]);if(k==="com")c.push([id+".C",id+"."+(s[id]?"2":"1")]);
  if(k==="inv"){if(s[id]){c.push([id+".E1",id+".S2"],[id+".E2",id+".S1"])}else c.push([id+".E1",id+".S1"],[id+".E2",id+".S2"])}
  if(k==="sens"&&s[id]&&s[id+"pw"])c.push([id+".L",id+".Ls"]);if(k==="kac"&&s[id+"rl"])c.push([id+".C",id+".1"])}return c}
function bEval(ex){const L=bLayout(ex);const out={lamp:false,live:new Set(),err:[],warn:[],bus:null};if(!BS.on)return out;
 // alimentação do sensor e da fonte KNX (precisam de L e N)
 let f=bNets(ex,L,true);const Lr=f("Q.L"),Nr=f("Q.N"),PEr=f("Q.PE");
 for(const[id,k]of ex.devs){if(k==="sens")BS.st[id+"pw"]=f(id+".L")===Lr&&f(id+".N")===Nr;}
 f=bNets(ex,L,true);const lr=f("Q.L"),nr=f("Q.N"),per=f("Q.PE");
 if(lr===nr){out.err.push("Curto-circuito: a fase está ligada diretamente ao neutro. O disjuntor disparou.");BS.trip="cc";return out}
 if(lr===per){out.err.push("Defeito à terra: a fase toca no condutor de proteção. O diferencial disparou.");BS.trip="dr";return out}
 if(nr===per)out.warn.push("Neutro ligado à terra depois do diferencial — o DR vai disparar com qualquer carga.");
 Object.keys(L).filter(k=>k.includes(".")).forEach(k=>{if(f(k)===lr)out.live.add(k)});
 // cargas: lâmpada/tomada acendem se L e N certos
 for(const[id,k]of ex.devs){if(k==="lamp"||k==="sock"){const okL=f(id+".L")===lr,okN=f(id+".N")===nr;const on=okL&&okN;if(k==="lamp")out.lamp=out.lamp||on;else out.sock=on;
   if(f(id+".L")===nr&&f(id+".N")===lr)out.warn.push("Fase e neutro trocados na "+(k==="lamp"?"luminária":"tomada")+" (funciona, mas o casquilho fica com tensão).");}}
 // interruptor/comutador a cortar o neutro
 for(const[id,k]of ex.devs){if((k==="sw"||k==="com"||k==="inv")&&ex.devs.some(d=>d[1]==="lamp")){const ts=DEV[k](0,0).t.map(t=>id+"."+t[0]);if(ts.some(t=>f(t)===nr))out.warn.push(`O ${L[id].lab.toLowerCase()} está no neutro: deve cortar sempre a fase.`)}}
 // KNX: bus
 if(ex.devs.some(d=>d[1]==="kps")){const f0=bNets(ex,L,false);const pw=f0("F.L")===f0("Q.L")&&f0("F.N")===f0("Q.N");const P=f0("F.P"),M=f0("F.M");const bus={pw,short:P===M,B:null,A:null};
  const chk=id=>f0(id+".P")===P&&f0(id+".M")===M?"ok":f0(id+".P")===M&&f0(id+".M")===P?"pol":"off";bus.B=chk("B");bus.A=chk("A");out.bus=bus;
  if(!pw)out.warn.push("A fonte KNX não está alimentada (liga L e N à fonte).");else if(bus.short)out.err.push("Curto-circuito no bus KNX (+ ligado ao −).");
  else{if(bus.B==="pol")out.warn.push("Botão KNX com a polaridade trocada (vermelho no +, preto no −).");if(bus.A==="pol")out.warn.push("Atuador KNX com a polaridade trocada.");if(bus.B==="off")out.warn.push("O botão KNX não está ligado ao bus.");if(bus.A==="off")out.warn.push("O atuador KNX não está ligado ao bus.")}}
 return out}
/* compara com a solução: o que falta e o que está a mais */
function bCheck(ex){const L=bLayout(ex);const f=bNets(ex,L,false);const miss=[],extra=[];
 const sp={};const g=a=>{while(sp[a]&&sp[a]!==a)a=sp[a];return a};Object.keys(L).filter(k=>k.includes(".")).forEach(k=>sp[k]=k);ex.sol.forEach(([a,b])=>{const x=g(a),y=g(b);if(x!==y)sp[x]=y});
 ex.sol.forEach(([a,b])=>{if(f(a)!==f(b))miss.push([a,b])});BS.w.forEach(w=>{if(g(w.a)!==g(w.b))extra.push(w)});
 const col=[];BS.w.forEach(w=>{const r=netRole(ex,g,w.a);if(r==="N"&&w.c!=="N")col.push(w);else if(r==="PE"&&w.c!=="PE")col.push(w);else if((r==="L"||r==="K")&&(w.c==="N"||w.c==="PE"))col.push(w);else if(r==="R"&&w.c!=="R")col.push(w)});
 return{miss,extra,col,done:!miss.length&&!extra.length}}
function netRole(ex,g,t){const r=g(t);if(r===g("Q.N"))return"N";if(r===g("Q.PE"))return"PE";if(ex.devs.some(d=>d[1]==="kps")){if(r===g("F.P"))return"R";if(r===g("F.M"))return"KB"}return"L"}
/* cor automática do fio pela função dos bornes */
function autoCol(L,a,b){const ra=L[a].role,rb=L[b].role,la=L[a].lab,lb=L[b].lab;if(ra==="PE"||rb==="PE")return"PE";if(ra==="N"||rb==="N")return"N";if(ra==="R"||rb==="R")return"R";
 if((la==="−"||lb==="−"))return"K";if(ra==="L"&&rb==="L")return"L";if([la,lb].some(x=>x==="2"||x==="E2"||x==="S2"))return"G";return"K"}
const tName=(L,t)=>`${L[L[t].dev].lab} · ${L[t].lab}`;
function bDevSvg(d,s,ev){const{x,y,w,h,k}=d;const on=ev.lamp;let body="";
 const face=`<rect x="${x}" y="${y}" width="${w}" height="${h-18}" rx="12" class="bd-f"/>`;
 if(k==="sup")body=`<rect x="${x}" y="${y}" width="${w}" height="${h-18}" rx="10" class="bd-q"/><g class="bdbrk" data-brk="1" role="button" tabindex="0"><rect x="${x+48}" y="${y+14}" width="54" height="66" rx="6" class="bd-cb${BS.trip?" trip":BS.on?" on":""}"/><rect x="${x+65}" y="${BS.on&&!BS.trip?y+24:y+50}" width="20" height="22" rx="3" class="bd-tg"/><text x="${x+w-8}" y="${y+16}" class="bd-s r${BS.trip?" bad":BS.on?" okc":""}">${BS.trip?"DISPAROU":BS.on?"ON":"OFF"}</text></g><text x="${x+8}" y="${y+16}" class="bd-s l">C10</text>`;
 else if(k==="sw")body=face+`<g data-act="${d.id}" class="bdact" role="button" tabindex="0"><rect x="${x+18}" y="${y+14}" width="${w-36}" height="62" rx="8" class="bd-rk"/><rect x="${x+24}" y="${s[d.id]?y+18:y+44}" width="${w-48}" height="28" rx="6" class="bd-rk2${s[d.id]?" dn":""}"/></g>`;
 else if(k==="com")body=face+`<g data-act="${d.id}" class="bdact" role="button" tabindex="0"><rect x="${x+22}" y="${y+14}" width="${w-44}" height="62" rx="8" class="bd-rk"/><rect x="${x+28}" y="${s[d.id]?y+44:y+18}" width="${w-56}" height="28" rx="6" class="bd-rk2${s[d.id]?" dn":""}"/><text x="${x+w/2}" y="${y+86}" class="bd-s">pos. ${s[d.id]?2:1}</text></g>`;
 else if(k==="inv")body=face+`<g data-act="${d.id}" class="bdact" role="button" tabindex="0"><rect x="${x+24}" y="${y+14}" width="${w-48}" height="62" rx="8" class="bd-rk"/><text x="${x+w/2}" y="${y+52}" class="bd-big">${s[d.id]?"✕":"="}</text><text x="${x+w/2}" y="${y+86}" class="bd-s">${s[d.id]?"cruzado":"direto"}</text></g>`;
 else if(k==="lamp")body=`<line x1="${x+w/2}" y1="${y}" x2="${x+w/2}" y2="${y+18}" class="bd-wire"/><path d="M${x+20} ${y+44}Q${x+w/2} ${y+8} ${x+w-20} ${y+44}Z" class="bd-shade"/><circle cx="${x+w/2}" cy="${y+58}" r="18" class="bd-bulb${on?" on":""}"/>${on?`<circle cx="${x+w/2}" cy="${y+58}" r="40" class="bd-glow"/>`:""}<rect x="${x+8}" y="${y+86}" width="${w-16}" height="16" rx="4" class="bd-blk"/>`;
 else if(k==="sock")body=face+`<circle cx="${x+w/2}" cy="${y+46}" r="30" class="bd-rk"/><circle cx="${x+w/2-11}" cy="${y+46}" r="4.5" class="bd-hole"/><circle cx="${x+w/2+11}" cy="${y+46}" r="4.5" class="bd-hole"/><rect x="${x+w/2-4}" y="${y+16}" width="8" height="6" class="bd-pe"/><rect x="${x+w/2-4}" y="${y+70}" width="8" height="6" class="bd-pe"/><text x="${x+w/2}" y="${y+96}" class="bd-s${ev.sock?" okc":""}">${ev.sock?"230 V ✓":"sem tensão"}</text>`;
 else if(k==="sens")body=face+`<g data-act="${d.id}" class="bdact" role="button" tabindex="0"><circle cx="${x+w/2}" cy="${y+44}" r="26" class="bd-dome${s[d.id]?" on":""}"/><text x="${x+w/2}" y="${y+88}" class="bd-s">${s[d.id]?"movimento!":"toca = passar"}</text></g>`;
 else if(k==="kps")body=face+`<rect x="${x+14}" y="${y+16}" width="${w-28}" height="30" rx="5" class="bd-lcd"/><text x="${x+w/2}" y="${y+36}" class="bd-lcdt">${ev.bus&&ev.bus.pw&&!ev.bus.short?"29 V DC":"0 V"}</text><circle cx="${x+w-22}" cy="${y+64}" r="5" class="bd-led${ev.bus&&ev.bus.pw&&!ev.bus.short?" on":""}"/><text x="${x+14}" y="${y+68}" class="bd-s l">640 mA</text>`;
 else if(k==="kbt")body=face+`<g data-act="${d.id}" class="bdact" role="button" tabindex="0"><rect x="${x+14}" y="${y+14}" width="${w-28}" height="62" rx="8" class="bd-rk"/><circle cx="${x+w/2}" cy="${y+45}" r="14" class="bd-kb${s[d.id+"p"]?" dn":""}"/><circle cx="${x+w-22}" cy="${y+22}" r="3.5" class="bd-led${ev.bus&&ev.bus.B==="ok"&&ev.bus.pw?" on":""}"/></g>`;
 else if(k==="kac")body=face+`<rect x="${x+12}" y="${y+14}" width="${w-24}" height="26" rx="5" class="bd-lcd"/><text x="${x+w/2}" y="${y+32}" class="bd-lcdt">1.1.10</text><rect x="${x+w/2-16}" y="${y+50}" width="32" height="20" rx="4" class="bd-rl${s[d.id+"rl"]?" on":""}"/><text x="${x+w/2}" y="${y+82}" class="bd-s">relé ${s[d.id+"rl"]?"fechado":"aberto"}</text>`;
 return`<g class="bdev">${body}<text x="${x+w/2}" y="${y-8}" class="bd-t">${esc(d.lab)}</text></g>`}
function bWirePath(a,b){const dx=Math.abs(b.x-a.x);const sag=Math.min(130,36+dx*.24);return`M${a.x} ${a.y}C${a.x} ${a.y+sag},${b.x} ${b.y+sag},${b.x} ${b.y}`}
function bSvg(ex){const L=bLayout(ex);const ev=bEval(ex);const ck=bCheck(ex);const s=BS.st;const nextG=BS.guided&&ck.miss[0];
 const tset=Object.values(L).filter(o=>o.dev);
 const wires=BS.w.map((w,i)=>{const a=L[w.a],b=L[w.b];if(!a||!b)return"";const d=bWirePath(a,b);const live=ev.live.has(w.a)&&BS.on&&!BS.trip;const c=WCOL[w.c][1];
  return`<g class="bw${live?" live":""}${ck.col.includes(w)||ck.extra.includes(w)?" badc":""}" data-w="${i}"><path d="${d}" class="bw-o"/><path d="${d}" stroke="${c}" class="bw-c"/>${w.c==="PE"?`<path d="${d}" class="bw-pe"/>`:""}${live?`<path d="${d}" class="bw-f"/>`:""}<path d="${d}" class="bw-hit"/></g>`}).join("");
 return`<svg class="banc" viewBox="0 0 860 360" role="img" aria-label="Bancada de ligações">
  <defs><pattern id="bgrid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" class="bgl"/></pattern></defs><rect width="860" height="360" fill="url(#bgrid)" class="bgr"/>
  ${ex.devs.map(([id])=>bDevSvg(L[id],s,ev)).join("")}${wires}
  ${tset.map(t=>{const r=WCOL[t.role]||WCOL.K;const sel=BS.sel===t.id;const hint=nextG&&(nextG[0]===t.id||nextG[1]===t.id)&&!BS.on;
   return`<g class="bt${sel?" sel":""}${hint?" hint":""}" data-t="${t.id}" role="button" tabindex="0" aria-label="${esc(tName(L,t.id))}"><circle cx="${t.x}" cy="${t.y}" r="12" class="bt-o"/><circle cx="${t.x}" cy="${t.y}" r="7.5" class="bt-s"/><line x1="${t.x-4}" y1="${t.y}" x2="${t.x+4}" y2="${t.y}" class="bt-x"/><text x="${t.x}" y="${t.y-17}" class="bt-l" fill="${r[1]}">${esc(t.lab)}</text></g>`}).join("")}
  ${BS.trip?`<g class="spark"><circle cx="${L.Q.x+75}" cy="${L.Q.y+46}" r="44"/><text x="${L.Q.x+75}" y="${L.Q.y+52}">⚡</text></g>`:""}</svg>`}
function kBanc(E){const ex=EXS.find(x=>x.id===BS.ex)||EXS[0];
 E.innerHTML=`<div class="bex">${EXS.map(x=>`<button class="bexc${x.id===ex.id?" on":""}" data-bx="${x.id}"><span class="lvl">${"●".repeat(x.lv)}${"○".repeat(3-x.lv)}</span><b>${x.n}</b><small>${x.d}</small></button>`).join("")}</div>
 <section class="block bancw"><div class="btool"><div class="bcol" role="group" aria-label="Cor do fio"><span>Fio:</span><button data-c="auto" class="${BS.col==="auto"?"on":""}">Cor automática</button>${Object.entries(WCOL).map(([k,v])=>`<button data-c="${k}" class="sw${BS.col===k?" on":""}" title="${v[0]}" style="--c:${v[1]}"${k==="PE"?' data-pe="1"':""}><i></i></button>`).join("")}</div>
  <label class="fsw"><input type="checkbox" id="bGuid"${BS.guided?" checked":""}><span class="tg"></span>Guiado</label>
  <span style="flex:1"></span><button class="btn sm" id="bUndo">↶ Desfazer</button><button class="btn sm" id="bClr">Limpar</button><button class="btn sm" id="bSol">Mostrar solução</button>
  <button class="btn sm ${BS.on?"dark":"primary"}" id="bPow">${BS.on?"⏻ Desligar disjuntor":"⏻ Ligar disjuntor e testar"}</button></div>
  <div class="bstage" id="bSt"></div><div class="bctl" id="bCtl"></div><div class="bmsg" id="bMsg"></div></section>
 <p class="mut">Como usar: toca num borne e depois noutro para ligar um fio (a cor sai automática pela função do borne, ou escolhe-a acima). Toca num fio para o retirar. Liga o disjuntor para testar e usa os interruptores no próprio aparelho.</p>`;
 const draw=()=>{if(!$("bSt")||!$("bCtl")||!$("bMsg")){clearInterval(BS.anim);return}const ex2=EXS.find(x=>x.id===BS.ex);$("bSt").innerHTML=bSvg(ex2);const ev=bEval(ex2),ck=bCheck(ex2);const L=bLayout(ex2);const st2=$("bSt");
  st2.querySelectorAll("[data-t]").forEach(g=>{g.onclick=()=>tap(g.dataset.t);g.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();tap(g.dataset.t)}}});
  st2.querySelectorAll("[data-w]").forEach(g=>g.onclick=e=>{e.stopPropagation();if(BS.on){toast("Desliga o disjuntor antes de mexer nos fios.");return}BS.w.splice(+g.dataset.w,1);draw()});
  st2.querySelectorAll("[data-act]").forEach(g=>g.onclick=()=>act(g.dataset.act));st2.querySelectorAll("[data-brk]").forEach(g=>g.onclick=()=>power());
  $("bCtl").innerHTML=(ex2.ctrl||[]).map(([id,lab])=>`<button class="btn sm" data-ac="${id}">${lab}</button>`).join("")+(ev.lamp||ev.sock?`<span class="bok">💡 ${ev.lamp?"Lâmpada acesa":"Tomada com tensão"}</span>`:"");
  $("bCtl").querySelectorAll("[data-ac]").forEach(b=>b.onclick=()=>act(b.dataset.ac));
  const items=ex2.sol.map(([a,b])=>{const okk=!ck.miss.some(m=>m[0]===a&&m[1]===b);return`<li class="${okk?"y":""}">${okk?"✓":"○"} ${esc(tName(L,a))} → ${esc(tName(L,b))}</li>`}).join("");
  const g=BS.guided&&ck.miss[0]&&!BS.on?`<div class="bnext">👉 <b>Próximo fio:</b> liga <b>${esc(tName(L,ck.miss[0][0]))}</b> a <b>${esc(tName(L,ck.miss[0][1]))}</b> (bornes a piscar).</div>`:"";
  const st3=BS.on?(ev.err.length?ev.err.map(m=>`<div class="be">✗ ${m}</div>`).join(""):(ev.lamp||ev.sock?`<div class="bg">✓ Funciona! ${ck.done?"Montagem correta.":""}</div>`:`<div class="bw2">A instalação está ligada mas a carga não funciona${(ex2.ctrl||[]).length?" — experimenta os comandos":""}.</div>`))+ev.warn.map(m=>`<div class="bw2">⚠ ${m}</div>`).join(""):"";
  const done=ck.done&&!BS.on?`<div class="bg">✓ Todas as ligações feitas. Liga o disjuntor para testar.</div>`:"";
  $("bMsg").innerHTML=`${g}${st3}${done}${ck.extra.length?`<div class="bw2">⚠ ${ck.extra.length} fio${ck.extra.length>1?"s":""} a mais ou em sítio errado (contorno vermelho tracejado — toca no fio para o retirar).</div>`:""}${ck.col.length?`<div class="bw2">🎨 ${ck.col.length} fio${ck.col.length>1?"s":""} com a cor errada (azul = neutro, verde/amarelo = proteção${ex2.id==="knx"?", vermelho = + do bus":""}).</div>`:""}
   <details class="blist"${BS.guided?"":" open"}><summary>Ligações (${ex2.sol.length-ck.miss.length}/${ex2.sol.length})</summary><ul>${items}</ul></details>`};
 const tap=t=>{if(BS.on){toast("Desliga o disjuntor antes de ligar fios.");return}if(!BS.sel){BS.sel=t;draw();return}if(BS.sel===t){BS.sel=null;draw();return}
  const a=BS.sel,b=t;BS.sel=null;if(BS.w.some(w=>(w.a===a&&w.b===b)||(w.a===b&&w.b===a))){draw();return}
  const ex2=EXS.find(x=>x.id===BS.ex);const L=bLayout(ex2);const c=BS.col!=="auto"?BS.col:autoCol(L,a,b);
  BS.w.push({a,b,c});draw()};
 const act=id=>{const ex2=EXS.find(x=>x.id===BS.ex);const k=(ex2.devs.find(d=>d[0]===id)||[])[1];
  if(k==="sens"){BS.st[id]=1;clearTimeout(BS.st._t);BS.st._t=setTimeout(()=>{BS.st[id]=0;draw()},4000)}
  else if(k==="kbt"){const ev=bEval(ex2);BS.st[id+"p"]=1;setTimeout(()=>{BS.st[id+"p"]=0;draw()},250);
   if(ev.bus&&ev.bus.pw&&!ev.bus.short&&ev.bus.B==="ok"&&ev.bus.A==="ok")BS.st.Arl=BS.st.Arl?0:1;else toast(!BS.on?"Liga o disjuntor primeiro.":"O telegrama não chega ao atuador — verifica o bus.")}
  else BS.st[id]=BS.st[id]?0:1;draw()};
 const power=()=>{if(BS.trip){BS.trip=null;BS.on=false;toast("Disjuntor rearmado (desligado). Corrige a ligação e volta a ligar.")}else BS.on=!BS.on;BS.sel=null;kBanc(E)};
 E.querySelectorAll("[data-bx]").forEach(b=>b.onclick=()=>{clearInterval(BS.anim);BS.ex=b.dataset.bx;BS.w=[];BS.sel=null;BS.on=false;BS.trip=null;BS.st={};kBanc(E)});
 E.querySelectorAll(".bcol [data-c]").forEach(b=>b.onclick=()=>{BS.col=b.dataset.c;E.querySelectorAll(".bcol [data-c]").forEach(x=>x.classList.toggle("on",x===b))});
 $("bGuid").onchange=e=>{BS.guided=e.target.checked;draw()};$("bUndo").onclick=()=>{if(!BS.on){BS.w.pop();draw()}};$("bClr").onclick=()=>{if(!BS.on){BS.w=[];draw()}};$("bPow").onclick=power;
 $("bSol").onclick=()=>{if(BS.on)return;clearInterval(BS.anim);BS.w=[];const L=bLayout(ex);const q=ex.sol.slice();BS.anim=setInterval(()=>{const s2=q.shift();if(!s2){clearInterval(BS.anim);return}const[a,b]=s2;BS.w.push({a,b,c:autoCol(L,a,b)});draw()},450)};
 draw()}

/* ---------------------------------------------------------
   10) SEGURANÇA — pasta com os protocolos dos SADI (Sistemas Automáticos de Deteção de Incêndio)
   Regras: ANEPC Nota Técnica 12 (2023) e RT-SCIE (Portaria 1532/2008, alterada pela 135/2020)
   Capacidades por protocolo: fichas técnicas dos fabricantes — confirmar sempre na central usada.
   --------------------------------------------------------- */
const SADI_F={nt12:"ANEPC — Nota Técnica n.º 12 (SADI), 2023",rtscie:"RT-SCIE — Portaria n.º 1532/2008, alterada pela Portaria n.º 135/2020",fab:"Fichas técnicas dos fabricantes (valores típicos — confirmar na central e na versão do protocolo)",en54:"EN 54 — sistemas de deteção e alarme de incêndio"};
const SPROTO=[
 {n:"Convencional (zonas)",uso:"Pequenos edifícios: cada zona é um circuito; a central sabe a zona, não o detetor",meio:"2 fios por zona + resistência de fim de linha (valor do fabricante)",vel:"— (por corrente)",lim:"Uma zona por circuito; a falha de um circuito não pode deixar mais de 32 dispositivos inoperacionais (NT 12, 5.2)",top:"Radial (classe B) com fim de linha",term:"Resistência de fim de linha (EOL)",norma:"EN 54-2 · NT 12"},
 {n:"Endereçável analógico (laço)",uso:"Médios e grandes edifícios: cada dispositivo tem endereço e envia o valor analógico",meio:"Par entrançado, normalmente blindado, resistente ao fogo quando exigido",vel:"Protocolo digital do fabricante",lim:"Isoladores para que um curto ou corte não tire mais de 32 dispositivos (NT 12, 5.2); corrente e comprimento do laço pela central",top:"Laço fechado (classe A) — também derivações (classe B)",term:"Não (o laço volta à central)",norma:"EN 54-2 · EN 54-17 (isoladores)"},
 {n:"Apollo XP95 / Discovery",uso:"Protocolo aberto (licenciado) usado por muitas centrais",meio:"Laço de 2 fios",vel:"Digital Apollo",lim:"126 endereços de detetores/botoneiras por laço",top:"Laço com isoladores",term:"—",norma:"EN 54"},
 {n:"Apollo Soteria / CoreProtocol",uso:"Nova geração Apollo, mais endereços e diagnóstico",meio:"Laço de 2 fios",vel:"Digital Apollo (CoreProtocol)",lim:"254 dispositivos por laço",top:"Laço; muitos dispositivos com isolador integrado",term:"—",norma:"EN 54"},
 {n:"Hochiki ESP",uso:"Protocolo Hochiki usado em centrais de vários fabricantes",meio:"Laço de 2 fios",vel:"Digital Hochiki (ESP)",lim:"127 endereços por laço",top:"Laço com isoladores",term:"—",norma:"EN 54"},
 {n:"Siemens FDnet",uso:"Centrais Sinteso / Cerberus PRO",meio:"Laço de 2 fios",vel:"Digital Siemens",lim:"Até 252 elementos por laço; até 3,3 km de cabo; até 40 derivações (T)",top:"Laço e derivações; separador de linha integrado nos elementos",term:"—",norma:"EN 54"},
 {n:"Bosch LSN improved",uso:"Centrais Bosch (LSN = Local Security Network)",meio:"Laço de 2 fios",vel:"Digital Bosch",lim:"Até 254 elementos por laço; LSN 1500 até 3 000 m",top:"Laço e derivações",term:"—",norma:"EN 54"},
 {n:"Notifier / Honeywell (CLIP · Opal · FlashScan)",uso:"Centrais Notifier e Honeywell",meio:"Laço de 2 fios",vel:"Digital do fabricante",lim:"Depende do protocolo e da central (ex.: dezenas a centenas de detetores + módulos por laço)",top:"Laço com isoladores",term:"—",norma:"EN 54"},
 {n:"Rede, GTC e transmissão de alerta",uso:"Ligação entre centrais, repetidores, GTC e bombeiros",meio:"Rede de centrais do fabricante; gateways Modbus/BACnet; contactos; transmissor de alerta",vel:"—",lim:"A GTC só monitoriza: os comandos de segurança ficam na central de incêndio",top:"Anel de centrais (proprietário) · IP para GTC",term:"—",norma:"EN 54-21 (transmissão) · EN 54-25 (rádio) · NT 12 5.11"}
];
Object.assign(PX,{
 "Convencional (zonas)":{url:"https://prociv.gov.pt",site:"ANEPC (prociv.gov.pt) — Notas Técnicas",
  ex:"Loja com 3 zonas: zona 1 sala de vendas, zona 2 armazém, zona 3 escritórios. Com fumo no armazém a central mostra «Alarme zona 2» — o técnico tem de procurar qual dos detetores atuou (LED aceso no detetor).",
  demo:{n:["Central (CDI)","Zona 2: + / −","Detetor 1","Detetor 2 (LED)","Resistência fim de linha"],p:["A central passa uma corrente pequena pela zona e mede-a.","Com a resistência de fim de linha a corrente é «normal» — a zona está vigiada.","Um detetor em alarme puxa mais corrente: a central dá «ALARME ZONA 2».","Sem corrente (fio cortado ou EOL retirada) a central dá «AVARIA ZONA 2»."]},
  pro:["Simples e barato","Fácil de perceber e testar","Bom para edifícios pequenos com poucas zonas"],
  con:["Não identifica o detetor — só a zona","Sem valores analógicos nem aviso de detetor sujo","Muitos circuitos/cabos em edifícios maiores","Mais falsos alarmes (sem compensação nem verificação)"],
  err:[["«Avaria zona» permanente","Fim de linha em falta, no sítio errado ou com outro valor: confirmar a resistência do fabricante no último detetor."],["Zona em alarme sem fogo","Detetor sujo ou humidade: limpar/substituir e confirmar o tipo de detetor para o local."],["Uma zona mistura pisos","A zona deve ficar num só piso (NT 12, 5.5) — reorganizar."],["Detetores a jusante sem vigilância","Derivação (T) depois do último detetor: a zona deve ser contínua até à EOL."]]},
 "Endereçável analógico (laço)":{url:"https://prociv.gov.pt",site:"ANEPC (prociv.gov.pt) — Notas Técnicas",
  ex:"Hotel com 2 laços de 120 dispositivos: a central mostra «Alarme — Detetor 1.045 — Quarto 214» e ativa as sirenes do piso, fecha portas corta-fogo e chama o elevador ao piso de referência.",
  demo:{n:["Central (CDI)","Isolador","Detetores 001–030","Isolador","Botoneiras / sirenes / módulos"],p:["A central pergunta a cada endereço, em ciclo, o valor medido (fumo, temperatura) e o estado.","Quando o valor passa o limiar: «Alarme» com o endereço e o texto do local.","Um curto-circuito no laço: os isoladores dos dois lados abrem e só o troço entre eles fica de fora.","Com o laço fechado (classe A), um corte não tira dispositivos: a central alimenta pelas duas pontas e dá «Avaria»."]},
  pro:["Identifica o dispositivo e o local exato","Valores analógicos: aviso de detetor sujo e compensação","Laço classe A resistente a um corte ou curto","Menos cabo que muitas zonas convencionais"],
  con:["Mais caro e com programação","Protocolos próprios: dispositivos e central do mesmo protocolo","Exige cálculo de corrente e comprimento do laço","Endereços têm de ser geridos com cuidado"],
  err:[["«Dispositivo em falta» após obras","Endereço duplicado ou detetor retirado da base: confirmar endereços e encaixe."],["Curto deixa todo o laço sem comunicar","Faltam isoladores: no máx. 32 dispositivos entre isoladores (NT 12, 5.2)."],["Avarias intermitentes de comunicação","Blindagem mal ligada ou cabo junto a potência: ligar a blindagem como o fabricante indica e afastar de cabos de energia."],["Sirenes fracas no fim do laço","Queda de tensão: calcular a corrente do laço e a secção (ferramenta do fabricante)."],["Laço «classe A» que afinal não volta à central","Retorno não ligado ou as duas pernas no mesmo caminho: separar as pernas (NT 12, 6)."]]},
 "Apollo XP95 / Discovery":{url:"https://www.apollo-fire.co.uk",site:"apollo-fire.co.uk",ex:"Central de outra marca com placa de laço Apollo: detetores ópticos XP95, botoneiras e módulos de entrada/saída no mesmo laço.",
  demo:{n:["Central (placa Apollo)","Laço","Detetor end. 001","Botoneira end. 002","Isolador"],p:["Cada dispositivo tem o endereço definido (XP95: «XPERT card» na base; Discovery: igual).","A central lê o valor analógico de cada endereço.","Alarme quando o valor passa o limiar programado."]},
  pro:["Protocolo licenciado usado por muitos fabricantes de centrais","Gama grande de detetores e módulos","Muito difundido — peças fáceis de encontrar"],con:["126 endereços por laço (menos que protocolos mais recentes)","Os dispositivos Apollo só funcionam em centrais com protocolo Apollo"],
  err:[["Detetor não aparece","Cartão de endereço em falta/errado na base: conferir o endereço."],["Dois detetores no mesmo endereço","Colisão: corrigir o cartão de endereço."]]},
 "Apollo Soteria / CoreProtocol":{url:"https://www.apollo-fire.co.uk",site:"apollo-fire.co.uk",ex:"Ampliação de um edifício com mais de 126 dispositivos num laço: com Soteria/CoreProtocol o laço aceita até 254.",
  demo:{n:["Central CoreProtocol","Laço","Detetor Soteria","Sirene","Módulo E/S"],p:["Mais endereços por laço e mais diagnóstico.","Muitos dispositivos com isolador integrado."]},pro:["Até 254 dispositivos por laço","Diagnóstico mais detalhado"],con:["Exige central/placa compatível com CoreProtocol"],err:[["Mistura de gerações","Confirmar compatibilidade XP95/Discovery com a central CoreProtocol na ficha do fabricante."]]},
 "Hochiki ESP":{url:"https://www.hochikieurope.com",site:"hochikieurope.com",ex:"Central com protocolo ESP: detetores, botoneiras e sirenes Hochiki num laço de até 127 endereços.",
  demo:{n:["Central ESP","Laço","Detetor","Botoneira","Sirene"],p:["Endereçamento por programador ou na base.","Leitura cíclica dos valores pela central."]},pro:["Protocolo usado por várias marcas de centrais","Boa gama de dispositivos"],con:["127 endereços por laço","Só com centrais ESP"],err:[["Endereços duplicados","Reprogramar com o programador de endereços."]]},
 "Siemens FDnet":{url:"https://www.siemens.com",site:"siemens.com — Fire Safety",ex:"Edifício de escritórios com Sinteso: laço FDnet com 200 elementos e derivações (T) para os pisos técnicos.",
  demo:{n:["Central Sinteso","FDnet (laço)","Elemento com separador","Derivação (T)","Elementos"],p:["Elementos com separador de linha integrado: um curto só tira o troço afetado.","Derivações a partir do laço (até 40)."]},pro:["Até 252 elementos e 3,3 km por laço","Separador de linha integrado","Laço e derivações combinados"],con:["Só com centrais Siemens compatíveis"],err:[["Muitas derivações em paralelo sem separador","Usar o separador de linha próprio onde saem várias derivações."]]},
 "Bosch LSN improved":{url:"https://www.boschsecurity.com",site:"boschsecurity.com",ex:"Centro comercial com centrais Bosch: laços LSN improved com até 254 elementos e derivações.",
  demo:{n:["Central Bosch","LSN (laço)","Detetor","Módulo","Derivação"],p:["Endereçamento automático ou manual conforme o modo.","Laço e derivações no mesmo circuito."]},pro:["Até 254 elementos por laço","LSN 1500 até 3 000 m"],con:["Só com centrais Bosch"],err:[["Mistura de modo clássico e improved","Confirmar o modo do laço na central e nos elementos."]]},
 "Notifier / Honeywell (CLIP · Opal · FlashScan)":{url:"https://buildings.honeywell.com",site:"buildings.honeywell.com",ex:"Hospital com rede de centrais Notifier: cada laço com detetores e módulos endereçados, ligados em rede.",
  demo:{n:["Central","Laço","Detetores","Módulos","Rede de centrais"],p:["O número de detetores e módulos por laço depende do protocolo (CLIP, Opal, FlashScan) e da central.","Rede de centrais própria para edifícios grandes."]},pro:["Gama muito larga e redes de centrais grandes"],con:["Capacidade varia muito entre protocolos — confirmar sempre"],err:[["Dispositivo de protocolo diferente","Verificar se a central suporta o protocolo do dispositivo."]]},
 "Rede, GTC e transmissão de alerta":{url:"https://prociv.gov.pt",site:"ANEPC (prociv.gov.pt)",ex:"A central de incêndio envia o estado para a GTC por gateway Modbus/BACnet (só leitura) e, em alarme, o transmissor envia o alerta para os bombeiros ou uma central recetora.",
  demo:{n:["Central de incêndio","Gateway (só leitura)","GTC","Transmissor de alerta","Bombeiros / central recetora"],p:["A GTC vê alarmes e avarias, mas não substitui a central.","O alerta automático é feito de preferência diretamente aos bombeiros ou por central de receção, com ligação vigiada (NT 12, 5.11).","Repetidores junto ao acesso dos bombeiros quando a central está longe (NT 12, 5.9)."]},
  pro:["Visão única na GTC","Alerta rápido aos meios de socorro"],con:["Integração mal feita pode atrasar ou esconder alarmes","Ligações de transmissão têm de ser vigiadas"],
  err:[["Comandos de segurança a partir da GTC","Os comandos (portas corta-fogo, desenfumagem, extinção) devem ser da central de incêndio."],["Transmissão de alerta sem vigilância","Usar ligação com supervisão (avaria se cair)."]]}
});
/* simulador de laço (classe A, isoladores, curto, corte, alarme) */
function loopSim(){const N=12;return`<div class="lsim" id="lSim"><div class="simwrap"><svg class="lsvg" viewBox="0 0 680 300" id="lSvg"></svg></div>
 <div class="simpanel"><div class="simctl"><label class="simf">Dispositivo<select id="lDev">${[...Array(N)].map((_,i)=>`<option value="${i}">${String(i+1).padStart(3,"0")}</option>`).join("")}</select></label>
  <button class="btn sm primary" data-l="alarm">🔥 Fumo no detetor</button><button class="btn sm" data-l="mcp">Atuar botoneira 012</button><button class="btn sm" data-l="short">⚡ Curto antes do dispositivo</button><button class="btn sm" data-l="open">✂ Cortar o cabo</button><button class="btn sm" data-l="reset">Rearmar / reparar</button></div>
  <div class="simctl"><label class="fsw"><input type="checkbox" id="lIso" checked><span class="tg"></span>Com isoladores (a cada 4 dispositivos)</label><label class="fsw"><input type="checkbox" id="lA" checked><span class="tg"></span>Laço fechado (classe A)</label></div></div>
 <div class="cdi" id="lCdi"></div><div class="simlog" id="lLog"><div class="sl-h"><span>registo da central</span></div></div></div>`}
function wireLoop(root){const el=root.querySelector("#lSim");if(!el||el._w)return;el._w=1;const N=12;const S={alarm:null,short:null,open:null};
 const log=(t,k)=>{const L=$("lLog");const d=document.createElement("div");d.className="sl new "+(k||"");d.innerHTML=`<time>${new Date().toLocaleTimeString("pt-PT")}</time>${esc(t)}`;L.appendChild(d);L.scrollTop=L.scrollHeight};
 const iso=i=>$("lIso").checked&&i%4===0;// isolador antes do dispositivo i (0,4,8)
 const pos=i=>{const a=Math.PI*(1-(i+.5)/N);return[340+270*Math.cos(a),250-190*Math.sin(a)]};
 const state=()=>{const A=$("lA").checked;const ok=[...Array(N)].map(()=>true);let fault=null;
  if(S.short!=null){if(!$("lIso").checked){ok.fill(false);fault="Curto-circuito no laço — todos os dispositivos sem comunicação!"}
   else{let lo=S.short;while(lo>0&&!iso(lo))lo--;let hi=S.short+1;while(hi<N&&!iso(hi))hi++;for(let i=lo;i<hi;i++)ok[i]=false;fault=`Curto-circuito: isoladores abriram — dispositivos ${String(lo+1).padStart(3,"0")} a ${String(hi).padStart(3,"0")} fora de serviço (${hi-lo}).`;if(!A)for(let i=hi;i<N;i++)ok[i]=false}}
  if(S.open!=null){if(A)fault=(fault?fault+" ":"")+"Corte no laço: a central alimenta pelas duas pontas — sem perda de dispositivos (avaria assinalada).";else{for(let i=S.open;i<N;i++)ok[i]=false;fault=(fault?fault+" ":"")+`Corte no laço (classe B): ${N-S.open} dispositivos a jusante perdidos.`}}
  return{ok,fault}};
 const draw=()=>{const{ok,fault}=state();const A=$("lA").checked;const pts=[...Array(N)].map((_,i)=>pos(i));
  const seg=(i)=>{const[a,b]=i===0?[340-300,250]:pos(i-1);const[c,d]=pos(i);return`M${a} ${b}L${c} ${d}`};
  let svg=`<rect x="290" y="232" width="100" height="56" rx="10" class="cdi-b${S.alarm!=null&&ok[S.alarm]?" al":fault?" ft":""}"/><text x="340" y="256" class="cdi-t">CDI</text><text x="340" y="274" class="cdi-s">${S.alarm!=null&&ok[S.alarm]?"ALARME":fault?"AVARIA":"NORMAL"}</text>
   <path d="M290 260H40V250" class="lp-l"/><path d="M390 260H${A?640:390}V250" class="lp-l${A?"":" off"}"/>`;
  for(let i=1;i<N;i++){const[a,b]=pos(i-1),[c,d]=pos(i);const cut=S.open===i;const sh=S.short===i;svg+=`<path d="M${a} ${b}L${c} ${d}" class="lp-l${cut?" cut":""}${sh?" sh":""}"/>`}
  {const[a,b]=pos(0);svg+=`<path d="M40 250L${a} ${b}" class="lp-l${S.short===0?" sh":""}${S.open===0?" cut":""}"/>`;const[c,d]=pos(N-1);svg+=`<path d="M${c} ${d}L640 250" class="lp-l${A?"":" off"}"/>`}
  pts.forEach(([x,y],i)=>{const al=S.alarm===i&&ok[i];const mcp=i===N-1;if(iso(i)){const[a,b]=i===0?[40,250]:pos(i-1);const mx=(a+x)/2,my=(b+y)/2;const op=S.short!=null&&!ok[i]&&ok[i-1]!==undefined;svg+=`<g class="iso${S.short!=null&&(i===S.short||(i>S.short&&!ok[i-1]))?" open":""}"><rect x="${mx-9}" y="${my-9}" width="18" height="18" rx="4"/><text x="${mx}" y="${my+4}">I</text></g>`}
   svg+=`<g class="ldev${ok[i]?"":" lost"}${al?" al":""}" data-ld="${i}"><circle cx="${x}" cy="${y}" r="17"/>${mcp?`<rect x="${x-8}" y="${y-8}" width="16" height="16" rx="2" class="mcp"/>`:`<circle cx="${x}" cy="${y}" r="7" class="det"/>`}<text x="${x}" y="${y-24}">${String(i+1).padStart(3,"0")}</text>${al?`<circle cx="${x}" cy="${y}" r="26" class="alr"/>`:""}</g>`});
  svg+=`<text x="60" y="282" class="lp-e">saída</text><text x="620" y="282" class="lp-e">${A?"retorno":"(sem retorno)"}</text>`;$("lSvg").innerHTML=svg;
  const al=S.alarm!=null&&ok[S.alarm];$("lCdi").innerHTML=`<div class="cdil ${al?"al":fault?"ft":"ok"}"><b>${al?`🔥 ALARME — ${S.alarm===N-1?"Botoneira":"Detetor"} ${String(S.alarm+1).padStart(3,"0")} · Piso 1 · Zona ${Math.floor(S.alarm/4)+1}`:fault?"⚠ AVARIA":"✓ Sistema normal"}</b><span>${al?"Sirenes ativas · portas corta-fogo libertadas · transmissão de alerta enviada":fault||"Todos os 12 dispositivos a comunicar."}</span></div>`;
  el.querySelectorAll("[data-ld]").forEach(g=>g.onclick=()=>{$("lDev").value=g.dataset.ld})};
 el.querySelectorAll("[data-l]").forEach(b=>b.onclick=()=>{const i=+$("lDev").value;const a=b.dataset.l;const{ok}=state();
  if(a==="alarm"){S.alarm=i;if(!ok[i])log(`Fumo no ${String(i+1).padStart(3,"0")}, mas o dispositivo está fora de serviço — o alarme NÃO chega à central!`,"err");else log(`ALARME: detetor ${String(i+1).padStart(3,"0")} (valor acima do limiar).`,"err")}
  else if(a==="mcp"){S.alarm=N-1;log(ok[N-1]?"ALARME: botoneira 012 atuada.":"Botoneira 012 atuada, mas está fora de serviço!","err")}
  else if(a==="short"){S.short=i;log(`Curto-circuito antes do ${String(i+1).padStart(3,"0")}.`,"warn")}else if(a==="open"){S.open=Math.max(1,i);log(`Cabo cortado antes do ${String(Math.max(1,i)+1).padStart(3,"0")}.`,"warn")}
  else{S.alarm=null;S.short=null;S.open=null;log("Central rearmada e laço reparado.","ok")}draw()});
 ["lIso","lA"].forEach(id=>$(id).onchange=()=>{log(`${id==="lIso"?"Isoladores":"Classe A"}: ${$(id).checked?"sim":"não"}`,"");draw()});log("Laço com 12 dispositivos (011 detetores + botoneira 012). Experimenta um curto-circuito com e sem isoladores.","");draw()}
/* página Segurança */
/* ---------- exemplo de ligação de um laço de incêndio e dos seus elementos ---------- */
const LEL={
 cdi:{n:"Central (CDI) — placa de laço",ic:"CDI",col:"#1f2937",t:["SAÍDA +","SAÍDA −","RETORNO +","RETORNO −","⏚ blindagem"],
  how:["O laço sai pelos bornes SAÍDA (+/−) e volta pelos bornes RETORNO (+/−) — classe A: a central alimenta pelas duas pontas.","A blindagem do cabo liga-se à terra <b>só na central</b> (um único ponto) e segue contínua por todo o laço.","Antes de ligar à central: medir isolamento entre condutores e à terra e a continuidade do laço (com os elementos que o fabricante permitir)."],
  err:["Trocar SAÍDA com RETORNO em polaridade (+ com −) — a central dá avaria de laço.","Blindagem ligada à terra em vários pontos (laços de terra, avarias de comunicação)."]},
 iso:{n:"Isolador de curto-circuito",ic:"ISO",col:"#b45309",t:["IN +","IN −","OUT +","OUT −"],
  how:["Entra pelo lado IN e sai pelo lado OUT, respeitando a polaridade.","Colocar de forma que um curto não tire mais de 32 dispositivos (NT 12, 5.2) — e em cada mudança de zona/piso.","Muitos detetores e bases já têm isolador integrado: confirmar na ficha e no cálculo do laço."],
  err:["Instalar o isolador ao contrário (IN/OUT trocados) em modelos com sentido.","Pôr isoladores a mais do que a central permite por laço (conta como carga)."]},
 det:{n:"Detetor ótico de fumo (na base)",ic:"DET",col:"#475569",t:["L + (entra/sai)","L − (entra/sai)","R (indicador remoto)"],
  how:["Os dois fios + (o que chega e o que segue) apertam no mesmo borne L+; o mesmo para L−.","O endereço define-se no detetor ou na base (programador, cartão ou rodas), conforme o protocolo.","O borne R liga um indicador de ação (LED) à porta quando o detetor fica escondido (teto falso, quarto fechado)."],
  err:["Retirar o detetor numa base que interrompe o laço — confirmar na ficha se a base mantém a continuidade sem detetor.","Endereço repetido: dois elementos «brigam» no mesmo endereço.","Detetor montado antes das obras acabarem: pó → falsos alarmes (usar tampas de proteção)."]},
 mcp:{n:"Botoneira endereçável",ic:"BOT",col:"#dc2626",t:["L + (entra/sai)","L − (entra/sai)"],
  how:["Liga em série no laço como um detetor (entra e sai nos mesmos bornes).","Montar a ≈ 1,2 m, nos caminhos de evacuação e junto às saídas; máximo 30 m até uma botoneira (NT 12, 5.7)."],
  err:["Botoneira sem endereço programado — não aparece na central.","Usar uma botoneira convencional num laço endereçável sem módulo de entrada."]},
 snd:{n:"Sirene de laço (alimentada pelo laço)",ic:"SIR",col:"#7c3aed",t:["L + (entra/sai)","L − (entra/sai)"],
  how:["Liga no laço como os outros elementos; o volume/tom escolhe-se no aparelho ou por programação.","Conta muito no consumo do laço em alarme: confirmar no cálculo de corrente da central.","Níveis: ≥ 65 dB(A) e 10 dB acima do ruído; 75 dB(A) em quartos (NT 12, 5.8)."],
  err:["Sirenes demais no laço → tensão baixa no fim e falhas em alarme.","Sirene a menos de 1 m de pessoas a trabalhar (nível perigoso) — afastar ou baixar volume."]},
 min:{n:"Módulo de entrada (ex.: fluxostato do sprinkler)",ic:"M-IN",col:"#0891b2",t:["L + / L − (laço)","IN + / IN − (contacto)","Resistência fim de linha"],
  how:["O lado do laço liga como um elemento normal.","No lado de entrada liga-se o contacto do equipamento (fluxostato, alarme técnico, porta) com a resistência de fim de linha do fabricante no fim da linha — assim o módulo vigia o fio.","Programar a função: alarme, avaria ou técnico."],
  err:["Fim de linha montado no módulo e não no fim do fio (o fio não fica vigiado).","Contacto NF/NA trocado na programação → alarme permanente."]},
 mout:{n:"Módulo de saída / relé (ex.: retentor de porta corta-fogo)",ic:"M-OUT",col:"#16a34a",t:["L + / L − (laço)","C · NA · NF (relé)","24 V da fonte auxiliar"],
  how:["O lado do laço liga como um elemento normal.","O relé corta a alimentação de 24 V do retentor eletromagnético → a porta corta-fogo fecha em alarme (segurança positiva: sem energia, a porta fecha).","Usar fonte de alimentação auxiliar EN 54-4 para cargas como retentores, sirenes externas ou registos."],
  err:["Alimentar retentores ou sirenes grandes a partir do laço — sobrecarga.","Usar o contacto NA quando a função pede NF (a porta não fecha se o fio cair)."]},
 rli:{n:"Indicador de ação (LED remoto)",ic:"LED",col:"#f59e0b",t:["+ / − a partir do borne R do detetor"],
  how:["Liga ao borne R da base do detetor (não ao laço).","Coloca-se à porta de compartimentos fechados, tetos falsos ou pavimentos técnicos."],err:["Ligar o indicador diretamente ao laço."]}
};
/* sequência do exemplo: ida (cima) e volta (baixo) */
const LSEQ=[["iso","ISO 1"],["det","001 Detetor · Sala 1"],["det","002 Detetor · Sala 1"],["mcp","003 Botoneira · Saída"],["iso","ISO 2"],["snd","004 Sirene · Corredor"],["min","005 Módulo entrada · Fluxostato"],["mout","006 Módulo saída · Porta CF"],["iso","ISO 3"]];
const LRET=[["det","007 Detetor · Arrumos"],["det","008 Detetor · Teto falso"],["snd","009 Sirene · Escada"],["iso","ISO 4"]];
/* ---------- ilustrações realistas dos equipamentos (desenhadas aqui) + fotos reais da obra ---------- */
const ART_DEFS=`<defs><linearGradient id="agW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#eef0f2"/><stop offset="1" stop-color="#c9ced4"/></linearGradient>
 <radialGradient id="agDome" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#e9ecef"/><stop offset="1" stop-color="#b8bec6"/></radialGradient>
 <linearGradient id="agR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f05252"/><stop offset="1" stop-color="#a51d1d"/></linearGradient>
 <linearGradient id="agG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3f4f6"/><stop offset="1" stop-color="#b9bfc7"/></linearGradient>
 <linearGradient id="agD" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4b5563"/><stop offset="1" stop-color="#1f2937"/></linearGradient>
 <radialGradient id="agLens" cx=".5" cy=".35" r=".7"><stop offset="0" stop-color="#ffd6d6"/><stop offset=".6" stop-color="#ef4444" stop-opacity=".85"/><stop offset="1" stop-color="#991b1b"/></radialGradient>
 <radialGradient id="agLensW" cx=".5" cy=".35" r=".7"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#e5e7eb" stop-opacity=".9"/><stop offset="1" stop-color="#9ca3af"/></radialGradient></defs>`;
const ART={
 det:`<ellipse cx="50" cy="78" rx="40" ry="9" fill="#000" opacity=".12"/><path d="M12 56h76v8a6 6 0 0 1-6 6H18a6 6 0 0 1-6-6z" fill="url(#agG)" stroke="#9aa1aa"/><path d="M14 56a36 30 0 0 1 72 0z" fill="url(#agDome)" stroke="#a7aeb6"/>
  ${[22,30,38,46,54,62,70,78].map(x=>`<rect x="${x-1.5}" y="44" width="3" height="10" rx="1.5" fill="#c4c9cf"/>`).join("")}<circle cx="50" cy="31" r="8" fill="#f8f9fa" stroke="#c4c9cf"/><circle cx="67" cy="60" r="2.6" fill="#ef4444"/><circle cx="66.3" cy="59.2" r=".9" fill="#fff" opacity=".8"/>`,
 mcp:`<rect x="18" y="10" width="64" height="72" rx="6" fill="url(#agR)" stroke="#7f1d1d"/><rect x="28" y="20" width="44" height="40" rx="3" fill="#fafafa" stroke="#d1d5db"/><path d="M38 46l10-14 4 6 8-6-6 12" fill="none" stroke="#111" stroke-width="2.2" stroke-linejoin="round"/><path d="M35 54h30" stroke="#111" stroke-width="2"/>
  <rect x="44" y="66" width="12" height="8" rx="2" fill="#7f1d1d"/><circle cx="72" cy="72" r="2.4" fill="#fde047"/><path d="M28 20l44 40M72 20L28 60" stroke="#e5e7eb" stroke-width=".8" opacity=".6"/>`,
 snd:`<ellipse cx="50" cy="84" rx="30" ry="6" fill="#000" opacity=".12"/><path d="M24 50h52v24a6 6 0 0 1-6 6H30a6 6 0 0 1-6-6z" fill="url(#agR)" stroke="#7f1d1d"/>${[30,38,46,54,62,70].map(x=>`<rect x="${x-1}" y="58" width="2" height="16" rx="1" fill="#7f1d1d" opacity=".55"/>`).join("")}
  <path d="M28 50a22 28 0 0 1 44 0z" fill="url(#agLens)" stroke="#991b1b"/><path d="M34 46a16 18 0 0 1 14-16" fill="none" stroke="#fff" stroke-width="2" opacity=".7"/>`,
 sndbase:`<ellipse cx="50" cy="84" rx="40" ry="7" fill="#000" opacity=".12"/><path d="M8 62h84v10a6 6 0 0 1-6 6H14a6 6 0 0 1-6-6z" fill="url(#agW)" stroke="#9aa1aa"/><path d="M8 66h84" stroke="#ef4444" stroke-width="4" opacity=".85"/>${[18,26,74,82].map(x=>`<circle cx="${x}" cy="72" r="1.6" fill="#6b7280"/>`).join("")}
  <path d="M20 62a30 24 0 0 1 60 0z" fill="url(#agDome)" stroke="#a7aeb6"/>${[30,38,46,54,62,70].map(x=>`<rect x="${x-1.4}" y="50" width="2.8" height="10" rx="1.4" fill="#c4c9cf"/>`).join("")}<circle cx="64" cy="64" r="2.4" fill="#ef4444"/>`,
 mod:`<rect x="12" y="16" width="76" height="64" rx="6" fill="url(#agW)" stroke="#9aa1aa"/><rect x="18" y="22" width="64" height="16" rx="3" fill="#e5e7eb"/>${[24,34,44,54,64,74].map(x=>`<rect x="${x-4}" y="25" width="8" height="10" rx="1" fill="#16a34a"/><circle cx="${x}" cy="30" r="2" fill="#d1d5db"/>`).join("")}
  <rect x="18" y="58" width="64" height="16" rx="3" fill="#e5e7eb"/>${[24,34,44,54,64,74].map(x=>`<rect x="${x-4}" y="61" width="8" height="10" rx="1" fill="#0891b2"/><circle cx="${x}" cy="66" r="2" fill="#d1d5db"/>`).join("")}<circle cx="78" cy="47" r="2.6" fill="#22c55e"/><circle cx="70" cy="47" r="2.6" fill="#f59e0b"/><text x="22" y="51" font-size="8" font-family="monospace" fill="#475569">I/O</text>`,
 iso:`<rect x="20" y="26" width="60" height="48" rx="6" fill="url(#agW)" stroke="#9aa1aa"/><rect x="26" y="34" width="20" height="10" rx="1" fill="#b45309"/><rect x="54" y="34" width="20" height="10" rx="1" fill="#b45309"/><circle cx="50" cy="60" r="3" fill="#f59e0b"/><path d="M34 60h8M58 60h8" stroke="#475569" stroke-width="2"/>`,
 cdi:`<rect x="10" y="6" width="80" height="84" rx="6" fill="url(#agG)" stroke="#6b7280"/><rect x="18" y="14" width="64" height="28" rx="3" fill="#0e2433"/><text x="22" y="26" font-size="7" font-family="monospace" fill="#86efac">NORMAL</text><text x="22" y="36" font-size="6" font-family="monospace" fill="#5eead4">Laço 1 · 10 el.</text>
  ${[0,1,2,3].map(i=>`<circle cx="${24+i*9}" cy="50" r="2.6" fill="${["#22c55e","#f59e0b","#ef4444","#f59e0b"][i]}"/>`).join("")}${[0,1,2].map(r=>[0,1,2,3].map(c=>`<rect x="${52+c*7.5}" y="${46+r*8}" width="6" height="6" rx="1" fill="#d1d5db" stroke="#9ca3af" stroke-width=".5"/>`).join("")).join("")}<rect x="18" y="72" width="30" height="10" rx="2" fill="#ef4444"/><text x="20.5" y="79.5" font-size="5.5" fill="#fff" font-family="sans-serif">SILENCIAR</text>`,
 led:`<rect x="30" y="22" width="40" height="56" rx="6" fill="url(#agW)" stroke="#9aa1aa"/><circle cx="50" cy="44" r="10" fill="#ef4444"/><circle cx="47" cy="41" r="3" fill="#fff" opacity=".6"/><path d="M38 64h24" stroke="#9ca3af" stroke-width="2"/>`
};
const ART_OF={cdi:"cdi",iso:"iso",det:"det",mcp:"mcp",snd:"snd",min:"mod",mout:"mod",rli:"led",db:"det",fdm:"mcp",fdcio:"mod",fds:"snd",fdsb:"sndbase",fdcl:"iso"};
const EQP_KEY="of-eq-photos";
function eqPhotos(){let m={};try{m=JSON.parse(localStorage.getItem(EQP_KEY)||"{}")}catch(e){}return{...m,...((S.meta&&S.meta.eqPhotos)||{})}}
function eqPhotoKey(k){return(LG===LG_GEN?"gen:":"sie:")+k}
function artFor(k,x,y,w,h){const ph=eqPhotos()[eqPhotoKey(k)];if(ph)return`<image href="${ph}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" class="eqph"/>`;
 const a=ART[ART_OF[k]||"mod"];return`<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 100 92" preserveAspectRatio="xMidYMid meet">${a}</svg>`}
async function setEqPhoto(k,file){const im=await createImageBitmap(file);const L=360,s=Math.min(1,L/Math.max(im.width,im.height));const cv=document.createElement("canvas");cv.width=Math.round(im.width*s);cv.height=Math.round(im.height*s);
 cv.getContext("2d").drawImage(im,0,0,cv.width,cv.height);const url=cv.toDataURL("image/jpeg",.82);const key=eqPhotoKey(k);
 try{const m=JSON.parse(localStorage.getItem(EQP_KEY)||"{}");m[key]=url;localStorage.setItem(EQP_KEY,JSON.stringify(m))}catch(e){}
 if(S.projectId&&S.canWrite&&!S.demo){S.meta={...S.meta,eqPhotos:{...((S.meta&&S.meta.eqPhotos)||{}),[key]:url}};api.set("meta","project",{...S.meta})}}
function delEqPhoto(k){const key=eqPhotoKey(k);try{const m=JSON.parse(localStorage.getItem(EQP_KEY)||"{}");delete m[key];localStorage.setItem(EQP_KEY,JSON.stringify(m))}catch(e){}
 if(S.meta&&S.meta.eqPhotos&&S.meta.eqPhotos[key]&&S.canWrite){const e2={...S.meta.eqPhotos};delete e2[key];S.meta={...S.meta,eqPhotos:e2};api.set("meta","project",{...S.meta})}}

const LG_GEN={h:"Exemplo de ligação do laço",intro:"Laço endereçável classe A com isoladores, detetores, botoneira, sirenes, módulo de entrada e módulo de saída. Toca num elemento para ver como se liga. Bornes e valores são genéricos — seguir sempre a ficha do fabricante da central.",title:"Laço classe A · cabo 2 condutores + blindagem · + vermelho · − preto",seq:LSEQ,ret:LRET,lel:LEL};
let LG=LG_GEN;
function ligSvg(sel,shield){const W=1180,X0=150,step=(W-X0-40)/LG.seq.length,yT=96,yB=316;let s=`<svg class="lig" viewBox="0 0 ${W} 440" role="img" aria-label="Exemplo de ligação de um laço">${ART_DEFS}`;
 // central
 s+=`<g class="lgel${sel==="cdi"?" sel":""}" data-le="cdi" role="button" tabindex="0"><rect x="14" y="120" width="104" height="170" rx="12" class="lg-cdi"/>${artFor("cdi",26,128,80,80)}<text x="66" y="226" class="lg-t w">${esc(LG.cdi1||"CDI")}</text><text x="66" y="244" class="lg-s w">${esc(LG.cdi2||"Laço 1")}</text>
  <text x="122" y="${yT-14}" class="lg-s l">SAÍDA</text><text x="122" y="${yB+30}" class="lg-s l">RETORNO</text></g>`;
 const bus=(y,x1,x2,cls="")=>`<line x1="${x1}" y1="${y-5}" x2="${x2}" y2="${y-5}" class="lg-p ${cls}"/><line x1="${x1}" y1="${y+5}" x2="${x2}" y2="${y+5}" class="lg-m ${cls}"/>${shield?`<line x1="${x1}" y1="${y+13}" x2="${x2}" y2="${y+13}" class="lg-sh ${cls}"/>`:""}`;
 s+=`<path d="M118 150H130V${yT-5}" class="lg-p"/><path d="M118 160H138V${yT+5}" class="lg-m"/><path d="M118 230H130V${yB-5}" class="lg-p"/><path d="M118 240H138V${yB+5}" class="lg-m"/>`;
 s+=bus(yT,130,W-30)+`<path d="M${W-30} ${yT-5}V${yB-5}" class="lg-p"/><path d="M${W-22} ${yT+5}V${yB+5}" class="lg-m"/>`+bus(yB,130,W-22);
 if(shield)s+=`<path d="M${W-14} ${yT+13}V${yB+13}" class="lg-sh"/><path d="M14 ${yB+60}h40" class="lg-sh"/><text x="60" y="${yB+64}" class="lg-s l">blindagem: terra só na CDI</text><path d="M66 270V${yB+13}H130" class="lg-sh"/><circle cx="66" cy="285" r="5" class="lg-gnd"/>`;
 const el=(k,lab,x,y,i)=>{const L=LG.lel[k];const isI=!!L.small;const w=isI?Math.max(50,L.ic.length*8+14):96,h=isI?52:92;const yy=y-h/2;
  return`<g class="lgel${sel===k+":"+i?" sel":""}${isI?" iso":""}" data-le="${k}:${i}" role="button" tabindex="0"><rect x="${x-w/2}" y="${yy}" width="${w}" height="${h}" rx="${isI?6:10}" class="lg-b" style="--c:${L.col}"/>${artFor(k,x-(isI?16:26),yy+3,isI?32:52,isI?28:50)}<text x="${x}" y="${yy+(isI?44:66)}" class="lg-t">${esc(L.ic)}</text>${isI?"":`<text x="${x}" y="${yy+82}" class="lg-s">${esc(lab.split(" · ")[0].replace(/\s*\+\s*(DB720|FDSB226)/,"").slice(0,16))}</text>`}
   <circle cx="${x-w/2}" cy="${y-5}" r="3.2" class="lg-tp"/><circle cx="${x+w/2}" cy="${y-5}" r="3.2" class="lg-tp"/><circle cx="${x-w/2}" cy="${y+5}" r="3.2" class="lg-tm"/><circle cx="${x+w/2}" cy="${y+5}" r="3.2" class="lg-tm"/>
   ${isI?"":`<text x="${x}" y="${y<200?yy-8:yy+h+16}" class="lg-s n">${esc(lab.split(" · ")[1]||"")}</text>`}
   ${L.acc==="in"||L.acc==="io"?`<path d="M${x-(L.acc==="io"?30:0)} ${yy+h}V${y+62}" class="lg-aux"/><rect x="${x-(L.acc==="io"?30:0)-22}" y="${y+62}" width="44" height="22" rx="4" class="lg-acc"/><text x="${x-(L.acc==="io"?30:0)}" y="${y+77}" class="lg-s">contacto</text><text x="${x-(L.acc==="io"?30:0)}" y="${y+98}" class="lg-s">+ resist.</text>`:""}
   ${L.acc==="out"||L.acc==="io"?`<path d="M${x+(L.acc==="io"?30:0)} ${yy+h}V${y+62}" class="lg-aux"/><rect x="${x+(L.acc==="io"?30:0)-26}" y="${y+62}" width="52" height="22" rx="4" class="lg-acc"/><text x="${x+(L.acc==="io"?30:0)}" y="${y+77}" class="lg-s">retentor</text><text x="${x+(L.acc==="io"?30:0)}" y="${y+98}" class="lg-s">24 V aux.</text>`:""}
   ${/Teto|LED/.test(lab)&&!isI?`<path d="M${x+38} ${yy}V${yy-26}" class="lg-aux"/><circle cx="${x+38}" cy="${yy-32}" r="7" class="lg-led"/><text x="${x+52}" y="${yy-28}" class="lg-s l">LED à porta</text>`:""}</g>`};
 LG.seq.forEach(([k,l],i)=>{s+=el(k,l,X0+step*(i+.5),yT,i)});
 const stepB=(W-X0-40)/LG.ret.length;LG.ret.forEach(([k,l],i)=>{s+=el(k,l,W-60-stepB*(i+.5),yB,"r"+i)});
 s+=`<g class="lg-flow"><circle r="6" class="lg-dot"><animateMotion dur="7s" repeatCount="indefinite" path="M130 ${yT-5}H${W-30}V${yB-5}H130"/></circle></g>`;
 s+=`<text x="${W/2}" y="16" class="lg-h">${esc(LG.title)}</text>`;
 return s+`</svg>`}
function ligZoom(k0,lab){const L=LG.lel[k0];const k=L.zk||k0;const W=560;let s=`<svg class="lgz" viewBox="0 0 ${W} 230" role="img">`;
 const tb=(x,y,t,c)=>`<rect x="${x-17}" y="${y-11}" width="34" height="22" rx="4" class="lgz-tb"/><text x="${x}" y="${y+4}" class="lgz-tt" fill="${c}">${t}</text>`;
 const box=(x,w)=>`<rect x="${x}" y="30" width="${w}" height="120" rx="14" class="lgz-b" style="--c:${L.col}"/><text x="${x+w/2}" y="62" class="lg-t">${esc(L.ic)}</text><text x="${x+w/2}" y="82" class="lg-s">${esc((lab||L.n).slice(0,34))}</text>`;
 if(k==="cdi"){s+=box(150,260)+tb(190,138,"S+","#dc2626")+tb(235,138,"S−","#111")+tb(325,138,"R+","#dc2626")+tb(370,138,"R−","#111")+tb(280,110,"⏚","#16a34a");
  s+=`<path d="M190 149V215" class="lgz-p"/><path d="M235 149V215" class="lgz-m"/><path d="M325 149V215" class="lgz-p"/><path d="M370 149V215" class="lgz-m"/><path d="M280 121V160H430V215" class="lgz-sh"/><text x="212" y="226" class="lg-s">saída do laço</text><text x="348" y="226" class="lg-s">retorno</text><text x="470" y="200" class="lg-s l">blindagem</text>`}
 else if(k==="iso"){s+=box(160,240)+tb(200,138,"IN+","#dc2626")+tb(245,138,"IN−","#111")+tb(315,138,"OUT+","#dc2626")+tb(360,138,"OUT−","#111");
  s+=`<path d="M10 180H200V149" class="lgz-p"/><path d="M10 200H245V149" class="lgz-m"/><path d="M550 180H315V149" class="lgz-p"/><path d="M550 200H360V149" class="lgz-m"/><text x="20" y="172" class="lg-s l">vem da central / anterior</text><text x="540" y="172" class="lg-s r">segue para os próximos</text>`}
 else{s+=box(150,200)+tb(205,138,"L+","#dc2626")+tb(295,138,"L−","#111");
  s+=`<path d="M10 180H190Q205 180 205 149" class="lgz-p"/><path d="M550 180H220Q205 180 205 149" class="lgz-p"/><path d="M10 200H280Q295 200 295 149" class="lgz-m"/><path d="M550 200H310Q295 200 295 149" class="lgz-m"/>
   <text x="20" y="172" class="lg-s l">vem do anterior</text><text x="540" y="172" class="lg-s r">segue para o próximo</text><text x="250" y="222" class="lg-s">os dois fios + no mesmo borne · os dois fios − no mesmo borne</text>`;
  if(k==="det")s+=tb(330,105,"R","#f59e0b")+`<path d="M347 105H420" class="lgz-a"/><circle cx="430" cy="105" r="9" class="lg-led"/><text x="446" y="109" class="lg-s l">LED à porta</text>`;
  if(k==="min")s+=tb(330,95,"IN+","#0891b2")+tb(330,122,"IN−","#0891b2")+`<path d="M347 95H450" class="lgz-a"/><path d="M347 122H450" class="lgz-a"/><rect x="450" y="80" width="70" height="56" rx="6" class="lg-acc"/><text x="485" y="100" class="lg-s">contacto</text><path d="M462 112h22" class="lgz-a"/><rect x="470" y="116" width="34" height="11" rx="2" class="lgz-r"/><text x="487" y="150" class="lg-s">EOL no fim do fio</text>`;
  if(k==="mout")s+=tb(330,80,"C","#16a34a")+tb(330,104,"NF","#16a34a")+tb(330,128,"NA","#94a3b8")+`<path d="M347 80H440" class="lgz-a"/><path d="M347 104H440" class="lgz-a"/><rect x="440" y="66" width="100" height="54" rx="6" class="lg-acc"/><text x="490" y="88" class="lg-s">retentor da porta</text><text x="490" y="104" class="lg-s">24 V (fonte aux.)</text>`;
  if(k==="snd")s+=`<text x="250" y="110" class="lg-s">volume / tom: no aparelho ou por programação</text>`}
 return s+`</svg>`}
function ligTab(B,cfg){LG=cfg||LG_GEN;let sel=null,shield=true;
 B.innerHTML=`<section class="block"><h2>${esc(LG.h)} <span class="livetag">● interativo</span></h2><p class="mut" style="margin-top:0">${LG.intro}</p>
  <div class="toolrow"><label class="fsw"><input type="checkbox" id="lgSh" checked><span class="tg"></span>Mostrar blindagem</label><button class="btn sm" id="lgList">Lista de troços de cabo</button></div>
  <div class="simwrap ligw" id="lgW"></div><div class="lgdet" id="lgD"></div>
  ${LG.extra||""}<div class="lgrules"><h5>Regras de ligação do laço</h5><ul>
   <li>Respeitar a polaridade em todos os elementos (+ vermelho, − preto) — entra e sai nos mesmos bornes.</li>
   <li>Classe A: o laço volta à central; separar a ida e a volta por caminhos diferentes (NT 12, 6).</li>
   <li>Isoladores de forma que um curto ou corte não tire mais de 32 dispositivos (NT 12, 5.2) e a cada mudança de zona/piso.</li>
   <li>Blindagem contínua, ligada à terra só na central; isolar nas caixas de derivação.</li>
   <li>Cabo resistente ao fogo (30 min) nos circuitos que têm de funcionar após a deteção; secção pelo cálculo de corrente e comprimento do fabricante.</li>
   <li>Cargas grandes (retentores, sirenes externas, registos) com fonte auxiliar EN 54-4 comandada por módulo de saída.</li>
   <li>Antes de ligar à central: continuidade, isolamento e confirmação de endereços; depois, ensaio de cada elemento.</li></ul></div></section>`;
 const draw=()=>{$("lgW").innerHTML=ligSvg(sel,shield);$("lgW").querySelectorAll("[data-le]").forEach(g=>{g.onclick=()=>{sel=g.dataset.le;draw();show()};g.onkeydown=e=>{if(e.key==="Enter"){sel=g.dataset.le;draw();show()}}})};
 const show=()=>{if(!sel){$("lgD").innerHTML=`<div class="lgd0">👆 Toca na central, num isolador, num detetor ou num módulo para ver a ligação em detalhe.</div>`;return}
  const[k,ix]=sel.split(":");const L=LG.lel[k];if(!L)return;let lab=L.n;if(ix!=null){const src=String(ix).startsWith("r")?LG.ret[+String(ix).slice(1)]:LG.seq[+ix];if(src)lab=src[1]}
  const hasPh=!!eqPhotos()[eqPhotoKey(k)];$("lgD").innerHTML=`<div class="lgdc" style="--c:${L.col}"><div class="lgdh"><span class="pbadge" style="background:${L.col}">${esc(L.ic)}</span><b>${esc(lab)}</b><small>${esc(L.n)}</small></div><div class="lgpic"><div class="lgpimg"><svg viewBox="0 0 120 110">${ART_DEFS}${artFor(k,0,0,120,110)}</svg></div><div class="lgpact"><b>${hasPh?"Foto real da obra":"Ilustração do equipamento"}</b><small>${hasPh?"Esta foto aparece no esquema em vez da ilustração.":"Podes trocar por uma foto real do equipamento instalado (tirada na obra)."}</small><div class="toolrow"><label class="btn sm primary">📷 ${hasPh?"Trocar foto":"Usar foto real"}<input type="file" accept="image/*" capture="environment" hidden data-eqph="${k}"></label>${hasPh?`<button class="btn sm" data-eqdel="${k}">Voltar à ilustração</button>`:""}</div></div></div>${ligZoom(k,lab)}
   <div class="tec2"><div><h5>Bornes</h5><ul>${L.t.map(t=>`<li><code>${esc(t)}</code></li>`).join("")}</ul><h5>Como ligar</h5><ol>${L.how.map(h=>`<li>${h}</li>`).join("")}</ol></div><div><h5>Erros frequentes</h5><ul class="terr">${L.err.map(h=>`<li>${h}</li>`).join("")}</ul>
   ${/Teto|LED/.test(lab)?`<p class="mut">Este detetor está num teto falso: tem indicador de ação (LED) à porta.</p>`:""}</div></div></div>`};
 B.addEventListener("change",async e=>{const i=e.target.closest&&e.target.closest("[data-eqph]");if(!i||!i.files[0])return;try{await setEqPhoto(i.dataset.eqph,i.files[0]);toast("Foto guardada"+(S.projectId?" para esta obra.":" neste aparelho."));draw();show()}catch(err){toast("Não foi possível usar a foto.")}});
 B.addEventListener("click",e=>{const d=e.target.closest("[data-eqdel]");if(!d)return;delEqPhoto(d.dataset.eqdel);draw();show()});
 $("lgSh").onchange=e=>{shield=e.target.checked;draw()};
 $("lgList").onclick=()=>{const all=[["cdi","CDI saída"],...LG.seq,...LG.ret,["cdi","CDI retorno"]];let rows="";for(let i=0;i<all.length-1;i++)rows+=`<tr><td>C${String(i+1).padStart(2,"0")}</td><td>${esc(all[i][1])}</td><td>${esc(all[i+1][1])}</td><td>2×1,5 mm² + blind. (ex.)</td></tr>`;
  $("lgD").innerHTML=`<div class="lgdc"><div class="lgdh"><b>Lista de troços de cabo (exemplo)</b><small>serve de base para a etiquetagem dos cabos em obra</small></div><div class="tscroll"><table class="tt2"><tr><th>Troço</th><th>De</th><th>Para</th><th>Cabo</th></tr>${rows}</table></div><p class="mut">Cabo e secção: confirmar no cálculo do fabricante e no projeto (resistência ao fogo quando exigida).</p></div>`};
 draw();show()}

LEL.iso.small=true;LEL.min.acc="in";LEL.mout.acc="out";
/* exemplo Siemens (Cerberus PRO / Sinteso — laço C-NET / FDnet) */
const LEL_S={
 cdi:{...LEL.cdi,n:"Central Cerberus PRO / Sinteso — laço C-NET / FDnet",ic:"FC/FS",col:"#0f766e",
  how:["O laço sai e volta à central (classe A); todos os elementos FDnet/C-NET têm separador de linha integrado.","Até 252 elementos por laço e 3,3 km de cabo (FDnet) — confirmar o cálculo de laço da central.","Blindagem contínua, ligada à terra só na central."],err:LEL.cdi.err},
 db:{n:"Detetor FD720 na base DB720",ic:"DB720",col:"#475569",zk:"db720",t:["1b  +C-NET IN/OUT (os dois fios +)","6  −C-NET IN (− que chega)","5  −C-NET OUT (− que segue)","1a  + indicador externo (AI)"],
  how:["Os dois fios <b>+</b> (chega e segue) apertam no borne <b>1b</b>.","O <b>−</b> que chega vai ao borne <b>6</b> e o <b>−</b> que segue sai do borne <b>5</b> — entre eles fica o separador de linha do detetor.","Indicador de ação (AI) opcional: + no borne <b>1a</b> e − no borne 5/6, conforme a ficha.","Detetores FD720 (ex.: OP720 ótico, OOH740 multicritério) encaixam na base; endereço automático pela central."],
  err:["Trocar os bornes 5 e 6 (− IN / − OUT): o separador de linha fica do lado errado.","Ligar os dois − no mesmo borne: perde-se a função de separador nesse ponto.","Ligar o indicador externo diretamente ao laço."]},
 fdm:{n:"Botoneira FDM221",ic:"FDM221",col:"#dc2626",zk:"fdm",t:["LINE + (entra / sai)","LINE − (entra / sai)","Blindagem → borne auxiliar na caixa"],
  how:["Ligar o laço à régua de ligação da unidade de comutação, conforme o esquema da ficha.","A blindagem liga-se a um borne auxiliar na caixa de fundo (não à botoneira).","Separador de linha integrado; LED de dois cores (alarme / teste). Bornes 0,28–1,5 mm²."],
  err:["Blindagem cortada na botoneira (deixa de ser contínua).","Fios presos fora da régua com o vidro/elemento de rearme montado."]},
 fdcio:{n:"Módulo de entrada/saída FDCIO221",ic:"FDCIO221",col:"#0891b2",zk:"fdcio",acc:"io",t:["C-NET + / − (entra / sai)","Entrada vigiada (contacto livre de potencial + 2 resistências fornecidas)","Saída relé: livre de potencial 30 V DC / 22 V AC 2 A — ou vigiada 30 V DC 2 A"],
  how:["Liga ao laço como os outros elementos (separador de linha integrado; consumo em repouso ≤ 0,4 mA).","Entrada: contacto livre de potencial (ex.: fluxostato do sprinkler) com as resistências de terminação fornecidas — vigia corte e curto (resistência da linha ≤ 20 Ω).","Saída: escolher por ponte (jumper) relé livre de potencial ou saída vigiada; a saída vigiada precisa de alimentação auxiliar.","Exemplo: o relé corta os 24 V do retentor eletromagnético → a porta corta-fogo fecha em alarme."],
  err:["Resistências de terminação no módulo em vez de no fim da linha (o fio não fica vigiado).","Saída configurada como vigiada sem alimentação auxiliar.","Comandar cargas acima de 2 A diretamente pelo relé."]},
 fds:{n:"Sirene com sinalizador FDS226",ic:"FDS226",col:"#7c3aed",zk:"fds",t:["C-NET + / − (entra / sai)"],
  how:["Sirene com sinalizador ótico no laço (acústico EN 54-3 e ótico EN 54-23).","3 níveis sonoros e 16 tons selecionáveis; versões de corpo e LED vermelho ou branco (-RR, -RW, -WR, -WW).","Contar o consumo em alarme no cálculo do laço."],
  err:["Sinalizador escondido ou fora do campo de visão (deve ver-se de todo o espaço).","Demasiadas sirenes/sinalizadores no mesmo laço sem cálculo de corrente."]},
 fdsb:{n:"Base sirene-sinalizador FDSB226",ic:"FDSB226",col:"#9333ea",zk:"fds",t:["C-NET + / − (entra / sai)","Detetor compatível encaixa por cima"],how:["Base com sirene e sinalizador onde encaixa um detetor compatível — junta deteção e alarme no mesmo ponto do teto.","LED vermelho ou branco (-WR / -WW)."],err:["Usar com detetor não compatível (ver lista do fabricante)."]},
 fdcl:{n:"Separador de linha FDCL221",ic:"FDCL221",col:"#b45309",small:true,zk:"iso",t:["IN + / IN −","OUT (derivação) + / −"],how:["Usa-se onde saem várias derivações (T) em paralelo do laço: um curto numa derivação não afeta as outras.","Os elementos FDnet já têm separador integrado — o FDCL221 é para as derivações."],err:["Fazer derivações sem separador."]}
};
const LG_SIE={h:"Exemplo Siemens — laço C-NET / FDnet",cdi1:"FC/FS",cdi2:"C-NET / FDnet",
 intro:"Laço Siemens (Cerberus PRO / Sinteso) com detetores FD720 em bases <b>DB720</b>, botoneira <b>FDM221</b>, módulo <b>FDCIO221</b> (entrada do fluxostato e saída para a porta corta-fogo) e sinalizadores <b>FDS226</b> / base <b>FDSB226</b>. Toca em cada elemento para ver os bornes. Os bornes da DB720 (1a, 1b, 5, 6) vêm da ficha da Siemens; nos outros elementos confirmar a numeração no esquema da ficha de montagem.",
 title:"Laço FDnet / C-NET classe A · elementos com separador de linha integrado · + vermelho · − preto",
 seq:[["db","001 OP720 + DB720 · Receção"],["db","002 OOH740 + DB720 · Sala reuniões"],["fdm","003 FDM221 · Saída"],["fds","004 FDS226 · Corredor"],["fdcio","005 FDCIO221 · Sprinkler / porta CF"],["fdsb","006 Detetor + FDSB226 · Open space"],["fdcl","FDCL221"]],
 ret:[["db","007 OP720 + DB720 · Teto falso (LED)"],["fds","008 FDS226 · Escada"],["db","009 OP720 + DB720 · Arquivo"],["fdm","010 FDM221 · Saída 2"]],lel:LEL_S,
 extra:`<div class="lgrules sie"><h5>Notas Siemens</h5><ul><li>FDnet: até 252 elementos e 3,3 km por laço; até 40 derivações (T) com separador de linha.</li><li>Todos os elementos S-LINE e C-LINE (e FD720) têm separador de linha integrado.</li><li>FDCIO221: 1 entrada vigiada + 1 saída relé (ponte para livre de potencial ou vigiada); repouso ≤ 0,4 mA.</li><li>FDS226 / FDSB226: sirene com sinalizador (EN 54-3 / EN 54-23), 3 níveis e 16 tons.</li></ul></div>`};
const ligZoomBase=ligZoom;
ligZoom=function(k0,lab){const L=LG.lel[k0];if(!L)return"";const zk=L.zk;const W=560;
 const tb=(x,y,t,c)=>`<rect x="${x-19}" y="${y-11}" width="38" height="22" rx="4" class="lgz-tb"/><text x="${x}" y="${y+4}" class="lgz-tt" fill="${c}">${t}</text>`;
 const box=(x,w,t2)=>`<rect x="${x}" y="30" width="${w}" height="120" rx="14" class="lgz-b" style="--c:${L.col}"/><text x="${x+w/2}" y="58" class="lg-t">${esc(L.ic)}</text><text x="${x+w/2}" y="78" class="lg-s">${esc((t2||lab||L.n).slice(0,40))}</text>`;
 if(zk==="db720"){let s=`<svg class="lgz" viewBox="0 0 ${W} 240" role="img"><circle cx="280" cy="92" r="70" class="lgz-b" style="--c:${L.col}"/><text x="280" y="78" class="lg-t">DB720</text><text x="280" y="96" class="lg-s">base (vista de baixo)</text>`;
  s+=tb(210,130,"1b","#dc2626")+tb(350,130,"5","#111")+tb(310,160,"6","#111")+tb(250,160,"1a","#f59e0b");
  s+=`<path d="M10 186H180Q210 186 210 141" class="lgz-p"/><path d="M550 186H240Q210 186 210 141" class="lgz-p"/><path d="M10 210H290Q310 210 310 171" class="lgz-m"/><path d="M550 206H370Q350 206 350 141" class="lgz-m"/>
   <path d="M250 171V226H170" class="lgz-a"/><circle cx="160" cy="226" r="8" class="lg-led"/><text x="146" y="230" class="lg-s r">AI (opcional)</text>
   <text x="20" y="178" class="lg-s l">vem do anterior: + → 1b · − → 6</text><text x="540" y="178" class="lg-s r">segue: + de 1b · − de 5</text><text x="330" y="118" class="lg-s">separador entre 6 e 5</text></svg>`;return s}
 if(zk==="fdm"){let s=`<svg class="lgz" viewBox="0 0 ${W} 230" role="img">${box(160,240,"Unidade de comutação · régua LINE")}`+tb(230,128,"LINE +","#dc2626")+tb(330,128,"LINE −","#111");
  s+=`<path d="M10 180H215Q230 180 230 139" class="lgz-p"/><path d="M550 180H245Q230 180 230 139" class="lgz-p"/><path d="M10 200H315Q330 200 330 139" class="lgz-m"/><path d="M550 200H345Q330 200 330 139" class="lgz-m"/>
   <rect x="430" y="96" width="70" height="24" rx="4" class="lg-acc"/><text x="465" y="112" class="lg-s">borne aux.</text><path d="M10 215H465V120" class="lgz-sh"/><text x="300" y="226" class="lg-s">blindagem no borne auxiliar da caixa de fundo</text></svg>`;return s}
 if(zk==="fdcio"){let s=`<svg class="lgz" viewBox="0 0 ${W} 240" role="img">${box(130,230,"FDCIO221")}`+tb(170,132,"C+","#dc2626")+tb(230,132,"C−","#111")+tb(330,70,"IN","#0891b2")+tb(330,100,"IN","#0891b2")+tb(330,130,"OUT","#16a34a");
  s+=`<path d="M10 182H155Q170 182 170 143" class="lgz-p"/><path d="M550 182H185Q170 182 170 143" class="lgz-p"/><path d="M10 202H215Q230 202 230 143" class="lgz-m"/><path d="M550 202H245Q230 202 230 143" class="lgz-m"/>
   <path d="M349 70H430" class="lgz-a"/><path d="M349 100H430" class="lgz-a"/><rect x="430" y="56" width="110" height="56" rx="6" class="lg-acc"/><text x="485" y="74" class="lg-s">fluxostato</text><text x="485" y="88" class="lg-s">(contacto livre)</text><rect x="466" y="94" width="38" height="10" rx="2" class="lgz-r"/><text x="485" y="122" class="lg-s">resistências no fim</text>
   <path d="M349 130H400V150H430" class="lgz-a"/><rect x="430" y="140" width="110" height="34" rx="6" class="lg-acc"/><text x="485" y="155" class="lg-s">retentor porta CF</text><text x="485" y="168" class="lg-s">24 V aux. (relé corta)</text></svg>`;return s}
 if(zk==="fds"){let s=`<svg class="lgz" viewBox="0 0 ${W} 230" role="img">${box(170,220)}<circle cx="280" cy="110" r="16" class="lg-led"/><path d="M262 92l-10-10M298 92l10-10M280 86V74" class="lgz-a"/>`+tb(230,132,"+","#dc2626")+tb(330,132,"−","#111");
  s+=`<path d="M10 182H215Q230 182 230 143" class="lgz-p"/><path d="M550 182H245Q230 182 230 143" class="lgz-p"/><path d="M10 202H315Q330 202 330 143" class="lgz-m"/><path d="M550 202H345Q330 202 330 143" class="lgz-m"/><text x="280" y="222" class="lg-s">nível sonoro (3) e tom (16) no aparelho/programação</text></svg>`;return s}
 if(L===LEL_S.cdi||k0==="fdcl"){LG.lel[k0]={...L,zk:k0==="fdcl"?"iso":"cdi"}}const out=ligZoomBase(k0,lab);LG.lel[k0]=L;return out};

const SEGF=[["sadi","SADI — visão geral","🔥"],["proto","Protocolos SADI","🧩"],["lig","Ligação do laço","🔌"],["sie","Exemplo Siemens","🔧"],["sim","Simulador de laço","⟳"]];
function kSeg(E){const k=st.sub.seg||"sadi";
 E.innerHTML=`<div class="segh"><span class="segfold">📁</span><div><b>Segurança</b><small>Sistemas Automáticos de Deteção de Incêndio (SADI)</small></div></div>
 <div class="segtabs">${SEGF.map(f=>`<button data-sg="${f[0]}" class="${k===f[0]?"on":""}"><span>${f[2]}</span>${f[1]}</button>`).join("")}</div><div id="segB"></div>`;
 E.querySelectorAll("[data-sg]").forEach(b=>b.onclick=()=>{st.sub.seg=b.dataset.sg;kSeg(E)});const B=$("segB");
 if(k==="sadi")B.innerHTML=`<div class="tecacc">${[
  ["Componentes",`<ul><li><b>CDI</b> — central de deteção de incêndio (EN 54-2) com fonte de alimentação (EN 54-4).</li><li><b>Detetores automáticos</b>: ótico de fumo (EN 54-7), térmico (EN 54-5), chama (EN 54-10), linear/feixe (EN 54-12), aspiração (EN 54-20), multicritério.</li><li><b>Botoneiras</b> (EN 54-11), <b>sirenes</b> (EN 54-3), <b>sinalizadores óticos</b> (EN 54-23).</li><li><b>Módulos de entrada/saída</b> (EN 54-18) e <b>isoladores</b> (EN 54-17).</li><li><b>Repetidores</b>, <b>transmissão de alerta</b> (EN 54-21) e sistemas via rádio (EN 54-25).</li></ul>`],
  ["Configurações (RT-SCIE)",`<p>O RT-SCIE define três configurações (Quadro I, art.º 125.º): a <b>1</b> com botoneiras, detetores e difusão do alarme; a <b>2</b> e a <b>3</b> acrescentam alerta automático e comandos, com a 3 em proteção total. A configuração exigida depende da utilização-tipo e da categoria de risco (Quadro II). Confirmar no projeto de SCIE.</p>`],
  ["Zonamento",`<ul><li>Área máxima por zona: <b>1 600 m²</b>.</li><li>Uma zona fica num só piso (exceto caixas de escada, ductos, elevadores no mesmo compartimento, ou edifícios com menos de 300 m²).</li><li>Zonas com mais de 5 compartimentos: indicação de qual detetor atuou (na CDI ou com indicadores de ação junto às portas).</li></ul>`],
  ["Avarias e isoladores",`<ul><li>Um único curto-circuito ou corte <b>não pode deixar mais de 32 dispositivos</b> inoperacionais (e esses devem ser da mesma zona e função).</li><li>Duas avarias no mesmo circuito não podem afetar mais de 10 000 m² ou mais de 5 compartimentos.</li><li>Em laços (classe A), separar as duas pernas para que um mesmo incidente não as danifique.</li></ul>`],
  ["Botoneiras e sirenes",`<ul><li>Botoneiras nos caminhos de evacuação, junto às portas das escadas e saídas; ninguém deve percorrer mais de <b>30 m</b> até uma; altura <b>≈ 1,2 m</b>.</li><li>Sirenes: mínimo <b>65 dB(A)</b> e 10 dB(A) acima do ruído; quartos: <b>75 dB(A)</b> à cabeceira; máximo 120 dB(A); pelo menos 2 por edifício e 1 por compartimento.</li></ul>`],
  ["Central, alimentação e cabos",`<ul><li>Visor da CDI a <b>1,4 – 1,8 m</b>, local limpo, seco e de preferência vigiado.</li><li>Autonomia: <b>72 h</b> em vigilância + <b>30 min</b> em alarme (30 h com contrato de manutenção com reparação &lt; 24 h; casos especiais 4 h); baterias com +25 % de capacidade.</li><li>Circuitos que têm de funcionar mais de 1 min após a deteção: resistência ao fogo de <b>30 min</b> (ou proteção equivalente).</li></ul>`],
  ["Detetores — colocação",`<ul><li>Elemento sensível nos <b>10 % superiores</b> da altura do compartimento; não embutir no teto.</li><li>A <b>0,5 m</b> das paredes e com 0,5 m livres à volta.</li><li>Áreas de cobertura conforme EN 54-14 / CEN/TS 54-14.</li></ul>`],
  ["Manutenção",`<ul><li><b>Diária</b>: estado da CDI, registos de alarmes e reposição após inibições.</li><li><b>Trimestral</b>: autonomia das baterias, pelo menos um dispositivo por zona, afastamentos e acesso às botoneiras.</li><li><b>Anual</b>: todos os detetores (até 25 % em cada visita trimestral); baterias conforme o fabricante.</li></ul>`]
 ].map((s,i)=>`<details${i<2?" open":""}><summary>${s[0]}</summary><div class="tecart">${s[1]}<p class="mut">Fonte: ${esc(SADI_F.nt12)} · ${esc(SADI_F.rtscie)}</p></div></details>`).join("")}</div>`;
 else if(k==="proto"){B.innerHTML=`<p class="mut">Cada fabricante usa o seu protocolo de laço: dispositivos e central têm de ser do mesmo protocolo. Capacidades: ${esc(SADI_F.fab)}.</p><div class="tprotos">${SPROTO.map((p,i)=>`<details class="tproto"${i===1?" open":""}><summary><span class="pbadge sadi">${esc(p.n.split(/[ /(]/)[0])}</span><span class="pst"><b>${p.n}</b><span>${p.uso}</span></span></summary>${protoDetail(p)}</details>`).join("")}</div>`;wireProto(B)}
 else if(k==="lig")ligTab(B);
 else if(k==="sie")ligTab(B,LG_SIE);
 else{B.innerHTML=`<section class="block"><h2>Simulador de laço endereçável <span class="livetag">● interativo</span></h2><p class="mut" style="margin-top:0">Vê o efeito dos isoladores e do laço fechado (classe A) quando há um curto-circuito ou um corte — e o que acontece a um alarme num troço fora de serviço.</p>${loopSim()}</section>`;wireLoop(B)}}

BASE.fontes.nt12=SADI_F.nt12;BASE.fontes.rtscie=SADI_F.rtscie;
KB.push(
 {id:"sadi_iso",t:"SADI — isoladores e regra dos 32 dispositivos",k:"sadi incendio isolador isoladores 32 dispositivos laco curto circuito corte classe a classe b",h:()=>`<p>Um único curto-circuito ou corte não pode deixar mais de <b>32 dispositivos</b> inoperacionais (da mesma zona e função) — por isso usam-se <b>isoladores</b> no laço. Em classe A (laço fechado) separar as duas pernas.</p>`,f:"nt12",go2:"sim"},
 {id:"sadi_sir",t:"SADI — sirenes (níveis sonoros)",k:"sadi incendio sirene sirenes db decibeis 65 75 120 som alarme quarto",h:()=>`<p>Mínimo <b>65 dB(A)</b> e 10 dB(A) acima do ruído; quartos <b>75 dB(A)</b> à cabeceira; máximo 120 dB(A); pelo menos 2 sirenes por edifício e 1 por compartimento.</p>`,f:"nt12"},
 {id:"sadi_bot",t:"SADI — botoneiras",k:"sadi incendio botoneira botoneiras altura 1,2 30 m distancia manual call point",h:()=>`<p>Nos caminhos de evacuação, junto às portas das escadas e saídas; distância máxima a percorrer <b>30 m</b>; altura <b>≈ 1,2 m</b>.</p>`,f:"nt12"},
 {id:"sadi_bat",t:"SADI — autonomia da central (baterias)",k:"sadi incendio central cdi bateria baterias autonomia 72 h 30 min alimentacao",h:()=>`<p><b>72 h</b> em vigilância + <b>30 min</b> em alarme (30 h com contrato de manutenção com reparação em menos de 24 h); dimensionar com +25 % de capacidade.</p>`,f:"nt12"},
 {id:"sadi_zona",t:"SADI — zonamento",k:"sadi incendio zona zonas 1600 m2 area piso zonamento",h:()=>`<p>Até <b>1 600 m²</b> por zona e uma zona num só piso (exceções: caixas de escada, ductos, elevadores, edifícios &lt; 300 m²).</p>`,f:"nt12"},
 {id:"sadi_proto",t:"SADI — protocolos de laço (Apollo, Hochiki, FDnet, LSN…)",k:"sadi incendio protocolo protocolos apollo xp95 discovery soteria hochiki esp fdnet siemens bosch lsn notifier enderecavel convencional laco",go:["cons","seg","proto"]}
);

/* painéis soltos (usados pelo TecFlow, que organiza tudo por áreas) */
function panel(name,E,o){o=o||{};try{D=S.meta&&S.meta.tecData&&typeof S.meta.tecData==="object"?deepMerge(BASE,S.meta.tecData):BASE}catch(e){D=BASE}
 root=E;if(name==="ia")st.tab="ia";if(o.sub){if(name==="calc")st.sub.calc=o.sub;else st.sub[name]=o.sub}if(o.guia)st.guia=o.guia;if(o.pre)st.pre=o.pre;
 const f={guia:kGuia,banc:kBanc,esq:kEsq,auto:kAuto,seg:kSeg,tab:kTab,calc:pCalc,ia:pIA}[name];if(!f)return false;f(E);if(o.q)setTimeout(()=>ask(o.q),50);return true}
function index(){return{kb:KB.map(k=>({id:k.id,t:k.t,k:k.k||"",f:k.f||"",calc:k.calc||""})),
 proto:PROTO.map(p=>({n:p.n,uso:p.uso||"",norma:p.norma||"",lim:p.lim||""})),sproto:SPROTO.map(p=>({n:p.n,uso:p.uso||""})),
 lel:Object.entries(LEL).map(([id,v])=>({id,n:v.n})),lels:Object.entries(LEL_S).map(([id,v])=>({id,n:v.n})),
 esq:Object.entries(ESQ2).map(([id,v])=>({id,t:v.t})),ex:EXS.map(e=>({id:e.id,t:e.t||e.n||e.id})),calcs:CALCS.map(c=>({id:c[0],t:c[1]}))}}
window.TEC={render,panel,index,ask:q=>{ask(q)},open:o=>render(root,o),interpret,calc:{queda,protecao,tubo,eredes,izDe,escalao,habMin},data:()=>D,version:TEC_VERSION};
})();
