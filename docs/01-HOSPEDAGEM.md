# 01 — ESCOLHA DA HOSPEDAGEM

Escolha **apenas uma** das três opções. O frontend público é idêntico nas três.

## A — Node.js (recomendado: site + API juntos)

Indicado para servidor VPS, Render, Railway ou outra hospedagem com Node.js 20+.

**Arquivos:** use a pasta completa deste projeto (não apenas `backend/node`).

**Variáveis privadas no serviço de hospedagem:**

```text
DIFY_API_KEY=app-xxxxxxxx...   (chave do CHATFLOW, não do Workflow antigo)
DIFY_API_BASE_URL=https://api.dify.ai/v1
PORT=3000                    (ou fornecido pela hospedagem)
REQUESTS_PER_MINUTE=12
```

A chave deve ser configurada como variável secreta no painel da hospedagem.

**Comando de início a partir da raiz do projeto:**

```bash
node backend/node/server.mjs
```

**Teste local no Windows com Node.js 22+:**

```powershell
cd backend\node
copy .env.example .env
# Edite .env com a chave PRIVADA do Chatflow (apenas no computador)
npm run dev
```

Acesse http://localhost:3000.

**Frontend:** em `site/config.js`, altere para:

```js
mode: 'production',
apiEndpoint: '/api/chat',
```

Não precisa contratar um segundo servidor nem configurar CORS: site e API são servidos no mesmo domínio.

**Segurança:** o Node possui validação de entrada, limite básico de 12 requisições/minuto por IP e remove metadados/citações da resposta de streaming que envia ao navegador. Para tráfego público, ainda são recomendados proteção antiabuso/CDN, limites e monitoramento de custo e política de privacidade.

## B — Hospedagem PHP/cPanel

Indicado para hospedagens tradicionais que não aceitam Node.js, mas têm PHP 8.0+, cURL e SSL.

1. Copie todo o conteúdo da pasta `site` para `public_html/`.
2. Copie `backend/php/public/api/chat.php` para `public_html/api/chat.php`.
3. Copie `backend/php/private/config.php.example` para `private/config.php`, **fora da `public_html`** (deixe `private` no mesmo nível de `public_html`).
4. Abra `private/config.php` e substitua o valor de `DIFY_API_KEY` pela chave privada do Chatflow.
5. Em `public_html/config.js`, configure:

```js
mode: 'production',
apiEndpoint: '/api/chat.php',
```

6. Teste o domínio com HTTPS.

**Nota:** esse backend PHP utiliza resposta `blocking`, que é mais simples e pode atingir limites de tempo em hospedagens compartilhadas; para respostas longas e streaming, prefira Node.js ou Cloudflare Worker. Peça ao provedor PHP a confirmação de tempos máximos de execução e cURL/HTTPS.

**Nunca envie `private/config.php` para a `public_html` ou repositório público!**

## C — Site estático + Cloudflare Worker

Indicado para GitHub Pages, Netlify, Firebase Hosting, Cloudflare Pages ou qualquer hospedagem que aceite somente HTML/CSS/JS.

1. Publique somente o conteúdo de `site/` no serviço estático.
2. Crie uma conta Cloudflare e instale o Node.js.
3. Na pasta `backend/cloudflare`, edite `wrangler.toml` e troque `ALLOWED_ORIGIN` pela **origem exata**, por exemplo `https://meusite.com.br`, sem a barra final. Para GitHub Pages de projeto, use a origem `https://usuario.github.io`.
4. No terminal dessa pasta:

```bash
npx wrangler login
npx wrangler deploy
npx wrangler secret put DIFY_API_KEY
```

5. Cole sua chave privada do **Chatflow** somente quando o comando solicitar. O Worker retorna uma URL `https://...workers.dev`.
6. Em `site/config.js`, coloque:

```js
mode: 'production',
apiEndpoint: 'https://SEU-WORKER.workers.dev',
```

7. Publique novamente os arquivos do site e teste usando o endereço público.

**Segurança:** configure proteção antiabuso/rate limiting no Cloudflare para a rota do Worker, pois a API usa uma chave privada com potencial de consumo pago. `ALLOWED_ORIGIN` é uma barreira CORS para navegadores, não substitui autenticação, rate limiting e proteção contra chamadas automatizadas.

## Como saber qual usar?

- Tem hospedagem com Node.js? **Opção A**.
- Tem apenas PHP/cPanel? **Opção B**.
- Quer GitHub Pages, Firebase Hosting ou outro servidor estático? **Opção C**.

**Importante:** configurar `mode: 'production'` sem publicar e configurar o backend fará o chat mostrar um erro. Não inclua chaves privadas em `config.js`.
