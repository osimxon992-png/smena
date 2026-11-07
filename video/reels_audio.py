# reels.py videosining ovozi: zamonaviy, zarbdor beat (120 BPM, A minor) va kesimlarga mos effektlar.
# Asboblar audio.py dan olinadi; hamma narsa sintez qilinadi, tayyor yozuv ishlatilmaydi.
import math
import random
import struct
from array import array

import audio as A
import reels as V

SR = A.SR
N = int(V.DUR * SR)
BEAT = 0.5
L = R = ML = MR = None


def add(samples, t, gain=1.0, pan=0.0, music=False):
    i0 = int(t * SR)
    gl, gr = gain * math.cos((pan + 1) * math.pi / 4) * 1.414, gain * math.sin((pan + 1) * math.pi / 4) * 1.414
    bl, br = (ML, MR) if music else (L, R)
    for k, v in enumerate(samples):
        i = i0 + k
        if 0 <= i < N:
            bl[i] += v * gl
            br[i] += v * gr


def k808(f=55.0, dur=0.6):
    """808 uslubidagi zarb: past chastotaga sirpanuvchi ton va bosh qismida "chertish"."""
    body = A.tone(f * 2.4, f, dur, 0.22, (1.0, 0.18))
    click = A.noise(dur, 0.004, lp=0.6)
    return [math.tanh(1.4 * (a + 0.5 * b)) for a, b in zip(body, click)]


def riser(dur=0.55):
    n = int(dur * SR)
    out, y = [], 0.0
    for k in range(n):
        p = k / n
        y += (0.02 + 0.5 * p * p) * (random.uniform(-1, 1) - y)
        out.append(y * p ** 1.5)
    return out


ROOTS = ['A1', 'F1', 'C2', 'G1']
HOOK = [('E5', 0), ('C5', 1), ('D5', 1.5), ('E5', 2), ('G5', 3), ('E5', 3.5)]
HOOK2 = [('A5', 0), ('G5', 1), ('E5', 1.5), ('D5', 2), ('E5', 3), ('C5', 3.5)]


def music():
    end_drums = 16.5
    t = 0.0
    while t < V.DUR - 0.01:
        bar = int(t // 2 + 1e-9)
        in_bar = round((t % 2) / BEAT)
        intro, tense, full, cta = t < 2.0, 2.0 <= t < 8.0, 8.0 <= t < end_drums, t >= 17.0
        root = A.hz(ROOTS[bar % 4])
        drums = intro or tense or full or (cta and t < 20.0)
        if drums:
            if in_bar == 0:
                add(k808(root), t, 0.55, music=True)
            if in_bar == 1:
                add(A.clap(), t, 0.22, pan=-0.05, music=True)
            if in_bar == 3:
                add(A.clap(), t, 0.22, pan=0.05, music=True)
                add(A.kick(), t + BEAT / 2, 0.3, music=True)
            if in_bar == 2:
                add(A.kick(), t + BEAT / 2, 0.32, music=True)
            # Xetlar: sakkizliklar; har ikkinchi taktning oxirida tez "roll"
            for q in range(2):
                add(A.hat(0.025), t + q * BEAT / 2, 0.06 if q else 0.04, pan=0.35, music=True)
            if bar % 2 == 1 and in_bar == 3:
                for q in range(4):
                    add(A.hat(0.015), t + q * BEAT / 4, 0.045, pan=0.35, music=True)
        # Qorong'i qism: past tarang "pad" (taktning boshida)
        if tense and in_bar == 0:
            for n in ('A3', 'C4', 'E4'):
                add(A.tone(A.hz(n), A.hz(n), 1.9, 0.9, (1.0, 0.3, 0.1), attack=0.25), t, 0.035, music=True)
        # Kuy (hook): kirish, yechim qismi va yakun
        if (intro or full or cta) and in_bar == 0:
            for n, b in (HOOK2 if bar % 2 else HOOK):
                tn = t + b * BEAT
                if tn < V.DUR - 0.6 and not (end_drums <= tn < 17.0):
                    add(A.pluck(A.hz(n), 0.5, bright=0.95), tn, 0.16, pan=-0.2, music=True)
                    add(A.pluck(A.hz(n[:-1] + str(int(n[-1]) - 1)), 0.5, bright=0.7), tn, 0.08, pan=0.25, music=True)
        t += BEAT
    # CTA oldidan: jimlik va ko'tariluvchi shovqin, keyin zarba
    add(riser(), 16.45, 0.35, music=True)
    add(A.impact(), 17.0, 0.6, music=True)
    add(k808(55, 1.4), 17.0, 0.6, music=True)
    # Yakuniy akkord
    for i, n in enumerate(['A2', 'E3', 'A3', 'C4', 'E4', 'A4']):
        add(A.pluck(A.hz(n), 2.2, bright=0.8), 20.0 + i * 0.02, 0.13, pan=(i - 2.5) / 4, music=True)


def effects():
    # Har bir kesimda qisqa "whoosh"
    for c in V.B[1:-1]:
        l, r = A.whoosh(0.32)
        add(l, c - 0.16, 0.28, pan=-1)
        add(r, c - 0.16, 0.28, pan=1)
    # Qizil kalit so'zlar chiqqanda yumshoq "chertish"
    keys = [0.35, 0.53, 2.0 + 0.28, 3.5 + 0.24, 3.5 + 0.98, 5.0 + 0.4, 6.5 + 0.1, 6.5 + 0.74, 10.0 + 0.6, 11.5 + 0.05,
            14.0 + 0.3, 15.5 + 0.26, 17.0 + 0.3]
    for k in keys:
        add(A.tick(), k, 0.16, pan=0.15)
        add(A.pop(900), k, 0.09)
    add(A.pop(560), 0.55, 0.22)  # pul emojisi
    add(A.swish(), 2.0 + 0.62, 0.18)  # "hali topilmadi"
    add(A.pop(480), 5.0 + 0.08, 0.3)  # 🤯
    add(A.thunk(), 6.5 + 0.05, 0.3)  # pul dastalari
    add(A.thunk(), 8.0 + 0.02, 0.35)  # mixlangan kartochka
    for i, t in enumerate([0.45, 0.8, 1.15]):
        add(A.bell(A.hz(['E6', 'G6', 'C7'][i]), 0.6, 0.18), 8.0 + t, 0.08, pan=0.3)
    add(A.swish(), 10.0, 0.2)
    add(A.pop(700), 10.25, 0.25)  # logotip
    add(A.tick(), 12.5 + 0.84, 0.35)  # tugma bosildi
    add(A.bell(A.hz('E6'), 0.7, 0.22), 12.5 + 0.94, 0.12)
    add(A.bell(A.hz('A6'), 0.9, 0.28), 12.5 + 1.06, 0.12)
    add(A.swish(), 14.0, 0.22)  # telefon
    add(A.bell(A.hz('G6'), 0.6, 0.2), 14.0 + 0.62, 0.13, pan=0.3)  # bildirishnoma
    add(A.bell(A.hz('C7'), 0.8, 0.25), 14.0 + 0.74, 0.13, pan=0.3)
    add(A.pop(520), 15.5 + 0.22, 0.3)  # 😎
    add(A.pop(640), 17.0 + 1.02, 0.28)  # QR
    add(A.tick(), 17.0 + 1.42, 0.2)


def mixdown(path):
    global L, R, ML, MR
    L, R = array('d', bytes(8 * N)), array('d', bytes(8 * N))
    ML, MR = array('d', bytes(8 * N)), array('d', bytes(8 * N))
    random.seed(5)
    music()
    d = int(0.25 * SR)  # musiqaga qisqa aks-sado
    for i in range(d, N):
        ML[i] += 0.16 * MR[i - d]
        MR[i] += 0.16 * ML[i - d]
    effects()
    fade0 = int((V.DUR - 0.8) * SR)
    sq = 0.0
    for i in range(N):
        g = 1.0 if i < fade0 else max(0.0, 1 - (i - fade0) / (N - fade0)) ** 1.5
        L[i] = (L[i] + 0.9 * ML[i]) * g
        R[i] = (R[i] + 0.9 * MR[i]) * g
        sq += L[i] * L[i] + R[i] * R[i]
    k = 10 ** (-15 / 20) / math.sqrt(sq / (2 * N))
    T, CEIL = 0.6, 0.95

    def soft(x):
        a = abs(x)
        return x if a <= T else math.copysign(T + (CEIL - T) * math.tanh((a - T) / (CEIL - T)), x)

    out = bytearray()
    sq, peak = 0.0, 0.0
    for i in range(N):
        a, b = soft(L[i] * k), soft(R[i] * k)
        sq += a * a + b * b
        peak = max(peak, abs(a), abs(b))
        out += struct.pack('<hh', int(a * 32767), int(b * 32767))
    with open(path, 'wb') as f:
        f.write(b'RIFF' + struct.pack('<I', 36 + len(out)) + b'WAVEfmt ' + struct.pack('<IHHIIHH', 16, 1, 2, SR, SR * 4, 4, 16))
        f.write(b'data' + struct.pack('<I', len(out)) + out)
    return peak, 20 * math.log10(math.sqrt(sq / (2 * N)))
