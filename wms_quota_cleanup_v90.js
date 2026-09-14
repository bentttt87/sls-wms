// WMS SLS v98 — compatibility cleanup for retired size quota/zoning UI.
// Lightweight timed cleanup only; physical-capacity flow is authoritative.
(function(){
  'use strict';
  function ensureStyle(){
    if(document.getElementById('wmsQuotaCleanupV98Style'))return;
    const s=document.createElement('style');
    s.id='wmsQuotaCleanupV98Style';
    s.textContent='button[data-s="zone"],button[data-s="kap"],button[data-s="putex"],#s-zone,#s-kap,#s-putex,#homeZoneAlert,#puSizeGate{display:none!important}';
    document.head.appendChild(s);
  }
  function cleanup(){
    ensureStyle();
    document.querySelectorAll('.lrow').forEach(row=>{
      const txt=String(row.textContent||'').toLowerCase();
      const oc=String(row.getAttribute('onclick')||'').toLowerCase();
      if(oc.includes("go('zone')")||oc.includes('go("zone")')||oc.includes("go('kap')")||oc.includes('go("kap")')||oc.includes("go('putex')")||oc.includes('go("putex")')||txt.includes('zonasi ukuran')||txt.includes('kuota ukuran')||txt.includes('master kapasitas')&&txt.includes('ukuran')){
        row.style.display='none';row.setAttribute('aria-hidden','true');
      }
    });
    const gate=document.getElementById('puSizeGate');if(gate)gate.innerHTML='';
    const alert=document.getElementById('homeZoneAlert');if(alert)alert.innerHTML='';
  }
  function patchNavigation(){
    if(typeof go!=='function'||go.__wmsQuotaV98)return;
    const base=go;
    const fn=function(screen){
      const s=String(screen||'');
      if(s==='zone'||s==='kap')return base('loc');
      if(s==='putex')return base('more');
      return base(screen);
    };
    fn.__wmsQuotaV98=true;go=fn;
  }
  function apply(){cleanup();patchNavigation();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
  setTimeout(apply,250);setTimeout(apply,900);
})();
