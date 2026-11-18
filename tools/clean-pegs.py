# Borra de la textura lateral de la cabeza (public/tex/scroll.jpg + scroll-n.jpg) las cabezas de clavija
# fotografiadas: ahora las clavijas son 3D. Ejecutar después de tools/prep-violin.mjs.
#   python tools/clean-pegs.py
import numpy as np
from PIL import Image, ImageFilter, ImageDraw

SRC, NRM = 'public/tex/scroll.jpg', 'public/tex/scroll-n.jpg'
im = np.asarray(Image.open(SRC).convert('RGB')).astype(np.float32)
nm = np.asarray(Image.open(NRM).convert('RGB')).astype(np.float32)
H, W, _ = im.shape

# zonas de las dos cabezas de clavija (elipses generosas, en píxeles de la textura 1024x1792)
zone = Image.new('L', (W, H), 0)
d = ImageDraw.Draw(zone)
d.ellipse([250, 785, 632, 985], fill=255)                     # clavija superior
big = Image.new('L', (W, H), 0)
ImageDraw.Draw(big).ellipse([530, 1262, 915, 1482], fill=255)  # clavija inferior (inclinada)
big = big.rotate(-36, center=(722, 1372))
zone = Image.fromarray(np.maximum(np.asarray(zone), np.asarray(big)))

M = np.asarray(zone.filter(ImageFilter.MaxFilter(9))) > 127

def fill(arr, M):
    # push-pull: media ponderada de lo conocido a varias escalas (relleno suave, sin artefactos)
    known = (~M).astype(np.float32)
    out = arr.copy()
    for s in (60, 30, 15, 7, 3):
        num = np.stack([gblur(arr[..., k] * known, s) for k in range(3)], -1)
        den = gblur(known, s)[..., None]
        est = num / np.maximum(den, 1e-4)
        if s == 60: out = np.where(M[..., None], est, out); continue
        w = np.clip((den - 0.15) / 0.7, 0, 1) * M[..., None]
        out = out * (1 - w) + est * w
    return out

def _box(a, r, axis):
    a = np.moveaxis(a, axis, 0)
    p = np.concatenate([np.repeat(a[:1], r + 1, 0), a, np.repeat(a[-1:], r, 0)], 0)
    cs = np.cumsum(p, 0)
    out = (cs[2 * r + 1:] - cs[:-2 * r - 1]) / (2 * r + 1)
    return np.moveaxis(out, 0, axis)

def gblur(a, s):
    # tres pasadas de caja ~ gaussiana
    r = max(1, int(s * 0.9))
    for _ in range(3):
        a = _box(_box(a, r, 0), r, 1)
    return a

base = fill(im, M)
# veta: detalle de alta frecuencia de una zona limpia de madera, repetida sobre el relleno
patch = im[995:1075, 430:610]
pb = gblur(patch.copy(), 5)
detail = patch - pb
# mosaico en espejo (sin costuras entre copias)
t2 = np.concatenate([detail, detail[:, ::-1]], 1); t2 = np.concatenate([t2, t2[::-1]], 0)
ty = np.tile(t2, (H // t2.shape[0] + 1, W // t2.shape[1] + 1, 1))[:H, :W]
out = base * np.array([0.9, 0.86, 0.82], np.float32) + ty * M[..., None] * 0.8
# borde suave
soft = np.asarray(Image.fromarray((M * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(5))).astype(np.float32)[..., None] / 255
res = im * (1 - soft) + np.clip(out, 0, 255) * soft
Image.fromarray(np.clip(res, 0, 255).astype(np.uint8)).save(SRC, quality=92)

nflat = fill(nm, M)
nres = nm * (1 - soft) + nflat * soft
Image.fromarray(np.clip(nres, 0, 255).astype(np.uint8)).save(NRM, quality=92)
print('pixels limpiados:', int(M.sum()))
