// WMS SLS — shared ROMAN brand sync for mobile + desktop login/header.
(function syncRomanBrand(){
  function apply(){
    const src=document.querySelector('.desk-brand img')?.src;
    if(!src) return;
    document.querySelectorAll('.mark').forEach(m=>{
      m.textContent='';
      const img=document.createElement('img');
      img.src=src;
      img.alt='ROMAN';
      m.appendChild(img);
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply,{once:true});
  else apply();
})();

// Governance/login/logistics master patch. Kept separate so core WMS transaction code stays stable.
(function loadEcosystemV72(){
  const s=document.createElement('script');
  s.src='ecosystem_v72.js?v=20260909';
  s.defer=false;
  document.head.appendChild(s);
})();
