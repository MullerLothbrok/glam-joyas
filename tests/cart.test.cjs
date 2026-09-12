const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const core = require('../cart-core.js');
const context = {window:{}};vm.createContext(context);
for(const file of ['products.js','config.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
const products = context.window.GLAM_PRODUCTS, rate = context.window.GLAM_CONFIG.promotionRate;
test('recovers malformed, null and inaccessible browser storage',()=>{
  for(const raw of ['{','null','[]','42','"text"']){const result=core.read({getItem:()=>raw},products);assert.deepEqual(Object.keys(result.cart),[]);assert.equal(result.recovered,true);}
  const result=core.read({getItem(){throw Error('denied');}},products);assert.equal(result.recovered,true);assert.deepEqual(Object.keys(result.cart),[]);
});
test('removes invalid quantities, missing products and invalid variants',()=>{
  for(const quantity of [-1,0,1.5,'2',null,Infinity,NaN]) assert.deepEqual(Object.keys(core.sanitize({'GJ-W026-1::':quantity},products)),[]);
  for(const key of ['OLD-SKU::','GJ-N016::<img src=x onerror=alert(1)>','GJ-N016::','GJ-PIEDRAS::','GJ-W026::','__proto__'])assert.deepEqual(Object.keys(core.sanitize({[key]:1},products)),[]);
  assert.equal(core.sanitize({'GJ-N016::Dorado':2},products)['GJ-N016::Dorado'],2);
  assert.equal(core.sanitize({'GJ-W026-1::':1000},products)['GJ-W026-1::'],99);
});
test('keeps existing valid cart selections and resolves all product options',()=>{
  const saved={'GJ-W026-1::':2,'GJ-N001::Ónix negro':1};
  assert.equal(core.read({getItem:()=>JSON.stringify(saved)},products).recovered,false);
  for(const p of products){if(p.groupSkus?.length&&!p.groupSkus.includes(p.sku))continue;for(const variant of p.variants?.length?p.variants:[''])assert.ok(core.resolve(core.key(p,variant),products));}
});
test('normal order totals and WhatsApp text agree with the promotion',()=>{
  const result=core.summarize({'GJ-W026-1::':1,'GJ-W026-2::':1,'GJ-W026-3::':2},products,rate);
  assert.equal(result.subtotal,370000);assert.equal(result.savings,37000);assert.equal(result.total,333000);assert.equal(result.count,4);
  const format=n=>'Gs. '+new Intl.NumberFormat('es-PY').format(n);
  const text=core.message(result,{name:'Prueba',delivery:'Retiro del local'},rate,format);
  assert.match(text,/Total de joyas con descuento: Gs\. 333\.000/);assert.match(text,/Envío, si corresponde: a confirmar/);assert.doesNotMatch(text,/Promociones: sí/);
  const other=core.summarize({'GJ-W026-1::':1},products,.2);assert.equal(other.total,64000);
});
test('removed products cannot prepare an empty WhatsApp order',()=>{
  const result=core.summarize({'OLD-SKU::':1},products,rate);assert.equal(result.count,0);
  assert.throws(()=>core.message(result,{name:'Prueba'},rate,String),/Carrito vacío/);
});
test('invoice and promotions are included only when selected',()=>{
  const result=core.summarize({'GJ-N016::Dorado':1},products,rate);
  const text=core.message(result,{name:'Prueba\nOtra línea',delivery:'Delivery',invoice:true,billName:'Prueba',ruc:'000-0',email:'test@example.com',promoConsent:true},rate,String);
  assert.match(text,/A nombre de: Prueba Otra línea/);assert.match(text,/Factura: Sí/);assert.match(text,/Promociones: sí/);assert.match(text,/Dorado/);
});
