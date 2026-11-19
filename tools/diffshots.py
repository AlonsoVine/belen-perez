# Compara dos carpetas de capturas: python tools/diffshots.py <antes> <después>
import sys, os, numpy as np
from PIL import Image, ImageFilter
a, b = sys.argv[1], sys.argv[2]
for f in sorted(os.listdir(a)):
    if not f.endswith('.png') or not os.path.exists(os.path.join(b, f)): continue
    x = Image.open(os.path.join(a, f)).convert('RGB'); y = Image.open(os.path.join(b, f)).convert('RGB')
    xb = np.asarray(x.filter(ImageFilter.GaussianBlur(2)), float); yb = np.asarray(y.filter(ImageFilter.GaussianBlur(2)), float)
    d = np.abs(xb - yb).mean(axis=2)
    print(f'{f:22s} mean|d| {d.mean():5.2f}  p99 {np.percentile(d,99):5.1f}  >25: {(d>25).mean()*100:5.2f}%')
