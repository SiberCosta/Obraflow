/* =========================================================
   TecFlow — Eletricidade (eletricista e técnico de redes elétricas) e ITED (v45)
   ========================================================= */
"use strict";
window.TF_DATA3_VER="46";
Object.assign(TF_REF,{
 dl96:{t:"Decreto-Lei n.º 96/2017 — regime das instalações elétricas particulares",s:"nr"},
 l14:{t:"Lei n.º 14/2015 — requisitos dos técnicos responsáveis e entidades inspetoras de instalações elétricas",s:"nr"},
 en50110:{t:"EN 50110-1 — exploração de instalações elétricas (trabalhos e segurança)",s:"nr"},
 en60898:{t:"EN 60898 / EN 61008 / EN 61009 — disjuntores e interruptores diferenciais",s:"nr"},
 en61643:{t:"EN 61643-11 — descarregadores de sobretensões (SPD)",s:"nr"},
 iec60479:{t:"IEC 60479 — efeitos da corrente no corpo humano",s:"nr"},
 en60903:{t:"EN 60903 / EN 60900 / EN 61243-3 — luvas isolantes, ferramentas isoladas, detetores de tensão",s:"nr"},
 ited:{t:"Manual ITED — 4.ª edição (ANACOM) · DL n.º 123/2009 alterado pelo DL n.º 95/2019",u:"https://www.anacom.pt",s:"nr"},
 en50160:{t:"EN 50160 — características da tensão fornecida pelas redes públicas",s:"nr"}
});
TF_AREAS.splice(3,0,{id:"elet",t:"Eletricidade",c:"#16a34a",ic:"bolt",d:"Fundamentos, proteções, terras, redes de distribuição, segurança, ensaios, motores, legislação e ITED.",
 subs:[["fund","Fundamentos e fórmulas"],["prot","Proteções e diferenciais"],["terra","Terras e equipotencial"],["redes","Redes de distribuição"],["seg","Segurança elétrica"],["ens","Ensaios e certificação"],["mot","Motores e comandos"],["ited","ITED"],["leg","Legislação"]]});
TF_TOPICS.elet="Eletricidade";TF_TOPICS.ited="ITED";

/* conteúdos por secção: cada bloco tem título, classe de fonte e HTML */
const TF_ELET={
 fund:[
  {t:"Grandezas e fórmulas",s:"dd",h:`<div class="tscroll"><table class="tt2"><tr><th>Grandeza</th><th>Fórmula</th><th>Unidade</th></tr>
   <tr><td>Lei de Ohm</td><td><b>U = R × I</b></td><td>V, Ω, A</td></tr>
   <tr><td>Potência (contínua / resistiva)</td><td><b>P = U × I = R × I²</b></td><td>W</td></tr>
   <tr><td>Potência ativa monofásica</td><td><b>P = U × I × cos φ</b></td><td>W</td></tr>
   <tr><td>Potência ativa trifásica</td><td><b>P = √3 × U × I × cos φ</b> (U entre fases)</td><td>W</td></tr>
   <tr><td>Potência aparente</td><td><b>S = U × I</b> (mono) · <b>S = √3 × U × I</b> (tri)</td><td>VA</td></tr>
   <tr><td>Potência reativa</td><td><b>Q = S × sen φ</b></td><td>var</td></tr>
   <tr><td>Energia</td><td><b>E = P × t</b></td><td>kWh</td></tr>
   <tr><td>Resistência de um condutor</td><td><b>R = ρ × L / S</b> (cobre ≈ 0,0225 Ω·mm²/m em serviço)</td><td>Ω</td></tr></table></div>`},
  {t:"Rede em Portugal",s:"nr",ref:"en50160",h:`<ul><li>Baixa tensão: <b>230 V</b> entre fase e neutro, <b>400 V</b> entre fases, <b>50 Hz</b>.</li><li>Variação de tensão admitida na rede pública: tipicamente ±10 % (EN 50160).</li><li>Cores: castanho / preto / cinzento = fases; azul = neutro; verde-amarelo = proteção (PE).</li></ul>`},
  {t:"Fator de potência",s:"dd",h:`<p>cos φ = P / S. Cargas indutivas (motores, balastros) baixam o cos φ: há mais corrente para a mesma potência útil, mais perdas e mais queda de tensão. Corrige-se com baterias de condensadores.</p>`}],
 prot:[
  {t:"Disjuntores — curvas de disparo",s:"nr",ref:"en60898",h:`<div class="tscroll"><table class="tt2"><tr><th>Curva</th><th>Disparo magnético</th><th>Uso típico</th></tr><tr><td><b>B</b></td><td>3 a 5 × In</td><td>Cargas resistivas, cabos longos (habitação)</td></tr><tr><td><b>C</b></td><td>5 a 10 × In</td><td>Uso geral, iluminação, tomadas, pequenos motores</td></tr><tr><td><b>D</b></td><td>10 a 20 × In</td><td>Correntes de arranque elevadas (transformadores, motores)</td></tr></table></div>
   <ul><li>Coordenação: <b>IB ≤ In ≤ IZ</b> e <b>I2 ≤ 1,45 × IZ</b>.</li><li>Poder de corte (ex.: 4,5 / 6 / 10 kA) ≥ corrente de curto-circuito presumida no ponto.</li></ul>`},
  {t:"Diferenciais — sensibilidade e tipo",s:"nr",ref:"en60898",h:`<ul><li><b>30 mA</b>: proteção de pessoas (tomadas, casas de banho, exterior).</li><li><b>300 mA</b>: proteção contra incêndio / circuitos gerais.</li></ul>
   <div class="tscroll"><table class="tt2"><tr><th>Tipo</th><th>Deteta</th><th>Exemplos</th></tr><tr><td><b>AC</b></td><td>Fugas alternadas sinusoidais</td><td>Cargas resistivas simples</td></tr><tr><td><b>A</b></td><td>AC + contínua pulsante</td><td>Eletrónica monofásica, placas de indução</td></tr><tr><td><b>F</b></td><td>A + frequências mistas</td><td>Máquinas com variador monofásico (lavar, bombas de calor)</td></tr><tr><td><b>B</b></td><td>F + contínua lisa</td><td>Variadores trifásicos, carregadores de VE sem deteção DC</td></tr></table></div><p>Seletividade: diferencial tipo <b>S</b> (temporizado) a montante dos de 30 mA.</p>`},
  {t:"Sobretensões (SPD)",s:"nr",ref:"en61643",h:`<ul><li><b>Tipo 1</b>: edifícios com para-raios ou rede aérea — à entrada.</li><li><b>Tipo 2</b>: quadros de distribuição.</li><li><b>Tipo 3</b>: junto de equipamentos sensíveis.</li><li>Ligação à terra curta e direta (≈ 0,5 m no total); proteção a montante segundo o fabricante.</li></ul>`}],
 terra:[
  {t:"Esquemas de ligação à terra",s:"nr",ref:"rtiebt",h:`<div class="tscroll"><table class="tt2"><tr><th>Esquema</th><th>Como é</th><th>Proteção</th></tr><tr><td><b>TT</b></td><td>Neutro à terra no PT; massas a um elétrodo local. É o habitual na rede pública de BT em Portugal.</td><td>Diferenciais (R × IΔn ≤ 50 V)</td></tr><tr><td><b>TN-S / TN-C-S</b></td><td>Massas ligadas ao neutro do transformador por condutor de proteção.</td><td>Disjuntores (impedância de defeito) e/ou diferenciais</td></tr><tr><td><b>IT</b></td><td>Neutro isolado ou por impedância.</td><td>Controlador permanente de isolamento (ex.: blocos operatórios)</td></tr></table></div>`},
  {t:"Elétrodo e equipotencial",s:"rt",ref:"rtiebt",h:`<ul><li>Ligação equipotencial principal: canalizações metálicas (água, gás), estrutura e condutas ao terminal principal de terra.</li><li>Ligação equipotencial suplementar em locais de risco (ex.: casas de banho), conforme as RTIEBT (secção 701).</li><li>Medição da terra com telurómetro (método dos 62 % ou pinça de terra); registar o valor no relatório.</li><li>Nunca interromper o condutor de proteção nem usar o neutro como terra em TT.</li></ul>`},
  {t:"Volumes da casa de banho",s:"nr",ref:"rtiebt",h:`<p>As RTIEBT (secção 701) definem <b>volumes</b> à volta da banheira/base de duche com limites para tomadas, interruptores e aparelhos (grau IP, SELV, distâncias). Confirma sempre as distâncias e os equipamentos permitidos em cada volume na secção 701 antes de instalar.</p>`}],
 redes:[
  {t:"Níveis de tensão",s:"nr",h:`<div class="tscroll"><table class="tt2"><tr><th>Nível</th><th>Tensão</th><th>Exemplos em Portugal</th></tr><tr><td><b>BT</b></td><td>≤ 1 kV</td><td>230/400 V — rede de distribuição e instalações de utilização</td></tr><tr><td><b>MT</b></td><td>&gt; 1 kV e ≤ 45 kV</td><td>10, 15 e 30 kV (distribuição)</td></tr><tr><td><b>AT</b></td><td>&gt; 45 kV e ≤ 110 kV</td><td>60 kV (distribuição)</td></tr><tr><td><b>MAT</b></td><td>&gt; 110 kV</td><td>150, 220 e 400 kV (transporte)</td></tr></table></div>`},
  {t:"Da subestação ao cliente",s:"dd",h:`<ol><li><b>Subestação</b> (AT/MT): transforma e protege as saídas de MT.</li><li><b>Rede de MT</b> aérea ou subterrânea.</li><li><b>Posto de transformação (PT)</b> MT/BT: aéreo, em cabine ou monobloco; celas de MT, transformador, quadro geral de BT.</li><li><b>Rede de BT</b> aérea (cabo torçada) ou subterrânea, armários de distribuição.</li><li><b>Chegada ao edifício</b>: portinhola / caixa de coluna, ramal, contador (ponto de entrega).</li><li><b>Iluminação pública</b> com circuitos próprios a partir do PT.</li></ol>`},
  {t:"Trabalhos em redes",s:"nr",ref:"en50110",h:`<ul><li>Trabalhos fora de tensão, na vizinhança ou em tensão (TET) seguem a EN 50110 e os procedimentos do operador da rede; TET só por pessoal habilitado e com equipamento próprio.</li><li>Planear a consignação com o despacho / responsável da rede.</li><li>Rede aérea: distâncias de segurança, trabalhos em altura, verificação do apoio antes de subir.</li><li>Rede subterrânea: identificar o cabo antes de cortar (detetor/identificador de cabos) e nunca confiar só na planta.</li></ul>`}],
 seg:[
  {t:"As 5 regras de ouro (EN 50110)",s:"nr",ref:"en50110",h:`<ol class="tfsteps"><li><b>Desligar</b> e separar todas as fontes (incluindo geradores, UPS, fotovoltaico).</li><li><b>Proteger contra a religação</b>: bloquear e sinalizar (consignação).</li><li><b>Verificar a ausência de tensão</b> em todos os condutores, com detetor adequado testado antes e depois.</li><li><b>Ligar à terra e em curto-circuito</b> (obrigatório em MT/AT; em BT quando há risco de realimentação).</li><li><b>Proteger contra partes vizinhas em tensão</b> (barreiras, mantas isolantes).</li></ol>`},
  {t:"Efeitos da corrente no corpo",s:"nr",ref:"iec60479",h:`<p>Ordens de grandeza para corrente alternada de 50 Hz (dependem do tempo e do percurso):</p><ul><li>≈ 0,5–1 mA: limiar de perceção.</li><li>≈ 10 mA: contração muscular, pode não se conseguir largar.</li><li>≈ 30 mA: risco de paragem respiratória — daí os diferenciais de 30 mA.</li><li>Acima de ≈ 50–100 mA: risco de fibrilação ventricular.</li></ul>`},
  {t:"Equipamento de proteção",s:"nr",ref:"en60903",h:`<div class="tscroll"><table class="tt2"><tr><th>Luvas isolantes (EN 60903)</th><th>Tensão máx. de utilização (CA)</th></tr><tr><td>Classe 00</td><td>500 V</td></tr><tr><td>Classe 0</td><td>1 000 V</td></tr><tr><td>Classe 1</td><td>7 500 V</td></tr><tr><td>Classe 2</td><td>17 000 V</td></tr><tr><td>Classe 3</td><td>26 500 V</td></tr><tr><td>Classe 4</td><td>36 000 V</td></tr></table></div>
   <ul><li>Ferramentas isoladas 1000 V (EN 60900); detetor de tensão bipolar (EN 61243-3); multímetro da categoria certa (CAT III / CAT IV).</li><li>Risco de arco: viseira, vestuário ignífugo, distância.</li><li>Verificar luvas antes de usar (insuflar, procurar furos) e respeitar os prazos de ensaio.</li></ul>`},
  {t:"Em caso de acidente",s:"rt",h:`<ol><li>Não tocar na vítima enquanto estiver em contacto com a tensão.</li><li>Cortar a corrente (ou afastar com material isolante seco).</li><li>Ligar <b>112</b>.</li><li>Suporte básico de vida se não respirar; DAE se disponível.</li><li>Qualquer choque elétrico deve ser visto por um médico.</li></ol>`}],
 ens:[
  {t:"Sequência de verificação (RTIEBT, parte 6)",s:"nr",ref:"rtiebt",h:`<ol class="tfsteps"><li><b>Inspeção visual</b> (sem tensão): proteções, secções, identificação, IP, ligações.</li><li><b>Continuidade</b> dos condutores de proteção e equipotenciais.</li><li><b>Resistência de isolamento</b>: ≥ 0,5 MΩ a 500 V DC (até 500 V); ≥ 0,25 MΩ a 250 V em SELV/PELV.</li><li><b>Separação</b> de circuitos (SELV/PELV, separação elétrica).</li><li><b>Proteção por corte automático</b>: resistência de terra (TT) ou impedância da malha de defeito (TN).</li><li><b>Diferenciais</b>: disparo à IΔn e tempo de disparo (botão de teste não chega).</li><li><b>Polaridade</b> e <b>sequência de fases</b>.</li><li><b>Ensaios funcionais</b> e <b>queda de tensão</b>.</li></ol>`},
  {t:"Certificação e inspeção",s:"nr",ref:"dl96",h:`<ul><li>O DL n.º 96/2017 classifica as instalações elétricas particulares nos tipos <b>A</b>, <b>B</b> e <b>C</b>; algumas (ex.: tipo A acima de 100 kVA e tipo B) precisam de certificado de exploração da DGEG antes de entrarem em serviço.</li><li>Cada fase (projeto, execução, inspeção) termina com termo de responsabilidade ou declaração de conformidade; os técnicos e entidades inspetoras cumprem a Lei n.º 14/2015.</li><li>Instalações sem técnico responsável pela exploração têm inspeções periódicas (de 5 em 5 anos, segundo o diploma).</li><li>Confirma sempre o enquadramento da instalação concreta com a DGEG ou a entidade inspetora.</li></ul>`}],
 mot:[
  {t:"Ligação e arranque",s:"dd",h:`<ul><li>Placa de bornes: U1 V1 W1 / W2 U2 V2. Motor <b>230 Δ / 400 Y</b> numa rede de 400 V liga-se em <b>estrela</b>.</li><li><b>Arranque direto</b>: corrente de arranque ≈ 5–8 × In.</li><li><b>Estrela-triângulo</b>: arranca em estrela (corrente e binário ≈ ⅓), passa a triângulo — só para motores que funcionam em triângulo à tensão da rede (ex.: 400 Δ / 690 Y).</li><li><b>Arrancador suave</b> ou <b>variador de frequência</b>: arranque progressivo; o variador também regula a velocidade (atenção a harmónicos, cabo blindado e diferencial do tipo adequado).</li><li><b>Inverter o sentido</b>: trocar duas fases (com encravamento entre contactores).</li></ul>`},
  {t:"Proteção do motor",s:"rt",h:`<ul><li>Disjuntor-motor ou contactor + relé térmico regulado à corrente da chapa.</li><li>Proteção contra falta de fase; sondas PTC em motores críticos.</li><li>Medir isolamento do enrolamento (desligado do variador!) e corrente por fase em funcionamento.</li></ul>`}],
 ited:[
  {t:"O que é o ITED",s:"nr",ref:"ited",h:`<p>ITED = Infraestruturas de Telecomunicações em Edifícios. É obrigatório em edifícios novos e em certas obras, segundo o <b>DL n.º 123/2009</b> (alterado, entre outros, pelo <b>DL n.º 95/2019</b>) e o <b>Manual ITED</b> publicado pela ANACOM (atualmente a <b>4.ª edição</b>). O ITUR trata as urbanizações.</p>`},
  {t:"Três tecnologias",s:"nr",ref:"ited",h:`<div class="tscroll"><table class="tt2"><tr><th>Sigla</th><th>Tecnologia</th><th>Uso</th></tr><tr><td><b>PC</b></td><td>Pares de cobre (cabo de pares entrançados, tomadas RJ45)</td><td>Rede de dados e voz</td></tr><tr><td><b>CC</b></td><td>Cabo coaxial</td><td>Televisão (CATV, MATV/SMATV)</td></tr><tr><td><b>FO</b></td><td>Fibra ótica</td><td>Acesso dos operadores (FTTH) e redes internas</td></tr></table></div>`},
  {t:"Elementos principais",s:"nr",ref:"ited",h:`<ul><li><b>CVM / CAM</b>: entrada dos operadores no edifício (câmara de visita multioperador / caixa de entrada multioperador).</li><li><b>ATE</b>: armário de telecomunicações do edifício (zona comum).</li><li><b>ATI</b>: armário de telecomunicações individual, em cada fração — onde chegam as três tecnologias e partem as ligações às tomadas.</li><li><b>ZAP</b>: zona de acesso privilegiado (obrigatória em edifícios não residenciais segundo o manual em vigor).</li><li><b>PD</b>: pontos de distribuição; <b>PAT</b>: passagem aérea de topo.</li><li>Cabos com classificação de reação ao fogo e baixa emissão de fumos (LSZH) conforme o manual.</li></ul>`},
  {t:"Ensaios e responsabilidades",s:"nr",ref:"ited",h:`<ul><li><b>Projetista ITED</b> faz o projeto; <b>instalador ITED</b> executa, faz os ensaios previstos no manual para cada tecnologia e emite o <b>termo de responsabilidade de execução</b>.</li><li>Sem esse termo, a câmara municipal não emite autorização de utilização e os operadores não podem prestar serviço.</li><li>Ensaios típicos: PC — mapa de ligações, comprimento e desempenho da ligação; CC — níveis de sinal e atenuação; FO — atenuação (fonte e medidor ou OTDR). Valores e classes: ver o Manual ITED.</li></ul>`}],
 leg:[
  {t:"Diplomas e normas",s:"nr",h:`<ul class="tfreg"><li><b>RTIEBT</b> — Portaria n.º 949-A/2006: regras técnicas das instalações elétricas de baixa tensão.</li><li><b>DL n.º 96/2017</b> — regime das instalações elétricas particulares (tipos A, B, C; certificação; inspeções).</li><li><b>Lei n.º 14/2015</b> — técnicos responsáveis e entidades inspetoras.</li><li><b>DL n.º 123/2009</b> (alterado pelo DL n.º 95/2019) e <b>Manual ITED 4.ª edição</b> — telecomunicações em edifícios.</li><li><b>EN 50110</b> — exploração de instalações elétricas e segurança nos trabalhos.</li><li><b>EN 50160</b> — qualidade da tensão da rede pública.</li><li>SCIE (incêndio): ver <a href="#/sadi/reg">SADI → Requisitos em Portugal</a>.</li></ul><p class="mut">Confirma sempre as versões em vigor no Diário da República, na DGEG e na ANACOM.</p>`}]
};

/* temas, perguntas, fichas, glossário */
TF_THEMES.push(
 {id:"t36",t:"Curva B, C ou D?",a:"elet",lv:1,s:"nr",x:"B dispara entre 3 e 5 × In (cargas resistivas), C entre 5 e 10 × In (uso geral) e D entre 10 e 20 × In (arranques fortes, transformadores).",go:"#/elet/prot"},
 {id:"t37",t:"Diferencial tipo A, F ou B",a:"elet",lv:2,s:"nr",x:"Com eletrónica as fugas deixam de ser só alternadas. Tipo A para eletrónica monofásica, F para máquinas com variador monofásico, B para variadores trifásicos e carregadores de VE sem deteção DC.",go:"#/elet/prot"},
 {id:"t38",t:"As 5 regras de ouro",a:"elet",lv:1,s:"nr",x:"Desligar, bloquear contra religação, verificar ausência de tensão, ligar à terra e em curto-circuito, proteger das partes vizinhas em tensão — por esta ordem.",go:"#/elet/seg"},
 {id:"t39",t:"Estrela numa rede de 400 V",a:"elet",lv:2,s:"dd",x:"Um motor 230 Δ / 400 Y numa rede de 400 V liga-se em estrela. Estrela-triângulo só serve se o motor trabalhar em triângulo à tensão da rede (ex.: 400 Δ / 690 Y).",go:"#/elet/mot"},
 {id:"t40",t:"TT: a terra e o diferencial trabalham juntos",a:"elet",lv:1,s:"nr",x:"No esquema TT, R × IΔn ≤ 50 V. Com um diferencial de 30 mA a terra pode ser alta em teoria, mas uma terra má é sinal de instalação mal feita — mede e regista.",go:"#/elet/terra"},
 {id:"t41",t:"ITED: três tecnologias até ao ATI",a:"elet",lv:1,s:"nr",x:"Pares de cobre, coaxial e fibra ótica chegam ao ATI de cada fração; o instalador ITED ensaia e emite o termo de responsabilidade de execução.",go:"#/elet/ited"}
);
TF_QZ.push(
 {id:"q51",top:"elet",lv:1,q:"Num circuito de 230 V com 10 A e cos φ = 1, qual a potência?",o:["230 W","2 300 W","23 W","4 000 W"],a:1,e:"P = U × I × cos φ = 230 × 10 × 1 = 2 300 W."},
 {id:"q52",top:"elet",lv:2,q:"Corrente de um motor trifásico de 7,5 kW, 400 V, cos φ 0,85 e rendimento 0,9?",o:["≈ 7 A","≈ 14 A","≈ 22 A","≈ 32 A"],a:1,e:"I = P / (√3 × U × cos φ × η) = 7500 / (1,732 × 400 × 0,85 × 0,9) ≈ 14 A."},
 {id:"q53",top:"elet",lv:1,q:"Que curva de disjuntor usarias para um transformador com corrente de ligação muito alta?",o:["B","C","D","Nenhuma"],a:2,e:"Curva D: 10 a 20 × In."},
 {id:"q54",top:"elet",lv:2,q:"Para um carregador de VE sem deteção de corrente contínua, o diferencial deve ser…",o:["Tipo AC","Tipo A","Tipo B (ou solução equivalente indicada pelo fabricante)","Não precisa"],a:2,e:"Fugas em contínua lisa cegam os tipos AC e A."},
 {id:"q55",top:"elet",lv:1,q:"Qual é a 3.ª das 5 regras de ouro?",o:["Ligar à terra","Verificar a ausência de tensão","Desligar","Sinalizar a zona"],a:1,e:"Desligar → bloquear → verificar ausência de tensão → terra e curto-circuito → proteger vizinhanças."},
 {id:"q56",top:"elet",lv:2,q:"Em Portugal, a MT de distribuição usa tipicamente…",o:["230/400 V","10, 15 e 30 kV","150 e 400 kV","1 kV"],a:1,e:"MT: >1 kV até 45 kV; na distribuição 10, 15 e 30 kV."},
 {id:"q57",top:"elet",lv:2,q:"Um motor 230 Δ / 400 Y numa rede de 400 V liga-se em…",o:["Triângulo","Estrela","Estrela-triângulo","Indiferente"],a:1,e:"A tensão de estrela (400 V) é a da rede."},
 {id:"q58",top:"elet",lv:1,q:"Luvas isolantes classe 0 servem até…",o:["500 V","1 000 V","7 500 V","17 000 V"],a:1,e:"Classe 0: 1 000 V CA (EN 60903)."},
 {id:"q59",top:"elet",lv:2,q:"Qual é o esquema de terras habitual na rede pública de BT em Portugal?",o:["TN-C","TT","IT","TN-S"],a:1,e:"TT: neutro à terra no PT, massas a um elétrodo local, proteção por diferenciais."},
 {id:"q60",top:"elet",lv:3,q:"Testar um diferencial só com o botão de teste…",o:["Chega","Não chega: mede-se a corrente e o tempo de disparo com o aparelho de ensaio","É proibido","Só em TT"],a:1,e:"O botão testa a mecânica; o ensaio confirma IΔn e tempo de disparo."},
 {id:"q61",top:"ited",lv:1,q:"Quais são as três tecnologias do ITED?",o:["Cobre, coaxial e fibra ótica","Wi-Fi, 4G e 5G","KNX, DALI e Modbus","BT, MT e AT"],a:0,e:"PC (pares de cobre), CC (coaxial) e FO (fibra ótica)."},
 {id:"q62",top:"ited",lv:1,q:"O que é o ATI?",o:["Armário de telecomunicações individual, em cada fração","Antena de televisão","Alarme técnico","Aparelho de teste"],a:0,e:"Onde chegam as três tecnologias e partem as ligações às tomadas da fração."},
 {id:"q63",top:"ited",lv:2,q:"Quem emite o termo de responsabilidade de execução ITED?",o:["O operador","O instalador ITED","A câmara municipal","O projetista de eletricidade"],a:1,e:"O instalador ITED, depois dos ensaios previstos no manual."}
);
TF_FICHAS.push(
 {id:"f-elet",t:"Eletricidade — fórmulas e rede",a:"elet",s:"dd",get h(){return TF_ELET.fund[0].h+TF_ELET.fund[1].h}},
 {id:"f-prot",t:"Proteções — curvas e diferenciais",a:"elet",s:"nr",get h(){return TF_ELET.prot[0].h+TF_ELET.prot[1].h}},
 {id:"f-seg",t:"Segurança — 5 regras de ouro e EPI",a:"elet",s:"nr",get h(){return TF_ELET.seg[0].h+TF_ELET.seg[2].h+TF_ELET.seg[3].h}},
 {id:"f-ens",t:"Ensaios de uma instalação BT",a:"elet",s:"nr",get h(){return TF_ELET.ens[0].h}},
 {id:"f-ited",t:"ITED — essencial",a:"elet",s:"nr",get h(){return TF_ELET.ited.map(x=>`<p><b>${x.t}</b></p>`+x.h).join("")}}
);
TF_GLOS.push(["ATI","Armário de telecomunicações individual (ITED), em cada fração."],["CAM / CVM","Entrada multioperador no edifício (ITED)."],["Consignação","Procedimento para pôr uma instalação fora de tensão em segurança e garantir que não volta a ter tensão."],["Curva B / C / D","Gama de disparo magnético de um disjuntor (3–5, 5–10, 10–20 × In)."],["DGEG","Direção-Geral de Energia e Geologia."],["Fator de potência (cos φ)","Relação entre potência ativa e aparente."],["IΔn","Corrente diferencial estipulada de um diferencial (30 mA, 300 mA…)."],["MT / AT / MAT","Média (até 45 kV), alta (até 110 kV) e muito alta tensão."],["Poder de corte","Corrente de curto-circuito que o disjuntor consegue interromper."],["PT","Posto de transformação MT/BT."],["SPD","Descarregador de sobretensões (tipos 1, 2 e 3)."],["TT / TN / IT","Esquemas de ligação à terra."],["ZAP","Zona de acesso privilegiado (ITED)."]);
TF_PATHS[0].steps.splice(1,0,{t:"Fundamentos de eletricidade",to:"#/elet/fund",top:"elet"},{t:"Segurança elétrica — 5 regras de ouro",to:"#/elet/seg",top:"elet"});
TF_PATHS[1].steps.splice(0,0,{t:"Ensaios de uma instalação BT",to:"#/elet/ens",top:"elet"});
TF_PATHS[2].steps.splice(0,0,{t:"Proteções e diferenciais",to:"#/elet/prot",top:"elet"});

/* =========================================================
   Ordem de aprendizagem de um eletricista (v46):
   1 Eletricidade → 2 Diagnóstico e manutenção → 3 Automação predial → 4 SADI → Biblioteca
   e, dentro de cada área, do mais básico para o mais avançado.
   ========================================================= */
(()=>{const ORD={elet:["seg","fund","prot","terra","ens","mot","redes","ited","leg"],
 diag:["ferr","med","led","calc","esq","falhas","rel"],
 auto:["topo","sel","prot","banc","dados","ip","gw","com"],
 sadi:["geral","reg","det","proto","lig","sie","sim","fdul","av","fa","real"],
 bib:["guia","fichas","glos","ref","fab","tab","docs"]};
 const AO=["elet","diag","auto","sadi","bib"];
 TF_AREAS.sort((a,b)=>AO.indexOf(a.id)-AO.indexOf(b.id));
 TF_AREAS.forEach(a=>{const o=ORD[a.id];if(!o)return;a.subs.sort((x,y)=>{const i=o.indexOf(x[0]),j=o.indexOf(y[0]);return(i<0?99:i)-(j<0?99:j)})});
 /* percursos refeitos pela mesma ordem */
 TF_PATHS.length=0;TF_PATHS.push(
  {id:"ini",t:"Iniciante — aprendiz de eletricista",ic:"🌱",d:"Segurança, bases da eletricidade, medir e ler esquemas; primeiro contacto com bus e SADI.",steps:[
   {t:"Segurança elétrica — 5 regras de ouro",to:"#/elet/seg",top:"elet"},{t:"Fundamentos e fórmulas",to:"#/elet/fund",top:"elet"},{t:"Proteções e diferenciais",to:"#/elet/prot",top:"elet"},
   {t:"Terras e equipotencial",to:"#/elet/terra",top:"elet"},{t:"Ferramentas de medição",to:"#/diag/ferr",top:"medir"},{t:"Medições de referência",to:"#/diag/med",top:"medir"},
   {t:"Interpretar esquemas",to:"#/diag/esq",top:"rtiebt"},{t:"Calculadoras RTIEBT (queda de tensão)",to:"#/diag/calc?sub=qt",top:"rtiebt"},
   {t:"Tipologias de bus",to:"#/auto/topo",top:"knx"},{t:"SADI — visão geral",to:"#/sadi/geral",top:"sadi"},{t:"Teste do nível 1",to:"#/treino?lv=1",quiz:true}]},
  {id:"man",t:"Técnico de manutenção",ic:"🛠",d:"Ensaios, LEDs, análise de falhas e relatórios; manutenção SADI segundo a NT 12 e uso do FDUL221.",steps:[
   {t:"Ensaios e certificação de uma instalação BT",to:"#/elet/ens",top:"elet"},{t:"Leitura de LEDs",to:"#/diag/led",top:"medir"},{t:"Análise de falhas",to:"#/diag/falhas",top:"medir"},
   {t:"Protocolos e simuladores",to:"#/auto/prot",top:"knx"},{t:"Comissionamento de bus",to:"#/auto/com",top:"modbus"},
   {t:"SADI — requisitos em Portugal",to:"#/sadi/reg",top:"sadi"},{t:"Tipos de detetores",to:"#/sadi/det",top:"sadi"},{t:"Ligação do laço",to:"#/sadi/lig",top:"sadi"},
   {t:"FDUL221 — Módulo 1: conhecer o equipamento",to:"#/sadi/fdul?m=1",top:"fdul"},{t:"FDUL221 — Módulo 2: preparar e executar",to:"#/sadi/fdul?m=2",top:"fdul"},
   {t:"Intervenção real e manutenção (NT 12)",to:"#/sadi/real",top:"sadi"},{t:"Relatório de intervenção",to:"#/diag/rel",top:"sadi"},{t:"Teste do nível 2",to:"#/treino?lv=2",quiz:true}]},
  {id:"adv",t:"Diagnóstico avançado",ic:"🔬",d:"Motores, redes de distribuição e ITED; integração IP/BMS; diagnóstico de laços com o FDUL221.",steps:[
   {t:"Motores e comandos",to:"#/elet/mot",top:"elet"},{t:"Redes de distribuição",to:"#/elet/redes",top:"elet"},{t:"ITED",to:"#/elet/ited",top:"ited"},
   {t:"Tabelas rápidas (Modbus, KNX, BACnet)",to:"#/auto/dados",top:"modbus"},{t:"Comunicação IP",to:"#/auto/ip",top:"ip"},{t:"Gateways e BMS",to:"#/auto/gw",top:"bacnet"},
   {t:"FDUL221 — Módulo 3: diagnosticar avarias",to:"#/sadi/fdul?m=3",top:"fdul"},{t:"FDUL221 — Módulo 4: simulador",to:"#/sadi/fdul?m=4",top:"fdul"},
   {t:"Avarias e alarmes",to:"#/sadi/av",top:"sadi"},{t:"Alarmes falsos",to:"#/sadi/fa",top:"sadi"},{t:"Teste do nível 3",to:"#/treino?lv=3",quiz:true}]});
})();
