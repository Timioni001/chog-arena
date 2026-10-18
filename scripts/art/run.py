import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spec import SPEC, U
from up import upscale4
from PIL import Image, ImageFilter
from rembg import remove, new_session
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out') + '/'
os.makedirs(OUT, exist_ok=True); os.makedirs(os.path.join(HERE, 'up'), exist_ok=True)
rs = None
def up(img, key):
    p = os.path.join(HERE, 'up', f'{key}.png')
    if os.path.exists(p): return Image.open(p)
    r = upscale4(img); r.save(p); return r
def save(img, name, w=None, q=86):
    if w and img.width > w: img = img.resize((w, round(img.height * w / img.width)), Image.LANCZOS)
    img.save(OUT + name, 'WEBP', quality=q, method=6)
    print('saved', name, img.size, os.path.getsize(OUT + name) // 1024, 'KB', flush=True)
def cut(img, name, maxh):
    global rs
    if rs is None: rs = new_session('isnet-general-use')
    m = remove(img, session=rs, post_process_mask=True)
    bb = m.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
    m = m.crop(bb)
    pad = int(m.height * 0.03)
    c = Image.new('RGBA', (m.width + 2 * pad, m.height + 2 * pad), (0, 0, 0, 0)); c.paste(m, (pad, pad))
    if c.height > maxh: c = c.resize((round(c.width * maxh / c.height), maxh), Image.LANCZOS)
    c.save(OUT + name, 'WEBP', quality=88, method=6, exact=False)
    print('saved', name, c.size, flush=True)
only = sys.argv[1:] or list(SPEC)
for sid in only:
    s = SPEC[sid]
    im = Image.open(U + s['sheet'] + '-image.png').convert('RGB')
    f = up(im.crop(s['front']), f'{sid}-front')
    cut(f, f'cut-{sid}.webp', 900)
    for name, b in s['emotes']:
        e = up(im.crop(b), f'{sid}-emote-{name}')
        save(e, f'emote-{sid}-{name}.webp', 320)
    h = up(im.crop(s['hero']), f'{sid}-hero')
    save(h, f'hero-{sid}.webp', 1600, 84)
    for i, b in enumerate(s['story']):
        st = up(im.crop(b), f'{sid}-story-{i+1}')
        save(st, f'story-{sid}-{i+1}.webp', 640 if st.height > st.width * 0.8 else 1120, 84)
print('DONE', flush=True)
