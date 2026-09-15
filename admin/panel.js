'use strict';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),money=n=>'Gs. '+new Intl.NumberFormat('es-PY').format(n),copy=v=>JSON.parse(JSON.stringify(v));
let originals=[],products=[],changed=[],baseSha='',conflict=false,csrfToken='',publishing=false,lastPublished='';
const storageKey='glam-admin-draft-v1';
let filter='all',editing=null,draftPhoto='',photoBusy=false;
async function request(action,body){const response=await fetch('/api/admin?action='+action,{method:body?'POST':'GET',cache:'no-store',headers:body?{'Content-Type':'application/json','X-Glam-CSRF':csrfToken}:{},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json();if(!response.ok)throw new Error(data.error||'No se pudo completar la operación.');return data;}
async function boot(){
try{
 const session=await request('session');csrfToken=session.csrf;
 const live=await request('catalog');originals=copy(live.products);products=copy(originals);baseSha=live.sha;
 try{const saved=JSON.parse(localStorage.getItem(storageKey));if(saved?.products&&Array.isArray(saved.changed)&&saved.baseSha){
   if(saved.changed.length){
     const remaining=saved.changed.filter(sku=>JSON.stringify(saved.products.find(p=>p.sku===sku))!==JSON.stringify(originals.find(p=>p.sku===sku)));
     conflict=saved.baseSha!==baseSha&&remaining.some(sku=>JSON.stringify(saved.originals?.find(p=>p.sku===sku))!==JSON.stringify(originals.find(p=>p.sku===sku)));
     if(conflict){products=saved.products;originals=saved.originals;changed=saved.changed;baseSha=saved.baseSha;}
     else{for(const sku of remaining){const p=saved.products.find(p=>p.sku===sku),i=products.findIndex(p=>p.sku===sku);if(i<0)products.push(p);else products[i]=p;}changed=remaining;}
   }lastPublished=saved.lastPublished||'';
 }}catch{}
 $('#loginScreen').hidden=true;$('#adminApp').hidden=false;
 initialize();
 if(conflict)$('#connectionStatus').textContent='El catálogo cambió mientras tenías este borrador. Descargalo como respaldo y descartalo para cargar la versión actual; después volvé a aplicar los cambios necesarios.';
 else if(lastPublished)checkDeployment(lastPublished);
}catch(error){$('#loginMessage').textContent=error.message;}
}
function initialize(){
const categories=[...new Set(originals.map(p=>p.category))].sort();
for(const select of [$('#category'),$('#editCategory')])select.insertAdjacentHTML('beforeend',categories.map(c=>`<option>${esc(c)}</option>`).join(''));
const members=p=>(p.groupSkus||[]).map(sku=>products.find(x=>x.sku===sku)).filter(Boolean);
const options=p=>p.variants||[];
const available=p=>p.available!==false;
const out=p=>!available(p)||options(p).some(v=>p.optionAvailability?.[v]===false)||members(p).some(x=>!available(x)||options(x).some(v=>x.optionAvailability?.[v]===false));
const entries=()=>products.filter(p=>!p.hidden);
function notify(message){$('#toast').textContent=message;$('#toast').classList.add('show');setTimeout(()=>$('#toast').classList.remove('show'),3500);}
function persist(){try{localStorage.setItem(storageKey,JSON.stringify({products,changed,originals,baseSha,lastPublished}));return true;}catch{notify('No se pudo guardar en este navegador. Los cambios se conservarán solo mientras esta página siga abierta.');return false;}}
function touch(sku){if(!changed.includes(sku))changed.push(sku);}
function render(){
 const list=entries(),query=$('#search').value.trim().toLocaleLowerCase('es'),category=$('#category').value;
 $('#visibleCount').textContent=list.filter(p=>!p.archived).length;$('#outCount').textContent=list.filter(p=>!p.archived&&out(p)).length;$('#changeCount').textContent=changed.length;$('#navCount').textContent=list.filter(p=>!p.archived).length;
 $('#pendingText').textContent=changed.length?`${changed.length} producto${changed.length===1?'':'s'} con cambios para revisar`:'Todo en orden';$('#review').disabled=!changed.length;
 const shown=list.filter(p=>(filter==='archived'?p.archived:!p.archived)&&(filter!=='out'||out(p))&&(!category||p.category===category)&&(!query||(p.name+' '+p.sku).toLocaleLowerCase('es').includes(query))).sort((a,b)=>a.name.localeCompare(b.name,'es'));
 $('#listTitle').textContent={all:'Productos',out:'Con agotados',archived:'Archivados'}[filter];$('#results').textContent=shown.length+' productos';$('#empty').hidden=shown.length>0;
 $('#rows').innerHTML=shown.map(p=>{const group=members(p),price=group.length?Math.min(...group.map(x=>x.price)):p.price;return `<tr><td><div class="product-cell"><img class="thumb" src="${esc(p.image||'/placeholder.svg')}" alt=""><div><strong>${esc(p.name)}</strong><small>${esc(p.sku)} · ${esc(p.category)}</small><small>${group.length?group.length+' piezas agrupadas':options(p).length?options(p).length+' opciones':'Sin opciones'}</small></div></div></td><td class="money">${group.length||p.consultOnly?'Desde ':''}${money(price)}<small>Promo: ${money(Math.round(price*.9))}</small></td><td><span class="badge ${p.archived?'archived':out(p)?'out':''}">${p.archived?'Archivado':!available(p)?'Agotado':out(p)?'Revisar opciones':p.consultOnly?'Por consulta':'Disponible'}</span></td><td><button class="edit" data-edit="${esc(p.sku)}" aria-label="Editar ${esc(p.name)}">Editar ↗</button></td></tr>`;}).join('');
}
function photo(src){$('#photo').hidden=!src;$('#noPhoto').hidden=!!src;if(src)$('#photo').src=src;}
function optionRow(label='',inStock=true){return `<div class="option-row"><input type="text" aria-label="Nombre de la opción" value="${esc(label)}" maxlength="60" required><label class="check"><input type="checkbox" ${inStock?'checked':''}>Disponible</label><button class="icon remove-option" type="button" aria-label="Quitar opción">×</button></div>`;}
function groupRow(p){return `<div class="option-row group-row" data-member="${esc(p.sku)}"><div style="flex:1"><strong>${esc(p.name)}</strong><small class="field-hint">${esc(p.sku)}</small></div><input type="number" aria-label="Precio base de ${esc(p.name)}" min="1" max="999999999" step="1" required value="${p.price}"><label class="check"><input type="checkbox" ${available(p)?'checked':''}>Disponible</label>${options(p).length?`<div class="member-colors">${options(p).map(v=>`<label class="check"><input type="checkbox" data-color="${esc(v)}" ${p.optionAvailability?.[v]!==false?'checked':''}>${esc(v)}</label>`).join('')}</div>`:''}</div>`;}
function openEditor(sku){
 if(publishing)return;
 const p=sku?products.find(x=>x.sku===sku):{sku:'',name:'',category:categories[0],price:0,variants:[],available:true,image:''};editing=sku||null;draftPhoto=p.image||'';photo(draftPhoto);$('#error').textContent='';$('#upload').value='';
 $('#editorTitle').textContent=sku?'Editar producto':'Nuevo producto';$('#name').value=p.name;$('#sku').value=p.sku;$('#sku').readOnly=!!sku;$('#editCategory').value=p.category;$('#price').value=p.price||'';$('#available').checked=available(p);$('#visible').checked=!p.archived;$('#archive').hidden=!sku;$('#archive').textContent=p.archived?'Restaurar producto':'Archivar producto';
 const group=members(p);$('#priceFields').hidden=!!group.length;$('#price').required=!group.length;$('#groupPriceNote').hidden=!group.length;$('#addOption').hidden=!!group.length||!!p.consultOnly;$('#stockFields').hidden=!!group.length;$('#variantsBlock').hidden=!!p.consultOnly;$('#optionsTitle').textContent=group.length?'Piezas de esta colección':'Opciones del producto';$('#optionsHint').textContent=group.length?'Precio base de cada pieza. La colección completa suma las tres.':'Controlá la disponibilidad de cada color o modelo.';
 $('#variants').innerHTML=group.length?group.map(groupRow).join(''):options(p).map(v=>optionRow(v,p.optionAvailability?.[v]!==false)).join('');$('#consultNote').hidden=!p.consultOnly;pricePreview();$('#editor').showModal();
}
function pricePreview(){$('#promoPrice').textContent=money(Math.round((Number($('#price').value)||0)*.9));}
$('#price').addEventListener('input',pricePreview);
$('#rows').onclick=e=>{const button=e.target.closest('[data-edit]');if(button)openEditor(button.dataset.edit);};
$('#new').onclick=()=>openEditor();$('.brand').onclick=e=>{e.preventDefault();filter='all';$('#search').value='';$('#category').value='';render();};
document.querySelectorAll('.nav').forEach(button=>button.onclick=()=>{filter=button.dataset.filter;document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b===button));render();});
$('#search').oninput=render;$('#category').onchange=render;
document.querySelectorAll('.close-editor').forEach(b=>b.onclick=()=>$('#editor').close());
$('#addOption').onclick=()=>{$('#variants').insertAdjacentHTML('beforeend',optionRow());$('#variants').lastElementChild.querySelector('input').focus();};
$('#variants').onclick=e=>{const b=e.target.closest('.remove-option');if(b)b.closest('.option-row').remove();};
$('#upload').onchange=async()=>{
 const file=$('#upload').files[0];if(!file)return;
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024){$('#error').textContent='Elegí una imagen JPG, PNG o WebP de hasta 10 MB.';return;}
 photoBusy=true;$('#error').textContent='Cargando foto…';
 try{const bitmap=await createImageBitmap(file);if(bitmap.width*bitmap.height>40000000){bitmap.close();throw new Error('Imagen muy grande');}const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const context=canvas.getContext('2d');context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();let quality=.85,data=canvas.toDataURL('image/jpeg',quality);while(data.length>900000&&quality>.35){quality-=.1;data=canvas.toDataURL('image/jpeg',quality);}if(data.length>930000)throw new Error('Foto muy grande');draftPhoto=data;photo(data);$('#error').textContent='';}catch{$('#error').textContent='No pudimos abrir esa imagen. Probá con otra.';}finally{photoBusy=false;}
};
$('#form').onsubmit=e=>{
 e.preventDefault();if(photoBusy)return;$('#error').textContent='';
 const sku=$('#sku').value.trim(),name=$('#name').value.trim();if(!name){$('#error').textContent='Escribí el nombre del producto.';return;}
 if(!editing&&products.some(p=>p.sku.toLowerCase()===sku.toLowerCase())){$('#error').textContent='Ese código ya existe. Usá otro para el nuevo producto.';return;}
 if(!draftPhoto){$('#error').textContent='Agregá una foto del producto.';return;}
 const old=editing?products.find(p=>p.sku===editing):{variants:[],material:'',stock:'En stock'},p=copy(old),group=members(old);
 const rows=[...$('#variants').children];
 if(!group.length&&!p.consultOnly){const labels=rows.map(r=>r.querySelector('input[type=text]').value.trim());if(labels.some(v=>!v)||new Set(labels.map(v=>v.toLowerCase())).size!==labels.length){$('#error').textContent='Cada opción necesita un nombre distinto.';return;}p.variants=labels;p.optionAvailability=Object.fromEntries(rows.map((r,i)=>[labels[i],r.querySelector('input[type=checkbox]').checked]));delete p.variantSummary;}
 Object.assign(p,{sku,name,category:$('#editCategory').value,image:draftPhoto,archived:!$('#visible').checked});
 if(!group.length){p.price=Number($('#price').value);p.available=$('#available').checked;if(!Number.isSafeInteger(p.price)||p.price<=0){$('#error').textContent='Ingresá un precio entero mayor que cero.';return;}}
 if(group.length){for(const row of rows){const value=Number(row.querySelector('input[type=number]').value);if(!Number.isSafeInteger(value)||value<=0){$('#error').textContent='Revisá los precios de las piezas.';return;}}for(const row of rows){const member=products.find(x=>x.sku===row.dataset.member);const price=Number(row.querySelector('input[type=number]').value),stock=row.querySelector('input[type=checkbox]').checked;const optionAvailability=Object.fromEntries([...row.querySelectorAll('[data-color]')].map(c=>[c.dataset.color,c.checked]));if(price!==member.price||stock!==available(member)||JSON.stringify(optionAvailability)!==JSON.stringify(member.optionAvailability||{})){member.price=price;member.available=stock;member.optionAvailability=optionAvailability;touch(member.sku);}}}
 if(group.some(member=>member.sku===p.sku)){const current=products.find(x=>x.sku===p.sku);p.price=current.price;p.available=current.available;p.optionAvailability=copy(current.optionAvailability||{});}
 if(editing)products[products.findIndex(x=>x.sku===editing)]=p;else products.push(p);touch(sku);const saved=persist();render();$('#editor').close();if(saved)notify('Borrador guardado. Publicá cuando termines de revisar.');
};
$('#archive').onclick=()=>{const p=products.find(x=>x.sku===editing);p.archived=!p.archived;touch(p.sku);const saved=persist();render();$('#editor').close();if(saved)notify(p.archived?'Producto archivado en el borrador. Podés restaurarlo.':'Producto restaurado en el borrador.');};
$('#review').onclick=()=>{$('#changeList').innerHTML=changed.map(sku=>{const p=products.find(x=>x.sku===sku),old=originals.find(x=>x.sku===sku),notes=[];
 if(!old)notes.push('Nuevo producto');
 if(old&&old.name!==p.name)notes.push('Nombre: '+old.name+' → '+p.name);
 if(!old||old.price!==p.price)notes.push('Precio base: '+(old?money(old.price)+' → ':'')+money(p.price));
 if(!old||available(old)!==available(p))notes.push(available(p)?'Disponible para pedir':'Producto agotado');
 if(old&&!!old.archived!==!!p.archived)notes.push(p.archived?'Oculto del catálogo':'Visible en el catálogo');
 if(old&&old.image!==p.image)notes.push('Foto actualizada');
 if(old&&old.category!==p.category)notes.push('Categoría: '+p.category);
 for(const v of options(p)){if(!old||!options(old).includes(v))notes.push('Opción añadida: '+v);if(p.optionAvailability?.[v]===false&&old?.optionAvailability?.[v]!==false)notes.push(v+': agotado');if(p.optionAvailability?.[v]!==false&&old?.optionAvailability?.[v]===false)notes.push(v+': disponible');}
 for(const v of options(old||{}))if(!options(p).includes(v))notes.push('Opción retirada: '+v);
 return `<div class="change-item"><strong>${esc(p.name)}</strong><small>${esc(sku)}</small><ul>${(notes.length?notes:['Datos revisados']).map(n=>'<li>'+esc(n)+'</li>').join('')}</ul></div>`;}).join('');$('#reviewDialog').showModal();};
$('#closeReview').onclick=$('#backEdit').onclick=()=>$('#reviewDialog').close();

$('#reset').onclick=()=>{if(publishing)return;if($('#reset').dataset.confirm!=='yes'){$('#reset').dataset.confirm='yes';$('#reset').textContent='Confirmar descarte';setTimeout(()=>{$('#reset').dataset.confirm='';$('#reset').textContent='Descartar borrador';},6000);return;}localStorage.removeItem(storageKey);location.reload();};
$('#exportDraft').onclick=()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify({baseSha,products,changed},null,2)],{type:'application/json'}));a.href=url;a.download='glam-borrador.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('#logout').onclick=async()=>{if(publishing)return;try{await request('logout',{});location.reload();}catch(error){notify(error.message);}};
$('#publish').onclick=async()=>{
 if(publishing)return;$('#publishError').textContent='';
 if(conflict){$('#publishError').textContent='Este borrador tiene un conflicto con GitHub. Descargalo como respaldo y cargá la versión actual antes de volver a editar.';return;}
 if(!persist()){$('#publishError').textContent='Guardá un respaldo con Descargar borrador antes de continuar: este navegador no permite conservar los cambios.';return;}
 publishing=true;for(const id of ['publish','backEdit','closeReview','new'])$('#'+id).disabled=true;
 const onCancel=e=>e.preventDefault();$('#reviewDialog').addEventListener('cancel',onCancel);
 $('#publish').textContent='Guardando en GitHub…';
 try{
 const edits=changed.map(sku=>{const p=products.find(p=>p.sku===sku);return {sku:p.sku,name:p.name,category:p.category,price:p.price,image:p.image,available:p.available!==false,archived:!!p.archived,variants:p.variants||[],optionAvailability:Object.fromEntries((p.variants||[]).map(v=>[v,p.optionAvailability?.[v]!==false]))};});
 if(new Blob([JSON.stringify(edits)]).size>3400000)throw new Error('Hay demasiadas fotos para una sola publicación. Conservá el borrador descargándolo y publicá las fotos en grupos más pequeños.');
 const result=await request('publish',{baseSha,edits});baseSha=result.sha;lastPublished=result.sha;products=copy(result.products);originals=copy(result.products);changed=[];persist();render();$('#reviewDialog').close();notify('Guardado en GitHub. Vercel está actualizando la tienda.');checkDeployment(result.sha);
 }catch(error){$('#publishError').textContent=error.message;}
 finally{publishing=false;for(const id of ['publish','backEdit','closeReview','new'])$('#'+id).disabled=false;$('#publish').textContent='Publicar cambios';$('#reviewDialog').removeEventListener('cancel',onCancel);}
};
render();
}
async function checkDeployment(sha,attempt=0){
 try{const result=await request('status&sha='+encodeURIComponent(sha));
 if(result.state==='success'){$('#connectionStatus').textContent='Vercel confirmó la publicación. Ya podés revisar la tienda.';return;}
 if(['failure','error'].includes(result.state)){$('#connectionStatus').textContent='Los cambios están guardados en GitHub, pero Vercel informó un fallo. Revisá Deployments antes de publicar de nuevo.';return;}
 $('#connectionStatus').textContent='Los cambios están guardados en GitHub. Esperando la publicación de Vercel…';if(attempt<20)setTimeout(()=>checkDeployment(sha,attempt+1),15000);
 }catch{$('#connectionStatus').textContent='No se pudo comprobar Vercel. Revisá el sitio público o el panel de Deployments.';}
}
boot();
