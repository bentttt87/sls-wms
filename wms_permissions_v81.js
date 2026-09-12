// WMS SLS v81 — access patch: Supervisor Master Lokasi + Warehouse Staff limited profile.
(function(){
  'use strict';

  function patchRoles(){
    if(typeof ROLE_LABELS==='object'){
      ROLE_LABELS.warehouse_staff='STAFF WAREHOUSE';
    }
    if(typeof ROLE_PERMS==='object'){
      if(Array.isArray(ROLE_PERMS.supervisor) && !ROLE_PERMS.supervisor.includes('LOCATION_MANAGE')){
        ROLE_PERMS.supervisor.push('LOCATION_MANAGE');
      }
      ROLE_PERMS.warehouse_staff=['STOCK_VIEW','OPNAME'];
    }

    if(typeof normalizeRole==='function' && !normalizeRole.__wmsV81){
      const baseNormalize=normalizeRole;
      const patched=function(r){
        const x=String(r||'').toLowerCase().trim();
        if(x==='warehouse_staff') return 'warehouse_staff';
        return baseNormalize(r);
      };
      patched.__wmsV81=true;
      normalizeRole=patched;
    }

    const uid=document.getElementById('uid');
    if(uid) uid.placeholder='OP.JKT.001 / SPV.JKT / STAFF.JKT.001 / MGR.SLS / MASTER.SLS';
  }

  patchRoles();
  window.setTimeout(patchRoles,300);
})();
