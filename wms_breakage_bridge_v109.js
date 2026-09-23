// WMS SLS v109 — Breakage Monitoring is the single input source for all breakage.
// WMS only reads actual WAREHOUSE breakage; DELIVERY breakage is reserved for TMS.
(function(){
  'use strict';
  let BREAKAGE_DATA=null;
  const escB=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtB=v=>typeof fmt==='function'?fmt(v):Number(v||0).toLocaleString('id-ID');
  const dB=v=>{if(!v)return '—';try{return new Date(v+'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});}catch(_){return String(v)}};

  function css(){
    if(document.getElementById('wmsBreakage109Style'))return;
    const s=document.createElement('style');s.id='wmsBreakage109Style';s.textContent=`
      #s-rusak,.quick[data-perm="DAMAGE"]{display:none!important}
      .wb109{background:#fff;border:1px solid var(--line);border-left:4px solid #C62828;border-radius:11px;padding:12px;margin-top:10px}
      .wb109-h{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap}.wb109-t{font-size:12px;font-weight:850}.wb109-src{font:800 8.5px var(--mono);padding:3px 6px;border-radius:5px;background:#FDECEC;color:#A32020}
      .wb109-k{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:9px 0}.wb109-k>div{background:#FBFAF8;border:1px solid var(--line);border-radius:9px;padding:9px}.wb109-k .l{font:700 9px var(--mono);color:var(--muted);text-transform:uppercase}.wb109-k .v{font-size:20px;font-weight:850;margin-top:2px}
      .wb109-r{display:grid;grid-template-columns:90px minmax(0,1fr) auto;gap:8px;padding:7px 0;border-top:1px solid var(--line);font-size:10.5px;align-items:start}.wb109-r .m{font-family:var(--mono);font-weight:750}.wb109-r .q{font-weight:850;white-space:nowrap}.wb109-note{font-size:10px;color:var(--muted);line-height:1.45;margin-top:8px}.wb109-open{display:inline-block;margin-top:8px;border:1px solid var(--line);background:#fff;border-radius:8px;padding:6px 9px;font-size:10px;font-weight:750;color:var(--ink);text-decoration:none}
      @media(max-width:700px){.wb109-r{grid-template-columns:80px minmax(0,1fr)}.wb109-r .q{grid-column:2}}
    `;document.head.appendChild(s);
  }

  function retireDamageUi(){
    try{
      if(typeof ROLE_PERMS==='object'){
        Object.keys(ROLE_PERMS).forEach(k=>{if(Array.isArray(ROLE_PERMS[k]))ROLE_PERMS[k]=ROLE_PERMS[k].filter(x=>x!=='DAMAGE');});
      }
    }catch(_){ }
    document.querySelectorAll('.quick[data-perm="DAMAGE"]').forEach(x=>x.style.display='none');
    document.querySelectorAll('.lrow').forEach(row=>{
      const txt=String(row.textContent||'').toLowerCase();
      const oc=String(row.getAttribute('onclick')||'').toLowerCase();
      if(txt.includes('catat barang rusak')||txt.includes('barang rusak')||oc.includes("go('rusak')")||oc.includes('go("rusak")')){
        row.style.display='none';row.setAttribute('aria-hidden','true');
      }
    });
    const scr=document.getElementById('s-rusak');if(scr){scr.style.display='none';scr.setAttribute('aria-hidden','true');}
  }

  function patchNavigation(){
    try{
      if(typeof go==='function'&&!go.__wmsBreakage109){
        const base=go;const fn=function(s){if(String(s)==='rusak'){alert('Input barang pecah/rusak hanya dilakukan di Breakage Monitoring. WMS hanya membaca data Pecah Gudang.');return base('home');}return base(s);};
        fn.__wmsBreakage109=true;go=fn;
      }
      if(typeof safeGo==='function'&&!safeGo.__wmsBreakage109){
        const base=safeGo;const fn=function(s,p){if(String(s)==='rusak'||String(p)==='DAMAGE'){alert('Input barang pecah/rusak hanya dilakukan di Breakage Monitoring.');return typeof go==='function'?go('home'):undefined;}return base(s,p);};
        fn.__wmsBreakage109=true;safeGo=fn;
      }
    }catch(_){ }
  }

  function currentMonth(){
    const n=new Date();const from=`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-01`;const to=`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;return {from,to};
  }

  function scopeRdc(){
    try{return typeof RDC!=='undefined'&&RDC?String(RDC):null;}catch(_){return null;}
  }

  function replaceHomeKpi(){
    if(!BREAKAGE_DATA)return;
    const k=document.getElementById('homeKpis');if(!k||k.children.length<2)return;
    const c=k.children[1];c.className='kpi '+(Number(BREAKAGE_DATA.qty_box||0)>0?'alert':'');
    c.innerHTML=`<div class="lbl">Pecah Gudang · Bulan Ini</div><div class="val">${fmtB(BREAKAGE_DATA.qty_box||0)} <small>box</small></div>`;
  }

  function host(){
    let h=document.getElementById('wmsBreakageActual109');if(h)return h;
    const dash=document.getElementById('wmsOpsDashboard108');
    if(dash){h=document.createElement('div');h.id='wmsBreakageActual109';dash.appendChild(h);return h;}
    const wrap=document.querySelector('#s-home .wrap');if(!wrap)return null;
    h=document.createElement('div');h.id='wmsBreakageActual109';wrap.appendChild(h);return h;
  }

  function render(){
    css();retireDamageUi();replaceHomeKpi();
    const h=host();if(!h||!BREAKAGE_DATA)return;
    const rec=BREAKAGE_DATA.recent||[];
    h.innerHTML=`<div class="wb109">
      <div class="wb109-h"><div><div class="wb109-t">Actual Breakage Gudang</div><div class="muted" style="font-size:10.5px">Data aktual dari aplikasi Breakage Monitoring · ${escB(BREAKAGE_DATA.scope||scopeRdc()||'-')}</div></div><span class="wb109-src">BREAKAGE MONITORING</span></div>
      <div class="wb109-k"><div><div class="l">Pecah Gudang</div><div class="v">${fmtB(BREAKAGE_DATA.qty_box||0)} <small style="font-size:11px;color:var(--muted)">box</small></div></div><div><div class="l">Jumlah Insiden</div><div class="v">${fmtB(BREAKAGE_DATA.incident_count||0)}</div></div></div>
      ${rec.length?rec.slice(0,5).map(r=>`<div class="wb109-r"><div>${dB(r.incident_date)}</div><div><div class="m">${escB(r.item_code||'-')}${r.ceramic_series?' · '+escB(r.ceramic_series):''}</div><div class="muted" style="font-size:9.5px">${escB(r.sub_category||r.warehouse_event||'Pecah Gudang')} · ${escB(r.status||'-')}</div></div><div class="q">${fmtB(r.qty_box||0)} box</div></div>`).join(''):'<div class="muted" style="font-size:10.5px;padding:8px 0">Belum ada incident Pecah Gudang pada periode ini.</div>'}
      <div class="wb109-note"><b>Single source of input:</b> seluruh barang pecah dicatat hanya di Breakage Monitoring. WMS tidak memiliki form input breakage. WMS membaca hanya incident <b>warehouse</b>; TMS membaca incident <b>delivery</b>.</div>
      <a class="wb109-open" href="https://sls-breakage.vercel.app/" target="_blank" rel="noopener">Buka Breakage Monitoring ↗</a>
    </div>`;
  }

  async function loadBreakage(){
    try{
      if(typeof rpc!=='function')return;
      const p=currentMonth();
      BREAKAGE_DATA=await rpc('sls_breakage_feed',{p_module:'WMS',p_rdc:scopeRdc(),p_from:p.from,p_to:p.to,p_limit:5});
      window.WMS_BREAKAGE_WAREHOUSE=BREAKAGE_DATA;
      render();
    }catch(e){
      const h=host();if(h)h.innerHTML=`<div class="card" style="border-color:#EFC4C0;background:var(--stop-bg)"><b>Data Pecah Gudang belum dapat dimuat.</b><div class="muted" style="font-size:10px;margin-top:3px">${escB(e.message||e)}</div></div>`;
    }
  }

  function patchHome(){
    try{
      if(typeof loadHome==='function'&&!loadHome.__wmsBreakage109){
        const base=loadHome;const fn=async function(){const out=await base.apply(this,arguments);await loadBreakage();return out;};fn.__wmsBreakage109=true;loadHome=fn;
      }
    }catch(_){ }
  }

  function apply(){css();retireDamageUi();patchNavigation();patchHome();setTimeout(loadBreakage,250);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
  setTimeout(apply,600);setTimeout(apply,1600);
  document.addEventListener('click',e=>{if(e.target&&e.target.id==='w108Refresh')setTimeout(loadBreakage,450);},true);
})();
