// WMS SLS v83 — auto-detect Receiving SAP document number from uploaded file.
// User no longer types document number manually. The file is the source.
(function(){
  'use strict';

  const DOC_ALIASES=[
    'material_document','material_doc','mat_doc','material_document_no','material_document_number',
    'document_number','document_no','doc_number','doc_no','no_document','no_dokumen','nomor_dokumen',
    'reference_document','reference_doc','mblnr'
  ];
  const YEAR_ALIASES=['fiscal_year','document_year','doc_year','year','mjahr'];
  const DOCTYPE_ALIASES=['document_type','doc_type','type_dokumen','jenis_dokumen'];

  function norm(v){
    return String(v??'').trim().toLowerCase()
      .replace(/^\ufeff/,'')
      .replace(/[^a-z0-9]+/g,'_')
      .replace(/^_+|_+$/g,'');
  }
  function sval(v){return String(v??'').trim();}
  function findCol(H,aliases){for(const a of aliases){const i=H.indexOf(a);if(i>=0)return i;}return -1;}
  function looksDoc(v){
    const s=sval(v);
    if(!s || s.length<5 || s.length>40 || !/\d/.test(s)) return false;
    const n=norm(s);
    if(DOC_ALIASES.includes(n) || YEAR_ALIASES.includes(n) || DOCTYPE_ALIASES.includes(n)) return false;
    return /^[A-Za-z0-9._\-\/]+$/.test(s);
  }
  function collectMetaFromGrid(grid){
    const docs=new Set(), years=new Set(), types=new Set();
    for(let r=0;r<Math.min(grid.length,35);r++){
      const row=grid[r]||[];
      for(let c=0;c<row.length;c++){
        const k=norm(row[c]);
        if(!k) continue;
        const right=row[c+1], below=(grid[r+1]||[])[c];
        if(DOC_ALIASES.includes(k)){
          if(looksDoc(right)) docs.add(sval(right));
          else if(looksDoc(below)) docs.add(sval(below));
        }
        if(YEAR_ALIASES.includes(k)){
          const y=sval(right||below); if(/^20\d{2}$/.test(y)) years.add(y);
        }
        if(DOCTYPE_ALIASES.includes(k)){
          const t=sval(right||below).toUpperCase(); if(t && t.length<=20) types.add(t);
        }
      }
    }
    return {docs,years,types};
  }

  function parseWorkbook(wb){
    const materialAliases=['material','material_code','kode_material','sku'];
    const descAliases=['description','material_description','desc','deskripsi'];
    const batchAliases=['series_batch','batch','series','seri','shade'];
    const qtyAliases=['qty_box','qty','quantity','unrestricted','stock','jumlah_box','jumlah'];
    const slocAliases=['storage_location','sloc','s_loc'];
    const allDocs=new Set(), allYears=new Set(), allTypes=new Set();
    let selectedRows=[];

    for(const sn of wb.SheetNames){
      const grid=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:null,raw:true});
      if(!grid.length) continue;
      const meta=collectMetaFromGrid(grid);
      meta.docs.forEach(x=>allDocs.add(x)); meta.years.forEach(x=>allYears.add(x)); meta.types.forEach(x=>allTypes.add(x));

      let hr=-1,H=[];
      for(let i=0;i<Math.min(25,grid.length);i++){
        H=(grid[i]||[]).map(norm);
        if(findCol(H,materialAliases)>=0 && findCol(H,qtyAliases)>=0){hr=i;break;}
      }
      if(hr<0) continue;

      const cm=findCol(H,materialAliases), cd=findCol(H,descAliases), cb=findCol(H,batchAliases), cq=findCol(H,qtyAliases), cs=findCol(H,slocAliases);
      const cdoc=findCol(H,DOC_ALIASES), cyear=findCol(H,YEAR_ALIASES), ctype=findCol(H,DOCTYPE_ALIASES);
      const rows=[];
      for(let i=hr+1;i<grid.length;i++){
        const r=grid[i]||[];
        const m=sval(r[cm]); if(!m) continue;
        const q=Number(r[cq])||0; if(q<=0) continue;
        const doc=cdoc>=0?sval(r[cdoc]):'';
        const fy=cyear>=0?sval(r[cyear]):'';
        const dt=ctype>=0?sval(r[ctype]).toUpperCase():'';
        if(looksDoc(doc)) allDocs.add(doc);
        if(/^20\d{2}$/.test(fy)) allYears.add(fy);
        if(dt && dt.length<=20) allTypes.add(dt);
        rows.push({
          material:m.toUpperCase(),
          desc:cd>=0?sval(r[cd]):'',
          batch:cb>=0?sval(r[cb]):'',
          qty:q,
          sloc:cs>=0?sval(r[cs]):'',
          doc_number:doc||null,
          fiscal_year:fy||null,
          doc_type:dt||null
        });
      }
      if(rows.length && !selectedRows.length) selectedRows=rows;
    }

    if(!selectedRows.length) throw new Error('Kolom Material dan Qty tidak ditemukan atau tidak ada qty positif pada file.');
    if(allDocs.size===0) throw new Error('Nomor dokumen SAP tidak ditemukan otomatis di file. Pastikan file memiliki kolom/field Material Document, Document Number, No Dokumen, atau MBLNR.');
    if(allDocs.size>1) throw new Error('File berisi lebih dari satu nomor dokumen SAP ('+[...allDocs].slice(0,5).join(', ')+'). Pisahkan file per dokumen sebelum upload.');

    const docNumber=[...allDocs][0];
    const fiscalYear=allYears.size===1?[...allYears][0]:null;
    const docType=allTypes.size===1?[...allTypes][0]:'GR';
    selectedRows.forEach(r=>{if(!r.doc_number)r.doc_number=docNumber;if(!r.fiscal_year&&fiscalYear)r.fiscal_year=fiscalYear;if(!r.doc_type)r.doc_type=docType;});
    return {rows:selectedRows,docNumber,fiscalYear,docType};
  }

  function patchUi(){
    const ref=document.getElementById('puRecvRef');
    if(ref){
      ref.type='hidden';
      if(ref.parentElement) ref.parentElement.style.display='none';
      const card=ref.closest('.card');
      if(card && !document.getElementById('autoDocNote')){
        const note=document.createElement('div'); note.id='autoDocNote'; note.className='hint';
        note.innerHTML='<b>No. Dokumen SAP dibaca otomatis dari file.</b> User tidak perlu mengetik nomor dokumen. Jika file berisi lebih dari satu nomor dokumen, upload akan ditolak agar tidak terjadi pencampuran dokumen.';
        const row=ref.closest('.row'); if(row) row.parentElement.insertBefore(note,row);
      }
    }
    const card=document.getElementById('puRecvFile')?.closest('.card');
    if(card){
      const sub=card.querySelector('.muted');
      if(sub && /Upload file hasil penerimaan/i.test(sub.textContent||'')) sub.innerHTML='Upload file hasil penerimaan/GR SAP. <b>No. dokumen dibaca otomatis dari isi file</b>. Stock masuk sebagai <b>Belum Ada Lokasi</b>, lalu dilanjutkan Putaway. Dokumen yang sama tidak dapat diimpor dua kali.';
    }
  }

  function downloadTemplate(){
    const wb=XLSX.utils.book_new();
    const data=[
      ['Material_Document','Fiscal_Year','Document_Type','Material','Description','Series_Batch','Qty_Box','Storage_Location'],
      ['5000123456','2026','GR','1G337106','Vivaz Bianco','R146S',100,''],
      ['5000123456','2026','GR','163801R','dTube White','S050S',80,'']
    ];
    const ws=XLSX.utils.aoa_to_sheet(data);
    ws['!cols']=[{wch:20},{wch:12},{wch:15},{wch:18},{wch:28},{wch:18},{wch:12},{wch:18}];
    XLSX.utils.book_append_sheet(wb,ws,'Penerimaan SAP');
    const pet=XLSX.utils.aoa_to_sheet([
      ['PETUNJUK'],
      ['No. Dokumen tidak diinput manual di WMS. Sistem membaca Material_Document / Document Number dari file.'],
      ['Satu file hanya boleh berisi satu nomor dokumen.'],
      ['Jika satu dokumen memiliki banyak material, ulangi nomor dokumen yang sama pada seluruh baris.'],
      ['Document_Type opsional; default GR. Fiscal_Year opsional.']
    ]);
    pet['!cols']=[{wch:100}]; XLSX.utils.book_append_sheet(wb,pet,'Petunjuk');
    XLSX.writeFile(wb,'Template_Penerimaan_SAP_WMS_Auto_Dokumen.xlsx');
  }

  // Replace reader used by the existing file-input event listener.
  readReceivingFile=function(file){
    const out=document.getElementById('puRecvOut');
    if(!out) return;
    out.innerHTML='<div class="muted">⏳ Membaca file & mendeteksi nomor dokumen SAP…</div>';
    const fr=new FileReader();
    fr.onload=async ev=>{
      try{
        const wb=XLSX.read(ev.target.result,{type:'array'});
        const parsed=parseWorkbook(wb);
        const rows=parsed.rows;
        const qty=rows.reduce((a,r)=>a+Number(r.qty||0),0);
        const mats=[...new Set(rows.map(r=>String(r.material||'').trim().toUpperCase()).filter(Boolean))];
        const classified=typeof getMaterialSizeCategory==='function'?mats.filter(m=>!!getMaterialSizeCategory(m)):[];
        const unclassified=typeof getMaterialSizeCategory==='function'?mats.filter(m=>!getMaterialSizeCategory(m)):[];
        const invalid=rows.filter(r=>!r.material||!Number.isFinite(Number(r.qty))||Number(r.qty)<=0);
        PU_RECV_ROWS={filename:file.name,rows,docNumber:parsed.docNumber,docType:parsed.docType,fiscalYear:parsed.fiscalYear};
        const ref=document.getElementById('puRecvRef'); if(ref) ref.value=parsed.docNumber;
        out.innerHTML=`<div class="card" style="margin:0;border-color:#C6DEDF">
          <div style="font-weight:800;font-size:14px">PREVIEW PENERIMAAN SAP</div>
          <div class="muted" style="font-size:12px;margin:3px 0 10px">${typeof esc==='function'?esc(file.name):file.name}</div>
          <div class="card" style="padding:10px 12px;background:var(--ok-bg);border-color:#BFE3CD">
            <div class="muted" style="font-size:11px">DOKUMEN TERDETEKSI OTOMATIS</div>
            <div style="font:800 17px var(--mono);color:var(--ok)">${parsed.docType||'GR'} · ${parsed.docNumber}${parsed.fiscalYear?' · FY '+parsed.fiscalYear:''}</div>
          </div>
          <div class="kpis" style="grid-template-columns:1fr 1fr">
            <div class="kpi"><div class="lbl">Baris</div><div class="val">${typeof fmt==='function'?fmt(rows.length):rows.length}</div></div>
            <div class="kpi"><div class="lbl">Qty</div><div class="val">${typeof fmt==='function'?fmt(qty):qty}<small> box</small></div></div>
            <div class="kpi"><div class="lbl">Material</div><div class="val">${typeof fmt==='function'?fmt(mats.length):mats.length}</div></div>
            <div class="kpi ${unclassified.length?'alert':''}"><div class="lbl">Belum Kategori</div><div class="val">${typeof fmt==='function'?fmt(unclassified.length):unclassified.length}</div></div>
          </div>
          ${invalid.length?`<div class="denied" style="margin-top:10px">Ada ${invalid.length} baris tidak valid. Perbaiki Material/Qty sebelum dikonfirmasi.</div>`:''}
          <button class="btn brand" id="puRecvImport" style="margin-top:10px" ${invalid.length?'disabled':''}>✓ Konfirmasi Penerimaan</button>
          <button class="btn ghost" id="puRecvCancel" style="margin-top:8px">Ganti / Batalkan File</button>
        </div>`;
        document.getElementById('puRecvImport').onclick=importReceiving;
        document.getElementById('puRecvCancel').onclick=()=>{PU_RECV_ROWS=null;if(ref)ref.value='';out.innerHTML='';};
      }catch(e){
        PU_RECV_ROWS=null;
        const ref=document.getElementById('puRecvRef'); if(ref)ref.value='';
        out.innerHTML=`<div class="denied">Gagal membaca: ${typeof esc==='function'?esc(e.message):e.message}</div>`;
      }
    };
    fr.readAsArrayBuffer(file);
  };

  importReceiving=async function(){
    const out=document.getElementById('puRecvOut');
    if(!PU_RECV_ROWS) return;
    const ref=PU_RECV_ROWS.docNumber||'';
    const date=document.getElementById('puRecvDate')?.value||new Date().toISOString().slice(0,10);
    if(!ref){out.insertAdjacentHTML('afterbegin','<div class="denied" style="margin-bottom:8px">Nomor dokumen tidak ditemukan dari file. Gunakan file SAP yang memuat nomor dokumen.</div>');return;}
    const b=document.getElementById('puRecvImport'); b.disabled=true; b.textContent='⏳ Mencatat penerimaan…';
    try{
      const r=await rpc('wms_receiving_import',{
        p_rdc:RDC,
        p_reference:ref,
        p_filename:PU_RECV_ROWS.filename,
        p_date:date,
        p_rows:PU_RECV_ROWS.rows,
        p_doc_type:PU_RECV_ROWS.docType||'GR',
        p_fiscal_year:PU_RECV_ROWS.fiscalYear||null,
        p_doc_qty:null
      });
      out.innerHTML=`<div class="card" style="border-color:#BFE3CD;background:var(--ok-bg);margin:0"><div style="font-size:22px">✅</div><div style="font-weight:750;color:var(--ok)">${typeof fmt==='function'?fmt(r.qty):r.qty} box penerimaan SAP berhasil masuk.</div><div style="font:700 13px var(--mono);margin-top:5px">${r.doc_type||'GR'} · ${r.reference||ref}</div><div class="muted" style="font-size:12px;margin-top:5px">Nomor dokumen dibaca otomatis dari file. Stock sekarang berada di Belum Ada Lokasi dan siap dilanjutkan Putaway.</div><button class="btn ghost" style="margin-top:9px" onclick="go('unloc')">Lihat Stock Belum Ada Lokasi</button></div>`;
      PU_RECV_ROWS=null;
      const hidden=document.getElementById('puRecvRef'); if(hidden)hidden.value='';
      if(typeof refreshZoneCache==='function') await refreshZoneCache().catch(()=>{});
      if(typeof loadHome==='function') loadHome();
    }catch(e){
      b.disabled=false; b.textContent='✓ Konfirmasi Penerimaan';
      out.insertAdjacentHTML('afterbegin',`<div class="denied" style="margin-bottom:8px">Gagal: ${typeof esc==='function'?esc(e.message):e.message}</div>`);
    }
  };

  function bindTemplateOverride(){
    const tpl=document.getElementById('puRecvTemplate');
    if(tpl && !tpl.dataset.autoDocV83){
      tpl.dataset.autoDocV83='1';
      tpl.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();downloadTemplate();},true);
    }
  }

  function apply(){patchUi();bindTemplateOverride();}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply,{once:true}); else apply();
  window.setTimeout(apply,500);
})();
