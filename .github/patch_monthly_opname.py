from pathlib import Path

p=Path('index.html')
s=p.read_text(encoding='utf-8')

old='''<section class="screen" id="s-opname"><div class="wrap">
  <div class="field-title">✅ Stock Opname</div><div class="field-sub">Hitung fisik stock yang bergerak dan catat selisihnya.</div>
  <div class="hint">Menampilkan barang yang bergerak beberapa hari terakhir. Hitung fisiknya, isi jumlahnya, sisanya dihitung sistem.</div>
  <div class="row" style="margin-bottom:12px">
    <div><label>Rentang gerak</label><select id="opDays"><option value="1">Hari ini</option><option value="3" selected>3 hari</option><option value="7">7 hari</option></select></div>
    <div style="display:flex;align-items:flex-end"><button class="btn" id="opLoad">Muat daftar</button></div>
  </div>
  <div id="opOut"></div>
  <div id="opPending"></div>
</div></section>'''

new='''<section class="screen" id="s-opname"><div class="wrap">
  <div class="field-title">✅ Stock Opname</div><div class="field-sub">Cycle Count untuk kontrol harian atau Stock Opname Bulanan untuk seluruh item dan lokasi.</div>
  <div class="hint">Pilih jenis opname. Mode bulanan memuat seluruh stock yang sudah berada di lokasi fisik RDC, tanpa melihat kapan terakhir bergerak.</div>
  <div class="row" style="margin-bottom:10px">
    <div><label>Jenis opname</label><select id="opMode"><option value="cycle" selected>Cycle Count — barang bergerak</option><option value="monthly">Bulanan — semua item & semua lokasi</option></select></div>
    <div id="opDaysWrap"><label>Rentang gerak</label><select id="opDays"><option value="1">Hari ini</option><option value="3" selected>3 hari</option><option value="7">7 hari</option></select></div>
  </div>
  <div id="opModeInfo" class="hint" style="margin-bottom:10px">Cycle Count memprioritaskan stock yang bergerak dalam rentang hari yang dipilih.</div>
  <button class="btn" id="opLoad" style="margin-bottom:12px">Muat daftar</button>
  <div id="opOut"></div>
  <div id="opPending"></div>
</div></section>'''

if old not in s:
    raise SystemExit('Opname HTML block not found; no change made.')
s=s.replace(old,new,1)

old2="""// ================= OPNAME HARIAN =================
document.getElementById('opLoad').addEventListener('click',loadOpname);
let OP_ROWS=[];
async function loadOpname(){
  const days=parseInt(document.getElementById('opDays').value);
  const out=document.getElementById('opOut');
  out.innerHTML='<div class=\"card muted\">⏳ Memuat…</div>';
  try{
    OP_ROWS=await rpc('wms_opname_candidates',{p_rdc:RDC,p_days:days});"""

new2="""// ================= OPNAME: CYCLE COUNT + BULANAN FULL =================
document.getElementById('opLoad').addEventListener('click',loadOpname);
const opModeEl=document.getElementById('opMode');
function syncOpnameMode(){
  const monthly=opModeEl?.value==='monthly';
  const daysWrap=document.getElementById('opDaysWrap');
  const info=document.getElementById('opModeInfo');
  if(daysWrap)daysWrap.style.display=monthly?'none':'block';
  if(info){
    info.style.background=monthly?'var(--warn-bg)':'';
    info.style.color=monthly?'var(--warn)':'';
    info.innerHTML=monthly
      ? '<b>Stock Opname Bulanan:</b> seluruh item pada seluruh lokasi fisik RDC akan dimuat. Lakukan saat cut-off / freeze transaksi. Stock UNLOCATED harus diselesaikan Putaway terlebih dahulu.'
      : 'Cycle Count memprioritaskan stock yang bergerak dalam rentang hari yang dipilih.';
  }
}
opModeEl?.addEventListener('change',()=>{syncOpnameMode();document.getElementById('opOut').innerHTML='';});
syncOpnameMode();
let OP_ROWS=[];
async function loadOpname(){
  const mode=document.getElementById('opMode')?.value||'cycle';
  const days=parseInt(document.getElementById('opDays').value);
  const out=document.getElementById('opOut');
  out.innerHTML='<div class=\"card muted\">⏳ Memuat…</div>';
  try{
    OP_ROWS=mode==='monthly'
      ? await rpc('wms_opname_full_candidates',{p_rdc:RDC})
      : await rpc('wms_opname_candidates',{p_rdc:RDC,p_days:days});"""

if old2 not in s:
    raise SystemExit('Opname JS header not found; no change made.')
s=s.replace(old2,new2,1)

old3="""    if(!OP_ROWS.length){
      out.innerHTML='<div class=\"card muted\">Tidak ada barang yang bergerak dalam rentang ini. Tidak perlu opname harian.</div>';
      loadOpPending(); return;
    }
    out.innerHTML=`<div class=\"card\" style=\"padding:4px 14px\">`+OP_ROWS.map((r,i)=>`
      <div class=\"lrow\"><div class=\"g\"><div class=\"t\">${esc(r.material_code)}${r.batch?' · '+esc(r.batch):''}</div>
      <div class=\"s\">${esc(r.location_code)} · sistem ${fmt(r.qty_system)} box · gerak ${esc(r.last_move||'')}</div></div>"""

new3="""    if(!OP_ROWS.length){
      out.innerHTML=mode==='monthly'
        ? '<div class=\"card muted\">Tidak ada stock berlokasi yang dapat dimuat untuk Stock Opname Bulanan.</div>'
        : '<div class=\"card muted\">Tidak ada barang yang bergerak dalam rentang ini. Tidak perlu Cycle Count.</div>';
      loadOpPending(); return;
    }
    const locCount=new Set(OP_ROWS.map(r=>r.location_code).filter(Boolean)).size;
    const totalQty=OP_ROWS.reduce((a,r)=>a+(Number(r.qty_system)||0),0);
    const monthlySummary=mode==='monthly'?`<div class=\"card\" style=\"border-color:#BFD7F4;background:#F2F7FD\"><div style=\"font-weight:750\">Stock Opname Bulanan — ${fmt(OP_ROWS.length)} baris · ${fmt(locCount)} lokasi · ${fmt(totalQty)} box sistem</div><div class=\"muted\" style=\"font-size:12px;margin-top:3px\">Seluruh item yang memiliki stock pada lokasi fisik RDC. Pastikan transaksi sudah di-freeze sebelum mulai hitung.</div></div>`:'';
    out.innerHTML=monthlySummary+`<div class=\"card\" style=\"padding:4px 14px\">`+OP_ROWS.map((r,i)=>`
      <div class=\"lrow\"><div class=\"g\"><div class=\"t\">${esc(r.material_code)}${r.batch?' · '+esc(r.batch):''}</div>
      <div class=\"s\">${esc(r.location_code)} · sistem ${fmt(r.qty_system)} box${mode==='monthly'?' · FULL COUNT':' · gerak '+esc(r.last_move||'')}</div></div>"""

if old3 not in s:
    raise SystemExit('Opname list block not found; no change made.')
s=s.replace(old3,new3,1)

s=s.replace('Kosongkan yang tidak dihitung. Selisih perlu persetujuan RDC Manager.','Kosongkan yang tidak dihitung. Selisih perlu review Supervisor lalu persetujuan RDC Manager.',1)

p.write_text(s,encoding='utf-8')
print('Monthly full opname UI applied.')
