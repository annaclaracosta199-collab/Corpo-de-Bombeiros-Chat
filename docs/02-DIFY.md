# 02 — INTEGRAR O CHATFLOW DO DIFY

## QUAL aplicativo conectar?

Conecte o **novo Chatflow** `Consulta SAT Goiatuba | Assistente` que foi importado e testado com conversa e memória. **NÃO use a chave do antigo aplicativo tipo Workflow.** Os dois aplicativos têm endpoints diferentes:

- Chatflow atual: `POST https://api.dify.ai/v1/chat-messages`
- Workflow antigo: `POST https://api.dify.ai/v1/workflows/run` (não é usado por este projeto)

API oficial: https://docs.dify.ai/en/api-reference/chat-messages/send-chat-message

## Passos no Dify

1. Entre no **Estúdio** e abra o **Chatflow** atualizado.
2. Confira os blocos: `Mensagem do Cidadão → Consultar Base SAT → Gemini → Responder ao Cidadão`.
3. Execute e confirme que pelo menos quatro perguntas recebem respostas completas.
4. Em **Publicar**, publique a versão em uso.
5. Em **Ponto de acesso → API de serviço de backend → Chave da API**, crie uma chave para ESTE Chatflow.
6. Guarde-a apenas no backend. Não a envie em conversas, capturas, códigos públicos ou links.

## Como a pergunta viaja

O navegador envia para **seu próprio backend**:

```json
{
  "query": "Como solicitar uma vistoria?",
  "conversationId": "",
  "user": "identificador-aleatorio-da-sessao"
}
```

O backend autentica no Dify e chama `POST /chat-messages` com `query`, `inputs: {}`, `conversation_id`, `user` e `response_mode`. O Node.js e o Worker recebem **streaming SSE** e repassam apenas o texto da resposta e o identificador de conversa. O PHP faz uma requisição `blocking`.

Na primeira pergunta, `conversation_id` é vazio. Nas perguntas seguintes, o mesmo identificador retornado pelo Dify é reutilizado para dar continuidade à conversa. O botão **Nova conversa** limpa o histórico da sessão.

Não adicione um campo customizado `pergunta` à API de Chatflow: aqui a pergunta entra em `query` automaticamente. O campo `pergunta` pertencia ao Workflow antigo.

## Ajustes recomendados no Dify

- Memória habilitada no nó LLM, se desejada continuidade contextual.
- Prompt de sistema restrito aos documentos da SAT; não inventar prazos, contatos e taxas.
- Regra prioritária de emergência: 193; chat não aciona socorro.
- Testar resposta do Gemini para mensagens longas e uso da base de conhecimento.
- Não exibir nomes internos de documentos no frontend; a API deste portal não repassa os metadados de recuperação na resposta simplificada.
- Antes de publicar, definir política de privacidade adequada ao uso da API do Dify e revisar termos institucionais.

## Custos e disponibilidade

A API do Dify pode ter limites, cotas e custos conforme sua conta e o modelo Gemini. O aplicativo não fica independente do Dify: apenas **a hospedagem da página visual passa a ser externa**; a IA e a base de conhecimento continuam no Dify.

Não há chave real incluída neste pacote. Por isso, a resposta de IA ao vivo ainda depende das configurações acima.
