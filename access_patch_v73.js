// WMS SLS v73 — access alignment for RDC Supervisor + Warehouse Staff.
(function(){
  'use strict';

  function applyAccessPatch(){
    if(typeof window.ROLE_LABELS==='undefined' || typeof window.ROLE_PERMS==='undefined' || typeof window.normalizeRole!=='function'){
      window.setTimeout(applyAccessPatch,100);
      return;
    }

    // Supervisor may maintain master location within own RDC.
    if(Array.isArray(window.ROLE_PERMS.supervisor) && !window.ROLE_PERMS.supervisor.includes('LOCATION_MANAGE')){
      window.ROLE_PERMS.supervisor.push('LOCATION_MANAGE');
    }

    // Dedicated Warehouse Staff: stock lookup + stock opname only.
    window.ROLE_LABELS.warehouse_staff='STAFF WAREHOUSE';
    window.ROLE_PERMS.warehouse_staff=['STOCK_VIEW','OPNAME'];

    const baseNormalize=window.normalizeRole;
    if(!baseNormalize.__warehouseStaffPatched){
      const patched=function(r){
        const x=String(r||'').toLowerCase().trim();
        if(['warehouse_staff','staff_warehouse','warehouse-staff'].includes(x)) return 'warehouse_staff';
        return baseNormalize(r);
      };
      patched.__warehouseStaffPatched=true;
      window.normalizeRole=patched;
    }
  }

  applyAccessPatch();
})();
