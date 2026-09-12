// WMS SLS v86 — Master Lokasi capacity detail: Kapasitas, Terpakai, Sisa (BOX) + Size Qty.
(function(){
  'use strict';

  function e(v){
    if(typeof esc==='function') return esc(v);
    return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function f(v){
    if(typeof fmt==='function') return fmt(v);
    return Number(v||0).toLocaleString('id-ID');
  }
  function hasCapacity(v){ return v!==null && v!==undefined && Number(v)>0; }

  function ensureStyle(){
    if(document.getElementById('locCapacityV86Style')) return;
    const st=document.createElement('style');
    st.id='locCapacityV86Style';
    st.textContent=`
      #locDetailV85 .capacity-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px}
      #locDetailV85 .capacity-metric{border:1px solid #D9E5F3;border-radius:13px;padding:12px;background:#F8FBFF}
      #locDetailV85 .capacity-metric .lbl{font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:#6E6A63;font-weight:700}
      #locDetailV85 .capacity-metric .val{font-size:23px;font-weight:800;color:#0A4B8D;margin-top:2px;line-height:1.15}
      #locDetailV85 .capacity-metric .val small{font-size:11px;font-weight:650;color:#6E6A63}
      #locDetailV85 .capacity-metric.used .val{color:#17365D}
      #locDetailV85 .capacity-metric.remaining .val{color:#1B7F4B}
      #locDetailV85 .capacity-metric.over{background:#FCEBE9;border-color:#EFC4C0}
      #locDetailV85 .capacity-metric.over .val{color:#B3261E}
      #locDetailV85 .capbar{height:9px;background:#E7EEF6;border-radius:99px;overflow:hidden;margin:2px 0 6px}
      #locDetailV85 .capbar i{display:block;height:100%;background:#0A4B8D;border-radius:99px}
      #locDetailV85 .capbar.over i{background:#B3261E}
      #locDetailV85 .capnote{font-size:11.5px;color:#6E6A63;margin:0 0 14px;display:flex;justify-content:space-between;gap:10px}
      #locDetailV85 .size-meta{font-size:11.5px;color:#6E6A63;margin:10px 0 7px;font-weight:650}
      .loc-v86-cap{font-size:11.5px;color:#52677E;margin-top:3px;font-weight:650}
      @media(max-width:480px){#locDetailV85 .capacity-summary{grid-template-columns:1fr 1fr}#locDetailV85 .capacity-metric:first-child{grid-column:1/-1}}
    `;
    document.head.appendChild(st);
  }

  window.openLocationDetailV85=async function(kavlingId, locationCode){
    ensureStyle();
    const m=(typeof ensureModal==='function'?ensureModal():document.getElementById('locDetailV85'));
    const modal=m||document.getElementById('locDetailV85');
    const body=document.getElementById('locDetailV85Body');
    if(!modal||!body) return;
    modal.classList.add('on');
    body.innerHTML=`<div class="top"><div><div class="title">${e(locationCode||'Lokasi')}</div><div class="sub">Memuat kapasitas, size dan qty stock…</div></div><button class="close" onclick="closeLocationDetailV85()">×</button></div><div class="card muted">⏳ Memuat informasi lokasi…</div>`;
    try{
      const d=await rpc('wms_location_detail',{p_kavling:Number(kavlingId)});
      const sizes=Array.isArray(d.sizes)?d.sizes:[];
      const used=Number(d.used_box ?? d.total_qty_box ?? 0);
      const capOk=hasCapacity(d.capacity_box);
      const capacity=capOk?Number(d.capacity_box):null;
      const remaining=capOk?Number(d.remaining_box ?? Math.max(capacity-used,0)):null;
      const occupancy=capOk?Number(d.occupancy_pct ?? (used/capacity*100)):null;
      const over=capOk?Number(d.over_capacity_box ?? Math.max(used-capacity,0)):0;
      const visualPct=capOk?Math.min(100,Math.max(0,occupancy)):0;
      const rows=sizes.length?sizes.map(x=>`<div class="size-row"><div class="size">${e(x.size||'BELUM KATEGORI')}</div><div class="qty">${f(x.qty)} <small>BOX</small></div></div>`).join(''):`<div class="size-row"><div class="size">—</div><div class="qty">0 <small>BOX</small></div></div>`;

      body.innerHTML=`
        <div class="top">
          <div><div class="title">📍 ${e(d.location_code||locationCode)}</div><div class="sub">${e(d.location_type||'STORAGE')} · ${e(d.rdc_name||'')}</div></div>
          <button class="close" onclick="closeLocationDetailV85()">×</button>
        </div>

        <div class="capacity-summary">
          <div class="capacity-metric"><div class="lbl">Kapasitas Lokasi</div><div class="val">${capOk?f(capacity):'BELUM DIATUR'} ${capOk?'<small>BOX</small>':''}</div></div>
          <div class="capacity-metric used"><div class="lbl">Terpakai</div><div class="val">${f(used)} <small>BOX</small></div></div>
          <div class="capacity-metric remaining ${over>0?'over':''}"><div class="lbl">${over>0?'Over Kapasitas':'Sisa Kapasitas'}</div><div class="val">${capOk?f(over>0?over:remaining):'—'} ${capOk?'<small>BOX</small>':''}</div></div>
        </div>

        ${capOk?`<div class="capbar ${over>0?'over':''}"><i style="width:${visualPct}%"></i></div><div class="capnote"><span>Occupancy ${occupancy.toLocaleString('id-ID',{maximumFractionDigits:1})}%</span><span>${f(used)} / ${f(capacity)} BOX</span></div>`:`<div class="denied" style="margin-bottom:12px">Kapasitas lokasi belum diatur. Isi kapasitas kavling agar Sisa Kapasitas dapat dihitung.</div>`}

        <div class="size-meta">JUMLAH SIZE: ${f(sizes.filter(x=>Number(x.qty)>0).length)}</div>
        <div class="size-head"><div>Ukuran / Size</div><div style="text-align:right">Qty (Box)</div></div>
        ${rows}
      `;
    }catch(err){
      body.innerHTML=`<div class="top"><div><div class="title">${e(locationCode||'Lokasi')}</div><div class="sub">Informasi lokasi</div></div><button class="close" onclick="closeLocationDetailV85()">×</button></div><div class="denied">Gagal memuat: ${e(err.message)}</div>`;
    }
  };

  // Re-render Master Lokasi list to make capacity status clear even before opening popup.
  window.loadLoc=async function(){
    const out=document.getElementById('locOut');
    if(!out) return;
    try{
      const rows=await rpc('wms_location_list',{p_rdc:RDC});
      out.innerHTML=rows.length
        ? `<div class="card" style="padding:4px 14px">`+rows.map(r=>{
            const capOk=hasCapacity(r.kapasitas);
            const used=Number(r.terisi||0);
            const cap=capOk?Number(r.kapasitas):0;
            const remain=capOk?Math.max(cap-used,0):null;
            const pct=capOk?Math.min(100,Math.round(used/cap*100)):0;
            return `<div class="lrow loc-v85-row" data-kavling="${Number(r.id)}" data-code="${e(r.location_code)}" role="button" tabindex="0">
              <div class="g"><div class="t">${e(r.location_code)}</div>
              <div class="s">${f(used)} box terpakai${r.n_material?' · '+f(r.n_material)+' material':' · kosong'}</div>
              <div class="loc-v86-cap">Kapasitas: ${capOk?f(cap)+' box':'BELUM DIATUR'} · Sisa: ${capOk?f(remain)+' box':'—'}</div>
              <div class="bar ${pct>=90?'full':pct>=70?'high':''}"><i style="width:${pct}%"></i></div>
              <div class="loc-v85-more">Klik untuk lihat KAPASITAS, SIZE & QTY →</div></div>
              <div class="n">${capOk?pct+'%':'—'}</div></div>`;
          }).join('')+`</div>`
        : `<div class="card muted">Belum ada kavling. Tambahkan di bawah.</div>`;

      out.querySelectorAll('.loc-v85-row').forEach(row=>{
        const open=()=>openLocationDetailV85(row.dataset.kavling,row.dataset.code);
        row.addEventListener('click',open);
        row.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();open();}});
      });
    }catch(err){
      out.innerHTML=`<div class="card muted">Gagal memuat: ${e(err.message)}</div>`;
    }
  };

  function patchHint(){
    const hint=document.querySelector('#s-loc .hint');
    if(hint) hint.innerHTML='<b>Klik salah satu lokasi</b> untuk melihat <b>Kapasitas, Terpakai, Sisa Kapasitas, Size, dan Qty (Box)</b>. Jika kapasitas belum diatur, sistem akan menandainya sebagai BELUM DIATUR.';
  }

  function apply(){ ensureStyle(); patchHint(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply,{once:true}); else apply();
  setTimeout(apply,450);
})();
