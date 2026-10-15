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

## Pesquisar IDs nas plantas e PDF pesquisável (versão 20)

- **Na app:** a pesquisa do topo procura também no **texto das plantas em PDF** (ex.: IDs ou referências escritos no desenho do projeto). O resultado aparece em "Texto nas plantas (PDF)"; ao tocar, a planta abre com o texto destacado a laranja. Funciona com PDF de texto (vetorial, exportado do CAD); uma planta digitalizada ou carregada como imagem não tem texto para procurar.
- **No PDF descarregado** (Ações → Descarregar planta → PDF): os IDs, as referências e o texto do desenho original ficam como **texto pesquisável** — no leitor de PDF usa **Ctrl+F** (ou "Procurar" no telemóvel) e escreve o ID. A versão "planta + lista" junta também a tabela dos equipamentos em texto.

## Leitura com IA (opcional, gratuita)

O leitor do telemóvel funciona sem rede, mas falha com fotos desfocadas ou tiradas a um ecrã. Para leituras muito mais fiáveis quando há rede:

1. Abre **aistudio.google.com/apikey** com uma conta Google e carrega em **Create API key**.
2. Na app: **Coordenação → Leitura de etiquetas com IA** → cola a chave → **Guardar** → **Testar**.

A partir daí, as fotos são lidas pela IA da Google (plano gratuito, com limite de pedidos por minuto e por dia). Sem rede, ou se a IA falhar, a app usa o leitor do telemóvel. Se a leitura falhar, usa **Recortar a zona do ID e ler de novo** e seleciona só a linha do código.

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
