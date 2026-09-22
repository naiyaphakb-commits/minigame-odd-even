#!/usr/bin/env python3
"""รวมทั้งเกมเป็นไฟล์ .html ไฟล์เดียว เปิดจากเครื่องได้เลยไม่ต้องรันเซิร์ฟเวอร์

    python3 build-single.py           # ได้ dist/odd-even.html

รวม CSS · JS · รูป · เสียง ทั้งหมดไว้ในไฟล์เดียว (แปลง asset เป็น data URI)
"""
import base64, mimetypes, os, re, json, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)
mimetypes.add_type('image/svg+xml', '.svg')
mimetypes.add_type('audio/wav', '.wav')

# โฟลเดอร์ที่เกมใช้จริง (ไม่เอาไฟล์ต้นฉบับเสียงกับวิดีโอที่เลิกใช้)
ASSET_DIRS = ['assets/egg', 'assets/chip', 'assets/icon', 'assets/img',
              'assets/audio/voice', 'assets/audio/sfx']
SKIP = {'assets/img/stage-idle.png', 'assets/img/stage-result.png'}

def data_uri(path):
    mime = mimetypes.guess_type(path)[0] or 'application/octet-stream'
    with open(path, 'rb') as f:
        return f'data:{mime};base64,' + base64.b64encode(f.read()).decode()

assets = {}
for d in ASSET_DIRS:
    for name in sorted(os.listdir(d)):
        p = f'{d}/{name}'
        if os.path.isfile(p) and p not in SKIP:
            assets[p] = data_uri(p)

# ฟอนต์ Google Fonts — ฝังเป็น data URI ด้วย ไฟล์จะได้เปิดออฟไลน์ได้จริง
def inline_fonts():
    src = 'assets/font/fonts.css'
    if not os.path.exists(src):
        return None
    css = open(src, encoding='utf-8').read()
    def sub(m):
        path = m.group(1).lstrip('/')
        return f'url({data_uri(path)})' if os.path.exists(path) else m.group(0)
    return re.sub(r'url\((/?assets/font/[^)]+)\)', sub, css)

html = open('index.html', encoding='utf-8').read()
css  = open('css/styles.css', encoding='utf-8').read()
js   = [open(f'js/{n}.js', encoding='utf-8').read() for n in ('sfx', 'egg-reveal', 'app')]

# แทนลิงก์ Google Fonts ด้วยฟอนต์ที่ฝังมาในไฟล์
fonts = inline_fonts()
if fonts:
    html = re.sub(r'<link rel="preconnect"[^>]*>\s*', '', html)
    html = re.sub(r'<link href="https://fonts\.googleapis\.com[^"]*"[^>]*>',
                  '<style>\n' + fonts + '\n</style>', html, count=1)

# แทน <link css> ด้วย <style> ฝังตรง ๆ
html = re.sub(r'<link rel="stylesheet" href="css/styles\.css[^"]*">',
              '<style>\n' + css + '\n</style>', html, count=1)

# แทน <script src> ทั้งสามตัวด้วยโค้ดฝังตรง ๆ (คงลำดับเดิม)
html = re.sub(r'\s*<script src="js/sfx\.js[^"]*"></script>\s*'
              r'<script src="js/egg-reveal\.js[^"]*"></script>\s*'
              r'<script src="js/app\.js[^"]*"></script>',
              '\n<script>\n' + '\n</script>\n<script>\n'.join(js) + '\n</script>',
              html, count=1)

# ตัวช่วยชี้ asset ไปที่ data URI — ครอบทั้ง src ใน markup, ที่เซ็ตจาก JS,
# ที่สร้างผ่าน innerHTML, new Audio() และ fetch()
shim = """<script>
window.__A = %s;
(() => {
  const A = window.__A;
  const map = u => (u == null ? u : (A[String(u).replace(/^\\.?\\//, '')] || u));
  const d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    get() { return d.get.call(this); },
    set(v) { d.set.call(this, map(v)); },
  });
  const fix = el => { const a = el.getAttribute && el.getAttribute('src');
                      if (a && A[a]) el.setAttribute('src', A[a]); };
  const scan = n => { if (n.nodeType !== 1) return;
                      if (n.tagName === 'IMG') fix(n);
                      n.querySelectorAll && n.querySelectorAll('img').forEach(fix); };
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(scan)))
    .observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', () => scan(document.body));
  const OA = window.Audio;
  window.Audio = function (src) { return new OA(map(src)); };
  const of = window.fetch;
  window.fetch = (u, o) => of(map(u), o);
})();
</script>
""" % json.dumps(assets)
html = html.replace('</head>', shim + '</head>', 1)

# src ที่อยู่ใน markup ตั้งแต่แรก แทนตรง ๆ ไปเลย
for path, uri in assets.items():
    html = html.replace(f'src="{path}"', f'src="{uri}"')

os.makedirs('dist', exist_ok=True)
out = 'dist/odd-even.html'
open(out, 'w', encoding='utf-8').write(html)
print(f'{out}  ({len(html)/1024/1024:.1f} MB · asset {len(assets)} ไฟล์)')
