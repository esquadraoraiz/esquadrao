# Esquadrão Raiz no Google Cloud (Firebase Hosting)

Publica o jogo no **Firebase Hosting**, o serviço de sites estáticos do Google Cloud, no plano gratuito **Spark**, com domínio próprio e HTTPS.

```
esquadrao-raiz-gcp/
├── src/index.html                  ← a tela do jogo (HTML, CSS e JS)
├── src/motor.js                    ← a regra do jogo: dados, sorteio com semente e pontuação, sem tela
├── testes/                         ← testes em Node (node testes/<nome>.test.js)
├── firebase.json                   ← cache, cabeçalhos de segurança, rotas
├── firestore.rules                 ← regras de segurança do ranking
├── .firebaserc                     ← ID do seu projeto (editar)
└── .github/workflows/deploy.yml    ← publica sozinho a cada push na main
```

**Custo:** R$ 0 de hospedagem e DNS + o domínio (cerca de R$ 40/ano no Registro.br).
O plano Spark inclui 10 GB de armazenamento e 360 MB de tráfego por dia. Com o jogo em torno de 15 KB comprimido, isso dá dezenas de milhares de partidas por dia.

---

## 1. Criar o projeto

1. Acesse **console.firebase.google.com → Adicionar projeto**. Dá para usar um projeto do GCP que você já tenha. O Google Analytics pode ficar desligado.
2. Anote o **ID do projeto** (ex.: `esquadrao-raiz-4f2a1`) e coloque no `.firebaserc`, no lugar de `SEU-PROJETO-ID`.
3. Confirme que o projeto está no plano **Spark**. Ele é o padrão, e não pede cartão.

## 2. Primeira publicação pelo seu computador

Precisa do Node.js instalado.

```bash
npm install -g firebase-tools
firebase login
cd esquadrao-raiz-gcp
firebase deploy --only hosting
```

O jogo fica no ar em `https://SEU-PROJETO-ID.web.app`.

Para testar localmente antes: `firebase serve --only hosting`, depois abra `http://localhost:5000`.

## 3. Publicação automática pelo GitHub (opcional)

O workflow publica a cada push na `main` e cria um **link de teste** (válido por 7 dias) em cada pull request.

### 3.1 Criar uma conta de serviço só para o deploy

```bash
PROJETO=SEU-PROJETO-ID

gcloud iam service-accounts create github-deploy \
  --display-name="Deploy GitHub" --project=$PROJETO

gcloud projects add-iam-policy-binding $PROJETO \
  --member="serviceAccount:github-deploy@$PROJETO.iam.gserviceaccount.com" \
  --role="roles/firebasehosting.admin"

gcloud iam service-accounts keys create key.json \
  --iam-account=github-deploy@$PROJETO.iam.gserviceaccount.com
```

### 3.2 Guardar a chave no GitHub

1. No repositório: **Settings → Secrets and variables → Actions → New repository secret**
   - Nome: `FIREBASE_SERVICE_ACCOUNT`
   - Valor: todo o conteúdo do `key.json`
2. **Apague o `key.json` do seu computador** (`rm key.json`). Ele já está no `.gitignore`, mas não deve ficar por aí.

### 3.3 Publicar

Faça push na `main`. O jogo é publicado em 1 a 2 minutos.

> **Atalho:** `firebase init hosting:github` faz o passo 3 sozinho (cria a conta de serviço e o segredo). Ele gera os próprios arquivos de workflow e um segredo com outro nome (`FIREBASE_SERVICE_ACCOUNT_<PROJETO>`). Se usar o atalho, responda **não** quando ele perguntar se pode sobrescrever o `firebase.json`, e apague os workflows duplicados ou ajuste o nome do segredo no `deploy.yml`.

## 4. Domínio próprio

No Firebase, **o domínio raiz funciona direto com o DNS gratuito do Registro.br**, porque ele usa registros A comuns. Não precisa de Cloudflare.

1. No console: **Hosting → Adicionar domínio personalizado**. Informe `seudominio.com.br` (ou um subdomínio como `jogar.seudominio.com.br`).
2. O Firebase mostra os registros a criar. Normalmente são:

   | Tipo | Nome | Valor |
   |---|---|---|
   | TXT | `@` (ou o subdomínio) | valor de verificação mostrado pelo Firebase |
   | A | `@` (ou o subdomínio) | endereço(s) IP mostrado(s) pelo Firebase |

3. Crie esses registros no **Registro.br → seu domínio → DNS → Editar zona**. Antes, apague registros A, AAAA ou CNAME antigos com o mesmo nome.
4. **Não apague o TXT depois.** O Firebase exige que ele continue no DNS.
5. Aguarde. A verificação leva de minutos a horas, e o certificado HTTPS pode levar até 24 horas para ser emitido.

Dica: adicione também o `www.seudominio.com.br` e configure-o para redirecionar ao domínio principal, na mesma tela do console.

## 5. Atualizar o jogo

Edite `src/index.html` e rode `firebase deploy --only hosting`, ou faça push na `main` se configurou o GitHub. O jogo fica em cache por até 5 minutos.

Para voltar a uma versão anterior: **Hosting → Histórico de versões → Reverter**.

## 6. Ranking dos times (Firestore)

O jogo tem um ranking com a melhor campanha de cada time. Ele usa o **Firestore**, que também é grátis no plano Spark (50 mil leituras e 20 mil gravações por dia).

1. No console do Firebase: **Criação → Firestore Database → Criar banco de dados**.
   - Local: **southamerica-east1 (São Paulo)**. Não dá para mudar depois.
   - Modo: **produção**. As regras certas vão no próximo passo.
2. Confira se o `projectId` no `src/index.html` é o ID do seu projeto. Procure por `projectId:` perto do fim do arquivo.
3. Publique o site e as regras de segurança juntos:

   ```bash
   firebase deploy --only hosting,firestore
   ```

As regras (`firestore.rules`) deixam qualquer pessoa **ler** o ranking e **criar** uma entrada válida, mas ninguém edita nem apaga. Elas também conferem se a pontuação bate com a fórmula do jogo.

**Desafios entre amigos:** no fim de cada campanha, o botão "Desafiar amigos" gera um link `.../#d-CODIGO`. Quem abre joga a mesma campanha, e o placar do desafio usa o mesmo banco (campo `seed`). Não precisa configurar nada além das regras.

**Para apagar uma entrada indesejada**, como um nome ofensivo: console → Firestore Database → coleção `scores` → abra o documento e exclua.

> O ranking é para amigos. Alguém com conhecimento técnico consegue enviar uma pontuação falsa que respeite as regras. Para um ranking público e disputado, seria preciso validar as partidas num servidor.

---

## O que o `firebase.json` faz

| Configuração | Para quê |
|---|---|
| `rewrites` | Qualquer endereço abre o jogo, em vez de uma página de erro |
| `Cache-Control` | Cache curto (5 min), para atualizações chegarem rápido |
| `Content-Security-Policy` | Só permite scripts do próprio site e fontes do Google Fonts |
| `X-Frame-Options` / `frame-ancestors` | Impede que outro site embuta o jogo |
| `Strict-Transport-Security` | Força HTTPS |
| `Permissions-Policy` | Bloqueia câmera, microfone, localização e pagamentos |

## Outras opções no GCP (e por que não usei)

| Opção | Custo aproximado | Observação |
|---|---|---|
| **Firebase Hosting (Spark)** | **US$ 0** | Mais simples, CDN global, HTTPS e domínio raiz grátis |
| Cloud Storage + Load Balancer | cerca de US$ 18/mês | O balanceador cobra por hora, mesmo sem tráfego |
| Cloud Run (container) | US$ 0 a poucos centavos | Funciona, mas exige container e cartão de crédito. Faz sentido se o jogo ganhar um backend (ranking, por exemplo) |

## Observações

- No Spark, se o tráfego diário passar do limite, o site pode ficar indisponível até o dia seguinte. Se o jogo crescer muito, mude para o plano **Blaze** (paga só o que passar da cota gratuita) e configure um **alerta de orçamento** no Cloud Billing.
- O jogo usa nomes reais de jogadores e clubes. Antes de divulgar publicamente, consulte um advogado sobre direito de imagem e marcas.
