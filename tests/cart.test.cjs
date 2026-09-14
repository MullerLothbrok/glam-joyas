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
  const saved={'GJ-W026-1::':2,'GJ-N001::Rojo':1};
  assert.equal(core.read({getItem:()=>JSON.stringify(saved)},products).recovered,false);
  for(const p of products){if(p.consultOnly || (p.groupSkus?.length&&!p.groupSkus.includes(p.sku)))continue;for(const variant of p.variants?.length?p.variants:[''])assert.ok(core.resolve(core.key(p,variant),products));}
});

test('retired necklaces, onyx and consultation-only earrings cannot survive in saved orders',()=>{
  const saved={'GJ-W001::':1,'GJ-W002::':1,'GJ-N001::Ónix negro':1,'GJ-W018::':2,'GJ-W011::':1,'GJ-W011::Rosé':2};
  const result=core.read({getItem:()=>JSON.stringify(saved)},products);
  assert.equal(result.recovered,true);
  assert.deepEqual(Object.keys(result.cart),['GJ-W011::Rosé']);
  const summary=core.summarize(result.cart,products,rate);
  assert.equal(summary.total,153000);
  assert.match(core.message(summary,{name:'Prueba',delivery:'Retiro'},rate,String),/Rosé/);
  assert.equal(products.find(p=>p.sku==='GJ-W018').price,60000);
  assert.equal(core.discountedPrice(products.find(p=>p.sku==='GJ-W018'),rate),54000);
});

test('new selections retain their identity in WhatsApp and alphabet includes Ñ and Z',()=>{
  const selections={'GJ-W010::Plateado':1,'GJ-W013::Gold':1,'GJ-W022::Ñ':1,'GJ-W022::Z':1,'GJ-W015::Perla':1,'GJ-N012::Medio':1,'GJ-W025::Rosé':1};
  const summary=core.summarize(selections,products,rate);
  assert.equal(summary.count,7);
  const message=core.message(summary,{name:'Prueba',delivery:'Retiro'},rate,String);
  for(const label of ['Plateado','Gold','Ñ','Z','Perla','Medio','Rosé'])assert.ok(message.includes('— '+label+' ('));
  assert.equal(products.find(p=>p.sku==='GJ-W022').variants.length,27);
});
test('normal order totals and WhatsApp text agree with the promotion',()=>{
  const result=core.summarize({'GJ-W026-1::':1,'GJ-W026-2::':1,'GJ-W026-3::':2},products,rate);
  assert.equal(result.subtotal,370000);assert.equal(result.savings,37000);assert.equal(result.total,333000);assert.equal(result.count,4);
  const format=n=>'Gs. '+new Intl.NumberFormat('es-PY').format(n);
  const text=core.message(result,{name:'Prueba',delivery:'Retiro del local'},rate,format);
  assert.match(text,/Total de joyas con descuento: Gs\. 333\.000/);assert.match(text,/Envío, si corresponde: a confirmar/);assert.doesNotMatch(text,/Promociones: sí/);
  const other=core.summarize({'GJ-W026-1::':1},products,.2);assert.equal(other.total,64000);
});

test('complete stone set sums three current prices, preserves color and adds atomically',()=>{
  const members=['GJ-N001','GJ-N002','GJ-N003'].map(sku=>products.find(p=>p.sku===sku));
  for(const color of ['Rojo','Verde / Pastel','Violeta']) {
    const cart=core.addSet({},members,color,products);
    const result=core.summarize(cart,products,rate);
    assert.equal(result.count,3);assert.equal(result.subtotal,270000);assert.equal(result.total,243000);
    assert.ok(result.lines.every(line=>line.variant===color));
    assert.equal(core.summarize(core.addSet(cart,members,color,products),products,rate).total,486000);
    const text=core.message(result,{name:'Prueba'},rate,String);
    for(const p of members)assert.ok(text.includes(p.sku));
  }
  const limited={'GJ-N001::Rojo':99};
  assert.equal(core.addSet(limited,members,'Rojo',products),null);
  assert.deepEqual(limited,{'GJ-N001::Rojo':99});
  assert.equal(core.addSet({},members,'Ónix negro',products),null);
  for(const finish of ['Gold','Plateado'])assert.ok(core.resolve('GJ-N020::'+finish,products));
  assert.equal(core.resolve('GJ-N020::',products),null);
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
