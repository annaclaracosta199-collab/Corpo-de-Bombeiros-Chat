/** Consulta SAT UniCerrado — servidor Node.js, sem dependências externas.
 * Requer Node.js 20+, DIFY_API_KEY e URL do Chatflow.
 * Executar localmente: node --env-file=.env server.mjs (Node 22+).
 */
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, stat } from 'node:fs/promises';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../site');
const PORT = Number(process.env.PORT || '3000');
const BASE = (process.env.DIFY_API_BASE_URL || 'https://api.dify.ai/v1').replace(/\/+$/, '');
const KEY = process.env.DIFY_API_KEY || '';
const MINUTE_LIMIT = Math.max(1, Math.min(100, Number(process.env.REQUESTS_PER_MINUTE || 12)));
const timers = new Map();
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'};

function json(res, code, obj){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj));}
function emit(res,event,data){res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);}
function originValid(req){if(!req.headers.origin)return true;try{const origin=new URL(req.headers.origin),host=req.headers.host;return origin.host===host;}catch{return false;}}
function allow(ip){const now=Date.now();let q=timers.get(ip)||[];q=q.filter(ts=>now-ts<60000);if(q.length>=MINUTE_LIMIT){timers.set(ip,q);return false;}q.push(now);timers.set(ip,q);return true;}
function cleanTimers(){const now=Date.now();for(const [ip,arr] of timers){if(arr[arr.length-1]<now-90000)timers.delete(ip);}}
function readJson(req){return new Promise((resolve,reject)=>{let text='';req.on('data',chunk=>{text+=chunk;if(text.length>16000){reject(new Error('body_size'));req.destroy();}});req.on('end',()=>{try{resolve(JSON.parse(text));}catch{reject(new Error('invalid_json'));}});req.on('error',reject);});}
function prepareBody(data){const question=typeof data?.query==='string'?data.query.trim():'';const cid=typeof data?.conversationId==='string'?data.conversationId.trim():'';const user=typeof data?.user==='string'?data.user.trim():'';
 if(!question||question.length>3000||cid.length>100||!/^[-a-zA-Z0-9_]{1,100}$/.test(user)||!/^[a-zA-Z0-9-]*$/.test(cid))return null;
 return {query:question,inputs:{},response_mode:'streaming',conversation_id:cid,user};
}
async function serveFile(req,res,pathname){let decoded;try{decoded=decodeURIComponent(pathname);}catch{return json(res,400,{error:'Caminho inválido.'});}
 if(decoded.includes('\0'))return json(res,400,{error:'Caminho inválido.'});
 const filename=path.resolve(ROOT,'.'+(decoded==='/'?'/index.html':decoded));
 if(!(filename===ROOT||filename.startsWith(ROOT+path.sep)))return json(res,403,{error:'Acesso negado.'});
 const ext=path.extname(filename).toLowerCase();if(!types[ext])return json(res,404,{error:'Arquivo não encontrado.'});
 try{const metadata=await stat(filename);if(!metadata.isFile())throw new Error('not file');const bytes=await readFile(filename);res.writeHead(200,{'Content-Type':types[ext],'Cache-Control':ext==='.html'||ext==='.js'?'no-cache':'public, max-age=3600','Content-Length':bytes.length});if(req.method==='HEAD')res.end();else res.end(bytes);}catch{json(res,404,{error:'Arquivo não encontrado.'});}
}
async function sendChat(req,res){
 if(!originValid(req))return json(res,403,{error:'Origem não autorizada.'});
 const ip=req.socket.remoteAddress||'unknown';if(!allow(ip))return json(res,429,{error:'Muitas perguntas em pouco tempo. Aguarde um minuto e tente novamente.'});
 if(!KEY)return json(res,503,{error:'A integração com o Dify ainda não foi configurada pela equipe.'});
 if(!req.headers['content-type']?.includes('application/json'))return json(res,415,{error:'Envie dados JSON.'});
 let data;try{data=await readJson(req);}catch{return json(res,400,{error:'Não foi possível ler sua pergunta.'});}
 const body=prepareBody(data);if(!body)return json(res,400,{error:'Pergunta ou dados de conversa inválidos.'});
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),150000);
 let upstream;
 try{upstream=await fetch(BASE+'/chat-messages',{method:'POST',headers:{Authorization:'Bearer '+KEY,'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});}
 catch{clearTimeout(timeout);return json(res,502,{error:'Não foi possível se comunicar com o assistente. Tente novamente.'});}
 if(!upstream.ok){clearTimeout(timeout);const code=upstream.status===429?429:502;return json(res,code,{error:code===429?'O serviço está recebendo muitas solicitações. Tente mais tarde.':'O Dify não conseguiu processar esta solicitação. Confira a configuração do Chatflow.'});}
 res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});res.flushHeaders?.();
 const reader=upstream.body.getReader();const decoder=new TextDecoder();let buffer='';let conversationId=body.conversation_id;let ended=false;
 function handle(block){let eventName='';const data=[];
   for(const line of block.replace(/\r/g,'').split('\n')){if(line.startsWith('event:'))eventName=line.slice(6).trim();else if(line.startsWith('data:'))data.push(line.slice(5).trimStart());}
   if(!data.length)return;let msg;try{msg=JSON.parse(data.join('\n'));}catch{return;}
   const type=msg.event||eventName;if(typeof msg.conversation_id==='string')conversationId=msg.conversation_id;
   if(type==='message'||type==='agent_message'){if(typeof msg.answer==='string')emit(res,'delta',{text:msg.answer});}
   if(type==='message_end'){ended=true;emit(res,'done',{conversationId});}
   if(type==='message_replace' && typeof msg.answer==='string'){emit(res,'error',{message:'A resposta foi atualizada pelo serviço. Inicie uma nova conversa.'});ended=true;}
   if(type==='error'){ended=true;emit(res,'error',{message:'O serviço de IA interrompeu a resposta. Tente novamente.'});}
 }
 try{while(true){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});buffer=buffer.replace(/\r\n/g,'\n');let i;while((i=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,i);buffer=buffer.slice(i+2);handle(block);}}if(buffer.trim())handle(buffer);if(!ended)emit(res,'done',{conversationId});}
 catch{if(!res.writableEnded)emit(res,'error',{message:'A conexão foi interrompida. Tente novamente.'});}
 finally{clearTimeout(timeout);controller.abort();res.end();}
}
const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');
 res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
 let pathname;try{pathname=new URL(req.url,'http://localhost').pathname;}catch{return json(res,400,{error:'Requisição inválida.'});}
 if(pathname==='/api/chat')return req.method==='POST'?sendChat(req,res):json(res,405,{error:'Método não permitido.'});
 if(req.method!=='GET' && req.method!=='HEAD')return json(res,405,{error:'Método não permitido.'});
 if(Date.now()%7===0)cleanTimers();
 return serveFile(req,res,pathname);
});
server.listen(PORT,'0.0.0.0',()=>console.log(`Consulta SAT iniciado em http://localhost:${PORT} — ${KEY?'API configurada':'API não configurada'}`));
