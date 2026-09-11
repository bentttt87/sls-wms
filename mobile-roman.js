// WMS SLS — official QUADRA + ROMAN brand sync for mobile + desktop.
(function syncQuadraRomanBrand(){
  const BRAND_SRC='quadra-roman-logo.svg?v=20260911';
  function apply(){
    // Login + mobile/header marks.
    document.querySelectorAll('.mark').forEach(m=>{
      m.textContent='';
      m.style.background='#fff';
      m.style.padding='3px';
      m.style.width='72px';
      m.style.height='44px';
      m.style.borderRadius='8px';
      const img=document.createElement('img');
      img.src=BRAND_SRC;
      img.alt='QUADRA ROMAN';
      img.style.width='100%';
      img.style.height='100%';
      img.style.objectFit='contain';
      m.appendChild(img);
    });

    // Desktop sidebar brand created by the desktop visual layer.
    document.querySelectorAll('.desk-brand img').forEach(img=>{
      img.src=BRAND_SRC;
      img.alt='QUADRA ROMAN';
      img.style.width='108px';
      img.style.height='62px';
      img.style.objectFit='contain';
      img.style.background='#fff';
      img.style.padding='4px';
    });

    // Any legacy ROMAN image that may be injected by older UI code.
    document.querySelectorAll('img.roman-logo,img[src*="roman-logo"],img[alt="ROMAN"],img[alt="Roman"]').forEach(img=>{
      img.src=BRAND_SRC;
      img.alt='QUADRA ROMAN';
      img.style.objectFit='contain';
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply,{once:true});
  else apply();
  // Re-apply once after legacy/runtime UI injectors finish.
  window.setTimeout(apply,600);
})();

// Governance/login/logistics master patch. Kept separate so core WMS transaction code stays stable.
(function loadEcosystemV72(){
  const s=document.createElement('script');
  s.src='ecosystem_v72.js?v=20260909';
  s.defer=false;
  document.head.appendChild(s);
})();
