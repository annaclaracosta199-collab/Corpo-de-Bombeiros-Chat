/** API segura para Chatflow no Cloudflare Workers. Chave sempre em Secret. */
function json(status, data, headers={}) {return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});}
function getCors(origin, allowed){const a=(allowed||'').trim();return origin && a && origin===a?{'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600'}:{};}
function verifyPayload(d){const q=typeof d?.query==='string'?d.query.trim():'';const c=typeof d?.conversationId==='string'?d.conversationId.trim():'';const u=typeof d?.user==='string'?d.user.trim():'';return q.length>0&&q.length<=3000&&c.length<=100&&/^[a-zA-Z0-9-]*$/.test(c)&&/^[-a-zA-Z0-9_]{1,100}$/.test(u)?{query:q,inputs:{},conversation_id:c,user:u,response_mode:'streaming'}:null;}
const encoder=new TextEncoder();
export default {
 async fetch(request,env){
  const origin=request.headers.get('Origin')||'';const cors=getCors(origin,env.ALLOWED_ORIGIN);
  if(request.method==='OPTIONS')return origin===env.ALLOWED_ORIGIN?new Response(null,{status:204,headers:cors}):json(403,{error:'Origem não autorizada.'});
  if(request.method!=='POST')return json(405,{error:'Método não permitido.'},cors);
  if(!env.ALLOWED_ORIGIN || origin!==env.ALLOWED_ORIGIN)return json(403,{error:'Origem não autorizada. Configure ALLOWED_ORIGIN no Worker.'},cors);
  if(!env.DIFY_API_KEY)return json(503,{error:'Integração com Dify ainda não configurada.'},cors);
  let payload;try{if(Number(request.headers.get('Content-Length')||0)>16000)throw Error();const text=await request.text();if(text.length>16000)throw Error();payload=verifyPayload(JSON.parse(text));}catch{return json(400,{error:'Requisição inválida.'},cors);}
  if(!payload)return json(400,{error:'Pergunta inválida.'},cors);
  const base=(env.DIFY_API_BASE_URL||'https://api.dify.ai/v1').replace(/\/+$/,'');
  let upstream;try{upstream=await fetch(base+'/chat-messages',{method:'POST',headers:{Authorization:'Bearer '+env.DIFY_API_KEY,'Content-Type':'application/json'},body:JSON.stringify(payload)});}catch{return json(502,{error:'Não foi possível conectar ao Dify.'},cors);}
  if(!upstream.ok)return json(upstream.status===429?429:502,{error:upstream.status===429?'Muitas solicitações, tente mais tarde.':'Falha na resposta do Dify. Verifique as configurações do aplicativo.'},cors);
  const stream=new ReadableStream({async start(controller){const reader=upstream.body.getReader();const decoder=new TextDecoder();let buffer='';let cid=payload.conversation_id;let ended=false;
   function send(type,obj){controller.enqueue(encoder.encode('event: '+type+'\ndata: '+JSON.stringify(obj)+'\n\n'));}
   function handle(block){const parts=[];let kind='';for(const line of block.replace(/\r/g,'').split('\n')){if(line.startsWith('event:'))kind=line.slice(6).trim();if(line.startsWith('data:'))parts.push(line.slice(5).trimStart());}if(!parts.length)return;let d;try{d=JSON.parse(parts.join('\n'));}catch{return;}if(typeof d.conversation_id==='string')cid=d.conversation_id;kind=d.event||kind;
    if((kind==='message'||kind==='agent_message')&&typeof d.answer==='string')send('delta',{text:d.answer});
    if(kind==='message_end'){ended=true;send('done',{conversationId:cid});}
    if(kind==='error'){ended=true;send('error',{message:'O assistente interrompeu a resposta. Tente novamente.'});}
   }
   try{while(true){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});buffer=buffer.replace(/\r\n/g,'\n');let pos;while((pos=buffer.indexOf('\n\n'))>=0){handle(buffer.slice(0,pos));buffer=buffer.slice(pos+2);}}if(buffer.trim())handle(buffer);if(!ended)send('done',{conversationId:cid});}
   catch{send('error',{message:'A conexão foi interrompida.'});}finally{controller.close();reader.releaseLock();}
  }});
  return new Response(stream,{status:200,headers:{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','X-Content-Type-Options':'nosniff',...cors}});
 }
};
