(()=>{
  const tools=document.querySelector('.tools');
  if(!tools)return;

  const panel=document.createElement('div');
  panel.className='catalog-filters';
  panel.innerHTML=`
    <div class="filter-block price-filter">
      <span class="filter-title">Precio</span>
      <div class="price-fields">
        <label><span>Gs.</span><input id="priceMin" type="number" min="0" step="5000" inputmode="numeric" placeholder="Mínimo"></label>
        <span class="price-sep">—</span>
        <label><span>Gs.</span><input id="priceMax" type="number" min="0" step="5000" inputmode="numeric" placeholder="Máximo"></label>
      </div>
    </div>
    <div class="filter-block finish-filter">
      <span class="filter-title">Acabado / color</span>
      <div class="finish-chips" id="finishChips">
        <button type="button" class="finish-chip active" data-finish="all">Todos</button>
        <button type="button" class="finish-chip" data-finish="gold"><i class="finish-dot gold"></i>Dorado</button>
        <button type="button" class="finish-chip" data-finish="silver"><i class="finish-dot silver"></i>Plateado</button>
        <button type="button" class="finish-chip" data-finish="rose"><i class="finish-dot rose"></i>Rose Gold</button>
        <button type="button" class="finish-chip" data-finish="mixed"><i class="finish-dot mixed"></i>Mixto</button>
      </div>
    </div>
    <button type="button" class="clear-filters" id="clearFilters">Limpiar filtros</button>`;
  tools.insertAdjacentElement('afterend',panel);

  let selectedFinish='all';
  const normalize=s=>(s||'').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

  function explicitFinishes(x){
    const raw=x.finish||x.finishes;
    if(!raw)return null;
    const arr=Array.isArray(raw)?raw:[raw];
    return new Set(arr.map(v=>normalize(v)).map(v=>v.includes('rose')?'rose':v.includes('plata')||v.includes('silver')?'silver':v.includes('oro')||v.includes('gold')||v.includes('dorado')?'gold':v).filter(Boolean));
  }

  function itemFinishes(x){
    const explicit=explicitFinishes(x);if(explicit)return explicit;
    const text=normalize([x.name,x.material,...(x.variants||[])].join(' '));
    const tags=new Set();
    const rose=/\brose\b|rose gold|oro rosa|rosado|rosada/.test(text);
    const whiteGold=/oro blanco|bano de oro blanco/.test(text);
    const yellowGold=/dorado|dorada|\bgold\b|oro amarillo|bano de oro amarillo|laminad[^ ]* (?:en )?oro|laminado dorado/.test(text);
    const platedGold=/plata[^,;]*banad[^,;]*oro(?! blanco)|plata[^,;]*bano[^,;]*oro(?! blanco)/.test(text);
    const silver=/plateado|plateada|\bsilver\b|oro blanco/.test(text)||(/\bplata\b/.test(text)&&!platedGold&&!yellowGold);
    if(rose)tags.add('rose');
    if(yellowGold||platedGold)tags.add('gold');
    if(whiteGold||silver)tags.add('silver');
    if(/plata\s*\/\s*gold|gold\s*\/\s*plata|platead[^ ]* y dorad|dorado y plateado|distintos colores|diferentes colores/.test(text)){tags.add('gold');tags.add('silver')}
    return tags;
  }

  function productFinishes(p){
    const tags=new Set();
    [p,...G(p)].forEach(x=>itemFinishes(x).forEach(t=>tags.add(t)));
    return tags;
  }

  function priceMatches(p,min,max){
    const members=G(p);
    const prices=(members.length?members:[p]).map(x=>Number(x.price)||0);
    return prices.some(price=>(!min||price>=min)&&(!max||price<=max));
  }

  const originalFilt=filt;
  filt=function(){
    let a=originalFilt();
    const min=Number(document.querySelector('#priceMin')?.value)||0;
    const max=Number(document.querySelector('#priceMax')?.value)||0;
    a=a.filter(p=>priceMatches(p,min,max));
    if(selectedFinish!=='all'){
      a=a.filter(p=>{
        const tags=productFinishes(p);
        return selectedFinish==='mixed'?tags.size>1:tags.has(selectedFinish);
      });
    }
    return a;
  };

  const rerender=()=>render();
  document.querySelector('#priceMin').addEventListener('input',rerender);
  document.querySelector('#priceMax').addEventListener('input',rerender);
  document.querySelector('#finishChips').addEventListener('click',e=>{
    const btn=e.target.closest('.finish-chip');if(!btn)return;
    selectedFinish=btn.dataset.finish;
    document.querySelectorAll('.finish-chip').forEach(x=>x.classList.toggle('active',x===btn));
    render();
  });
  document.querySelector('#clearFilters').addEventListener('click',()=>{
    document.querySelector('#s').value='';
    document.querySelector('#c').value='';
    document.querySelector('#sort').value='name';
    document.querySelector('#priceMin').value='';
    document.querySelector('#priceMax').value='';
    selectedFinish='all';
    document.querySelectorAll('.finish-chip').forEach(x=>x.classList.toggle('active',x.dataset.finish==='all'));
    render();
  });

  render();
})();