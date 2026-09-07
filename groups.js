(()=>{const P=window.GLAM_PRODUCTS||[],get=sku=>P.find(p=>p.sku===sku),setLabel=(sku,label)=>{const p=get(sku);if(p)p.variantLabel=label},group=({base,skus,name,label,selectLabel='Elegí el modelo',strip=''})=>{const root=get(base),members=skus.map(get).filter(Boolean);if(!root||members.length<2)return;root.name=name;root.groupSkus=skus;root.groupLabel=label;root.groupSelectLabel=selectLabel;root.groupStrip=strip;members.slice(1).forEach(p=>p.hidden=true)};

group({base:'GJ-W033A',skus:['GJ-W033A','GJ-W033B','GJ-W033C'],name:'Cadenas laminadas',label:'Snake / Tiffany / Tourbillon',selectLabel:'Elegí la cadena',strip:'Cadena '});

const initials=get('GJ-W022');if(initials){initials.variants=['A','B','C','D','E'];initials.variantLabel='Elegí la inicial';initials.variantSummary='Iniciales A / B / C / D / E'}
setLabel('GJ-N016','Elegí el acabado');
setLabel('GJ-W031','Elegí el baño');
setLabel('GJ-N013','Elegí el acabado');
setLabel('GJ-N001','Elegí el color');
setLabel('GJ-N003','Elegí el color');
setLabel('GJ-N002','Elegí el color');

window.GLAM_GROUP_PRODUCT=group;})();