// WMS SLS v90 — hard cleanup of legacy Kuota Ukuran UI and dashboard alert.
(function(){
  'use strict';

  function ensureStyle(){
    if(document.getElementById('wmsQuotaCleanupV90Style')) return;
    const s=document.createElement('style');
    s.id='wmsQuotaCleanupV90Style';
    s.textContent='button[data-s="zone"],#s-zone,#homeZoneAlert{display:none!important}';
    document.head.appendChild(s);
  }

  function cleanup(){
    ensureStyle();

    document.querySelectorAll('button[data-s="zone"],#s-zone').forEach(el=>{
      el.style.display='none';
      el.setAttribute('aria-hidden','true');
    });

    document.querySelectorAll('.lrow').forEach(row=>{
      const txt=String(row.textContent||'').toLowerCase();
      const oc=String(row.getAttribute('onclick')||'').toLowerCase();
      if(txt.includes('kuota ukuran') || txt.includes('zonasi ukuran') || oc.includes("go('zone')") || oc.includes('go("zone")')){
        row.style.display='none';
        row.setAttribute('aria-hidden','true');
      }
    });

    const alert=document.getElementById('homeZoneAlert');
    if(alert){
      alert.innerHTML='';
      alert.style.display='none';
      alert.setAttribute('aria-hidden','true');
    }

    try{
      window.refreshHomeZoneAlert=function(){
        const el=document.getElementById('homeZoneAlert');
        if(el){el.innerHTML='';el.style.display='none';}
      };
    }catch(_e){}
  }

  function patchNavigation(){
    try{
      if(typeof go!=='function' || go.__wmsQuotaV90) return;
      const base=go;
      const wrapped=function(screen){
        if(String(screen)==='zone') return base('put');
        return base(screen);
      };
      wrapped.__wmsQuotaV90=true;
      go=wrapped;
    }catch(_e){}
  }

  function apply(){
    cleanup();
    patchNavigation();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply,{once:true});
  else apply();

  setTimeout(apply,100);
  setTimeout(apply,500);
  setTimeout(apply,1200);

  if(document.body){
    const obs=new MutationObserver(()=>cleanup());
    obs.observe(document.body,{childList:true,subtree:true});
  }else{
    document.addEventListener('DOMContentLoaded',()=>{
      const obs=new MutationObserver(()=>cleanup());
      obs.observe(document.body,{childList:true,subtree:true});
    },{once:true});
  }
})();
