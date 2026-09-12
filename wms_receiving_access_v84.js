// WMS SLS v84 — Receiving upload/confirm access for Admin RDC + Supervisor + Manager + Master.
// Important: RECEIVING_UPLOAD is intentionally separate from SAP_UPLOAD (opening stock),
// so Admin RDC can receive goods without gaining opening-stock upload authority.
(function(){
  'use strict';

  function addPerm(role, perm){
    if(typeof ROLE_PERMS!=='object' || !Array.isArray(ROLE_PERMS[role])) return;
    if(!ROLE_PERMS[role].includes(perm)) ROLE_PERMS[role].push(perm);
  }

  function patchPermissions(){
    ['operator','supervisor','rdc_manager','master'].forEach(r=>addPerm(r,'RECEIVING_UPLOAD'));
  }

  function patchReceivingCard(){
    const file=document.getElementById('puRecvFile');
    if(!file) return;
    const card=file.closest('[data-perm]') || file.closest('.card');
    if(!card) return;

    card.setAttribute('data-perm','RECEIVING_UPLOAD');

    const title=[...card.querySelectorAll('div')].find(x=>/Penerimaan Barang Baru dari SAP/i.test(x.textContent||''));
    if(title) title.textContent='📄 Upload & Konfirmasi Penerimaan SAP';

    const sub=card.querySelector('.muted');
    if(sub){
      sub.innerHTML='<b>Admin RDC dan Supervisor</b> dapat upload serta konfirmasi penerimaan untuk RDC masing-masing. No. dokumen dibaca otomatis dari file. Stock masuk sebagai <b>Belum Ada Lokasi</b> lalu dilanjutkan Putaway.';
    }
  }

  function patchAccessDescription(){
    document.querySelectorAll('#s-access .lrow').forEach(row=>{
      const t=row.querySelector('.t');
      const s=row.querySelector('.s');
      if(!t || !s) return;
      if(/Admin|Operator/i.test(t.textContent||'')){
        s.textContent='Operasional RDC + Upload & Konfirmasi Penerimaan SAP untuk RDC sendiri.';
      } else if(/Supervisor/i.test(t.textContent||'')){
        s.textContent='Operasional + approval SPV + Upload & Konfirmasi Penerimaan SAP + Upload Stock SAP Awal + kelola lokasi RDC sendiri.';
      }
    });
  }

  function apply(){
    patchPermissions();
    patchReceivingCard();
    patchAccessDescription();
    if(typeof applyRoleUI==='function'){
      try{ applyRoleUI(); }catch(_e){}
    } else {
      const card=document.getElementById('puRecvFile')?.closest('[data-perm="RECEIVING_UPLOAD"]');
      if(card){
        const role=String(typeof EFFECTIVE_ROLE==='undefined'?'':EFFECTIVE_ROLE||'').toLowerCase();
        card.style.display=['operator','supervisor','rdc_manager','master'].includes(role)?'':'none';
      }
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply,{once:true});
  else apply();
  window.setTimeout(apply,350);
  window.setTimeout(apply,900);
})();
