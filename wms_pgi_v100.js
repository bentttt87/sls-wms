// WMS SLS v100 — SAP PGI is the only official Stock Out gate.
// Flow: RK RESERVE -> PICKING/STAGING -> GATE OUT (book-only PENDING_GI) -> SAP PGI MATCH -> STOCK_OUT.
(function(){
  'use strict';

  let PGI_FILE=null;
  const esc100=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt100=v=>typeof fmt==='function'?fmt(v):Number(v||0).toLocaleString('id-ID');
  function role(){try{return String(EFFECTIVE_ROLE||ROLE||'').toLowerCase().trim();}catch(_e){return '';}}
  function canPgi(){return ['master','supervisor','admin'].includes(role());}
  function norm(v){return String(v??'').trim().toLowerCase().replace(/^\ufeff/,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');}
  function sval(v){return String(v??'').trim();}
  function nqty(v){if(typeof v==='number')return Math.abs(v);const s=sval(v).replace(/\./g,'').replace(',','.');const n=Number(s);return Number.isFinite(n)?Math.abs(n):0;}
  function find(H,A){for(const a of A){const i=H.indexOf(a);if(i>=0)return i;}return -1;}

  const A={
    doc:['material_document','material_doc','material_document_no','document_number','document_no','doc_number','doc_no','mblnr','pgi_document','gi_document','goods_issue_document'],
    fy:['fiscal_year','document_year','doc_year','mjahr','year'],
    date:['posting_date','postingdate','budat','document_date','doc_date'],
    mvt:['movement_type','movementtype','mvt_type','bwart'],
    mat:['material','material_code','matnr','sku','kode_material'],
    batch:['batch','series','seri','charg','series_batch'],
    qty:['qty','quantity','qty_box','entry_quantity','menge','jumlah','jumlah_box'],
    so:['sales_order','sales_order_no','sales_order_number','so_no','so','order_no'],
    del:['delivery','delivery_no','delivery_number','outbound_delivery','outbound_delivery_no']
  };

  function excelDate(v){
    if(!v)return null;
    if(typeof v==='number'&&window.XLSX?.SSF?.parse_date_code){const d=XLSX.SSF.parse_date_code(v);if(d)return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;}
    const s=sval(v);if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
    const m=s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);if(m)return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    return null;
  }

  function detectMeta(grid){
    const docs=new Set(),fys=new Set(),dates=new Set();
    for(let r=0;r<Math.min(grid.length,35);r++){
      const row=grid[r]||[];
      for(let c=0;c<row.length;c++){
        const k=norm(row[c]),right=row[c+1],below=(grid[r+1]||[])[c];
        if(A.doc.includes(k)){const v=sval(right||below);if(v)docs.add(v);}
        if(A.fy.includes(k)){const v=sval(right||below);if(/^20\d{2}$/.test(v))fys.add(v);}
        if(A.date.includes(k)){const v=excelDate(right||below);if(v)dates.add(v);}
      }
    }
    return {docs,fys,dates};
  }

  function parseWorkbook(wb,fileName){
    const docs=new Set(),fys=new Set(),dates=new Set();let rows=[];
    for(const sn of wb.SheetNames){
      const grid=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:null,raw:true});if(!grid.length)continue;
      const meta=detectMeta(grid);meta.docs.forEach(x=>docs.add(x));meta.fys.forEach(x=>fys.add(x));meta.dates.forEach(x=>dates.add(x));
      let hr=-1,H=[];
      for(let i=0;i<Math.min(30,grid.length);i++){H=(grid[i]||[]).map(norm);if(find(H,A.mat)>=0&&find(H,A.qty)>=0){hr=i;break;}}
      if(hr<0)continue;
      const cm=find(H,A.mat),cb=find(H,A.batch),cq=find(H,A.qty),cs=find(H,A.so),cd=find(H,A.del),cmt=find(H,A.mvt),cdoc=find(H,A.doc),cfy=find(H,A.fy),cdate=find(H,A.date);
      const parsed=[];
      for(let i=hr+1;i<grid.length;i++){
        const r=grid[i]||[],mat=sval(r[cm]).toUpperCase(),qty=nqty(r[cq]);if(!mat||qty<=0)continue;
        const doc=cdoc>=0?sval(r[cdoc]):'';if(doc)docs.add(doc);
        const fy=cfy>=0?sval(r[cfy]):'';if(/^20\d{2}$/.test(fy))fys.add(fy);
        const pd=cdate>=0?excelDate(r[cdate]):null;if(pd)dates.add(pd);
        parsed.push({
          doc_number:doc||null,fiscal_year:fy||null,posting_date:pd,
          so_no:cs>=0?sval(r[cs]).toUpperCase():'',delivery_no:cd>=0?sval(r[cd]).toUpperCase():'',
          material:mat,batch:cb>=0?sval(r[cb]):'',qty,
          movement_type:cmt>=0?sval(r[cmt]).toUpperCase():''
        });
      }
      if(parsed.length){rows=parsed;break;}
    }
    if(!rows.length)throw new Error('Kolom Material dan Qty PGI tidak ditemukan atau file tidak memiliki qty positif.');
    rows.map(x=>x.doc_number).filter(Boolean).forEach(x=>docs.add(x));
    if(docs.size===0)throw new Error('Nomor dokumen PGI tidak ditemukan otomatis. Gunakan export SAP yang memuat Material Document / Document Number / MBLNR.');
    if(docs.size>1)throw new Error(`File berisi ${docs.size} nomor dokumen PGI. Upload satu dokumen PGI per file.`);
    const documentNo=[...docs][0],fiscalYear=fys.size===1?[...fys][0]:'',postingDate=dates.size===1?[...dates][0]:null;
    rows.forEach(x=>{if(!x.doc_number)x.doc_number=documentNo;if(!x.fiscal_year)x.fiscal_year=fiscalYear;if(!x.posting_date)x.posting_date=postingDate;});
    return {filename:fileName,documentNo,fiscalYear,postingDate,rows};
  }

  function injectUi(){
    if(!document.getElementById('s-pgi')){
      const sec=document.createElement('section');sec.className='screen';sec.id='s-pgi';
      sec.innerHTML=`<div class="wrap">
        <div class="field-title">📤 Upload PGI SAP</div>
        <div class="field-sub">PGI adalah satu-satunya titik resmi Stock Out WMS. RK hanya reserve; Picking/Staging hanya perpindahan fisik; Gate Out menjadi PENDING GI.</div>
        <div class="hint"><b>Matching wajib:</b> RDC + SO (jika tersedia) + Material + Series/Batch + Qty. Movement Type 601 bila tersedia. Mismatch/reversal tidak memotong Book SOH.</div>
        <div id="pgiPerm100" class="role-note"></div>
        <div class="card" id="pgiUploadCard100">
          <input type="file" id="pgiFile100" accept=".xlsx,.xls,.csv" style="display:none">
          <div class="row"><button class="btn brand" id="pgiPick100">📎 Pilih File PGI</button><button class="btn ghost" id="pgiTemplate100">⬇ Template PGI</button></div>
          <div id="pgiPreview100" style="margin-top:10px"></div>
        </div>
        <div class="eyebrow">Riwayat PGI</div><div id="pgiHistory100"><div class="card muted">Belum dimuat.</div></div>
      </div>`;
      (document.getElementById('appView')||document.body).appendChild(sec);
    }

    const staging=document.querySelector('#s-staging .wrap');
    if(staging&&!document.getElementById('pgiGateCard100')&&canPgi()){
      const card=document.createElement('div');card.id='pgiGateCard100';card.className='card';card.style.cssText='border-color:#C6DEDF;background:var(--field-blue-soft);';
      card.innerHTML='<div style="font-weight:800;color:#12365F">SAP PGI — Gate Stock Out</div><div class="muted" style="font-size:12px;margin-top:4px">Gate Out tidak memotong Book SOH. Setelah SAP PGI di-upload dan MATCH, WMS baru menjalankan Stock Out.</div><button class="btn brand" style="margin-top:10px" onclick="go(\'pgi\')">📤 Upload PGI</button>';
      staging.querySelector('.field-sub')?.insertAdjacentElement('afterend',card);
    }

    const more=document.querySelector('#s-more .card');
    let mr=document.getElementById('pgiMoreRow100');
    if(more&&!mr&&canPgi()){
      mr=document.createElement('div');mr.id='pgiMoreRow100';mr.className='lrow';mr.style.cursor='pointer';mr.setAttribute('onclick',"go('pgi')");
      mr.innerHTML='<div class="g"><div class="t">📤 Upload PGI SAP</div><div class="s">PGI MATCH → Stock Out resmi WMS</div></div><div class="n muted">›</div>';
      more.insertBefore(mr,more.firstChild);
    }
    if(mr&&!canPgi())mr.remove();

    const stockHint=document.querySelector('#s-stock .hint');
    if(stockHint)stockHint.innerHTML='<b>SAP PGI CONTROL:</b> Book SOH tidak berkurang saat RK, Picking, atau Gate Out. Status <b>PENDING GI</b> berarti barang sudah keluar fisik namun masih tercatat di Book SOH sampai PGI MATCH.';
    document.querySelectorAll('#s-staging .field-sub').forEach(x=>x.textContent='Picking → Staging → Gate Out → Upload SAP PGI → Stock Out hanya jika MATCH.');

    const perm=document.getElementById('pgiPerm100');
    if(perm)perm.innerHTML=canPgi()?`Role <b>${esc100(role().toUpperCase())}</b> mempunyai kewenangan Preview + Konfirmasi PGI untuk RDC aktif.`:'Menu PGI hanya dapat dijalankan oleh MASTER, SUPERVISOR, atau ADMIN.';
    const card=document.getElementById('pgiUploadCard100');if(card)card.style.display=canPgi()?'':'none';
    bindUi();
  }

  function bindUi(){
    const pick=document.getElementById('pgiPick100'),file=document.getElementById('pgiFile100'),tpl=document.getElementById('pgiTemplate100');
    if(pick&&!pick.dataset.v100){pick.dataset.v100='1';pick.onclick=()=>file?.click();}
    if(file&&!file.dataset.v100){file.dataset.v100='1';file.onchange=e=>{const f=e.target.files?.[0];if(f)readFile(f);e.target.value='';};}
    if(tpl&&!tpl.dataset.v100){tpl.dataset.v100='1';tpl.onclick=downloadTemplate;}
  }

  function downloadTemplate(){
    const wb=XLSX.utils.book_new();
    const ws=XLSX.utils.aoa_to_sheet([
      ['Material_Document','Fiscal_Year','Posting_Date','Movement_Type','Sales_Order','Delivery','Material','Series_Batch','Qty_Box'],
      ['4900001234','2026','2026-09-15','601','4500012345','8000123456','1G337106','R146S',100]
    ]);
    ws['!cols']=[{wch:20},{wch:12},{wch:15},{wch:15},{wch:18},{wch:18},{wch:18},{wch:18},{wch:12}];XLSX.utils.book_append_sheet(wb,ws,'PGI SAP');
    const pet=XLSX.utils.aoa_to_sheet([['PETUNJUK'],['Satu file = satu Material Document PGI.'],['Movement Type 601 adalah PGI normal. Movement reversal seperti 602 tidak akan Stock Out.'],['SO sangat disarankan agar matching tidak ambigu.'],['Material + Series/Batch + Qty harus sama dengan Gate Out WMS.'],['MATCH = Stock Out. EXCEPTION = Book SOH tidak berubah.']]);pet['!cols']=[{wch:110}];XLSX.utils.book_append_sheet(wb,pet,'Petunjuk');
    XLSX.writeFile(wb,'Template_PGI_SAP_WMS.xlsx');
  }

  function readFile(file){
    const out=document.getElementById('pgiPreview100');if(!out)return;
    out.innerHTML='<div class="card muted">⏳ Membaca PGI dan mencocokkan dengan Gate Out WMS…</div>';
    const fr=new FileReader();fr.onload=async e=>{try{PGI_FILE=parseWorkbook(XLSX.read(e.target.result,{type:'array'}),file.name);await preview();}catch(err){PGI_FILE=null;out.innerHTML=`<div class="denied">${esc100(err.message)}</div>`;}};fr.readAsArrayBuffer(file);
  }

  async function preview(){
    if(!PGI_FILE)return;const out=document.getElementById('pgiPreview100');
    try{
      const p=await rpc('wms_pgi_preview',{p_rdc:RDC,p_rows:PGI_FILE.rows});PGI_FILE.preview=p;
      const ok=!!p.all_match;
      let h=`<div class="card" style="margin:0;border-color:${ok?'#BFE3CD':'#EFC4C0'};background:${ok?'var(--ok-bg)':'var(--stop-bg)'}"><div style="font-weight:800">PGI ${esc100(PGI_FILE.documentNo)}</div><div class="muted" style="font-size:12px">${esc100(PGI_FILE.filename)}${PGI_FILE.fiscalYear?' · FY '+esc100(PGI_FILE.fiscalYear):''}</div><div class="kpis" style="margin-top:10px"><div class="kpi"><div class="lbl">PGI Qty</div><div class="val">${fmt100(p.qty_file)}<small> box</small></div></div><div class="kpi"><div class="lbl">WMS Pending</div><div class="val">${fmt100(p.qty_expected)}<small> box</small></div></div><div class="kpi"><div class="lbl">Status</div><div class="val" style="font-size:18px;color:${ok?'var(--ok)':'var(--stop)'}">${ok?'MATCH':'EXCEPTION'}</div></div></div>`;
      h+='<div style="margin-top:10px">'+(p.rows||[]).map(r=>`<div class="lrow"><div class="g"><div class="t">${esc100(r.so_no||'-')} · ${esc100(r.material)} · ${esc100(r.batch||'-')}</div><div class="s">PGI ${fmt100(r.qty)} box · WMS ${fmt100(r.expected_qty)} box${r.movement_type?' · MvT '+esc100(r.movement_type):''}</div></div><span class="pill ${r.match_status==='MATCH'?'p-ok':'p-stop'}">${esc100(r.match_status)}</span></div>`).join('')+'</div>';
      h+=ok?'<button class="btn brand" id="pgiPost100" style="margin-top:10px">✅ Konfirmasi PGI → STOCK OUT</button>':'<div class="denied" style="margin-top:10px">Stock WMS <b>TIDAK dipotong</b>. Mismatch/reversal harus diselesaikan lebih dulu.</div><button class="btn ghost" id="pgiLogEx100" style="margin-top:8px">⚠ Catat sebagai PGI Exception</button>';
      h+='</div>';out.innerHTML=h;
      document.getElementById('pgiPost100')?.addEventListener('click',()=>post(true));
      document.getElementById('pgiLogEx100')?.addEventListener('click',()=>post(false));
    }catch(err){out.innerHTML=`<div class="denied">Preview gagal: ${esc100(err.message)}</div>`;}
  }

  async function post(expectMatch){
    if(!PGI_FILE)return;
    const btn=document.getElementById(expectMatch?'pgiPost100':'pgiLogEx100');
    if(expectMatch&&!PGI_FILE.preview?.all_match)return;
    const ask=expectMatch?`Konfirmasi PGI ${PGI_FILE.documentNo}?\n\nMATCH akan menjadi titik resmi STOCK OUT WMS.`:`Catat PGI ${PGI_FILE.documentNo} sebagai EXCEPTION?\n\nTidak ada stock WMS yang dipotong.`;
    if(!confirm(ask))return;
    if(btn){btn.disabled=true;btn.textContent=expectMatch?'⏳ Posting Stock Out…':'⏳ Mencatat exception…';}
    try{
      const r=await rpc('wms_pgi_confirm',{p_rdc:RDC,p_document_no:PGI_FILE.documentNo,p_fiscal_year:PGI_FILE.fiscalYear||null,p_posting_date:PGI_FILE.postingDate||null,p_filename:PGI_FILE.filename,p_rows:PGI_FILE.rows});
      const posted=r.status==='MATCHED_POSTED';
      document.getElementById('pgiPreview100').innerHTML=posted
        ?`<div class="card" style="border-color:#BFE3CD;background:var(--ok-bg)"><div style="font-size:22px">✅</div><div style="font-weight:800;color:var(--ok)">PGI MATCH — STOCK OUT BERHASIL</div><div style="font-size:18px;font-weight:800;margin-top:4px">${fmt100(r.stock_out_qty||0)} BOX</div><div class="muted" style="font-size:12px;margin-top:5px">Dokumen ${esc100(PGI_FILE.documentNo)} telah menjadi referensi Stock Out WMS.</div></div>`
        :`<div class="card" style="border-color:#EFC4C0;background:var(--stop-bg)"><div style="font-size:22px">⚠</div><div style="font-weight:800;color:var(--stop)">PGI EXCEPTION TERCATAT</div><div class="muted" style="font-size:12px;margin-top:5px">Stock Out = 0 BOX. Perbaiki mismatch lalu upload ulang.</div></div>`;
      PGI_FILE=null;
      await Promise.allSettled([loadHistory(),typeof loadStock==='function'?loadStock():null,typeof loadHome==='function'?loadHome():null,typeof loadTasks==='function'?loadTasks():null,typeof loadStaging==='function'?loadStaging():null]);
    }catch(err){if(btn){btn.disabled=false;btn.textContent=expectMatch?'✅ Konfirmasi PGI → STOCK OUT':'⚠ Catat sebagai PGI Exception';}alert('PGI gagal: '+err.message);}
  }

  async function loadHistory(){
    const out=document.getElementById('pgiHistory100');if(!out)return;out.innerHTML='<div class="card muted">⏳ Memuat riwayat PGI…</div>';
    try{const rows=await rpc('wms_pgi_history',{p_rdc:RDC,p_limit:50});out.innerHTML=(rows||[]).length?`<div class="card" style="padding:4px 14px">${rows.map(x=>`<div class="lrow"><div class="g"><div class="t">${esc100(x.document_no)}</div><div class="s">${esc100(x.filename||'')} · ${fmt100(x.qty_file)} box · ${new Date(x.uploaded_at).toLocaleString('id-ID')}</div></div><div style="text-align:right"><span class="pill ${x.status==='MATCHED_POSTED'?'p-ok':'p-stop'}">${esc100(x.status)}</span><div class="s">Stock Out ${fmt100(x.qty_matched||0)}</div></div></div>`).join('')}</div>`:'<div class="card muted">Belum ada upload PGI untuk RDC ini.</div>';}catch(err){out.innerHTML=`<div class="card muted">Gagal: ${esc100(err.message)}</div>`;}
  }

  function patchDispatch(){
    if(typeof dispatchTask!=='function'||dispatchTask.__wmsV100)return;
    const fn=async function(id,btn){
      if(!canPgi()){alert('Gate Out hanya untuk MASTER, SUPERVISOR, atau ADMIN.');return;}
      if(!confirm('GATE OUT kendaraan?\n\nBarang keluar fisik gudang, tetapi Book SOH WMS BELUM dipotong. Stock Out hanya setelah SAP PGI MATCH.'))return;
      btn.disabled=true;btn.textContent='⏳ Gate Out…';
      try{const r=await rpc('wms_dispatch_confirm',{p_task:id});alert(`🚚 GATE OUT BERHASIL\n${fmt100(r.qty||0)} box menjadi PENDING GI.\nBook SOH belum dipotong.`);await Promise.allSettled([openTask(id),loadHome(),loadStock(),loadTasks(),loadStaging()]);}
      catch(e){btn.disabled=false;btn.textContent='🚚 Gate Out → Menunggu PGI';alert('Gagal: '+e.message);}
    };fn.__wmsV100=true;dispatchTask=fn;
  }

  function patchTaskDetail(){
    if(typeof openTask!=='function'||openTask.__wmsV100)return;const base=openTask;
    const fn=async function(id){const z=await base.apply(this,arguments);try{
      const ts=await rpc('wms_pick_task_list',{p_rdc:RDC});const t=(ts||[]).find(x=>Number(x.id)===Number(id));const el=document.getElementById('taskDetail');if(!el||!t)return z;
      el.querySelectorAll('button').forEach(b=>{if(/Dispatch Confirm|Stock Out/i.test(b.textContent||''))b.textContent='🚚 Gate Out → Menunggu PGI';});
      if(['DISPATCHED_PENDING_GI','PGI_EXCEPTION','DISPATCHED'].includes(t.status)){
        el.querySelectorAll('button').forEach(b=>{if(/Revisi Qty|Truck Batal|Hold Staging|Dispatch Confirm/i.test(b.textContent||''))b.style.display='none';});
        const card=document.createElement('div');card.className='card';card.style.cssText=`border-color:${t.status==='PGI_EXCEPTION'?'#EFC4C0':'#C6DEDF'};background:${t.status==='PGI_EXCEPTION'?'var(--stop-bg)':'var(--ok-bg)'};margin-top:10px`;
        card.innerHTML=`<div style="font-weight:800">${t.status==='DISPATCHED'?'✅ PGI MATCH · STOCK OUT':t.status==='PGI_EXCEPTION'?'⚠ PGI EXCEPTION':'⏳ GATE OUT · PENDING GI'}</div><div class="muted" style="font-size:12px;margin-top:4px">Gate Out ${fmt100(t.dispatched_qty||0)} box · PGI ${fmt100(t.pgi_qty||0)} box · Pending ${fmt100(t.pending_gi_qty||0)} box${t.pgi_doc?' · Dok '+esc100(t.pgi_doc):''}</div>${t.status!=='DISPATCHED'&&canPgi()?'<button class="btn brand" style="margin-top:9px" onclick="go(\'pgi\')">📤 Upload PGI</button>':''}`;el.appendChild(card);
      }
    }catch(_e){}return z;};fn.__wmsV100=true;openTask=fn;
  }

  function patchStaging(){
    if(typeof loadStaging!=='function'||loadStaging.__wmsV100)return;const base=loadStaging;
    const fn=async function(){const z=await base.apply(this,arguments);try{const ts=await rpc('wms_pick_task_list',{p_rdc:RDC});const pend=(ts||[]).filter(x=>['DISPATCHED_PENDING_GI','PGI_EXCEPTION'].includes(x.status));const out=document.getElementById('stgTasks');if(out&&pend.length){out.insertAdjacentHTML('beforeend',`<div class="eyebrow">Menunggu PGI</div><div class="card" style="padding:4px 14px">${pend.map(x=>`<div class="lrow" style="cursor:pointer" onclick="openTask(${x.id})"><div class="g"><div class="t">${esc100(x.filename)}</div><div class="s">${esc100(x.status)} · Gate Out ${fmt100(x.dispatched_qty)} · Pending GI ${fmt100(x.pending_gi_qty)}</div></div><span class="pill ${x.status==='PGI_EXCEPTION'?'p-stop':'p-warn'}">${x.status==='PGI_EXCEPTION'?'EXCEPTION':'PENDING GI'}</span></div>`).join('')}</div>`);}}catch(_e){}return z;};fn.__wmsV100=true;loadStaging=fn;
  }

  function patchGo(){
    if(typeof go!=='function'||go.__wmsPgiV100)return;const base=go;
    const fn=function(s){if(String(s)==='pgi'&&!canPgi())return base('home');const z=base(s);if(String(s)==='pgi')setTimeout(()=>{injectUi();loadHistory();},0);return z;};fn.__wmsPgiV100=true;go=fn;
  }

  function apply(){injectUi();patchDispatch();patchTaskDetail();patchStaging();patchGo();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
  [250,800,1600].forEach(ms=>setTimeout(apply,ms));
})();
