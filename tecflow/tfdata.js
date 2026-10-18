/* =========================================================
   TecFlow — conteúdos (dados)
   Cada conteúdo tem uma CLASSE DE FONTE (src):
     of = oficial do fabricante (resumo de documentação do fabricante — confirmar sempre no documento original)
     nr = norma / regulamento
     rt = recomendação técnica (boa prática de terreno)
     dd = didático (explicação simplificada / exercício de aprendizagem)
   ========================================================= */
"use strict";
const TF_SRC={of:["Oficial do fabricante","Resumo de documentação do fabricante. Confirma sempre no manual original e na versão do equipamento."],
 nr:["Norma / regulamento","Baseado em norma ou legislação. Confirma a versão em vigor."],
 rt:["Recomendação técnica","Boa prática de terreno. Não substitui o manual do fabricante nem a regulamentação."],
 dd:["Didático","Explicação simplificada para aprender. Não usar como procedimento numa instalação real."]};

/* ---------- referências citadas ---------- */
const TF_REF={
 fdulTM:{t:"Siemens — FDUL221 Line Tester, Technical Manual (doc. 008250 / A6V10072517, 2013)",u:"https://www.algotechfire.com.au/FD720/Documents/A6V10072517.pdf",s:"of"},
 nt12:{t:"ANEPC — Nota Técnica n.º 12, Sistemas Automáticos de Deteção de Incêndio (2023)",u:"https://prociv.gov.pt/media/2ubd1pbq/nt-12_2023.pdf",s:"nr"},
 rjscie:{t:"RJ-SCIE — Decreto-Lei n.º 220/2008, de 12 de novembro (na redação em vigor)",s:"nr"},
 rtscie:{t:"RT-SCIE — Portaria n.º 1532/2008, alterada pela Portaria n.º 135/2020 (SADI: art.ºs 116.º a 132.º)",s:"nr"},
 p773:{t:"Portaria n.º 773/2009 — registo na ANEPC das entidades de comercialização, instalação e manutenção de equipamentos SCIE",u:"https://diariodarepublica.pt/dr/detalhe/portaria/773-2009-492728",s:"nr"},
 govscie:{t:"gov.pt — Segurança contra incêndio em edifícios (serviços, registo de entidades, inspeções)",u:"https://www.gov.pt/guias/seguranca-contra-incendio-em-edificios",s:"nr"},
 en54:{t:"EN 54 — Sistemas de deteção e alarme de incêndio (partes 2, 4, 13, 14…)",s:"nr"},
 rtiebt:{t:"RTIEBT — Portaria n.º 949-A/2006 (Regras Técnicas das Instalações Elétricas de Baixa Tensão)",s:"nr"},
 knx:{t:"KNX Association",u:"https://www.knx.org",s:"nr"},
 modbus:{t:"Modbus Organization — especificações Modbus Application Protocol e Modbus over Serial Line",u:"https://modbus.org",s:"nr"},
 bacnet:{t:"BACnet International / ASHRAE 135",u:"https://bacnet.org",s:"nr"},
 dali:{t:"DALI Alliance — IEC 62386",u:"https://www.dali-alliance.org",s:"nr"},
 mbus:{t:"M-Bus — EN 13757",u:"https://m-bus.com",s:"nr"},
 siemens:{t:"Siemens Smart Infrastructure (Cerberus / FDnet)",u:"https://www.siemens.com",s:"of"}
};

/* ---------- áreas ---------- */
const TF_AREAS=[
 {id:"auto",t:"Automação predial",c:"#22c3ee",ic:"bus",d:"KNX, BACnet, Modbus RTU/TCP, DALI, M-Bus, comunicação IP, gateways e integração BMS.",
  subs:[["prot","Protocolos e simuladores"],["sel","Escolher a rede"],["topo","Tipologias de bus"],["ip","Comunicação IP"],["gw","Gateways e BMS"],["banc","Bancada de ligações"]]},
 {id:"sadi",t:"SADI e segurança contra incêndio",c:"#ef4444",ic:"fire",d:"Centrais, detetores, botoneiras, módulos, sirenes, laços, zonas, avarias, alarmes e manutenção.",
  subs:[["geral","Visão geral"],["proto","Protocolos SADI"],["lig","Ligação do laço"],["sie","Exemplo Siemens"],["fdul","Testador FDUL221"],["sim","Simulador de laço"],["av","Avarias e alarmes"],["real","Intervenção real e manutenção"],["reg","Requisitos em Portugal"]]},
 {id:"diag",t:"Diagnóstico e manutenção",c:"#f5b52e",ic:"probe",d:"Leitura de LEDs, medições, análise de falhas, interpretação de esquemas e elaboração de relatórios.",
  subs:[["falhas","Análise de falhas"],["led","Leitura de LEDs"],["med","Medições"],["calc","Calculadoras RTIEBT"],["esq","Interpretar esquemas"],["rel","Relatórios"]]},
 {id:"bib",t:"Biblioteca técnica",c:"#8b5cf6",ic:"book",d:"Manuais dos fabricantes, fichas técnicas, procedimentos, normas aplicáveis e PDF para consulta no terreno.",
  subs:[["docs","Os meus PDF"],["fichas","Fichas de bolso"],["ref","Normas e referências"],["guia","Guia de bolso RTIEBT"],["fab","Fabricantes"],["tab","Tabelas e fontes"]]}
];
/* o que é aprendizagem e o que é procedimento real (SADI) */
const TF_KIND={lig:"learn",sie:"learn",sim:"learn",fdul:"learn",av:"learn",geral:"ref",proto:"ref",real:"real",reg:"real"};

/* ---------- avarias / códigos ---------- */
/* sys: knx dali mrtu mtcp bacnet mbus ip sadi fdul */
const TF_FAULTS=[
 /* FDUL221 — tabela de falhas do manual técnico (secção 6.13) */
 {id:"E01",sys:"fdul",c:"E01 Short",t:"Curto-circuito na linha",s:"of",ref:"fdulTM",cause:"Curto-circuito; o separador de linha abriu no dispositivo indicado.",do:["Verificar o troço de cabo a seguir ao dispositivo indicado.","Num laço, o curto também aparece como linha aberta: não te deixes enganar."]},
 {id:"E02",sys:"fdul",c:"E02 Open (+)",t:"Linha aberta no (+)",s:"of",ref:"fdulTM",cause:"Interrupção no condutor positivo. O testador não indica o ponto exato.",do:["Verificar o cabo.","Desligar o retorno, voltar a ler a linha: o corte está depois do último dispositivo mostrado.","Usar o método «Measure Device»."]},
 {id:"E03",sys:"fdul",c:"E03 Open (−)",t:"Linha aberta no (−)",s:"of",ref:"fdulTM",cause:"Interrupção no condutor negativo.",do:["Abrir o laço numa ponta e voltar a ler: o corte está depois do último dispositivo mostrado."]},
 {id:"E04",sys:"fdul",c:"E04 Hi leak",t:"Corrente de fuga elevada",s:"of",ref:"fdulTM",cause:"Fuga típica ≈ 300 µA de base + ≈ 3 µA por dispositivo; acima disso há problema de isolamento.",do:["Verificar o isolamento do cabo.","Em linhas migradas: procurar dispositivos antigos ou resistências de fim de linha esquecidas."]},
 {id:"E05",sys:"fdul",c:"E05 High cap",t:"Capacidade da linha elevada",s:"of",ref:"fdulTM",cause:"Linha demasiado comprida (limites: 3,3 km FS20/FS720; R máx. 240 Ω; C máx. 750 nF; depende do cabo) ou erro de migração (dispositivo esquecido).",do:["Encurtar laços/ramais (dividir).","Substituir o dispositivo afetado se for erro de migração."]},
 {id:"E06",sys:"fdul",c:"E06 (−) → EARTH",t:"Defeito à terra no (−)",s:"of",ref:"fdulTM",cause:"Negativo à terra, ou a ligação do indicador de ação externo (AI) à terra.",do:["Procurar o defeito, com atenção a dispositivos com partes à terra e cabos blindados.","Dividir a linha em partes (metades, quartos) e testar cada uma."]},
 {id:"E07",sys:"fdul",c:"E07 (+) → EARTH",t:"Defeito à terra no (+)",s:"of",ref:"fdulTM",cause:"Positivo à terra. O testador não indica a posição exata.",do:["Método da divisão ao meio (bisseção)."]},
 {id:"E08",sys:"fdul",c:"E08 series R",t:"Resistência série elevada",s:"of",ref:"fdulTM",cause:"Resistência da linha demasiado alta: borne mal apertado, emenda, cabo comprido ou de secção pequena.",do:["Verificar cabos e ligações nos bornes.","Confirmar que a linha não é demasiado comprida (limites em E05).","Usar «Measure Device»."]},
 {id:"E09",sys:"fdul",c:"E09 More err",t:"Mais erros do que os mostrados",s:"of",ref:"fdulTM",cause:"A lista de erros tem tamanho máximo.",do:["Corrigir os erros mostrados e voltar a ler a linha."]},
 {id:"E10",sys:"fdul",c:"E10 >252 dev",t:"Demasiados dispositivos",s:"of",ref:"fdulTM",cause:"Uma linha FDnet/C-NET suporta no máximo 252 dispositivos.",do:["Dividir o laço ou ramal."]},
 {id:"E11",sys:"fdul",c:"E11 bad TTap",t:"Derivação (T) em sítio não permitido",s:"of",ref:"fdulTM",cause:"Sub-ramal num ramal (não permitido) — só são permitidos sub-ramais a partir do laço.",do:["Corrigir a cablagem."]},
 {id:"E12",sys:"fdul",c:"E12 >2 TTap",t:"Derivações seguidas sem separador",s:"of",ref:"fdulTM",cause:"Vários sub-ramais seguidos sem dispositivo separador entre eles.",do:["Colocar um dispositivo (ex.: separador FDCL221) entre sub-ramais: só um sub-ramal entre dois dispositivos."]},
 {id:"E13",sys:"fdul",c:"E13 bad EOS",t:"Fim de ramal anómalo",s:"of",ref:"fdulTM",cause:"No último dispositivo de um ramal a corrente é maior do que o esperado.",do:["Em linhas migradas: procurar resistência ou díodo zener nesse dispositivo e retirar."]},
 {id:"E14",sys:"fdul",c:"E14 Diode (+)",t:"Díodo no (+)",s:"of",ref:"fdulTM",cause:"Normalmente um fio ligado ao borne do indicador externo (AI) em vez do borne da linha.",do:["Verificar a cablagem do dispositivo.","Usar «Measure Device»."]},
 {id:"E15",sys:"fdul",c:"E15 Diode (−)",t:"Díodo no (−)",s:"of",ref:"fdulTM",cause:"Como o E14, no negativo.",do:["Verificar a cablagem; «Measure Device»."]},
 {id:"E16",sys:"fdul",c:"E16 Alarm",t:"Dispositivo em alarme",s:"of",ref:"fdulTM",cause:"Há um alarme ativo no dispositivo (ex.: botoneira com vidro/elemento partido).",do:["Substituir o elemento da botoneira e fechar a porta; repor o detetor."]},
 {id:"E17",sys:"fdul",c:"E17 Defect",t:"Dispositivo avariado",s:"of",ref:"fdulTM",cause:"O dispositivo de linha está avariado.",do:["Substituir o dispositivo."]},
 /* Modbus — códigos de exceção (especificação Modbus Application Protocol) */
 {id:"MB01",sys:"mrtu",c:"Exceção 01",t:"Função ilegal (Illegal Function)",s:"nr",ref:"modbus",cause:"O escravo não suporta o código de função pedido (ex.: pedir FC16 a um aparelho que só aceita FC06).",do:["Ver no manual do aparelho que funções aceita.","Mudar a função no mestre/gateway."]},
 {id:"MB02",sys:"mrtu",c:"Exceção 02",t:"Endereço de dados ilegal (Illegal Data Address)",s:"nr",ref:"modbus",cause:"O registo pedido não existe. Erro muito comum: deslocamento de 1 (registo 40001 = endereço 0).",do:["Confirmar o mapa de registos do fabricante.","Experimentar endereço −1 / +1 (base 0 vs base 1)."]},
 {id:"MB03",sys:"mrtu",c:"Exceção 03",t:"Valor de dados ilegal (Illegal Data Value)",s:"nr",ref:"modbus",cause:"Quantidade de registos ou valor fora do permitido.",do:["Reduzir o número de registos por pedido.","Ver limites e escalas no mapa de registos."]},
 {id:"MB04",sys:"mrtu",c:"Exceção 04",t:"Falha do aparelho (Server Device Failure)",s:"nr",ref:"modbus",cause:"Erro interno do escravo ao executar o pedido.",do:["Ver o estado/alarme do aparelho; reiniciar se o fabricante o permitir."]},
 {id:"MB06",sys:"mrtu",c:"Exceção 06",t:"Aparelho ocupado (Server Device Busy)",s:"nr",ref:"modbus",cause:"O escravo está a processar um comando longo.",do:["Aumentar o intervalo entre pedidos e repetir."]},
 {id:"MB0A",sys:"mtcp",c:"Exceção 0A",t:"Caminho de gateway indisponível",s:"nr",ref:"modbus",cause:"O gateway não tem caminho para o destino (configuração do gateway).",do:["Verificar a tabela de encaminhamento / Unit ID no gateway."]},
 {id:"MB0B",sys:"mtcp",c:"Exceção 0B",t:"Destino do gateway não responde",s:"nr",ref:"modbus",cause:"O gateway TCP→RTU não obteve resposta do escravo série.",do:["Verificar o lado RS-485: endereço, velocidade, paridade, terminação, A/B trocados."]},
 {id:"MBTO",sys:"mrtu",c:"Sem resposta (timeout)",t:"Escravo Modbus RTU não responde",s:"rt",cause:"Endereço errado, parâmetros série diferentes (velocidade/paridade/bits de paragem), A/B trocados, falta de terminação ou de polarização, ou dois mestres no mesmo bus.",do:["Confirmar endereço (1–247) e parâmetros série iguais em todos.","Trocar A/B se não houver resposta nenhuma.","Medir ≈ 60 Ω entre A e B com tudo desligado (duas terminações de 120 Ω).","Só um mestre por bus."]},
 {id:"MBCRC",sys:"mrtu",c:"Erros de CRC",t:"Tramas corrompidas no RS-485",s:"rt",cause:"Ruído, cabo não entrançado, derivações longas, falta de terminação ou blindagem mal ligada.",do:["Cabo entrançado com impedância ~120 Ω, em linha (sem estrela).","Terminação de 120 Ω só nas duas pontas.","Blindagem contínua e à terra num só ponto."]},
 /* KNX */
 {id:"KNX1",sys:"knx",c:"Bus sem tensão",t:"Linha KNX sem tensão / dispositivos sem resposta",s:"rt",cause:"Fonte desligada ou avariada, curto no bus, polaridade trocada num troço, borne do bus mal encaixado.",do:["Medir no bus: tensão contínua de ≈ 21 a 30 V (fonte nominal ≈ 30 V).","Se 0 V: desligar troços até o curto desaparecer.","Confirmar o LED da fonte e a bobina/choke."]},
 {id:"KNX2",sys:"knx",c:"Não programa",t:"Dispositivo não aceita endereço físico",s:"rt",cause:"Botão de programação não premido, interface/USB noutra linha, acopladores a filtrar, endereço já existente.",do:["Premir o botão de programação: o LED (normalmente vermelho) deve acender.","Ver a interface e a topologia no ETS.","Confirmar que não há dois aparelhos em modo de programação."]},
 {id:"KNX3",sys:"knx",c:"Telegramas perdidos",t:"Comandos que às vezes não chegam",s:"rt",cause:"Linha sobrecarregada (tráfego), acopladores sem filtro, cabo demasiado comprido, demasiados dispositivos.",do:["Ver a carga do bus no monitor do ETS.","Respeitar limites: 64 dispositivos por segmento; 1000 m por segmento; 350 m fonte→dispositivo; 700 m entre dispositivos."]},
 /* DALI */
 {id:"DALI1",sys:"dali",c:"Sem resposta",t:"Driver DALI não responde",s:"rt",cause:"Sem fonte DALI ou fonte em sobrecarga, endereço não atribuído, cabo longo (queda > 2 V).",do:["Medir a tensão do bus DALI (nível alto típico 9,5–22,5 V).","Fazer novo endereçamento ou procurar dispositivos.","Fonte ≤ 250 mA; até 64 endereços por linha."]},
 {id:"DALI2",sys:"dali",c:"Falha de lâmpada",t:"Driver indica falha de lâmpada",s:"rt",cause:"Módulo LED avariado, ligação driver→LED solta, sobretemperatura.",do:["Ver a ligação de saída do driver e o módulo LED.","Consultar o estado do driver na ferramenta DALI."]},
 /* M-Bus */
 {id:"MBUS1",sys:"mbus",c:"Contador não lido",t:"Contador M-Bus não responde",s:"rt",cause:"Endereço primário duplicado ou errado, velocidade diferente (300/2400/9600 baud), mestre sem capacidade para o número de cargas.",do:["Fazer procura por endereço secundário.","Confirmar a velocidade e a capacidade do mestre (cargas unitárias)."]},
 /* BACnet / IP */
 {id:"BAC1",sys:"bacnet",c:"Who-Is sem I-Am",t:"Dispositivo BACnet/IP não aparece",s:"rt",cause:"Sub-rede diferente sem BBMD, porta UDP diferente de 47808 (0xBAC0), firewall, Device ID duplicado.",do:["Confirmar IP/máscara e porta 47808.","Entre sub-redes: BBMD/Foreign Device.","Device Instance único em toda a rede."]},
 {id:"BAC2",sys:"bacnet",c:"MS/TP instável",t:"Bus MS/TP com perdas",s:"rt",cause:"MAC duplicado, Max Master errado, velocidades diferentes, terminação/polarização.",do:["MAC único (masters 0–127).","Mesma velocidade em todos; terminação nas pontas."]},
 {id:"IP1",sys:"ip",c:"Sem comunicação IP",t:"Equipamento IP não comunica",s:"rt",cause:"Endereço fora da sub-rede, máscara errada, gateway errado, IP duplicado, VLAN diferente.",do:["Ver IP, máscara e gateway; fazer ping.","Confirmar que estão na mesma sub-rede/VLAN ou que há encaminhamento."]},
 /* SADI genérico */
 {id:"S1",sys:"sadi",c:"Avaria de terra",t:"Central indica defeito à terra",s:"rt",cause:"Isolamento danificado, cabo trilhado, humidade numa caixa, blindagem ligada à terra em mais de um ponto.",do:["Seguir o procedimento do fabricante (pode exigir isolar troços).","Blindagem à terra só num ponto (normalmente na central).","Divisão ao meio para localizar."]},
 {id:"S2",sys:"sadi",c:"Laço aberto",t:"Laço aberto / perda de redundância",s:"rt",cause:"Cabo cortado, borne solto, dispositivo retirado da base.",do:["A central alimenta pelas duas pontas: o sistema continua, mas sem redundância — corrigir depressa.","Localizar entre os últimos dispositivos que respondem por cada lado."]},
 {id:"S3",sys:"sadi",c:"Curto / isolador ativo",t:"Isolador de curto-circuito atuado",s:"rt",cause:"Curto entre condutores num troço; os isoladores dos dois lados abrem.",do:["Os dispositivos entre os dois isoladores ficam sem comunicação — ver quais faltam.","Procurar o curto nesse troço."]},
 {id:"S4",sys:"sadi",c:"Dispositivo em falta",t:"Dispositivo não responde",s:"rt",cause:"Detetor retirado, base mal ligada, endereço errado ou duplicado.",do:["Ver o endereço e a base.","Comparar com a configuração da central."]},
 {id:"S5",sys:"sadi",c:"Detetor sujo",t:"Aviso de contaminação / manutenção do detetor",s:"rt",cause:"Pó, obras, envelhecimento da câmara ótica.",do:["Limpar ou substituir segundo o fabricante.","Proteger os detetores durante obras e retirar as proteções no fim."]},
 {id:"S6",sys:"sadi",c:"Avaria de alimentação",t:"Falha de rede ou de baterias",s:"rt",cause:"Disjuntor da central desligado, baterias velhas ou mal ligadas, carregador avariado.",do:["Medir a tensão de flutuação (típico 13,6–13,8 V por bateria de 12 V; confirmar no fabricante).","Autonomia exigida: 72 h em vigília + 30 min em alarme (NT 12)."]},
 {id:"S7",sys:"sadi",c:"Avaria de sirene",t:"Circuito de sirenes em avaria",s:"rt",cause:"Circuito supervisionado aberto/curto, resistência de fim de linha em falta, sirene avariada.",do:["Ver o fim de linha (valor do fabricante).","Medir o circuito desligado da central."]}
];
const TF_SYS={knx:"KNX",dali:"DALI",mrtu:"Modbus RTU",mtcp:"Modbus TCP / gateway",bacnet:"BACnet",mbus:"M-Bus",ip:"Rede IP",sadi:"SADI (genérico)",fdul:"FDUL221 (Siemens FDnet)"};

/* ---------- LEDs ---------- */
const TF_LEDS=[
 {sys:"FDUL221",eq:"Testador de linha",led:"Vermelho a piscar devagar",sig:"Erro no arranque",do:"Desligar e voltar a ligar; ver baterias; autoteste (menu Configuração → Selftest).",s:"of",ref:"fdulTM"},
 {sys:"FDUL221",eq:"Testador de linha",led:"Vermelho a piscar rápido",sig:"Ligado a PC (ex.: transferência)",do:"Aguardar o fim da transferência.",s:"of",ref:"fdulTM"},
 {sys:"FDUL221",eq:"Testador de linha",led:"Verde fraco a piscar",sig:"Funcionamento normal",do:"—",s:"of",ref:"fdulTM"},
 {sys:"FDUL221",eq:"Testador de linha",led:"Verde forte a piscar",sig:"A ler a topologia da linha ou ligado a PC",do:"Aguardar.",s:"of",ref:"fdulTM"},
 {sys:"FDnet",eq:"Dispositivo da linha (no FDUL221)",led:"Indicador de alarme a piscar",sig:"Dispositivo selecionado / «Locate devices» / dispositivo com erro",do:"Usar para localizar fisicamente o dispositivo na obra.",s:"of",ref:"fdulTM"},
 {sys:"KNX",eq:"Atuador / sensor KNX",led:"Vermelho fixo junto ao botão de programação",sig:"Modo de programação ativo",do:"Programar o endereço físico ou premir de novo para sair.",s:"rt"},
 {sys:"KNX",eq:"Fonte KNX",led:"Verde",sig:"Bus com tensão",do:"Se apagado: ver a alimentação 230 V e curto no bus.",s:"rt"},
 {sys:"KNX",eq:"Fonte KNX",led:"Vermelho / «overload»",sig:"Sobrecarga ou curto no bus",do:"Desligar troços até o LED normalizar.",s:"rt"},
 {sys:"RS-485",eq:"Gateway / conversor",led:"TX pisca, RX nunca pisca",sig:"O mestre pergunta mas ninguém responde",do:"Ver endereço, parâmetros série e A/B trocados.",s:"rt"},
 {sys:"RS-485",eq:"Gateway / conversor",led:"TX e RX sempre acesos",sig:"Bus bloqueado (curto, A/B em curto, dois mestres)",do:"Desligar o bus e medir entre A e B.",s:"rt"},
 {sys:"Ethernet",eq:"Porta de rede",led:"Link apagado",sig:"Sem ligação física",do:"Ver cabo, tomada, porta do switch.",s:"rt"},
 {sys:"Ethernet",eq:"Porta de rede",led:"Link aceso, atividade nunca pisca",sig:"Ligação física sem tráfego",do:"Ver VLAN e configuração IP.",s:"rt"},
 {sys:"DALI",eq:"Fonte DALI",led:"Apagado",sig:"Bus sem alimentação",do:"Ver a alimentação e se há curto no bus.",s:"rt"},
 {sys:"SADI",eq:"Detetor endereçável",led:"Intermitente curto periódico",sig:"Comunicação normal com a central (em muitas marcas; algumas desativam)",do:"Confirmar o comportamento no manual da marca.",s:"rt"},
 {sys:"SADI",eq:"Detetor endereçável",led:"Fixo (vermelho)",sig:"Detetor em alarme",do:"Ver a central; repor só depois de confirmar a causa.",s:"rt"},
 {sys:"SADI",eq:"Central (CDI)",led:"Amarelo «Avaria» fixo",sig:"Avaria no sistema",do:"Ler a mensagem na central e registar no livro de ocorrências.",s:"rt"},
 {sys:"SADI",eq:"Central (CDI)",led:"Amarelo «Desativado / Teste»",sig:"Há zonas/dispositivos desligados ou em teste",do:"Repor no fim da intervenção (NT 12, verificação diária).",s:"nr",ref:"nt12"}
];

/* ---------- medições ---------- */
const TF_MEAS=[
 {sys:"KNX",o:"Tensão do bus",onde:"Bornes vermelho (+) / preto (−) do bus, em qualquer dispositivo",como:"Multímetro em V DC",ok:"≈ 21 a 30 V DC (fonte nominal ≈ 30 V). Abaixo de ~21 V os dispositivos deixam de funcionar.",s:"rt",ref:"knx"},
 {sys:"RS-485 (Modbus RTU / BACnet MS/TP)",o:"Terminação",onde:"Entre A e B, com todos os aparelhos desligados",como:"Multímetro em Ω",ok:"≈ 60 Ω (duas terminações de 120 Ω em paralelo). ≈ 120 Ω = falta uma; ≈ 40 Ω = há uma a mais.",s:"rt"},
 {sys:"RS-485",o:"Repouso do bus",onde:"Entre A e B, bus ligado e sem tráfego",como:"V DC",ok:"Tensão diferencial de repouso de algumas centenas de mV (com polarização). ≈ 0 V = falta polarização.",s:"rt"},
 {sys:"DALI",o:"Tensão do bus",onde:"DA+ / DA− (ou DA/DA sem polaridade) junto ao driver mais afastado",como:"V DC",ok:"Nível alto típico 9,5–22,5 V (IEC 62386). Queda no cabo ≤ 2 V.",s:"nr",ref:"dali"},
 {sys:"SADI FDnet",o:"Linha com o FDUL221",onde:"Linha desligada da central, A (início) e B (fim)",como:"FDUL221: Startup Loop A->B, Measurements, Measure Device",ok:"Sem erros; R máx. 240 Ω, C máx. 750 nF, comprimento ≤ 3,3 km (FS20/FS720; depende do cabo).",s:"of",ref:"fdulTM"},
 {sys:"SADI FDnet",o:"Defeito à terra",onde:"FDUL221 (variante 3) → Measurements",como:"Ler (+) e (−) em relação à terra",ok:"«OK» dos dois lados. Com «leak/fault» num lado, o valor mais baixo é o defeito real; > 500 kΩ não é detetado com fiabilidade; ≈ 100 kΩ no outro lado é do circuito interno.",s:"of",ref:"fdulTM"},
 {sys:"Instalação BT",o:"Resistência de isolamento",onde:"Entre condutores ativos e entre ativos e terra, circuito desligado",como:"Megaohmímetro",ok:"Circuitos até 500 V: ensaio a 500 V DC, ≥ 0,5 MΩ. SELV/PELV: 250 V DC, ≥ 0,25 MΩ. (Desligar equipamentos eletrónicos antes!)",s:"nr",ref:"rtiebt"},
 {sys:"Instalação BT",o:"Terra de proteção (TT)",onde:"Elétrodo de terra / circuito de proteção",como:"Telurómetro ou medidor de malha",ok:"R × IΔn ≤ 50 V (25 V em locais húmidos/condutores). Com DR de 30 mA: R ≤ 1667 Ω (na prática muito menos).",s:"nr",ref:"rtiebt"},
 {sys:"Central SADI",o:"Baterias",onde:"Bornes de cada bateria de 12 V",como:"V DC com carregador ligado",ok:"Flutuação típica 13,6–13,8 V (confirmar no fabricante). Autonomia exigida: 72 h + 30 min em alarme.",s:"rt",ref:"nt12"},
 {sys:"M-Bus",o:"Tensão do bus",onde:"Bornes do contador",como:"V DC",ok:"Depende do mestre (tipicamente 24–42 V em repouso). Comparar com a ficha do mestre.",s:"rt",ref:"mbus"},
 {sys:"Rede IP",o:"Ligação",onde:"PC ligado à mesma rede",como:"ping, ipconfig/ifconfig, ferramenta do fabricante",ok:"Resposta ao ping; mesmo prefixo de rede e máscara; gateway correto.",s:"rt"}
];

/* ---------- comunicação IP e gateways ---------- */
const TF_PORTS=[["Modbus TCP","TCP 502","nr"],["BACnet/IP","UDP 47808 (0xBAC0)","nr"],["KNXnet/IP (tunelling/routing)","UDP 3671; routing multicast 224.0.23.12","nr"],["HTTP / HTTPS (páginas de configuração)","TCP 80 / 443","nr"],["SNMP","UDP 161 (traps 162)","nr"],["MQTT","TCP 1883 (TLS 8883)","nr"],["OPC UA","TCP 4840","nr"],["NTP (hora)","UDP 123","nr"]];
const TF_GW=[
 {t:"Antes de configurar: a lista de pontos",s:"rt",p:["Pedir ao fabricante o mapa de registos/objetos de cada equipamento.","Fazer a lista de pontos: nome, tipo (leitura/escrita, analógico/digital), unidade, escala, endereço de origem e de destino.","Definir a frequência de leitura (polling) — não ler tudo de segundo a segundo."]},
 {t:"Modbus → BACnet (o mais comum na GTC)",s:"rt",p:["Cada registo Modbus vira um objeto BACnet (AI/AV para valores, BI/BV para estados).","Atenção à ordem das palavras (32 bits) e à escala (ex.: valor ×10).","Device Instance único na rede BACnet."]},
 {t:"KNX → BACnet / Modbus",s:"rt",p:["Cada endereço de grupo KNX mapeia para um objeto/registo.","Usar os tipos de dados KNX (DPT) corretos: 1.001 interruptor, 5.001 percentagem, 9.001 temperatura…","Evitar ciclos (o gateway escrever e ler o mesmo grupo)."]},
 {t:"DALI → BMS",s:"rt",p:["Normalmente através de um gateway DALI-KNX, DALI-BACnet ou DALI-Modbus.","Integrar falhas de lâmpada e estados de emergência, não só o comando."]},
 {t:"M-Bus → BMS",s:"rt",p:["Um mestre/gateway M-Bus lê os contadores e publica em Modbus/BACnet.","Ler poucas vezes (ex.: a cada 15 min) para poupar as baterias dos contadores."]},
 {t:"Integração com SADI",s:"nr",p:["A GTC pode receber estados do SADI (alarme, avaria) por interface do fabricante.","Comandos de segurança (portas, AVAC, extinção) devem seguir a matriz de comandos aprovada e a regulamentação SCIE — a GTC não substitui a central de incêndio."],ref:"rtscie"}
];

/* ---------- fabricantes ---------- */
const TF_MANUF=[
 {n:"Siemens",sys:["SADI","BACnet","KNX"],p:"Cerberus PRO / FS20 / FS720 (FDnet / C-NET), Desigo (GTC), KNX GAMMA.",eq:["FDUL221","FDCIO221","FDM221","DB720","FDCL221","FDS224/226/227"]},
 {n:"Apollo",sys:["SADI"],p:"Detetores e protocolos XP95, Discovery e Soteria (usados por várias centrais)."},
 {n:"Hochiki",sys:["SADI"],p:"Protocolo ESP, detetores endereçáveis e convencionais."},
 {n:"Bosch",sys:["SADI"],p:"Centrais com laço LSN."},
 {n:"Honeywell / Notifier / Esser",sys:["SADI","BACnet"],p:"Centrais endereçáveis; GTC."},
 {n:"ABB",sys:["KNX","Modbus"],p:"KNX i-bus, contadores e analisadores com Modbus."},
 {n:"Schneider Electric",sys:["KNX","Modbus","BACnet"],p:"KNX SpaceLogic, analisadores com Modbus, GTC EcoStruxure."},
 {n:"Gira / Jung / Hager",sys:["KNX"],p:"Aparelhagem e atuadores KNX."},
 {n:"Tridonic / Osram / Helvar",sys:["DALI"],p:"Drivers e controladores DALI / DALI-2."},
 {n:"Carlo Gavazzi / Socomec / Janitza",sys:["Modbus","M-Bus"],p:"Contadores e analisadores de energia (Modbus RTU/TCP, M-Bus)."},
 {n:"Kamstrup / Diehl / Sensus",sys:["M-Bus"],p:"Contadores de água e energia térmica com M-Bus."},
 {n:"Johnson Controls / Trane / Daikin",sys:["BACnet","Modbus"],p:"AVAC e GTC com BACnet; muitos chillers e UTA com Modbus."}
];

/* ---------- tema do dia ---------- */
const TF_THEMES=[
 {id:"t1",t:"Endereço físico vs endereço de grupo (KNX)",a:"auto",lv:1,s:"dd",x:"O endereço físico (ex.: 1.1.5) identifica o aparelho na topologia e serve para o programar. O endereço de grupo (ex.: 1/2/3) é a «função» partilhada: interruptor e atuador falam pelo mesmo grupo.",go:"#/auto/prot"},
 {id:"t2",t:"60 Ω entre A e B",a:"diag",lv:1,s:"rt",x:"Num RS-485 bem terminado, com tudo desligado, mede-se ≈ 60 Ω entre A e B: duas resistências de 120 Ω em paralelo, uma em cada ponta. 120 Ω = falta uma; 40 Ω = há uma a mais.",go:"#/diag/med"},
 {id:"t3",t:"Registo 40001 = endereço 0",a:"auto",lv:2,s:"rt",x:"Muitos manuais Modbus contam a partir de 1 (40001) mas o protocolo envia a partir de 0. Se recebes a exceção 02 ou valores «trocados», experimenta −1.",go:"#/diag/falhas?sys=mrtu"},
 {id:"t4",t:"BACnet/IP e a porta 47808",a:"auto",lv:2,s:"nr",x:"BACnet/IP usa UDP 47808 (0xBAC0). Who-Is é broadcast: não passa routers. Entre sub-redes é preciso BBMD ou registo como Foreign Device.",go:"#/auto/ip"},
 {id:"t5",t:"DALI não é SELV",a:"auto",lv:1,s:"nr",x:"O bus DALI tem isolamento básico e pode ir no mesmo cabo da energia — mas por isso mesmo trata-o como condutor de energia, não como cabo de muito baixa tensão de segurança.",go:"#/auto/prot"},
 {id:"t6",t:"Laço classe A: duas pontas",a:"sadi",lv:1,s:"dd",x:"Num laço a central alimenta pelas duas pontas. Um corte não cala os detetores — mas a redundância perdeu-se: é uma avaria a corrigir depressa.",go:"#/sadi/lig"},
 {id:"t7",t:"32 dispositivos por avaria",a:"sadi",lv:2,s:"nr",x:"A NT 12 limita o que uma única avaria (curto ou corte) pode pôr fora de serviço. Por isso o laço leva isoladores — em FDnet, cada dispositivo já tem separador de linha integrado.",go:"#/sadi/geral"},
 {id:"t8",t:"Nunca ligar a central e o FDUL221 ao mesmo tempo",a:"sadi",lv:2,s:"of",x:"O manual do FDUL221 avisa: ligar a instalação de incêndio e o testador à mesma linha em simultâneo pode danificar de forma irreparável a interface da linha ou o testador. Desliga sempre a linha da central primeiro.",go:"#/sadi/fdul?m=2"},
 {id:"t9",t:"Divisão ao meio",a:"diag",lv:2,s:"of",x:"Para um defeito à terra que o testador não localiza: abre a linha a meio, testa cada metade, fica com a que tem o defeito e repete. Em 4 ou 5 divisões chegas ao troço culpado.",go:"#/sadi/fdul?m=3"},
 {id:"t10",t:"Manutenção trimestral do SADI",a:"sadi",lv:2,s:"nr",x:"NT 12: a cada 3 meses verifica-se, entre outros, a alimentação de socorro, o teste de sinalizadores e pelo menos um detetor ou botoneira por zona. Até 25 % dos detetores podem ser ensaiados em cada trimestral, desde que todos o sejam no ano.",go:"#/sadi/real"},
 {id:"t11",t:"Avisar antes de testar",a:"sadi",lv:1,s:"nr",x:"Antes de um ensaio com ligação a central recetora de alarmes, avisa-a. Avisa os ocupantes se as sirenes vão tocar. Se a transmissão ficar inibida e a central não o mostrar, afixa um aviso na CDI (NT 12, 8.2.1).",go:"#/sadi/real"},
 {id:"t12",t:"Blindagem à terra num só ponto",a:"sadi",lv:1,s:"rt",x:"A blindagem do cabo do laço segue contínua de dispositivo em dispositivo e liga-se à terra só num ponto (normalmente na central). Dois pontos à terra = correntes na blindagem e avarias de terra.",go:"#/sadi/lig"},
 {id:"t13",t:"Megger a 500 V: desliga a eletrónica",a:"diag",lv:1,s:"rt",x:"O ensaio de isolamento a 500 V DC pode destruir fontes, drivers e módulos de bus. Desliga-os (ou ensaia só o cabo) antes de medir.",go:"#/diag/med"},
 {id:"t14",t:"Queda de tensão: 3 % e 5 %",a:"diag",lv:1,s:"nr",x:"Nas instalações alimentadas pela rede pública de BT: 3 % na iluminação e 5 % nos outros usos (RTIEBT).",go:"#/diag/calc?sub=qt"},
 {id:"t15",t:"Uma rede, uma sub-rede",a:"auto",lv:1,s:"rt",x:"Dois equipamentos IP só falam diretamente se estiverem na mesma sub-rede (mesmo prefixo, mesma máscara). Para sair da sub-rede é preciso gateway (router).",go:"#/auto/ip"},
 {id:"t16",t:"Lista de pontos antes do gateway",a:"auto",lv:2,s:"rt",x:"A integração BMS começa numa folha: cada ponto com nome, tipo, unidade, escala e endereços de origem/destino. Configurar sem lista é a receita para pontos trocados.",go:"#/auto/gw"},
 {id:"t17",t:"E08 series R: aperta os bornes",a:"sadi",lv:2,s:"of",x:"Resistência série elevada (E08) aparece muitas vezes por um borne mal apertado ou uma emenda. Limites FDnet: R máx. 240 Ω, C máx. 750 nF.",go:"#/sadi/fdul?m=3"},
 {id:"t18",t:"M-Bus: ler devagar",a:"auto",lv:2,s:"rt",x:"Contadores M-Bus com bateria gastam energia a responder. Lê a cada 15 min ou mais, não a cada segundo.",go:"#/auto/gw"},
 {id:"t19",t:"Botoneiras: 1,2 m e 30 m",a:"sadi",lv:1,s:"nr",x:"Botoneiras a cerca de 1,2 m do pavimento e a distância a percorrer até uma não deve ultrapassar 30 m (NT 12).",go:"#/sadi/geral"},
 {id:"t20",t:"Autonomia: 72 h + 30 min",a:"sadi",lv:1,s:"nr",x:"A fonte de socorro do SADI deve garantir 72 h em vigília seguidas de 30 min em alarme (NT 12). Testa as baterias anualmente e troca-as no prazo do fabricante.",go:"#/sadi/real"},
 {id:"t21",t:"KNX: 350 m e 700 m",a:"auto",lv:2,s:"nr",x:"Num segmento KNX TP: até 1000 m de cabo, 350 m da fonte a qualquer aparelho e 700 m entre dois aparelhos.",go:"#/auto/prot"},
 {id:"t22",t:"Exercício ≠ procedimento",a:"sadi",lv:1,s:"dd",x:"No TecFlow, o que tem a etiqueta 🎓 é aprendizagem. Numa instalação real seguem-se os procedimentos da entidade registada na ANEPC, do fabricante e da NT 12 — etiqueta 🛡.",go:"#/sadi/reg"}
];

/* ---------- treino (perguntas) ---------- */
/* top: knx dali modbus bacnet mbus ip sadi fdul medir rtiebt */
const TF_TOPICS={knx:"KNX",dali:"DALI",modbus:"Modbus",bacnet:"BACnet",mbus:"M-Bus",ip:"Rede IP",sadi:"SADI",fdul:"FDUL221",medir:"Medições",rtiebt:"RTIEBT"};
const TF_QZ=[
 {id:"q1",top:"knx",lv:1,q:"Que tensão esperas medir num bus KNX TP a funcionar?",o:["≈ 230 V AC","≈ 21–30 V DC","≈ 12 V AC","≈ 5 V DC"],a:1,e:"O bus KNX TP é SELV em corrente contínua; a fonte é de ≈ 30 V e os aparelhos funcionam até ≈ 21 V."},
 {id:"q2",top:"knx",lv:1,q:"O que identifica o endereço de grupo 1/2/3?",o:["Um aparelho na linha 1.2","Uma função partilhada entre aparelhos","A porta IP do router","O número de série"],a:1,e:"O endereço de grupo é a «função» (ex.: luz da sala) — sensores escrevem, atuadores ouvem."},
 {id:"q3",top:"knx",lv:2,q:"Num segmento KNX TP, qual é a distância máxima da fonte a um aparelho?",o:["100 m","350 m","700 m","1000 m"],a:1,e:"350 m fonte→aparelho; 700 m entre aparelhos; 1000 m de cabo no total."},
 {id:"q4",top:"modbus",lv:1,q:"Com todos os aparelhos desligados, quanto deve medir um RS-485 bem terminado entre A e B?",o:["≈ 0 Ω","≈ 60 Ω","≈ 120 Ω","≈ 1 kΩ"],a:1,e:"Duas terminações de 120 Ω em paralelo = 60 Ω."},
 {id:"q5",top:"modbus",lv:2,q:"Recebes a exceção 02 ao ler o registo 40010. Primeira suspeita?",o:["Cabo partido","Deslocamento de 1 no endereço (base 0 / base 1)","Velocidade errada","Fonte avariada"],a:1,e:"Exceção 02 = endereço inexistente; o «40001 = 0» é a causa mais comum."},
 {id:"q6",top:"modbus",lv:2,q:"Quantos mestres pode ter um bus Modbus RTU?",o:["Um","Dois","Até 32","Até 247"],a:0,e:"Modbus RTU é mestre/escravo: um mestre; escravos com endereços 1–247."},
 {id:"q7",top:"modbus",lv:3,q:"Um gateway Modbus TCP→RTU devolve a exceção 0B. Onde procuras?",o:["No switch Ethernet","No lado RS-485 (escravo não responde)","No PC","Na fonte do gateway"],a:1,e:"0B = o destino atrás do gateway não respondeu: ver endereço, parâmetros série, A/B, terminação."},
 {id:"q8",top:"bacnet",lv:2,q:"Que porta usa o BACnet/IP?",o:["TCP 502","UDP 47808","UDP 3671","TCP 80"],a:1,e:"UDP 47808 = 0xBAC0."},
 {id:"q9",top:"bacnet",lv:3,q:"O Who-Is não encontra um controlador noutra sub-rede. O que falta?",o:["Terminação","BBMD / Foreign Device","Mais velocidade","Endereço KNX"],a:1,e:"Who-Is é broadcast e não atravessa routers; o BBMD reencaminha."},
 {id:"q10",top:"dali",lv:1,q:"Quantos endereços curtos tem uma linha DALI?",o:["16","32","64","254"],a:2,e:"64 endereços, 16 grupos, 16 cenas."},
 {id:"q11",top:"dali",lv:2,q:"O DALI pode ir no mesmo cabo da alimentação 230 V porque…",o:["É SELV","Tem isolamento básico e não é SELV","Usa fibra","É sem fios"],a:1,e:"DALI não é SELV: tem isolamento básico, por isso pode partilhar o cabo — e trata-se como condutor de energia."},
 {id:"q12",top:"mbus",lv:2,q:"Porque não se deve ler contadores M-Bus a cada segundo?",o:["O bus avaria","Gasta a bateria dos contadores","É proibido","Os contadores não guardam valores"],a:1,e:"Responder consome energia; muitos contadores são a bateria."},
 {id:"q13",top:"ip",lv:1,q:"192.168.1.20/24 e 192.168.2.30/24 falam diretamente?",o:["Sim","Não — sub-redes diferentes","Só com Wi-Fi","Só com PoE"],a:1,e:"/24 = os três primeiros números têm de ser iguais. Precisam de router."},
 {id:"q14",top:"ip",lv:2,q:"Quantos endereços úteis tem uma sub-rede /24?",o:["24","254","256","1024"],a:1,e:"256 endereços menos rede e broadcast = 254."},
 {id:"q15",top:"sadi",lv:1,q:"Num laço classe A, um corte no cabo…",o:["Desliga todos os detetores","Mantém os detetores (alimentados pelas duas pontas) mas gera avaria","Dispara alarme geral","Não é detetado"],a:1,e:"A central alimenta pelas duas pontas; perde-se a redundância e deve aparecer avaria."},
 {id:"q16",top:"sadi",lv:1,q:"Onde se liga a blindagem do cabo do laço à terra?",o:["Em todos os detetores","Num único ponto (normalmente na central)","Em nenhum","Nas sirenes"],a:1,e:"Um só ponto evita correntes na blindagem e avarias de terra."},
 {id:"q17",top:"sadi",lv:2,q:"Segundo a NT 12, quem faz a manutenção anual do SADI?",o:["O utilizador","Qualquer eletricista","Entidade registada na ANEPC","Os bombeiros"],a:2,e:"A anual é feita por entidade registada na ANEPC, com relatório assinado pelo técnico responsável."},
 {id:"q18",top:"sadi",lv:2,q:"Antes de um ensaio com ligação a central recetora de alarmes deves…",o:["Desligar a central","Avisar a central recetora","Retirar as baterias","Nada"],a:1,e:"NT 12, 8.2.1: avisar a central recetora; avisar ocupantes se as sirenes vão tocar."},
 {id:"q19",top:"sadi",lv:1,q:"Que autonomia exige a NT 12 para a fonte de socorro do SADI?",o:["1 h","24 h","72 h + 30 min em alarme","7 dias"],a:2,e:"72 h em vigília + 30 min em alarme."},
 {id:"q20",top:"sadi",lv:3,q:"No trimestral, que percentagem máxima de detetores pode ser ensaiada de cada vez (NT 12)?",o:["10 %","25 %, desde que todos sejam ensaiados no ano","50 %","100 %"],a:1,e:"Até 25 % por trimestral, cobrindo todos durante o ano."},
 {id:"q21",top:"fdul",lv:1,q:"Antes de ligar o FDUL221 a uma linha…",o:["Basta desligar as sirenes","A linha tem de ser desligada da central","Liga-se em paralelo com a central","Retira-se a blindagem"],a:1,e:"Central e testador ligados ao mesmo tempo podem danificar a interface da linha ou o testador."},
 {id:"q22",top:"fdul",lv:1,q:"Num laço, onde ligas o início e o fim da linha?",o:["Ambos em A","Início em A, fim em B","Início em B, fim em A","No borne amarelo/verde"],a:1,e:"A = início do laço/ramal; B = fim do laço. Amarelo/verde = terra/blindagem."},
 {id:"q23",top:"fdul",lv:1,q:"Que tecla usas para entrar num menu ou iniciar um teste?",o:["Exit","OK","▲","Interruptor O"],a:1,e:"OK confirma/entra/inicia; Exit sai ou cancela; ▲▼ navegam."},
 {id:"q24",top:"fdul",lv:2,q:"Qual o menu para ler um ramal (stub) ou um dispositivo isolado?",o:["Startup Loop A->B","Startup Stub A","Convert Line","Types summary"],a:1,e:"Startup Stub A — ramal ou dispositivo ligado em A."},
 {id:"q25",top:"fdul",lv:2,q:"O testador mostra E01 Short num dispositivo. Onde procuras?",o:["Antes do dispositivo","No troço de cabo a seguir ao dispositivo indicado","Na central","Nas baterias"],a:1,e:"O separador abriu no dispositivo indicado: o curto está no troço seguinte."},
 {id:"q26",top:"fdul",lv:2,q:"E10 >252 dev significa…",o:["Defeito à terra","Mais dispositivos do que o máximo de uma linha FDnet","Baterias fracas","Endereço duplicado"],a:1,e:"Máximo 252 dispositivos por linha FDnet/C-NET: dividir a linha."},
 {id:"q27",top:"fdul",lv:3,q:"Medição de terra: (+) mostra 35 kΩ «fault» e (−) 100 kΩ. Qual é o defeito real?",o:["100 kΩ no (−)","35 kΩ no (+)","Os dois","Nenhum"],a:1,e:"O valor mais baixo é o defeito real; ≈ 100 kΩ do outro lado vem do circuito interno."},
 {id:"q28",top:"fdul",lv:3,q:"E14 Diode (+) aparece normalmente porque…",o:["O cabo é comprido","Um fio foi ligado ao borne do indicador externo (AI) em vez do borne da linha","A bateria está fraca","Há 2 sub-ramais"],a:1,e:"O indicador externo tem díodo; ligar a linha ao borne AI cria um «díodo» na linha."},
 {id:"q29",top:"fdul",lv:3,q:"Dois sub-ramais seguidos sem dispositivo entre eles dão…",o:["E05","E11","E12","E17"],a:2,e:"E12 >2 TTap: só um sub-ramal entre dois dispositivos."},
 {id:"q30",top:"medir",lv:1,q:"Antes de um ensaio de isolamento a 500 V DC deves…",o:["Ligar todos os equipamentos","Desligar a eletrónica (fontes, drivers, módulos de bus)","Molhar o cabo","Nada"],a:1,e:"Os 500 V podem destruir eletrónica."},
 {id:"q31",top:"rtiebt",lv:1,q:"Queda de tensão máxima num circuito de iluminação alimentado pela rede pública de BT?",o:["1 %","3 %","5 %","8 %"],a:1,e:"3 % iluminação, 5 % outros usos."},
 {id:"q32",top:"rtiebt",lv:2,q:"Resistência de isolamento mínima num circuito de 230 V (ensaio a 500 V)?",o:["0,25 MΩ","0,5 MΩ","1 MΩ","10 MΩ"],a:1,e:"Até 500 V: ensaio a 500 V DC, ≥ 0,5 MΩ."},
 {id:"q33",top:"medir",lv:2,q:"Medes 120 Ω entre A e B de um RS-485 desligado. Conclusão?",o:["Está perfeito","Falta uma terminação","Há terminações a mais","Curto-circuito"],a:1,e:"Com as duas seriam 60 Ω."},
 {id:"q34",top:"sadi",lv:2,q:"Na verificação diária (NT 12), quem a faz?",o:["Entidade registada","Pessoa designada pelo responsável de segurança","Bombeiros","Fabricante"],a:1,e:"A diária e a trimestral podem ser feitas por pessoa designada; a anual por entidade registada."}
];

/* ---------- percursos por nível ---------- */
const TF_PATHS=[
 {id:"ini",t:"Iniciante",ic:"🌱",d:"Bases dos bus de campo, do SADI e das medições seguras.",steps:[
  {t:"O que é cada protocolo",to:"#/auto/prot",top:"knx"},{t:"Tema: endereço físico vs grupo (KNX)",to:"#/tema/t1",top:"knx"},{t:"Comunicação IP: sub-redes",to:"#/auto/ip",top:"ip"},
  {t:"SADI — visão geral",to:"#/sadi/geral",top:"sadi"},{t:"Ligação do laço (exercício)",to:"#/sadi/lig",top:"sadi"},{t:"Medições de referência",to:"#/diag/med",top:"medir"},
  {t:"FDUL221 — Módulo 1: conhecer o equipamento",to:"#/sadi/fdul?m=1",top:"fdul"},{t:"Teste do nível",to:"#/treino?lv=1",quiz:true}]},
 {id:"man",t:"Técnico de manutenção",ic:"🛠",d:"Manutenção SADI segundo a NT 12, leitura de LEDs, medições e relatórios.",steps:[
  {t:"Requisitos em Portugal",to:"#/sadi/reg",top:"sadi"},{t:"Intervenção real e manutenção (NT 12)",to:"#/sadi/real",top:"sadi"},{t:"FDUL221 — Módulo 2: preparar e executar",to:"#/sadi/fdul?m=2",top:"fdul"},
  {t:"Leitura de LEDs",to:"#/diag/led",top:"medir"},{t:"Medições",to:"#/diag/med",top:"medir"},{t:"Relatório de manutenção",to:"#/diag/rel",top:"sadi"},
  {t:"Avarias e alarmes",to:"#/sadi/av",top:"sadi"},{t:"Teste do nível",to:"#/treino?lv=2",quiz:true}]},
 {id:"adv",t:"Diagnóstico avançado",ic:"🔬",d:"Análise de falhas, FDUL221 em profundidade, gateways e integração BMS.",steps:[
  {t:"FDUL221 — Módulo 3: diagnosticar avarias",to:"#/sadi/fdul?m=3",top:"fdul"},{t:"FDUL221 — Módulo 4: simulador",to:"#/sadi/fdul?m=4",top:"fdul"},{t:"Análise de falhas (Modbus)",to:"#/diag/falhas?sys=mrtu",top:"modbus"},
  {t:"BACnet/IP e BBMD",to:"#/auto/ip",top:"bacnet"},{t:"Gateways e BMS",to:"#/auto/gw",top:"modbus"},{t:"Simulador de laço",to:"#/sadi/sim",top:"sadi"},
  {t:"Teste do nível",to:"#/treino?lv=3",quiz:true}]}
];

/* ---------- fichas de bolso (resumos para PDF) ---------- */
const TF_FICHAS=[
 {id:"f-knx",t:"KNX TP — bolso",a:"auto",s:"nr",ref:"knx",h:`<ul><li>Bus SELV ≈ 30 V DC (aparelhos até ≈ 21 V).</li><li>Cabo 2×2×0,8 mm (vermelho +, preto −).</li><li>64 aparelhos por segmento; 1000 m de cabo; 350 m fonte→aparelho; 700 m entre aparelhos.</li><li>Topologia livre (linha, árvore, estrela) — nunca em anel.</li><li>Endereço físico (área.linha.aparelho) ≠ endereço de grupo (principal/médio/sub).</li><li>Botão de programação: LED vermelho = modo de programação.</li></ul>`},
 {id:"f-485",t:"RS-485 / Modbus RTU — bolso",a:"auto",s:"rt",ref:"modbus",h:`<ul><li>Topologia em linha (daisy chain); derivações curtas.</li><li>Terminação 120 Ω só nas duas pontas → ≈ 60 Ω entre A e B (tudo desligado).</li><li>Um mestre; escravos 1–247; parâmetros série iguais em todos.</li><li>Blindagem contínua, à terra num só ponto.</li><li>Sem resposta: endereço, velocidade/paridade, A/B trocados, terminação.</li></ul>`},
 {id:"f-mbx",t:"Modbus — códigos de exceção",a:"diag",s:"nr",ref:"modbus",faults:["MB01","MB02","MB03","MB04","MB06","MB0A","MB0B"]},
 {id:"f-ip",t:"Rede IP e portas da automação",a:"auto",s:"nr",ports:true,h:`<ul><li>/24 = 255.255.255.0 → 254 endereços úteis.</li><li>Mesma sub-rede para falar diretamente; fora dela, router (gateway).</li><li>IP fixo ou reserva DHCP para equipamentos de campo.</li></ul>`},
 {id:"f-fdul",t:"FDUL221 — códigos de erro",a:"sadi",s:"of",ref:"fdulTM",faults:["E01","E02","E03","E04","E05","E06","E07","E08","E09","E10","E11","E12","E13","E14","E15","E16","E17"]},
 {id:"f-fdulop",t:"FDUL221 — operação passo a passo",a:"sadi",s:"of",ref:"fdulTM",h:`<ol><li><b>Desligar a linha da central</b> (nunca as duas ligadas em simultâneo).</li><li>Ligar: laço → início em <b>A</b>, fim em <b>B</b>; ramal/dispositivo → <b>A</b>. Respeitar a polaridade (+ vermelho, − preto).</li><li>Blindagem → borne <b>amarelo/verde</b>.</li><li>Ligar (interruptor <b>I</b>). Confirmar «Mode: FDnet».</li><li>«Startup Loop A->B» (laço) ou «Startup Stub A» (ramal) → <b>OK</b>.</li><li>Ver a topologia ([T001]…); «Locate devices» → «All ON» para encontrar os dispositivos.</li><li>Erros → tabela E01–E17; «Measurements» / «Measure Device».</li><li>Guardar a topologia; desligar (<b>O</b>); voltar a ligar a linha à central e confirmar estado normal.</li></ol>`},
 {id:"f-nt12",t:"SADI — manutenção (NT 12)",a:"sadi",s:"nr",ref:"nt12",h:`<p><b>Diária</b> (pessoa designada pelo RS): central em estado normal; alarmes do dia anterior tratados; sistema reposto após desativações, testes ou silenciamentos; desvios no livro de ocorrências.</p><p><b>Trimestral</b> (pessoa designada): fonte de socorro; impressora; teste de sinalizadores (EN 54-2); ≥ 1 detetor ou botoneira por zona; 0,5 m livres à volta dos detetores; botoneiras desobstruídas; supervisão de avarias; retentores de portas; transmissão aos bombeiros só onde permitido; alterações do edifício; evitar funções deletérias (ex.: extinção).</p><p><b>Anual</b> (entidade registada na ANEPC): o anterior + cada detetor segundo o fabricante (até 25 % por trimestral, todos no ano); cabos e equipamentos; baterias; anomalias nos registos de segurança; relatório assinado pelo técnico responsável.</p><p><b>Antes de testar</b>: avisar a central recetora; avisar ocupantes; indicar transmissão inibida.</p>`},
 {id:"f-sadi",t:"SADI — valores de projeto (NT 12)",a:"sadi",s:"nr",ref:"nt12",h:`<ul><li>Zona ≤ 1600 m².</li><li>Uma avaria não pode afetar mais de 32 dispositivos.</li><li>Botoneiras a ≈ 1,2 m; percurso até uma ≤ 30 m.</li><li>Sirenes: ≥ 65 dB(A) (ou 5 dB acima do ruído); 75 dB(A) em quartos; ≤ 120 dB(A).</li><li>Painel da CDI a 1,4–1,8 m.</li><li>Fonte de socorro: 72 h + 30 min em alarme.</li><li>Cabos com resistência ao fogo de 30 min quando exigido.</li></ul>`},
 {id:"f-med",t:"Medições de referência",a:"diag",s:"rt",meas:true},
 {id:"f-rtiebt",t:"RTIEBT — bolso",a:"diag",s:"nr",ref:"rtiebt",h:`<ul><li>Queda de tensão: 3 % iluminação, 5 % outros usos.</li><li>Iluminação 1,5 mm² / 10 A; tomadas 2,5 mm² / 16 A.</li><li>Diferencial: R × IΔn ≤ 50 V.</li><li>Isolamento: ≥ 0,5 MΩ a 500 V DC (até 500 V).</li><li>Cores: azul = neutro; verde/amarelo = proteção.</li></ul>`}
];

/* ---------- relatórios: modelos ---------- */
const TF_REPTPL=[
 {id:"sadi3",t:"SADI — verificação trimestral (NT 12)",s:"nr",chk:["Central em estado normal (sem avarias/desativações por resolver)","Fonte de socorro funciona sem rede e cumpre a autonomia","Papel/tinta da impressora","Teste de sinalizadores da central","≥ 1 detetor ou botoneira por zona: sinal correto, alarme e funções auxiliares","0,5 m livres à volta e por baixo dos detetores","Botoneiras desobstruídas","Supervisão de avarias funciona","Retentores de portas comandados pela CDI","Transmissão a bombeiros/central recetora só onde permitido","Alterações no edifício que afetem a localização dos dispositivos","Funções deletérias (ex.: extinção) protegidas durante o teste","Sistema reposto ao estado normal"]},
 {id:"sadi12",t:"SADI — manutenção anual (NT 12)",s:"nr",chk:["Verificações diárias e trimestrais","Ensaio de todos os detetores segundo o fabricante","Inspeção visual de cabos e equipamentos","Alterações estruturais ou de ocupação","0,5 m livres e botoneiras operacionais","Ensaio das baterias / substituição no prazo do fabricante","Anomalias e ações registadas nos registos de segurança","Sistema reposto ao estado normal","Relatório assinado pelo técnico responsável da entidade registada"]},
 {id:"fdnet",t:"Linha FDnet — ensaio com FDUL221",s:"of",chk:["Linha desligada da central antes de ligar o testador","Ligações A/B e blindagem corretas","Mode: FDnet confirmado","Topologia lida sem erros","Número de dispositivos confere com o projeto","Medição de terra OK (+) e (−)","Topologia guardada","Linha religada à central e estado normal confirmado"]},
 {id:"bus",t:"Bus de campo (KNX/Modbus/BACnet/DALI) — diagnóstico",s:"rt",chk:["Alimentação do bus medida","Terminação/polarização verificadas (RS-485)","Endereços e parâmetros confirmados","Comunicação com todos os dispositivos","Pontos integrados no BMS confirmados","Configuração guardada (cópia de segurança)"]},
 {id:"livre",t:"Intervenção corretiva (livre)",s:"rt",chk:[]}
];
