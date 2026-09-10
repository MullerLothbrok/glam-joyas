// Product updates from the September 10 catalog photographs.
(() => {
  const products = window.GLAM_PRODUCTS;
  const get = sku => products.find(p => p.sku === sku);
  const photo = name => '/assets/catalogo/' + name + '.webp';
  const updates = {
    'GJ-W027': ['cadena-cruz', 'Cadena larga con cruz', 180000],
    'GJ-N019': ['aros-curvos', 'Aros dorados curvos', 95000],
    'GJ-W026': ['aritos-tamanos', 'Aritos laminados', 80000],
    'GJ-W008': ['argollas-doradas', 'Argollas doradas', 70000],
    'GJ-N009': ['anillos-tres-modelos', 'Anillos de plata bañados en oro', 150000],
    'GJ-N010': ['anillos-circon-flor', 'Anillo dorado con circón central', 160000],
    'GJ-N011': ['anillos-circon-flor', 'Anillo flor con circones', 135000],
    'GJ-N014': ['anillo-dijes', 'Anillo dorado con dijes', 120000],
    'GJ-N012': ['pulseras-laminadas', 'Pulseras laminadas en oro', 180000],
    'GJ-N008': ['anillo-oro-blanco', 'Anillo de plata 925 con baño de oro blanco', 180000],
    'GJ-N016': ['anillo-circones-acabados', 'Anillo de plata con baño de oro y circones', 190000],
    'GJ-N018': ['collar-eslabones', 'Collar de eslabones ovalados', 195000],
    'GJ-N015': ['esclavas-lisas', 'Esclavas lisas', 90000],
    'GJ-W020': ['earcuff', 'Earcuff laminado', 50000],
    'GJ-N004': ['cadena-van-cleef', 'Cadena Van Cleef de plata 950 con baño de oro blanco', 350000],
    'GJ-N005': ['aro-laminado-circones', 'Aro brillante laminado con circones', 150000],
    'GJ-N017': ['aros-cultivados', 'Aros de piedras cultivadas engarzadas', 220000],
    'GJ-N013': ['aros-hoja-perla', 'Aros de hojas con perla', 180000],
    'GJ-N006': ['collares-florcitas-baguette', 'Choker de florcitas', 270000],
    'GJ-N007': ['collares-florcitas-baguette', 'Cadena de piedras baguette', 350000]
  };
  for (const [sku, [image, name, price]] of Object.entries(updates)) Object.assign(get(sku), {image: photo(image), name, price});
  for (const [sku, name] of [['GJ-W005','aros-brillantes'],['GJ-N024','clip-on'],['GJ-N023','punto-luz'],['GJ-N022','rosario-perlas']]) get(sku).image=photo(name);
  get('GJ-N024').variantSummary='Varios modelos · precio por par';
  const hoops = get('GJ-W026');
  const sizes = ['Pequeño', 'Mediano', 'Grande'];
  sizes.forEach((size, i) => products.push({...hoops, sku: 'GJ-W026-' + (i+1), name: 'Aritos laminados · ' + size, price: 80000+i*10000, hidden: true}));
  Object.assign(hoops, {groupSkus: sizes.map((_,i) => 'GJ-W026-'+(i+1)), groupLabel: 'Pequeño / Mediano / Grande', groupSelectLabel: 'Elegí el tamaño'});
  get('GJ-N016').variants = ['Plateado', 'Dorado'];
  Object.assign(get('GJ-N009'), {variants: ['Modelo 1 · izquierda', 'Modelo 2 · centro', 'Modelo 3 · derecha'], variantLabel: 'Elegí el modelo', variantSummary: 'Tres modelos · de izquierda a derecha en la foto'});
  const colors = ['Rojo', 'Verde / Pastel', 'Violeta', 'Ónix negro'];
  const colorPhotos = Object.fromEntries(colors.map((c, i) => [c, photo(['piedras-rojo', 'piedras-verde', 'piedras-violeta', 'piedras-negro'][i])]));
  ['GJ-N001','GJ-N002','GJ-N003'].forEach((sku, i) => Object.assign(get(sku), {
    image: colorPhotos.Rojo, variants: i ? colors.slice(0,3) : colors,
    variantImages: colorPhotos, hidden: true
  }));
  products.push({sku: 'GJ-PIEDRAS', name: 'Colección de piedras', category: 'Sets y combinaciones', price: 50000,
    material: 'Piedras y detalles dorados', image: colorPhotos.Rojo, stock: 'En stock',
    colors, colorPhotos, groupSkus: ['GJ-N001','GJ-N002','GJ-N003'],
    groupLabel: 'Elegí el color y la pieza', stoneCollection: true});
  // Keep the catalog's base prices intact; checkout uses a single discounted price.
  window.GLAM_PROMOTION = {rate: 0.10, label: '10% de descuento por inauguración'};
})();

