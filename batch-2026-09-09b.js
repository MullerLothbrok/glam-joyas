(()=>{
  const P=window.GLAM_PRODUCTS||[];
  const get=sku=>P.find(p=>p.sku===sku);

  // Existing Wix product: keep one card, refresh naming/material for the new launch photo when available.
  const existingAros=get('GJ-W005');
  if(existingAros){
    existingAros.name='Aros brillantes dorados';
    existingAros.price=120000;
    existingAros.material='Dorado y circones';
  }

  const add=p=>{if(!get(p.sku))P.push(p)};

  add({sku:'GJ-N020',name:'Pulsera brillante y dorada',category:'Pulseras y brazaletes',price:180000,stock:'En stock',material:'Dorado y circones',variants:[],image:''});
  add({sku:'GJ-N021',name:'Cadena con cruz y corazón',category:'Collares y cadenas',price:120000,stock:'En stock',material:'Dorado',variants:[],image:''});
  add({sku:'GJ-N022',name:'Rosario con perlas',category:'Collares y cadenas',price:350000,stock:'En stock',material:'Dorado y perlas',variants:[],image:''});
  add({sku:'GJ-N023',name:'Punto de luz · Plata 925 Gold',category:'Sets y combinaciones',price:190000,stock:'En stock',material:'Plata 925 Gold',variants:['Cadena','Anillo'],variantLabel:'Elegí la pieza',variantSummary:'Cadena / Anillo',image:''});
  add({sku:'GJ-N024',name:'Aritos clip-on sin agujeros',category:'Aros y earcuffs',price:100000,stock:'En stock',material:'Dorado',variants:['Nudo','Bola tejida','Corazones','Punto de luz','Lágrima brillante','Perla','Bola dorada','Mariposa'],variantLabel:'Elegí el modelo',variantSummary:'Varios modelos · Gs. 100.000 el par',image:''});
  add({sku:'GJ-N025',name:'Mini Hoop',category:'Aros y earcuffs',price:100000,stock:'En stock',material:'Dorado y circones',variants:[],image:''});
  add({sku:'GJ-N026',name:'Aros de corazones brillantes',category:'Aros y earcuffs',price:150000,stock:'En stock',material:'Dorado y circones',variants:[],image:''});
})();