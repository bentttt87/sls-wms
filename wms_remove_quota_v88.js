// WMS SLS v98 — SIZE/QUOTA/ZONING REMOVED FROM OPERATIONAL FLOW.
// Operational rule: Putaway/Transfer/Occupancy use physical kavling capacity (BOX) only.
// Legacy size master data may remain in DB for history, but must not gate transactions or appear in UI.
(function(){
  'use strict';

  const esc98=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt98=v=>typeof fmt==='function'?fmt(v):Number(v||0).toLocaleString('id-ID');
  const role98=()=>{try{return String(EFFECTIVE_ROLE||ROLE||'').toLowerCase().trim();}catch(_e){return '';}};
  const canManageCapacity=()=>['supervisor','rdc_manager','master'].includes(role98());

  function retireSizeState(){
    try{ ZN_CACHE=[]; }catch(_e){}
    try{ ZM_CACHE={}; }catch(_e){}
    try{ window.refreshZoneCache=async()=>({}); }catch(_e){}
    try{ window.getMaterialSizeCategory=()=>null; }catch(_e){}
    try{ window.getZoneForMaterial=()=>[]; }catch(_e){}
  }

  function hideLegacySizeUi(){
    ['s-zone','s-kap','s-putex','homeZoneAlert','puSizeGate'].forEach(id=>{
      const el=document.getElementById(id);
      if(el){el.innerHTML=id==='puSizeGate'?'':el.innerHTML;el.style.display='none';el.setAttribute('aria-hidden','true');}
    });
    document.querySelectorAll('button[data-s="zone"],button[data-s="kap"],button[data-s="putex"]').forEach(el=>{
      el.style.display='none';el.setAttribute('aria-hidden','true');
    });
    document.querySelectorAll('.lrow').forEach(row=>{
      const txt=String(row.textContent||'').toLowerCase();
      const oc=String(row.getAttribute('onclick')||'').toLowerCase();
      if(oc.includes("go('zone')")||oc.includes('go("zone")')||oc.includes("go('kap')")||oc.includes('go("kap")')||oc.includes("go('putex')")||oc.includes('go("putex")')||txt.includes('zonasi ukuran')||txt.includes('kuota ukuran')||txt.includes('master kapasitas')&&txt.includes('ukuran')){
        row.style.display='none';row.setAttribute('aria-hidden','true');return;
      }
      if(txt.includes('occupancy')){
        const sub=row.querySelector('.s');
        if(sub) sub.textContent='Kapasitas fisik kavling · per gudang';
      }
    });

    const occ=document.querySelector('#s-occ .hint');
    if(occ) occ.textContent='Occupancy dihitung dari total BOX fisik terhadap kapasitas BOX kavling. Tidak memakai kategori, kuota, atau zonasi ukuran.';

    const pmSize=document.getElementById('pmSize');
    if(pmSize){pmSize.value='';const wrap=pmSize.closest('div');if(wrap)wrap.style.display='none';}
  }

  function patchNavigation(){
    if(typeof go!=='function'||go.__wmsNoSizeV98) return;
    const base=go;
    const fn=function(screen){
      const s=String(screen||'');
      if(s==='zone'||s==='kap') return base('loc');
      if(s==='putex') return base('more');
      return base(screen);
    };
    fn.__wmsNoSizeV98=true;
    go=fn;
  }

  function installPutawayFinder(){
    const old=document.getElementById('puFind');
    if(!old||old.dataset.noSizeV98==='1') return;
    const btn=old.cloneNode(true);
    btn.dataset.noSizeV98='1';
    old.replaceWith(btn); // removes every legacy size-gate listener attached to the old node

    btn.addEventListener('click',async()=>{
      const mat=(document.getElementById('puMat')?.value||'').trim().toUpperCase();
      const batch=(document.getElementById('puBatch')?.value||'').trim();
      const qty=Number(document.getElementById('puQty')?.value);
      const maxQty=Number(document.getElementById('puMaxQty')?.value)||0;
      const msg=document.getElementById('puMsg');
      const out=document.getElementById('puOut');
      const gate=document.getElementById('puSizeGate');
      if(gate){gate.innerHTML='';gate.style.display='none';}
      if(msg)msg.textContent='';
      if(out)out.innerHTML='';

      if(!mat||!Number.isFinite(qty)||qty<=0){if(msg){msg.style.color='var(--stop)';msg.textContent='Pilih stock SAP dari menu Stock Belum Ada Lokasi.';}return;}
      if(maxQty<=0){if(msg){msg.style.color='var(--stop)';msg.textContent='Putaway ditolak: stock harus berasal dari daftar SAP Belum Ada Lokasi.';}return;}
      if(qty>maxQty){if(msg){msg.style.color='var(--stop)';msg.textContent=`Putaway ditolak: qty ${fmt98(qty)} melebihi stock SAP belum berlokasi ${fmt98(maxQty)} box.`;}return;}

      btn.disabled=true;btn.textContent='⏳ Mencari lokasi…';
      try{
        const res=await rpc('wms_suggest_putaway',{p_rdc:RDC,p_material:mat,p_qty:qty,p_batch:batch});
        let h='<div class="eyebrow">Saran lokasi berdasarkan kapasitas fisik</div>';
        (res||[]).forEach(r=>{
          if(!r.kavling_id){
            h+=`<div class="card" style="border-color:#EFC4C0;background:var(--stop-bg)"><div style="font-weight:700;color:var(--stop)">${fmt98(r.qty_to_place)} box belum dapat lokasi</div><div class="muted" style="font-size:12px;margin-top:4px">${esc98(r.reason||'Kapasitas STORAGE tidak cukup.')}</div></div>`;
            return;
          }
          const after=Number(r.terisi||0)+Number(r.qty_to_place||0);
          const pct=Number(r.kapasitas)>0?Math.min(100,Math.round(after/Number(r.kapasitas)*100)):0;
          h+=`<div class="ticket"><div class="tk-top"><div class="m"><div class="tk-mat">${r.gudang?esc98(r.gudang)+' · '+esc98(r.block||'')+' · ':''}${esc98(r.location_code)}</div><div class="tk-desc">Terisi ${fmt98(r.terisi)} / ${fmt98(r.kapasitas)} box · sisa ${fmt98(r.sisa)}${r.sesuai_master?' · sesuai master motif':''}</div></div><div class="tk-qty"><b>${fmt98(r.qty_to_place)}</b><span>${r.pallet?fmt98(r.pallet)+' PALLET':'BOX'}</span></div></div><div class="tk-strip"><div class="bar ${pct>=90?'full':pct>=70?'high':''}"><i style="width:${pct}%"></i></div><div class="muted" style="font-size:12px;margin-top:7px">${esc98(r.reason||'Kapasitas tersedia')}</div><button class="btn brand" style="margin-top:10px" onclick="doPut(${Number(r.kavling_id)},'${esc98(mat)}','${esc98(batch)}',${Number(r.qty_to_place)},this)">Simpan ke ${esc98(r.location_code)}</button><button class="btn ghost" style="margin-top:8px" onclick="puManual('${esc98(mat)}','${esc98(batch)}',${Number(r.qty_to_place)})">Pilih kavling lain…</button></div></div>`;
        });
        if(out)out.innerHTML=h;
        if(msg){msg.style.color='var(--muted)';msg.textContent='Lokasi dihitung dari kapasitas fisik kavling, ketersediaan ruang, konsolidasi material/seri, dan master motif.';}
      }catch(e){if(msg){msg.style.color='var(--stop)';msg.textContent='Gagal: '+e.message;}}
      finally{btn.disabled=false;btn.textContent='Cari lokasi';}
    });
  }

  window.puManual=async function(mat,batch,qty){
    const out=document.getElementById('puOut');
    if(!out)return;
    document.getElementById('puManLoad')?.remove();
    document.getElementById('puManBox')?.remove();
    out.insertAdjacentHTML('afterbegin','<div class="card muted" id="puManLoad">⏳ Memuat kavling STORAGE yang masih memiliki kapasitas…</div>');
    try{
      const targets=await rpc('wms_putaway_targets',{p_rdc:RDC});
      document.getElementById('puManLoad')?.remove();
      if(!(targets||[]).length){out.insertAdjacentHTML('afterbegin','<div class="card" style="border-color:#EFC4C0;background:var(--stop-bg)">Tidak ada kavling STORAGE dengan kapasitas tersedia. Isi kapasitas di Master Lokasi atau tambah lokasi.</div>');return;}
      const opts=targets.map(t=>`<option value="${Number(t.kavling_id)}">${esc98(t.location_code)} · ${esc98(t.gudang||'')} / ${esc98(t.block||'')} · sisa ${fmt98(t.sisa)} box</option>`).join('');
      out.insertAdjacentHTML('afterbegin',`<div class="card" id="puManBox" style="border-color:var(--brand)"><div style="font-weight:700;font-size:13.5px;margin-bottom:4px">Pilih kavling sendiri</div><div class="muted" style="font-size:12px;margin-bottom:9px">Hanya lokasi STORAGE aktif yang memiliki kapasitas fisik tersisa.</div><label>Kavling</label><select id="puManKav" style="margin-bottom:10px">${opts}</select><label>Qty</label><input id="puManQty" inputmode="numeric" value="${Number(qty)}" style="margin-bottom:12px"><button class="btn brand" onclick="puManualSave('${esc98(mat)}','${esc98(batch)}')">Simpan ke kavling ini</button><button class="btn ghost" style="margin-top:8px" onclick="document.getElementById('puManBox').remove()">Batal</button><div id="puManMsg" style="font-size:13px;margin-top:8px"></div></div>`);
    }catch(e){document.getElementById('puManLoad')?.remove();out.insertAdjacentHTML('afterbegin',`<div class="denied">Gagal memuat kavling: ${esc98(e.message)}</div>`);}
  };

  function patchOccupancy(){
    window.loadOccupancy=async function(){
      const el=document.getElementById('occOut');if(!el)return;
      el.innerHTML='<div class="card muted">⏳ Menghitung kapasitas fisik kavling…</div>';
      try{
        const d=await rpc('wms_occupancy_detail',{p_rdc:RDC});
        const r=d.rdc||{};
        let h=`<div class="kpis"><div class="kpi"><div class="lbl">Terisi RDC</div><div class="val">${fmt98(r.terisi_box)}<small> box</small></div></div><div class="kpi"><div class="lbl">Kapasitas RDC</div><div class="val">${fmt98(r.kapasitas_box)}<small> box</small></div></div><div class="kpi"><div class="lbl">Occupancy</div><div class="val">${r.occupancy_persen==null?'—':r.occupancy_persen+'%'} </div></div><div class="kpi ${Number(r.kavling_tanpa_kapasitas)>0?'alert':''}"><div class="lbl">Kavling tanpa kapasitas</div><div class="val">${fmt98(r.kavling_tanpa_kapasitas)}</div></div></div>`;
        if(Number(r.unlocated_box)>0)h+=`<div class="card" style="border-color:#EBD5A3;background:var(--warn-bg);margin-top:12px"><b>${fmt98(r.unlocated_box)} box masih Belum Ada Lokasi</b><div class="muted" style="font-size:12px">UNLOCATED tidak dihitung sebagai occupancy fisik sampai Putaway.</div></div>`;
        h+='<div class="eyebrow">Per gudang</div><div class="card" style="padding:4px 14px">'+(d.per_gudang||[]).map(g=>`<div class="lrow"><div class="g"><div class="t">${esc98(g.gudang)}</div><div class="s">${fmt98(g.terisi_box)} / ${fmt98(g.kapasitas_box)} box · sisa ${fmt98(g.sisa_box)}${Number(g.kavling_tanpa_kapasitas)>0?' · '+fmt98(g.kavling_tanpa_kapasitas)+' kavling tanpa kapasitas':''}</div></div><div style="text-align:right"><div class="n">${g.occupancy_persen==null?'—':g.occupancy_persen+'%'}</div><span class="pill ${g.status==='OVERLOAD'?'p-stop':g.status==='HAMPIR PENUH'?'p-warn':'p-ok'}" style="font-size:9px">${esc98(g.status||'-')}</span></div></div>`).join('')+'</div>';
        const used=(d.per_kavling||[]).filter(k=>Number(k.terisi_box)>0||Number(k.kapasitas_box)<=0).sort((a,b)=>Number(b.occupancy_persen||0)-Number(a.occupancy_persen||0)).slice(0,100);
        h+='<div class="eyebrow">Kavling terpakai / perlu perhatian</div><div class="card" style="padding:4px 14px">'+(used.length?used.map(k=>`<div class="lrow"><div class="g"><div class="t">${esc98(k.location_code)}</div><div class="s">${fmt98(k.terisi_box)} / ${fmt98(k.kapasitas_box)} box · ${esc98(k.location_type||'STORAGE')}</div></div><div style="text-align:right"><div class="n">${k.occupancy_persen==null?'—':k.occupancy_persen+'%'}</div><span class="pill ${k.status==='OVERLOAD'?'p-stop':k.status==='HAMPIR PENUH'?'p-warn':k.status==='KAPASITAS BELUM DIATUR'?'p-warn':'p-ok'}" style="font-size:9px">${esc98(k.status||'-')}</span></div></div>`).join(''):'<div class="muted" style="padding:12px">Belum ada kavling terpakai.</div>')+'</div>';
        el.innerHTML=h;
      }catch(e){el.innerHTML=`<div class="denied">Gagal menghitung occupancy: ${esc98(e.message)}</div>`;}
    };
  }

  function patchPallet(){
    window.loadPallet=async function(){
      const el=document.getElementById('pmOut');if(!el)return;
      try{
        const rows=await rpc('wms_pallet_list',{p_rdc:RDC});
        el.innerHTML=(rows||[]).length?'<div class="eyebrow">Tersimpan</div><div class="card" style="padding:4px 14px">'+rows.map(r=>`<div class="lrow"><div class="g"><div class="t">${esc98(r.kode_motif)}</div><div class="s">${esc98(r.keterangan||'Master isi pallet')}</div></div><div style="text-align:right"><div class="n">${fmt98(r.box_per_pallet)}</div><div class="s" style="font-size:10px">box/pallet</div></div></div>`).join('')+'</div>':'<div class="card muted">Belum ada data. Tambahkan di atas.</div>';
      }catch(e){el.innerHTML=`<div class="card muted">Gagal: ${esc98(e.message)}</div>`;}
    };
  }

  function patchLocationCapacityEditor(){
    if(typeof window.openLocationDetailV85!=='function'||window.openLocationDetailV85.__wmsV98) return;
    const base=window.openLocationDetailV85;
    const fn=async function(kavlingId,locationCode){
      await base(kavlingId,locationCode);
      if(!canManageCapacity())return;
      const body=document.getElementById('locDetailV85Body');
      if(!body||body.querySelector('#locCapacityEditV98'))return;
      try{
        const d=await rpc('wms_location_detail',{p_kavling:Number(kavlingId)});
        const current=d.capacity_box==null?'':Number(d.capacity_box),used=Number(d.used_box||0);
        const box=document.createElement('div');box.id='locCapacityEditV98';box.className='card';box.style.marginTop='14px';box.style.borderColor='#CFE0F2';
        box.innerHTML=`<div style="font-weight:800;color:#12365F;margin-bottom:4px">Atur Kapasitas Kavling</div><div class="muted" style="font-size:11.5px;margin-bottom:9px">Hard capacity fisik lokasi dalam BOX. Nilai tidak boleh lebih kecil dari stock terpakai (${fmt98(used)} BOX).</div><label>Kapasitas Lokasi (BOX)</label><input id="locCapacityInputV98" inputmode="decimal" value="${current}" placeholder="contoh 500"><button class="btn brand" style="margin-top:9px" onclick="saveLocationCapacityV98(${Number(kavlingId)},'${esc98(locationCode||'')}')">Simpan Kapasitas</button><div id="locCapacityMsgV98" style="font-size:12px;margin-top:7px"></div>`;
        body.appendChild(box);
      }catch(_e){}
    };fn.__wmsV98=true;window.openLocationDetailV85=fn;
  }

  window.saveLocationCapacityV98=async function(kavlingId,locationCode){
    const input=document.getElementById('locCapacityInputV98'),msg=document.getElementById('locCapacityMsgV98'),val=Number(input?.value);
    if(!Number.isFinite(val)||val<=0){if(msg){msg.style.color='var(--stop)';msg.textContent='Kapasitas harus lebih dari 0 BOX.';}return;}
    if(msg){msg.style.color='var(--muted)';msg.textContent='Menyimpan…';}
    try{const r=await rpc('wms_kavling_capacity_save',{p_kavling:Number(kavlingId),p_capacity:val});if(msg){msg.style.color='var(--ok)';msg.textContent=`✓ Kapasitas ${fmt98(r.capacity_box)} BOX tersimpan. Sisa ${fmt98(r.remaining_box)} BOX.`;}if(typeof loadLoc==='function')await loadLoc();setTimeout(()=>window.openLocationDetailV85(Number(kavlingId),locationCode),180);}catch(e){if(msg){msg.style.color='var(--stop)';msg.textContent='Gagal: '+e.message;}}
  };

  function apply(){
    retireSizeState();
    hideLegacySizeUi();
    patchNavigation();
    patchOccupancy();
    patchPallet();
    installPutawayFinder();
    patchLocationCapacityEditor();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
  setTimeout(apply,250);setTimeout(apply,900);setTimeout(apply,1800);
})();
