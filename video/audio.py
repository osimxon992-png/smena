# Videoning ovozi: original musiqa (sintez) va animatsiyaga mos effektlar. Hech qanday tayyor yozuv ishlatilmaydi.
# Vaqtlar render.py dagi sahna jadvalidan olinadi: animatsiya o'zgarsa, ovoz ham unga ergashadi.
#   python3 audio.py [bozor|quvnoq]  → smena-audio.wav (48 kHz, stereo, 16 bit)
import math
import os
import random
import struct
from array import array

import render as R

SR = 48000
N = int(R.DUR * SR)
L, Rt = array('d', bytes(8 * N)), array('d', bytes(8 * N))
ML, MR = array('d', bytes(8 * N)), array('d', bytes(8 * N))  # musiqa (alohida: unga aks-sado qo'shiladi)
rnd = random.Random(11)

NOTE = {n: i for i, n in enumerate(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'])}


def hz(name):
    """'A4' → 440.0"""
    return 440.0 * 2 ** ((NOTE[name[:-1]] + 12 * (int(name[-1]) + 1) - 69) / 12)


def add(samples, t, gain=1.0, pan=0.0, music=False):
    i0 = int(t * SR)
    gl, gr = gain * math.cos((pan + 1) * math.pi / 4) * 1.414, gain * math.sin((pan + 1) * math.pi / 4) * 1.414
    bl, br = (ML, MR) if music else (L, Rt)
    for k, v in enumerate(samples):
        i = i0 + k
        if 0 <= i < N:
            bl[i] += v * gl
            br[i] += v * gr


# --- Asboblar ---

def pluck(f, dur=0.45, bright=0.5):
    """Karplus–Strong: tortilgan tor (gitara/arfa kabi)."""
    n = int(dur * SR)
    p = max(2, int(SR / f))
    buf = [rnd.uniform(-1, 1) for _ in range(p)]
    out, i, damp = [], 0, 0.5 * (0.996 + 0.003 * bright)
    for k in range(n):
        a = buf[i]
        b = buf[(i + 1) % p]
        buf[i] = damp * (a + b)
        out.append(a * (1 - k / n) ** 0.5)
        i = (i + 1) % p
    return out


def tone(f0, f1, dur, decay, harmonics=(1.0,), attack=0.004):
    n = int(dur * SR)
    out, ph = [], 0.0
    for k in range(n):
        t = k / SR
        f = f0 * (f1 / f0) ** (k / n) if f1 != f0 else f0
        ph += 2 * math.pi * f / SR
        env = min(1.0, t / attack) * math.exp(-t / decay)
        out.append(env * sum(a * math.sin((h + 1) * ph) for h, a in enumerate(harmonics)))
    return out


def noise(dur, decay, lp=1.0, hp=False, attack=0.002):
    n = int(dur * SR)
    out, y, prev = [], 0.0, 0.0
    for k in range(n):
        t = k / SR
        x = rnd.uniform(-1, 1)
        if hp:
            x, prev = x - prev, x
        y += lp * (x - y)
        out.append(y * min(1.0, t / attack) * math.exp(-t / decay))
    return out


def bell(f, dur=1.2, decay=0.45):
    # Qo'ng'iroq: noaniq (inharmonik) obertonlar
    n = int(dur * SR)
    parts = [(1.0, 1.0, decay), (2.76, 0.35, decay * 0.5), (5.4, 0.18, decay * 0.3), (2.0, 0.25, decay * 0.8)]
    return [sum(a * math.exp(-(k / SR) / d) * math.sin(2 * math.pi * f * m * k / SR) for m, a, d in parts) * min(1, k / 96)
            for k in range(n)]


def kick():
    return [a + b for a, b in zip(tone(130, 42, 0.32, 0.11, (1.0,)), noise(0.32, 0.006, lp=0.5))]


def clap():
    n1 = noise(0.22, 0.05, lp=0.6, hp=True)
    return [v + 0.25 * s for v, s in zip(n1, tone(190, 160, 0.22, 0.04))]


def hat(decay=0.03):
    return noise(0.09, decay, lp=0.9, hp=True)


def whoosh(dur=0.56):
    """Sahna almashuvi: shovqin, filtri ochilib-yopiladi; chapdan o'ngga o'tadi (stereo alohida)."""
    n = int(dur * SR)
    l, r, y = [], [], 0.0
    for k in range(n):
        p = k / n
        lp = 0.015 + 0.35 * math.sin(math.pi * p) ** 2
        y += lp * (rnd.uniform(-1, 1) - y)
        env = math.sin(math.pi * p) ** 1.6
        l.append(y * env * (1 - p))
        r.append(y * env * p)
    return l, r


def impact():
    """Muhr zarbi: past chastotali zarba + shitirlash."""
    body = tone(95, 38, 0.6, 0.16, (1.0, 0.3))
    crunch = noise(0.6, 0.05, lp=0.35)
    return [math.tanh(1.6 * (a + 0.6 * b)) for a, b in zip(body, crunch)]


def thunk():
    """Qog'oz yorliq ipga tushdi."""
    return [a + 0.35 * b for a, b in zip(tone(170, 95, 0.2, 0.05, (1.0, 0.2)), noise(0.2, 0.025, lp=0.5, hp=True))]


def pop(f=620):
    return tone(f, f * 1.6, 0.11, 0.035, (1.0, 0.15))


def bloop(f=880):
    a = tone(f, f, 0.07, 0.03)
    b = tone(f * 1.5, f * 1.5, 0.09, 0.04)
    return a + [0.0] * int(0.01 * SR) + b


def tick():
    return tone(2400, 2200, 0.03, 0.006)


def swish():
    return noise(0.22, 0.06, lp=0.25, hp=True, attack=0.04)


def bonk():
    return tone(240, 170, 0.22, 0.06, (1.0, 0.5, 0.25))


# --- Qo'shimcha asboblar: doira, zil, ikki torli cholg'u, marimba, shaker ---

def strings2(f, dur=0.9, bright=0.7):
    """Ikki torli tortib chalinadigan cholg'u (dutor/rubobga yaqin): bir-biridan sal farqli sozlangan ikki tor."""
    a, b = pluck(f, dur, bright), pluck(f * 1.004, dur, bright)
    return [(x + y) * 0.6 for x, y in zip(a, b)]


def dum():
    """Doira: o'rtasiga urilgan past, yumshoq zarb."""
    return [a + 0.45 * b for a, b in zip(tone(82, 56, 0.42, 0.13, (1.0, 0.22)), noise(0.42, 0.025, lp=0.1))]


def tak():
    """Doira: chetiga urilgan baland, quruq zarb."""
    return [0.75 * a + 0.45 * b for a, b in zip(noise(0.09, 0.016, lp=0.75, hp=True), tone(1180, 1020, 0.09, 0.012))]


def zil():
    """Doira halqalari (zil): metall jiringlash."""
    n = int(0.16 * SR)
    parts = [(f, rnd.uniform(0.5, 1.0), rnd.uniform(0, 6.28), d) for f, d in
             [(5300, 0.07), (6950, 0.06), (8150, 0.05), (9700, 0.045), (11300, 0.04)]]
    sh = noise(0.16, 0.03, lp=0.95, hp=True)
    return [0.25 * sum(a * math.exp(-(k / SR) / d) * math.sin(2 * math.pi * f * k / SR + ph) for f, a, ph, d in parts) + 0.3 * sh[k]
            for k in range(n)]


def marimba(f, dur=0.6):
    n = int(dur * SR)
    parts = [(1.0, 1.0, 0.32), (3.93, 0.2, 0.07), (9.2, 0.05, 0.025)]
    return [min(1, k / 60) * sum(a * math.exp(-(k / SR) / d) * math.sin(2 * math.pi * f * m * k / SR) for m, a, d in parts)
            for k in range(n)]


def shaker(accent=1.0):
    return [v * accent for v in noise(0.07, 0.022, lp=0.85, hp=True, attack=0.008)]


def snap():
    return [0.8 * a + 0.3 * b for a, b in zip(noise(0.06, 0.012, lp=0.8, hp=True), tone(1900, 1700, 0.06, 0.008))]


def bass_note(f, dur=0.45, decay=0.2):
    return tone(f, f, dur, decay, (1.0, 0.45, 0.12), attack=0.006)


S = [s for s, _ in R.SCENES]  # sahnalar boshlanishi: intro, muammo, yechim, qanday, imkoniyatlar, yakun
END = S[5]


def snap_to_beat(t, beat):
    return round(t / beat) * beat


# --- 1-variant "Bozor": o'zbekona, 116 BPM, D miksolidiy (D – G – C – D), doira ritmi va ikki torli cholg'u kuyi ---
BOZOR_MELODY = [  # (zarb, nota, davomiylik zarbda) — 4 takt
    (0, 'A4', .5), (.5, 'A4', .5), (1, 'B4', .5), (1.5, 'A4', .5), (2, 'F#4', .5), (2.5, 'G4', .5), (3, 'A4', 1),
    (4, 'G4', .5), (4.5, 'F#4', .5), (5, 'E4', .5), (5.5, 'F#4', .5), (6, 'D4', 1.5),
    (8, 'A4', .5), (8.5, 'A4', .5), (9, 'B4', .5), (9.5, 'C5', .5), (10, 'B4', .5), (10.5, 'A4', .5), (11, 'G4', .5), (11.5, 'A4', .5),
    (12, 'F#4', .5), (12.5, 'E4', .5), (13, 'F#4', .5), (13.5, 'G4', .5), (14, 'D4', 2),
]
BOZOR_CHORDS = [('D2', ['D3', 'A3', 'D4', 'F#4']), ('G2', ['G3', 'B3', 'D4', 'G4']),
                ('C2', ['C3', 'G3', 'C4', 'E4']), ('D2', ['D3', 'A3', 'D4', 'F#4'])]
# Doira: sakkizliklar bo'yicha bir takt: D — dum, T — tak, z — faqat zil
DOIRA = ['D', '', 'T', 'T', 'D', 'T', 'z', 'T']


def octave(name, k):
    return name[:-1] + str(int(name[-1]) + k)


def music_bozor():
    beat = 60 / 116
    p1, p2 = snap_to_beat(S[1], beat), snap_to_beat(S[2], beat)
    beats = int(END / beat)
    for b in range(beats):
        t = b * beat
        bar, in_bar = b // 4, b % 4
        root, chord = BOZOR_CHORDS[bar % 4]
        intro, tense, full = t < p1, p1 <= t < p2, p2 <= t < END
        if tense:
            # Muammo: past "yurak urishi" (dum) va frigiy rangdagi tarang ostinato (D – Eb – D – C)
            if in_bar in (0, 2):
                add(dum(), t, 0.5, music=True)
            add(strings2(hz(['D3', 'D#3', 'D3', 'C3'][in_bar]), 0.6, bright=0.3), t, 0.16, pan=-0.2, music=True)
            continue
        # Bas va to'rtlik akkord zarbalari
        if in_bar == 0 or (full and in_bar == 2):
            add(bass_note(hz(root), 0.5, 0.25), t, 0.32 if full else 0.2, music=True)
        if full and in_bar in (1, 3):
            for i, n in enumerate(chord):
                add(strings2(hz(n), 0.5, bright=0.55), t + i * 0.014, 0.05, pan=0.3, music=True)
        # Doira
        for e in range(2):
            hit = DOIRA[(in_bar * 2 + e) % 8]
            te = t + e * beat / 2
            if hit == 'D' and (full or intro):
                add(dum(), te, 0.55 if full else 0.42, music=True)
            if hit == 'T' and (full or intro):
                add(tak(), te, 0.28 if full else 0.16, pan=0.25, music=True)
            if full and hit in ('T', 'z'):
                add(zil(), te, 0.07, pan=-0.3, music=True)
        # Kuy: har 4 taktda takrorlanadi; ikkinchi aylanishda bir oktava yuqorida
        cycle = (bar // 4) % 2
        for (pos, n, ln) in BOZOR_MELODY:
            if b % 16 <= pos < b % 16 + 1:
                tn = t + (pos - int(pos)) * beat
                if tn < END:
                    add(strings2(hz(octave(n, cycle if full else 0)), ln * beat + 0.5, bright=0.75), tn,
                        0.24 if full else 0.3, pan=-0.15, music=True)
    # Yakun: D major akkord (yuqoriga tez chertish), doira zarbasi va zil
    land = END + 0.46
    for i, n in enumerate(['D3', 'A3', 'D4', 'F#4', 'A4', 'D5']):
        add(strings2(hz(n), 3.0, bright=0.8), land + i * 0.03, 0.17, pan=(i - 2.5) / 4, music=True)
    add(bass_note(hz('D2'), 2.5, 0.9), land, 0.35, music=True)
    add(dum(), land, 0.7, music=True)
    for i in range(3):
        add(zil(), land + 0.1 + i * 0.12, 0.08 - i * 0.02, pan=0.3, music=True)


# --- 2-variant "Quvnoq": yorqin reklama-pop, 124 BPM, C – F – C – G, marimba, chapak, shaker ---
QUVNOQ_MELODY = [
    (0, 'E5', .5), (.5, 'G5', .5), (1, 'E5', .5), (1.5, 'C5', .5), (2, 'D5', .5), (2.5, 'E5', .5), (3, 'C5', 1),
    (4, 'F5', .5), (4.5, 'A5', .5), (5, 'F5', .5), (5.5, 'C5', .5), (6, 'E5', .5), (6.5, 'D5', .5), (7, 'C5', 1),
    (8, 'E5', .5), (8.5, 'G5', .5), (9, 'E5', .5), (9.5, 'C5', .5), (10, 'D5', .5), (10.5, 'E5', .5), (11, 'G5', 1),
    (12, 'B4', .5), (12.5, 'D5', .5), (13, 'G5', .5), (13.5, 'F5', .5), (14, 'E5', .5), (14.5, 'D5', .5), (15, 'C5', 1),
]
QUVNOQ_CHORDS = [('C2', ['C4', 'E4', 'G4']), ('F2', ['F3', 'A3', 'C4']), ('C2', ['C4', 'E4', 'G4']), ('G2', ['G3', 'B3', 'D4'])]


def music_quvnoq():
    beat = 60 / 124
    p1, p2 = snap_to_beat(S[1], beat), snap_to_beat(S[2], beat)
    beats = int(END / beat)
    for b in range(beats):
        t = b * beat
        bar, in_bar = b // 4, b % 4
        root, chord = QUVNOQ_CHORDS[bar % 4]
        intro, tense, full = t < p1, p1 <= t < p2, p2 <= t < END
        if tense:
            # Muammo: soat chiqillashi va past tarang bas (F – E almashinadi)
            add(tick(), t, 0.18, pan=0.3, music=True)
            if in_bar in (0, 2):
                add(bass_note(hz(['F2', 'E2'][(b // 2) % 2]), 0.45, 0.2), t, 0.3, music=True)
            if in_bar == 0:
                add(marimba(hz(['G#4', 'G4'][(bar) % 2]), 0.6), t + beat / 2, 0.12, music=True)
            continue
        # Bas: 1- va 3-zarbda, 2-zarbning "va"sida (sakrovchi)
        if in_bar in (0, 1, 2):
            add(bass_note(hz(root), 0.4, 0.16), t + (beat / 2 if in_bar == 1 else 0), 0.3 if full else 0.18, music=True)
        # Zarbdan keyingi akkord "chertishlari" (marimba)
        for i, n in enumerate(chord):
            add(marimba(hz(n), 0.35), t + beat / 2 + i * 0.006, 0.055 if full else 0.045, pan=0.35, music=True)
        if full:
            if in_bar in (0, 2):
                add(kick(), t, 0.45, music=True)
            if in_bar in (1, 3):
                add(clap(), t, 0.2, pan=-0.1, music=True)
                add(snap(), t + 0.01, 0.1, pan=0.4, music=True)
            for q in range(4):
                add(shaker(1.0 if q % 2 else 0.55), t + q * beat / 4, 0.05, pan=0.45, music=True)
        elif intro and in_bar in (1, 3):
            add(snap(), t, 0.14, pan=0.3, music=True)
        # Kuy
        for (pos, n, ln) in QUVNOQ_MELODY:
            if b % 16 <= pos < b % 16 + 1:
                tn = t + (pos - int(pos)) * beat
                if tn < END:
                    add(marimba(hz(n), 0.7), tn, 0.3 if full else 0.24, pan=-0.15, music=True)
    # Yakun: "ta-da" — marimba yuqoriga arpedjio, chapak va katta C major akkord
    land = END + 0.46
    for i, n in enumerate(['C4', 'E4', 'G4', 'C5', 'E5', 'G5', 'C6']):
        add(marimba(hz(n), 1.6), land - 0.3 + i * 0.05, 0.22, pan=(i - 3) / 4, music=True)
    for n in ['C3', 'G3', 'C4', 'E4']:
        add(marimba(hz(n), 2.2), land + 0.06, 0.16, music=True)
    add(bass_note(hz('C2'), 2.4, 0.8), land, 0.35, music=True)
    add(kick(), land, 0.55, music=True)
    add(clap(), land, 0.3, music=True)


STYLES = {'bozor': music_bozor, 'quvnoq': music_quvnoq}


def effects():
    # 1-sahna: matn va tugmalar
    add(thunk(), 0.02, 0.35)
    for t in (0.6, 0.82):
        add(swish(), t, 0.10, pan=0.2)
    for i in range(3):
        add(pop(560 + 120 * i), 1.38 + i * 0.16, 0.30, pan=-0.4 + 0.4 * i)
    # Sahna almashuvlari
    for s in S[1:]:
        l, r = whoosh()
        add(l, s - R.HALF, 0.42, pan=-1)
        add(r, s - R.HALF, 0.42, pan=1)
    # 2-sahna: xabarlar va muhr
    for i, t in enumerate(R.BUB_T):
        right = i in (1, 4)  # o'ng tomondagi (javob) pufakchalar: render.py dagi p_bub tartibida
        add(bloop(990 if right else 760), S[1] + t + 0.02, 0.26, pan=0.5 if right else -0.5)
    add(swish(), S[1] + 3.15, 0.22)
    add(impact(), S[1] + 3.42, 0.75)
    # 3-sahna: yorliqlar tushadi, tugma bosiladi
    for i, t in enumerate(R.TAG_T):
        add(thunk(), S[2] + t + 0.3, 0.4, pan=(i - 1) * 0.6)
    add(swish(), S[2] + 2.2, 0.1)
    add(pop(700), S[2] + 3.05, 0.3)
    add(tick(), S[2] + 3.78, 0.35)
    add(bell(hz('E6'), 0.8, 0.25), S[2] + 3.9, 0.16, pan=0.2)
    add(bell(hz('A6'), 1.0, 0.3), S[2] + 4.02, 0.16, pan=0.2)
    # 4-sahna: arizalar, qabul, "Keldi", muhr
    for i, t in enumerate(R.ROW_T):
        add(tick(), S[3] + t + 0.05, 0.22, pan=0.3)
    for i, (row, t) in enumerate(sorted(R.ACCEPT.items(), key=lambda x: x[1])):
        add(bell(hz(['C6', 'E6', 'G6'][i]), 0.9, 0.3), S[3] + t, 0.15, pan=0.4)
    add(bonk(), S[3] + 3.0, 0.3, pan=0.4)
    for i, (row, t) in enumerate(sorted(R.CAME.items(), key=lambda x: x[1])):
        add(bell(hz(['G6', 'C7', 'E7'][i]), 0.9, 0.3), S[3] + t, 0.14, pan=0.4)
    for t in (1.9, 3.45):
        add(swish(), S[3] + t, 0.08)
    add(swish(), S[3] + 4.35, 0.2)
    add(impact(), S[3] + 4.58, 0.6)
    # 5-sahna: kartochkalar (pentatonik zinapoya)
    for i, n in enumerate(['C5', 'D5', 'E5', 'G5', 'A5', 'C6']):
        add(pop(hz(n)), S[4] + 0.6 + 0.2 * i + 0.06, 0.28, pan=-0.4 if i % 2 == 0 else 0.4)
    add(swish(), S[4] + 2.2, 0.1)
    # 6-sahna: yakuniy yorliq
    add(thunk(), END + 0.46, 0.45)
    add(swish(), END + 0.8, 0.1)
    add(pop(800), END + 1.42, 0.3)
    add(bell(hz('C6'), 1.6, 0.6), END + 1.5, 0.14, pan=-0.2)
    add(bell(hz('G6'), 1.6, 0.6), END + 1.62, 0.12, pan=0.2)


def reset():
    global L, Rt, ML, MR
    L, Rt = array('d', bytes(8 * N)), array('d', bytes(8 * N))
    ML, MR = array('d', bytes(8 * N)), array('d', bytes(8 * N))


def mixdown(path, style='bozor'):
    reset()
    STYLES[style]()
    # Musiqaga yengil aks-sado (375 ms, stereo almashinadi)
    d = int(0.375 * SR)
    for i in range(d, N):
        ML[i] += 0.22 * MR[i - d]
        MR[i] += 0.22 * ML[i - d]
    effects()
    # Oxirgi soniyada sekin o'chish
    fade0 = int((R.DUR - 1.2) * SR)
    sq = 0.0
    for i in range(N):
        g = 1.0 if i < fade0 else max(0.0, 1 - (i - fade0) / (N - fade0)) ** 1.5
        L[i] = (L[i] + 0.85 * ML[i]) * g
        Rt[i] = (Rt[i] + 0.85 * MR[i]) * g
        sq += L[i] * L[i] + Rt[i] * Rt[i]
    # Ijtimoiy tarmoqlar darajasi: o'rtacha −16 dBFS; cho'qqilar yumshoq cheklanadi (0.6 dan yuqorisi siqiladi, shift 0.95)
    k = 10 ** (-16 / 20) / math.sqrt(sq / (2 * N))
    T, CEIL = 0.6, 0.95

    def soft(x):
        a = abs(x)
        return x if a <= T else math.copysign(T + (CEIL - T) * math.tanh((a - T) / (CEIL - T)), x)

    out = bytearray()
    sq, peak = 0.0, 0.0
    for i in range(N):
        a, b = soft(L[i] * k), soft(Rt[i] * k)
        sq += a * a + b * b
        peak = max(peak, abs(a), abs(b))
        out += struct.pack('<hh', int(a * 32767), int(b * 32767))
    with open(path, 'wb') as f:
        f.write(b'RIFF' + struct.pack('<I', 36 + len(out)) + b'WAVEfmt ' + struct.pack('<IHHIIHH', 16, 1, 2, SR, SR * 4, 4, 16))
        f.write(b'data' + struct.pack('<I', len(out)) + out)
    rms = math.sqrt(sq / (2 * N))
    return peak, 20 * math.log10(rms) if rms else -99


if __name__ == '__main__':
    import time
    t0 = time.time()
    out = os.path.join(R.HERE, 'smena-audio.wav')
    import sys
    peak, rms_db = mixdown(out, sys.argv[1] if len(sys.argv) > 1 else 'bozor')
    print(f'{out}: cho‘qqi {20 * math.log10(peak):.1f} dBFS, o‘rtacha {rms_db:.1f} dBFS, {time.time() - t0:.0f} s')
