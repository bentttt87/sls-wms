// WMS SLS v82 — Supervisor opening-stock + initial-location operational access.
// Extends permissions/UI only; core stock lifecycle remains in Supabase RPCs.
(function(){
  'use strict';
  let OPENLOC_ROWS=[];

  function addPerm(role,perm){
    if(typeof ROLE_PERMS!=='object' || !Array.isArray(ROLE_PERMS[role])) return;
    if(!ROLE_PERMS[role].includes(perm)) ROLE_PERMS[role].push(perm);
  }

  function patchPermissions(){
    // New Bent-approved Supervisor access for own RDC.
    addPerm('supervisor','SAP_UPLOAD');
    addPerm('supervisor','LOCATION_MANAGE');
    addPerm('supervisor','TRANSFER');
  }

  function canManageOpening(){
    return typeof EFFECTIVE_ROLE!=='undefined' && ['supervisor','rdc_manager','master'].includes(EFFECTIVE_ROLE);
  }

  function htmlEscape(v){
    if(typeof esc==='function') return esc(v);
    return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function nfmt(v){ return typeof fmt==='function'?fmt(v):Number(v||0).toLocaleString('id-ID'); }

  function openingScreen(){
    return `<section class="screen" id="s-openloc"><div class="wrap">
      <div class="field-title">📥 Upload Lokasi Awal Barang</div>
      <div class="field-sub">Mapping stock awal SAP yang masih UNLOCATED ke lokasi fisik aktual.</div>
      <div class="hint"><b>Urutan wajib:</b> Upload Stock SAP Awal → pastikan Master Lokasi & kapasitas sudah benar → upload file lokasi awal barang. Fitur ini <b>tidak menambah stock</b>; total stock hanya berpindah dari UNLOCATED ke kavling.</div>
      <div class="card" style="border-color:#C6DEDF;background:var(--field-blue-soft)">
        <div style="font-weight:700;margin-bottom:5px">Format file</div>
        <div class="muted" style="font-size:12.5px;line-height:1.65">Satu baris = satu Material + Seri/Batch + Qty + lokasi. Jika satu material tersebar di beberapa kavling, buat beberapa baris. Bisa memakai <b>Kode_Lokasi</b> langsung atau Gudang + Block + Line + Kavling.</div>
        <div class="row" style="margin-top:10px">
          <button class="btn ghost" id="openLocTplXlsx" style="padding:11px">⬇ Template Excel</button>
          <button class="btn ghost" id="openLocTplCsv" style="padding:11px">⬇ Template CSV</button>
        </div>
      </div>
      <input type="file" id="openLocFile" accept=".xlsx,.xls,.csv" style="display:none">
      <button class="btn brand" id="openLocChoose">📄 Pilih file lokasi awal…</button>
      <div id="openLocOut" style="margin-top:12px"></div>
    </div></section>`;
  }

  function ensureScreenAndMenu(){
    if(!document.getElementById('s-openloc')){
      const nav=document.querySelector('nav.nav');
      if(nav) nav.insertAdjacentHTML('beforebegin',openingScreen());
      if(typeof SUB==='object') SUB.openloc='UPLOAD LOKASI AWAL';
      bindOpeningUI();
    }

    const moreCard=document.querySelector('#s-more .card');
    if(moreCard && !document.getElementById('menuOpenLoc')){
      const sapRow=[...moreCard.querySelectorAll('.lrow')].find(x=>x.getAttribute('onclick')?.includes("go('sap')"));
      const row=document.createElement('div');
      row.id='menuOpenLoc'; row.className='lrow'; row.style.cursor='pointer';
      row.setAttribute('onclick',"go('openloc')");
      row.innerHTML='<div class="g"><div class="t">📥 Upload Lokasi Awal Barang</div><div class="s">Material + Seri + Qty → lokasi fisik awal</div></div><div class="n muted">›</div>';
      if(sapRow?.nextSibling) moreCard.insertBefore(row,sapRow.nextSibling); else moreCard.appendChild(row);
    }

    // Clarify the old menu: it creates location master only.
    const layoutRow=[...document.querySelectorAll('#s-more .lrow')].find(x=>x.getAttribute('onclick')?.includes("go('import')"));
    if(layoutRow){
      const t=layoutRow.querySelector('.t'), s=layoutRow.querySelector('.s');
      if(t)t.textContent='Upload Master Lokasi';
      if(s)s.textContent='Excel/CSV struktur Gudang → Block → Line → Kavling (tanpa stock)';
    }
    const sapRow=[...document.querySelectorAll('#s-more .lrow')].find(x=>x.getAttribute('onclick')?.includes("go('sap')"));
    if(sapRow){
      const t=sapRow.querySelector('.t'), s=sapRow.querySelector('.s');
      if(t)t.textContent='Upload Stock SAP Awal';
      if(s)s.textContent='Opening stock SAP → masuk sebagai Belum Ada Lokasi';
    }

    const sapTitle=document.querySelector('#s-sap .eyebrow');
    if(sapTitle) sapTitle.textContent='Upload Stock SAP Awal';
    const sapHint=document.querySelector('#s-sap .hint');
    if(sapHint) sapHint.innerHTML='<b>Supervisor / RDC Manager / Master.</b> Semua stock awal berasal dari tarikan SAP. Upload → periksa → konfirmasi. Setelah itu mapping lokasi fisik dilakukan lewat <b>Upload Lokasi Awal Barang</b> atau Putaway.';

    const impTitle=document.querySelector('#s-import .eyebrow');
    if(impTitle) impTitle.textContent='Upload Master Lokasi';
    const impHint=document.querySelector('#s-import .hint');
    if(impHint) impHint.innerHTML='Upload Excel/CSV struktur <b>Gudang → Block → Line → Kavling</b>, kapasitas dan luas. Menu ini hanya membuat/update <b>master lokasi</b>, tidak mengalokasikan material/stock.';

    const locTitle=document.querySelector('#s-loc .field-title');
    if(locTitle) locTitle.textContent='📍 Master Lokasi';
    const locHint=document.querySelector('#s-loc .hint');
    if(locHint) locHint.innerHTML='<b>Supervisor boleh tambah/edit/hapus (nonaktifkan) lokasi untuk RDC sendiri.</b> Lokasi yang masih berisi stock tidak dapat dihapus; lakukan Adjustment / Pindah Lokasi lebih dahulu. Penghapusan dibuat sebagai nonaktif agar histori transaksi tetap utuh.';

    const tfTitle=document.querySelector('#s-transfer .field-title');
    if(tfTitle) tfTitle.textContent='↔️ Adjustment / Pindah Lokasi';
    const tfSub=document.querySelector('#s-transfer .field-sub');
    if(tfSub) tfSub.textContent='Koreksi lokasi fisik stock antar kavling tanpa mengubah total inventory.';
    const tfHint=document.querySelector('#s-transfer .hint');
    if(tfHint) tfHint.innerHTML='Supervisor dapat memakai menu ini untuk <b>adjustment lokasi barang</b>. Cari material, pilih lokasi asal dan tujuan, lalu isi alasan koreksi. Semua perpindahan tercatat sebagai movement audit; total stock tidak berubah.';

    const tfMenu=[...document.querySelectorAll('#s-more .lrow')].find(x=>x.getAttribute('onclick')?.includes("go('transfer')"));
    if(tfMenu){ const t=tfMenu.querySelector('.t'),s=tfMenu.querySelector('.s'); if(t)t.textContent='Adjustment / Pindah Lokasi'; if(s)s.textContent='Koreksi lokasi barang antar kavling + audit'; }

    // Update Supervisor access description.
    document.querySelectorAll('#s-access .lrow').forEach(row=>{
      const t=row.querySelector('.t'); if(!t || !/Supervisor/i.test(t.textContent||'')) return;
      const s=row.querySelector('.s');
      if(s)s.textContent='Operasional + approval SPV + Upload Stock SAP Awal + Upload Master/Lokasi Awal + Adjustment Lokasi + tambah/nonaktifkan lokasi RDC sendiri.';
    });
  }

  function applyV82Visibility(){
    patchPermissions(); ensureScreenAndMenu();
    const allowed=canManageOpening();
    const row=document.getElementById('menuOpenLoc'); if(row) row.style.display=allowed?'':'none';
    const screen=document.getElementById('s-openloc'); if(screen) screen.dataset.requiredPerm='SAP_UPLOAD';
    const impRow=[...document.querySelectorAll('#s-more .lrow')].find(x=>x.getAttribute('onclick')?.includes("go('import')"));
    if(impRow) impRow.style.display=(typeof hasPerm==='function'&&hasPerm('LOCATION_MANAGE'))?'':'none';
  }

  function downloadCsv(){
    const rows=[
      ['Material','Seri_Batch','Qty_Box','Status','Gudang','Block','Line','Kavling','Kode_Lokasi','Catatan'],
      ['AGT602501R','S12S',120,'GOOD','B','A','','15','','Posisi fisik saat cutoff'],
      ['AGT602501R','S12S',80,'GOOD','','','','','JAK-B-A-16','Split lokasi kedua']
    ];
    const csv=rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    a.download='Template_Upload_Lokasi_Awal_Barang_WMS.csv'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),500);
  }

  function downloadXlsx(){
    const wb=XLSX.utils.book_new();
    const data=[
      ['Material','Seri_Batch','Qty_Box','Status','Gudang','Block','Line','Kavling','Kode_Lokasi','Catatan'],
      ['AGT602501R','S12S',120,'GOOD','B','A','','15','','Posisi fisik saat cutoff'],
      ['AGT602501R','S12S',80,'GOOD','','','','','JAK-B-A-16','Split lokasi kedua']
    ];
    const ws=XLSX.utils.aoa_to_sheet(data);
    ws['!cols']=[{wch:18},{wch:14},{wch:12},{wch:12},{wch:12},{wch:12},{wch:12},{wch:12},{wch:24},{wch:30}];
    XLSX.utils.book_append_sheet(wb,ws,'Lokasi Awal Barang');
    const pet=XLSX.utils.aoa_to_sheet([
      ['PETUNJUK UPLOAD LOKASI AWAL BARANG'],
      ['1. Upload Stock SAP Awal dan konfirmasi terlebih dahulu.'],
      ['2. Pastikan Master Lokasi + kapasitas kavling sudah benar.'],
      ['3. Satu baris = Material + Seri/Batch + Qty + satu lokasi.'],
      ['4. Jika material terbagi di beberapa lokasi, buat beberapa baris.'],
      ['5. Isi Kode_Lokasi ATAU kombinasi Gudang + Block + Line (opsional) + Kavling.'],
      ['6. Status: GOOD untuk STORAGE, DAMAGED untuk DAMAGE, HOLD untuk HOLD.'],
      ['7. Upload ini tidak menciptakan stock baru. Qty harus tersedia di UNLOCATED SAP.']
    ]);
    pet['!cols']=[{wch:95}]; XLSX.utils.book_append_sheet(wb,pet,'Petunjuk');
    XLSX.writeFile(wb,'Template_Upload_Lokasi_Awal_Barang_WMS.xlsx');
  }

  function normHeader(v){return String(v??'').trim().toLowerCase().replace(/^\ufeff/,'').replace(/[\s\-\/]+/g,'_');}
  function findCol(H,names){for(const n of names){const i=H.indexOf(n);if(i>=0)return i;}return -1;}
  function parseOpeningWorkbook(wb){
    const A={
      material:['material','kode_material','material_code','sku'],
      batch:['seri_batch','seri','series','batch','shade'],
      qty:['qty_box','qty','quantity','jumlah_box','jumlah'],
      status:['status','quality','quality_status','status_stock'],
      warehouse:['gudang','warehouse'], block:['block','blok'], line:['line','baris'],
      kavling:['kavling','location','lokasi'], loc:['kode_lokasi','location_code','kode_location'],
      note:['catatan','note','keterangan','remarks']
    };
    for(const sn of wb.SheetNames){
      const g=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:null,raw:true});
      if(!g.length)continue;
      let hr=-1,H=[];
      for(let i=0;i<Math.min(20,g.length);i++){
        H=(g[i]||[]).map(normHeader);
        if(findCol(H,A.material)>=0 && findCol(H,A.qty)>=0 && (findCol(H,A.loc)>=0 || findCol(H,A.kavling)>=0)){hr=i;break;}
      }
      if(hr<0)continue;
      const c={}; Object.keys(A).forEach(k=>c[k]=findCol(H,A[k]));
      const out=[];
      for(let i=hr+1;i<g.length;i++){
        const row=g[i]||[];
        const material=c.material>=0?String(row[c.material]??'').trim().toUpperCase():'';
        const qty=c.qty>=0?Number(row[c.qty]):NaN;
        const loc=c.loc>=0?String(row[c.loc]??'').trim().toUpperCase():'';
        const wh=c.warehouse>=0?String(row[c.warehouse]??'').trim().toUpperCase():'';
        const bl=c.block>=0?String(row[c.block]??'').trim().toUpperCase():'';
        const kv=c.kavling>=0?String(row[c.kavling]??'').trim().toUpperCase():'';
        if(!material && !isFinite(qty) && !loc && !wh && !kv)continue;
        if(!material)throw new Error(`Baris ${i+1}: Material wajib diisi.`);
        if(!isFinite(qty)||qty<=0)throw new Error(`Baris ${i+1}: Qty_Box harus > 0.`);
        if(!loc && (!wh||!bl||!kv))throw new Error(`Baris ${i+1}: isi Kode_Lokasi atau Gudang + Block + Kavling.`);
        out.push({
          material, batch:c.batch>=0?String(row[c.batch]??'').trim():'', qty,
          status:c.status>=0?String(row[c.status]??'GOOD').trim().toUpperCase():'GOOD',
          warehouse:wh, block:bl, line:c.line>=0?String(row[c.line]??'').trim().toUpperCase():'',
          kavling:kv, location_code:loc, note:c.note>=0?String(row[c.note]??'').trim():''
        });
      }
      if(out.length)return out;
    }
    return [];
  }

  function renderOpeningPreview(fileName){
    const out=document.getElementById('openLocOut'); if(!out)return;
    const total=OPENLOC_ROWS.reduce((a,r)=>a+Number(r.qty||0),0);
    const mats=new Set(OPENLOC_ROWS.map(r=>r.material));
    const locs=new Set(OPENLOC_ROWS.map(r=>r.location_code||[r.warehouse,r.block,r.line,r.kavling].filter(Boolean).join('-')));
    const preview=OPENLOC_ROWS.slice(0,30);
    out.innerHTML=`<div class="card">
      <div style="font-weight:700">${htmlEscape(fileName)}</div>
      <div class="kpis" style="grid-template-columns:repeat(3,1fr);margin-top:10px">
        <div class="kpi"><div class="lbl">Baris</div><div class="val">${nfmt(OPENLOC_ROWS.length)}</div></div>
        <div class="kpi"><div class="lbl">Material</div><div class="val">${nfmt(mats.size)}</div></div>
        <div class="kpi"><div class="lbl">Qty</div><div class="val">${nfmt(total)} <small>BOX</small></div></div>
      </div>
      <div class="muted" style="font-size:12px;margin-top:8px">${nfmt(locs.size)} lokasi tujuan. Backend akan validasi RDC, stock UNLOCATED, status lokasi dan kapasitas sebelum satu baris pun dipindahkan.</div>
      <button class="btn brand" id="openLocImport" style="margin-top:12px">Impor ${nfmt(OPENLOC_ROWS.length)} baris lokasi awal</button>
    </div>
    <div class="eyebrow">Preview ${nfmt(preview.length)} baris pertama</div>
    <div class="card" style="padding:4px 14px;max-height:420px;overflow:auto">${preview.map(r=>`<div class="lrow"><div class="g"><div class="t">${htmlEscape(r.material)}${r.batch?' · '+htmlEscape(r.batch):''}</div><div class="s">${htmlEscape(r.status)} · ${htmlEscape(r.location_code||[r.warehouse,r.block,r.line,r.kavling].filter(Boolean).join(' / '))}</div></div><div class="n">${nfmt(r.qty)}</div></div>`).join('')}</div>`;
    document.getElementById('openLocImport').onclick=runOpeningImport;
  }

  function readOpeningFile(file){
    const out=document.getElementById('openLocOut');
    out.innerHTML='<div class="card muted">⏳ Membaca file lokasi awal…</div>';
    const fr=new FileReader();
    fr.onload=ev=>{
      try{
        const wb=XLSX.read(ev.target.result,{type:'array'});
        const rows=parseOpeningWorkbook(wb);
        if(!rows.length)throw new Error('Tidak ada baris yang dikenali. Gunakan template dari WMS.');
        OPENLOC_ROWS=rows; renderOpeningPreview(file.name);
      }catch(err){out.innerHTML=`<div class="card" style="border-color:#EFC4C0;background:var(--stop-bg)"><b>File tidak dapat dipakai.</b><div class="muted" style="font-size:12px;margin-top:5px">${htmlEscape(err.message)}</div></div>`;}
    };
    fr.readAsArrayBuffer(file);
  }

  async function runOpeningImport(){
    if(!OPENLOC_ROWS.length)return;
    const btn=document.getElementById('openLocImport'); const out=document.getElementById('openLocOut');
    if(!confirm(`Impor ${OPENLOC_ROWS.length} baris lokasi awal untuk ${RDC}?\n\nStock tidak akan bertambah; qty dipindahkan dari UNLOCATED ke lokasi fisik.`))return;
    btn.disabled=true; btn.textContent='⏳ Validasi & mengalokasikan lokasi…';
    try{
      const r=await rpc('wms_opening_location_import',{p_rdc:RDC,p_rows:OPENLOC_ROWS});
      OPENLOC_ROWS=[];
      out.innerHTML=`<div class="card" style="border-color:#BFE3CD;background:var(--ok-bg)"><div style="font-weight:750;color:var(--ok)">✓ Upload lokasi awal selesai</div><div class="muted" style="font-size:13px;line-height:1.7;margin-top:6px">Baris: <b>${nfmt(r.rows_imported)}</b><br>Qty dialokasikan: <b>${nfmt(r.qty_imported)} box</b><br>Sisa belum ada lokasi: <b>${nfmt(r.remaining_unlocated)} box</b><br>${htmlEscape(r.catatan||'')}</div><button class="btn" style="margin-top:12px" onclick="go('stock')">Lihat Stock On Hand</button></div>`;
      await Promise.allSettled([
        typeof loadStock==='function'?loadStock():Promise.resolve(),
        typeof loadLoc==='function'?loadLoc():Promise.resolve(),
        typeof loadHome==='function'?loadHome():Promise.resolve(),
        typeof loadUnlocated==='function'?loadUnlocated():Promise.resolve()
      ]);
    }catch(err){btn.disabled=false;btn.textContent='Coba impor lagi';out.insertAdjacentHTML('afterbegin',`<div class="card" style="border-color:#EFC4C0;background:var(--stop-bg)"><b>Import dibatalkan — tidak ada stock yang dipindah.</b><div class="muted" style="font-size:12px;margin-top:5px">${htmlEscape(err.message)}</div></div>`);}
  }

  function bindOpeningUI(){
    document.getElementById('openLocTplXlsx')?.addEventListener('click',downloadXlsx);
    document.getElementById('openLocTplCsv')?.addEventListener('click',downloadCsv);
    document.getElementById('openLocChoose')?.addEventListener('click',()=>document.getElementById('openLocFile')?.click());
    document.getElementById('openLocFile')?.addEventListener('change',e=>{const f=e.target.files?.[0]; if(f)readOpeningFile(f); e.target.value='';});
  }

  // Enhanced Master Lokasi list with safe soft-delete/reactivate.
  async function loadLocV82(){
    const out=document.getElementById('locOut'); if(!out)return;
    out.innerHTML='<div class="card muted">⏳ Memuat lokasi…</div>';
    try{
      const rows=await rpc('wms_location_list',{p_rdc:RDC});
      const manage=canManageOpening();
      out.innerHTML=rows.length?`<div class="card" style="padding:4px 14px">${rows.map(r=>{
        const cap=Number(r.kapasitas||0),used=Number(r.terisi||0),pct=cap?Math.min(100,Math.round(used/cap*100)):0;
        const btn=manage?(r.active
          ? `<button class="btn ghost" ${used>0?'disabled':''} style="width:auto;padding:6px 9px;font-size:11px;${used>0?'opacity:.45;cursor:not-allowed':'color:var(--stop);border-color:#EFC4C0'}" onclick="wmsLocSetActive(${Number(r.id)},false,'${htmlEscape(r.location_code)}')">Hapus</button>`
          : `<button class="btn ghost" style="width:auto;padding:6px 9px;font-size:11px" onclick="wmsLocSetActive(${Number(r.id)},true,'${htmlEscape(r.location_code)}')">Aktifkan</button>`):'';
        return `<div class="lrow" style="opacity:${r.active?1:.55}"><div class="g"><div class="t">${htmlEscape(r.location_code)} <span class="pill ${r.active?'p-ok':'p-stop'}" style="font-size:9px">${r.active?'AKTIF':'NONAKTIF'}</span></div><div class="s">${htmlEscape(r.location_type||'STORAGE')} · ${nfmt(used)} / ${nfmt(cap)} box${r.n_material?' · '+r.n_material+' material':' · kosong'}</div><div class="bar ${pct>=90?'full':pct>=70?'high':''}"><i style="width:${pct}%"></i></div></div><div style="text-align:right"><div class="n">${pct}%</div>${btn}</div></div>`;
      }).join('')}</div>`:'<div class="card muted">Belum ada kavling. Tambahkan di bawah.</div>';
    }catch(err){out.innerHTML=`<div class="card muted">Gagal memuat: ${htmlEscape(err.message)}</div>`;}
  }

  window.wmsLocSetActive=async function(id,active,code){
    if(!canManageOpening())return alert('Akses ditolak.');
    if(!active && !confirm(`Hapus/nonaktifkan lokasi ${code}?\n\nHistori tidak dihapus. Lokasi hanya dinonaktifkan dan bisa diaktifkan kembali.`))return;
    try{await rpc('wms_location_set_active',{p_kavling:id,p_active:active});await loadLocV82();if(typeof loadHome==='function')loadHome();}
    catch(err){alert('Gagal: '+err.message);}
  };

  function patchLoadLoc(){
    if(typeof loadLoc==='function' && !loadLoc.__wmsV82){
      loadLocV82.__wmsV82=true;
      loadLoc=loadLocV82;
    }
  }

  function patchTransferReason(){
    if(typeof doTransfer==='function' && !doTransfer.__wmsV82){
      const base=doTransfer;
      const wrapped=async function(i){
        if(typeof EFFECTIVE_ROLE!=='undefined' && EFFECTIVE_ROLE==='supervisor'){
          const note=document.getElementById('tfNote')?.value.trim()||'';
          if(!note){const d=document.getElementById('tfDone');if(d){d.style.color='var(--stop)';d.textContent='Alasan adjustment wajib diisi untuk Supervisor.';}return;}
        }
        return base(i);
      };
      wrapped.__wmsV82=true; doTransfer=wrapped;
    }
  }

  function patchApplyRole(){
    if(typeof applyRoleUI==='function' && !applyRoleUI.__wmsV82){
      const base=applyRoleUI;
      const wrapped=function(){patchPermissions();const r=base();applyV82Visibility();return r;};
      wrapped.__wmsV82=true; applyRoleUI=wrapped;
    }
  }

  function init(){
    patchPermissions(); ensureScreenAndMenu(); patchLoadLoc(); patchTransferReason(); patchApplyRole(); applyV82Visibility();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
  window.setTimeout(init,500);
})();
