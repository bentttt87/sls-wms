// WMS SLS v108 — Operational Dashboard / Warehouse Execution Control
// Detail execution lives in WMS. Control Tower receives only management-level recap.
(function(){
  'use strict';
  let DASH_DATA=null;
  const escV=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtV=v=>typeof fmt==='function'?fmt(v):Number(v||0).toLocaleString('id-ID');
  const pctV=v=>v==null||!Number.isFinite(Number(v))?'—':Number(v).toLocaleString('id-ID',{maximumFractionDigits:1})+'%';
  const dtV=v=>{if(!v)return '—';try{return new Date(v).toLocaleString('id-ID');}catch(_){return String(v)}};

  function css(){
    if(document.getElementById('wmsDash108Style')) return;
    const st=document.createElement('style');st.id='wmsDash108Style';st.textContent=`
      .w108-wrap{margin:12px 0 18px}.w108-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px}
      .w108-head h2{font-size:17px;margin:0;color:var(--ink);letter-spacing:-.25px}.w108-sub{font-size:11.5px;color:var(--muted);margin-top:2px;line-height:1.45}
      .w108-refresh{border:1px solid var(--line);background:#fff;border-radius:9px;padding:7px 10px;font-size:11px;font-weight:700;cursor:pointer;color:var(--ink)}
      .w108-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-bottom:10px}.w108-sum{background:#fff;border:1px solid var(--line);border-radius:11px;padding:11px 12px;min-width:0}
      .w108-sum .l{font:700 9.5px var(--mono);letter-spacing:.55px;color:var(--muted);text-transform:uppercase}.w108-sum .v{font-size:20px;font-weight:800;margin-top:3px;letter-spacing:-.4px}.w108-sum .s{font-size:10px;color:var(--muted);margin-top:2px;line-height:1.3}
      .w108-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.w108-card{background:#fff;border:1px solid var(--line);border-left:4px solid var(--ok);border-radius:11px;padding:12px;min-width:0}.w108-card.watch{border-left-color:var(--warn);background:var(--warn-bg)}.w108-card.crit{border-left-color:var(--stop);background:var(--stop-bg)}.w108-card.setup{border-left-color:#A9A39A;background:#FBFAF8}
      .w108-rdc{display:flex;justify-content:space-between;align-items:flex-start;gap:7px}.w108-rdc b{font-size:14px}.w108-badge{font:800 8.5px var(--mono);padding:3px 6px;border-radius:5px;background:#EFEDE8;color:#6E6A63;white-space:nowrap}
      .w108-m{display:grid;grid-template-columns:1fr auto;gap:3px 9px;margin-top:9px;font-size:10.5px}.w108-m span{color:var(--muted)}.w108-m b{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.w108-m .warn{color:var(--warn);font-weight:800}.w108-m .stop{color:var(--stop);font-weight:800}
      .w108-foot{border-top:1px dashed var(--line);margin-top:8px;padding-top:7px;font-size:9.5px;color:var(--muted);line-height:1.4}
      .w108-riskbox{background:#fff;border:1px solid var(--line);border-radius:11px;padding:12px;margin-top:10px}.w108-risk-title{font-size:12px;font-weight:800;margin-bottom:3px}.w108-risk-note{font-size:10.5px;color:var(--muted);margin-bottom:8px}.w108-risk{display:grid;grid-template-columns:22px minmax(0,1fr) auto;gap:7px;align-items:start;padding:8px 0;border-top:1px solid var(--line)}.w108-risk:first-of-type{border-top:0}.w108-risk .i{font-size:14px}.w108-risk .t{font-size:11.5px;font-weight:750}.w108-risk .d{font-size:10.5px;color:var(--muted);line-height:1.35;margin-top:1px}.w108-risk-action{border:1px solid var(--line);background:#fff;border-radius:7px;padding:5px 7px;font-size:9.5px;font-weight:700;cursor:pointer;white-space:nowrap}
      .w108-disclaimer{margin-top:9px;border-left:3px solid var(--brand);background:var(--field-blue-soft,#E8F2F3);padding:8px 10px;border-radius:0 8px 8px 0;font-size:10.5px;line-height:1.45;color:var(--muted)}
      @media(max-width:1100px){.w108-summary{grid-template-columns:repeat(3,1fr)}.w108-grid{grid-template-columns:repeat(2,1fr)}}
      @media(max-width:700px){.w108-summary{grid-template-columns:1fr 1fr}.w108-grid{grid-template-columns:1fr}.w108-risk{grid-template-columns:22px 1fr}.w108-risk .a{grid-column:2;justify-self:start}.w108-head h2{font-size:16px}}
    `;document.head.appendChild(st);
  }

  function host(){
    let el=document.getElementById('wmsOpsDashboard108'); if(el) return el;
    const wrap=document.querySelector('#s-home .wrap'); if(!wrap) return null;
    el=document.createElement('div'); el.id='wmsOpsDashboard108'; el.className='w108-wrap';
    const pending=document.getElementById('pendingWork');
    if(pending) pending.insertAdjacentElement('afterend',el); else wrap.prepend(el);
    return el;
  }

  function rowRisk(r){
    const occ=Number(r.occupancy_pct||0), unloc=Number(r.unlocated_box||0), pgiEx=Number(r.pgi_exception_tasks||0), pending=Number(r.pending_gi_tasks||0), stage=Number(r.staging_qty_box||0);
    if(pgiEx>0 || occ>=100) return 'crit';
    if(occ>=90 || unloc>0 || pending>0 || (stage>0&&occ>=85)) return 'watch';
    return r.has_wms_activity?'':'setup';
  }

  function summary(rows){
    const active=rows.filter(r=>r.has_wms_activity).length;
    const cap=rows.reduce((s,r)=>s+Number(r.capacity_box||0),0), located=rows.reduce((s,r)=>s+Number(r.located_box||0),0);
    const occ=cap>0?located/cap*100:null;
    return {
      active,total:rows.length,stock:rows.reduce((s,r)=>s+Number(r.stock_total_box||0),0),available:rows.reduce((s,r)=>s+Number(r.available_box||0),0),
      unlocated:rows.reduce((s,r)=>s+Number(r.unlocated_box||0),0),pendingGi:rows.reduce((s,r)=>s+Number(r.pending_gi_box||0),0),
      pgiEx:rows.reduce((s,r)=>s+Number(r.pgi_exception_tasks||0),0),occ,
      riskRdc:rows.filter(r=>rowRisk(r)==='crit'||rowRisk(r)==='watch').length
    };
  }

  function riskSignals(rows){
    const out=[];
    rows.forEach(r=>{
      const name=escV(r.rdc),occ=Number(r.occupancy_pct||0),unloc=Number(r.unlocated_box||0),pgiEx=Number(r.pgi_exception_tasks||0),pending=Number(r.pending_gi_tasks||0),stage=Number(r.staging_qty_box||0);
      if(occ>=100) out.push({lvl:'crit',ico:'🔴',t:`${name} · Occupancy overload ${pctV(occ)}`,d:'Risiko congestion, rehandling, akses material/picking terganggu. Review detail kapasitas dan lokasi di WMS.',go:'occ'});
      else if(occ>=90) out.push({lvl:'watch',ico:'🟡',t:`${name} · Occupancy tinggi ${pctV(occ)}`,d:'Early warning kapasitas. Pantau staging, lokasi kosong, dan repeated handling sebelum area overload.',go:'occ'});
      if(unloc>0) out.push({lvl:'watch',ico:'🟡',t:`${name} · ${fmtV(unloc)} box belum berlokasi`,d:'Stock belum ditempatkan ke kavling; percepat putaway untuk mengurangi ketidakpastian lokasi dan handling tambahan.',go:'unloc'});
      if(pgiEx>0) out.push({lvl:'crit',ico:'🔴',t:`${name} · ${fmtV(pgiEx)} PGI exception`,d:'Mismatch SAP PGI vs Gate Out perlu investigasi. Jangan lakukan stock adjustment tanpa reconciliation.',go:'pgi'});
      if(pending>0) out.push({lvl:'watch',ico:'🟡',t:`${name} · ${fmtV(pending)} task Pending GI`,d:'Barang sudah gate-out tetapi Book SOH belum dipotong sampai SAP PGI MATCH.',go:'pgi'});
      if(stage>0&&occ>=85) out.push({lvl:'watch',ico:'🟡',t:`${name} · Staging aktif pada occupancy tinggi`,d:`${fmtV(stage)} box di staging. Kombinasi ruang ketat + staging meningkatkan potensi congestion/rehandling.`,go:'staging'});
    });
    return out;
  }

  function openArea(id){try{if(typeof go==='function')go(id);}catch(_){}}

  function render(){
    const el=host();if(!el)return;
    if(!DASH_DATA){el.innerHTML='<div class="card muted">⏳ Memuat Warehouse Execution Control…</div>';return;}
    const rows=DASH_DATA.rows||[], s=summary(rows), risks=riskSignals(rows);
    const generated=DASH_DATA.generated_at?dtV(DASH_DATA.generated_at):'—';
    el.innerHTML=`
      <div class="w108-head"><div><h2>Warehouse Execution Control</h2><div class="w108-sub">Detail WMS · SAP PGI control · location/occupancy · picking/staging · operational risk signal</div></div><button class="w108-refresh" id="w108Refresh">↻ Refresh</button></div>
      <div class="w108-summary">
        <div class="w108-sum"><div class="l">Book SOH WMS</div><div class="v">${fmtV(s.stock)}</div><div class="s">box · seluruh scope</div></div>
        <div class="w108-sum"><div class="l">Available</div><div class="v">${fmtV(s.available)}</div><div class="s">box siap dialokasikan</div></div>
        <div class="w108-sum"><div class="l">Unlocated</div><div class="v">${fmtV(s.unlocated)}</div><div class="s">box perlu putaway</div></div>
        <div class="w108-sum"><div class="l">Pending GI</div><div class="v">${fmtV(s.pendingGi)}</div><div class="s">box menunggu PGI match</div></div>
        <div class="w108-sum"><div class="l">Risk Signal</div><div class="v">${fmtV(s.riskRdc)}</div><div class="s">RDC perlu perhatian</div></div>
      </div>
      <div class="w108-grid">${rows.map(r=>{
        const cls=rowRisk(r), capReady=Number(r.kavling_active||0)>0?`${fmtV(r.kavling_with_capacity)}/${fmtV(r.kavling_active)}`:'0/0';
        return `<div class="w108-card ${cls}"><div class="w108-rdc"><b>${escV(r.rdc)}</b><span class="w108-badge">${escV(r.wms_status||'-')}</span></div><div class="w108-m">
          <span>Book SOH WMS</span><b>${fmtV(r.stock_total_box)} box</b>
          <span>Reserved RK</span><b>${fmtV(r.reserved_box)} box</b>
          <span>Available</span><b>${fmtV(r.available_box)} box</b>
          <span>Physical Located</span><b>${fmtV(r.located_box)} box</b>
          <span class="warn">Pending GI</span><b class="warn">${fmtV(r.pending_gi_box)} box</b>
          <span class="warn">Task Pending PGI</span><b class="warn">${fmtV(r.pending_gi_tasks)}</b>
          <span class="stop">PGI Exception</span><b class="stop">${fmtV(r.pgi_exception_tasks)}</b>
          <span>Unlocated</span><b>${fmtV(r.unlocated_box)} box</b>
          <span>Occupancy</span><b>${pctV(r.occupancy_pct)}</b>
          <span>Kapasitas lokasi</span><b>${fmtV(r.capacity_box)} box</b>
          <span>Kavling berkapasitas</span><b>${capReady}</b>
          <span>Picking open</span><b>${fmtV(r.open_picking_tasks)}</b>
          <span>Staging</span><b>${fmtV(r.staging_qty_box)} box</b>
        </div><div class="w108-foot">Last movement: ${dtV(r.last_movement_at)}<br>Last receiving: ${dtV(r.last_receiving_at)}</div></div>`;
      }).join('')}</div>
      <div class="w108-riskbox"><div class="w108-risk-title">Operational Risk Signal · Potensi Breakage</div><div class="w108-risk-note">Rule-based early warning dari kondisi WMS. Bukan actual breakage dan bukan kesimpulan root cause.</div>
        ${risks.length?risks.slice(0,8).map(x=>`<div class="w108-risk"><div class="i">${x.ico}</div><div><div class="t">${x.t}</div><div class="d">${x.d}</div></div><button class="w108-risk-action" data-go="${x.go}">Buka detail</button></div>`).join(''):'<div class="muted" style="font-size:11px;padding:6px 0">Tidak ada risk signal berbasis rule yang terdeteksi pada data WMS saat ini.</div>'}
        <div class="w108-disclaimer"><b>Batas analisa:</b> overload, unlocated, staging congestion, dan PGI exception hanya menunjukkan risiko operasional. Actual breakage, incident, evidence, dan root cause tetap authoritative di <a href="https://sls-breakage.vercel.app/" target="_blank" rel="noopener">Breakage Monitoring ↗</a>.</div>
      </div>
      <div class="muted" style="font-size:9.5px;margin-top:7px">Scope ${escV(DASH_DATA.scope||RDC||'-')} · refresh ${generated}</div>`;
    el.querySelector('#w108Refresh')?.addEventListener('click',load);
    el.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>openArea(b.dataset.go)));
  }

  async function load(){
    const el=host();if(el&&!DASH_DATA)render();
    try{
      if(typeof rpc!=='function') throw new Error('RPC WMS belum tersedia');
      DASH_DATA=await rpc('wms_dashboard_bridge',{});
      window.WMS_OPERATIONAL_DASHBOARD=DASH_DATA;
      render();
    }catch(e){if(el)el.innerHTML=`<div class="card" style="border-color:#EFC4C0;background:var(--stop-bg)"><b>Warehouse Execution Control belum dapat dimuat.</b><div class="muted" style="font-size:11px;margin-top:3px">${escV(e.message||e)}</div></div>`;}
  }

  function patchHome(){
    try{
      if(typeof loadHome==='function'&&!loadHome.__w108){
        const base=loadHome;
        const fn=async function(){const v=await base.apply(this,arguments);await load();return v;};fn.__w108=true;loadHome=fn;
      }
    }catch(_){ }
    const pick=document.getElementById('rdcPick');if(pick&&!pick.dataset.w108){pick.dataset.w108='1';pick.addEventListener('change',()=>setTimeout(load,80));}
  }

  function boot(){css();host();patchHome();if(document.getElementById('appView')?.style.display!=='none')load();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  [250,800,1800].forEach(ms=>setTimeout(()=>{patchHome();if(document.getElementById('appView')?.style.display!=='none'&&!DASH_DATA)load();},ms));
})();
