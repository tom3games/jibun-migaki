# 緑背景を抜いて webp にする。~/tools/pyimg/bin/python art/key.py（Pillow と numpy）
import numpy as np, os
from PIL import Image, ImageFilter
D = os.path.dirname(os.path.abspath(__file__)); OUT = D + '/../img/'; RAW = D + '/../../_art_raw/jibun-migaki/raw/'
def key(src):
    a = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    k = g - np.maximum(r, b)
    al = 1 - np.clip((k - 2) / (40 - 2), 0, 1)
    lim = np.maximum(r, b); g = np.where(g > lim, lim, g)
    im = Image.fromarray(np.dstack([r, g, b, al * 255]).clip(0, 255).astype(np.uint8), 'RGBA')
    A = im.split()[3].filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7)); im.putalpha(A)
    return im
def save(im, n, q=80):
    im.save(OUT + n + '.webp', quality=q, method=6); print(n, im.size, os.path.getsize(OUT + n + '.webp') // 1024, 'KB')
def cells(sheet, cols, rows, names, mx=300, same=False):
    if not os.path.exists(RAW + sheet + '.png'): return
    it = key(RAW + sheet + '.png'); W, H = it.size
    cs = [it.crop((i % cols * W // cols, i // cols * H // rows, (i % cols + 1) * W // cols, (i // cols + 1) * H // rows)) for i in range(len(names))]
    def clean(c):  # 隣のセルからはみ出した部分（セルの左右の端に触れる列のかたまり）を消す
        a = np.asarray(c.split()[3]) > 40; cols = a.any(0); runs = []; i = 0; n = len(cols)
        while i < n:
            if cols[i]:
                j = i
                while j < n and cols[j]: j += 1
                runs.append((i, j)); i = j
            else: i += 1
        keep = [r for r in runs if r[0] > 0 and r[1] < n] or runs
        big = max(keep, key=lambda r: r[1] - r[0])
        keep = [r for r in keep if r[1] - r[0] > 0.08 * (big[1] - big[0])]
        m = np.zeros(n, bool)
        for a0, a1 in keep: m[a0:a1] = True
        arr = np.asarray(c).copy(); arr[:, ~m, 3] = 0
        return Image.fromarray(arr, 'RGBA')
    cs = [clean(c) for c in cs]
    if same:  # 段階の絵は同じ枠で切る（大きさがそろう）
        bs = [c.getbbox() for c in cs]; u = (min(b[0] for b in bs), min(b[1] for b in bs), max(b[2] for b in bs), max(b[3] for b in bs))
    for c, n in zip(cs, names):
        if not n: continue
        c = c.crop(u if same else c.getbbox()); c.thumbnail((mx, mx)); save(c, n, 82)
cells('items', 3, 3, ['o_bed', '', 'o_phone', 'o_apron', 'o_clothes', 'o_salon', 'o_skin', 'o_pig', 'o_mirror'])
def row(sheet, names, mx=320):
    # 1列のシートは、空の列で区切った塊を大きい順に4つ取り、小さい塊は近い塊にまとめる。全段階を同じ枠で切る
    it = key(RAW + sheet + '.png'); a = np.asarray(it.split()[3]) > 40; cols = a.any(0); n = len(cols); runs = []; i = 0
    while i < n:
        if cols[i]:
            j = i
            while j < n and cols[j]: j += 1
            runs.append([i, j]); i = j
        else: i += 1
    big = sorted(sorted(runs, key=lambda r: r[0] - r[1])[:len(names)])
    for r in runs:
        if r in big: continue
        g = min(big, key=lambda b: min(abs(r[0] - b[1]), abs(b[0] - r[1])))
        g[0] = min(g[0], r[0]); g[1] = max(g[1], r[1])
    crops = []
    for b in big:
        c = it.crop((b[0], 0, b[1], it.height)); crops.append(c)
    bb = [c.getbbox() for c in crops]; w = max(c.width for c in crops); top = min(x[1] for x in bb); bot = max(x[3] for x in bb)
    for c, nm in zip(crops, names):
        cv = Image.new('RGBA', (w, bot - top)); cv.paste(c.crop((0, top, c.width, bot)), ((w - c.width) // 2, 0)); cv.thumbnail((mx, mx)); save(cv, nm, 82)
row('shelf', ['shelf0', 'shelf1', 'shelf2', 'shelf3'])
row('rack', ['rack0', 'rack1', 'rack2', 'rack3'])
if os.path.exists(RAW + 'console.png'): c = key(RAW + 'console.png'); c = c.crop(c.getbbox()); c.thumbnail((240, 240)); save(c, 'o_game', 82)
if os.path.exists(RAW + 'room.png'): bg = Image.open(RAW + 'room.png').convert('RGB'); bg.thumbnail((800, 1200)); save(bg, 'room', 72)
P = ['futsuu', 'takane', 'imo', 'pillow', 'otaku', 'protein', 'narcis', 'prof', 'inteli', 'gal', 'rich', 'goukon', 'cat', 'robot', 'granny', 'nurse', 'gamer']
for n in P:
    if os.path.exists(RAW + n + '.png'):
        im = Image.open(RAW + n + '.png').convert('RGB'); im.thumbnail((640, 960)); save(im, 'p_' + n, 78)
        t = im.crop((0, 0, im.width, im.width)); t.thumbnail((200, 200)); save(t, 't_' + n, 74)
for n in ['me0', 'me1', 'me2']:
    if os.path.exists(RAW + n + '.png'):
        im = Image.open(RAW + n + '.png').convert('RGB'); w, h = im.size; im = im.crop((0, int(h * 0.04), w, int(h * 0.04) + w)); im.thumbnail((360, 360)); save(im, n, 78)
