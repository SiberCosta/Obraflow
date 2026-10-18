/* =========================================================
   TecFlow — conteúdos adicionais (v44)
   ========================================================= */
"use strict";
window.TF_DATA2_VER="46";
TF_REF.yabe={t:"YABE — Yet Another BACnet Explorer (gratuito, código aberto)",u:"https://sourceforge.net/projects/yetanotherbacnetexplorer/",s:"rt"};
TF_REF.wireshark={t:"Wireshark — analisador de rede (gratuito)",u:"https://www.wireshark.org",s:"rt"};
TF_REF.en54b={t:"EN 54 — partes por equipamento (2 CDI, 3 sirenes, 4 alimentação, 5 calor, 7 fumo, 10 chama, 11 botoneiras, 12 feixe, 17 isoladores, 18 entradas/saídas, 20 aspiração, 23 sinalizadores visuais)",s:"nr"};

/* novas secções nas áreas */
(()=>{const add=(id,subs)=>{const a=TF_AREAS.find(x=>x.id===id);subs.forEach(s=>{if(!a.subs.find(y=>y[0]===s[1][0]))a.subs.splice(s[0],0,s[1])})};
 add("auto",[[1,["dados","Tabelas rápidas"]],[6,["com","Comissionamento"]]]);
 add("sadi",[[2,["det","Tipos de detetores"]],[9,["fa","Alarmes falsos"]]]);
 add("diag",[[6,["ferr","Ferramentas"]]]);
 add("bib",[[5,["glos","Glossário"]]]);
 TF_KIND.det="ref";TF_KIND.fa="ref";})();

/* ---------- tabelas rápidas de automação ---------- */
const TF_TAB={
 mbfc:{t:"Modbus — códigos de função",s:"nr",ref:"modbus",h:["Código","Função","Uso"],r:[["01","Read Coils","Ler saídas digitais (bits)"],["02","Read Discrete Inputs","Ler entradas digitais"],["03","Read Holding Registers","Ler registos (o mais usado)"],["04","Read Input Registers","Ler registos só de leitura (medidas)"],["05","Write Single Coil","Escrever um bit (ON = FF00h)"],["06","Write Single Register","Escrever um registo"],["15 (0Fh)","Write Multiple Coils","Escrever vários bits"],["16 (10h)","Write Multiple Registers","Escrever vários registos (ex.: valores de 32 bits)"]],n:"Máximo 125 registos por pedido de leitura (FC03/FC04). Valores de 32 bits ocupam 2 registos: atenção à ordem das palavras (big/little endian, «word swap»)."},
 mbser:{t:"Modbus RTU — linha série",s:"nr",ref:"modbus",h:["Parâmetro","Valor"],r:[["Endereços","1–247 (0 = difusão, sem resposta)"],["Velocidades comuns","9600 e 19200 bit/s (também 38400…)"],["Formato","1 início + 8 dados + paridade + 1 paragem (sem paridade: 2 paragens, segundo a especificação)"],["Fim de trama","Silêncio de 3,5 caracteres"],["Cargas no bus","32 cargas unitárias por segmento RS-485 sem repetidor (há transceptores de ⅛ de carga)"],["Comprimento","Até ≈ 1200 m em RS-485 (menos a velocidades altas)"]]},
 knxdpt:{t:"KNX — tipos de dados (DPT) mais usados",s:"nr",ref:"knx",h:["DPT","Tamanho","Uso"],r:[["1.001","1 bit","Ligar/desligar"],["1.008","1 bit","Subir/descer (estores)"],["1.009","1 bit","Abrir/fechar"],["3.007","4 bits","Regulação relativa (mais/menos claro)"],["5.001","1 byte","Percentagem 0–100 %"],["9.001","2 bytes","Temperatura (°C)"],["9.004","2 bytes","Iluminância (lux)"],["14.xxx","4 bytes","Valores de vírgula flutuante (ex.: energia)"],["20.102","1 byte","Modo AVAC (conforto, standby, noite, proteção)"],["232.600","3 bytes","Cor RGB"]],n:"O DPT tem de ser igual nos dois lados do endereço de grupo (sensor e atuador/gateway)."},
 knxadr:{t:"KNX — endereços",s:"nr",ref:"knx",h:["Tipo","Formato","Notas"],r:[["Físico","Área.Linha.Aparelho (ex.: 1.2.15)","Área/linha 0–15, aparelho 0–255. x.y.0 = acoplador."],["Grupo (3 níveis)","Principal/Médio/Sub (ex.: 1/2/3)","0–31 / 0–7 / 0–255"],["KNXnet/IP","UDP 3671","Tunelling (ligação ponto a ponto, para o ETS) e routing (multicast 224.0.23.12)"]]},
 bacobj:{t:"BACnet — objetos mais comuns",s:"nr",ref:"bacnet",h:["Objeto","Sigla","Uso"],r:[["Analog Input","AI","Medida (temperatura, pressão)"],["Analog Output","AO","Comando analógico (válvula 0–100 %)"],["Analog Value","AV","Valor interno / setpoint"],["Binary Input","BI","Estado (ligado, alarme)"],["Binary Output","BO","Comando ligar/desligar"],["Binary Value","BV","Valor binário interno"],["Multi-state Value","MSV","Modos (auto/manual/off)"],["Schedule","SCH","Horários"],["Trend Log","TL","Registo histórico"],["Notification Class","NC","Encaminhamento de alarmes"],["Device","DEV","O próprio controlador (Device Instance único)"]],n:"Comandos com prioridade (Priority_Array, 16 níveis; 1 = mais alta). Quando todos são libertados, vale o Relinquish_Default."},
 bacmstp:{t:"BACnet MS/TP",s:"nr",ref:"bacnet",h:["Parâmetro","Valor"],r:[["Velocidades","9600, 19200, 38400, 76800 bit/s (igual em todos)"],["MAC masters","0–127"],["MAC slaves","128–254 (255 = difusão)"],["Max_Master","Igual ou acima do maior MAC master da rede (menor = mais rápido)"],["Meio","RS-485, em linha, terminação nas pontas"]]},
 dali:{t:"DALI — endereçamento",s:"nr",ref:"dali",h:["Item","Valor"],r:[["Endereços curtos","64 (0–63)"],["Grupos","16"],["Cenas","16"],["Nível de luz","0–254 (arco logarítmico)"],["DALI-2","Inclui dispositivos de entrada (sensores, botões) e certificação mais rigorosa"],["Emergência","Parte 202 da IEC 62386: testes de função e de autonomia das luminárias de emergência"]]},
 mbus:{t:"M-Bus — endereçamento",s:"nr",ref:"mbus",h:["Item","Valor"],r:[["Primário","1–250 (0 = sem configurar)"],["Seleção secundária","253 (procura pelo número de série de 8 dígitos)"],["Difusão","254 / 255"],["Velocidades","300, 2400, 9600 baud (2400 é comum)"],["Carga","≈ 1,5 mA por carga unitária; o mestre limita o número de contadores"]]}
};

/* ---------- comissionamento ---------- */
const TF_COM=[
 {t:"KNX",s:"rt",p:["Medir a tensão do bus em cada linha (≈ 21–30 V DC) antes de programar.","Conferir topologia e endereços físicos com o projeto ETS.","Programar endereço físico e aplicação; confirmar no ETS (diagnóstico → aparelhos em linha).","Testar cada endereço de grupo de ponta a ponta (sensor → atuador).","Filtros dos acopladores ativos; ver a carga do bus no monitor.","Exportar e guardar o projeto ETS final (.knxproj) e entregar ao cliente."]},
 {t:"Modbus RTU",s:"rt",p:["Lista de aparelhos com endereço, velocidade e paridade.","Medir ≈ 60 Ω entre A e B (terminações), polarização presente.","Ler um registo conhecido de cada aparelho com software de teste antes de ligar ao BMS.","Confirmar escalas, unidades e ordem de palavras de 32 bits.","Registar o tempo de ciclo de leitura (polling) total."]},
 {t:"BACnet/IP e MS/TP",s:"rt",p:["Device Instance único em toda a instalação; nomes coerentes.","IP/máscara/porta 47808; BBMD entre sub-redes.","MS/TP: MAC único, mesma velocidade, Max_Master ajustado, terminação.","Descobrir tudo com um explorador BACnet (Who-Is) e comparar com a lista de pontos.","Testar alarmes (intrinsic/algorithmic reporting) e horários."]},
 {t:"DALI",s:"rt",p:["Fonte DALI dimensionada (≤ 250 mA) e queda no cabo ≤ 2 V.","Endereçar, agrupar e criar cenas; etiquetar luminárias com o endereço.","Testar falhas (lâmpada desligada) e reporte ao BMS.","Emergência DALI: programar testes de função e de autonomia."]},
 {t:"M-Bus",s:"rt",p:["Atribuir endereços primários únicos ou usar endereços secundários.","Confirmar a capacidade do mestre (n.º de cargas).","Ler todos os contadores e comparar com o mostrador do contador.","Definir o intervalo de leitura (ex.: 15 min)."]},
 {t:"Integração BMS",s:"rt",p:["Lista de pontos aprovada antes de configurar o gateway.","Ensaio ponto a ponto: valor no equipamento = valor no BMS.","Comandos: confirmar sentido (0/1) e prioridades.","Alarmes com texto claro e destino definido.","Cópias de segurança de todas as configurações."]}
];

/* ---------- SADI: tipos de detetores ---------- */
const TF_DET=[
 {t:"Ótico de fumo",n:"EN 54-7",s:"nr",uso:"Escritórios, quartos, corredores, salas técnicas — fogos com fumo visível, de evolução lenta.",ev:"Cozinhas, vapor, pó intenso, zonas com fumo normal."},
 {t:"Térmico (temperatura fixa / termovelocimétrico)",n:"EN 54-5",s:"nr",uso:"Cozinhas, garagens, lavandarias, onde há fumo ou vapor normais.",ev:"Onde se quer deteção precoce (reage mais tarde que o de fumo)."},
 {t:"Multicritério (fumo + calor)",n:"EN 54-7 / EN 54-5",s:"nr",uso:"Locais com risco de alarmes falsos onde ainda se quer deteção de fumo.",ev:"Substituir o térmico em cozinhas sem análise."},
 {t:"Chama (UV / IV)",n:"EN 54-10",s:"nr",uso:"Grandes espaços com risco de fogo com chama rápida (combustíveis líquidos).",ev:"Locais com fontes de radiação (soldadura, sol direto, consoante o modelo)."},
 {t:"Feixe linear ótico",n:"EN 54-12",s:"nr",uso:"Naves, armazéns, átrios altos.",ev:"Estruturas que se movem ou locais com obstruções no feixe."},
 {t:"Aspiração",n:"EN 54-20",s:"nr",uso:"Salas de servidores, espaços de difícil acesso, deteção muito precoce.",ev:"—"},
 {t:"Botoneira (ponto de alarme manual)",n:"EN 54-11",s:"nr",uso:"Caminhos de evacuação e saídas; ≈ 1,2 m de altura; percurso até uma ≤ 30 m (NT 12).",ev:"—"},
 {t:"Sirene / sinalizador visual",n:"EN 54-3 / EN 54-23",s:"nr",uso:"Alarme sonoro (≥ 65 dB(A) ou 5 dB acima do ruído) e visual onde o som não chega ou há pessoas com deficiência auditiva.",ev:"—"},
 {t:"Módulo de entrada/saída",n:"EN 54-18",s:"nr",uso:"Ler contactos (sprinklers, extinção) e comandar portas, AVAC, elevadores (ex.: FDCIO221).",ev:"—"},
 {t:"Isolador de curto-circuito",n:"EN 54-17",s:"nr",uso:"Dividir o laço para que um curto não afete mais do que o permitido (em FDnet já vem integrado nos dispositivos).",ev:"—"}
];

/* ---------- SADI: alarmes falsos ---------- */
const TF_FA=[
 {c:"Pó de obras",p:["Proteger os detetores com as tampas do fabricante durante obras (e inibir com registo e medidas compensatórias).","Retirar TODAS as proteções no fim e testar."],s:"rt"},
 {c:"Vapor e cozinhas",p:["Detetor térmico ou multicritério adequado.","Afastar detetores de portas de casas de banho e cozinhas."],s:"rt"},
 {c:"Fumo de cigarros / velas / incenso",p:["Regras de utilização do espaço; escolha do detetor e configuração (dependências) segundo o projeto."],s:"rt"},
 {c:"Insetos",p:["Limpeza segundo o fabricante; redes e vedação das câmaras quando previsto."],s:"rt"},
 {c:"Humidade / condensação",p:["Detetores adequados ao ambiente; verificar caixas e tubos que trazem água."],s:"rt"},
 {c:"Correntes de ar / AVAC",p:["Respeitar distâncias às grelhas de insuflação definidas no projeto/fabricante."],s:"rt"},
 {c:"Testes sem aviso",p:["Avisar antes de testar; inibir só o necessário e assinalar (NT 12, 8.2)."],s:"nr",ref:"nt12"},
 {c:"Detetores sujos ou velhos",p:["Seguir o aviso de contaminação da central; limpar ou substituir conforme o fabricante."],s:"rt"}
];

/* ---------- ferramentas ---------- */
const TF_TOOLS=[
 {t:"Multímetro (CAT III / CAT IV)",s:"rt",p:"Tensões de bus, alimentação, continuidade, resistências de terminação. Usar a categoria adequada ao ponto da instalação."},
 {t:"Megaohmímetro",s:"nr",p:"Resistência de isolamento (500 V DC até 500 V; 250 V em SELV/PELV). Desligar eletrónica antes.",ref:"rtiebt"},
 {t:"Pinça amperimétrica",s:"rt",p:"Consumos, fugas (pinças de fuga em mA), equilíbrio de fases."},
 {t:"Telurómetro / medidor de malha",s:"nr",p:"Resistência de terra e impedância de defeito.",ref:"rtiebt"},
 {t:"FDUL221",s:"of",p:"Testador de linhas FDnet/C-NET: topologia, erros, terra.",ref:"fdulTM",to:"#/sadi/fdul"},
 {t:"Testador de detetores (vara, aerossol de teste, fonte de calor)",s:"rt",p:"Ensaio funcional de detetores segundo o fabricante — aerossol aprovado para o modelo."},
 {t:"Conversor USB–RS485",s:"rt",p:"Ligar o PC a buses Modbus RTU / BACnet MS/TP para teste."},
 {t:"Software Modbus (ex.: QModMaster, gratuito)",s:"rt",p:"Ler e escrever registos para confirmar endereços e escalas."},
 {t:"Explorador BACnet (ex.: YABE, gratuito)",s:"rt",p:"Who-Is, ler objetos e propriedades.",ref:"yabe"},
 {t:"ETS + interface KNX (USB ou IP)",s:"nr",p:"Programação e diagnóstico KNX (há versão de demonstração gratuita com limite de aparelhos).",ref:"knx"},
 {t:"Wireshark (gratuito)",s:"rt",p:"Ver tráfego IP: BACnet/IP, Modbus TCP, KNXnet/IP.",ref:"wireshark"},
 {t:"Lanterna, espelho, marcadores e etiquetas",s:"rt",p:"Inspeção de caixas e identificação de cabos e aparelhos."}
];

/* ---------- glossário ---------- */
const TF_GLOS=[["A/B (RS-485)","Os dois condutores do par diferencial. Trocar A e B é a avaria mais comum."],["Acoplador (KNX)","Liga linhas/áreas e filtra telegramas. Endereço x.y.0."],["AI (indicador externo)","Indicador de ação/alarme remoto ligado ao detetor; na base DB72x o borne 1a é +AI."],["BBMD","BACnet Broadcast Management Device: reencaminha difusões BACnet entre sub-redes."],["BMS / GTC","Gestão técnica centralizada: supervisão e comando dos sistemas do edifício."],["CDI","Central de deteção de incêndio."],["Classe A (laço)","Laço que volta à central; alimentado pelas duas pontas."],["C-NET / FDnet","Protocolo de laço da Siemens (Cerberus/Sinteso)."],["COV","Change Of Value (BACnet): o aparelho avisa quando o valor muda."],["CRC","Código de verificação da trama Modbus RTU."],["Device Instance","Número único de cada aparelho BACnet na rede."],["DPT","Datapoint Type (KNX): formato do dado (1 bit, %, temperatura…)."],["Endereço de grupo","Função KNX partilhada por sensores e atuadores."],["Endereço físico","Identificação do aparelho KNX na topologia (área.linha.aparelho)."],["EN 54","Conjunto de normas europeias dos equipamentos de deteção e alarme de incêndio."],["Escravo / mestre","Modbus: o mestre pergunta, o escravo responde."],["Exceção (Modbus)","Resposta de erro do escravo (01 a 0B)."],["Fim de linha (EOL)","Resistência no fim de um circuito supervisionado (convencional, sirenes)."],["Gateway","Tradutor entre protocolos (ex.: Modbus → BACnet)."],["Isolador","Dispositivo que abre o laço em caso de curto, limitando os dispositivos afetados."],["Laço (loop)","Circuito endereçável que sai e volta à central."],["Lista de pontos","Folha com todos os pontos a integrar: origem, destino, tipo, escala."],["MAC (MS/TP)","Endereço do aparelho no bus MS/TP (0–127 masters)."],["Max_Master","Maior MAC master que o aparelho procura no MS/TP."],["Medidas compensatórias","Ações que mantêm a segurança quando parte do SADI está fora de serviço (ex.: vigilância)."],["NT 12","Nota técnica da ANEPC sobre SADI."],["Polarização (bias)","Resistências que fixam o estado de repouso do RS-485."],["Polling","Leitura periódica de pontos pelo mestre/gateway."],["Priority_Array","Prioridades de comando BACnet (1 a 16)."],["Registo (Modbus)","Palavra de 16 bits num endereço."],["RJ-SCIE / RT-SCIE","Regime jurídico e regulamento técnico de segurança contra incêndio em edifícios."],["RS (responsável de segurança)","Responsável pela segurança contra incêndio do edifício."],["SELV","Muito baixa tensão de segurança (ex.: bus KNX)."],["Separador de linha","Isolador integrado nos dispositivos FDnet."],["Sub-ramal (T-tap)","Derivação a partir do laço; um só entre dois dispositivos."],["Terminação","Resistência de 120 Ω nas pontas de um bus RS-485."],["Topologia","Forma da rede: linha, laço, árvore, estrela."],["Tunelling / routing","Modos KNXnet/IP: ligação ponto a ponto vs multicast entre routers."],["Unit ID","Endereço Modbus usado no TCP para chegar a escravos atrás de um gateway."],["Zona","Área de deteção que a central identifica (≤ 1600 m², NT 12)."]];

/* ---------- mais avarias ---------- */
TF_FAULTS.push(
 {id:"KNX4",sys:"knx",c:"Endereço físico duplicado",t:"Dois aparelhos com o mesmo endereço físico",s:"rt",cause:"Aparelho trocado sem reprogramar, ou cópia de projeto.",do:["No ETS: diagnóstico → verificar endereço físico.","Reprogramar o endereço correto e descarregar a aplicação."]},
 {id:"KNX5",sys:"knx",c:"Telegrama não passa o acoplador",t:"Função funciona numa linha mas não noutra",s:"rt",cause:"Tabela de filtro do acoplador desatualizada.",do:["Descarregar de novo o acoplador depois de criar/alterar grupos.","Confirmar o modo do filtro (filtrar/encaminhar)."]},
 {id:"MBFC",sys:"mrtu",c:"Valores estranhos",t:"Valor lido sem sentido (ex.: 16 384 em vez de 25,0)",s:"rt",cause:"Escala errada, valor de 32 bits com palavras trocadas, tipo de dado errado (INT vs FLOAT).",do:["Ver tipo e escala no mapa de registos.","Trocar a ordem das palavras («word swap») no gateway."]},
 {id:"BAC3",sys:"bacnet",c:"unknown-object / unknown-property",t:"Erro BACnet ao ler um ponto",s:"nr",ref:"bacnet",cause:"O objeto ou a propriedade pedida não existe nesse aparelho.",do:["Descobrir os objetos com um explorador BACnet e corrigir a lista de pontos."]},
 {id:"BAC4",sys:"bacnet",c:"Comando não atua",t:"Escrevo no ponto mas o valor volta atrás",s:"rt",cause:"Prioridade mais alta já ocupada (Priority_Array) ou Out_Of_Service.",do:["Ver o Priority_Array: libertar a prioridade que manda ou escrever numa mais alta (segundo a filosofia da instalação).","Confirmar Out_Of_Service = falso."]},
 {id:"DALI3",sys:"dali",c:"Endereços duplicados",t:"Duas luminárias respondem ao mesmo endereço",s:"rt",cause:"Drivers pré-endereçados ou trocados.",do:["Fazer endereçamento aleatório/novo de toda a linha e voltar a agrupar."]},
 {id:"IP2",sys:"ip",c:"IP duplicado",t:"Equipamento desaparece e volta",s:"rt",cause:"Dois equipamentos com o mesmo IP.",do:["Ver a tabela ARP / ferramenta do switch.","Reservar IPs no DHCP e documentar."]},
 {id:"S8",sys:"sadi",c:"Alarmes falsos repetidos",t:"O mesmo detetor dispara sem fogo",s:"rt",cause:"Tipo de detetor inadequado ao local, pó, vapor, insetos, correntes de ar, contaminação.",do:["Ver o histórico de eventos da central (hora, nível analógico).","Rever o tipo de detetor com o projetista.","Limpar/substituir segundo o fabricante."]},
 {id:"S9",sys:"sadi",c:"Endereço duplicado",t:"Dois dispositivos com o mesmo endereço no laço",s:"rt",cause:"Substituição sem reendereçar.",do:["Usar a ferramenta do fabricante para ler o laço (ex.: FDUL221) e reendereçar."]}
);

/* ---------- mais temas ---------- */
TF_THEMES.push(
 {id:"t23",t:"FC03 vs FC04 no Modbus",a:"auto",lv:2,s:"nr",x:"FC03 lê holding registers (leitura/escrita) e FC04 lê input registers (só leitura). Se o manual diz «input register» e usas FC03, recebes a exceção 02 ou valores errados.",go:"#/auto/dados"},
 {id:"t24",t:"Palavras trocadas nos 32 bits",a:"auto",lv:3,s:"rt",x:"Um valor de 32 bits ocupa dois registos. Se aparece um número absurdo, experimenta trocar a ordem das palavras no gateway.",go:"#/auto/dados"},
 {id:"t25",t:"O DPT tem de bater certo",a:"auto",lv:2,s:"nr",x:"Num endereço de grupo KNX, sensor, atuador e gateway têm de usar o mesmo tipo de dado: 1.001 para ligar/desligar, 5.001 para %, 9.001 para temperatura.",go:"#/auto/dados"},
 {id:"t26",t:"Priority_Array no BACnet",a:"auto",lv:3,s:"nr",x:"Os comandos BACnet têm 16 prioridades. Se escreves e o valor volta atrás, alguém está a mandar numa prioridade mais alta.",go:"#/auto/dados"},
 {id:"t27",t:"Max_Master no MS/TP",a:"auto",lv:3,s:"nr",x:"Ajustar o Max_Master ao maior MAC da rede evita que o token ande à procura de aparelhos que não existem — a rede fica mais rápida.",go:"#/auto/dados"},
 {id:"t28",t:"Emergência DALI",a:"auto",lv:2,s:"nr",x:"A parte 202 da IEC 62386 permite programar testes de função e de autonomia das luminárias de emergência e ler os resultados no BMS.",go:"#/auto/dados"},
 {id:"t29",t:"Térmico na cozinha, ótico no corredor",a:"sadi",lv:1,s:"nr",x:"Detetores óticos de fumo disparam com vapor e fumos de cozinha. Nesses locais usa-se térmico ou multicritério, conforme o projeto.",go:"#/sadi/det"},
 {id:"t30",t:"Obras: proteger e depois retirar",a:"sadi",lv:1,s:"rt",x:"Durante obras, as tampas de proteção evitam alarmes falsos por pó — mas um detetor tapado não deteta. Regista, aplica medidas compensatórias e retira todas no fim.",go:"#/sadi/fa"},
 {id:"t31",t:"EN 54 por equipamento",a:"sadi",lv:2,s:"nr",x:"Cada equipamento tem a sua parte da EN 54: 7 fumo, 5 calor, 11 botoneiras, 3 sirenes, 23 sinalizadores visuais, 17 isoladores, 18 módulos, 2 central, 4 alimentação.",go:"#/sadi/det"},
 {id:"t32",t:"Megger ou multímetro?",a:"diag",lv:1,s:"rt",x:"O multímetro mede tensão e continuidade; o megaohmímetro mede isolamento com tensão alta (500 V). Para buses e laços com eletrónica ligada, nunca o megger.",go:"#/diag/ferr"},
 {id:"t33",t:"Comissionar ponto a ponto",a:"auto",lv:2,s:"rt",x:"Na integração BMS, cada ponto confirma-se dos dois lados: valor no equipamento = valor no BMS, e comando enviado = ação no terreno.",go:"#/auto/com"},
 {id:"t34",t:"Endereço secundário no M-Bus",a:"auto",lv:3,s:"nr",x:"Quando há endereços primários repetidos, o mestre pode selecionar cada contador pelo número de série (endereço secundário, seleção com o endereço 253).",go:"#/auto/dados"},
 {id:"t35",t:"Histórico da central primeiro",a:"diag",lv:2,s:"rt",x:"Antes de mexer num SADI com avarias ou alarmes falsos, lê o histórico de eventos da central: hora, dispositivo e repetição dizem muito sobre a causa.",go:"#/sadi/fa"}
);

/* ---------- mais perguntas ---------- */
TF_QZ.push(
 {id:"q35",top:"modbus",lv:2,q:"Que função Modbus lê «input registers»?",o:["FC03","FC04","FC06","FC16"],a:1,e:"FC04 lê input registers; FC03 lê holding registers."},
 {id:"q36",top:"modbus",lv:2,q:"Quantos registos pode, no máximo, ler um pedido FC03?",o:["16","64","125","247"],a:2,e:"Até 125 registos por pedido."},
 {id:"q37",top:"modbus",lv:3,q:"Lês 16 384 onde esperavas 25,0 (valor float de 32 bits). Primeira suspeita?",o:["Cabo partido","Ordem das palavras (word swap) ou tipo de dado","Endereço Modbus","Terminação"],a:1,e:"Valores absurdos mas estáveis apontam para tipo/ordem das palavras."},
 {id:"q38",top:"knx",lv:2,q:"Qual o DPT para uma temperatura em °C?",o:["1.001","5.001","9.001","20.102"],a:2,e:"9.001 = temperatura (2 bytes)."},
 {id:"q39",top:"knx",lv:2,q:"Uma função passou a falhar só entre duas linhas após criar grupos novos. O que fazer?",o:["Trocar a fonte","Descarregar de novo o acoplador (tabela de filtro)","Mudar o DPT","Nada"],a:1,e:"O filtro do acoplador tem de conhecer os grupos novos."},
 {id:"q40",top:"knx",lv:3,q:"O routing KNXnet/IP usa…",o:["TCP 502","Multicast 224.0.23.12 (UDP 3671)","UDP 47808","HTTP"],a:1,e:"Routing = multicast 224.0.23.12, porta 3671."},
 {id:"q41",top:"bacnet",lv:3,q:"Escreves num ponto BACnet e o valor volta atrás. Provável causa?",o:["Porta errada","Prioridade mais alta ocupada no Priority_Array","Cabo","BBMD"],a:1,e:"Um comando de prioridade superior continua a mandar."},
 {id:"q42",top:"bacnet",lv:2,q:"Num MS/TP, que MAC podem ter os masters?",o:["0–127","128–254","1–247","0–63"],a:0,e:"Masters 0–127; slaves 128–254."},
 {id:"q43",top:"dali",lv:2,q:"Quantos grupos tem o DALI?",o:["8","16","32","64"],a:1,e:"16 grupos e 16 cenas."},
 {id:"q44",top:"mbus",lv:3,q:"Que endereço M-Bus é usado para a seleção por endereço secundário?",o:["0","250","253","255"],a:2,e:"253 = seleção secundária."},
 {id:"q45",top:"sadi",lv:1,q:"Que detetor é normalmente adequado a uma cozinha?",o:["Ótico de fumo","Térmico (ou multicritério, segundo o projeto)","Feixe linear","Chama"],a:1,e:"O ótico dispara com vapor e fumos normais."},
 {id:"q46",top:"sadi",lv:2,q:"Que parte da EN 54 cobre as botoneiras?",o:["EN 54-3","EN 54-7","EN 54-11","EN 54-17"],a:2,e:"EN 54-11 = pontos de alarme manual."},
 {id:"q47",top:"sadi",lv:2,q:"Detetores tapados durante obras devem…",o:["Ficar tapados até à manutenção anual","Ser registados, com medidas compensatórias, e destapados no fim","Ser retirados das bases","Nada"],a:1,e:"Tapado não deteta: registar, compensar e retirar a proteção no fim."},
 {id:"q48",top:"medir",lv:1,q:"Para medir a tensão de um bus KNX usas…",o:["Megaohmímetro","Multímetro em V DC","Telurómetro","Pinça de fugas"],a:1,e:"Multímetro em tensão contínua."},
 {id:"q49",top:"fdul",lv:2,q:"E04 Hi leak numa linha migrada. O que procuras?",o:["Excesso de dispositivos","Dispositivos antigos ou resistências de fim de linha esquecidas","Bateria fraca","Sub-ramal"],a:1,e:"Fuga típica ≈ 300 µA + 3 µA/dispositivo; acima disso, isolamento ou restos de instalação antiga."},
 {id:"q50",top:"fdul",lv:2,q:"Para ver que dispositivos o testador NÃO deteta, usas…",o:["Types summary","Locate devices → All ON","Convert Line","Selftest"],a:1,e:"All ON faz piscar os detetados: os que não piscam faltam."}
);

/* ---------- mais fichas ---------- */
const tabFicha=k=>{const x=TF_TAB[k];return`<table class="tt2"><tr>${x.h.map(h=>`<th>${h}</th>`).join("")}</tr>${x.r.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join("")}</tr>`).join("")}</table>${x.n?`<p>${x.n}</p>`:""}`};
TF_FICHAS.push(
 {id:"f-mbfc",t:"Modbus — funções e linha série",a:"auto",s:"nr",ref:"modbus",get h(){return tabFicha("mbfc")+tabFicha("mbser")}},
 {id:"f-knxdpt",t:"KNX — DPT e endereços",a:"auto",s:"nr",ref:"knx",get h(){return tabFicha("knxdpt")+tabFicha("knxadr")}},
 {id:"f-bac",t:"BACnet — objetos e MS/TP",a:"auto",s:"nr",ref:"bacnet",get h(){return tabFicha("bacobj")+tabFicha("bacmstp")}},
 {id:"f-dali",t:"DALI e M-Bus — endereçamento",a:"auto",s:"nr",get h(){return tabFicha("dali")+tabFicha("mbus")}},
 {id:"f-det",t:"SADI — tipos de detetores",a:"sadi",s:"nr",ref:"en54b",get h(){return`<table class="tt2"><tr><th>Equipamento</th><th>Norma</th><th>Onde usar</th><th>Evitar</th></tr>${TF_DET.map(d=>`<tr><td><b>${d.t}</b></td><td>${d.n}</td><td>${d.uso}</td><td>${d.ev}</td></tr>`).join("")}</table>`}},
 {id:"f-fa",t:"SADI — alarmes falsos",a:"sadi",s:"rt",get h(){return`<ul>${TF_FA.map(f=>`<li><b>${f.c}:</b> ${f.p.join(" ")}</li>`).join("")}</ul>`}},
 {id:"f-com",t:"Comissionamento — listas",a:"auto",s:"rt",get h(){return TF_COM.map(c=>`<p><b>${c.t}</b></p><ul>${c.p.map(x=>`<li>☐ ${x}</li>`).join("")}</ul>`).join("")}}
);

/* ---------- mais cenários FDUL221 (usados pelo módulo 4) ---------- */
const TF_SCEN2=[
 {id:"s7",t:"Fuga elevada numa linha migrada",code:"E04",lcd:["Loop A->B: 40 dev","E04 Hi leak","",""],story:"Uma linha antiga foi convertida para FDnet; a central dá avaria intermitente.",steps:[
  {q:"O que significa E04 Hi leak?",o:[["Corrente de fuga acima do esperado (≈ 300 µA + 3 µA por dispositivo)",1,"Certo."],["Demasiados dispositivos",0,"Isso é E10."],["Curto-circuito",0,"Isso é E01."]]},
  {q:"Numa linha migrada, o que procuras primeiro?",o:[["Dispositivos antigos e resistências de fim de linha esquecidas",1,"Certo — restos da instalação anterior causam fugas."],["Trocar todos os detetores novos",0,"Não resolve se a causa forem restos da instalação antiga."]]}],end:"Depois de corrigir, ler de novo e confirmar sem erros."},
 {id:"s8",t:"Linha demasiado grande",code:"E10",lcd:["Loop A->B: 261 dev","E10 >252 dev","",""],story:"Juntaram dois pisos no mesmo laço para poupar cabo.",steps:[
  {q:"O que diz o testador?",o:[["Há mais de 252 dispositivos — o máximo de uma linha FDnet",1,"Certo."],["Há um defeito à terra",0,"Não."]]},
  {q:"Solução?",o:[["Dividir em dois laços (ou laço + ramais) com menos dispositivos",1,"Certo — e confirmar também os limites da NT 12 por avaria."],["Ignorar, funciona",0,"Ultrapassa o limite do protocolo."]]}],end:"Limite FDnet: 252 dispositivos por linha."},
 {id:"s9",t:"Botoneira em alarme",code:"E16",lcd:["Loop A->B: 20 dev","E16 Alarm [T011]","",""],story:"Durante a leitura, o T011 (botoneira FDM221) aparece em alarme.",steps:[
  {q:"Como confirmas no terreno qual é?",o:[["Selecionar o T011 para fazer piscar o indicador e ir ao local",1,"Certo."],["Desligar o testador",0,"Perdes a indicação."]]},
  {q:"A botoneira tem o elemento atuado. Correção?",o:[["Rearmar/substituir o elemento segundo o fabricante e fechar a porta; voltar a ler",1,"Certo."],["Retirar a botoneira",0,"Fica um ponto de alarme a menos."]]}],end:"Na central, repor o alarme só depois de confirmada a causa e com os avisos feitos."}
];
