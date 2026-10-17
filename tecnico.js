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
const st={tab:"inicio",sub:{calc:"qt",cons:"guia",auto:"tab",esq:"escada"},guia:null,pre:{},ctx:null,chat:[]};
const HKEY="of-tec-hist";
const hist=()=>{try{return JSON.parse(localStorage.getItem(HKEY)||"[]")}catch(e){return[]}};
const histAdd=h=>{try{localStorage.setItem(HKEY,JSON.stringify([h,...hist()].slice(0,30)))}catch(e){}};
const TABS=[["inicio","Início"],["calc","Calcular"],["cons","Consultar"],["ia","Assistente"]];
const CALCS=[["qt","Queda de tensão","ΔU %"],["tubo","Ocupação de tubos","VD"],["prot","Proteções / amperagem","IZ"],["pot","Potências E-REDES","kVA"]];
const CONS=[["guia","Guia de bolso"],["esq","Esquemas"],["auto","Automação"],["tab","Tabelas e fontes"]];
let root=null;
function render(Wr,opts){root=Wr;try{D=S.meta&&S.meta.tecData&&typeof S.meta.tecData==="object"?deepMerge(BASE,S.meta.tecData):BASE}catch(e){D=BASE}if(opts){if(opts.tab)st.tab=opts.tab;if(opts.sub)st.sub[opts.tab==="cons"?"cons":"calc"]=opts.sub;if(opts.pre)st.pre=opts.pre;if(opts.ctx!==undefined)st.ctx=opts.ctx;if(opts.q){st.tab="ia";setTimeout(()=>ask(opts.q),50)}if(opts.esq){st.sub.esq=opts.esq}if(opts.auto)st.sub.auto=opts.auto}
 const ctx=st.ctx?`<div class="tecctx">A trabalhar para <b>${esc(st.ctx.label)}</b> — os resultados podem ser guardados aí. <button class="linkb" id="tcCtxX">Limpar</button></div>`:"";
 Wr.innerHTML=pageHead("Técnico","Técnico — RTIEBT","Manual, calculadoras e assistente. Funciona sem rede.",`<span class="tecoff" title="Tudo corre neste aparelho">● Sem rede OK</span>`)+ctx+
  `<div class="ptabs tectabs">${TABS.map(([k,n])=>`<button data-tt="${k}" class="${st.tab===k?"on":""}">${n}</button>`).join("")}</div><div class="tecbody" id="tecBody"></div>`;
 Wr.querySelectorAll("[data-tt]").forEach(b=>b.onclick=()=>{st.tab=b.dataset.tt;render(Wr)});
 const cx=$("tcCtxX");if(cx)cx.onclick=()=>{st.ctx=null;render(Wr)};
 Wr.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>go(b.dataset.go));
 const B=$("tecBody");({inicio:pInicio,calc:pCalc,cons:pCons,ia:pIA})[st.tab](B)}
const goTec=(tab,sub,extra)=>{st.tab=tab;if(sub){if(tab==="calc")st.sub.calc=sub;else if(tab==="cons")st.sub.cons=sub}if(extra)Object.assign(st,extra);render(root);const pg=$("viewPage");if(pg)pg.scrollTop=0};

/* ---------- Início ---------- */
const DEST=[["Queda de tensão","3% iluminação · 5% outros usos","cons","guia","queda"],["Coordenação","IB ≤ In ≤ IZ (fusível gG: In ≤ 0,9 IZ)","cons","guia","coord"],["Diferencial","R × IΔn ≤ 50 V (25 V em locais húmidos)","cons","guia","dr"],
 ["Circuitos","Iluminação 1,5 mm²/10 A · Tomadas 2,5 mm²/16 A · máx. 8 pontos","cons","guia","circ"],["Tubos embebidos","Ocupação ≤ ⅓ da secção interior","cons","guia","tubos"],["Entradas","≥ 6 mm² · tubo ≥ 32 mm","cons","guia","entrada"]];
function pInicio(B){const h=hist();
 B.innerHTML=`<div class="tecgrid">${CALCS.map(c=>`<button class="teccard" data-c="${c[0]}"><span class="tci">${c[2]}</span><b>${c[1]}</b><small>Calcular</small></button>`).join("")}
  <button class="teccard" data-cs="guia"><span class="tci">📘</span><b>Guia de bolso</b><small>Regras rápidas</small></button><button class="teccard" data-cs="esq"><span class="tci">⌁</span><b>Esquemas</b><small>Escada, inversor, quadro, sensor</small></button>
  <button class="teccard" data-cs="auto"><span class="tci">⇄</span><b>Automação</b><small>KNX · DALI · Modbus</small></button><button class="teccard ia" data-ia="1"><span class="tci">?</span><b>Assistente</b><small>Pergunta em português</small></button></div>
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
const resBox=(ok,big,lines,save)=>`<div class="tecres ${ok===true?"ok":ok===false?"bad":""}"><div class="trb">${big}</div>${lines.map(l=>`<p>${l}</p>`).join("")}${save?`<div class="toolrow"><button class="btn sm primary" id="tcSave">Guardar resultado</button><button class="btn sm" id="tcAsk">Explicar</button></div>`:""}</div>`;
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
   `Fator K desta secção: <b>${n2(r.kAm,0)} A·m</b> → distância máxima com ${n2(I,1)} A: <b>${n2(r.Lmax,0)} m</b>.`,r.smin?`Secção mínima para ${n2(L)} m: <b>${n2(r.smin)} mm²</b>${r.smin>S?" — aumentar a secção":""}.`:"Nem 240 mm² chega — rever o traçado ou a alimentação."],true);
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
   `<span class="tocc">${r.all.filter(a=>a.dn<=110).map(a=>`<i class="${a.occ<=r.pct?"y":"n"}" title="${n2(a.occ,0)}%">${a.dn}<em>${n2(a.occ,0)}%</em></i>`).join("")}</span>`].filter(Boolean),true);
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
   r.sug?`Secção mínima nestas condições: <b>${n2(r.sug)} mm²</b> (e nunca menos de 1,5 mm² em iluminação ou 2,5 mm² em tomadas).`:"",`Não esquecer: verificar também a queda de tensão. <button class="linkb" id="pGoQ">Calcular queda →</button>`].filter(Boolean),true);
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
  $("pmR").innerHTML=resBox(ok,big,lines,true);wireRes("Potência E-REDES",txt,"pot",pre,"potencia "+txt)};
 wireSeg(E,form);form()}
function wireRes(title,txt,c,pre,q){const s=$("tcSave");if(s)s.onclick=()=>saveResult(title,txt,c,pre);const a=$("tcAsk");if(a)a.onclick=()=>{st.tab="ia";render(root);ask(q)}}
/* guardar numa tarefa, num equipamento ou só no histórico */
function saveResult(title,txt,c,pre){const tasks=S.issues.filter(x=>(x.kind==="tarefa"||x.kind==="duvida")&&x.status!=="resolvida");const its=S.items.filter(i=>i.planId===S.planId);
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
 B.querySelectorAll("[data-sc]").forEach(b=>b.onclick=()=>{st.sub.cons=b.dataset.sc;pCons(B)});({guia:kGuia,esq:kEsq,auto:kAuto,tab:kTab})[c]($("tcK"))}
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
 E.querySelectorAll("[data-e]").forEach(b=>b.onclick=()=>{st.sub.esq=b.dataset.e;kEsq(E)});$("eAsk").onclick=()=>{st.tab="ia";render(root);ask(s.t)}}
function kAuto(E){const k=st.sub.auto||"tab";
 E.innerHTML=`<div class="tecsub sm">${[["tab","Tabela de protocolos"],["sel","Seleção de redes"],["topo","Tipologias bus"]].map(x=>`<button data-a="${x[0]}" class="${x[0]===k?"on":""}">${x[1]}</button>`).join("")}</div><div id="kaB"></div>`;
 E.querySelectorAll("[data-a]").forEach(b=>b.onclick=()=>{st.sub.auto=b.dataset.a;kAuto(E)});const B=$("kaB");
 if(k==="tab")B.innerHTML=`<div class="tprotos">${PROTO.map(p=>`<details class="tproto"><summary><b>${p.n}</b><span>${p.uso}</span></summary><table class="tt2">${[["Meio / cabo",p.meio],["Velocidade",p.vel],["Limites",p.lim],["Topologia",p.top],["Terminação",p.term],["Norma",p.norma]].map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join("")}</table></details>`).join("")}</div><p class="mut">Valores de referência das normas indicadas — confirmar nas fichas dos fabricantes.</p>`;
 else if(k==="sel")B.innerHTML=`<p>O que precisas de fazer?</p><div class="tsel">${SELEC.map((s,i)=>`<button data-s="${i}">${s.q}</button>`).join("")}</div><div id="ksR"></div>`;
 else B.innerHTML=Object.values(TOPO).map(t=>`<section class="block tecTopo"><h2>${t.t}</h2>${t.svg()}<p>${t.p}</p></section>`).join("");
 B.querySelectorAll("[data-s]").forEach(b=>b.onclick=()=>{B.querySelectorAll("[data-s]").forEach(x=>x.classList.toggle("on",x===b));const s=SELEC[+b.dataset.s];
  $("ksR").innerHTML=`<div class="tecres"><div class="trb">${s.r.join(" + ")}</div><p>${s.p}</p>${s.r.map(n=>PROTO.find(p=>p.n===n)).filter(Boolean).map(p=>`<p><b>${p.n}:</b> ${p.lim}</p>`).join("")}</div>`})}
function kTab(E){const can=S.isCoord||S.isProjAdmin;const custom=!!(S.meta&&S.meta.tecData);
 E.innerHTML=`<section class="block"><h2>Tabelas e fontes</h2><p>Todos os valores usados nas calculadoras e no assistente estão nestas tabelas. Devem ser confirmados pelo técnico responsável e pela edição em vigor das RTIEBT.</p>
  <p>${custom?"✏️ Esta obra usa <b>tabelas corrigidas</b> pela coordenação.":"A usar as tabelas de base do ObraFlow ("+TEC_VERSION+")."}</p>
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
 const pr=PROTO.find(p=>n.includes(normQ(p.n.split(" ")[0])));if(pr){out.html=`<p><b>${pr.n}</b> — ${pr.uso}.</p><table class="tt2">${[["Meio / cabo",pr.meio],["Velocidade",pr.vel],["Limites",pr.lim],["Topologia",pr.top],["Terminação",pr.term]].map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join("")}</table>`;out.acts.push(["Tabela de protocolos","cons","auto",{auto:"tab"}]);out.src.push(pr.norma);return out}
 // procura no guia
 const hits=KB.map(k=>({k,s:score(k,n)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).slice(0,3);
 if(hits.length){const k=hits[0].k;if(k.go){out.html=`<p>Encontrei: <b>${k.t}</b>.</p>`;out.acts.push(["Abrir",k.go[0],k.go[1],k.go[0]==="cons"&&k.go[1]==="esq"?{esq:k.go[2]}:{auto:k.go[2]}]);return out}
  out.html=`<p><b>${k.t}</b></p>${k.h()}`+(hits.length>1?`<p class="mut">Também relacionado: ${hits.slice(1).map(h=>`<button class="linkb" data-ask="${esc(h.k.t)}">${esc(h.k.t)}</button>`).join(" · ")}</p>`:"");if(k.calc)out.acts.push(["Abrir calculadora","calc",k.calc,{}]);out.src.push(F(k.f));return out}
 out.html=`<p>Ainda não sei responder a isso. Tenta com termos como <i>queda de tensão, disjuntor, tubo, diferencial, potência, cores, KNX, comutador de escada</i> — ou com números (ex.: <i>«que secção para 25 A a 40 m»</i>).</p><p class="mut">O assistente funciona só com o guia e as tabelas desta app, sem internet.</p>`;return out}
const QUICK=["Queda de tensão 16 A 35 m 2,5 mm²","Que secção para 32 A a 20 m?","Tubo para 5 cabos de 2,5 mm²","6,9 kVA trifásico quantos amperes?","Resistência de terra máxima com 30 mA","Que DR para placa de indução?","Cores dos condutores","Como ligar comutador de escada","DALI quantos dispositivos por linha?","Potência mínima T3 4 compartimentos"];
function pIA(B){B.innerHTML=`<div class="tecchat"><div class="tcmsgs" id="tcMsgs">${st.chat.length?"":`<div class="tcm bot"><p>Olá! Sou o assistente técnico. Respondo com base no guia e nas tabelas RTIEBT desta app — <b>sem internet</b>. Faz uma pergunta ou escolhe um atalho.</p></div>`}</div>
  <div class="tcquick">${QUICK.map(q=>`<button data-q="${esc(q)}">${esc(q)}</button>`).join("")}</div>
  <form class="tcin" id="tcF"><input id="tcQ" placeholder="Escreve a tua dúvida… (ex.: disjuntor para 20 A em 2,5 mm²)" autocomplete="off"><button class="btn primary">Perguntar</button></form>
  <p class="mut tcdisc">As respostas são de apoio didático: confirma sempre com o projeto, o técnico responsável e a edição em vigor das RTIEBT.</p></div>`;
 st.chat.forEach(m=>appendMsg(m,false));
 B.querySelectorAll("[data-q]").forEach(b=>b.onclick=()=>ask(b.dataset.q));$("tcF").onsubmit=e=>{e.preventDefault();const q=$("tcQ").value.trim();if(q){ask(q);$("tcQ").value=""}}}
function ask(q){if(st.tab!=="ia"||!$("tcMsgs")){st.tab="ia";render(root)}const r=interpret(q);const m={q,r,at:now()};st.chat.push(m);st.chat=st.chat.slice(-30);appendMsg(m,true)}
function appendMsg(m,scroll){const box=$("tcMsgs");if(!box)return;const d=document.createElement("div");d.className="tcpair";
 d.innerHTML=`<div class="tcm me"><p>${esc(m.q)}</p></div><div class="tcm bot">${m.r.html}${m.r.src.length?`<p class="tcsrc">Fonte: ${[...new Set(m.r.src)].map(esc).join(" · ")}</p>`:""}<div class="toolrow">${m.r.acts.map((a,i)=>`<button class="btn sm" data-act="${i}">${a[0]}</button>`).join("")}<button class="btn sm" data-sv="1">Guardar resposta</button></div></div>`;
 box.appendChild(d);d.querySelectorAll("[data-act]").forEach(b=>b.onclick=()=>{const a=m.r.acts[+b.dataset.act];if(a[1]==="calc"){st.pre=a[3]||{};goTec("calc",a[2])}else{const ex=a[3]||{};if(ex.esq)st.sub.esq=ex.esq;if(ex.auto)st.sub.auto=ex.auto;goTec("cons",a[2],ex.guia?{guia:ex.guia}:null)}});
 d.querySelectorAll("[data-ask]").forEach(b=>b.onclick=()=>ask(b.dataset.ask));
 d.querySelector("[data-sv]").onclick=()=>{const t=document.createElement("div");t.innerHTML=m.r.html;saveResult("Assistente: "+m.q,t.textContent.replace(/\s+/g," ").trim().slice(0,600),null,null)};
 if(scroll)d.scrollIntoView({block:"end",behavior:"smooth"})}

window.TEC={render,ask:q=>{ask(q)},open:o=>render(root,o),interpret,calc:{queda,protecao,tubo,eredes,izDe,escalao,habMin},data:()=>D,version:TEC_VERSION};
})();
