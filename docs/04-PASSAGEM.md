# 04 — RESUMO PARA ENVIAR À COLEGA / EQUIPE

**Projeto:** Consulta SAT Goiatuba — Portal com identidade UniCerrado.

Foi desenvolvido um frontend responsivo em HTML, CSS e JavaScript, com utilização da logo fornecida da UniCerrado e de suas cores institucionais. O portal oferece apresentação do serviço, áreas de orientação, FAQ, atalhos para o SIAPI e um chat integrado à inteligência artificial do Dify.

A integração real usa o aplicativo **Chatflow** já configurado no Dify, mantendo a memória de conversa. O backend protege a chave privada da API. O pacote permite escolher entre hospedagem Node.js, PHP/cPanel e site estático com Cloudflare Worker.

**O que ainda será necessário para publicação:** escolher o provedor de hospedagem, configurar a chave do Chatflow no servidor, mudar o site de demonstração para produção, validar as respostas e obter aprovação da equipe responsável sobre identidade visual, conteúdo e privacidade.

**Como testar a parte gráfica:** abrir `site/index.html` ou servir a pasta `site` com `python -m http.server 5500`. O modo demonstrativo não consulta a IA.

**Como testar a IA:** seguir os documentos `01-HOSPEDAGEM.md` e `02-DIFY.md` e repetir os testes do checklist.

**Aviso:** o portal presta orientações informativas e não substitui processos oficiais, nem aciona atendimento de emergência (193).
