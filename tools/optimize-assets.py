# Optimiza los recursos de public/ sin pérdida visible (WebP de alta calidad).
#   python tools/optimize-assets.py
# - public/tex/*.jpg (salida de tools/prep-violin.mjs y clean-pegs.py) -> .webp  (q90; normales q92)
# - public/tex/top.png (salida de tools/bake-top.mjs)                  -> top.webp
# - public/tex/top-alpha.png / top-holes.png                            -> PNG de 8 bits en gris, optimizado
# - public/img/belen-retrato.png                                        -> .webp (+ belen-retrato-og.jpg para redes)
# - public/img/galeria/*.jpg                                            -> .webp completo + miniatura "-s.webp" (60 % del ancho)
# Los originales (jpg/png) se borran una vez convertidos.
from PIL import Image
import glob, os

def save_webp(im, path, q):
    im.save(path, 'WEBP', quality=q, method=6)

for f in sorted(glob.glob('public/tex/*.jpg')):
    q = 92 if f.endswith('-n.jpg') else 90
    save_webp(Image.open(f).convert('RGB'), f[:-4] + '.webp', q); os.remove(f)
for n in ('raw', 'bridge'):  # salida de tools/bake-procedural.mjs
    f = f'public/tex/{n}.png'
    if os.path.exists(f):
        save_webp(Image.open(f).convert('RGB'), f'public/tex/{n}.webp', 94); os.remove(f)
if os.path.exists('public/tex/top.png'):
    save_webp(Image.open('public/tex/top.png').convert('RGB'), 'public/tex/top.webp', 92); os.remove('public/tex/top.png')
for f in ('public/tex/top-alpha.png', 'public/tex/top-holes.png'):
    if os.path.exists(f):
        Image.open(f).convert('RGBA').getchannel('G').save(f, optimize=True)

if os.path.exists('public/img/belen-retrato.png'):
    im = Image.open('public/img/belen-retrato.png').convert('RGB')
    save_webp(im, 'public/img/belen-retrato.webp', 92)
    im.save('public/img/belen-retrato-og.jpg', quality=86, optimize=True, progressive=True)
    os.remove('public/img/belen-retrato.png')

for f in sorted(glob.glob('public/img/galeria/*.jpg')):
    im = Image.open(f).convert('RGB')
    base = f[:-4]
    save_webp(im, base + '.webp', 86)
    w, h = im.size
    save_webp(im.resize((round(w * 0.6), round(h * 0.6)), Image.LANCZOS), base + '-s.webp', 84)
    os.remove(f)
print('ok')
