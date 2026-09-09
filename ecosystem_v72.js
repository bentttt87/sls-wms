// SLS ecosystem v72 — canonical login tiers + shared logistics master.
// Loaded after the main WMS script so existing operational logic remains intact.
(function(){
  'use strict';
  const RDC_LABELS=['Jakarta','Semarang','Surabaya','Denpasar','Palembang'];

  function cleanApiError(s){
    try{const j=JSON.parse(String(s||''));return j.message||j.error||String(s||'Gagal');}catch(_){return String(s||'Gagal');}
  }
  async function anonRpc(fn,params={}){
    const r=await fetch(`${SB}/rest/v1/rpc/${fn}`,{method:'POST',headers:{apikey:ANON,Authorization:'Bearer '+ANON,'Content-Type':'application/json'},body:JSON.stringify(params)});
    if(!r.ok) throw new Error(cleanApiError(await r.text()));
    return r.json();
  }

  // Canonical role names used across SLS.
  ROLE_LABELS.operator='OPERATOR';
  ROLE_LABELS.supervisor='SPV';
  ROLE_LABELS.rdc_manager='MGR NASIONAL';
  ROLE_LABELS.master='MASTER';

  // MGR uses the former manager permission tier, now with national scope (rdc_name = null).
  // MASTER remains the only full/sensitive-delete tier.
  if(ROLE_PERMS.rdc_manager && !ROLE_PERMS.rdc_manager.includes('LOGISTICS_VIEW')) ROLE_PERMS.rdc_manager.push('LOGISTICS_VIEW');
  if(ROLE_PERMS.supervisor && !ROLE_PERMS.supervisor.includes('LOGISTICS_VIEW')) ROLE_PERMS.supervisor.push('LOGISTICS_VIEW');
  if(ROLE_PERMS.operator && !ROLE_PERMS.operator.includes('LOGISTICS_USE')) ROLE_PERMS.operator.push('LOGISTICS_USE');

  async function canonicalLogin(){
    const uid=document.getElementById('uid')?.value.trim().toLowerCase();
    const pw=document.getElementById('pw')?.value||'';
    const msg=document.getElementById('loginMsg');
    if(!uid||!pw){if(msg){msg.textContent='User ID dan password wajib diisi.';msg.style.color='var(--stop)';}return;}
    if(msg){msg.textContent='Membuat sesi aman…';msg.style.color='var(--muted)';}
    try{
      const email=await anonRpc('get_login_email',{input_username:uid,input_password:pw});
      if(!email) throw new Error('User ID atau password salah / akun belum aktif.');
      const r=await fetch(`${SB}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email,password:pw})});
      if(!r.ok) throw new Error('User ID atau password salah / akun belum aktif.');
      const auth=await r.json();
      TOKEN=auth.access_token;
      const access=await rpc('wms_my_access',{});
      ROLE=access.role;
      EFFECTIVE_ROLE=normalizeRole(ROLE);
      SCOPE=access.rdc_name||null;
      sessionStorage.setItem('sls_wms_canonical_user',uid);
      document.getElementById('loginView').style.display='none';
      document.getElementById('appView').style.display='block';
      document.getElementById('whoRole').textContent=ROLE_LABELS[EFFECTIVE_ROLE]||String(EFFECTIVE_ROLE).toUpperCase();
      await setupRdc();
    }catch(e){if(msg){msg.textContent=cleanApiError(e.message);msg.style.color='var(--stop)';}}
  }

  function interceptLogin(){
    const btn=document.getElementById('loginBtn');
    const uid=document.getElementById('uid');
    const pw=document.getElementById('pw');
    if(btn) btn.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();canonicalLogin();},true);
    if(uid) uid.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();pw?.focus();}},true);
    if(pw) pw.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();canonicalLogin();}},true);
    if(uid){uid.placeholder='OP.JKT.001 / SPV.JKT / MGR.SLS / MASTER.SLS';uid.value=sessionStorage.getItem('sls_wms_canonical_user')||uid.value||'';}
  }

  let LOGM={vendors:[],drivers:[],vehicles:[]};
  const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const isSpv=()=>EFFECTIVE_ROLE==='supervisor';
  const isMaster=()=>EFFECTIVE_ROLE==='master';
  const canSeeMaster=()=>['supervisor','rdc_manager','master'].includes(EFFECTIVE_ROLE);

  function logisticsScreenHtml(){
    return `<section class="screen" id="s-logistics"><div class="wrap">
      <div class="field-title">🚚 Database Ekspedisi</div>
      <div class="field-sub">Master Vendor · Driver · No Polisi untuk RDC aktif.</div>
      <div class="hint"><b>Kewenangan:</b> SPV input/edit · Mgr Nasional read-only · Master delete. Operator memakai data ini pada transaksi, tanpa hak mengubah master.</div>
      <div id="lgScope" class="card" style="padding:10px 14px"></div>

      <div id="lgVendorForm" class="card" style="display:none">
        <div style="font-weight:750;margin-bottom:10px">Input / Edit Vendor Ekspedisi</div>
        <input id="lgVendorId" type="hidden">
        <div class="row"><div><label>Kode Vendor (opsional)</label><input id="lgVendorCode" placeholder="ASSA"></div><div><label>Nama Vendor *</label><input id="lgVendorName" placeholder="PT ..."></div></div>
        <button class="btn brand" id="lgVendorSave" style="margin-top:10px">Simpan Vendor</button><button class="btn ghost" id="lgVendorCancel" style="margin-top:7px">Batal Edit</button><div id="lgVendorMsg" class="muted" style="font-size:12px;margin-top:7px"></div>
      </div>
      <div class="eyebrow">Vendor</div><div id="lgVendors"></div>

      <div id="lgDriverForm" class="card" style="display:none">
        <div style="font-weight:750;margin-bottom:10px">Input / Edit Driver</div><input id="lgDriverId" type="hidden">
        <div class="row"><div><label>Vendor *</label><select id="lgDriverVendor"></select></div><div><label>Nama Driver *</label><input id="lgDriverName" placeholder="Nama driver"></div></div>
        <div style="margin-top:9px"><label>No HP (opsional)</label><input id="lgDriverPhone" placeholder="08..."></div>
        <button class="btn brand" id="lgDriverSave" style="margin-top:10px">Simpan Driver</button><button class="btn ghost" id="lgDriverCancel" style="margin-top:7px">Batal Edit</button><div id="lgDriverMsg" class="muted" style="font-size:12px;margin-top:7px"></div>
      </div>
      <div class="eyebrow">Driver</div><div id="lgDrivers"></div>

      <div id="lgVehicleForm" class="card" style="display:none">
        <div style="font-weight:750;margin-bottom:10px">Input / Edit Kendaraan</div><input id="lgVehicleId" type="hidden">
        <div class="row"><div><label>Vendor *</label><select id="lgVehicleVendor"></select></div><div><label>No Polisi *</label><input id="lgPlate" placeholder="B 1234 ABC"></div></div>
        <div style="margin-top:9px"><label>Jenis Armada (opsional)</label><input id="lgVehicleType" placeholder="CDE / CDD / WB"></div>
        <button class="btn brand" id="lgVehicleSave" style="margin-top:10px">Simpan Kendaraan</button><button class="btn ghost" id="lgVehicleCancel" style="margin-top:7px">Batal Edit</button><div id="lgVehicleMsg" class="muted" style="font-size:12px;margin-top:7px"></div>
      </div>
      <div class="eyebrow">No Polisi / Armada</div><div id="lgVehicles"></div>
    </div></section>`;
  }

  function ensureLogisticsUI(){
    if(document.getElementById('s-logistics')) return;
    const nav=document.querySelector('nav.nav');
    if(nav) nav.insertAdjacentHTML('beforebegin',logisticsScreenHtml());
    const menu=document.querySelector('#s-more .card');
    if(menu) menu.insertAdjacentHTML('afterbegin',`<div class="lrow" id="lgMenuRow" style="cursor:pointer" onclick="go('logistics')"><div class="g"><div class="t">🚚 Database Ekspedisi</div><div class="s">Vendor · Driver · No Polisi</div></div><div class="n muted">›</div></div>`);
    SUB.logistics='DATABASE EKSPEDISI';
    bindLogisticsForms();
  }

  function vendorOptions(selected){
    return '<option value="">Pilih Vendor</option>'+LOGM.vendors.filter(v=>v.active).map(v=>`<option value="${v.id}" ${Number(selected)===Number(v.id)?'selected':''}>${e(v.name)}</option>`).join('');
  }
  function actionButtons(kind,id){
    const a=[];
    if(isSpv()) a.push(`<button class="btn ghost" style="width:auto;padding:6px 9px;font-size:11px" onclick="window.lgEdit('${kind}',${Number(id)})">Edit</button>`);
    if(isMaster()) a.push(`<button class="btn ghost" style="width:auto;padding:6px 9px;font-size:11px;color:var(--stop);border-color:#EFC4C0" onclick="window.lgDelete('${kind}',${Number(id)})">Delete</button>`);
    return a.join(' ');
  }
  function renderLogistics(){
    const role=ROLE_LABELS[EFFECTIVE_ROLE]||EFFECTIVE_ROLE;
    document.getElementById('lgScope').innerHTML=`<b>${e(RDC||'—')}</b><div class="muted" style="font-size:12px">${e(role)} · ${isSpv()?'Input/Edit aktif':isMaster()?'Delete aktif':'Read only'}</div>`;
    ['lgVendorForm','lgDriverForm','lgVehicleForm'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display=isSpv()?'':'none';});
    document.getElementById('lgDriverVendor').innerHTML=vendorOptions(document.getElementById('lgDriverVendor').value);
    document.getElementById('lgVehicleVendor').innerHTML=vendorOptions(document.getElementById('lgVehicleVendor').value);
    document.getElementById('lgVendors').innerHTML=LOGM.vendors.length?`<div class="card" style="padding:4px 14px">${LOGM.vendors.map(v=>`<div class="lrow"><div class="g"><div class="t">${e(v.name)}</div><div class="s">${e(v.code||'Tanpa kode')} · ${v.active?'Aktif':'Nonaktif'}</div></div><div>${actionButtons('VENDOR',v.id)}</div></div>`).join('')}</div>`:'<div class="card muted">Belum ada vendor untuk RDC ini.</div>';
    document.getElementById('lgDrivers').innerHTML=LOGM.drivers.length?`<div class="card" style="padding:4px 14px">${LOGM.drivers.map(d=>`<div class="lrow"><div class="g"><div class="t">${e(d.name)}</div><div class="s">${e(d.vendor_name||'—')}${d.phone?' · '+e(d.phone):''}</div></div><div>${actionButtons('DRIVER',d.id)}</div></div>`).join('')}</div>`:'<div class="card muted">Belum ada driver.</div>';
    document.getElementById('lgVehicles').innerHTML=LOGM.vehicles.length?`<div class="card" style="padding:4px 14px">${LOGM.vehicles.map(x=>`<div class="lrow"><div class="g"><div class="t">${e(x.plate)}</div><div class="s">${e(x.vendor_name||'—')}${x.vehicle_type?' · '+e(x.vehicle_type):''}</div></div><div>${actionButtons('VEHICLE',x.id)}</div></div>`).join('')}</div>`:'<div class="card muted">Belum ada No Polisi / armada.</div>';
  }
  async function loadLogistics(){
    ensureLogisticsUI();
    if(!canSeeMaster()){go('home');return;}
    ['lgVendors','lgDrivers','lgVehicles'].forEach(id=>document.getElementById(id).innerHTML='<div class="card muted">Memuat…</div>');
    try{LOGM=await rpc('logistics_master_list',{p_rdc:RDC});renderLogistics();}
    catch(err){document.getElementById('lgVendors').innerHTML=`<div class="card" style="color:var(--stop)">Gagal: ${e(cleanApiError(err.message))}</div>`;}
  }

  function clearVendor(){['lgVendorId','lgVendorCode','lgVendorName'].forEach(id=>document.getElementById(id).value='');}
  function clearDriver(){['lgDriverId','lgDriverName','lgDriverPhone'].forEach(id=>document.getElementById(id).value='');document.getElementById('lgDriverVendor').value='';}
  function clearVehicle(){['lgVehicleId','lgPlate','lgVehicleType'].forEach(id=>document.getElementById(id).value='');document.getElementById('lgVehicleVendor').value='';}
  function bindLogisticsForms(){
    document.getElementById('lgVendorCancel').onclick=clearVendor;
    document.getElementById('lgDriverCancel').onclick=clearDriver;
    document.getElementById('lgVehicleCancel').onclick=clearVehicle;
    document.getElementById('lgVendorSave').onclick=async()=>{
      const msg=document.getElementById('lgVendorMsg');try{await rpc('logistics_vendor_save',{p_id:Number(document.getElementById('lgVendorId').value)||null,p_rdc:RDC,p_vendor_name:document.getElementById('lgVendorName').value,p_vendor_code:document.getElementById('lgVendorCode').value,p_active:true});msg.style.color='var(--ok)';msg.textContent='✓ Vendor tersimpan.';clearVendor();await loadLogistics();}catch(err){msg.style.color='var(--stop)';msg.textContent=cleanApiError(err.message);}
    };
    document.getElementById('lgDriverSave').onclick=async()=>{
      const msg=document.getElementById('lgDriverMsg');try{await rpc('logistics_driver_save',{p_id:Number(document.getElementById('lgDriverId').value)||null,p_rdc:RDC,p_vendor_id:Number(document.getElementById('lgDriverVendor').value)||null,p_driver_name:document.getElementById('lgDriverName').value,p_phone:document.getElementById('lgDriverPhone').value,p_active:true});msg.style.color='var(--ok)';msg.textContent='✓ Driver tersimpan.';clearDriver();await loadLogistics();}catch(err){msg.style.color='var(--stop)';msg.textContent=cleanApiError(err.message);}
    };
    document.getElementById('lgVehicleSave').onclick=async()=>{
      const msg=document.getElementById('lgVehicleMsg');try{await rpc('logistics_vehicle_save',{p_id:Number(document.getElementById('lgVehicleId').value)||null,p_rdc:RDC,p_vendor_id:Number(document.getElementById('lgVehicleVendor').value)||null,p_plate_no:document.getElementById('lgPlate').value,p_vehicle_type:document.getElementById('lgVehicleType').value,p_active:true});msg.style.color='var(--ok)';msg.textContent='✓ Kendaraan tersimpan.';clearVehicle();await loadLogistics();}catch(err){msg.style.color='var(--stop)';msg.textContent=cleanApiError(err.message);}
    };
  }

  window.lgEdit=function(kind,id){
    if(!isSpv()) return;
    if(kind==='VENDOR'){const v=LOGM.vendors.find(x=>Number(x.id)===Number(id));if(!v)return;document.getElementById('lgVendorId').value=v.id;document.getElementById('lgVendorCode').value=v.code||'';document.getElementById('lgVendorName').value=v.name||'';document.getElementById('lgVendorName').focus();}
    if(kind==='DRIVER'){const d=LOGM.drivers.find(x=>Number(x.id)===Number(id));if(!d)return;document.getElementById('lgDriverId').value=d.id;document.getElementById('lgDriverVendor').value=d.vendor_id;document.getElementById('lgDriverName').value=d.name||'';document.getElementById('lgDriverPhone').value=d.phone||'';document.getElementById('lgDriverName').focus();}
    if(kind==='VEHICLE'){const x=LOGM.vehicles.find(v=>Number(v.id)===Number(id));if(!x)return;document.getElementById('lgVehicleId').value=x.id;document.getElementById('lgVehicleVendor').value=x.vendor_id;document.getElementById('lgPlate').value=x.plate||'';document.getElementById('lgVehicleType').value=x.vehicle_type||'';document.getElementById('lgPlate').focus();}
  };
  window.lgDelete=async function(kind,id){
    if(!isMaster()) return;
    const reason=prompt('Alasan delete (audit trail):','Data tidak berlaku lagi');if(reason===null)return;
    if(!confirm('Delete data ini dari master aktif? Riwayat audit tetap disimpan.'))return;
    try{await rpc('logistics_master_delete',{p_entity:kind,p_id:Number(id),p_reason:reason});await loadLogistics();}catch(err){alert(cleanApiError(err.message));}
  };

  function patchGovernanceText(){
    document.querySelectorAll('#s-access .t').forEach(x=>{if(x.textContent.trim()==='RDC Manager')x.textContent='Mgr Nasional';if(x.textContent.trim()==='Pelaksana')x.textContent='Operator';if(x.textContent.trim()==='Supervisor')x.textContent='SPV';});
    document.querySelectorAll('#s-access .s').forEach(x=>{x.textContent=x.textContent.replace(/RDC Manager/g,'Mgr Nasional').replace(/Supervisor/g,'SPV');});
  }

  function boot(){
    interceptLogin();ensureLogisticsUI();patchGovernanceText();
    const menu=document.getElementById('lgMenuRow');if(menu)menu.style.display=canSeeMaster()?'':'none';
    const oldApply=applyRoleUI; applyRoleUI=function(){oldApply();const m=document.getElementById('lgMenuRow');if(m)m.style.display=canSeeMaster()?'':'none';patchGovernanceText();};
    const oldGo=go; go=function(s){oldGo(s);if(s==='logistics')loadLogistics();};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
