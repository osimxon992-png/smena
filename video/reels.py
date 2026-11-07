# Smena: "kinetik tipografiya" uslubidagi reklama (Pinterest'dagi "Motion inspiration — Frames" namunasi uslubida).
# 21 soniya, 1080×1920, 30 kadr/s, 120 BPM: har bir kesim musiqa zarbiga tushadi.
# Och krem va qora sahnalar almashadi; so'zlar birma-bir chiqadi, kalit so'zlar katta va qizil; qorong'i sahnalarda matn yoqiladi.
#   python3 reels.py            → smena-reels.mp4 (ovozi bilan)
#   python3 reels.py kadr 1 3.2 → tanlangan soniyalardagi kadrlar PNG (tekshirish uchun)
import math
import os
import random
import sys
import time
from functools import lru_cache
from multiprocessing import Pool

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageFont

import render as R
from render import W, H, FPS, SS, clamp, prog, out_cubic, out_back, put, onest, marker, ss_canvas, down, shadow_of, icon

HERE = R.HERE
CREAM, BLACK, RED, INK, WHITE = '#F7F2EA', '#0A0A0B', '#E2231A', '#151515', '#F4F4F4'
GREY, CURVE, GRID, MUTED, TEAL = '#8D8D8D', '#CBC7C1', '#DDD5CA', '#9A9A9A', '#1F8A70'
# Sahna chegaralari (soniya): hammasi 0,5 s ga karrali — 120 BPM da har biri zarbga tushadi
B = [0, 2.0, 3.5, 5.0, 6.5, 8.0, 10.0, 11.5, 12.5, 14.0, 15.5, 17.0, 21.0]
DUR = B[-1]


# --- Matn: so'zlar spraytlari va satrlarga joylash ---

@lru_cache(None)
def word(t, size, weight, color):
    f = onest(size, weight)
    asc, desc = f.getmetrics()
    img = Image.new('RGBA', (math.ceil(f.getlength(t)) + 20, asc + desc + 20), (0, 0, 0, 0))
    ImageDraw.Draw(img).text((10, 10 + asc), t, font=f, fill=color, anchor='ls')
    return img, 10 + asc


def layout(lines, cx, top, gap=6):
    """lines: [[(matn, o'lcham, qalinlik, rang), ...], ...] → har so'z uchun (sprayt, markaz x, markaz y) o'qish tartibida."""
    placed, y = [], top
    for line in lines:
        ws = [word(*w) for w in line]
        space = [w[1] * 0.26 for w in line]
        total = sum(s.width - 20 for s, _ in ws) + sum(space[:-1])
        asc = max(b for _, b in ws)
        desc = max(s.height - b for s, b in ws)
        x = cx - total / 2
        for (s, b), sp in zip(ws, space):
            placed.append((s, x - 10 + s.width / 2, y + asc - b + s.height / 2))
            x += s.width - 20 + sp
        y += asc + desc - 20 + gap
    return placed


def words_layer(placed, times, t, out_at=None):
    """So'zlar birma-bir: kattaroqdan, xira holatdan aniqlashib chiqadi; out_at dan keyin xiralashib ketadi."""
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for (spr, x, y), ti in zip(placed, times):
        if t < ti:
            continue
        p = prog(t, ti, ti + 0.2)
        op, sc, blur = p ** 0.6, 1 + 0.22 * (1 - out_cubic(p)), 7 * (1 - p)
        if out_at is not None and t > out_at:
            q = prog(t, out_at, out_at + 0.16)
            op, blur, sc = op * (1 - q), blur + 12 * q, sc + 0.1 * q
        s = spr.filter(ImageFilter.GaussianBlur(blur)) if blur > 0.4 else spr
        put(layer, s, x, y, op=op, scale=sc)
    return layer


def compose(frame, layer, glow=0.0):
    """Matn qatlamini kadrga qo'yadi; glow > 0 — qorong'i sahnada yorug' "nur" (bloom)."""
    box = layer.getbbox()
    if not box:
        return
    if glow:
        m = 60
        box = (max(0, box[0] - m), max(0, box[1] - m), min(W, box[2] + m), min(H, box[3] + m))
        part = layer.crop(box)
        halo = Image.new('RGB', part.size, (0, 0, 0))
        halo.paste(part, (0, 0), part)
        halo = ImageEnhance.Brightness(halo.filter(ImageFilter.GaussianBlur(16))).enhance(glow * 0.55)
        region = frame.crop(box)
        frame.paste(ImageChops.screen(region, halo), box[:2])
    frame.paste(layer, (0, 0), layer)


# --- Fonlar va bezaklar ---

@lru_cache(None)
def light_bg():
    return R.background(CREAM, grain=7, vignette=0.05, fibres=False)


@lru_cache(None)
def dark_bg():
    img = R.background(BLACK, grain=9, vignette=0, fibres=False)
    g = Image.radial_gradient('L').resize((int(W * 1.6), int(H * 1.1)), Image.BICUBIC)
    g = g.crop(((g.width - W) // 2, (g.height - H) // 2 - 80, (g.width - W) // 2 + W, (g.height - H) // 2 - 80 + H))
    spot = g.point(lambda v: int(clamp(1 - v / 200) ** 1.6 * 255))
    return Image.composite(Image.new('RGB', (W, H), '#232325'), img, spot)


@lru_cache(None)
def grid(cx, cy, w, h, step=64):
    """Ingichka katakli qog'oz chiziqlari: markazda aniq, chetga qarab yo'qoladi."""
    layer = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for x in range(step // 2 % step, w, step):
        d.line([(x, 0), (x, h)], fill=GRID, width=2)
    for y in range(step // 2 % step, h, step):
        d.line([(0, y), (w, y)], fill=GRID, width=2)
    g = Image.radial_gradient('L').resize((w, h), Image.BICUBIC).point(lambda v: int(clamp(1 - v / 230) ** 0.8 * 255))
    layer.putalpha(ImageChops.multiply(layer.getchannel('A'), g))
    return layer, cx - w // 2, cy - h // 2


@lru_cache(None)
def barcode():
    rnd = random.Random(4)
    img = Image.new('RGBA', (230, 74), (0, 0, 0, 0))
    d, x = ImageDraw.Draw(img), 0
    while x < 228:
        w = rnd.choice([2, 2, 3, 4, 6])
        if rnd.random() < 0.62:
            d.rectangle([x, 0, x + w - 1, 73], fill=INK)
        x += w + rnd.choice([2, 3, 4])
    return img


@lru_cache(None)
def footer():
    f = onest(22, 700)
    logo = R.text('S.', marker(40), INK)
    t = R.text('SMENA · BIR KUNLIK ISH · TOSHKENT', f, '#6F6A63', spacing=2)
    tag = R.pill('UZ', onest(20, 800), CREAM, INK, padx=10, pady=4)
    w = logo.width + t.width + tag.width + 36
    img = Image.new('RGBA', (w, max(logo.height, tag.height) + 4), (0, 0, 0, 0))
    img.paste(logo, (0, (img.height - logo.height) // 2), logo)
    img.paste(t, (logo.width + 16, (img.height - t.height) // 2), t)
    img.paste(tag, (logo.width + t.width + 32, (img.height - tag.height) // 2), tag)
    return img


def decorate(frame, bar=False, foot=False):
    if bar:
        put(frame, barcode(), 810, 210)
    if foot:
        put(frame, footer(), 540, 1735)


@lru_cache(None)
def curve(kind):
    """Orqa fondagi qalin kulrang egri chiziq (Bezier)."""
    pts = {'a': [(-120, 260), (520, 120), (760, 900), (300, 1280), (-160, 1700)],
           'b': [(1220, -80), (520, 300), (320, 980), (760, 1500), (1240, 2020)],
           'c': [(-160, -60), (300, 520), (980, 760), (840, 1420), (380, 2040)]}[kind]
    img, d = ss_canvas(W, H)
    path = []
    n = len(pts) - 1
    for i in range(201):
        u = i / 200
        x = y = 0.0
        for k, (px, py) in enumerate(pts):
            c = math.comb(n, k) * u ** k * (1 - u) ** (n - k)
            x, y = x + c * px, y + c * py
        path.append((x * SS, y * SS))
    d.line(path, fill=CURVE, width=128 * SS, joint='curve')
    return down(img, W, H)


@lru_cache(None)
def emoji(e, size, blur=0):
    f = ImageFont.truetype('/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf', 109)
    img = Image.new('RGBA', (160, 160), (0, 0, 0, 0))
    ImageDraw.Draw(img).text((10, 10), e, font=f, embedded_color=True)
    img = img.crop(img.getbbox()).resize((size, size), Image.LANCZOS)
    if blur:
        pad = blur * 3
        big = Image.new('RGBA', (size + 2 * pad, size + 2 * pad), (0, 0, 0, 0))
        big.paste(img, (pad, pad), img)
        img = big.filter(ImageFilter.GaussianBlur(blur))
    return img


def soft_shadow(spr, blur=24, dy=34, alpha=0.32):
    return shadow_of(spr, blur=blur, dx=0, dy=dy, alpha=alpha, pad=90)[0]


# --- Obyektlar ---

@lru_cache(None)
def big_tag():
    w, h = 560, 860
    img, d = ss_canvas(w, h)
    c = 96 * SS
    d.polygon([(c, 0), (w * SS - c, 0), (w * SS, c), (w * SS, h * SS), (0, h * SS), (0, c)], fill='#FBF7EF')
    # Hajm: chap chetga yumshoq soya
    shade = Image.new('L', (w * SS, h * SS), 0)
    ImageDraw.Draw(shade).rectangle([0, 0, 120 * SS, h * SS], fill=60)
    shade = shade.filter(ImageFilter.GaussianBlur(60 * SS))
    mask = Image.new('L', (w * SS, h * SS), 0)
    ImageDraw.Draw(mask).polygon([(c, 0), (w * SS - c, 0), (w * SS, c), (w * SS, h * SS), (0, h * SS), (0, c)], fill=255)
    img.paste(Image.new('RGBA', img.size, (90, 70, 40, 255)), (0, 0), ImageChops.multiply(shade, mask))
    hx = w * SS // 2
    d.ellipse([hx - 34 * SS, 60 * SS, hx + 34 * SS, 128 * SS], fill='#B88A4E')
    d.ellipse([hx - 20 * SS, 74 * SS, hx + 20 * SS, 114 * SS], fill='#6B4A22')
    img = down(img, w, h)
    d = ImageDraw.Draw(img)
    d.text((w / 2, 190), 'Ofitsiant', font=onest(60, 800), fill=INK, anchor='mt')
    d.text((w / 2, 290), '250 000', font=marker(124), fill=RED, anchor='mt')
    d.text((w / 2, 450), 'so‘m', font=onest(44, 700), fill='#6F6A63', anchor='mt')
    for x in range(60, 500, 30):
        d.line([(x, 540), (x + 16, 540)], fill='#E3DBCE', width=4)
    d.text((w / 2, 580), 'Bugun', font=onest(44, 700), fill=TEAL, anchor='mt')
    d.text((w / 2, 640), '18:00–23:00', font=onest(52, 800), fill=TEAL, anchor='mt')
    d.text((w / 2, 740), '3 joy qoldi', font=onest(36, 600), fill='#6F6A63', anchor='mt')
    return soft_shadow(img, blur=30, dy=40, alpha=0.3)


@lru_cache(None)
def halftone_bust():
    """Kostyumli odam qomati: yarim ton (halftone) nuqtalari bilan, chapdan yoritilgan."""
    oy = 1060  # sprayt kadrning shu balandligidan boshlanadi
    shape = Image.new('L', (W, 900), 0)
    sd = ImageDraw.Draw(shape)
    # Bo'yin, qiya yelkalar va tik yonlar
    sd.polygon([(468, 0), (612, 0), (612, 150), (760, 172), (900, 232), (968, 330), (996, 900), (84, 900), (112, 330),
                (180, 232), (320, 172), (468, 150)], fill=255)
    img = Image.new('RGBA', (W, 900), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    step = 15
    for y in range(0, 900, step):
        for x in range(0, W, step):
            if not shape.getpixel((x, y)):
                continue
            gy = y + oy
            neck = gy < 1215
            b = 0.3 + 0.36 * clamp(1 - (gy - 1200) / 650) + 0.18 * (540 - x) / 450
            if not neck and abs(x - 540) < (gy - 1205) * 0.36 and gy < 1700:
                b = 0.95  # ko'ylak (V shaklida)
            if 1225 < gy < 1700 and abs(x - 540) < 20 + (gy - 1225) * 0.03:
                b = 0.08  # galstuk
            if neck:
                b = 0.7
            if gy > 1700:
                b *= clamp(1 - (gy - 1700) / 260)
            r = step * 0.46 * math.sqrt(clamp(b))
            if r > 0.6:
                d.ellipse([x - r, y - r, x + r, y + r], fill=(128, 128, 130, 255))
    return img


@lru_cache(None)
def money():
    """Bog'langan pul dastalari (izometrik), yuqoridan yoritilgan."""
    w, h = 980, 760
    img, d = ss_canvas(w, h)

    def stack(ox, oy, n, scale):
        A, Bp, C, D = [(ox + x * scale, oy + y * scale) for x, y in [(0, 150), (400, 0), (800, 150), (400, 300)]]
        for i in range(n):
            dy = -i * 9 * scale
            face = [(p[0] * SS, (p[1] + dy) * SS) for p in (A, Bp, C, D)]
            d.polygon(face, fill='#9DB49A' if i % 2 else '#93AB90', outline='#5C725A')
            # Old tomon qalinligi
            d.polygon([(A[0] * SS, (A[1] + dy) * SS), (D[0] * SS, (D[1] + dy) * SS), (D[0] * SS, (D[1] + dy + 9 * scale) * SS),
                       (A[0] * SS, (A[1] + dy + 9 * scale) * SS)], fill='#6E846C')
            d.polygon([(D[0] * SS, (D[1] + dy) * SS), (C[0] * SS, (C[1] + dy) * SS), (C[0] * SS, (C[1] + dy + 9 * scale) * SS),
                       (D[0] * SS, (D[1] + dy + 9 * scale) * SS)], fill='#7F967D')
        top = -(n - 1) * 9 * scale
        lerp = lambda p, q, u: (p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u)
        # Yuqori pulning naqshi: ichki chegara va o'rtadagi oval
        inner = [lerp(lerp(A, C, 0.5), p, 0.86) for p in (A, Bp, C, D)]
        d.polygon([(x * SS, (y + top) * SS) for x, y in inner], outline='#5C725A', width=3 * SS)
        cx, cy = lerp(A, C, 0.5)
        d.ellipse([(cx - 70 * scale) * SS, (cy + top - 36 * scale) * SS, (cx + 70 * scale) * SS, (cy + top + 36 * scale) * SS],
                  outline='#5C725A', width=4 * SS)
        # Bog'lovchi qog'oz tasma
        for u in (0.44,):
            p1, p2 = lerp(A, Bp, u), lerp(A, Bp, u + 0.13)
            p3, p4 = lerp(D, C, u + 0.13), lerp(D, C, u)
            d.polygon([(p[0] * SS, (p[1] + top) * SS) for p in (p1, p2, p3, p4)], fill='#E6C891', outline='#B08C4E')
            d.polygon([(p4[0] * SS, (p4[1] + top) * SS), (p3[0] * SS, (p3[1] + top) * SS), (p3[0] * SS, (p3[1] + 9 * scale) * SS),
                       (p4[0] * SS, (p4[1] + 9 * scale) * SS)], fill='#C9A86B')

    stack(60, 150, 12, 0.72)
    stack(250, 300, 16, 0.86)
    img = down(img, w, h)
    return soft_shadow(img, blur=26, dy=30, alpha=0.6)


@lru_cache(None)
def floor_grid():
    """Qorong'ida perspektiv katak pol (pul dastalari ostida)."""
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    vx, vy = 540, 820
    for k in range(-9, 10):
        d.line([(vx, vy), (540 + k * 260, 1920)], fill=(255, 255, 255, 22), width=2)
    for i in range(1, 12):
        y = vy + (1920 - vy) * (i / 11) ** 1.8
        d.line([(0, y), (W, y)], fill=(255, 255, 255, 22), width=2)
    g = Image.radial_gradient('L').resize((W * 2, H), Image.BICUBIC).crop((W // 2, 0, W // 2 + W, H))
    layer.putalpha(ImageChops.multiply(layer.getchannel('A'), g.point(lambda v: 255 - v)))
    return layer


@lru_cache(None)
def pin_card():
    w, h = 540, 640
    card = R.panel(w, h, GREY, radius=10)
    d = ImageDraw.Draw(card)
    d.text((w / 2, 70), 'Smena', font=onest(92, 800), fill=WHITE, anchor='mt')
    d.line([(70, 196), (w - 70, 196)], fill=WHITE, width=5)
    return soft_shadow(card, blur=26, dy=34, alpha=0.35)


@lru_cache(None)
def pushpin():
    s = 92
    img, d = ss_canvas(s, s)
    k = SS
    d.ellipse([12 * k, 4 * k, 80 * k, 72 * k], fill='#C3141B')
    d.ellipse([22 * k, 12 * k, 52 * k, 40 * k], fill='#F06A6F')
    d.ellipse([28 * k, 16 * k, 42 * k, 30 * k], fill='#FFD3D5')
    return soft_shadow(down(img, s, s), blur=6, dy=10, alpha=0.45)


@lru_cache(None)
def clock_icon(s, color):
    img, d = ss_canvas(s, s)
    k = s * SS
    d.ellipse([0.08 * k, 0.08 * k, 0.92 * k, 0.92 * k], outline=color, width=round(0.1 * k))
    d.line([(0.5 * k, 0.5 * k), (0.5 * k, 0.24 * k)], fill=color, width=round(0.09 * k))
    d.line([(0.5 * k, 0.5 * k), (0.7 * k, 0.6 * k)], fill=color, width=round(0.09 * k))
    return down(img, s, s)


@lru_cache(None)
def card_item(i):
    ic = [icon('money', 46, WHITE), clock_icon(46, WHITE), icon('check', 46, WHITE)][i]
    t = R.text(['Haqi oldindan', 'Vaqti aniq', 'Kelmagan bloklanadi'][i], onest(40, 700), WHITE)
    img = Image.new('RGBA', (ic.width + 18 + t.width, max(ic.height, t.height)), (0, 0, 0, 0))
    img.paste(ic, (0, (img.height - ic.height) // 2), ic)
    img.paste(t, (ic.width + 18, (img.height - t.height) // 2), t)
    return img


@lru_cache(None)
def logo(size):
    f = marker(size)
    tw, dw = f.getlength('Smena'), f.getlength('.')
    asc, desc = f.getmetrics()
    img = Image.new('RGBA', (math.ceil(tw + dw) + 40, asc + desc + 40), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.text((20, 20), 'Smena', font=f, fill=INK)
    d.text((20 + tw, 20), '.', font=f, fill=RED)
    return img.crop(img.getbbox())


@lru_cache(None)
def app_card():
    w, h = 880, 760
    card = R.panel(w, h, '#1C1C1E', radius=36, outline='#2E2E31', ow=3)
    d = ImageDraw.Draw(card)
    # Qorong'i kartochkada logotip oq, nuqtasi qizil
    f = marker(64)
    d.text((44, 30), 'Smena', font=f, fill=WHITE)
    d.text((44 + f.getlength('Smena'), 30), '.', font=f, fill=RED)
    # O'ng tomonda: qo'shish va menyu belgilari, bildirishnoma soni
    for i in range(3):
        d.rounded_rectangle([w - 92, 52 + i * 16, w - 44, 58 + i * 16], radius=3, fill=WHITE)
    d.rounded_rectangle([w - 170, 44, w - 122, 92], radius=12, outline=WHITE, width=4)
    d.line([(w - 146, 56), (w - 146, 80)], fill=WHITE, width=4)
    d.line([(w - 158, 68), (w - 134, 68)], fill=WHITE, width=4)
    d.ellipse([w - 186, 36, w - 160, 62], fill=RED)
    d.text((w - 173, 49), '3', font=onest(18, 800), fill=WHITE, anchor='mm')
    d.text((44, 150), 'Ochiq smenalar · bugun', font=onest(30, 600), fill=MUTED)
    inner = R.panel(w - 88, 330, '#2A2A2D', radius=24)
    di = ImageDraw.Draw(inner)
    di.text((36, 40), 'Bugun', font=onest(30, 700), fill=RED)
    di.text((36, 80), '18:00', font=onest(66, 800), fill=WHITE)
    di.line([(220, 36), (220, 294)], fill='#3A3A3E', width=3)
    di.text((250, 34), 'Ofitsiant', font=onest(56, 800), fill=WHITE)
    di.text((250, 108), 'Bahor to‘yxonasi · Chilonzor', font=onest(28, 600), fill=MUTED)
    di.text((250, 160), '250 000 so‘m', font=onest(64, 800), fill=RED)
    di.text((250, 246), '3 joy qoldi', font=onest(28, 600), fill=MUTED)
    card.paste(inner, (44, 210), inner)
    return card


@lru_cache(None)
def app_button(done):
    if done:
        return R.pill('Ariza yuborildi', onest(44, 800), WHITE, TEAL, padx=220, pady=30, ic='check')
    return R.pill('Ariza berish', onest(44, 800), WHITE, RED, padx=268, pady=30)


@lru_cache(None)
def phone(notified):
    w, h = 560, 1140
    img, d = ss_canvas(w, h)
    k = SS
    d.rounded_rectangle([0, 0, w * k - 1, h * k - 1], radius=86 * k, fill='#0D0D0F', outline='#3A3A3E', width=6 * k)
    d.rounded_rectangle([22 * k, 22 * k, (w - 22) * k, (h - 22) * k], radius=66 * k, fill='#16222C')
    d.rounded_rectangle([(w / 2 - 80) * k, 44 * k, (w / 2 + 80) * k, 88 * k], radius=22 * k, fill='#050506')
    img = down(img, w, h)
    # Ekran: yuqoridan pastga yorug'lik
    g = Image.linear_gradient('L').resize((w - 44, h - 44)).point(lambda v: int(v * 0.35))
    glow = Image.new('RGBA', (w - 44, h - 44), (40, 70, 92, 255))
    glow.putalpha(g)
    m = Image.new('L', (w - 44, h - 44), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 45, h - 45], radius=66, fill=255)
    glow.putalpha(ImageChops.multiply(glow.getchannel('A'), m))
    img.paste(glow, (22, 22), glow)
    d = ImageDraw.Draw(img)
    d.text((70, 58), '18:00', font=onest(30, 700), fill=WHITE)
    d.rounded_rectangle([w - 116, 62, w - 74, 82], radius=5, outline=WHITE, width=3)
    d.rectangle([w - 112, 66, w - 86, 78], fill=WHITE)
    d.text((w / 2, 210), 'Juma, 7-noyabr', font=onest(32, 600), fill='#C9D6DF', anchor='mt')
    d.text((w / 2, 250), '18:00', font=onest(170, 400), fill=WHITE, anchor='mt')
    if notified:
        n = R.panel(w - 70, 220, '#F4F4F6', radius=34)
        dn = ImageDraw.Draw(n)
        ic = R.panel(76, 76, '#C99A5B', radius=18)
        ImageDraw.Draw(ic).text((38, 40), 'S.', font=marker(40), fill=INK, anchor='mm')
        n.paste(ic, (26, 28), ic)
        dn.text((120, 30), 'Smena bot', font=onest(26, 700), fill='#6B6B70')
        dn.text((w - 100, 30), 'hozir', font=onest(24, 600), fill='#9A9AA0', anchor='rt')
        ch = icon('check', 34, TEAL)
        n.paste(ch, (120, 74), ch)
        dn.text((162, 72), 'Arizangiz qabul qilindi!', font=onest(32, 800), fill=INK)
        dn.text((120, 122), 'Ofitsiant · 250 000 so‘m', font=onest(28, 600), fill='#55555B')
        dn.text((120, 160), 'Bugun 18:00 · Chilonzor', font=onest(28, 600), fill='#55555B')
        img.paste(n, (35, 500), n)
    return shadow_of(img, blur=30, dx=-20, dy=40, alpha=0.35, pad=90)[0]


@lru_cache(None)
def qr_tile():
    side = (len(R.qr_modules()) + 6) * 11
    img = Image.new('RGB', (side, side), '#FFFFFF')
    R.draw_qr(img, 0, 0, 11)
    m = Image.new('L', (side, side), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, side - 1, side - 1], radius=26, fill=255)
    out = img.convert('RGBA')
    out.putalpha(m)
    return out


# --- Sahnalar (t — sahnaning o'z vaqti) ---
# Qisqa yozuv uchun: s — kichik so'z, k — qizil kalit so'z (qorong'ida sw — oq kichik)
def s_(t, size=62):
    return (t, size, 600, INK)


def k_(t, size=140):
    return (t, size, 800, RED)


def sw(t, size=62):
    return (t, size, 600, WHITE)


def bw(t, size=112):
    return (t, size, 800, WHITE)


L1 = layout([[s_('Bo‘sh'), k_('vaqting')], [s_('bor,'), k_('pul'), s_('kerakmi?')]], 610, 470)


def sc1(t):
    f = light_bg().copy()
    g, gx, gy = grid(620, 640, 760, 560)
    f.paste(g, (gx, gy), g)
    decorate(f, bar=True, foot=True)
    p = out_cubic(prog(t, 0.0, 0.45))
    put(f, big_tag(), 300 + 50 * p, 1330, rot=12 + 2.5 * math.sin(t * 1.6))
    bob = 14 * math.sin(t * 3.2)
    q = out_back(prog(t, 0.55, 0.85))
    put(f, emoji('💸', 130), 905, 395 + bob, op=min(1, q * 2), scale=0.4 + 0.6 * q, rot=-10)
    compose(f, words_layer(L1, [-0.4, -0.3, 0.35, 0.53, 0.7], t))
    return f


L2a = layout([[s_('Lekin', 58)], [k_('ish', 132), ('?', 132, 800, INK)]], 540, 760, gap=-4)
L2b = layout([[bw('hali'), bw('topilmadi')]], 540, 1430)


def sc2(t):
    f = dark_bg().copy()
    bust = halftone_bust()
    f.paste(bust, (0, 1060), bust)
    p = out_back(prog(t, 0.0, 0.28))
    head = Image.new('RGBA', (500, 500), (0, 0, 0, 0))
    ImageDraw.Draw(head).ellipse([40, 40, 460, 460], fill=WHITE)
    halo = head.filter(ImageFilter.GaussianBlur(26))
    put(f, halo, 540, 860, op=0.55 * min(1, p), scale=0.8 + 0.2 * p)
    put(f, head, 540, 860, op=min(1, p * 2), scale=0.8 + 0.2 * p)
    compose(f, words_layer(L2a, [0.12, 0.28, 0.28], t))
    compose(f, words_layer(L2b, [0.62, 0.78], t), glow=1.6)
    return f


L3a = layout([[sw('Chunki'), k_('e’lonlar', 124)]], 540, 860)
L3b = layout([[sw('guruhlarda')], [k_('yo‘qoladi', 130)]], 540, 800)


def sc3(t):
    f = dark_bg().copy()
    compose(f, words_layer(L3a, [0.08, 0.24], t, out_at=0.62), glow=1.5)
    compose(f, words_layer(L3b, [0.82, 0.98], t), glow=1.5)
    return f


L4 = layout([[s_('va hammasi —')], [k_('shovqin', 152)]], 540, 470)


def sc4(t):
    f = light_bg().copy()
    c = curve('b')
    f.paste(c, (0, 0), c)
    g, gx, gy = grid(540, 1100, 620, 520)
    f.paste(g, (gx, gy), g)
    put(f, emoji('🤯', 300, blur=12), 950, 300, op=0.85)
    put(f, emoji('🤯', 340, blur=14), 120, 1700, op=0.85)
    q = prog(t, 0.05, 0.4)
    put(f, emoji('🤯', 380), 540, 1130, op=min(1, q * 3), scale=0.5 + 0.5 * out_back(q, 2.2), rot=6 * math.sin(t * 7) * (1 - q * 0.6))
    compose(f, words_layer(L4, [0.15, 0.4], t))
    return f


L5a = layout([[k_('Haqiqiy', 124), sw('pul')], [sw('esa —')]], 540, 300)
L5b = layout([[sw('ochiq'), k_('Smena’da', 124)]], 540, 1480)


def sc5(t):
    f = dark_bg().copy()
    fl = floor_grid()
    f.paste(fl, (0, 0), fl)
    haze = Image.new('RGBA', (900, 500), (0, 0, 0, 0))
    ImageDraw.Draw(haze).ellipse([60, 60, 840, 440], fill=(255, 255, 255, 46))
    put(f, haze.filter(ImageFilter.GaussianBlur(60)), 540, 1060)
    p = out_cubic(prog(t, 0.0, 0.4))
    put(f, money(), 540, 1080 + 60 * (1 - p), op=min(1, p * 1.5), scale=0.92 + 0.08 * p, rot=-4 + 3 * prog(t, 0, 1.5))
    compose(f, words_layer(L5a, [0.1, 0.3, 0.45], t), glow=1.3)
    compose(f, words_layer(L5b, [0.62, 0.74], t), glow=1.3)
    return f


def sc6(t):
    f = light_bg().copy()
    c = curve('a')
    f.paste(c, (0, 0), c)
    p = prog(t, 0.0, 0.32)
    sw_ = 3.5 * math.exp(-3 * t) * math.sin(2 * math.pi * 1.4 * t)
    card = pin_card()
    put(f, card, 560, 980, op=min(1, p * 2.5), scale=1.12 - 0.12 * out_cubic(p), rot=sw_)
    # Ro'yxat bandlari kartochka ichida birma-bir
    for i, ti in enumerate([0.45, 0.8, 1.15]):
        q = prog(t, ti, ti + 0.25)
        if q > 0:
            put(f, card_item(i), 330 + 20 * (1 - out_cubic(q)), 1012 + i * 92, op=q, anchor='lm')
    put(f, pushpin(), 560, 686 + 6 * (1 - out_cubic(p)), op=min(1, p * 2.5))
    return f


L7 = layout([[k_('tasodifga', 132), s_('emas,')]], 540, 1120)


def sc7(t):
    f = light_bg().copy()
    g, gx, gy = grid(540, 980, 900, 700)
    f.paste(g, (gx, gy), g)
    decorate(f, foot=True)
    p = prog(t, 0.0, 0.5)
    put(f, logo(230), 540, 860, op=min(1, p * 3), scale=0.3 + 0.7 * out_back(p, 1.4))
    compose(f, words_layer(L7, [0.6, 0.8], t))
    return f


L8 = layout([[k_('ishonchga', 158)], [s_('quriladi', 76)]], 540, 760)


def sc8(t):
    f = light_bg().copy()
    compose(f, words_layer(L8, [0.05, 0.3], t))
    return f


def sc9(t):
    f = dark_bg().copy()
    haze = Image.new('RGBA', (1000, 900), (0, 0, 0, 0))
    ImageDraw.Draw(haze).ellipse([80, 80, 920, 820], fill=(255, 255, 255, 34))
    put(f, haze.filter(ImageFilter.GaussianBlur(80)), 540, 980)
    p = out_cubic(prog(t, 0.0, 0.32))
    y = 940 + 90 * (1 - p)
    put(f, app_card(), 540, y, op=min(1, p * 2), scale=0.94 + 0.06 * p)
    done = t >= 0.92
    press = 1 - 0.05 * math.sin(math.pi * prog(t, 0.82, 0.98))
    put(f, app_button(done), 540, y + 300, op=min(1, p * 2), scale=press * (0.94 + 0.06 * p))
    # Barmoq (kursor) tugmaga boradi va bosadi
    c = prog(t, 0.45, 0.82)
    if 0 < c and t < 1.3:
        cx, cy = 820 - 180 * out_cubic(c), y + 560 - 260 * out_cubic(c)
        ring = Image.new('RGBA', (120, 120), (0, 0, 0, 0))
        ImageDraw.Draw(ring).ellipse([20, 20, 100, 100], fill=(255, 255, 255, 90), outline=(255, 255, 255, 220), width=5)
        put(f, ring, cx, cy, op=min(1, c * 3) * (1 - prog(t, 1.05, 1.3)), scale=1 - 0.2 * math.sin(math.pi * prog(t, 0.82, 0.98)))
    r = prog(t, 0.86, 1.3)
    if 0 < r < 1:
        rip = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        rad = 40 + 300 * out_cubic(r)
        ImageDraw.Draw(rip).ellipse([540 - rad, y + 300 - rad * 0.45, 540 + rad, y + 300 + rad * 0.45], outline=(255, 255, 255, int(160 * (1 - r))), width=6)
        f.paste(rip, (0, 0), rip)
    return f


L10 = layout([[s_('Sening vaqting')], [k_('pul', 140), k_('bo‘ladi', 140)]], 540, 330)


def sc10(t):
    f = light_bg().copy()
    decorate(f, bar=True)
    p = out_cubic(prog(t, 0.0, 0.4))
    notified = t >= 0.62
    put(f, phone(notified), 690 + 300 * (1 - p), 1400 + 300 * (1 - p), rot=-18 + 2 * prog(t, 0, 1.5))
    compose(f, words_layer(L10, [0.1, 0.3, 0.45], t))
    return f


L11 = layout([[s_('Faqat'), k_('aqlli', 152), s_('tanla')]], 540, 560)


def sc11(t):
    f = light_bg().copy()
    c = curve('c')
    f.paste(c, (0, 0), c)
    put(f, emoji('😎', 300, blur=12), 960, 420, op=0.85)
    put(f, emoji('😎', 330, blur=14), 110, 1660, op=0.85)
    q = prog(t, 0.2, 0.55)
    put(f, emoji('😎', 400), 540, 1150, op=min(1, q * 3), scale=0.4 + 0.6 * out_back(q, 2.0), rot=-8 * (1 - out_cubic(q)))
    compose(f, words_layer(L11, [0.08, 0.26, 0.5], t))
    return f


L12a = layout([[sw('Hoziroq')], [k_('ro‘yxatdan', 128), sw('o‘t')]], 540, 340)
L12b = layout([[bw('smena-uzb.vercel.app', 66)]], 540, 1360)
L12c = layout([[('Telegram: @smenauzbbot', 40, 600, '#BDBDBD')]], 540, 1460)


def sc12(t):
    f = dark_bg().copy()
    compose(f, words_layer(L12a, [0.1, 0.3, 0.5], t), glow=1.5)
    q = prog(t, 1.0, 1.35)
    if q > 0:
        tile = qr_tile()
        halo = Image.new('RGBA', (tile.width + 160, tile.height + 160), (0, 0, 0, 0))
        ImageDraw.Draw(halo).rounded_rectangle([60, 60, tile.width + 100, tile.height + 100], radius=40, fill=(255, 255, 255, 120))
        put(f, halo.filter(ImageFilter.GaussianBlur(36)), 540, 1020, op=q)
        put(f, tile, 540, 1020, op=min(1, q * 2), scale=0.85 + 0.15 * out_back(q))
    compose(f, words_layer(L12b, [1.4], t), glow=1.4)
    compose(f, words_layer(L12c, [1.6], t))
    return f


SCENES = [sc1, sc2, sc3, sc4, sc5, sc6, sc7, sc8, sc9, sc10, sc11, sc12]
DARK = {1, 2, 4, 8, 11}


def camera(img, t, dur, last=False, first=False):
    """Kesimdan keyin qisqa "zarb" (yaqinlashib turib orqaga) va sahna davomida sekin yaqinlashish.
    Birinchi sahnada zarb yo'q: undan oldin kesim yo'q, birinchi kadr esa Telegram'da video muqovasi bo'ladi"""
    s = 1.0 + 0.03 * (t / dur) * (0.4 if last else 1) + (0 if first else 0.07 * (1 - out_cubic(prog(t, 0, 0.3))))
    if s <= 1.002:
        return img
    w, h = W / s, H / s
    x0, y0 = (W - w) / 2, (H - h) / 2
    return img.resize((W, H), Image.BICUBIC, box=(x0, y0, x0 + w, y0 + h))


def frame_at(t):
    for i in range(len(SCENES)):
        if t < B[i + 1] or i == len(SCENES) - 1:
            local = t - B[i]
            return camera(SCENES[i](local), local, B[i + 1] - B[i], last=i == len(SCENES) - 1, first=i == 0)


def render(i):
    from h264mp4 import i420
    return i420(frame_at(i / FPS))


def main():
    sys.path.insert(0, HERE)
    if len(sys.argv) > 1 and sys.argv[1] == 'kadr':
        os.makedirs(f'{HERE}/kadrlar', exist_ok=True)
        for s in sys.argv[2:]:
            frame_at(float(s)).save(f'{HERE}/kadrlar/r{float(s):05.2f}.png')
        return
    from h264mp4 import Encoder
    import reels_audio
    n = int(DUR * FPS)
    silent, out = f'{HERE}/.reels-ovozsiz.mp4', f'{HERE}/smena-reels.mp4'
    enc = Encoder(silent, W, H, fps=FPS, crf=18)
    t0 = time.time()
    with Pool(max(2, (os.cpu_count() or 4) - 2)) as pool:
        for b in range(0, n, 48):
            for planes in pool.map(render, range(b, min(n, b + 48))):
                enc.add_planes(planes)
            print(f'{min(n, b + 48)}/{n} kadr, {time.time() - t0:.0f} s', flush=True)
    enc.close()
    wav = f'{HERE}/.reels.wav'
    peak, rms = reels_audio.mixdown(wav)
    R.mux_audio(silent, wav, out)
    os.remove(silent)
    os.remove(wav)
    frame_at(19.0).save(f'{HERE}/smena-reels-muqova.png')
    print(f'tayyor: {out} {os.path.getsize(out) / 1e6:.1f} MB, ovoz: o‘rtacha {rms:.1f} dBFS, {time.time() - t0:.0f} s')


if __name__ == '__main__':
    main()
