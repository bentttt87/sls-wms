// WMS SLS v93 — authoritative account model: MASTER, SUPERVISOR, ADMIN, STAFF, MANAGEMENT (national view only).
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
      ROLE_PERMS.admin=uniq([...operatorBase,'SAP_UPLOAD','RECON']);
      ROLE_PERMS.staff=uniq(staffBase);
      ROLE_PERMS.management=['STOCK_VIEW'];
      ROLE_PERMS.supervisor=uniq([...(ROLE_PERMS.supervisor||[]),'LOCATION_MANAGE','SPV_APPROVE','RDC_APPROVE']);
    }

    if(typeof normalizeRole==='function' && !normalizeRole.__wmsV93){
      const base=normalizeRole;
      const fn=function(r){
        const x=String(r||'').toLowerCase().trim();
        if(['master','supervisor','admin','staff','management'].includes(x)) return x;
        return base(r);
      };
      fn.__wmsV93=true;
      normalizeRole=fn;
    }

    const uid=document.getElementById('uid');
    if(uid) uid.placeholder='ADMIN.JKT / SPV.JKT / STAFF.JKT.001 / MANAGEMENT.SLS / MASTER.SLS';
  }

  function isManagement(){
    try{return String(EFFECTIVE_ROLE||ROLE||'').toLowerCase()==='management';}catch(_e){return false;}
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
    if(typeof go!=='function' || go.__wmsV93) return;
    const base=go;
    const fn=function(s){
      if(isManagement() && !['home','stock'].includes(String(s))) return base('home');
      return base(s);
    };
    fn.__wmsV93=true;
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
    patchNavigation();
    applyManagementView();
    cleanManagerWording();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply,{once:true}); else apply();
  setTimeout(apply,250); setTimeout(apply,900); setTimeout(apply,1800);
})();
