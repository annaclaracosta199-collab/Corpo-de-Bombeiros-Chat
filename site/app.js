(() => {
  'use strict';
  const cfg = window.SAT_CONFIG || { mode: 'demo', apiEndpoint: '/api/chat', maxMessageLength: 3000 };
  const demo = cfg.mode !== 'production';
  const $ = (s) => document.querySelector(s);
  const chat = $('#chat-messages');
  const form = $('#chat-form');
  const input = $('#chat-input');
  const sendButton = $('#send-button');
  const statusLabel = $('#connection-label');
  const counter = $('#char-counter');
  const announcement = $('#chat-announcement');
  const STORAGE_KEY = 'consulta_sat_unicerrado_v5';
  let conversationId = '';
  let userId = '';
  let history = [];
  let busy = false;
  let activeRequest = null;

  function randomId() {
    try { return crypto.randomUUID(); } catch { return 'sat-' + Math.random().toString(36).slice(2) + '-' + Date.now(); }
  }
  function readSession() {
    try {
      const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
      userId = typeof value.userId === 'string' && value.userId.length <= 90 ? value.userId : randomId();
      conversationId = typeof value.conversationId === 'string' && value.conversationId.length <= 100 ? value.conversationId : '';
      history = Array.isArray(value.history) ? value.history.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').slice(-18).map(m => ({role:m.role, content:m.content.slice(0,9000)})) : [];
    } catch { userId = randomId(); history = []; conversationId = ''; }
  }
  function writeSession() {
    try {sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ userId, conversationId, history: history.slice(-18) }));} catch { /* Browser storage not available. */ }
  }
  function iconSvg(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class','icon'); svg.setAttribute('aria-hidden','true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', name === 'user' ? '#icon-message' : '#icon-sparkles');
    svg.appendChild(use); return svg;
  }
  function emptyHidden(hide) {const el=$('#chat-empty'); if(el) el.hidden=hide;}
  function scrollBottom() {chat.scrollTop = chat.scrollHeight;}
  function createBubble(role, content, pending=false) {
    emptyHidden(true);
    const row=document.createElement('div'); row.className='chat-row '+role;
    const avatar=document.createElement('div');avatar.className='chat-avatar';avatar.appendChild(iconSvg(role));
    const bubble=document.createElement('div');bubble.className='chat-bubble';
    if (pending) {
      const dots=document.createElement('div');dots.className='chat-loading';dots.setAttribute('aria-label','Gerando resposta');
      for(let i=0;i<3;i++) dots.appendChild(document.createElement('span'));
      bubble.appendChild(dots);
    } else if (role==='assistant') renderAnswer(bubble, content);
    else bubble.textContent=content;
    row.append(avatar,bubble);chat.appendChild(row);scrollBottom();return bubble;
  }
  function inlineNodes(target, value) {
    // Secure limited Markdown renderer: only text nodes and validated HTTPS links.
    const pattern=/(\[([^\]]{1,160})\]\((https?:\/\/[^\s)]+)\)|https?:\/\/[^\s<>]+|\*\*[^*]+\*\*)/g;
    let cursor=0, found;
    while ((found=pattern.exec(value))!==null) {
      if(found.index>cursor) target.appendChild(document.createTextNode(value.slice(cursor,found.index)));
      const token=found[0];
      if(token.startsWith('**')) {const strong=document.createElement('strong');strong.textContent=token.slice(2,-2);target.appendChild(strong);}
      else {
        const label=found[2] || token;
        const url=found[3] || token.replace(/[.,;:]$/,'');
        try {
          const parsed = new URL(url);
          if(parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('Unsupported link');
          const link=document.createElement('a');link.href=parsed.href;link.rel='noopener noreferrer';link.target='_blank';link.textContent=label;target.appendChild(link);
          if(url.length < token.length) target.appendChild(document.createTextNode(token.slice(url.length)));
        } catch {target.appendChild(document.createTextNode(token));}
      }
      cursor=found.index+token.length;
    }
    if(cursor<value.length)target.appendChild(document.createTextNode(value.slice(cursor)));
  }
  function renderAnswer(node, text) {
    node.replaceChildren();
    const lines=(text||'').replace(/\r/g,'').split('\n');
    let currentList=null, lastType='';
    function resetList(){currentList=null;lastType='';}
    for(const original of lines) {
      const line=original.trim();if(!line){resetList();continue;}
      const bullet=line.match(/^[-*•]\s+(.+)$/), numbered=line.match(/^\d+[.)]\s+(.+)$/);
      if(bullet || numbered) {
        const type=bullet?'ul':'ol';
        if(!currentList||lastType!==type){currentList=document.createElement(type);node.appendChild(currentList);lastType=type;}
        const item=document.createElement('li');inlineNodes(item,(bullet||numbered)[1]);currentList.appendChild(item);
      } else {
        resetList();
        const p=document.createElement('p');
        inlineNodes(p,line.replace(/^#{1,4}\s+/,''));node.appendChild(p);
      }
    }
    if (!node.childNodes.length) node.textContent='Não foi possível obter uma resposta. Tente novamente.';
  }
  function setBusy(value){busy=value;sendButton.disabled=value;input.disabled=value;sendButton.setAttribute('aria-label',value?'Aguarde a resposta':'Enviar pergunta');statusLabel.innerHTML = value?'<span class="status-dot"></span> Gerando orientação...':demo?'<span class="status-dot"></span> Modo demonstração':'<span class="status-dot"></span> Conectado ao serviço de IA';}
  function remember(role, content){history.push({role,content});writeSession();}
  function parseSSEEvent(block, onDelta, onDone) {
    if(!block.trim())return;
    let event='message';const parts=[];
    for(const line of block.split('\n')){
      if(line.startsWith('event:')) event=line.slice(6).trim();
      else if(line.startsWith('data:')) parts.push(line.slice(5).trimStart());
    }
    if(!parts.length)return;
    let item;try{item=JSON.parse(parts.join('\n'));}catch{return;}
    if(event==='delta' && typeof item.text==='string') onDelta(item.text);
    if(event==='done')onDone(item.conversationId);
    if(event==='error')throw new Error(typeof item.message==='string'?item.message:'A execução foi interrompida.');
  }
  async function requestDify(question, bubble) {
    const ctrl=new AbortController();activeRequest=ctrl;
    const response=await fetch(cfg.apiEndpoint || '/api/chat',{
      method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},signal:ctrl.signal,
      body:JSON.stringify({query:question,conversationId,user:userId})
    });
    if(!response.ok){const payload=await response.json().catch(()=>({}));throw new Error(payload.error || `Falha na comunicação (${response.status}).`);}
    const contentType=response.headers.get('content-type')||'';
    let answer='';
    if(contentType.includes('text/event-stream')){
      const reader=response.body.getReader();const decoder=new TextDecoder();let buffer='';let completed=false;
      while(true){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true}).replace(/\r\n/g,'\n');let pos;
        while((pos=buffer.indexOf('\n\n'))!==-1){const block=buffer.slice(0,pos);buffer=buffer.slice(pos+2);parseSSEEvent(block,delta=>{answer+=delta;bubble.textContent=answer;scrollBottom();},id=>{if(id){conversationId=id;writeSession();}completed=true;});}
      }
      if(buffer.trim())parseSSEEvent(buffer,delta=>{answer+=delta;},id=>{if(id)conversationId=id;completed=true;});
      if(!completed && !answer)throw new Error('A conexão foi interrompida antes da resposta.');
    } else {
      const payload=await response.json();if(!payload||typeof payload.answer!=='string')throw new Error('Resposta inválida recebida do servidor.');
      answer=payload.answer; if(payload.conversationId){conversationId=payload.conversationId;writeSession();}
    }
    if(!answer.trim())throw new Error('O assistente não retornou texto. Tente novamente.');
    return answer;
  }
  function demoAnswer(){return '**Prévia da interface — Dify ainda não conectado.**\n\nEsta é uma demonstração do portal com a identidade visual UniCerrado. Quando a equipe configurar o servidor seguro e a chave da API do **Chatflow Consulta SAT**, sua pergunta será respondida pela inteligência artificial com base nos documentos da SAT.\n\nEnquanto isso, você pode conhecer o [portal oficial SIAPI](https://www.bombeiros.go.gov.br/siapi-3). Em emergências, ligue **193**.';}
  async function ask(value) {
    const question=(value || input.value).trim();
    if(!question || busy)return;
    if(question.length > (cfg.maxMessageLength||3000)){announcement.textContent='Sua pergunta ultrapassou o limite permitido.';return;}
    input.value='';autoResize();emptyHidden(true);createBubble('user',question);remember('user',question);const bubble=createBubble('assistant','',true);setBusy(true);announcement.textContent='O assistente está preparando uma resposta.';
    try {
      let answer;
      if(demo){await new Promise(r=>setTimeout(r,480));answer=demoAnswer();}
      else answer=await requestDify(question,bubble);
      renderAnswer(bubble,answer);remember('assistant',answer);announcement.textContent='Resposta recebida.';
    } catch(e){
      const message=e.name==='AbortError'?'Solicitação cancelada.':(e.message || 'Não foi possível obter a resposta.');
      renderAnswer(bubble,'**Não foi possível concluir esta pergunta.**\n\n'+message+'\n\nVocê pode tentar novamente.');
      announcement.textContent='Falha ao obter resposta.';
    } finally{activeRequest=null;setBusy(false);input.focus({preventScroll:true});scrollBottom();}
  }
  function autoResize(){input.style.height='auto';input.style.height=Math.min(input.scrollHeight,120)+'px';counter.textContent=input.value.length+'/3000';}
  function newConversation(){if(activeRequest){activeRequest.abort();activeRequest=null;}conversationId='';history=[];userId=randomId();writeSession();chat.replaceChildren();
    const welcome=document.createElement('div');welcome.id='chat-empty';welcome.className='chat-empty';welcome.innerHTML='<div class="chat-empty-icon"><svg class="icon"><use href="#icon-sparkles"></use></svg></div><h3>Olá! Como posso ajudar?</h3><p>Faça uma pergunta sobre as atividades técnicas da SAT ou escolha uma sugestão para começar.</p><div class="chat-starters"><button type="button" data-question="Como solicitar uma vistoria?">Solicitar vistoria <svg class="icon"><use href="#icon-arrow"></use></svg></button><button type="button" data-question="Como funciona a certificação?">Certificação <svg class="icon"><use href="#icon-arrow"></use></svg></button></div>';
    chat.appendChild(welcome);input.value='';autoResize();setBusy(false);announcement.textContent='Uma nova conversa foi iniciada.';input.focus({preventScroll:true});}
  readSession();
  document.querySelector('#copyright-year').textContent=new Date().getFullYear();
  $('#demo-banner').hidden=!demo;
  statusLabel.innerHTML = demo?'<span class="status-dot"></span> Modo demonstração':'<span class="status-dot"></span> Conectado ao serviço de IA';
  form.addEventListener('submit',e=>{e.preventDefault();ask();});
  input.addEventListener('input',autoResize);
  input.addEventListener('keydown',e=>{if(e.key==='Enter' && !e.shiftKey){e.preventDefault();ask();}});
  $('#new-chat').addEventListener('click',newConversation);
  document.addEventListener('click',e=>{
    const button=e.target.closest('[data-question]');
    if(button){const question=button.dataset.question;if(busy)return;document.getElementById('assistente').scrollIntoView({behavior:'smooth',block:'start'});ask(question);}
  });
  if(history.length){emptyHidden(true);for(const item of history)createBubble(item.role,item.content);}
  autoResize();
  const menuToggle=$('#menu-toggle'), nav=$('#main-nav');
  menuToggle.addEventListener('click',()=>{const open=nav.classList.toggle('open');menuToggle.setAttribute('aria-expanded',String(open));menuToggle.setAttribute('aria-label',open?'Fechar menu':'Abrir menu');});
  nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');menuToggle.setAttribute('aria-expanded','false');}));
  if('IntersectionObserver' in window){const sections=['inicio','assuntos','como-funciona','perguntas','contatos'].map(id=>document.getElementById(id)).filter(Boolean);
    const observer=new IntersectionObserver(entries=>{for(const e of entries){if(e.isIntersecting){nav.querySelectorAll('.nav-link').forEach(link=>link.classList.toggle('is-active',link.getAttribute('href')==='#'+e.target.id));}}},{rootMargin:'-12% 0px -68% 0px',threshold:0});sections.forEach(s=>observer.observe(s));}
})();
