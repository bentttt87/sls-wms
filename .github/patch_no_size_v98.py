from pathlib import Path
import re

# Patch Receiving preview: size classification is retired.
p=Path('wms_receiving_autodoc_v83.js')
s=p.read_text(encoding='utf-8')
s=re.sub(r"\n\s*const classified=typeof getMaterialSizeCategory==='function'\?mats\.filter\(m=>!!getMaterialSizeCategory\(m\)\):\[\];\n\s*const unclassified=typeof getMaterialSizeCategory==='function'\?mats\.filter\(m=>!getMaterialSizeCategory\(m\)\):\[\];",'',s,count=1)
s=s.replace("<div class=\"kpi ${unclassified.length?'alert':''}\"><div class=\"lbl\">Belum Kategori</div><div class=\"val\">${typeof fmt==='function'?fmt(unclassified.length):unclassified.length}</div></div>","<div class=\"kpi\"><div class=\"lbl\">Status</div><div class=\"val\" style=\"font-size:18px;color:var(--ok)\">SIAP</div></div>",1)
s=s.replace("      if(typeof refreshZoneCache==='function') await refreshZoneCache().catch(()=>{});\n",'',1)
assert 'Belum Kategori' not in s
assert 'const unclassified=' not in s
p.write_text(s,encoding='utf-8')

# Force browser to reload the current patch chain.
p=Path('index.html')
s=p.read_text(encoding='utf-8')
s,n=re.subn(r'mobile-roman\.js\?v=[^\"\']+','mobile-roman.js?v=20260914c',s)
if n < 1:
    raise SystemExit('mobile-roman loader anchor not found')
p.write_text(s,encoding='utf-8')
print('patched receiving preview + mobile loader', n)
