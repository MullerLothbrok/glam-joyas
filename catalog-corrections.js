(()=>{
  const P=window.GLAM_PRODUCTS||[];
  const addIfMissing=(product)=>{
    if(!P.some(p=>p.sku===product.sku||p.name.toLowerCase()===product.name.toLowerCase())) P.push(product);
  };

  // Auditoría contra el catálogo histórico de Wix (34 productos).
  // Los precios corregidos posteriormente por el cliente tienen prioridad sobre Wix.
  addIfMissing({
    sku:'GJ-W026',
    name:'Aritos laminados',
    category:'Aros y earcuffs',
    price:80000,
    stock:'En stock',
    material:'Laminado dorado',
    variants:[],
    image:''
  });
})();