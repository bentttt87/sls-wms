// WMS SLS v87.1 — Supervisor may manage RDC zoning/master setup previously limited to RDC Manager.
// Hotfix: remove global MutationObserver that could re-trigger itself and freeze the browser.
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
    if(!root || typeof document.createTreeWalker!=='function') return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const targets=[];
    while(walker.nextNode()){
      const n=walker.currentNode;
      const t=n.nodeValue||'';
      if(t.includes('RDC Manager harus membuat Zonasi Ukuran terlebih dahulu') ||
         t.includes('Hanya RDC Manager / MASTER')) targets.push(n);
    }
    targets.forEach(n=>{
      let t=n.nodeValue||'';
      t=t.replace(/RDC Manager harus membuat Zonasi Ukuran terlebih dahulu/g,
        'Supervisor / RDC Manager dapat membuat Zonasi Ukuran terlebih dahulu');
      t=t.replace(/Hanya RDC Manager \/ MASTER/g,
        'Supervisor / RDC Manager / MASTER');
      if(n.nodeValue!==t) n.nodeValue=t;
    });
  }

  function patchAccessDescription(){
    document.querySelectorAll('#s-access .lrow').forEach(row=>{
      const t=row.querySelector('.t'), s=row.querySelector('.s');
      if(!t||!s||!/Supervisor/i.test(t.textContent||'')) return;
      const wanted='Operasional + approval SPV + Upload & Konfirmasi Penerimaan SAP + Upload Stock SAP Awal + kelola lokasi + Zonasi/Kuota Ukuran + klasifikasi material + kapasitas kavling + master motif/pallet RDC sendiri.';
      if(s.textContent!==wanted) s.textContent=wanted;
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

  // Apply a few bounded times only. No DOM observer: avoids recursive mutation loops and browser freeze.
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply,{once:true});
  else apply();
  setTimeout(apply,250);
  setTimeout(apply,900);
  setTimeout(apply,1800);
})();
