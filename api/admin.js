'use strict';
const crypto = require('node:crypto');
const S = require('../lib/admin-security.cjs');
const C = require('../lib/admin-catalog.cjs');
const random = () => crypto.randomBytes(32).toString('base64url');
function createHandler({gh=S.github,fetcher=fetch,env=process.env}={}) {
  return async function handler(req,res) {
    res.setHeader('Cache-Control','no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');
    res.setHeader('X-Robots-Tag','noindex, nofollow');res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Type','application/json; charset=utf-8');
    const send=(status,value)=>{res.statusCode=status;res.end(JSON.stringify(value));};
    const redirect=location=>{res.statusCode=303;res.setHeader('Location',location);res.end();};
    try {
      const url=new URL(req.url,S.ORIGIN),action=url.searchParams.get('action');
      const methods={login:'GET',callback:'GET',session:'GET',catalog:'GET',status:'GET',publish:'POST',logout:'POST'};
      if(!methods[action])return send(404,{error:'Operación no encontrada.'});
      if(req.method!==methods[action])return send(405,{error:'Método no permitido.'});
      const config=S.configuration(env);
      if(action==='login') {
        const state=random(),verifier=random(),exp=Date.now()+600000;
        res.setHeader('Set-Cookie',S.cookie(S.FLOW,S.seal({state,verifier,exp},config.key,'flow'),600));
        const query=new URLSearchParams({client_id:config.clientId,redirect_uri:S.ORIGIN+'/api/admin?action=callback',state,code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',login:'MullerLothbrok',allow_signup:'false'});
        return redirect('https://github.com/login/oauth/authorize?'+query);
      }
      if(action==='callback') {
        const flow=S.unseal(S.cookies(req)[S.FLOW],config.key,'flow');
        res.setHeader('Set-Cookie',S.cookie(S.FLOW,'',0));
        if(!S.equal(url.searchParams.get('state'),flow.state)||!url.searchParams.get('code'))throw new S.HttpError(403,'No se pudo validar el inicio de sesión. Volvé a ingresar.');
        const response=await fetcher('https://github.com/login/oauth/access_token',{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({client_id:config.clientId,client_secret:config.clientSecret,code:url.searchParams.get('code'),redirect_uri:S.ORIGIN+'/api/admin?action=callback',code_verifier:flow.verifier})});
        const token=await response.json();
        if(!response.ok||!token.access_token)throw new S.HttpError(401,'No se pudo iniciar sesión con GitHub.');
        const user=await gh(token.access_token,'/user');
        if(user.id!==S.OWNER_ID)throw new S.HttpError(403,'Esta cuenta no tiene acceso al panel de Glam.');
        const repo=await gh(token.access_token,'/repos/'+S.REPO);
        if(!repo.permissions?.push)throw new S.HttpError(403,'Instalá la aplicación de Glam en el repositorio glam-joyas con permiso de contenido.');
        const seconds=Math.min(14400,Number(token.expires_in)||14400);
        const session={uid:user.id,token:token.access_token,csrf:random(),exp:Date.now()+seconds*1000};
        res.setHeader('Set-Cookie',[S.cookie(S.FLOW,'',0),S.cookie(S.SESSION,S.seal(session,config.key,'session'),seconds)]);
        return redirect('/admin');
      }
      const session=await S.authenticate(req,config,gh);
      if(req.method==='POST')S.csrf(req,session);
      if(action==='session')return send(200,{login:'MullerLothbrok',csrf:session.csrf});
      if(action==='logout'){res.setHeader('Set-Cookie',S.cookie(S.SESSION,'',0));return send(200,{ok:true});}
      if(action==='catalog'){const data=await C.readCatalog(gh,session.token);return send(200,{sha:data.sha,products:data.products});}
      if(action==='status'){
        const sha=url.searchParams.get('sha');if(!/^[a-f0-9]{40}$/.test(sha||''))throw new S.HttpError(400,'Versión inválida.');
        const result=await gh(session.token,'/repos/'+S.REPO+'/commits/'+sha+'/status');
        const vercel=(result.statuses||[]).find(s=>s.context==='Vercel');
        return send(200,{state:vercel?.state||'pending'});
      }
      if(action==='publish'){
        if(!String(req.headers['content-type']||'').startsWith('application/json'))throw new S.HttpError(415,'Formato no permitido.');
        let body=req.body;
        if(body===undefined){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>3500000)throw new S.HttpError(413,'Publicá menos fotos a la vez.');chunks.push(chunk);}body=Buffer.concat(chunks).toString();}
        if(typeof body==='string'){if(Buffer.byteLength(body)>3500000)throw new S.HttpError(413,'Publicá menos fotos a la vez.');try{body=JSON.parse(body);}catch{throw new S.HttpError(400,'Datos inválidos.');}}
        if(Buffer.byteLength(JSON.stringify(body||{}))>3500000)throw new S.HttpError(413,'Publicá menos fotos a la vez.');
        return send(200,await C.publish(gh,session.token,body));
      }
    } catch(error) {
      // Do not log requests, authorization codes, cookies, GitHub responses or credentials.
      send(error.status||502,{error:error instanceof S.HttpError?error.message:'La conexión no se completó. Tu borrador sigue en este navegador. Antes de reintentar, recargá para comprobar si llegó a publicarse.'});
    }
  };
}
module.exports=createHandler();
module.exports.createHandler=createHandler;
