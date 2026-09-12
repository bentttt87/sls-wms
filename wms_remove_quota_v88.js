// WMS SLS v88 — remove Kuota Ukuran UI; size is captured at Putaway, capacity at Master Lokasi.
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
  function canManageMaster(){
    const r=String(window.EFFECTIVE_ROLE||'').toLowerCase();
    return ['supervisor','rdc_manager','master'].includes(r);
  }

  function hideQuotaMenu(){
    document.querySelectorAll('button[data-s="zone"], #s-zone').forEach(el=>{ el.style.display='none'; el.setAttribute('aria-hidden','true'); });
    document.querySelectorAll('#s-more .lrow').forEach(row=>{
      const txt=(row.textContent||'').toLowerCase();
      const oc=row.getAttribute('onclick')||'';
      if(txt.includes('kuota ukuran') || oc.includes("go('zone')") || oc.includes('go("zone")')) row.style.display='none';
    });
  }

  // Legacy links to the removed screen are redirected back to Putaway.
  if(typeof go==='function' && !go.__wmsV88){
    const baseGo=go;
    const patched=function(s){
      if(String(s)==='zone'){
        alert('Menu Kuota Ukuran sudah dihentikan. Ukuran material sekarang diisi langsung saat Putaway, dan kapasitas diatur dari Master Lokasi.');
        return baseGo('put');
      }
      return baseGo(s);
    };
    patched.__wmsV88=true;
    go=patched;
  }

  // Intercept Putaway only when material size is still missing.
  // This prevents the old flow from demanding a Kuota/Zonasi master.
  function installPutawaySizeGate(){
    const btn=document.getElementById('puFind');
    if(!btn || btn.dataset.v88SizeGate==='1') return;
    btn.dataset.v88SizeGate='1';
    btn.addEventListener('click',function(ev){
      const mat=(document.getElementById('puMat')?.value||'').trim().toUpperCase();
      if(!mat || typeof getMaterialSizeCategory!=='function') return;
      const current=getMaterialSizeCategory(mat);
      if(current) return; // continue to the original Putaway handler

      ev.preventDefault();
      ev.stopImmediatePropagation();
      const gate=document.getElementById('puSizeGate');
      const msg=document.getElementById('puMsg');
      if(!gate) return;

      if(canManageMaster()){
        gate.innerHTML=`<div class="card" style="border-color:#EBD5A3;background:var(--warn-bg)">
          <div style="font-weight:750;color:var(--warn)">⚠ UKURAN BELUM DIISI</div>
          <div style="font-weight:650;margin-top:3px">${esc88(mat)}</div>
          <div class="muted" style="font-size:12.5px;margin-top:4px">Isi ukuran material langsung di sini. Tidak perlu membuat Kuota/Zonasi Ukuran.</div>
          <label style="margin-top:10px">Ukuran / Size</label>
          <input id="puQuickSize" placeholder="contoh 60x60 atau 120x60" autocomplete="off" style="text-transform:uppercase">
          <button class="btn brand" style="margin-top:9px" onclick="quickAssignPutawaySize('${esc88(mat)}',this)">Simpan Ukuran & Lanjut Putaway</button>
        </div>`;
        if(msg){ msg.style.color='var(--warn)'; msg.textContent='Putaway ditahan hanya sampai ukuran material diisi.'; }
      }else{
        gate.innerHTML=`<div class="denied"><b>Ukuran material belum diisi.</b><br>Supervisor RDC perlu mengisi ukuran sebelum Putaway dapat dilanjutkan.</div>`;
        if(msg){ msg.style.color='var(--stop)'; msg.textContent='Minta Supervisor RDC melengkapi ukuran material.'; }
      }
    },true);
  }

  // Add direct per-kavling capacity editing in Master Lokasi.
  if(typeof window.openLocationDetailV85==='function' && !window.openLocationDetailV85.__wmsV88){
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
          <div class="muted" style="font-size:11.5px;margin-bottom:9px">Kapasitas adalah hard capacity fisik lokasi dalam BOX. Nilai tidak boleh lebih kecil dari stock terpakai (${fmt88(used)} BOX).</div>
          <label>Kapasitas Lokasi (BOX)</label>
          <input id="locCapacityInputV88" inputmode="decimal" value="${current}" placeholder="contoh 500">
          <button class="btn brand" style="margin-top:9px" onclick="saveLocationCapacityV88(${Number(kavlingId)},'${esc88(locationCode||'')}')">Simpan Kapasitas</button>
          <div id="locCapacityMsgV88" style="font-size:12px;margin-top:7px"></div>`;
        body.appendChild(box);
      }catch(_e){}
    };
    patchedOpen.__wmsV88=true;
    window.openLocationDetailV85=patchedOpen;
  }

  window.saveLocationCapacityV88=async function(kavlingId,locationCode){
    const input=document.getElementById('locCapacityInputV88');
    const msg=document.getElementById('locCapacityMsgV88');
    const val=Number(input?.value);
    if(!Number.isFinite(val) || val<=0){
      if(msg){msg.style.color='var(--stop)';msg.textContent='Kapasitas harus lebih dari 0 BOX.';}
      return;
    }
    if(msg){msg.style.color='var(--muted)';msg.textContent='Menyimpan…';}
    try{
      const r=await rpc('wms_kavling_capacity_save',{p_kavling:Number(kavlingId),p_capacity:val});
      if(msg){msg.style.color='var(--ok)';msg.textContent=`✓ Kapasitas ${fmt88(r.capacity_box)} BOX tersimpan. Sisa ${fmt88(r.remaining_box)} BOX.`;}
      if(typeof loadLoc==='function') await loadLoc();
      setTimeout(()=>window.openLocationDetailV85(Number(kavlingId),locationCode),250);
    }catch(err){
      if(msg){msg.style.color='var(--stop)';msg.textContent='Gagal: '+err.message;}
    }
  };

  function apply(){
    hideQuotaMenu();
    installPutawaySizeGate();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply,{once:true}); else apply();
  setTimeout(apply,300);
  setTimeout(apply,900);
})();
