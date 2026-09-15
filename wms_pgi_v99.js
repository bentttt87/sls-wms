// WMS SLS v99 — SAP PGI gate. RK reserves only; Gate Out keeps Book SOH; PGI MATCH posts Stock Out.
(function(){
  'use strict';

  let PGI_FILE=null;
  const esc99=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt99=v=>typeof fmt==='function'?fmt(v):Number(v||0).toLocaleString('id-ID');
  function role(){try{return String(EFFECTIVE_ROLE||ROLE||'').toLowerCase().trim();}catch(_e){return '';}}
  function canPgi(){return ['master','supervisor','admin'].includes(role());}
  function norm(v){return String(v??'').trim().toLowerCase().replace(/^\ufeff/,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');}
  function sval(v){return String(v??'').trim();}
  function nqty(v){if(typeof v==='number')return v;const s=sval(v).replace(/\./g,'').replace(',','.');const n=Number(s);return Number.isFinite(n)?n:0;}
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

  function detectMeta(grid){
    const docs=new Set(),fys=new Set(),dates=new Set();
    for(let r=0;r<Math.min(grid.length,35);r++){
      const row=grid[r]||[];
      for(let c=0;c<row.length;c++){
        const k=norm(row[c]),right=row[c+1],below=(grid[r+1]||[])[c];
        if(A.doc.includes(k)){const v=sval(right||below);if(v)docs.add(v);}
        if(A.fy.includes(k)){const v=sval(right||below);if(/^20\d{2}$/.test(v))fys.add(v);}
        if(A.date.includes(k)){const v=sval(right||below);if(v)dates.add(v);}
      }
    }
    return {docs,fys,dates};
  }

  function excelDate(v){
    if(!v)return null;
    if(typeof v==='number' && window.XLSX?.SSF?.parse_date_code){const d=XLSX.SSF.parse_date_code(v);if(d)return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;}
    const s=sval(v);if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
    const m=s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);if(m)return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    return null;
  }

  function parsePgiWorkbook(wb,fileName){
    const allDocs=new Set(),allFy=new Set(),allDates=new Set();let rows=[];
    for(const sn of wb.SheetNames){
      const grid=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:null,raw:true});if(!grid.length)continue;
      const meta=detectMeta(grid);meta.docs.forEach(x=>allDocs.add(x));meta.fys.forEach(x=>allFy.add(x));meta.dates.forEach(x=>allDates.add(x));
      let hr=-1,H=[];
      for(let i=0;i<Math.min(30,grid.length);i++){H=(grid[i]||[]).map(norm);if(find(H,A.mat)>=0&&find(H,A.qty)>=0){hr=i;break;}}
      if(hr<0)continue;
      const cm=find(H,A.mat),cb=find(H,A.batch),cq=find(H,A.qty),cs=find(H,A.so),cd=find(H,A.del),cmt=find(H,A.mvt),cdoc=find(H,A.doc),cfy=find(H,A.fy),cdate=find(H,A.date);
      for(let i=hr+1;i<grid.length;i++){
        const r=grid[i]||[],mat=sval(r[cm]).toUpperCase(),qty=Math.abs(nqty(r[cq]));if(!mat||!qty)continue;
        const doc=cdoc>=0?sval(r[cdoc]):'';if(doc)allDocs.add(doc);
        const fy=cfy>=0?sval(r[cfy]):'';if(/^20\d{2}$/.test(fy))allFy.add(fy);
        const pd=cdate>=0?excelDate(r[cdate]):null;if(pd)allDates.add(pd);
        rows.push({doc_number:doc||null,fiscal_year:fy||null,posting_date:pd,so_no:cs>=0?sval(r[cs]).toUpperCase():'',delivery_no:cd>=0?sval(r[cd]).toUpperCase():'',material:mat,batch:cb>=0?sval(r[cb]):'',qty,movement_type:cmt>=0?sval(r[cmt]).toUpperCase():''});
      }
      if(rows.length)break;
    }
    if(!rows.length)throw new Error('Kolom Material dan Qty PGI tidak ditemukan atau file tidak memiliki qty positif.');
    const rowDocs=new Set(rows.map(x=>x.doc_number).filter(Boolean));rowDocs.forEach(x=>allDocs.add(x));
    if(allDocs.size===0)throw new Error('Nomor dokumen PGI tidak ditemukan otomatis. Gunakan export SAP yang memiliki Material Document / Document Number / MBLNR.');
    if(allDocs.size>1)throw new Error(`File berisi ${allDocs.size} nomor dokumen PGI. Untuk kontrol stock yang aman, upload satu dokumen PGI per file.`);
    const doc=[...allDocs][0],fy=allFy.size===1?[...allFy][0]:'',pd=allDates.size===1?excelDate([...allDates][0]):null;
    rows.forEach(x=>{if(!x.doc_number)x.doc_number=doc;if(!x.fiscal_year)x.fiscal_year=fy;if(!x.posting_date)x.posting_date=pd;});
    return {filename:fileName,documentNo:doc,fiscalYear:fy,postingDate:pd,rows};
  }

  function injectUi(){
    if(!document.getElementById('s-pgi')){
      const sec=document.createElement('section');sec.className='screen';sec.id='s-pgi';
      sec.innerHTML=`<div class="wrap">
        <div class="field-title">📤 Upload PGI SAP</div>
        <div class="field-sub">PGI adalah gate resmi Stock Out. WMS hanya memotong stock bila file SAP PGI <b>MATCH</b> dengan barang yang sudah Gate Out.</div>
        <div class="hint"><b>Kontrol:</b> satu file = satu nomor dokumen PGI. Matching: RDC + SO (bila tersedia) + Material + Series/Batch + Qty. Mismatch tidak mengubah stock.</div>
        <div id="pgiPerm" class="role-note"></div>
        <div class="card" id="pgiUploadCard">
          <input type="file" id="pgiFile" accept=".xlsx,.xls,.csv" style="display:none">
          <div class="row"><button class="btn brand" id="pgiPick">📎 Pilih File PGI</button><button class="btn ghost" id="pgiTemplate">⬇ Template</button></div>
          <div id="pgiPreview" style="margin-top:10px"></div>
        </div>
        <div class="eyebrow">Riwayat PGI</div><div id="pgiHistory"><div class="card muted">Belum dimuat.</div></div>
      </div>`;
      const app=document.getElementById('appView')||document.body;app.appendChild(sec);
    }
    const staging=document.querySelector('#s-staging .wrap');
    if(staging && !document.getElementById('pgiGateCard')){
      const card=document.createElement('div');card.id='pgiGateCard';card.className='card';card.style.cssText='border-color:#C6DEDF;background:var(--field-blue-soft);';
      card.innerHTML=`<div style="font-weight:800;color:#12365F">SAP PGI — Gate Stock Out</div><div class="muted" style="font-size:12px;margin-top:4px">Setelah Gate Out, Book SOH tetap ada sebagai PENDING GI. Upload PGI dan hanya jika MATCH stock dipotong.</div><button class="btn brand" style="margin-top:10px" onclick="go('pgi')">📤 Upload PGI</button>`;
      const sub=staging.querySelector('.field-sub');sub?.insertAdjacentElement('afterend',card);
    }
    const more=document.querySelector('#s-more .card');
    if(more && !document.getElementById('pgiMoreRow')){
      const row=document.createElement('div');row.id='pgiMoreRow';row.className='lrow';row.style.cursor='pointer';row.setAttribute('onclick',"go('pgi')");
      row.innerHTML='<div class="g"><div class="t">📤 Upload PGI SAP</div><div class="s">Reconcile PGI → Stock Out hanya jika MATCH</div></div><div class="n muted">›</div>';
      more.insertBefore(row,more.firstChild);
    }
    const hint=document.querySelector('#s-stock .hint');if(hint)hint.innerHTML='<b>PGI CONTROL:</b> RK hanya reserve stock. Picking memindahkan ke Staging. Gate Out menjadi <b>PENDING GI</b>. Book SOH baru berkurang setelah SAP PGI MATCH.';
    document.querySelectorAll('#s-staging .field-sub').forEach(x=>x.textContent='Atur staging, Gate Out, lalu selesaikan Stock Out melalui upload SAP PGI.');
    const perm=document.getElementById('pgiPerm');if(perm)perm.innerHTML=canPgi()?`Role <b>${esc99(role().toUpperCase())}</b> berhak Preview + Konfirmasi PGI untuk RDC aktif.`:'Menu PGI hanya dapat dijalankan oleh MASTER, SUPERVISOR, atau ADMIN.';
    const card=document.getElementById('pgiUploadCard');if(card)card.style.display=canPgi()?'':'none';
    bindUi();
  }

  function bindUi(){
    const pick=document.getElementById('pgiPick'),file=document.getElementById('pgiFile'),tpl=document.getElementById('pgiTemplate');
    if(pick&&!pick.dataset.v99){pick.dataset.v99='1';pick.onclick=()=>file?.click();}
    if(file&&!file.dataset.v99){file.dataset.v99='1';file.onchange=e=>{const f=e.target.files?.[0];if(f)readPgiFile(f);e.target.value='';};}
    if(tpl&&!tpl.dataset.v99){tpl.dataset.v99='1';tpl.onclick=downloadTemplate;}
  }

  function downloadTemplate(){
    const wb=XLSX.utils.book_new();const data=[
      ['Material_Document','Fiscal_Year','Posting_Date','Movement_Type','Sales_Order','Delivery','Material','Series_Batch','Qty_Box'],
      ['4900001234','2026','2026-09-15','601','4500012345','8000123456','1G337106','R146S',100]
    ];
    const ws=XLSX.utils.aoa_to_sheet(data);ws['!cols']=[{wch:20},{wch:12},{wch:15},{wch:15},{wch:18},{wch:18},{wch:18},{wch:18},{wch:12}];XLSX.utils.book_append_sheet(wb,ws,'PGI SAP');
    const pet=XLSX.utils.aoa_to_sheet([['PETUNJUK'],['Satu file hanya untuk satu Material Document PGI.'],['SO sangat disarankan agar matching WMS tidak ambigu.'],['Material, Series/Batch dan Qty harus sama dengan barang yang sudah Gate Out.'],['Jika status bukan MATCH, WMS tidak memotong stock.']]);pet['!cols']=[{wch:100}];XLSX.utils.book_append_sheet(wb,pet,'Petunjuk');XLSX.writeFile(wb,'Template_PGI_SAP_WMS.xlsx');
  }

  function readPgiFile(file){
    const out=document.getElementById('pgiPreview');out.innerHTML='<div class="card muted">⏳ Membaca PGI dan mencocokkan dengan WMS…</div>';
    const fr=new FileReader();fr.onload=async e=>{try{const wb=XLSX.read(e.target.result,{type:'array'});PGI_FILE=parsePgiWorkbook(wb,file.name);await previewPgi();}catch(err){PGI_FILE=null;out.innerHTML=`<div class="denied">${esc99(err.message)}</div>`;}};fr.readAsArrayBuffer(file);
  }

  async function previewPgi(){
    if(!PGI_FILE)return;const out=document.getElementById('pgiPreview');
    try{
      const p=await rpc('wms_pgi_preview',{p_rdc:RDC,p_rows:PGI_FILE.rows});PGI_FILE.preview=p;
      const ok=!!p.all_match;let h=`<div class="card" style="margin:0;border-color:${ok?'#BFE3CD':'#EFC4C0'};background:${ok?'var(--ok-bg)':'var(--stop-bg)'}"><div style="font-weight:800">PGI ${esc99(PGI_FILE.documentNo)}</div><div class="muted" style="font-size:12px">${esc99(PGI_FILE.filename)}${PGI_FILE.fiscalYear?' · FY '+esc99(PGI_FILE.fiscalYear):''}</div><div class="kpis" style="margin-top:10px"><div class="kpi"><div class="lbl">PGI Qty</div><div class="val">${fmt99(p.qty_file)}<small> box</small></div></div><div class="kpi"><div class="lbl">Expected WMS</div><div class="val">${fmt99(p.qty_expected)}<small> box</small></div></div><div class="kpi"><div class="lbl">Status</div><div class="val" style="font-size:18px;color:${ok?'var(--ok)':'var(--stop)'}">${ok?'MATCH':'EXCEPTION'}</div></div></div>`;
      h+='<div style="margin-top:10px">'+(p.rows||[]).map(r=>`<div class="lrow"><div class="g"><div class="t">${esc99(r.so_no||'-')} · ${esc99(r.material)} · ${esc99(r.batch||'-')}</div><div class="s">PGI ${fmt99(r.qty)} box · WMS pending ${fmt99(r.expected_qty)} box</div></div><span class="pill ${r.match_status==='MATCH'?'p-ok':'p-stop'}">${esc99(r.match_status)}</span></div>`).join('')+'</div>';
      h+=ok?'<button class="btn brand" id="pgiConfirm" style="margin-top:10px">✅ Konfirmasi PGI → Stock Out</button>':'<div class="denied" style="margin-top:10px">Stock WMS <b>TIDAK dipotong</b>. Perbaiki mismatch PGI/WMS lalu upload ulang.</div>';
      h+='</div>';out.innerHTML=h;document.getElementById('pgiConfirm')?.addEventListener('click',confirmPgi);
    }catch(err){out.innerHTML=`<div class="denied">Preview gagal: ${esc99(err.message)}</div>`;}
  }

  async function confirmPgi(){
    if(!PGI_FILE?.preview?.all_match)return;const btn=document.getElementById('pgiConfirm');
    if(!confirm(`Konfirmasi PGI ${PGI_FILE.documentNo}?\n\nKarena status MATCH, proses ini akan menjadi titik resmi STOCK OUT WMS.`))return;
    btn.disabled=true;btn.textContent='⏳ Posting Stock Out…';
    try{
      const r=await rpc('wms_pgi_confirm',{p_rdc:RDC,p_document_no:PGI_FILE.documentNo,p_fiscal_year:PGI_FILE.fiscalYear||null,p_posting_date:PGI_FILE.postingDate||null,p_filename:PGI_FILE.filename,p_rows:PGI_FILE.rows});
      document.getElementById('pgiPreview').innerHTML=`<div class="card" style="border-color:#BFE3CD;background:var(--ok-bg)"><div style="font-size:22px">✅</div><div style="font-weight:800;color:var(--ok)">PGI MATCH — STOCK OUT BERHASIL</div><div style="font-size:18px;font-weight:800;margin-top:4px">${fmt99(r.stock_out_qty||0)} BOX</div><div class="muted" style="font-size:12px;margin-top:5px">Dokumen ${esc99(PGI_FILE.documentNo)} telah direconcile dengan WMS.</div></div>`;
      PGI_FILE=null;await Promise.allSettled([loadPgiHistory(),typeof loadStock==='function'?loadStock():null,typeof loadHome==='function'?loadHome():null,typeof loadTasks==='function'?loadTasks():null,typeof loadStaging==='function'?loadStaging():null]);
    }catch(err){btn.disabled=false;btn.textContent='✅ Konfirmasi PGI → Stock Out';alert('PGI gagal: '+err.message);}
  }

  async function loadPgiHistory(){
    const out=document.getElementById('pgiHistory');if(!out)return;out.innerHTML='<div class="card muted">⏳ Memuat riwayat PGI…</div>';
    try{const rows=await rpc('wms_pgi_history',{p_rdc:RDC,p_limit:50});out.innerHTML=(rows||[]).length?`<div class="card" style="padding:4px 14px">${rows.map(x=>`<div class="lrow"><div class="g"><div class="t">${esc99(x.document_no)}</div><div class="s">${esc99(x.filename||'')} · ${fmt99(x.qty_file)} box · ${new Date(x.uploaded_at).toLocaleString('id-ID')}</div></div><div style="text-align:right"><span class="pill ${x.status==='MATCHED_POSTED'?'p-ok':'p-stop'}">${esc99(x.status)}</span><div class="s">Stock Out ${fmt99(x.qty_matched||0)}</div></div></div>`).join('')}</div>`:'<div class="card muted">Belum ada upload PGI untuk RDC ini.</div>';}catch(err){out.innerHTML=`<div class="card muted">Gagal: ${esc99(err.message)}</div>`;}
  }

  function patchDispatch(){
    if(typeof dispatchTask!=='function'||dispatchTask.__wmsV99)return;
    const fn=async function(id,btn){
      if(!confirm('GATE OUT kendaraan?\n\nBarang keluar secara operasional, tetapi Book Stock WMS BELUM dipotong. Stock Out hanya setelah SAP PGI di-upload dan MATCH.'))return;
      btn.disabled=true;btn.textContent='⏳ Gate Out…';
      try{const r=await rpc('wms_dispatch_confirm',{p_task:id});alert(`🚚 GATE OUT BERHASIL\n${fmt99(r.qty||0)} box menjadi PENDING GI.\nBook SOH belum dipotong.`);await Promise.allSettled([openTask(id),loadHome(),loadStock(),loadTasks(),loadStaging()]);}
      catch(e){btn.disabled=false;btn.textContent='🚚 Gate Out → Menunggu PGI';alert('Gagal: '+e.message);}
    };fn.__wmsV99=true;dispatchTask=fn;
  }

  function patchTaskDetail(){
    if(typeof openTask!=='function'||openTask.__wmsV99)return;const base=openTask;
    const fn=async function(id){const z=await base.apply(this,arguments);try{const ts=await rpc('wms_pick_task_list',{p_rdc:RDC});const t=(ts||[]).find(x=>Number(x.id)===Number(id));const el=document.getElementById('taskDetail');if(!el||!t)return z;
      el.querySelectorAll('button').forEach(b=>{if(/Dispatch Confirm|Stock Out/i.test(b.textContent||''))b.textContent='🚚 Gate Out → Menunggu PGI';});
      if(['DISPATCHED_PENDING_GI','PGI_EXCEPTION','DISPATCHED'].includes(t.status)){
        el.querySelectorAll('button').forEach(b=>{if(/Revisi Qty|Truck Batal|Hold Staging/i.test(b.textContent||''))b.style.display='none';});
        const card=document.createElement('div');card.className='card';card.style.cssText=`border-color:${t.status==='PGI_EXCEPTION'?'#EFC4C0':'#C6DEDF'};background:${t.status==='PGI_EXCEPTION'?'var(--stop-bg)':'var(--ok-bg)'};margin-top:10px`;
        card.innerHTML=`<div style="font-weight:800">${t.status==='DISPATCHED'?'✅ PGI MATCH · STOCK OUT':t.status==='PGI_EXCEPTION'?'⚠ PGI EXCEPTION':'⏳ DISPATCHED · PENDING GI'}</div><div class="muted" style="font-size:12px;margin-top:4px">Gate Out ${fmt99(t.dispatched_qty||0)} box · PGI ${fmt99(t.pgi_qty||0)} box · Pending ${fmt99(t.pending_gi_qty||0)} box${t.pgi_doc?' · Dok '+esc99(t.pgi_doc):''}</div>${t.status!=='DISPATCHED'?'<button class="btn brand" style="margin-top:9px" onclick="go(\'pgi\')">📤 Upload PGI</button>':''}`;el.appendChild(card);
      }
    }catch(_e){}return z;};fn.__wmsV99=true;openTask=fn;
  }

  function patchStaging(){
    if(typeof loadStaging!=='function'||loadStaging.__wmsV99)return;const base=loadStaging;
    const fn=async function(){const z=await base.apply(this,arguments);try{const ts=await rpc('wms_pick_task_list',{p_rdc:RDC});const pend=(ts||[]).filter(x=>['DISPATCHED_PENDING_GI','PGI_EXCEPTION'].includes(x.status));const out=document.getElementById('stgTasks');if(out&&pend.length){out.insertAdjacentHTML('beforeend',`<div class="eyebrow">Menunggu PGI</div><div class="card" style="padding:4px 14px">${pend.map(x=>`<div class="lrow" style="cursor:pointer" onclick="openTask(${x.id})"><div class="g"><div class="t">${esc99(x.filename)}</div><div class="s">${esc99(x.status)} · Gate Out ${fmt99(x.dispatched_qty)} · Pending GI ${fmt99(x.pending_gi_qty)}</div></div><span class="pill ${x.status==='PGI_EXCEPTION'?'p-stop':'p-warn'}">${x.status==='PGI_EXCEPTION'?'EXCEPTION':'PENDING GI'}</span></div>`).join('')}</div>`);}}
      catch(_e){}return z;};fn.__wmsV99=true;loadStaging=fn;
  }

  function patchGo(){
    if(typeof go!=='function'||go.__wmsPgiV99)return;const base=go;const fn=function(s){const z=base(s);if(String(s)==='pgi')setTimeout(()=>{injectUi();loadPgiHistory();},0);return z;};fn.__wmsPgiV99=true;go=fn;
  }

  function apply(){injectUi();patchDispatch();patchTaskDetail();patchStaging();patchGo();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
  [200,700,1500].forEach(ms=>setTimeout(apply,ms));
})();
