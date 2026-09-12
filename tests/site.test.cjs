const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
test('page resources, metadata and JSON-LD are valid under CSP',()=>{
  const csp=JSON.parse(read('vercel.json')).headers[0].headers.find(h=>h.key==='Content-Security-Policy').value;
  assert.match(csp,/script-src-attr 'none'/);assert.match(csp,/frame-ancestors 'none'/);assert.doesNotMatch(csp,/script-src[^;]*unsafe-inline/);
  for(const file of ['index.html','informacion.html']){const html=read(file);assert.match(html,/rel="canonical"/);assert.match(html,/og:image/);assert.doesNotMatch(html,/\son(?:click|change|error|load)=/);
    for(const match of html.matchAll(/(?:src|href)="(\/[^"?#]*)(?:\?[^"#]*)?(?:#[^"]*)?"/g)){let resource=match[1].slice(1)||'index.html';if(resource==='informacion')resource+='\.html';assert.ok(fs.existsSync(path.join(root,resource)),file+': '+resource);}
    const json=html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];assert.equal(JSON.parse(json)['@type'],'JewelryStore');const hash=crypto.createHash('sha256').update(json).digest('base64');assert.ok(csp.includes('sha256-'+hash));
  }
});
test('catalog data is unique and every image variant exists locally',()=>{
  const c={window:{}};vm.createContext(c);for(const f of ['products.js','image-manifest.js'])vm.runInContext(read(f),c);
  const p=c.window.GLAM_PRODUCTS;assert.equal(p.length,65);assert.equal(p.filter(x=>!x.hidden).length,57);assert.equal(new Set(p.map(x=>x.sku)).size,p.length);
  for(const x of p){assert.ok(Number.isSafeInteger(x.price)&&x.price>0);for(const sku of x.groupSkus||[])assert.ok(p.some(x=>x.sku===sku));for(const url of [x.image,...Object.values(x.variantImages||{}),...Object.values(x.colorPhotos||{})]){assert.ok(c.window.GLAM_IMAGES[url]);assert.ok(fs.existsSync(path.join(root,url)));}}
  for(const item of Object.values(c.window.GLAM_IMAGES))for(const variant of item.srcset.split(', '))assert.ok(fs.existsSync(path.join(root,variant.split(' ')[0])));
});
test('preview and developer files are excluded from deployment',()=>{
  const ignore=read('.vercelignore');for(const item of ['typography-preview.html','tests','tools','.env*'])assert.ok(ignore.includes(item));
  assert.match(read('robots.txt'),/Sitemap: https:\/\/glam-joyas.vercel.app\/sitemap.xml/);assert.match(read('sitemap.xml'),/<loc>https:\/\/glam-joyas.vercel.app\/informacion<\/loc>/);
});
