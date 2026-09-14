// WMS SLS v97 — authoritative account model: MASTER, SUPERVISOR, ADMIN, STAFF, MANAGEMENT (national view only).
(function(){
  'use strict';

  function patchRoleModel(){
    if(typeof ROLE_LABELS==='object'){
      ROLE_LABELS.master='MASTER';
      ROLE_LABELS.supervisor='SUPERVISOR';
      ROLE_LABELS.admin='ADMIN';
      ROLE_LABELS.staff='STAFF';
      ROLE_LABELS.management='MANAGEMENT';
    }

    if(typeof ROLE_PERMS==='object'){
      const uniq=a=>[...new Set((a||[]).filter(Boolean))];
      const operatorBase=ROLE_PERMS.operator||['STOCK_VIEW','PUTAWAY','PICKING','TRANSFER','DAMAGE','OPNAME'];
      const staffBase=ROLE_PERMS.warehouse_staff||['STOCK_VIEW','OPNAME'];

      // ADMIN = daily warehouse execution + receiving upload/confirm only.
      // Opening Stock SAP, Reconciliation, Master Location and approvals remain Supervisor/Master.
      ROLE_PERMS.admin=uniq(operatorBase);
      ROLE_PERMS.staff=uniq(staffBase);
      ROLE_PERMS.management=['STOCK_VIEW'];

      // SUPERVISOR = highest RDC operational/approval tier.
      ROLE_PERMS.supervisor=uniq([
        ...(ROLE_PERMS.supervisor||[]),
        'LOCATION_MANAGE','SAP_UPLOAD','RECON','SPV_APPROVE','RDC_APPROVE'
      ]);
    }

    if(typeof normalizeRole==='function' && !normalizeRole.__wmsV97){
      const base=normalizeRole;
      const fn=function(r){
        const x=String(r||'').toLowerCase().trim();
        if(['master','supervisor','admin','staff','management'].includes(x)) return x;
        return base(r);
      };
      fn.__wmsV97=true;
      normalizeRole=fn;
    }

    const uid=document.getElementById('uid');
    if(uid) uid.placeholder='ADMIN.JKT / SPV.JKT / STAFF.JKT.001 / MANAGEMENT.SLS / MASTER.SLS';
  }

  function isManagement(){
    try{return String(EFFECTIVE_ROLE||ROLE||'').toLowerCase()==='management';}catch(_e){return false;}
  }

  // Base setupRdc treats every non-empty scope as one fixed RDC. MANAGEMENT.SLS has
  // scope "ALL RDC", so without this wrapper it would query a fake RDC named ALL RDC
  // and show zero data. For Management, force national selector mode instead.
  function patchManagementRdcSelector(){
    if(typeof setupRdc!=='function' || setupRdc.__wmsV97) return;
    const base=setupRdc;
    const fn=async function(){
      if(isManagement()){
        try{ SCOPE=null; }catch(_e){}
      }
      const out=await base.apply(this,arguments);
      if(isManagement()){
        const wrap=document.getElementById('rdcPickWrap');
        if(wrap) wrap.style.display='block';
      }
      return out;
    };
    fn.__wmsV97=true;
    setupRdc=fn;
  }

  function applyManagementView(){
    if(!isManagement()) return;
    // National management account: choose any RDC, but no transactional action.
    document.querySelectorAll('nav.nav button[data-s]').forEach(btn=>{
      const s=btn.getAttribute('data-s');
      btn.style.display=(s==='home'||s==='stock')?'':'none';
    });
    document.querySelectorAll('#s-home .quick').forEach(card=>{
      const t=(card.textContent||'').toLowerCase();
      card.style.display=t.includes('cari stock')?'':'none';
    });
    const pending=document.getElementById('pendingWork');
    if(pending) pending.style.display='none';
    const roleEl=document.getElementById('whoRole');
    if(roleEl) roleEl.textContent='MANAGEMENT · ALL RDC · VIEW ONLY';
    const wrap=document.getElementById('rdcPickWrap');
    if(wrap) wrap.style.display='block';
  }

  function patchNavigation(){
    if(typeof go!=='function' || go.__wmsV97) return;
    const base=go;
    const fn=function(s){
      if(isManagement() && !['home','stock'].includes(String(s))) return base('home');
      return base(s);
    };
    fn.__wmsV97=true;
    go=fn;
  }

  function cleanManagerWording(){
    const root=document.getElementById('appView');
    if(!root) return;
    const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[]; while(w.nextNode()) nodes.push(w.currentNode);
    nodes.forEach(n=>{
      if(/RDC Manager|Mgr Nasional|MGR NASIONAL/i.test(n.nodeValue||''))
        n.nodeValue=(n.nodeValue||'').replace(/RDC Manager/gi,'Supervisor').replace(/Mgr Nasional/gi,'Management').replace(/MGR NASIONAL/g,'MANAGEMENT');
    });
  }

  function apply(){
    patchRoleModel();
    patchManagementRdcSelector();
    patchNavigation();
    applyManagementView();
    cleanManagerWording();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply,{once:true}); else apply();
  setTimeout(apply,250); setTimeout(apply,900); setTimeout(apply,1800);
})();
