'use strict';
const S=require('../lib/admin-security.cjs'),C=require('../lib/admin-catalog.cjs'),L=require('../lib/local-catalog.cjs');
function createHandler({gh=S.github,env=process.env}={}){return async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex, nofollow');res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('X-Content-Type-Options','nosniff');
 const send=(status,data)=>{res.statusCode=status;res.end(JSON.stringify(data));};
 try{
  const url=new URL(req.url,S.ORIGIN),action=url.searchParams.get('action');
  const methods={list:'GET',photo:'GET',save:'POST',publish:'POST'};
  if(!methods[action])return send(404,{error:'Operación no encontrada.'});if(req.method!==methods[action])return send(405,{error:'Método no permitido.'});
  const session=await S.authenticate(req,S.configuration(env),gh);if(req.method==='POST')S.csrf(req,session);
  if(action==='list'){const local=await L.read(gh,session.token),live=await C.readCatalog(gh,session.token);return send(200,{sha:local.sha,products:local.products,publicSha:live.sha,publicProducts:live.products});}
  if(action==='photo'){const state=await L.read(gh,session.token),bytes=await L.image(gh,session.token,state,url.searchParams.get('sku'));res.setHeader('Content-Type','image/jpeg');res.statusCode=200;return res.end(bytes);}
  if(!String(req.headers['content-type']||'').startsWith('application/json'))return send(415,{error:'Formato no permitido.'});
  let body=req.body;if(body===undefined){let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>1100000)throw new S.HttpError(413,'Usá una foto más pequeña.');chunks.push(chunk);}body=Buffer.concat(chunks).toString();}
  if(typeof body==='string'){if(Buffer.byteLength(body)>1100000)throw new S.HttpError(413,'Usá una foto más pequeña.');try{body=JSON.parse(body);}catch{throw new S.HttpError(400,'Datos inválidos.');}}
  if(!body||Buffer.byteLength(JSON.stringify(body))>1100000)throw new S.HttpError(400,'Datos inválidos.');
  return send(200,await L[action](gh,session.token,body));
 }catch(e){send(e.status||502,{error:e instanceof S.HttpError?e.message:'No se pudo conectar con la lista privada. Comprobá el acceso de la aplicación a glam-joyas-local. No se publicaron datos privados automáticamente.'});}
};}
module.exports=createHandler();module.exports.createHandler=createHandler;
