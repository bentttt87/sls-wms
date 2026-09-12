from pathlib import Path
import re

p = Path('index.html')
s = p.read_text(encoding='utf-8')
original = s

sidebar = '''  <button class="desktop-only" data-s="zone" data-perm="ZONE_MANAGE" onclick="go('zone')"><svg viewBox="0 0 24 24"><path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/></svg><span>Kuota Ukuran</span></button>\n'''
s = s.replace(sidebar, '')

more_row = '''    <div class="lrow" style="cursor:pointer" onclick="go('zone')"><div class="g"><div class="t">Kuota Ukuran</div><div class="s">Kuota kapasitas per ukuran se-RDC + klasifikasi material</div></div><div class="n muted">›</div></div>\n'''
s = s.replace(more_row, '')

s = s.replace('<div id="homeZoneAlert"></div>', '<div id="homeZoneAlert" style="display:none"></div>')

pattern = re.compile(r"function refreshHomeZoneAlert\(\)\{.*?\n\}\nconst _goZone=go;", re.S)
replacement = """function refreshHomeZoneAlert(){
  const el=document.getElementById('homeZoneAlert');
  if(el){ el.innerHTML=''; el.style.display='none'; }
}
const _goZone=go;"""
s, count = pattern.subn(replacement, s, count=1)
if count != 1:
    raise SystemExit(f'Expected one refreshHomeZoneAlert function, found {count}')

if 'Perlu perhatian kuota ukuran' in s:
    raise SystemExit('Legacy dashboard quota warning still present after patch')

if s == original:
    print('No changes needed')
else:
    p.write_text(s, encoding='utf-8')
    print('Core quota UI/dashboard warning removed from index.html')
