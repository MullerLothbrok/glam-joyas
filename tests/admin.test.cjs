const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const S=require('../lib/admin-security.cjs'),C=require('../lib/admin-catalog.cjs'),{createHandler}=require('../api/admin.js'),cart=require('../cart-core.js');
const products=C.parseProducts(fs.readFileSync(path.join(__dirname,'../products.js'),'utf8'));
const key=Buffer.alloc(32,9),env={GLAM_GITHUB_CLIENT_ID:'test-app',GLAM_GITHUB_CLIENT_SECRET:'test-only-secret',GLAM_SESSION_KEY:key.toString('hex')};
const session={uid:S.OWNER_ID,token:'test-token',csrf:'test-csrf',exp:Date.now()+60000};
const authCookie=S.SESSION+'='+S.seal(session,key,'session');
test('derived session key is stable, scoped to the app, and rotates with its secret',()=>{
 const config={GLAM_GITHUB_CLIENT_ID:'app-a',GLAM_GITHUB_CLIENT_SECRET:'github-generated-secret-a'};
 const a=S.configuration(config).key;assert.equal(a.length,32);assert.deepEqual(a,S.configuration(config).key);
 assert.notDeepEqual(a,S.configuration({...config,GLAM_GITHUB_CLIENT_ID:'app-b'}).key);
 const b=S.configuration({...config,GLAM_GITHUB_CLIENT_SECRET:'github-generated-secret-b'}).key;
 assert.throws(()=>S.unseal(S.seal(session,a,'session'),b,'session'));
 assert.throws(()=>S.configuration({...config,GLAM_SESSION_KEY:'bad'}));
});
const edit=p=>({sku:p.sku,name:p.name,category:p.category,price:p.price,image:p.image,available:p.available!==false,archived:!!p.archived,variants:p.variants||[],optionAvailability:Object.fromEntries((p.variants||[]).map(v=>[v,true]))});
async function invoke(handler,action,{method='GET',headers={},body}={}){const response={headers:{},setHeader(k,v){this.headers[k]=v;},end(v){this.text=v||'';}};await handler({url:'/api/admin?action='+action,method,headers,body},response);return response;}
test('missing configuration fails closed; anonymous users cannot read or publish',async()=>{
 let calls=0;const gh=async()=>{calls++;return{id:S.OWNER_ID};};
 assert.equal((await invoke(createHandler({gh,env:{}}),'catalog')).statusCode,503);
 for(const [action,method] of [['catalog','GET'],['session','GET'],['publish','POST']])assert.equal((await invoke(createHandler({gh,env}),action,{method})).statusCode,401);
 assert.equal(calls,0);
});
test('session encryption detects tampering, expiry and wrong purpose',()=>{
 const value=S.seal(session,key,'session');assert.equal(S.unseal(value,key,'session').token,session.token);
 const bytes=Buffer.from(value,'base64url');bytes[20]^=1;
 assert.throws(()=>S.unseal(bytes.toString('base64url'),key,'session'));
 assert.throws(()=>S.unseal(value,key,'flow'));
 assert.throws(()=>S.unseal(value,key,'session',session.exp));
 assert.doesNotMatch(value,/test-token/);
});
test('only the immutable GitHub owner ID is accepted; revoked tokens fail',async()=>{
 const handler=createHandler({env,gh:async()=>({id:42,login:'MullerLothbrok'})});
 assert.equal((await invoke(handler,'session',{headers:{cookie:authCookie}})).statusCode,403);
 const revoked=createHandler({env,gh:async()=>{throw new S.HttpError(401,'Revoked');}});
 assert.equal((await invoke(revoked,'session',{headers:{cookie:authCookie}})).statusCode,401);
});
test('CSRF checks require the production origin AND a session token',async()=>{
 const handler=createHandler({env,gh:async()=>({id:S.OWNER_ID})});
 for(const headers of [{cookie:authCookie},{cookie:authCookie,origin:'https://evil.example','x-glam-csrf':session.csrf},{cookie:authCookie,origin:S.ORIGIN,'x-glam-csrf':'wrong'}])assert.equal((await invoke(handler,'logout',{method:'POST',headers,body:{}})).statusCode,403);
 const result=await invoke(handler,'logout',{method:'POST',headers:{cookie:authCookie,origin:S.ORIGIN,'x-glam-csrf':session.csrf},body:{}});
 assert.equal(result.statusCode,200);assert.match(result.headers['Set-Cookie'],/HttpOnly; Secure; SameSite=Lax; Max-Age=0/);
});
test('login uses state and PKCE, callback rejects mismatched state before token exchange',async()=>{
 let exchanges=0;const handler=createHandler({env,fetcher:async()=>{exchanges++;throw Error();}});
 const login=await invoke(handler,'login');const url=new URL(login.headers.Location);
 assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.ok(url.searchParams.get('state'));
 const cookie=login.headers['Set-Cookie'].split(';')[0];
 assert.equal((await invoke(handler,'callback&state=wrong&code=bad',{headers:{cookie}})).statusCode,403);assert.equal(exchanges,0);
});
test('catalog parser does not execute JavaScript and serialization round trips',()=>{
 assert.deepEqual(C.parseProducts(C.serialize(products)),products);
 assert.throws(()=>C.parseProducts('window.GLAM_PRODUCTS = []; process.exit();'));
 assert.throws(()=>C.parseProducts('window.GLAM_PRODUCTS = (() => [])();'));
});
test('edits preserve protected metadata, enforce integer prices, and reject unsafe images',()=>{
 const product=products.find(p=>p.sku==='GJ-W018'),change=edit(product);change.price=70000;change.consultOnly=false;change.groupSkus=['evil'];
 const result=C.validateEdits([change],products).products.find(p=>p.sku===product.sku);
 assert.equal(result.price,70000);assert.equal(result.consultOnly,true);assert.equal(result.groupSkus,undefined);
 for(const price of [0,-1,1.2,NaN,1e12])assert.throws(()=>C.validateEdits([{...change,price}],products));
 for(const image of ['https://evil.example/a.jpg','data:image/svg+xml;base64,PHN2Zz4=','/api/admin'])assert.throws(()=>C.validateEdits([{...change,image}],products));
 assert.throws(()=>C.validateEdits([change,change],products));
});
test('availability invalidates saved cart lines, individual colors and complete sets',()=>{
 const list=structuredClone(products),p=list.find(p=>p.sku==='GJ-N020'),variant=p.variants[0],k=cart.key(p,variant);
 assert.ok(cart.resolve(k,list));p.optionAvailability={[variant]:false};assert.equal(cart.resolve(k,list),null);
 p.optionAvailability={};p.archived=true;assert.equal(cart.resolve(k,list),null);
 const collection=list.find(p=>p.stoneCollection),members=collection.groupSkus.map(sku=>list.find(p=>p.sku===sku)),color=collection.colors[0];
 members[1].available=false;assert.equal(cart.addSet({},members,color,list),null);
 members[1].available=true;collection.archived=true;assert.equal(cart.resolve(cart.key(members[0],color),list),null);
 assert.deepEqual(Object.keys(cart.sanitize({[cart.key(members[0],color)]:2},list)),[]);
});
test('a sold-out first model does not disable its available siblings',()=>{
 const list=structuredClone(products),parent=list.find(p=>p.sku==='GJ-W033A');
 parent.available=false;const sibling=list.find(p=>p.sku===parent.groupSkus[1]);
 assert.equal(cart.resolve(cart.key(parent),list),null);assert.ok(cart.resolve(cart.key(sibling),list));
 parent.archived=true;assert.equal(cart.resolve(cart.key(sibling),list),null);
});
function mockGit({sha='a'.repeat(40),race=false}={}) {
 const writes=[];
 const gh=async(token,url,method='GET',body)=>{
  if(method!=='GET'){writes.push({url,method,body});if(url.endsWith('/git/trees'))return{sha:'c'.repeat(40)};if(url.endsWith('/git/commits'))return{sha:'d'.repeat(40)};if(url.endsWith('/git/refs/heads/main')){if(race)throw new S.HttpError(409,'Concurrent update');return{};}throw Error('unexpected mutation');}
  if(url.endsWith('/git/ref/heads/main'))return{object:{sha}};
  if(url.includes('/git/commits/'))return{tree:{sha:'b'.repeat(40)}};
  if(url.includes('/git/trees/'))return{tree:[{path:'products.js',type:'blob',sha:'e'.repeat(40)}]};
  if(url.includes('/git/blobs/'))return{content:Buffer.from(C.serialize(products)).toString('base64')};
  throw Error('unexpected read');
 };return{gh,writes};
}
test('publication rejects stale drafts without writing and preserves base tree',async()=>{
 const stale=mockGit();await assert.rejects(()=>C.publish(stale.gh,'t',{baseSha:'f'.repeat(40),edits:[edit(products[0])]}));assert.equal(stale.writes.length,0);
 const current=mockGit();const result=await C.publish(current.gh,'t',{baseSha:'a'.repeat(40),edits:[{...edit(products[0]),price:200000}]});
 assert.equal(result.sha,'d'.repeat(40));assert.equal(current.writes[0].body.base_tree,'b'.repeat(40));assert.deepEqual(current.writes[0].body.tree.map(e=>e.path),['products.js']);
 assert.deepEqual(current.writes[1].body.parents,['a'.repeat(40)]);assert.equal(current.writes[2].body.force,false);
});
test('publication never forces an update when another writer wins the race',async()=>{
 const race=mockGit({race:true});await assert.rejects(()=>C.publish(race.gh,'t',{baseSha:'a'.repeat(40),edits:[edit(products[0])]}),error=>error.status===409);
 assert.equal(race.writes.at(-1).body.force,false);
});
