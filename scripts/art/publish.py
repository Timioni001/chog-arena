import os, shutil, glob
from PIL import Image
SRC = os.path.dirname(os.path.abspath(__file__)) + '/out/'
DST = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'art') + '/'
for f in glob.glob(DST + '*.webp'): os.remove(f)
for f in sorted(os.listdir(SRC)):
    if f.startswith('hero-'):
        im = Image.open(SRC + f).convert('RGB')
        if im.width > 1400: im = im.resize((1400, round(im.height * 1400 / im.width)), Image.LANCZOS)
        im.save(DST + f, 'WEBP', quality=80, method=6)
    else:
        shutil.copy(SRC + f, DST + f)
tot = sum(os.path.getsize(DST + f) for f in os.listdir(DST))
print(len(os.listdir(DST)), 'files', tot // 1024, 'KB')
for f in sorted(os.listdir(DST)):
    if f.startswith('hero-'): print(f, Image.open(DST + f).size)
