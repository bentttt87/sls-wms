// WMS SLS v89 — Kuota Ukuran fully removed from operational flow.
// Size is captured directly at Putaway; hard capacity is managed in Master Lokasi.
(function(){
  'use strict';

  function esc88(v){
    if(typeof esc==='function') return esc(v);
    return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function fmt88(v){
    if(typeof fmt==='function') return fmt(v);
    return Number(v||0).toLocaleString('id-ID');
  }
  function currentRole(){
    try{
      if(typeof EFFECTIVE_ROLE!=='undefined' && EFFECTIVE_ROLE){
        return String(EFFECTIVE_ROLE).toLowerCase().trim();
      }
    }catch(_e){}
    const txt=(document.querySelector('.hdr .who b')?.textContent||document.querySelector('.desk-role')?.textContent||'').toUpperCase();
    if(txt.includes('SUPERVISOR')||txt.includes('SPV')) return 'supervisor';
    if(txt.includes('RDC MANAGER')||txt.includes('MANAGER')) return 'rdc_manager';
    if(txt.includes('MASTER')) return 'master';
    return '';
  }
  function canManageMaster(){
    return ['supervisor','rdc_manager','master'].includes(currentRole());
  }

  function hideQuotaMenu(){
    document.querySelectorAll('button[data-s="zone"], #s-zone').forEach(el=>{
      el.style.display='none';
      el.setAttribute('aria-hidden','true');
    });
    document.querySelectorAll('.lrow').forEach(row=>{
      const txt=(row.textContent||'').toLowerCase();
      const oc=row.getAttribute('onclick')||'';
      if(txt.includes('kuota ukuran') || txt.includes('zonasi ukuran') || oc.includes("go('zone')") || oc.includes('go("zone")')){
        row.style.display='none';
        row.setAttribute('aria-hidden','true');
      }
    });
  }

  // Frontend no longer fetches/depends on size-zone data.
  function decoupleZoneCache(){
    try{
      if(typeof refreshZoneCache==='function' && !refreshZoneCache.__wmsV89){
        const replacement=async function(){
          const map=await rpc('wms_material_size_list',{p_rdc:RDC}).catch(()=>({}));
          try{ ZN_CACHE=[]; }catch(_e){}
          try{ ZM_CACHE=map||{}; }catch(_e){}
          return map||{};
        };
        replacement.__wmsV89=true;
        refreshZoneCache=replacement;
      }
    }catch(_e){}
  }

  // Any legacy navigation to the removed screen simply returns to Putaway.
  function patchNavigation(){
    if(typeof go!=='function' || go.__wmsV89) return;
    const baseGo=go;
    const patched=function(s){
      if(String(s)==='zone') return baseGo('put');
      return baseGo(s);
    };
    patched.__wmsV89=true;
    go=patched;
  }

  window.savePutawaySizeV89=async function(mat,btn){
    const input=document.getElementById('puQuickSize');
    const msg=document.getElementById('puMsg');
    const raw=(input?.value||'').trim();
    let size=raw;
    try{ if(typeof normSize==='function') size=normSize(raw); }catch(_e){}
    if(!size){
      if(msg){msg.style.color='var(--stop)';msg.textContent='Ukuran / size wajib diisi.';}
      return;
    }
    if(btn){btn.disabled=true;btn.textContent='⏳ Menyimpan ukuran…';}
    try{
      const r=await rpc('wms_material_size_save',{
        p_rdc:RDC,
        p_materials:[String(mat).toUpperCase()],
        p_ukuran:size
      });
      const saved=(r&&r.ukuran)?r.ukuran:size;
      try{ if(typeof ZM_CACHE==='object') ZM_CACHE[String(mat).toUpperCase()]=saved; }catch(_e){}
      const gate=document.getElementById('puSizeGate');
      if(gate) gate.innerHTML='';
      if(msg){msg.style.color='var(--ok)';msg.textContent=`✓ Ukuran ${saved} tersimpan. Mencari lokasi berdasarkan kapasitas kavling…`;}
      setTimeout(()=>document.getElementById('puFind')?.click(),80);
    }catch(err){
      if(btn){btn.disabled=false;btn.textContent='Simpan Ukuran & Lanjut Putaway';}
      if(msg){msg.style.color='var(--stop)';msg.textContent='Gagal menyimpan ukuran: '+err.message;}
    }
  };

  // Capture Putaway only when material size is missing. No quota/zone setup is requested.
  function installPutawaySizeGate(){
    const btn=document.getElementById('puFind');
    if(!btn || btn.dataset.v89SizeGate==='1') return;
    btn.dataset.v89SizeGate='1';
    btn.addEventListener('click',function(ev){
      const mat=(document.getElementById('puMat')?.value||'').trim().toUpperCase();
      if(!mat || typeof getMaterialSizeCategory!=='function') return;
      const current=getMaterialSizeCategory(mat);
      if(current) return;

      ev.preventDefault();
      ev.stopImmediatePropagation();
      const gate=document.getElementById('puSizeGate');
      const msg=document.getElementById('puMsg');
      if(!gate) return;

      if(canManageMaster()){
        gate.innerHTML=`<div class="card" style="border-color:#EBD5A3;background:var(--warn-bg)">
          <div style="font-weight:750;color:var(--warn)">⚠ UKURAN BELUM DIISI</div>
          <div style="font-weight:650;margin-top:3px">${esc88(mat)}</div>
          <div class="muted" style="font-size:12.5px;margin-top:4px">Isi ukuran material langsung di proses Putaway. Tidak ada lagi Kuota/Zonasi Ukuran.</div>
          <label style="margin-top:10px">Ukuran / Size</label>
          <input id="puQuickSize" placeholder="contoh 60x60 atau 120x60" autocomplete="off" style="text-transform:uppercase">
          <button class="btn brand" style="margin-top:9px" onclick="savePutawaySizeV89('${esc88(mat)}',this)">Simpan Ukuran & Lanjut Putaway</button>
        </div>`;
        if(msg){msg.style.color='var(--warn)';msg.textContent='Putaway ditahan hanya sampai ukuran material diisi.';}
      }else{
        gate.innerHTML=`<div class="denied"><b>Ukuran material belum diisi.</b><br>Supervisor RDC dapat mengisi size langsung pada proses Putaway.</div>`;
        if(msg){msg.style.color='var(--stop)';msg.textContent='Minta Supervisor RDC melengkapi size material.';}
      }
    },true);
  }

  // Direct per-kavling capacity editing in Master Lokasi.
  function patchLocationCapacityEditor(){
    if(typeof window.openLocationDetailV85!=='function' || window.openLocationDetailV85.__wmsV89) return;
    const baseOpen=window.openLocationDetailV85;
    const patchedOpen=async function(kavlingId,locationCode){
      await baseOpen(kavlingId,locationCode);
      if(!canManageMaster()) return;
      const body=document.getElementById('locDetailV85Body');
      if(!body || body.querySelector('#locCapacityEditV88')) return;
      try{
        const d=await rpc('wms_location_detail',{p_kavling:Number(kavlingId)});
        const current=(d.capacity_box!==null && d.capacity_box!==undefined)?Number(d.capacity_box):'';
        const used=Number(d.used_box ?? d.total_qty_box ?? 0);
        const box=document.createElement('div');
        box.id='locCapacityEditV88';
        box.className='card';
        box.style.marginTop='14px';
        box.style.borderColor='#CFE0F2';
        box.innerHTML=`
          <div style="font-weight:800;color:#12365F;margin-bottom:4px">Atur Kapasitas Kavling</div>
          <div class="muted" style="font-size:11.5px;margin-bottom:9px">Hard capacity fisik lokasi dalam BOX. Nilai tidak boleh lebih kecil dari stock terpakai (${fmt88(used)} BOX).</div>
          <label>Kapasitas Lokasi (BOX)</label>
          <input id="locCapacityInputV88" inputmode="decimal" value="${current}" placeholder="contoh 500">
          <button class="btn brand" style="margin-top:9px" onclick="saveLocationCapacityV88(${Number(kavlingId)},'${esc88(locationCode||'')}')">Simpan Kapasitas</button>
          <div id="locCapacityMsgV88" style="font-size:12px;margin-top:7px"></div>`;
        body.appendChild(box);
      }catch(_e){}
    };
    patchedOpen.__wmsV89=true;
    window.openLocationDetailV85=patchedOpen;
  }

  window.saveLocationCapacityV88=async function(kavlingId,locationCode){
    const input=document.getElementById('locCapacityInputV88');
    const msg=document.getElementById('locCapacityMsgV88');
    const val=Number(input?.value);
    if(!Number.isFinite(val)||val<=0){
      if(msg){msg.style.color='var(--stop)';msg.textContent='Kapasitas harus lebih dari 0 BOX.';}
      return;
    }
    if(msg){msg.style.color='var(--muted)';msg.textContent='Menyimpan…';}
    try{
      const r=await rpc('wms_kavling_capacity_save',{p_kavling:Number(kavlingId),p_capacity:val});
      if(msg){msg.style.color='var(--ok)';msg.textContent=`✓ Kapasitas ${fmt88(r.capacity_box)} BOX tersimpan. Sisa ${fmt88(r.remaining_box)} BOX.`;}
      if(typeof loadLoc==='function') await loadLoc();
      setTimeout(()=>window.openLocationDetailV85(Number(kavlingId),locationCode),180);
    }catch(err){
      if(msg){msg.style.color='var(--stop)';msg.textContent='Gagal: '+err.message;}
    }
  };

  function apply(){
    decoupleZoneCache();
    patchNavigation();
    hideQuotaMenu();
    installPutawaySizeGate();
    patchLocationCapacityEditor();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply,{once:true});
  else apply();
  setTimeout(apply,250);
  setTimeout(apply,800);
})();
