<?php
/** Backend PHP para hospedagem cPanel. Requer PHP 8.0+ e cURL ativo.
  * Coloque este arquivo em public_html/api/chat.php.
  * A chave fica em private/config.php, FORA de public_html.
  */
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function fail(int $status,string $message): void {http_response_code($status);echo json_encode(['error'=>$message],JSON_UNESCAPED_UNICODE);exit;}
if($_SERVER['REQUEST_METHOD']!=='POST')fail(405,'Método não permitido.');
if(isset($_SERVER['HTTP_ORIGIN'])){
  $originHost=parse_url($_SERVER['HTTP_ORIGIN'],PHP_URL_HOST);
  $siteHost=explode(':',$_SERVER['HTTP_HOST']??'')[0];
  if(!$originHost || strcasecmp((string)$originHost,$siteHost)!==0) fail(403,'Origem não autorizada.');
}
$configFile=__DIR__.'/../../private/config.php';
if(!is_file($configFile))fail(503,'Configuração da API pendente.');
$config=require $configFile;
$key=$config['DIFY_API_KEY']??'';
if(!is_string($key)||!$key||str_contains($key,'COLE_A_CHAVE'))fail(503,'A chave do Chatflow ainda não foi configurada.');
$raw=file_get_contents('php://input',false,null,0,16001);
if($raw===false||strlen($raw)>16000)fail(400,'Mensagem muito longa.');
$payload=json_decode($raw,true);
if(!is_array($payload))fail(400,'Formato JSON inválido.');
$query=trim((string)($payload['query']??''));
$user=trim((string)($payload['user']??''));
$conversationId=trim((string)($payload['conversationId']??''));
if($query===''||(function_exists('mb_strlen')?mb_strlen($query):strlen($query))>3000||!preg_match('/^[a-zA-Z0-9_-]{1,100}$/',$user)||!preg_match('/^[a-zA-Z0-9-]{0,100}$/',$conversationId))fail(400,'Dados inválidos.');
if(!function_exists('curl_init'))fail(503,'Extensão cURL indisponível na hospedagem.');
$base=rtrim((string)($config['DIFY_API_BASE_URL']??'https://api.dify.ai/v1'),'/');
$body=json_encode(['query'=>$query,'inputs'=>(object)[],'conversation_id'=>$conversationId,'user'=>$user,'response_mode'=>'blocking'],JSON_UNESCAPED_UNICODE);
$ch=curl_init($base.'/chat-messages');
curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>$body,CURLOPT_RETURNTRANSFER=>true,CURLOPT_HTTPHEADER=>['Authorization: Bearer '.$key,'Content-Type: application/json'],CURLOPT_CONNECTTIMEOUT=>15,CURLOPT_TIMEOUT=>110,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_SSL_VERIFYPEER=>true]);
$result=curl_exec($ch);$status=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);
if($result===false||$status<200||$status>=300)fail($status===429?429:502,'Não foi possível obter a resposta do assistente. Tente novamente.');
$data=json_decode($result,true);
if(!is_array($data)||!isset($data['answer'])||!is_string($data['answer']))fail(502,'O assistente retornou uma resposta inesperada.');
echo json_encode(['answer'=>$data['answer'],'conversationId'=>(string)($data['conversation_id']??'')],JSON_UNESCAPED_UNICODE);
