# Planta de Obra · app instalável

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

1. Abre o endereço da app e escolhe **Criar conta nova**. **A primeira conta criada fica como Coordenação** — cria a tua primeiro.
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

## Instalar no aparelho

- **Android (Chrome):** abre o endereço → menu **⋮** → **Instalar app** (ou *Adicionar ao ecrã principal*).
- **iPhone / iPad (Safari):** abre o endereço → botão **Partilhar** → **Adicionar ao ecrã principal**.
- **Computador (Chrome ou Edge):** abre o endereço → ícone de instalar na barra de endereço (ou menu → *Instalar Planta de Obra*).

A app abre em ecrã inteiro, como as outras apps.

## Trabalhar sem rede

- Tudo o que abres fica guardado no aparelho. Antes de ir para uma zona sem rede, abre **Coordenação** → **Usar sem rede** → **Preparar para usar sem rede**: guarda as plantas e fotos do piso e o leitor de etiquetas.
- Sem rede podes marcar, fotografar, ler etiquetas, mudar etapas e registar anomalias. O indicador no topo mostra *Sem rede · N por enviar*.
- Quando a rede volta, envia tudo sozinho. Não saias da conta (botão **Sair**) com alterações por enviar.
- A primeira entrada num aparelho novo precisa de rede.

## Ler etiquetas

Na ficha do equipamento: **Tirar foto** (ou **Carregar**). A app lê o texto e os códigos DataMatrix/QR e preenche o **ID** (ou o **MAC**, se não houver ID). Se não tiver a certeza, mostra as leituras possíveis para escolheres com um toque. Dicas: foto de perto, direita, com boa luz e sem reflexos. Na primeira leitura com rede a app descarrega o leitor (alguns MB); a partir daí funciona sem rede.

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
