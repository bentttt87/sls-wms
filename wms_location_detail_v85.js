// WMS SLS v85 — Master Lokasi click detail: Size + Qty (BOX).
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

  function ensureStyle(){
    if(document.getElementById('locDetailV85Style')) return;
    const st=document.createElement('style');
    st.id='locDetailV85Style';
    st.textContent=`
      .loc-v85-row{cursor:pointer;border-radius:10px;padding-left:8px!important;padding-right:8px!important;transition:background .15s ease}
      .loc-v85-row:hover{background:#F4F8FD}
      .loc-v85-more{font-size:11px;color:#0A4B8D;font-weight:700;margin-top:5px}
      #locDetailV85{position:fixed;inset:0;z-index:9999;background:rgba(8,25,46,.45);display:none;align-items:center;justify-content:center;padding:18px}
      #locDetailV85.on{display:flex}
      #locDetailV85 .panel{width:min(520px,100%);max-height:82vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 24px 80px rgba(0,0,0,.24);padding:18px}
      #locDetailV85 .top{display:flex;gap:12px;align-items:flex-start;margin-bottom:14px}
      #locDetailV85 .title{font-size:20px;font-weight:800;color:#12365F;letter-spacing:-.3px}
      #locDetailV85 .sub{font-size:12px;color:#6E6A63;margin-top:2px}
      #locDetailV85 .close{margin-left:auto;border:0;background:#EEF4FA;width:36px;height:36px;border-radius:10px;font-size:19px;cursor:pointer;color:#12365F}
      #locDetailV85 .summary{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
      #locDetailV85 .metric{border:1px solid #D9E5F3;border-radius:13px;padding:12px;background:#F8FBFF}
      #locDetailV85 .metric .lbl{font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:#6E6A63;font-weight:700}
      #locDetailV85 .metric .val{font-size:24px;font-weight:800;color:#0A4B8D;margin-top:2px}
      #locDetailV85 .size-head,#locDetailV85 .size-row{display:grid;grid-template-columns:1fr 120px;gap:12px;align-items:center}
      #locDetailV85 .size-head{padding:9px 12px;background:#0A4B8D;color:#fff;border-radius:10px 10px 0 0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px}
      #locDetailV85 .size-row{padding:12px;border:1px solid #E1E8F0;border-top:0;background:#fff}
      #locDetailV85 .size-row:last-child{border-radius:0 0 10px 10px}
      #locDetailV85 .size{font:800 15px var(--mono,monospace);color:#17365D}
      #locDetailV85 .qty{text-align:right;font-size:17px;font-weight:800;color:#163A62}
      #locDetailV85 .qty small{font-size:11px;font-weight:600;color:#6E6A63}
      @media(max-width:480px){#locDetailV85{align-items:flex-end;padding:0}#locDetailV85 .panel{width:100%;max-height:86vh;border-radius:20px 20px 0 0;padding:16px}#locDetailV85 .size-head,#locDetailV85 .size-row{grid-template-columns:1fr 100px}}
    `;
    document.head.appendChild(st);
  }

  function ensureModal(){
    ensureStyle();
    let m=document.getElementById('locDetailV85');
    if(m) return m;
    m=document.createElement('div');
    m.id='locDetailV85';
    m.innerHTML='<div class="panel"><div id="locDetailV85Body"></div></div>';
    m.addEventListener('click',ev=>{ if(ev.target===m) closeLocationDetailV85(); });
    document.body.appendChild(m);
    return m;
  }

  window.closeLocationDetailV85=function(){
    const m=document.getElementById('locDetailV85');
    if(m) m.classList.remove('on');
  };

  window.openLocationDetailV85=async function(kavlingId, locationCode){
    const m=ensureModal();
    const body=document.getElementById('locDetailV85Body');
    m.classList.add('on');
    body.innerHTML=`<div class="top"><div><div class="title">${e(locationCode||'Lokasi')}</div><div class="sub">Memuat size dan qty stock…</div></div><button class="close" onclick="closeLocationDetailV85()">×</button></div><div class="card muted">⏳ Memuat informasi lokasi…</div>`;
    try{
      const d=await rpc('wms_location_detail',{p_kavling:Number(kavlingId)});
      const sizes=Array.isArray(d.sizes)?d.sizes:[];
      const rows=sizes.length?sizes.map(x=>`<div class="size-row"><div class="size">${e(x.size||'BELUM KATEGORI')}</div><div class="qty">${f(x.qty)} <small>BOX</small></div></div>`).join(''):`<div class="size-row"><div class="size">—</div><div class="qty">0 <small>BOX</small></div></div>`;
      body.innerHTML=`
        <div class="top">
          <div><div class="title">📍 ${e(d.location_code||locationCode)}</div><div class="sub">${e(d.location_type||'STORAGE')} · ${e(d.rdc_name||'')}</div></div>
          <button class="close" onclick="closeLocationDetailV85()">×</button>
        </div>
        <div class="summary">
          <div class="metric"><div class="lbl">Total Qty</div><div class="val">${f(d.total_qty_box)} <span style="font-size:12px">BOX</span></div></div>
          <div class="metric"><div class="lbl">Jumlah Size</div><div class="val">${f(sizes.filter(x=>Number(x.qty)>0).length)}</div></div>
        </div>
        <div class="size-head"><div>Ukuran / Size</div><div style="text-align:right">Qty (Box)</div></div>
        ${rows}
        ${d.capacity_box!=null?`<div class="muted" style="font-size:11.5px;margin-top:10px;text-align:right">Kapasitas lokasi: ${f(d.capacity_box)} box</div>`:''}
      `;
    }catch(err){
      body.innerHTML=`<div class="top"><div><div class="title">${e(locationCode||'Lokasi')}</div><div class="sub">Informasi lokasi</div></div><button class="close" onclick="closeLocationDetailV85()">×</button></div><div class="denied">Gagal memuat: ${e(err.message)}</div>`;
    }
  };

  // Replace current Master Lokasi renderer so every row is clickable.
  window.loadLoc=async function(){
    const out=document.getElementById('locOut');
    if(!out) return;
    try{
      const rows=await rpc('wms_location_list',{p_rdc:RDC});
      out.innerHTML=rows.length
        ? `<div class="card" style="padding:4px 14px">`+rows.map(r=>{
            const pct=r.kapasitas?Math.min(100,Math.round(Number(r.terisi||0)/Number(r.kapasitas)*100)):0;
            return `<div class="lrow loc-v85-row" data-kavling="${Number(r.id)}" data-code="${e(r.location_code)}" role="button" tabindex="0">
              <div class="g"><div class="t">${e(r.location_code)}</div>
              <div class="s">${f(r.terisi)} / ${f(r.kapasitas)} box${r.n_material?' · '+f(r.n_material)+' material':' · kosong'}</div>
              <div class="bar ${pct>=90?'full':pct>=70?'high':''}"><i style="width:${pct}%"></i></div>
              <div class="loc-v85-more">Klik untuk lihat SIZE & QTY →</div></div>
              <div class="n">${pct}%</div></div>`;
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

  function applyHint(){
    const hint=document.querySelector('#s-loc .hint');
    if(hint && !hint.dataset.locDetailV85){
      hint.dataset.locDetailV85='1';
      hint.innerHTML='<b>Klik salah satu lokasi</b> untuk melihat <b>Ukuran (Size)</b> dan <b>Qty (Box)</b> yang tersimpan di lokasi tersebut. Kode lokasi dibuat otomatis. Kavling berisi stock tidak bisa dinonaktifkan.';
    }
  }

  function apply(){ ensureModal(); applyHint(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply,{once:true}); else apply();
  setTimeout(apply,500);
})();
