# CONSULTA SAT GOIATUBA — PORTAL COM IDENTIDADE UNICERRADO

**Versão 5 • 18 de novembro de 2026**

## O que você recebeu

Um site completo e responsivo, desenvolvido em HTML, CSS e JavaScript, usando o **arquivo de logotipo UniCerrado enviado para o projeto** e suas cores azul (`#354B9C`), verde (`#6EAF4F`) e verde-lima (`#A9C645`). O site contém:

- Página inicial institucional com identidade visual da UniCerrado.
- Seis áreas de orientação: vistorias, certificados, projetos, documentação, eventos e SIAPI.
- Chat integrado **diretamente ao Chatflow do Dify** por meio de servidor seguro, sem iframe.
- Conversa contínua por `conversation_id`, carregamento de resposta em streaming e botão Nova conversa.
- Perguntas rápidas, FAQ, links para SIAPI e canais institucionais.
- Alertas do serviço 193, acessibilidade básica, visual para celular e computador.
- Três opções de backend: Node.js, Cloudflare Worker ou PHP/cPanel.

## IMPORTANTE: o site está em modo de apresentação

A interface visual e suas interações foram preparadas. **A chave de API do Dify NÃO acompanha o pacote**, por segurança. A configuração padrão é deliberadamente `mode: 'demo'` em `site/config.js`. Nesse modo, o chat mostra uma mensagem de demonstração e **não produz orientação técnica real**. Para funcionar com a IA:

1. Publique e confira o **Chatflow** do Dify usado pelo Consulta SAT (não confundir com o Workflow antigo).
2. Gere uma **chave da API do Chatflow** em `Ponto de acesso → API de serviço de backend → Chave da API`.
3. Escolha uma hospedagem com Node.js, PHP ou API separada no Cloudflare Worker.
4. Configure a chave no ambiente do backend — **nunca em HTML, JavaScript, GitHub ou `site/config.js`**.
5. Altere `mode: 'demo'` para `mode: 'production'` no `site/config.js` e ajuste `apiEndpoint`.
6. Teste e valide as respostas antes da divulgação pública.

## Pastas

```text
Consulta-SAT-UniCerrado-V5/
  site/                         Site público (HTML/CSS/JS)
    index.html                  Página principal
    styles.css                  Identidade visual e responsividade
    app.js                      Interações e cliente seguro de chat
    config.js                   Modo demo/prod e endereço público da API
    assets/unicerrado-logo.png  Logo original fornecida
    assets/favicon.svg          Ícone do portal
  backend/
    node/                       Servidor que hospeda o site e conversa com o Dify
    cloudflare/                 API separada para hospedagem estática
    php/public/api/             API para cPanel/PHP (copiar a public_html/api)
    php/private/                Modelo de segredo (fora da pasta pública)
  docs/
    01-HOSPEDAGEM.md            Como escolher e publicar
    02-DIFY.md                  Como integrar a IA real
    03-CHECKLIST.md             Segurança e homologação
    04-PASSAGEM.md              Resumo para entregar à colega/equipe
```

## Testar o visual agora, sem chave

Opção 1: abra `site/index.html` no navegador. A demonstração não acessa o Dify.

Opção 2: para simular ambiente web, abra um terminal na pasta `site` e execute:

```bash
python -m http.server 5500
```

Abra http://localhost:5500 e teste botões, navegação, perguntas rápidas e o layout para celular.

**Atenção:** não publique o modo de demonstração como atendimento real.

## Conteúdo e responsabilidade institucional

Este portal é um protótipo com **identidade visual da UniCerrado**. O uso de marcas institucionais, a relação do projeto com o CBMGO, a base documental, a política de privacidade e a publicação definitiva devem ser validados pelos responsáveis. O sistema **não é serviço de emergência, não agenda vistorias, não emite certificados e não consulta protocolos em tempo real**.

Fontes públicas: https://unicerrado.edu.br/ ; https://www.bombeiros.go.gov.br/siapi-3 ; https://www.bombeiros.go.gov.br/telefones-das-sat ; https://docs.dify.ai/en/api-reference/chat-messages/send-chat-message
