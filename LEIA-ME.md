# ObraFlow · gestão de obra (app instalável)

App da obra para computador, Android e iPhone: plantas dos pisos, equipamentos marcados na planta, leitura do ID/MAC pela foto da etiqueta, etapas e checklists, anomalias, coordenação, relatórios e auto de entrega.

- **Funciona sem rede.** O que fazes fica guardado no aparelho e é enviado sozinho quando a ligação volta.
- **Lê as etiquetas no próprio telemóvel**, sem custos (texto e códigos DataMatrix/QR).
- **Equipa com contas próprias** (email e palavra-passe) e papéis: Técnico, Fiscalização/cliente, Coordenação.
- **Gratuita:** a app fica alojada no GitHub Pages e os dados no Supabase (plano gratuito).

Tempo para pôr a funcionar: cerca de 20 minutos, uma única vez.

---

## O que está nesta pasta

| Ficheiro | Para quê |
|---|---|
| `index.html`, `app.js`, `styles.css` | A app |
| `config.js` | **O único ficheiro que tens de editar** (passo 3) |
| `sw.js`, `manifest.webmanifest`, `icons/` | Instalar no ecrã inicial e abrir sem rede |
| `vendor/` | Leitor de PDF e de .zip (ficam no teu site, não dependem de terceiros) |
| `supabase/schema.sql` | Cria a base de dados (passo 2) |
| `supabase/atualizacao-2-acessos-notificacoes.sql` | Hierarquia de acesso e notificações por email (correr depois do passo 2) |

---

## Passo 1 · Criar a conta no Supabase (base de dados)

1. Abre **supabase.com** e carrega em **Start your project**. Entra com a conta Google ou com email.
2. Carrega em **New project**:
   - **Name:** `planta-obra`
   - **Database Password:** carrega em *Generate a password* e guarda-a num sítio seguro (não vais precisar dela no dia a dia).
   - **Region:** escolhe **West EU (Ireland)** ou **Central EU (Frankfurt)** (mais perto de Portugal).
   - Plano **Free**.
3. Carrega em **Create new project** e espera 1 a 2 minutos até ficar pronto.

## Passo 2 · Criar as tabelas

1. No menu da esquerda abre **SQL Editor** → **New query**.
2. Abre o ficheiro `supabase/schema.sql` desta pasta num editor de texto (Bloco de Notas), copia **tudo** e cola no SQL Editor.
3. Carrega em **Run**. Deve aparecer *Success. No rows returned*.

Isto cria a equipa, os dados da obra, o espaço para as fotos e plantas, e as regras de segurança (só pessoas aprovadas veem e alteram os dados).

## Passo 3 · Ligar a app ao Supabase

1. No Supabase abre **Project Settings** (roda dentada) → **API** (em alguns ecrãs aparece como **Data API** e **API Keys**).
2. Copia o **Project URL** (ex.: `https://abcdefghijkl.supabase.co`).
3. Copia a chave **anon public** (um texto longo que começa por `eyJ…`, ou `sb_publishable_…` nos projetos mais recentes).
4. Abre `config.js` num editor de texto e cola os dois valores entre as aspas:

```js
window.OBRA_CONFIG = {
  SUPABASE_URL: "https://abcdefghijkl.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi..."
};
```

5. Guarda o ficheiro.

> A chave *anon public* foi feita para estar no site: os dados ficam protegidos pelas regras do passo 2. **Nunca** coloques aqui a chave *service_role* / *secret*.

## Passo 4 · Desligar a confirmação por email (recomendado)

O plano gratuito envia poucos emails por hora. Para a equipa conseguir criar contas sem esperar por emails:

1. No Supabase abre **Authentication** → **Sign In / Providers** (ou **Providers**) → **Email**.
2. Desliga **Confirm email** e guarda.

A segurança mantém-se: ninguém vê nada até a coordenação aprovar a conta na app.

## Passo 5 · Pôr a app online no GitHub Pages

1. Abre **github.com** e cria uma conta (**Sign up**) se ainda não tiveres.
2. Carrega em **+** (canto superior direito) → **New repository**:
   - **Repository name:** `planta-obra`
   - **Public** (o GitHub Pages gratuito exige repositório público; só o código fica público, os dados da obra ficam no Supabase, protegidos).
   - Carrega em **Create repository**.
3. Na página do repositório carrega em **uploading an existing file** (ou **Add file** → **Upload files**).
4. Arrasta **o conteúdo desta pasta** (os ficheiros e as pastas `icons`, `vendor` e `supabase`, não a pasta de fora) para a janela. Espera que acabe e carrega em **Commit changes**.
5. Abre **Settings** → **Pages**. Em **Branch** escolhe `main` e `/ (root)` e carrega em **Save**.
6. Espera 1 a 2 minutos e recarrega a página: aparece o endereço da app, do género
   `https://o-teu-nome.github.io/planta-obra/`

## Passo 6 · Dizer ao Supabase qual é o endereço da app

1. No Supabase abre **Authentication** → **URL Configuration**.
2. Em **Site URL** cola o endereço do passo 5 e guarda. Em **Redirect URLs** adiciona o mesmo endereço.

(Serve para o link de "Esqueci-me da palavra-passe" abrir a tua app.)

## Passo 7 · Primeira entrada e trazer os dados atuais

1. Abre o endereço da app (vais ver o ecrã de entrada do **ObraFlow**) e escolhe **Criar conta nova**. **A primeira conta criada fica como Coordenação** — cria a tua primeiro.
2. Na Planta de Obra do Claude (a página que já usas): separador **Coordenação** → **Exportar para a app própria** → **Exportar tudo (.zip)**. Guarda o ficheiro.
3. Na app nova: **Coordenação** → **Dados da obra** → **Importar .zip…** e escolhe esse ficheiro.
   Os pisos, plantas, equipamentos, fotos, anomalias e histórico passam todos. Os nomes de quem fez cada coisa ficam no histórico. O envio para o servidor continua em segundo plano: o indicador no topo mostra *N por enviar* até chegar a *Sincronizado*. Mantém a app aberta até lá.

## Passo 8 · Juntar a equipa

1. Envia o endereço da app aos técnicos e à fiscalização. Cada pessoa escolhe **Criar conta nova**.
2. Aparece-te um aviso *"N pessoas à espera de aprovação"*. Carrega em **Ver equipa** e escolhe o papel de cada uma:
   - **Técnico** — marca equipamentos, tira fotos, lê etiquetas, faz checklists e regista anomalias.
   - **Fiscalização / cliente** — vê tudo e pode marcar equipamentos como **Aceite**.
   - **Coordenação** — valida, atribui pisos e equipamentos, gere a equipa, importa e exporta.
   - **Sem acesso** — bloqueia a conta.

---

## Página inicial, pastas e plantas

- Ao abrir a app aparece a **página de entrada** com o projeto guardado neste aparelho e o acesso por email.
- Depois de entrar, o separador **Início** mostra o projeto (progresso, os teus equipamentos por fazer, anomalias) e as **pastas** com as plantas.
- **+ Nova pasta** cria uma pasta (ex.: *Piso 3*, *AVAC*, *Incêndio*). **+ Planta** dentro da pasta carrega PDFs ou imagens diretamente para essa pasta.
- Para mudar uma planta de pasta, usa a lista por baixo do cartão da planta, ou **Pisos…** no separador Obra.

## Atualização 2: hierarquia de acesso e notificações por email

Corre **uma vez** no Supabase: **SQL Editor → New query** → cola todo o ficheiro `supabase/atualizacao-2-acessos-notificacoes.sql` → **Run** (se aparecer o aviso de operações destrutivas, confirma). Não apaga dados. A primeira pessoa da coordenação passa a **Administrador**.

**Papéis (do mais alto para o mais baixo)**

| Papel | O que pode fazer |
|---|---|
| Administrador | Tudo, incluindo nomear coordenação e administradores, configurar emails, leitura com IA e importar dados |
| Coordenação | Validar, atribuir pisos e equipamentos, fecho de piso, aprovar técnicos, fiscalização e só leitura |
| Técnico | Marcar equipamentos, fotos, ler etiquetas, checklists, anomalias, marcar Testado |
| Fiscalização / cliente | O mesmo que o técnico e ainda marcar **Aceite** |
| Só leitura | Ver tudo e descarregar relatórios, sem alterar nada |

As regras são aplicadas no servidor: mesmo que alguém mexa na app, não consegue fazer mais do que o seu papel permite. Tem de existir sempre pelo menos um Administrador.

**Notificações por email (gratuito, Brevo: 300 emails/dia)**
1. Cria conta em **brevo.com**.
2. Em **Senders, domains & dedicated IPs → Senders** junta o email remetente (pode ser o teu Gmail) e confirma-o no email que recebes.
3. Em **SMTP & API → API keys** gera uma chave (`xkeysib-…`).
4. Na app (Administrador): **Coordenação → Envio de emails** → cola a chave e o remetente → **Guardar** → **Enviar email de teste**.
5. Cada pessoa liga as suas notificações em **Início → Notificações por email** e escolhe: na hora (de 5 em 5 minutos, tudo num só email) ou resumo diário (~18h), e que tipos de aviso quer.

Avisos enviados: equipamento ou piso atribuído a ti; anomalia nova (coordenação e responsável) e anomalia resolvida (quem a registou); Testado → coordenação "para validar"; Validado → fiscalização "para aceitar"; Aceite → coordenação; plantas novas ou trocadas (opcional).

## Atualização 3: vários projetos (obras) com acesso por pessoa

Ao entrar com o email aparece primeiro a lista **Os meus projetos** — só as obras a que essa pessoa tem acesso. Ao escolher uma obra aparecem as **Plantas e pastas** dessa obra.

**Instalar (uma vez):** no Supabase → **SQL Editor** → **New query** → cola o conteúdo de `supabase/atualizacao-3-projetos.sql` → **Run**. Tem de ser depois da atualização 2. Deve aparecer "Atualização 3 instalada: 1 projeto(s)". Os dados que já existem ficam no primeiro projeto, com acesso para todas as contas aprovadas.

- **Novo projeto** (Administrador e Coordenação): nome da obra, cliente, morada e estado. Quem cria fica logo com acesso.
- **Acessos** (no cartão do projeto): escolhe quem pode ver e trabalhar nessa obra. O Administrador vê sempre todas.
- **Editar**: muda nome, cliente, morada ou estado (Em curso, Em pausa, Concluído). O Administrador pode apagar um projeto.
- **Grelha ou Lista**: botões junto à pesquisa nos Projetos, Plantas e pastas, Equipamentos (cartões com a foto da etiqueta), Anomalias e Documentos. A escolha fica lembrada em cada aparelho.
- **Plantas e pastas**: **Nova pasta** e **Carregar ficheiro** (PDF ou imagens, vários de uma vez; também se podem arrastar para a página). Dentro de uma pasta, o que se carrega fica nessa pasta. Cada planta tem a caixa "Mover para a pasta".
- Para trocar de obra: no menu lateral toca no nome do projeto (**Trocar**).
- Sem a atualização 3 a app continua a funcionar com um só projeto.

## Pessoas, papéis por obra e convites (versão 25)

Corre (de novo, se já tinhas corrido) `supabase/atualizacao-3-projetos.sql` no Supabase — acrescenta os papéis por obra e os convites. Pode correr-se várias vezes.

- **Os meus projetos** mostra só as obras e o teu papel em cada uma. As opções de gestão estão dentro da obra.
- **Pessoas** (menu da obra): quem está nesta obra e o papel de cada um:
  - **Administrador** — gere a obra, as definições e as pessoas;
  - **Membro** — trabalha: marca, fotografa, lê etiquetas, faz ensaios;
  - **Seguidor** — só vê e recebe avisos.
  O Administrador muda o papel, retira pessoas ou adiciona contas que já existam. Em baixo continuam as **Contas da plataforma** (aprovar contas novas) e o trabalho atribuído.
- **Convidar para esta obra** (na página Pessoas): escolhe o papel e
  - **Criar QR code / link** — serve para várias pessoas durante 30 dias: mostra o QR code (para apontar a câmara do telemóvel), o link para copiar ou partilhar e o QR para descarregar;
  - **Enviar por email** — o convite só funciona para esse email e uma vez; abre o teu programa de email com a mensagem pronta.
  Quem abre o convite vê na página de entrada para que obra é, cria conta (ou entra) e fica logo com acesso — não precisa de aprovação. Em "Convites ativos" podes voltar a mostrar ou anular um convite.
- **Definições da obra** (menu da obra): nome, n.º da obra/contrato, cliente, morada, fiscalização, empreiteiro, projetista, diretor de obra, datas de início e de conclusão, estado e notas. Só o Administrador da obra altera.

## Emails quando identificas alguém (versão 26)

Corre no Supabase `supabase/atualizacao-4-mencoes.sql` (depois das atualizações 2 e 3). Para os emails saírem, configura o envio (Brevo, gratuito) em **Definições da obra → Envio de emails**.

- **Atribuir** um equipamento (campo Responsável) ou uma pendência a alguém envia-lhe um email — também quando se muda o responsável.
- **Identificar com @**: numa nota de equipamento, numa pendência ou no diário escreve **@** e escolhe a pessoa da lista (só aparecem as pessoas desta obra). Ao guardar, essa pessoa recebe um email com o texto e o link para a obra. A mesma pessoa não é avisada duas vezes pela mesma nota.
- As notificações ficam **ligadas por defeito**; cada pessoa escolhe o que recebe em Definições da obra → Notificações por email. Atribuições e menções saem em cerca de 1 minuto, mesmo para quem escolheu o resumo diário.

## Trocar a planta de um piso sem perder os IDs

**Obra → Pisos… → Trocar planta (manter os IDs no sítio)** e escolhe o PDF ou imagem novo:
- **Mesmo enquadramento**: revisão do desenho com a mesma folha e escala; os IDs ficam exatamente na mesma posição.
- **Alinhar com 2 pontos**: se a planta nova foi recortada, mudou de escala ou rodou. Tocas em 2 pontos na planta atual (ex.: cantos de pilares afastados), depois nos mesmos 2 pontos na planta nova, confirmas a pré-visualização e carregas em **Aplicar**.

A planta anterior fica guardada: **Pisos… → Repor planta anterior** volta atrás (as posições também).

## Estrutura da plataforma (versão 2)

- **Barra superior**: **pesquisa global** (IDs, MAC, equipamentos, plantas, documentos, anomalias; tecla **/**); **sino** com a atividade recente da equipa; estado da sincronização; a tua conta.
- **Menu lateral**: Visão geral · Plantas e equipamentos · Equipamentos · Lista de IDs · Anomalias e pendências · Diário de obra · Relatórios · Documentos · Equipa · Configurações. No telemóvel abre no botão ☰ e há uma barra de navegação em baixo.
- **Visão geral**: indicadores (equipamentos, com ID, pendentes de ID, anomalias, fotos), progresso por etapa, atividade recente, pastas e plantas.
- **Plantas e equipamentos**: lista de plantas com miniatura e progresso · planta · ficha do equipamento com separadores **Detalhes / Ensaio / Anomalias / Documentos / Histórico** e botões **Anterior / Seguinte**; barra de estado com contagens e zoom; menu **Ações** (importar fotos, descarregar planta, sobrepor, Fieldwire, pisos).
- **Equipamentos**: tabela com filtros (planta, sistema, etapa, responsável, sem ID, com anomalia, em atraso, por colocar) e exportação CSV.
- **Lista de IDs**: todos os IDs e MAC, repetidos destacados, copiar para Excel e CSV.
- **Anomalias e pendências** (punch list): prioridade, responsável, prazo e estado (aberta, em curso, resolvida); pendências gerais sem equipamento.
- **Diário de obra**: tempo, pessoas e equipas em obra, trabalhos, ocorrências, visitas e fotos, com a atividade da app preenchida automaticamente; PDF assinável.
- **Documentos**: biblioteca da obra por categorias (projeto, fichas técnicas, certificados, atas, fotografias); documentos ligados a equipamentos ou a todos os equipamentos de um tipo.
- **Configurações**: dados do projeto, notificações por email, envio de emails, leitura com IA, importar/cópia de segurança e preparar para usar sem rede.

## Ecrã da planta (modo foco) — versão 15+

Ao abrir uma planta vê-se só o essencial: a planta, os botões **Navegar / Marcar** e o zoom. O resto abre-se com botões e a app lembra-se da tua escolha neste aparelho:
- **☰** (canto superior esquerdo) abre o menu (Visão geral, Equipamentos, Anomalias, Configurações…);
- **Plantas** abre a lista de plantas (no telemóvel escolhe-se o piso na caixa do nome);
- **Lista** abre a lista de equipamentos e o "Próximo equipamento" (o número amarelo é o que falta fazer);
- **⋯ Ações**: Novo piso, Assinalar, Importar fotos, Descarregar planta, Sobrepor, Fieldwire, Pisos, Legenda das cores e Resumo do piso;
- **?** junto ao zoom mostra a legenda das cores.
Ao tocar num equipamento, a ficha abre-se ao lado (ou por baixo, no telemóvel).

## Assinalar no desenho

No separador **Obra**, o botão **Assinalar** abre as ferramentas de marcação:
- **Caneta**, **Seta**, **Linha**, **Retângulo**, **Elipse**, **Nuvem de revisão** e **Texto**;
- 6 cores, 3 espessuras e a opção **Preencher**;
- **Selecionar**: toca numa marcação para lhe juntar uma nota (aparece como etiqueta no desenho), mudar a cor ou apagar;
- **Desfazer** (ou Ctrl+Z) e **Mostrar marcações** para esconder e voltar a mostrar.

As marcações são guardadas e sincronizadas com a equipa, entram na **planta descarregada** (opção *Marcações: Incluir*) e no **auto de entrega**, e acompanham a planta quando a trocas com 2 pontos. Quem as criou ou a coordenação podem apagá-las; a conta *Só leitura* só as vê.

## Regra das etapas

Qualquer equipamento com **ID ou MAC registado** conta automaticamente como **Instalado e Endereçado** (lido da foto, escrito à mão, escolhido nas leituras ou importado). Os equipamentos que já tinham ID passam a Endereçado na primeira vez que alguém com permissão de escrita abre a app. Para voltar a uma etapa anterior é preciso apagar o ID.

## Instalar no aparelho

- **Android (Chrome):** abre o endereço → menu **⋮** → **Instalar app** (ou *Adicionar ao ecrã principal*).
- **iPhone / iPad (Safari):** abre o endereço → botão **Partilhar** → **Adicionar ao ecrã principal**.
- **Computador (Chrome ou Edge):** abre o endereço → ícone de instalar na barra de endereço (ou menu → *Instalar ObraFlow*).

A app abre em ecrã inteiro, como as outras apps.

## Trabalhar sem rede

- Tudo o que abres fica guardado no aparelho. Antes de ir para uma zona sem rede, abre **Coordenação** → **Usar sem rede** → **Preparar para usar sem rede**: guarda as plantas e fotos do piso e o leitor de etiquetas.
- Sem rede podes marcar, fotografar, ler etiquetas, mudar etapas e registar anomalias. O indicador no topo mostra *Sem rede · N por enviar*.
- Quando a rede volta, envia tudo sozinho. Não saias da conta (botão **Sair**) com alterações por enviar.
- A primeira entrada num aparelho novo precisa de rede.

## Ler etiquetas

Na ficha do equipamento: **Tirar foto** (ou **Carregar**). A app lê o texto e os códigos DataMatrix/QR e preenche o **ID** (ou o **MAC**, se não houver ID). Se não tiver a certeza, mostra as leituras possíveis para escolheres com um toque. Dicas: foto de perto, direita, com boa luz e sem reflexos. Na primeira leitura com rede a app descarrega o leitor (alguns MB); a partir daí funciona sem rede.

## Leitura das etiquetas no aparelho (como funciona)

0. **Foto principal em qualidade máxima**: a leitura usa a foto original tirada pela câmara (sem redução), começando pela mais recente; só lê fotos anteriores se a principal não chegar. O original fica guardado neste aparelho (as últimas 40 fotos) para voltar a ler; para a equipa vai uma cópia mais leve (2048 px), já com melhor qualidade do que antes.
1. Leitura rápida da foto reduzida, em qualquer orientação (direita, de lado, de pernas para o ar), normal e pelo canal verde (placas verdes e fundos coloridos), com 2 leitores em paralelo quando o telemóvel aguenta.
2. Onde aparece "ID" ou um código, a app recorta essa linha em alta resolução e lê-a várias vezes para confirmar.
3. **Validação automática**: o código é comparado com o padrão dos IDs da obra (ex.: 6 caracteres hexadecimais) e o melhor fica gravado sozinho. As outras leituras ficam como botões para corrigir com um toque; só se nada for lido é que a app pede para escrever o ID (e põe o cursor no campo).

## Pasta Segurança — protocolos SADI (versão 39)

Em *Técnico → Consultar → Segurança (SADI)* (ou no cartão SEG-01):
- **SADI — visão geral:** componentes (EN 54), configurações do RT-SCIE, zonamento (≤ 1 600 m², um piso), regra dos 32 dispositivos e isoladores, botoneiras (≤ 30 m, ≈ 1,2 m), sirenes (65/75/120 dB(A)), central (visor 1,4–1,8 m, 72 h + 30 min), cabos (30 min), colocação de detetores e manutenção — segundo a Nota Técnica 12 da ANEPC.
- **Protocolos SADI:** convencional, endereçável em laço, Apollo XP95/Discovery e Soteria/CoreProtocol, Hochiki ESP, Siemens FDnet, Bosch LSN, Notifier/Honeywell e integração/transmissão de alerta — com características, exemplo, demonstração, vantagens/desvantagens, erros frequentes e «Ler mais».
- **Ligação do laço (versão 40):** exemplo completo de um laço classe A — central (saída/retorno/blindagem), isoladores, detetores (com LED remoto num teto falso), botoneira, sirenes, módulo de entrada (fluxostato + fim de linha) e módulo de saída (retentor de porta corta-fogo com fonte auxiliar). Toca em cada elemento para ver os bornes em detalhe, como ligar e os erros frequentes; regras de ligação do laço e lista de troços de cabo para etiquetar em obra.
- **Exemplo Siemens (versão 41):** laço C-NET/FDnet (Cerberus PRO / Sinteso) com detetores FD720 em bases DB720 (bornes 1b +IN/OUT, 6 −IN, 5 −OUT, 1a indicador externo), botoneira FDM221 (blindagem no borne auxiliar da caixa), módulo FDCIO221 (entrada vigiada do fluxostato + saída relé para o retentor da porta corta-fogo), sirenes com sinalizador FDS226, base sirene-sinalizador FDSB226 e separador de linha FDCL221 — com o detalhe de bornes, ligação e erros de cada um. Confirmar a numeração de bornes do FDM221/FDCIO221 no esquema da ficha de montagem.
- **Imagens dos equipamentos (versão 42):** nos esquemas de ligação cada equipamento aparece com uma ilustração realista (central, detetor, botoneira, sirene-sinalizador, base com sirene, módulo, isolador). No detalhe de cada um, **«📷 Usar foto real»** permite tirar/carregar a foto do equipamento instalado na obra — passa a aparecer no esquema (guardada na obra e no aparelho; «Voltar à ilustração» repõe).
- **Simulador de laço:** 12 dispositivos com isoladores e laço classe A: provoca curtos-circuitos e cortes (com/sem isoladores, classe A/B) e alarmes, e vê na central o que fica fora de serviço.
- O assistente responde a perguntas como «SADI isoladores», «sirenes quantos dB», «autonomia da central».

## Bancada de ligações — simulador quase real (versão 38)

Em *Técnico → Consultar → Bancada de ligações* (ou no cartão LAB-06): aparelhos desenhados como os reais (quadro com disjuntor, interruptor, comutadores, inversor, tomada schuko, sensor, fonte/botão/atuador KNX e luminária) com os seus bornes.
- **Ligar é simples:** toca num borne e depois noutro — o fio aparece com a **cor automática** pela função (castanho fase, azul neutro, verde/amarelo terra, preto/cinzento retornos, vermelho/preto bus KNX), ou escolhe a cor.
- **Modo guiado:** os dois bornes do próximo fio piscam e a instrução aparece por baixo. «Mostrar solução» faz a montagem fio a fio.
- **Ligar disjuntor e testar:** a corrente circula nos fios com tensão, a lâmpada acende e os interruptores funcionam no próprio aparelho. Erros reais são detetados: curto-circuito (o disjuntor dispara), defeito à terra (o DR dispara), interruptor no neutro, fase/neutro trocados, cores erradas, fios a mais, polaridade do bus KNX, fonte KNX sem alimentação.
- 6 exercícios: interruptor simples, comutador de escada, inversor, tomada com terra, sensor de movimento e KNX botão → atuador.

## Apresentações interativas (versões 36–37)

- **Esquemas interativos** (Técnico → Consultar → Esquemas): toca nos comutadores, no inversor, no interruptor ou nos disjuntores e vê a lâmpada acender/apagar e a corrente a circular nos condutores. Botões para simular avarias (defeito à terra → DR dispara; sobrecarga; curto-circuito), passar alguém à frente do sensor, dia/noite e **demonstração automática**.
- **Simuladores de protocolos** (separador «▶ Simular» em cada protocolo): envia telegramas e vê o pacote a percorrer o bus e a resposta de cada equipamento, com um **monitor do bus** (no Modbus RTU com a trama real em hexadecimal e CRC). Em «Simular avarias» ativas os erros mais comuns (A/B trocados, sem terminação, polaridade, endereços duplicados, fonte DALI em falta, BBMD…) e vês o sintoma e a solução.

## Protocolos em detalhe (versão 35)

Em *Técnico → Consultar → Automação → Tabela de protocolos*, cada protocolo (KNX, DALI, Modbus RTU/TCP, BACnet, DMX512, M-Bus) tem separadores **Características**, **Exemplo** (caso real de obra), **Demonstração** (esquema animado + passos do funcionamento), **Vantagens / desvantagens** e **Erros frequentes** (problema → solução), e o botão **Ler mais** para o site oficial do protocolo (precisa de rede). O assistente também responde a «KNX erros frequentes», «DALI vantagens» ou «exemplo Modbus».

## Versão 34

- **Leitura do ecrã partilhado:** a barra de estado passou a ser uma pequena cápsula em baixo (toca nela para ver o texto; botões ↻ ler agora, ⛶ zona, ■ parar). Com a leitura ativa, **marcar um equipamento novo já não abre as opções de foto**: o ecrã é lido logo para esse equipamento. A escolha da zona só abre sozinha quando o ID não é encontrado no ecrã.
- **Técnico com visual de bancada técnica:** cabeçalho tipo planta/oscilógrafo, cartões com símbolos e cores por área, mostradores analógicos nos resultados (ΔU, In/IZ, corrente) e o corte do tubo com os condutores desenhados à escala.

## Selecionar todos e leitura contínua do ecrã (versão 32)

- **Selecionar vários:** aparece uma barra no topo da planta com **Selecionar todos**, *Só os filtrados*, *Sem ID*, *Limpar* e *Terminar* (também Ctrl+A).
- **Captura de ecrã → «Manter este ecrã e ler automaticamente»:** escolhe a janela (ex.: Fieldwire), arrasta a zona onde aparece o ID e ativa a opção. A partir daí, cada vez que abres uma etiqueta nova nessa janela, a app lê sozinha e regista o ID no equipamento selecionado (ou no próximo sem ID), e passa ao seguinte. IDs que já estão registados são ignorados. No canto aparece o estado com *Ler agora*, *Zona* (mudar a zona) e *Parar*. Funciona no Chrome/Edge do computador; mantém a janela do ObraFlow visível (ao lado), porque o navegador abranda as janelas escondidas.

## Etiquetas tortas ou ao contrário (versão 31)

A leitura passa a experimentar também a foto inclinada (±7°, e ±14° na leitura detalhada) além das 4 orientações, e corrige confusões típicas do OCR em códigos soltos (G→6, S→5, Z→2, Q→0 — ex.: «4EBGS6» → 4EB656).

## Leitura em segundo plano e "Leitura inconclusiva" (versão 18)

- Depois de tirar a foto podes **fechar a ficha**: a leitura continua em segundo plano (aparece "A ler etiquetas" no topo). Fotos que ficaram por ler são encontradas e lidas sozinhas.
- Se a 1.ª leitura não tiver certeza, a app lê **de novo com mais detalhe** (todas as fotos e orientações, em alta resolução).
- Se mesmo assim não houver certeza (nada legível, duas leituras possíveis, ou ID que não consta da lista), o equipamento fica **Inconclusivo**: marcador com **?** laranja, filtro **Inconclusivos** na lista da planta, e as leituras possíveis aparecem para escolher com um toque.

## Verificar com a lista de IDs (PDF, Excel ou CSV)

Em **Lista de IDs** → **Carregar lista de IDs**: escolhe o PDF (ou Excel/CSV) com todos os IDs da instalação. A app mostra quantos IDs encontrou e alguns exemplos antes de usar a lista.
- **Batem certo**: IDs lidos que constam da lista.
- **Não constam da lista**: IDs lidos que não existem na lista, com sugestão "Corrigir para…" (ID da lista com 1 carácter de diferença e ainda livre).
- **Por encontrar**: IDs da lista que ainda não têm equipamento (com a descrição da linha do PDF).
- **Inconclusivos**: fotos sem ID certo, com as leituras possíveis (✓ = consta da lista) e **Ler de novo todos os inconclusivos**.
- A leitura passa a usar a lista: confirma IDs, corrige erros de 1 carácter e resolve sozinha os inconclusivos quando só uma leitura bate certo.
- **Exportar comparação** gera um CSV para Excel. PDF digitalizado (só imagem) também funciona, mas é mais lento; se possível usa o PDF original ou Excel.

## Pasta de relatórios externos — comparar ID e texto (versão 49)

Em **Lista de IDs**, por baixo da lista de IDs do projeto, está a **Pasta de relatórios externos**. Serve para verificar relatórios feitos fora da obra (fabricante, comissionamento, outra equipa).

- **Carregar relatórios**: escolhe um ou vários ficheiros de uma vez (PDF, Excel, CSV ou texto). Cada linha com um ID fica guardada com o texto que a acompanha. Os ficheiros ficam na pasta para toda a equipa.
- Cada relatório é comparado com a obra **pelo ID e pelo texto**. O texto é comparado com a referência, o tipo, a planta, as notas, a marca e o modelo do equipamento:
  - **Certos**: o ID existe na obra e o texto bate certo.
  - **Texto diferente**: o ID existe, mas o texto não corresponde. Mostra os dois lado a lado e permite **Copiar texto para a ficha** (junta-o às notas).
  - **ID trocado**: o texto refere outro equipamento (por exemplo, "DO-1.05") com um ID diferente. Tem o botão **Pôr ID em…**, que corrige e fica registado no histórico.
  - **Não encontrados**: o ID do relatório não existe na obra. Se houver um ID parecido (1 carácter de diferença), sugere a correção.
  - **Só na obra**: os IDs registados na obra que o relatório não tem.
- Os IDs que aparecem em várias linhas do relatório ficam marcados como **repetido ×N**.
- **Exportar comparação**: gera um CSV com o estado de cada linha. **Remover da pasta**: disponível para o coordenador ou para quem carregou o relatório.

## Pesquisar IDs nas plantas e PDF pesquisável (versão 20)

- **Na app:** a pesquisa do topo procura também no **texto das plantas em PDF** (ex.: IDs ou referências escritos no desenho do projeto). O resultado aparece em "Texto nas plantas (PDF)"; ao tocar, a planta abre com o texto destacado a laranja. Funciona com PDF de texto (vetorial, exportado do CAD); uma planta digitalizada ou carregada como imagem não tem texto para procurar.
- **PDF limpo com a planta original (versão 22):** quando a planta foi carregada em PDF, o PDF descarregado usa o **desenho original em vetor** — mesmo tamanho de folha, sem faixas nem margens extra, sem perda de qualidade — e por cima os pinos, ligações e etiquetas também em vetor. O texto do desenho e os IDs procuram-se com Ctrl+F. Escolhe o "Tamanho do texto das etiquetas" no diálogo. Plantas carregadas como imagem saem com a imagem original (sem recompressão). Se o desenho original não puder ser usado (falta `vendor/pdf-lib.min.js` no GitHub, ou o PDF do projeto está protegido), a app avisa e gera a planta em **alta resolução (300 ppp)** na mesma folha, sem margens. A mensagem no fim diz qual dos modos foi usado.
- **No PDF descarregado** (Ações → Descarregar planta → PDF): os IDs, as referências e o texto do desenho original ficam como **texto pesquisável** — no leitor de PDF usa **Ctrl+F** (ou "Procurar" no telemóvel) e escreve o ID. A versão "planta + lista" junta também a tabela dos equipamentos em texto.

## Leitura com IA (opcional, gratuita)

O leitor do telemóvel funciona sem rede, mas falha com fotos desfocadas ou tiradas a um ecrã. Para leituras muito mais fiáveis quando há rede:

1. Abre **aistudio.google.com/apikey** com uma conta Google e carrega em **Create API key**.
2. Na app: **Coordenação → Leitura de etiquetas com IA** → cola a chave → **Guardar** → **Testar**.

A partir daí, as fotos são lidas pela IA da Google (plano gratuito, com limite de pedidos por minuto e por dia). Sem rede, ou se a IA falhar, a app usa o leitor do telemóvel. Se a leitura falhar, usa **Recortar a zona do ID e ler de novo** e seleciona só a linha do código.

## Tarefas e dúvidas na planta — "gotas" (versão 27)

- Na barra da planta há o modo **Tarefa / dúvida**. Toca nele e depois no ponto da planta: escolhe **Tarefa** (trabalho a fazer) ou **Dúvida** (pergunta a esclarecer), escreve o título e a descrição (com @ para avisar alguém), escolhe responsável, prazo, prioridade e junta fotos.
- Na planta aparece uma gota: azul ✓ = tarefa, roxa ? = dúvida, cinzenta = concluída/respondida, contorno vermelho = prazo ultrapassado.
- Toca na gota para ver e gerir: mudar o estado (Aberta / Em curso / Concluída ou Respondida), responder ou comentar, mudar responsável e prazo, **Mover** ou **Apagar**.
- Em **Tarefas e anomalias** há separadores *Tarefas*, *Dúvidas* e *Anomalias*; tocar numa linha abre a gota na planta.
- Em **Ações** podes esconder/mostrar as gotas.

## Notificações da plataforma (versão 27)

- O **sino** no topo tem dois separadores: **Para mim** (identificaram-te com @, atribuíram-te algo, responderam/comentaram as tuas tarefas e dúvidas, concluíram uma tarefa tua, prazo hoje ou ultrapassado, e — para administradores — novas dúvidas) e **Atividade da obra**.
- O número vermelho conta só o que é para ti e ainda não leste; tocar numa notificação leva ao sítio certo. Há **Marcar todas como lidas**.
- **Avisos no ecrã do aparelho:** em *Definições da obra → Notificações na plataforma* (ou no sino) carrega em **Ativar**. Funcionam com a app aberta ou em segundo plano (no iPhone só com a app instalada no ecrã principal). Com a app fechada continuas a receber por **email**.
- SQL: corre `supabase/atualizacao-5-tarefas-duvidas.sql` (depois da 2, 3 e 4) para os emails dizerem Tarefa/Dúvida e para avisar respostas e conclusões.

## Ficha de tarefa completa ao estilo Fieldwire (versão 28)

Ao tocar numa gota abre a ficha completa:
- **Estado:** Aberta → Em curso → Concluída → **Verificada** (verificar: quem criou ou a coordenação).
- **Especialidade** (SADI, Eletricidade, AVAC, Hidráulica, Telecom/ITED, Segurança, Construção civil, Arquitetura, Outros): a gota fica com a cor da especialidade.
- **Prioridade, responsável, início e prazo, horas de mão de obra, custo, etiquetas** e **equipamento ligado**.
- **Seguidores:** recebem os avisos (no sino e por email). Quem é identificado com @ numa mensagem passa a seguir.
- **Checklist** com progresso (na gota aparece 1/3). Pode guardar-se como **modelo** e aplicar-se noutras tarefas da obra (também ao criar).
- **Fotos e ficheiros** (PDF, DWG, Excel…), **tarefas relacionadas**, **histórico** de todas as alterações junto da conversa. As mensagens podem levar foto.
- **Duplicar**, **Mover**, **Colocar na planta** (para tarefas importadas sem posição).
- **No menu Ações:** escolher que gotas mostrar (todas / só abertas / só as minhas / escondidas).

**Integrações (gratuitas):**
- **Partilhar → Copiar ligação:** abre diretamente a tarefa (depois de entrar, para quem tem acesso à obra).
- **WhatsApp** e **email** com o resumo e a ligação.
- **Google Calendar** e **.ics** (Outlook, iPhone, Android) com início/prazo e lembrete.
- **Relatório PDF** da tarefa, com recorte da planta, checklist, fotos e mensagens (Imprimir → Guardar como PDF). Na página Tarefas há também o relatório de todas.
- **Excel / CSV** de todas as tarefas e dúvidas.
- **Importar do Fieldwire:** no Fieldwire exporta as tarefas para Excel/CSV e carrega o ficheiro em *Tarefas e anomalias → Importar do Fieldwire*. São reconhecidos título, estado, categoria, responsável (pelo nome), prioridade, datas, planta (pelo nome), etiquetas, horas, custo, descrição e checklist. As tarefas ficam sem posição; usa *Colocar na planta*.

SQL: volta a correr `supabase/atualizacao-5-tarefas-duvidas.sql` (nova versão: emails também aos seguidores e quando a tarefa é verificada).

## Técnico — Manual, calculadoras e assistente RTIEBT (versão 29 — desde a versão 43 está só no TecFlow)

No menu lateral há **Técnico (RTIEBT)**. Funciona **sem rede e sem depender de outros sites**: as tabelas, os esquemas e o assistente estão todos no ficheiro `tecnico.js`, que fica guardado no aparelho (é preparado em segundo plano na primeira vez que a app abre com rede).

- **Início:** atalhos, destaques (regras mais usadas) e os últimos cálculos guardados.
- **Calcular:**
  - *Queda de tensão* (mono/tri, corrente ou potência, cos φ, cobre/alumínio; limite 3% iluminação / 5% outros usos; dá o fator K, a distância máxima e a secção mínima).
  - *Ocupação de tubos VD* (H07V-U/R ou cabo com Ø; embebida ≤ ⅓, à vista ≤ 40%, coluna/entrada ≤ 20% e mínimo 32 mm).
  - *Proteções / amperagem* (I<sub>Z</sub> por método A1/A2/B1/B2/C, PVC/XLPE, temperatura e agrupamento; disjuntor ou fusível gG; secção mínima).
  - *Potências E-REDES* (escalão → corrente; cargas → escalão; potência mínima da habitação).
  - Cada resultado pode ser **guardado numa tarefa/dúvida ou num equipamento** (fica no histórico deles).
- **Consultar:** guia de bolso (regras rápidas, fator K, tubos, diferenciais, VE, cores, checklist H07V, alturas, IP), esquemas (comutador de escada, inversor, quadro de habitação, sensor/fotocélula), automação (tabela KNX/DALI/Modbus/BACnet/DMX/M-Bus, seleção de redes, tipologias bus) e **Tabelas e fontes**.
- **Assistente:** perguntas em português, respondidas no próprio aparelho a partir do guia e das tabelas (ex.: «que secção para 32 A a 20 m?», «tubo para 5 cabos de 2,5 mm²», «que DR para placa de indução?»). Faz os cálculos, mostra os esquemas e indica a fonte.
- **Acesso logo no início (versão 30):** na página *Os meus projetos* (antes de escolher a obra) e na *Visão geral* há o cartão **Técnico (RTIEBT)** com atalhos para Calcular, Consultar e Assistente.
- Numa tarefa ou dúvida, o botão **Técnico / calcular** abre o módulo ligado a essa tarefa (os resultados guardam-se lá).

**Valores e revisão:** os valores seguem as RTIEBT (Portaria 949-A/2006 e 252/2015), a IEC 60364-5-52, a HD 308/HD 21.3 e a E-REDES — a fonte aparece em cada resposta. **Têm de ser confirmados pelo técnico responsável.** Em *Consultar → Tabelas e fontes* a coordenação pode **exportar** as tabelas (JSON), corrigi-las e **importar** a versão revista para a obra, sem mexer no código.

## Testes completos e correções (versão 43)

Foi feito um teste à plataforma toda, do registo ao Técnico, em computador, tablet e telemóvel (mais de 2000 cliques automáticos em todas as páginas, separadores e botões, e 36 baterias de testes).

- **Corrigido — telemóvel/tablet:** depois de marcar um equipamento, a ficha tapava a planta e o toque seguinte em *Marcar* ou *Tarefa / dúvida* caía na ficha. Agora, ao escolher *Marcar* ou *Tarefa / dúvida*, a ficha aberta fecha-se e a planta fica livre para tocar.
- **Corrigido — Técnico → Bancada:** se saísses da bancada enquanto a animação *Ver solução* ou um botão (sensor, botoneira) ainda estava a correr, a app dava um erro escondido em segundo plano. A animação agora para sozinha.
- Sem páginas a sair fora do ecrã (sem deslocamento lateral) em nenhuma das 33 vistas, em computador e telemóvel.
- **Corrigido — Técnico → Guia de bolso:** no telemóvel, tabelas largas (ex.: Fator K) alargavam a página; agora deslizam dentro do cartão.
- **Melhorado — Técnico sem obra aberta:** «Guardar resultado» guarda logo no histórico do aparelho, sem mostrar listas vazias de tarefas e equipamentos.

## TecFlow — plataforma técnica separada, aberta a todos (versão 43)

O TecFlow é uma **plataforma própria** (nome, logótipo e endereço seus), **sem conta** e sem servidor. Está na pasta `tecflow/`; depois de carregares o zip para o GitHub o endereço é **`https://siberdeny19-source.github.io/planta-obra/tecflow/`**. O **Técnico saiu do ObraFlow** (cartão, menu lateral e botão nas tarefas): calculadoras, guia, esquemas, automação e SADI estão agora só no TecFlow. O ficheiro `tecnico.js` da raiz deixou de existir — pode ser apagado do GitHub.

**Cinco áreas**
- **Automação predial** — KNX, BACnet, Modbus RTU/TCP, DALI, M-Bus (protocolos e simuladores), escolher a rede, tipologias, **comunicação IP** (calculadora de sub-rede, portas), **gateways e BMS** (lista de pontos, modelo CSV) e bancada de ligações.
- **SADI e segurança contra incêndio** — visão geral, protocolos, ligação do laço, exemplo Siemens, **testador FDUL221**, simulador de laço, avarias e alarmes, **intervenção real e manutenção** (NT 12) e **requisitos em Portugal** (RJ-SCIE, RT-SCIE, NT 12, registo na ANEPC).
- **Diagnóstico e manutenção** — análise de falhas (sistema → sintoma/código → verificações), leitura de LEDs, medições de referência, calculadoras RTIEBT, interpretar esquemas (com simbologia) e **relatórios** (modelos NT 12, FDnet, bus de campo; PDF).
- **Eletricidade** (versão 45) — fundamentos e fórmulas (com calculadora de potência), proteções e diferenciais (curvas B/C/D, tipos AC/A/F/B, SPD), terras e equipotencial (TT/TN/IT), redes de distribuição (BT/MT/AT/MAT, PT, chegada ao cliente), segurança elétrica (5 regras de ouro, efeitos da corrente, EPI, acidente), ensaios e certificação (RTIEBT parte 6, DL 96/2017), motores e comandos (com calculadora de corrente), ITED (4.ª edição: PC/CC/FO, ATI, ZAP, ensaios e termo de responsabilidade) e legislação. Mais 6 temas, 13 perguntas de treino, 5 fichas de bolso e 13 termos no glossário.
- **Biblioteca técnica** — **os meus PDF** (manuais, fichas técnicas, procedimentos e normas guardados no aparelho, funcionam sem rede), fichas de bolso em PDF, normas e referências, guia de bolso, fabricantes e tabelas.

**Ordem de aprendizagem (versão 46)** — tudo segue a progressão de um eletricista: **1 Eletricidade** (a começar pela segurança) → **2 Diagnóstico e manutenção** (ferramentas, medir, LEDs, esquemas, falhas, relatórios) → **3 Automação predial** (tipologias → protocolos → bancada → IP/BMS → comissionamento) → **4 SADI** (visão geral e requisitos → detetores → laço → FDUL221 → avarias → intervenção real) → Biblioteca. As secções estão numeradas, marcam ✓ quando já foram vistas, e cada página termina com «Anterior / Seguinte». Os três percursos por nível foram refeitos pela mesma ordem.

**Para ser útil no dia a dia**
- **Tema do dia** com histórico dos temas consultados.
- **Pesquisa** por protocolo, equipamento, código de avaria (ex.: E08, exceção 02) ou fabricante — inclui os teus PDF.
- **Modo de terreno** (botão «Terreno»): botões grandes e só o essencial.
- **Treino adaptativo**: mais perguntas nos temas em que erras mais; domínio por tema.
- **Percursos por nível**: iniciante, técnico de manutenção, diagnóstico avançado.
- **Biblioteca validada**: tudo tem uma classe — *Oficial do fabricante*, *Norma / regulamento*, *Recomendação técnica* ou *Didático*.
- **SADI**: 🎓 = aprendizagem (exercícios, simulações); 🛡 = intervenção real (procedimentos autorizados, entidade registada na ANEPC).

**FDUL221** (SADI → Testador FDUL221), com base no manual técnico Siemens: módulo 1 (conhecer o equipamento, toque nas partes), módulo 2 (preparar e executar, com simulador do ecrã e das teclas), módulo 3 (linha aberta, curto, terra, resistência elevada, comunicação; códigos E01–E17; divisão ao meio e «Measure Device»), módulo 4 (avarias simuladas com escolha de passos e explicação).


**Versão 44 — mais conteúdos e início mais simples**
- Início reduzido ao essencial: pesquisa, tema do dia, continuar percurso/treino, as quatro áreas e atalhos.
- Automação: **Tabelas rápidas** (funções Modbus, linha série RTU, DPT e endereços KNX, objetos BACnet e MS/TP, DALI, M-Bus) e **Comissionamento** (listas KNX, Modbus, BACnet, DALI, M-Bus e BMS, com marcas guardadas).
- SADI: **Tipos de detetores** (onde usar cada um, parte da EN 54) e **Alarmes falsos** (causas e prevenção).
- Diagnóstico: **Ferramentas** (o que levar e para quê, com opções gratuitas).
- Biblioteca: **Glossário** com 40 termos.
- **Simuladores de protocolos (versão 45)** com o estilo do simulador DALI de referência: cartões de cada equipamento (grupo/endereço, ícone que acende, estado), barramento com legenda e impulso a correr, estado do bus na fonte (Bus OK / Sem alimentação / Curto-circuito), painel «Enviar telegrama» com atalhos 0–100 % e destino individual no DALI, monitor com [TX]/[RX]/[ERRO] e Copiar/Limpar, e barra de avarias com «Repor». Funciona sem rede (sem bibliotecas externas).
- **Vista «Planta»** em cada simulador: o sistema montado numa casa (KNX) ou num edifício de escritórios/loja/prédio (DALI, Modbus, BACnet, DMX, M-Bus), com divisões, equipamentos no sítio, cabo no corredor técnico, luzes a acender nas divisões e o telegrama a percorrer o cabo. O botão «Esquema» mostra os cartões.
- **Três exemplos por protocolo** (21 no total), cada um com descrição e tarefas de treino: KNX (moradia, escritório, quarto de hotel), DALI (escritório, sala de aula, loja), Modbus RTU (escritórios, hotel, fábrica), Modbus TCP (escritórios, centro comercial, data center), BACnet (escritórios, hospital, escola), DMX512 (loja, auditório, fachada) e M-Bus (prédio, condomínio, residência de estudantes).
- **Aviso de ficheiros desatualizados**: se a pasta `tecflow/` não for toda substituída no GitHub, a página mostra quais os ficheiros que ficaram antigos.
- Mais 13 temas do dia, 9 avarias, 16 perguntas de treino, 7 fichas de bolso e 3 cenários novos no simulador do FDUL221 (E04, E10, E16).

**Notas**
- Os dados (histórico, treino, relatórios, PDF) ficam **só no aparelho** de cada pessoa.
- O PDF é feito pela impressão do navegador: «PDF» → «Guardar como PDF».
- Instalável como app próprio («Instalar»; no iPhone: Partilhar → Adicionar ao ecrã principal).
- A pasta `tecflow/` é autónoma: para um endereço só dela, cria um repositório `tecflow`, carrega o conteúdo da pasta e ativa o GitHub Pages.

## Limites do plano gratuito (verificado em outubro de 2026)

| Supabase Free | |
|---|---|
| Base de dados | 500 MB (dá para dezenas de milhares de equipamentos) |
| Ficheiros (plantas e fotos) | 1 GB — cerca de 3 000 a 4 000 fotos de etiquetas, já reduzidas pela app |
| Tamanho máximo por ficheiro | 50 MB |
| Tráfego de saída | 5 GB por mês |
| Contas | 50 000 utilizadores ativos por mês |
| Pausa | o projeto é **pausado após 1 semana sem utilização**; volta a ligar-se em supabase.com → o projeto → *Restore* |

Quando a obra crescer para lá disto, o plano Pro do Supabase aumenta os limites sem mudar nada na app. Faz cópias de segurança regulares em **Coordenação → Dados da obra → Descarregar cópia (.zip)**.

## Atualizar a app

Se receberes uma versão nova: no GitHub abre o repositório → **Add file** → **Upload files** → arrasta os ficheiros novos (**exceto `config.js`**, para não perderes a ligação) → **Commit changes**. Os aparelhos recebem a versão nova na próxima vez que abrirem a app com rede (pode ser preciso fechar e abrir duas vezes).

## Problemas comuns

| O que acontece | O que fazer |
|---|---|
| Aparece *Modo demonstração* | O `config.js` no GitHub ainda está vazio ou com erro de escrita. Repete o passo 3 e volta a enviar o ficheiro. |
| *Email ou palavra-passe errados* | Confirma o email; usa *Esqueci-me da palavra-passe*. |
| *Conta à espera de aprovação* | A coordenação aprova em **Coordenação → Equipa**. |
| O indicador fica em *N por enviar* com rede | Carrega no indicador para sincronizar. Se continuar, confirma que a conta está aprovada e que o projeto Supabase não está pausado. |
| *Esta planta ainda não foi guardada neste aparelho* | Liga-te à rede e abre o piso uma vez (ou usa *Preparar para usar sem rede*). |
| A leitura da etiqueta falha | Tira outra foto mais próxima e direita, ou escreve o ID à mão. |
