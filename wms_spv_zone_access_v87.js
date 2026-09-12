// WMS SLS v87 — Supervisor may manage RDC zoning/master setup previously limited to RDC Manager.
(function(){
  'use strict';

  function addPerm(role,perm){
    if(typeof ROLE_PERMS!=='object' || !Array.isArray(ROLE_PERMS[role])) return;
    if(!ROLE_PERMS[role].includes(perm)) ROLE_PERMS[role].push(perm);
  }

  function patchPermissions(){
    addPerm('supervisor','ZONE_MANAGE');
  }

  function replaceManagerOnlyText(root=document){
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const targets=[];
    while(walker.nextNode()){
      const n=walker.currentNode;
      const t=n.nodeValue||'';
      if(/RDC Manager harus membuat Zonasi Ukuran terlebih dahulu/i.test(t) || /RDC Manager \/ MASTER/i.test(t)) targets.push(n);
    }
    targets.forEach(n=>{
      n.nodeValue=(n.nodeValue||'')
        .replace(/RDC Manager harus membuat Zonasi Ukuran terlebih dahulu/gi,'Supervisor / RDC Manager dapat membuat Zonasi Ukuran terlebih dahulu')
        .replace(/RDC Manager \/ MASTER/gi,'Supervisor / RDC Manager / MASTER');
    });
  }

  function patchAccessDescription(){
    document.querySelectorAll('#s-access .lrow').forEach(row=>{
      const t=row.querySelector('.t'), s=row.querySelector('.s');
      if(!t||!s||!/Supervisor/i.test(t.textContent||'')) return;
      s.textContent='Operasional + approval SPV + Upload & Konfirmasi Penerimaan SAP + Upload Stock SAP Awal + kelola lokasi + Zonasi/Kuota Ukuran + klasifikasi material + kapasitas kavling + master motif/pallet RDC sendiri.';
    });
  }

  function apply(){
    patchPermissions();
    replaceManagerOnlyText(document);
    patchAccessDescription();
    if(typeof applyRoleUI==='function'){
      try{ applyRoleUI(); }catch(_e){}
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply,{once:true});
  else apply();
  setTimeout(apply,250);
  setTimeout(apply,700);

  const obs=new MutationObserver(()=>{
    replaceManagerOnlyText(document);
    patchAccessDescription();
  });
  const start=()=>{ if(document.body) obs.observe(document.body,{childList:true,subtree:true,characterData:true}); };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();
