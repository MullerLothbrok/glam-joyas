'use strict';
const C=require('./admin-catalog.cjs');
const {HttpError,OWNER_ID,REPO}=require('./admin-security.cjs');
const PRIVATE_REPO='MullerLothbrok/glam-joyas-local',root='/repos/'+PRIVATE_REPO;
const fail=(status,message)=>{throw new HttpError(status,message);};
async function read(gh,token){
 const repo=await gh(token,root);
 if(repo.private!==true||repo.owner?.id!==OWNER_ID)fail(403,'El archivo del local debe ser privado y pertenecer a tu cuenta.');
 const branch=repo.default_branch;
 const ref=await gh(token,root+'/git/ref/heads/'+encodeURIComponent(branch));
 const commit=await gh(token,root+'/git/commits/'+ref.object.sha);
 const tree=await gh(token,root+'/git/trees/'+commit.tree.sha);
 const entry=tree.tree.find(x=>x.path==='catalog.json');let products=[];
 if(entry){const blob=await gh(token,root+'/git/blobs/'+entry.sha);products=JSON.parse(Buffer.from(blob.content.replace(/\s/g,''),'base64').toString());}
 if(!Array.isArray(products))fail(409,'El archivo del local necesita revisión.');
 return {sha:ref.object.sha,tree:commit.tree.sha,branch,products};
}
async function image(gh,token,state,sku){
 const p=state.products.find(x=>x.sku===sku);if(!p?.photoSha)fail(404,'Foto no encontrada.');
 const blob=await gh(token,root+'/git/blobs/'+p.photoSha);
 const bytes=Buffer.from(blob.content.replace(/\s/g,''),'base64');C.jpegSize(bytes);return bytes;
}
async function save(gh,token,body){
 const state=await read(gh,token);
 if(body.baseSha!==state.sha)fail(409,'La lista cambió. Recargá antes de guardar; tus datos siguen en el formulario.');
 const live=await C.readCatalog(gh,token),edit=body.product;
 if(!edit||live.products.some(p=>p.sku.toLowerCase()===String(edit.sku).toLowerCase()))fail(409,'Este código ya está en la web. Editalo desde el panel del catálogo.');
 const old=state.products.find(p=>p.sku===edit.sku);
 // Reuse public input validation, but never write private records into the public repository.
 const candidate={...edit,image:edit.photo||old?.image};
 const current=[...live.products,...state.products];
 const result=C.validateEdits([candidate],current);
 const valid=result.products.find(p=>p.sku===edit.sku);
 const p={sku:valid.sku,name:valid.name,category:valid.category,price:valid.price,variants:valid.variants,available:valid.available,archived:valid.archived,optionAvailability:valid.optionAvailability,image:valid.image,...(old?.photoSha?{photoSha:old.photoSha}:{})};
 const entries=[];
 for(const [path,content] of result.images){const blob=await gh(token,root+'/git/blobs','POST',{encoding:'base64',content});p.photoSha=blob.sha;entries.push({path:'photos/'+blob.sha+'.jpg',mode:'100644',type:'blob',sha:blob.sha});}
 if(!p.photoSha)fail(400,'Agregá una foto.');
 const products=state.products.filter(x=>x.sku!==p.sku);products.push(p);
 entries.push({path:'catalog.json',mode:'100644',type:'blob',content:JSON.stringify(products,null,2)});
 const tree=await gh(token,root+'/git/trees','POST',{base_tree:state.tree,tree:entries});
 const commit=await gh(token,root+'/git/commits','POST',{message:'Guardar producto privado del local',tree:tree.sha,parents:[state.sha]});
 await gh(token,root+'/git/refs/heads/'+encodeURIComponent(state.branch),'PATCH',{sha:commit.sha,force:false});
 return {sha:commit.sha,products};
}
async function publish(gh,token,body){
 const state=await read(gh,token);if(body.baseSha!==state.sha)fail(409,'La lista cambió. Recargá y revisá la pieza antes de publicarla.');
 const p=state.products.find(p=>p.sku===body.sku);if(!p||p.archived)fail(400,'Elegí una pieza activa del local.');
 const live=await C.readCatalog(gh,token);
 if(live.products.some(x=>x.sku.toLowerCase()===p.sku.toLowerCase()))fail(409,'Esta pieza ya está en la web. No se volvió a publicar.');
 if(live.sha!==body.publicSha)fail(409,'El catálogo web cambió. Recargá y revisá antes de publicar.');
 const bytes=await image(gh,token,state,p.sku);
 const edit={sku:p.sku,name:p.name,category:p.category,price:p.price,variants:p.variants,available:p.available,archived:false,optionAvailability:p.optionAvailability,image:'data:image/jpeg;base64,'+bytes.toString('base64')};
 // Explicit publication is the only path allowed to transfer a private product to the public repo.
 return C.publish(gh,token,{baseSha:live.sha,edits:[edit]});
}
module.exports={PRIVATE_REPO,read,image,save,publish};
