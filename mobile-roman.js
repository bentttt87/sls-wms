// WMS SLS — shared ROMAN brand sync for mobile + desktop login/header.
// Visual-only helper. No transaction/business logic is changed.
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
