'use strict';
const crypto = require('node:crypto');
const {HttpError, REPO} = require('./admin-security.cjs');
const fail = message => {throw new HttpError(400,message);};
const plain = value => value && typeof value==='object' && !Array.isArray(value) && Object.getPrototypeOf(value)===Object.prototype;
function parseProducts(source) {
  // Parse data, never execute JavaScript obtained from the repository or browser.
  const match = source.match(/^\s*(?:\/\/[^\n]*\n\s*)*window\.GLAM_PRODUCTS\s*=\s*([\s\S]*?)\s*;?\s*$/);
  if (!match) throw new HttpError(409,'El formato del catálogo cambió. Necesita una revisión antes de editar.');
  let products; try {products=JSON.parse(match[1]);} catch {throw new HttpError(409,'No se pudo leer el catálogo.');}
  if (!Array.isArray(products)) throw new HttpError(409,'El catálogo no es válido.');
  return products;
}
const serialize = products => '// Catálogo: precios base en guaraníes; el descuento se configura en config.js.\nwindow.GLAM_PRODUCTS = '+JSON.stringify(products,null,2).replace(/</g,'\\u003c')+';\n';
function text(value, limit, label) {if(typeof value!=='string'||!value.trim()||value.length>limit||/[\u0000-\u001f]/.test(value))fail('Revisá '+label+'.');return value.trim();}
function jpegSize(buffer) {
  if (buffer.length<10 || buffer[0]!==255 || buffer[1]!==216 || buffer.at(-2)!==255 || buffer.at(-1)!==217) fail('La foto debe ser una imagen JPEG válida.');
  let pos=2;
  while(pos+9<buffer.length) {
    if(buffer[pos++]!==255) break;
    let marker=buffer[pos++]; while(marker===255)marker=buffer[pos++];
    if(marker===0xda||marker===0xd9)break;
    const length=buffer.readUInt16BE(pos); if(length<2||pos+length>buffer.length)break;
    if([0xc0,0xc1,0xc2].includes(marker)) {
      const height=buffer.readUInt16BE(pos+3),width=buffer.readUInt16BE(pos+5);
      if(width<1||height<1||width>1600||height>1600)fail('La foto supera las dimensiones permitidas.');
      return {width,height};
    }
    pos+=length;
  }
  fail('No se pudo validar la foto.');
}
function photo(value, original) {
  if (value===original && typeof value==='string' && value.startsWith('/assets/')) return {path:value};
  const match = typeof value==='string' && value.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/);
  if(!match)fail('Elegí una foto desde el panel.');
  const bytes=Buffer.from(match[1],'base64');
  if(bytes.length>700000||bytes.toString('base64')!==match[1])fail('La foto es demasiado grande.');
  jpegSize(bytes);
  return {path:'/assets/catalog/'+crypto.createHash('sha256').update(bytes).digest('hex')+'.jpg',content:match[1]};
}
function validateEdits(input, current) {
  if(!Array.isArray(input)||!input.length||input.length>100)fail('Elegí entre 1 y 100 productos para publicar.');
  const products=structuredClone(current), images=new Map(),seen=new Set();
  const categories=new Set(current.map(p=>p.category));
  for(const edit of input) {
    if(!plain(edit))fail('Producto inválido.');
    const sku=text(edit.sku,40,'el código');
    if(!/^[A-Za-z0-9-]+$/.test(sku)||seen.has(sku))fail('Código repetido o inválido.');seen.add(sku);
    const index=products.findIndex(p=>p.sku===sku), old=index<0?null:products[index];
    if(!old&&products.some(p=>p.sku.toLowerCase()===sku.toLowerCase()))fail('El código ya existe.');
    const p=old?structuredClone(old):{sku,stock:'En stock',material:'',variants:[]};
    p.name=text(edit.name,140,'el nombre');p.category=text(edit.category,100,'la categoría');
    if(!categories.has(p.category))fail('Elegí una categoría del catálogo.');
    if(!Number.isSafeInteger(edit.price)||edit.price<1||edit.price>999999999)fail('El precio debe ser un entero positivo.');p.price=edit.price;
    if(p.consultOnly && old.price!==p.price)p.priceNote='El precio varía según el tamaño. Consultá disponibilidad y precio de cada tamaño por WhatsApp.';
    for(const key of ['available','archived']) {if(typeof edit[key]!=='boolean')fail('Revisá la disponibilidad del producto.');p[key]=edit[key];}
    if(!Array.isArray(edit.variants)||edit.variants.length>60)fail('Revisá las opciones.');
    const variants=edit.variants.map(v=>text(v,60,'las opciones'));
    if(new Set(variants.map(v=>v.toLowerCase())).size!==variants.length)fail('Las opciones no pueden repetirse.');
    // Group structure, price notes, consultation rules and photo maps cannot be changed by this API.
    if(old?.groupSkus?.length && JSON.stringify(variants)!==JSON.stringify(old.variants||[]))fail('Las opciones de esta colección se gestionan por pieza.');
    p.variants=variants;
    if(!plain(edit.optionAvailability))fail('Revisá el estado de las opciones.');
    p.optionAvailability=Object.fromEntries(variants.map(v=>{const state=edit.optionAvailability[v];if(typeof state!=='boolean')fail('Revisá el estado de '+v+'.');return[v,state];}));
    if(JSON.stringify(p.variants)!==JSON.stringify(old?.variants||[]))delete p.variantSummary;
    const image=photo(edit.image,old?.image);p.image=image.path;if(image.content)images.set(image.path.slice(1),image.content);
    if(!old && !image.content)fail('Agregá una foto.');
    if(index<0)products.push(p);else products[index]=p;
  }
  // Do not permit removing all variants from a piece whose color is selected by its collection.
  for(const parent of products.filter(p=>p.stoneCollection))for(const sku of parent.groupSkus){const member=products.find(p=>p.sku===sku);if(!member||JSON.stringify(member.variants)!==JSON.stringify(parent.colors))fail('Conservá los colores de las piezas de la colección. Podés marcarlos como agotados.');}
  return {products,images};
}
async function readCatalog(gh,token) {
  const root='/repos/'+REPO;
  const ref=await gh(token,root+'/git/ref/heads/main');
  const commit=await gh(token,root+'/git/commits/'+ref.object.sha);
  const tree=await gh(token,root+'/git/trees/'+commit.tree.sha);
  const file=tree.tree.find(e=>e.path==='products.js'&&e.type==='blob');
  if(!file)throw new HttpError(409,'No se encontró el catálogo.');
  const blob=await gh(token,root+'/git/blobs/'+file.sha);
  return {sha:ref.object.sha,tree:commit.tree.sha,products:parseProducts(Buffer.from(blob.content.replace(/\s/g,''),'base64').toString('utf8'))};
}
async function publish(gh, token, body) {
  if(!plain(body)||!/^([a-f0-9]{40})$/.test(body.baseSha||''))fail('Falta la versión de origen. Recargá el panel.');
  const current=await readCatalog(gh,token);
  if(current.sha!==body.baseSha)throw new HttpError(409,'Hubo cambios en GitHub desde que abriste el panel. Recargá y revisá tu borrador antes de publicar.');
  const {products,images}=validateEdits(body.edits,current.products),root='/repos/'+REPO;
  const entries=[{path:'products.js',mode:'100644',type:'blob',content:serialize(products)}];
  for(const [path,content] of images) {
    const blob=await gh(token,root+'/git/blobs','POST',{encoding:'base64',content});
    entries.push({path,mode:'100644',type:'blob',sha:blob.sha});
  }
  const tree=await gh(token,root+'/git/trees','POST',{base_tree:current.tree,tree:entries});
  const commit=await gh(token,root+'/git/commits','POST',{message:'Actualizar catálogo desde el panel de Glam',tree:tree.sha,parents:[current.sha]});
  // A concurrent publication has a different parent; non-fast-forward updates are rejected.
  await gh(token,root+'/git/refs/heads/main','PATCH',{sha:commit.sha,force:false});
  return {sha:commit.sha,products};
}
module.exports={parseProducts,serialize,jpegSize,photo,validateEdits,readCatalog,publish};
