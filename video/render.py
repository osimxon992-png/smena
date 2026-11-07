# Smena reklama videosi: 30 soniya, 1080×1920 (Reels, TikTok, Telegram), 30 kadr/s.
# Sayt uslubida: karton fon, ipda osilgan qog'oz narx yorliqlari, Permanent Marker sarlavhalar.
# Kadrlar Pillow'da chiziladi (bir nechta jarayonda), H.264 MP4 — h264mp4.py orqali.
#   python3 render.py            → smena-video.mp4 va smena-video-muqova.png
#   python3 render.py kadr 1.2 6.9     → tanlangan soniyalardagi kadrlar PNG (tekshirish uchun)
#   python3 render.py ovoz [bozor|quvnoq] [fayl.mp4] → ovozni (audio.py) qayta yasab, tayyor videoga qo'yadi
import math
import os
import sys
import time
from functools import lru_cache
from multiprocessing import Pool

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageFont

W, H, FPS, DUR = 1080, 1920, 30, 30.0
HERE = os.path.dirname(os.path.abspath(__file__))

KRAFT, KRAFT_DEEP, KRAFT_DARK, KRAFT_LIGHT = '#C99A5B', '#A57638', '#5E3F1C', '#E2C592'
INK, INK_SOFT, PAPER, PAPER_SHADE, PAPER_INK = '#18160F', '#3B3123', '#F6F0E1', '#E8DDC4', '#5A4E3C'
RED, TEAL, TWINE, CREAM = '#C2321A', '#1F6F80', '#4E3820', '#EFE4CC'
SS = 2  # shakllar silliq chiqishi uchun 2 barobar kattada chizilib, kichraytiriladi


# --- Shriftlar va yordamchilar ---

@lru_cache(None)
def marker(size):
    return ImageFont.truetype(f'{HERE}/fonts/PermanentMarker.woff2', size)


@lru_cache(None)
def onest(size, weight=800, script='latin'):
    f = ImageFont.truetype(f'{HERE}/fonts/Onest-{script}.woff2', size)
    f.set_variation_by_axes([weight])
    return f


def mixed(parts, fill):
    """Bir qatorda bir nechta shrift (masalan, lotin va kirill qismlari): umumiy tayanch chiziqda."""
    width = sum(f.getlength(t) for t, f in parts)
    asc = max(f.getmetrics()[0] for _, f in parts)
    desc = max(f.getmetrics()[1] for _, f in parts)
    img = Image.new('RGBA', (math.ceil(width) + 8, asc + desc + 8), (0, 0, 0, 0))
    d, x = ImageDraw.Draw(img), 4
    for t, f in parts:
        d.text((x, 4 + asc), t, font=f, fill=fill, anchor='ls')
        x += f.getlength(t)
    return img.crop(img.getbbox())


def clamp(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x


def prog(t, a, b):
    return clamp((t - a) / (b - a))


def out_cubic(p):
    return 1 - (1 - p) ** 3


def in_out(p):
    return 4 * p ** 3 if p < 0.5 else 1 - (-2 * p + 2) ** 3 / 2


def out_back(p, s=1.7):
    p -= 1
    return 1 + (s + 1) * p ** 3 + s * p ** 2


def swing(t, amp, freq=1.0, damp=2.6, phase=0.0):
    """Ipdagi yorliqning so'nuvchi tebranishi (gradus). Juda kichik burchak 0: yorliq aniq (xiralashmasdan) chiqadi."""
    if t < 0:
        return 0.0
    a = amp * math.exp(-damp * t) * math.cos(2 * math.pi * freq * t + phase)
    return 0.0 if abs(a) < 0.06 else a


def put(frame, spr, x, y, op=1.0, scale=1.0, rot=0.0, anchor='mm'):
    """Sprayt (RGBA) ni kadrga qo'yadi: shaffoflik, kattalik va burilish bilan; anchor — 'lt', 'mm', 'rb' ..."""
    if op <= 0.003 or scale <= 0.01:
        return
    s = spr
    if abs(scale - 1) > 0.002:
        s = s.resize((max(1, round(s.width * scale)), max(1, round(s.height * scale))), Image.BICUBIC)
    if abs(rot) > 0.01:
        s = s.rotate(rot, resample=Image.BICUBIC, expand=True)
    if op < 0.997:
        s = s.copy()
        s.putalpha(s.getchannel('A').point(lambda v: int(v * op)))
    ax = {'l': 0, 'm': s.width / 2, 'r': s.width}[anchor[0]]
    ay = {'t': 0, 'm': s.height / 2, 'b': s.height}[anchor[1]]
    frame.paste(s, (round(x - ax), round(y - ay)), s)


def text(t, font, fill, spacing=0):
    """Matn spraytı (RGBA, aniq o'lchamda). spacing — harflar orasidagi qo'shimcha masofa (yorliqlar uchun)."""
    if spacing:
        widths = [font.getlength(c) for c in t]
        asc, desc = font.getmetrics()
        img = Image.new('RGBA', (math.ceil(sum(widths) + spacing * (len(t) - 1)) + 4, asc + desc + 4), (0, 0, 0, 0))
        d, x = ImageDraw.Draw(img), 2
        for c, w in zip(t, widths):
            d.text((x, 2), c, font=font, fill=fill)
            x += w + spacing
        return img.crop(img.getbbox())
    l, tp, r, b = font.getbbox(t)
    img = Image.new('RGBA', (r - l + 8, b - tp + 8), (0, 0, 0, 0))
    ImageDraw.Draw(img).text((4 - l, 4 - tp), t, font=font, fill=fill)
    return img


def stack(sprites, gap=12, align='m'):
    w = max(s.width for s in sprites)
    h = sum(s.height for s in sprites) + gap * (len(sprites) - 1)
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    y = 0
    for s in sprites:
        x = {'l': 0, 'm': (w - s.width) // 2, 'r': w - s.width}[align]
        img.paste(s, (x, y), s)
        y += s.height + gap
    return img


def wrap(t, font, width):
    words, lines = t.split(), ['']
    for w in words:
        trial = f'{lines[-1]} {w}'.strip()
        if font.getlength(trial) <= width or not lines[-1]:
            lines[-1] = trial
        else:
            lines.append(w)
    return lines


def ss_canvas(w, h):
    img = Image.new('RGBA', (w * SS, h * SS), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def down(img, w, h):
    return img.resize((w, h), Image.LANCZOS)


def shadow_of(spr, blur=16, dx=8, dy=22, alpha=0.42, pad=60):
    """Spraytning soyasi bilan birga yangi sprayt (soya pastroqda); qaytaradi: (sprayt, spraytning chap-yuqori nuqtasi)."""
    w, h = spr.width + 2 * pad, spr.height + 2 * pad
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    a = Image.new('L', (w, h), 0)
    a.paste(spr.getchannel('A'), (pad + dx, pad + dy))
    a = a.filter(ImageFilter.GaussianBlur(blur)).point(lambda v: int(v * alpha))
    out.paste(Image.new('RGBA', (w, h), (40, 22, 6, 255)), (0, 0), a)
    out.paste(spr, (pad, pad), spr)
    return out, (pad, pad)


# --- Fonlar ---

@lru_cache(None)
def background(color, grain=16, vignette=0.16, fibres=True):
    base = Image.new('RGB', (W, H), color)
    n = Image.blend(Image.effect_noise((W // 3, H // 3), 48).resize((W, H), Image.BICUBIC), Image.effect_noise((W, H), 36), 0.55)
    light = n.point(lambda v: max(0, v - 128) * grain // 100)
    dark = n.point(lambda v: max(0, 128 - v) * grain // 100)
    img = ImageChops.subtract(ImageChops.add(base, Image.merge('RGB', [light] * 3)), Image.merge('RGB', [dark] * 3))
    if fibres:
        import random
        rnd = random.Random(7)
        layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        for _ in range(1400):
            x, y, ln = rnd.randrange(W), rnd.randrange(H), rnd.randrange(12, 46)
            ang = math.radians(rnd.uniform(-12, 12) + 97)
            c = (255, 245, 220, rnd.randrange(14, 30)) if rnd.random() < 0.5 else (60, 35, 10, rnd.randrange(14, 30))
            d.line([(x, y), (x + ln * math.cos(ang), y + ln * math.sin(ang))], fill=c, width=1)
        img = Image.alpha_composite(img.convert('RGBA'), layer).convert('RGB')
    if vignette:
        g = Image.radial_gradient('L').resize((int(W * 1.5), int(H * 1.25)), Image.BICUBIC)
        g = g.crop(((g.width - W) // 2, (g.height - H) // 2, (g.width - W) // 2 + W, (g.height - H) // 2 + H))
        mask = g.point(lambda v: int(clamp((v - 110) / 145) ** 1.5 * 255))
        img = Image.composite(ImageEnhance.Brightness(img).enhance(1 - vignette * 2), img, mask)
    return img


def twine_y(x, y0, sag):
    return y0 + sag * math.sin(math.pi * x / W)


def twine(frame, y0, sag=24, reveal=1.0):
    d = ImageDraw.Draw(frame)
    xs = [x for x in range(-20, int((W + 40) * reveal) - 20 + 1, 24)]
    if len(xs) > 1:
        pts = [(x, twine_y(x, y0, sag)) for x in xs]
        d.line(pts, fill=TWINE, width=7, joint='curve')
        d.line([(x, y - 2) for x, y in pts], fill='#6B4E2E', width=2)


def string(frame, top, bottom):
    ImageDraw.Draw(frame).line([top, bottom], fill=TWINE, width=4)


# --- Ikonkalar (2× chizilib kichraytiriladi) ---

def icon(kind, s, color, bg=(0, 0, 0, 0)):
    img, d = ss_canvas(s, s)
    k = s * SS
    P = lambda *xy: [(x * k, y * k) for x, y in zip(xy[::2], xy[1::2])]
    if kind == 'pin':
        r = 0.27
        d.polygon(P(0.5 - r * 0.92, 0.47, 0.5 + r * 0.92, 0.47, 0.5, 0.96), fill=color)
        d.ellipse([(0.5 - r) * k, (0.38 - r) * k, (0.5 + r) * k, (0.38 + r) * k], fill=color)
        d.ellipse([(0.5 - r * 0.42) * k, (0.38 - r * 0.42) * k, (0.5 + r * 0.42) * k, (0.38 + r * 0.42) * k], fill=bg)
    elif kind == 'flame':
        d.ellipse([0.22 * k, 0.42 * k, 0.78 * k, 0.96 * k], fill=color)
        d.polygon(P(0.22, 0.66, 0.78, 0.66, 0.66, 0.36, 0.56, 0.04, 0.44, 0.3, 0.34, 0.24, 0.26, 0.52), fill=color)
        d.ellipse([0.37 * k, 0.62 * k, 0.63 * k, 0.9 * k], fill=KRAFT_LIGHT)
        d.polygon(P(0.37, 0.76, 0.63, 0.76, 0.55, 0.5), fill=KRAFT_LIGHT)
    elif kind == 'people':
        for cx, cy, r in [(0.35, 0.3, 0.14), (0.68, 0.36, 0.115)]:
            d.ellipse([(cx - r) * k, (cy - r) * k, (cx + r) * k, (cy + r) * k], fill=color)
        d.pieslice([0.08 * k, 0.5 * k, 0.62 * k, 1.04 * k], 180, 360, fill=color)
        d.pieslice([0.5 * k, 0.53 * k, 0.94 * k, 0.97 * k], 180, 360, fill=color)
    elif kind == 'money':
        d.rounded_rectangle([0.06 * k, 0.24 * k, 0.94 * k, 0.76 * k], radius=0.08 * k, fill=color)
        d.ellipse([0.37 * k, 0.37 * k, 0.63 * k, 0.63 * k], fill=bg)
        for cx in (0.18, 0.82):
            d.ellipse([(cx - 0.045) * k, 0.455 * k, (cx + 0.045) * k, 0.545 * k], fill=bg)
    elif kind == 'mic':
        d.rounded_rectangle([0.35 * k, 0.06 * k, 0.65 * k, 0.6 * k], radius=0.15 * k, fill=color)
        d.arc([0.22 * k, 0.26 * k, 0.78 * k, 0.74 * k], 0, 180, fill=color, width=round(0.07 * k))
        d.line([(0.5 * k, 0.74 * k), (0.5 * k, 0.9 * k)], fill=color, width=round(0.07 * k))
        d.line([(0.3 * k, 0.92 * k), (0.7 * k, 0.92 * k)], fill=color, width=round(0.07 * k))
    elif kind == 'plane':
        d.polygon(P(0.06, 0.47, 0.94, 0.1, 0.76, 0.9, 0.46, 0.66), fill=color)
        d.polygon(P(0.4, 0.62, 0.94, 0.1, 0.46, 0.66, 0.42, 0.86), fill=color)
        d.line([(0.4 * k, 0.62 * k), (0.86 * k, 0.18 * k)], fill=bg, width=round(0.04 * k))
    elif kind == 'check':
        d.line([(0.16 * k, 0.52 * k), (0.4 * k, 0.76 * k), (0.86 * k, 0.24 * k)], fill=color, width=round(0.16 * k), joint='curve')
    elif kind == 'star':
        pts = []
        for i in range(10):
            r = 0.48 if i % 2 == 0 else 0.2
            a = math.pi / 2 + i * math.pi / 5
            pts += [0.5 + r * math.cos(a), 0.54 - r * math.sin(a)]
        d.polygon(P(*pts), fill=color)
    return down(img, s, s)


# --- Shakllar: yorliq, pufakcha, tugma, muhr ---

def tag(w, h, content, hole_y=46, cut=0.17, paper=PAPER, after=None, sh=True):
    """Ipga osiladigan narx yorlig'i. Qaytaradi: (sprayt, R) — sprayt kvadrat, teshik (aylanish nuqtasi) markazida."""
    img, d = ss_canvas(w, h)
    c = int(w * cut) * SS
    d.polygon([(c, 0), (w * SS - c, 0), (w * SS, c), (w * SS, h * SS), (0, h * SS), (0, c)], fill=paper)
    hx, hy = w * SS // 2, hole_y * SS
    d.ellipse([hx - 24 * SS, hy - 24 * SS, hx + 24 * SS, hy + 24 * SS], fill=KRAFT_DEEP)
    d.ellipse([hx - 15 * SS, hy - 15 * SS, hx + 15 * SS, hy + 15 * SS], fill=KRAFT_DARK)
    content(d, SS)
    img = down(img, w, h)
    if after:
        after(img)  # aniq piksellarda chiziladigan narsa (QR kod)
    if sh:
        img, (ox, oy) = shadow_of(img, blur=18, dx=10, dy=26, alpha=0.45, pad=70)
    else:
        ox = oy = 0
    px, py = ox + w / 2, oy + hole_y
    R = math.ceil(max(math.hypot(x - px, y - py) for x in (0, img.width) for y in (0, img.height)))
    sq = Image.new('RGBA', (2 * R, 2 * R), (0, 0, 0, 0))
    sq.paste(img, (round(R - px), round(R - py)), img)
    return sq, R


def hang(frame, spr_R, px, py, angle=0.0):
    spr, R = spr_R
    s = spr.rotate(angle, resample=Image.BICUBIC) if angle else spr
    frame.paste(s, (round(px - R), round(py - R)), s)


def ctext(d, k, x, y, t, font, fill, anchor='mt'):
    d.text((x * k, y * k), t, font=font, fill=fill, anchor=anchor)


def pill(t, font, fg, bg, padx=34, pady=20, outline=None, ow=4, ic=None):
    tw = font.getlength(t)
    asc, desc = font.getmetrics()
    th = asc + desc
    iw = th if ic else 0
    w, h = int(tw + iw + (14 if ic else 0) + 2 * padx), th + 2 * pady
    img, d = ss_canvas(w, h)
    d.rounded_rectangle([0, 0, w * SS - 1, h * SS - 1], radius=h * SS // 2, fill=bg, outline=outline, width=ow * SS if outline else 0)
    img = down(img, w, h)
    x = padx
    if ic:
        i = icon(ic, int(th * 0.9), fg)
        img.paste(i, (x, (h - i.height) // 2), i)
        x += iw + 14
    ImageDraw.Draw(img).text((x, pady), t, font=font, fill=fg)
    return img


def bubble(t, right, name=None, name_color=KRAFT_LIGHT):
    font, nf = onest(40, 500), onest(30, 800)
    lines = wrap(t, font, 700)
    lh = 52
    tw = max(font.getlength(l) for l in lines)
    if name:
        tw = max(tw, nf.getlength(name))
    w = int(tw + 64)
    h = 36 + (44 if name else 0) + lh * len(lines) + 12
    img, d = ss_canvas(w, h)
    r = 34 * SS
    d.rounded_rectangle([0, 0, w * SS, h * SS], radius=r, fill=TEAL if right else '#3A352B')
    # "dum": pufakchaning pastki burchagi to'g'ri
    if right:
        d.rectangle([w * SS - r, h * SS - r, w * SS, h * SS], fill=TEAL)
    else:
        d.rectangle([0, h * SS - r, r, h * SS], fill='#3A352B')
    img = down(img, w, h)
    d = ImageDraw.Draw(img)
    y = 22
    if name:
        d.text((32, y), name, font=nf, fill=name_color)
        y += 44
    for l in lines:
        d.text((32, y), l, font=font, fill=PAPER)
        y += lh
    return img


def stamp(t, font, color, pad=(40, 18), border=7, rough=True):
    tw = font.getlength(t)
    asc, desc = font.getmetrics()
    w, h = int(tw + 2 * pad[0]), asc + desc + 2 * pad[1]
    img, d = ss_canvas(w, h)
    d.rounded_rectangle([border * SS // 2, border * SS // 2, w * SS - border * SS // 2, h * SS - border * SS // 2],
                        radius=14 * SS, outline=color, width=border * SS)
    img = down(img, w, h)
    ImageDraw.Draw(img).text((pad[0], pad[1]), t, font=font, fill=color)
    if rough:
        # Muhr bo'yog'i notekis: shaffoflikka mayda shovqin
        n = Image.effect_noise(img.size, 70).point(lambda v: 255 if v > 70 else 120)
        img.putalpha(ImageChops.multiply(img.getchannel('A'), n))
    return img


def panel(w, h, fill, radius=22, outline=None, ow=0):
    img, d = ss_canvas(w, h)
    d.rounded_rectangle([0, 0, w * SS - 1, h * SS - 1], radius=radius * SS, fill=fill, outline=outline, width=ow * SS)
    return down(img, w, h)


# --- QR kod (qr/smena-qr.png dan modullar o'qiladi va aniq piksellarda qayta chiziladi) ---

@lru_cache(None)
def qr_modules():
    im = Image.open(os.path.join(HERE, '..', 'qr', 'smena-qr.png')).convert('L')
    bw = im.point(lambda v: 255 if v < 128 else 0)
    l, t, r, b = bw.getbbox()
    run = 0
    while im.getpixel((l + run, t)) < 128:
        run += 1
    mod = run / 7  # chap-yuqori qidiruv belgisi 7 modul
    n = round((r - l) / mod)
    return [[im.getpixel((int(l + (x + 0.5) * mod), int(t + (y + 0.5) * mod))) < 128 for x in range(n)] for y in range(n)]


def draw_qr(img, x0, y0, module, quiet=3):
    rows = qr_modules()
    n = len(rows)
    side = (n + 2 * quiet) * module
    d = ImageDraw.Draw(img)
    d.rectangle([x0, y0, x0 + side - 1, y0 + side - 1], fill='#FFFFFF')
    for y, row in enumerate(rows):
        for x, on in enumerate(row):
            if on:
                X, Y = x0 + (x + quiet) * module, y0 + (y + quiet) * module
                d.rectangle([X, Y, X + module - 1, Y + module - 1], fill=INK)
    return side


# --- Spraytlar (har jarayonda bir marta tayyorlanadi) ---

@lru_cache(None)
def A():
    a = {}
    # 1-sahna: logotip yorlig'i
    def logo(d, k):
        f = marker(200 * k)
        tw, dw = d.textlength('Smena', font=f), d.textlength('.', font=f)
        x0 = (760 * k - tw - dw) / 2
        d.text((x0, 150 * k), 'Smena', font=f, fill=INK)
        d.text((x0 + tw, 150 * k), '.', font=f, fill=RED)
        for x in range(70, 690, 30):
            d.line([(x * k, 470 * k), ((x + 16) * k, 470 * k)], fill=PAPER_SHADE, width=4 * k)
        ctext(d, k, 380, 505, 'Bir kunlik ish platformasi', onest(44 * k, 800), INK_SOFT)
        ctext(d, k, 380, 572, 'to‘yxona · restoran · ombor', onest(36 * k, 600), PAPER_INK)
    a['logo'] = tag(760, 660, logo)
    a['i_l1'] = text('Haqi, vaqti va joyi —', onest(66, 800), INK)
    a['i_l2'] = text('oldindan ochiq yozilgan', onest(66, 800), INK)
    a['i_chips'] = [pill(t, onest(38, 700), PAPER, INK) for t in ('Studentlar', 'Ishchilar', 'Bizneslar')]

    # 2-sahna: muammo
    a['p_label'] = text('MUAMMO', onest(34, 800), KRAFT_LIGHT, spacing=8)
    a['p_head'] = stack([text('Bir kunlik ishni', marker(100), PAPER), text('qanday topasiz?', marker(100), PAPER)], gap=4)
    a['p_bub'] = [
        (bubble('Ertaga to‘yga 5 ta ofitsiant kerak!!!', False, 'Aziz'), False),
        (bubble('Haqi qancha?', True), True),
        (bubble('Kecha “kelaman” degan bola kelmadi', False, 'Sardor', '#F2A08F'), False),
        (bubble('Pulni qachon berishadi? O‘tgan safar bermadi', False, 'Jasur', '#F2A08F'), False),
        (bubble('Javob yo‘q...', True), True),
    ]
    a['p_stamp'] = stamp('TASODIF', marker(150), RED, pad=(48, 14), border=9)
    a['p_sub'] = stack([text('Ishchi — ishsiz,', onest(56, 800), PAPER), text('biznes — odamsiz qoladi.', onest(56, 800), PAPER)], gap=6)

    # 3-sahna: yechim — narx yorliqlari
    a['s_label'] = text('YECHIM: SMENA', onest(34, 800), INK, spacing=8)
    a['s_head'] = stack([text('Har bir ish —', marker(82), INK), text('narx yorlig‘idek ochiq', marker(82), INK)], gap=6)

    def price(title, pay, day, hours, left):
        def c(d, k):
            ctext(d, k, 150, 86, title, onest(34 * k, 800), INK)
            ctext(d, k, 150, 134, pay, marker(64 * k), RED)
            ctext(d, k, 150, 214, 'so‘m', onest(30 * k, 700), PAPER_INK)
            ctext(d, k, 150, 262, day, onest(30 * k, 700), TEAL)
            ctext(d, k, 150, 300, hours, onest(30 * k, 700), TEAL)
            ctext(d, k, 150, 350, left, onest(26 * k, 600), PAPER_INK)
        return tag(300, 404, c, hole_y=40)
    a['s_tags'] = [price('Ofitsiant', '250 000', 'Bugun', '18:00–23:00', '3 joy qoldi'),
                   price('Yuk tashuvchi', '180 000', 'Ertaga', '08:00–14:00', '2 joy qoldi'),
                   price('Kassir', '200 000', 'Shanba', '09:00–18:00', '1 joy qoldi')]
    a['s_cap'] = stack([text('Lavozim, haq va vaqt —', onest(56, 800), INK), text('hammasi oldindan yozilgan', onest(56, 800), INK)], gap=8)
    a['s_btn'] = pill('Ariza berish', onest(48, 800), PAPER, INK, padx=60, pady=28)
    a['s_btn_ok'] = pill('Ariza yuborildi', onest(48, 800), PAPER, TEAL, padx=56, pady=28, ic='check')

    # 4-sahna: qanday ishlaydi
    a['h_label'] = text('QANDAY ISHLAYDI', onest(34, 800), TEAL, spacing=8)
    a['h_head'] = stack([text('Biznes tanlaydi,', marker(92), INK), text('ishchi keladi', marker(92), INK)], gap=4)
    card = panel(940, 960, PAPER, radius=20)
    d = ImageDraw.Draw(card)
    d.text((44, 40), 'Ofitsiant', font=onest(54, 800), fill=INK)
    d.text((44, 104), '250 000 so‘m', font=marker(62), fill=RED)
    d.text((44, 192), 'Shanba, 18:00–23:00', font=onest(36, 700), fill=TEAL)
    a['h_card'] = shadow_of(card, blur=20, dx=8, dy=26, alpha=0.35, pad=70)[0]
    people = [('Dilnoza', '22 yosh', '4.9', TEAL), ('Sardor', '25 yosh', '4.7', RED), ('Jasur', '19 yosh', None, KRAFT_DARK), ('Malika', '27 yosh', '5.0', KRAFT_DEEP)]
    rows = []
    for name, age, rating, color in people:
        r = panel(852, 128, '#FFFDF7', radius=16, outline=INK, ow=3)
        av, ad = ss_canvas(84, 84)
        ad.ellipse([0, 0, 84 * SS - 1, 84 * SS - 1], fill=color)
        av = down(av, 84, 84)
        ImageDraw.Draw(av).text((42, 44), name[0], font=onest(40, 800), fill=PAPER, anchor='mm')
        r.paste(av, (22, 22), av)
        rd = ImageDraw.Draw(r)
        rd.text((128, 18), name, font=onest(40, 800), fill=INK)
        sub = f'{age} · '
        sf = onest(30, 600)
        rd.text((128, 72), sub, font=sf, fill=PAPER_INK)
        x = 128 + sf.getlength(sub)
        if rating:
            st = icon('star', 28, RED)
            r.paste(st, (int(x), 76), st)
            rd.text((x + 34, 72), rating, font=sf, fill=PAPER_INK)
        else:
            rd.text((x, 72), 'yangi', font=sf, fill=PAPER_INK)
        rows.append(r)
    a['h_rows'] = rows
    a['h_chip'] = {
        'ariza': pill('Ariza', onest(32, 800), PAPER_INK, '#FFFDF7', padx=22, pady=10, outline=PAPER_INK, ow=4),
        'qabul': pill('Qabul', onest(32, 800), TEAL, '#FFFDF7', padx=22, pady=10, outline=TEAL, ow=4),
        'keldi': pill('Keldi', onest(32, 800), PAPER, TEAL, padx=22, pady=10, ic='check'),
        'joy': pill('Joy yo‘q', onest(32, 800), RED, '#FFFDF7', padx=22, pady=10, outline=RED, ow=4),
    }
    a['h_steps'] = [text(t, onest(44, 800), INK) for t in ('1. Ishchilar ariza beradi', '2. Biznes eng yaxshisini tanlaydi', '3. Smena kuni: «Keldim» va baho')]
    a['h_stamp'] = stamp('Kelmagan — bloklanadi', marker(62), RED, pad=(40, 12), border=8)
    a['h_count'] = [text(f'{n}/3 joy band', onest(32, 700), PAPER_INK) for n in range(4)]

    # 5-sahna: imkoniyatlar
    a['f_label'] = text('YANA', onest(34, 800), '#CFE3E6', spacing=8)
    a['f_head'] = text('Yana nimalar bor?', marker(88), PAPER)
    feats = [('pin', 'Xarita', 'yaqin smenalar va yo‘l'), ('flame', 'Shoshilinch', 'yaqindagilarga darhol xabar'),
             ('people', 'Brigada', 'do‘stlar bilan birga ariza'), ('money', 'Haqimni oldim', 'kim o‘z vaqtida to‘laydi'),
             ('mic', 'Farbo', 'ovozli AI yordamchi'), ('plane', 'Telegram', 'kod va eslatmalar botda')]
    cards = []
    for i, (ic, title, sub) in enumerate(feats):
        dark = ic == 'mic'
        c = panel(455, 330, INK if dark else PAPER, radius=18)
        ico = icon(ic, 92, KRAFT_LIGHT if dark else RED, bg=(0, 0, 0, 0))
        c.paste(ico, (36, 34), ico)
        cd = ImageDraw.Draw(c)
        cd.text((36, 150), title, font=onest(46, 800), fill=PAPER if dark else INK)
        for j, line in enumerate(wrap(sub, onest(32, 600), 390)):
            cd.text((36, 214 + j * 42), line, font=onest(32, 600), fill='#D9CDB4' if dark else PAPER_INK)
        cards.append(shadow_of(c, blur=14, dx=6, dy=18, alpha=0.4, pad=50)[0])
    a['f_cards'] = cards
    a['f_lang'] = mixed([('O‘zbek · ', onest(44, 700)), ('Русский', onest(44, 700, 'cyrillic')), (' · English', onest(44, 700))], PAPER)

    # 6-sahna: yakun — QR kodli yorliq
    def end(d, k):
        f = marker(140 * k)
        tw, dw = d.textlength('Smena', font=f), d.textlength('.', font=f)
        x0 = (820 * k - tw - dw) / 2
        d.text((x0, 92 * k), 'Smena', font=f, fill=INK)
        d.text((x0 + tw, 92 * k), '.', font=f, fill=RED)
        ctext(d, k, 410, 868, 'Skanerlang va smena tanlang', onest(42 * k, 800), INK)

    def qr(img):
        side = (len(qr_modules()) + 6) * 15
        draw_qr(img, (820 - side) // 2, 300, 15)
    a['end'] = tag(820, 960, end, hole_y=48, after=qr)
    a['e_url'] = text('smena-uzb.vercel.app', onest(64, 800), INK)
    a['e_bot'] = text('Telegram: @smenauzbbot', onest(44, 700), INK_SOFT)
    a['e_pill'] = pill('Ro‘yxatdan o‘tish — bepul', onest(44, 800), PAPER, RED, padx=44, pady=24)
    return a


# --- Sahnalar (t — sahnaning o'z vaqti, soniya) ---

def s_intro(t):
    a, f = A(), background(KRAFT).copy()
    twine(f, 235, 22)
    ang = swing(t, 9.0, freq=0.85, damp=1.5)
    string(f, (540, twine_y(540, 235, 22)), (540, 372))
    hang(f, a['logo'], 540, 372, ang)
    for i, key in enumerate(('i_l1', 'i_l2')):
        p = out_cubic(prog(t, 0.55 + i * 0.22, 1.15 + i * 0.22))
        put(f, a[key], 540, 1150 + i * 92 + 40 * (1 - p), op=p)
    chips = a['i_chips']
    total = sum(c.width for c in chips) + 24 * (len(chips) - 1)
    x = (W - total) / 2
    for i, c in enumerate(chips):
        p = prog(t, 1.35 + i * 0.16, 1.75 + i * 0.16)
        put(f, c, x + c.width / 2, 1440, op=min(1, p * 2), scale=0.6 + 0.4 * out_back(p))
        x += c.width + 24
    return f


BUB_T = [0.6, 1.05, 1.5, 1.95, 2.4]


def s_problem(t):
    a, f = A(), background(INK, grain=10, vignette=0.12, fibres=False).copy()
    p = out_cubic(prog(t, 0.2, 0.6))
    put(f, a['p_label'], 540, 200, op=p)
    p = out_cubic(prog(t, 0.3, 0.8))
    put(f, a['p_head'], 540, 250 + 40 * (1 - p), op=p, anchor='mt')
    # Pufakchalar ketma-ket chiqadi; muhr tushganda silkinadi
    shake = 0.0
    if t > 3.25:
        shake = 14 * math.exp(-9 * (t - 3.25)) * math.sin(2 * math.pi * 11 * (t - 3.25))
    y = 560
    for (spr, right), t0 in zip(a['p_bub'], BUB_T):
        p = prog(t, t0, t0 + 0.32)
        if p > 0:
            sc = 0.82 + 0.18 * out_back(p)
            if right:
                put(f, spr, W - 70 + shake, y + spr.height, op=min(1, p * 2.5), scale=sc, anchor='rb')
            else:
                put(f, spr, 70 + shake, y + spr.height, op=min(1, p * 2.5), scale=sc, anchor='lb')
        y += spr.height + 26
    p = prog(t, 3.15, 3.45)
    if p > 0:
        dim = Image.new('RGB', (W, H), INK)
        f = Image.blend(f, dim, 0.45 * out_cubic(p))
        put(f, a['p_stamp'], 540, 1080, op=min(1, p * 3), scale=1.9 - 0.9 * out_cubic(p), rot=8)
    p = out_cubic(prog(t, 3.75, 4.25))
    put(f, a['p_sub'], 540, 1505 + 30 * (1 - p), op=p, anchor='mt')
    return f


TAG_X = [195, 540, 885]
TAG_STR = [120, 230, 160]
TAG_T = [0.7, 1.0, 1.3]


def s_solution(t):
    a, f = A(), background(KRAFT).copy()
    p = out_cubic(prog(t, 0.2, 0.6))
    put(f, a['s_label'], 540, 165, op=p)
    p = out_cubic(prog(t, 0.3, 0.8))
    put(f, a['s_head'], 540, 215 + 40 * (1 - p), op=p, anchor='mt')
    twine(f, 520, 26, reveal=out_cubic(prog(t, 0.35, 0.9)))
    for i, (x, ln, t0) in enumerate(zip(TAG_X, TAG_STR, TAG_T)):
        if t < t0:
            continue
        top = twine_y(x, 520, 26)
        rest = top + ln
        p = prog(t, t0, t0 + 0.5)
        py = -400 + (rest + 400) * out_back(p, 1.2)
        ang = swing(t - t0 - 0.35, 7 if i % 2 == 0 else -7, freq=1.05, damp=2.2, phase=-math.pi / 2) if p >= 0.7 else 0.0
        if py > top:
            string(f, (x, top), (x, py))
        hang(f, a['s_tags'][i], x, py, ang)
    p = out_cubic(prog(t, 2.2, 2.7))
    put(f, a['s_cap'], 540, 1290 + 30 * (1 - p), op=p, anchor='mt')
    # "Ariza berish" bosiladi
    p = prog(t, 3.0, 3.35)
    if p > 0:
        press = 1 - 0.06 * math.sin(math.pi * prog(t, 3.75, 3.95))
        btn = a['s_btn_ok'] if t >= 3.88 else a['s_btn']
        put(f, btn, 540, 1550, op=min(1, p * 2), scale=(0.6 + 0.4 * out_back(p)) * press)
        q = prog(t, 3.78, 4.4)
        if 0 < q < 1:
            ring = Image.new('RGBA', (W, H), (0, 0, 0, 0))
            r = 70 + 190 * out_cubic(q)
            ImageDraw.Draw(ring).ellipse([540 - r, 1550 - r, 540 + r, 1550 + r], outline=(31, 111, 128, int(200 * (1 - q))), width=10)
            f.paste(ring, (0, 0), ring)
    return f


ROW_T = [0.6, 0.85, 1.1, 1.35]
ACCEPT = {0: 2.0, 1: 2.35, 3: 2.7}
CAME = {0: 3.6, 1: 3.8, 3: 4.0}


def s_how(t):
    a, f = A(), background(CREAM, grain=12).copy()
    p = out_cubic(prog(t, 0.2, 0.6))
    put(f, a['h_label'], 540, 165, op=p)
    p = out_cubic(prog(t, 0.3, 0.8))
    put(f, a['h_head'], 540, 215 + 40 * (1 - p), op=p, anchor='mt')
    p = out_cubic(prog(t, 0.25, 0.75))
    cy = 460 + 120 * (1 - p)
    put(f, a['h_card'], 0, cy - 70, op=p, anchor='lt')  # spraytda soya uchun 70 px chekka
    accepted = sum(1 for k, tt in ACCEPT.items() if t >= tt)
    put(f, a['h_count'][accepted], 1010 - 44, cy + 50, op=p, anchor='rt')
    # Joylar to'lishi
    d = ImageDraw.Draw(f)
    if p > 0.5:
        bx0, bx1, by = 114, 966, cy + 262
        d.rounded_rectangle([bx0, by, bx1, by + 18], radius=9, fill=PAPER_SHADE)
        fill = sum(out_cubic(prog(t, tt, tt + 0.3)) for tt in ACCEPT.values()) / 3
        if fill > 0:
            d.rounded_rectangle([bx0, by, bx0 + (bx1 - bx0) * fill, by + 18], radius=9, fill=TEAL)
    for i, (row, t0) in enumerate(zip(a['h_rows'], ROW_T)):
        q = out_cubic(prog(t, t0, t0 + 0.35))
        if q <= 0:
            continue
        ry = cy + 320 + i * 152
        faded = 1 - 0.55 * prog(t, 3.0, 3.3) if i == 2 else 1
        put(f, row, 114 + 60 * (1 - q), ry, op=q * faded, anchor='lt')
        if i == 2 and t >= 3.0:
            chip, since = 'joy', 3.0
        elif i in CAME and t >= CAME[i]:
            chip, since = 'keldi', CAME[i]
        elif i in ACCEPT and t >= ACCEPT[i]:
            chip, since = 'qabul', ACCEPT[i]
        else:
            chip, since = 'ariza', t0
        pop = out_back(prog(t, since, since + 0.28)) if chip != 'ariza' else 1
        put(f, a['h_chip'][chip], 940 + 60 * (1 - q), ry + 64, op=q * (1 if i != 2 or chip == 'joy' else faded), scale=0.7 + 0.3 * pop, rot=-4, anchor='rm')
    # Qadam izohi almashadi
    for k, (s, e) in enumerate([(0.6, 1.9), (1.9, 3.45), (3.45, 9)]):
        op = min(prog(t, s, s + 0.25), 1 - prog(t, e - 0.2, e))
        put(f, a['h_steps'][k], 540, 1460, op=op, anchor='mt')
    p = prog(t, 4.35, 4.6)
    if p > 0:
        put(f, a['h_stamp'], 540, 1600, op=min(1, p * 3), scale=1.8 - 0.8 * out_cubic(p), rot=5)
    return f


def s_features(t):
    a, f = A(), background(TEAL, grain=12, vignette=0.14, fibres=False).copy()
    p = out_cubic(prog(t, 0.2, 0.6))
    put(f, a['f_label'], 540, 165, op=p)
    p = out_cubic(prog(t, 0.3, 0.8))
    put(f, a['f_head'], 540, 210 + 40 * (1 - p), op=p, anchor='mt')
    for i, c in enumerate(a['f_cards']):
        t0 = 0.6 + 0.2 * i
        q = prog(t, t0, t0 + 0.42)
        x = 70 + (i % 2) * 485 - 50 + 455 / 2 + 50
        y = 380 + (i // 2) * 360 - 50 + 330 / 2 + 50
        rot = (1.6 if i % 2 else -1.6) * (1 + 3 * (1 - out_cubic(q)))
        put(f, c, x, y, op=min(1, q * 2.5), scale=0.7 + 0.3 * out_back(q), rot=rot)
    p = out_cubic(prog(t, 2.2, 2.7))
    put(f, a['f_lang'], 540, 1500 + 30 * (1 - p), op=p, anchor='mt')
    return f


def s_end(t):
    a, f = A(), background(KRAFT).copy()
    twine(f, 205, 18)
    top = twine_y(540, 205, 18)
    p = prog(t, 0.15, 0.7)
    py = -1100 + (300 + 1100) * out_back(p, 1.15)
    ang = swing(t - 0.55, 5.0, freq=1.0, damp=3.2, phase=-math.pi / 2) if p >= 0.75 else 0.0
    if py > top:
        string(f, (540, top), (540, py))
    hang(f, a['end'], 540, py, ang)
    p = out_cubic(prog(t, 0.8, 1.3))
    put(f, a['e_url'], 540, 1300 + 30 * (1 - p), op=p, anchor='mt')
    p = out_cubic(prog(t, 1.0, 1.5))
    put(f, a['e_bot'], 540, 1400 + 30 * (1 - p), op=p, anchor='mt')
    p = prog(t, 1.4, 1.8)
    put(f, a['e_pill'], 540, 1530, op=min(1, p * 2), scale=0.6 + 0.4 * out_back(p))
    return f


SCENES = [(0.0, s_intro), (3.4, s_problem), (8.6, s_solution), (14.4, s_how), (20.0, s_features), (25.0, s_end)]
HALF = 0.28  # o'tish (yuqoriga surish) yarim davomiyligi


def frame_at(t):
    for i, (start, fn) in enumerate(SCENES):
        nxt = SCENES[i + 1][0] if i + 1 < len(SCENES) else None
        if nxt is not None and abs(t - nxt) < HALF:
            e = in_out(prog(t, nxt - HALF, nxt + HALF))
            a_img, b_img = fn(t - start), SCENES[i + 1][1](t - nxt)
            out = Image.new('RGB', (W, H))
            off = round(e * H)
            out.paste(a_img.crop((0, off, W, H)), (0, 0))
            out.paste(b_img.crop((0, 0, W, off)), (0, H - off))
            return out
        if nxt is None or t < nxt:
            return fn(t - start)


def render(i):
    from h264mp4 import i420
    return i420(frame_at(i / FPS))


# WAV → AAC; videodagi H.264 o'zgarmasdan olinadi (qayta kodlanmaydi); GStreamer bilan bitta MP4 ga
def mux_audio(video, wav, out):
    import subprocess
    tmp = out + '.tmp.mp4'
    subprocess.run(['gst-launch-1.0', '-q', '-e',
                    'filesrc', f'location={video}', '!', 'qtdemux', 'name=d', 'd.video_0', '!', 'queue', '!', 'mux.video_0',
                    'filesrc', f'location={wav}', '!', 'wavparse', '!', 'audioconvert', '!', 'audioresample', '!',
                    'avenc_aac', 'bitrate=192000', '!', 'queue', '!', 'mux.audio_0',
                    'mp4mux', 'name=mux', 'faststart=true', '!', 'filesink', f'location={tmp}'], check=True)
    os.replace(tmp, out)


# Ovoz: audio.py dagi musiqa va effektlar shu videoga
def add_sound(video, out, style='bozor'):
    import audio
    wav = f'{HERE}/smena-audio.wav'
    peak, rms = audio.mixdown(wav, style)
    mux_audio(video, wav, out)
    os.remove(wav)
    print(f'ovoz: cho‘qqi {20 * math.log10(peak):.1f} dBFS, o‘rtacha {rms:.1f} dBFS')


def main():
    sys.path.insert(0, HERE)
    out = f'{HERE}/smena-video.mp4'
    if len(sys.argv) > 1 and sys.argv[1] == 'kadr':
        os.makedirs(f'{HERE}/kadrlar', exist_ok=True)
        for s in sys.argv[2:]:
            frame_at(float(s)).save(f'{HERE}/kadrlar/{float(s):05.2f}.png')
        return
    if len(sys.argv) > 1 and sys.argv[1] == 'ovoz':
        style = sys.argv[2] if len(sys.argv) > 2 else 'bozor'
        # Tasvir mavjud videodan olinadi (ovoz variantlarining istalgani: tasviri bir xil)
        src = next(p for p in (out, f'{HERE}/smena-video-bozor.mp4', f'{HERE}/smena-video-quvnoq.mp4') if os.path.exists(p))
        add_sound(src, f'{HERE}/{sys.argv[3]}' if len(sys.argv) > 3 else out, style)
        return
    from h264mp4 import Encoder
    n = int(DUR * FPS)
    silent = f'{HERE}/.ovozsiz.mp4'
    enc = Encoder(silent, W, H, fps=FPS, crf=18)
    t0 = time.time()
    with Pool(max(2, (os.cpu_count() or 4) - 2)) as pool:
        for b in range(0, n, 48):  # bo'laklab: xotirada ko'pi bilan 48 kadr turadi
            for planes in pool.map(render, range(b, min(n, b + 48))):
                enc.add_planes(planes)
            print(f'{min(n, b + 48)}/{n} kadr, {time.time() - t0:.0f} s', flush=True)
    enc.close()
    add_sound(silent, out)
    os.remove(silent)
    frame_at(27.5).save(f'{HERE}/smena-video-muqova.png')
    print('tayyor:', out, f'{os.path.getsize(out) / 1e6:.1f} MB', f'{time.time() - t0:.0f} s')


if __name__ == '__main__':
    main()
