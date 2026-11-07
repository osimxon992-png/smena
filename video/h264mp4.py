# Pillow kadrlaridan H.264 MP4: kodlash tizimdagi libx264 (ctypes orqali), MP4 konteyneri qo'lda yoziladi.
# ffmpeg yo'q bo'lgan kompyuter uchun. Rang: BT.709, cheklangan diapazon (16–235), 4:2:0.
import ctypes
import os
import struct

from PIL import Image

X264 = ctypes.CDLL('libx264.so.165')
X264_CSP_I420 = 0x0002
c_void_p, c_char_p, c_int = ctypes.c_void_p, ctypes.c_char_p, ctypes.c_int
X264.x264_param_default_preset.argtypes = [c_void_p, c_char_p, c_char_p]
X264.x264_param_parse.argtypes = [c_void_p, c_char_p, c_char_p]
X264.x264_param_apply_profile.argtypes = [c_void_p, c_char_p]
X264.x264_encoder_open_165.argtypes = [c_void_p]
X264.x264_encoder_open_165.restype = c_void_p
X264.x264_encoder_headers.argtypes = [c_void_p, c_void_p, c_void_p]
X264.x264_encoder_encode.argtypes = [c_void_p, c_void_p, c_void_p, c_void_p, c_void_p]
X264.x264_encoder_delayed_frames.argtypes = [c_void_p]
X264.x264_encoder_close.argtypes = [c_void_p]
X264.x264_picture_alloc.argtypes = [c_void_p, c_int, c_int, c_int]
X264.x264_picture_clean.argtypes = [c_void_p]


# x264_nal_t: i_ref_idc, i_type, b_long_startcode, i_first_mb, i_last_mb, i_payload, p_payload, i_padding
class Nal(ctypes.Structure):
    _fields_ = [('i_ref_idc', c_int), ('i_type', c_int), ('b_long_startcode', c_int), ('i_first_mb', c_int),
                ('i_last_mb', c_int), ('i_payload', c_int), ('p_payload', ctypes.POINTER(ctypes.c_ubyte)), ('i_padding', c_int)]


# x264_param_t / x264_picture_t maydonlari (build 165): i_width 28, i_height 32, i_csp 36, i_bitdepth 40;
# rasm: b_keyframe 12, i_pts 16, img.i_stride[] 48, img.plane[] 64
P_WIDTH, P_HEIGHT, P_CSP, P_DEPTH = 28, 32, 36, 40
PIC_KEY, PIC_PTS, PIC_STRIDE, PIC_PLANE = 12, 16, 48, 64

# RGB → Y'CbCr (BT.709, 16–235) bitta C amalida: Pillow'ning 12 sonli matritsasi (har kanalga ofset bilan)
BT709 = (0.18259, 0.61423, 0.06201, 16,
         -0.10064, -0.33857, 0.43922, 128,
         0.43922, -0.39894, -0.04027, 128)


def i420(img):
    """RGB Pillow rasmidan Y, U, V tekisliklari (baytlar)."""
    y, cb, cr = img.convert('RGB', BT709).split()
    half = (img.width // 2, img.height // 2)
    return y.tobytes(), cb.resize(half, Image.BOX).tobytes(), cr.resize(half, Image.BOX).tobytes()


def split_annexb(data):
    """Annex B oqimidan NAL birliklari (boshlang'ich kodlarsiz)."""
    starts, i = [], 0
    while (j := data.find(b'\x00\x00\x01', i)) >= 0:
        starts.append(j + 3)
        i = j + 3
    out = []
    for k, s in enumerate(starts):
        end = starts[k + 1] - 3 if k + 1 < len(starts) else len(data)
        # 4 baytli boshlang'ich kodning birinchi noli oldingi NAL'ga yopishmasin
        while k + 1 < len(starts) and end > s and data[end - 1] == 0:
            end -= 1
        out.append(data[s:end])
    return out


class Encoder:
    def __init__(self, path, width, height, fps=30, crf=18, preset='medium'):
        assert width % 2 == 0 and height % 2 == 0
        self.path, self.w, self.h, self.fps = path, width, height, fps
        self.param = p = ctypes.create_string_buffer(8192)
        assert X264.x264_param_default_preset(p, preset.encode(), None) == 0
        # Maydon joylashuvini tekshirish: noto'g'ri bo'lsa, xotirani buzmasdan to'xtaymiz
        csp = ctypes.c_int.from_buffer(p, P_CSP).value
        depth = ctypes.c_int.from_buffer(p, P_DEPTH).value
        assert csp == X264_CSP_I420 and depth == 8, ('x264_param_t joylashuvi kutilganidek emas', csp, depth)
        ctypes.c_int.from_buffer(p, P_WIDTH).value = width
        ctypes.c_int.from_buffer(p, P_HEIGHT).value = height
        for k, v in [('fps', str(fps)), ('force-cfr', '1'), ('crf', str(crf)), ('bframes', '0'), ('keyint', str(fps * 2)),
                     ('min-keyint', str(fps)), ('repeat-headers', '0'), ('colorprim', 'bt709'), ('transfer', 'bt709'),
                     ('colormatrix', 'bt709'), ('fullrange', 'off'), ('threads', 'auto')]:
            assert X264.x264_param_parse(p, k.encode(), v.encode()) == 0, k
        assert X264.x264_param_apply_profile(p, b'high') == 0
        self.enc = X264.x264_encoder_open_165(p)
        assert self.enc, 'x264_encoder_open xato'
        nal, n = ctypes.POINTER(Nal)(), c_int()
        assert X264.x264_encoder_headers(self.enc, ctypes.byref(nal), ctypes.byref(n)) > 0
        heads = {nal[i].i_type: ctypes.string_at(nal[i].p_payload, nal[i].i_payload) for i in range(n.value)}
        self.sps, self.pps = split_annexb(heads[7])[0], split_annexb(heads[8])[0]
        self.pic = ctypes.create_string_buffer(4096)
        assert X264.x264_picture_alloc(self.pic, X264_CSP_I420, width, height) == 0
        self.out_pic = ctypes.create_string_buffer(4096)
        self.sizes, self.keys, self.count = [], [], 0
        self.mdat = open(path + '.mdat', 'wb')

    def add(self, img):
        assert img.size == (self.w, self.h) and img.mode == 'RGB'
        self.add_planes(i420(img))

    # Tayyor Y, U, V tekisliklari (kadrlar boshqa jarayonlarda chizilib, i420() bilan o'girilganda)
    def add_planes(self, yuv):
        strides = [ctypes.c_int.from_buffer(self.pic, PIC_STRIDE + 4 * i).value for i in range(3)]
        planes = [ctypes.c_void_p.from_buffer(self.pic, PIC_PLANE + 8 * i).value for i in range(3)]
        for k, data in enumerate(yuv):
            width, rows = (self.w, self.h) if k == 0 else (self.w // 2, self.h // 2)
            if strides[k] == width:
                ctypes.memmove(planes[k], data, len(data))
            else:
                for r in range(rows):
                    ctypes.memmove(planes[k] + r * strides[k], data[r * width:(r + 1) * width], width)
        ctypes.c_int64.from_buffer(self.pic, PIC_PTS).value = self.count
        self.count += 1
        self._encode(self.pic)

    def _encode(self, pic):
        nal, n = ctypes.POINTER(Nal)(), c_int()
        size = X264.x264_encoder_encode(self.enc, ctypes.byref(nal), ctypes.byref(n), pic, self.out_pic)
        assert size >= 0, 'x264_encoder_encode xato'
        if size == 0:
            return
        # Bitta kadrning NAL'lari xotirada ketma-ket turadi
        data = ctypes.string_at(nal[0].p_payload, size)
        sample = b''.join(struct.pack('>I', len(u)) + u for u in split_annexb(data) if u[0] & 0x1F not in (7, 8))
        self.mdat.write(sample)
        self.sizes.append(len(sample))
        self.keys.append(bool(ctypes.c_int.from_buffer(self.out_pic, PIC_KEY).value))

    def close(self):
        while X264.x264_encoder_delayed_frames(self.enc) > 0:
            self._encode(None)
        X264.x264_picture_clean(self.pic)
        X264.x264_encoder_close(self.enc)
        self.mdat.close()
        write_mp4(self.path, self.path + '.mdat', self.w, self.h, self.fps, self.sps, self.pps, self.sizes, self.keys)


def box(kind, *parts):
    body = b''.join(parts)
    return struct.pack('>I', 8 + len(body)) + kind + body


def full(kind, version, flags, *parts):
    return box(kind, struct.pack('>I', (version << 24) | flags), *parts)


# ISO BMFF (MP4): moov oldinda (faststart — internetda darhol o'ynaydi), barcha kadrlar bitta bo'lakda
def write_mp4(path, mdat_path, w, h, fps, sps, pps, sizes, keys):
    TS = 15360  # ffmpeg kabi vaqt shkalasi: 30 fps da 1 kadr = 512 birlik
    delta, n = TS // fps, len(sizes)
    dur_media, dur_movie = n * delta, n * 1000 // fps
    matrix = struct.pack('>9I', 0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000)
    avcc = box(b'avcC', bytes([1, sps[1], sps[2], sps[3], 0xFF, 0xE1]), struct.pack('>H', len(sps)), sps,
               bytes([1]), struct.pack('>H', len(pps)), pps, bytes([0xFD, 0xF8, 0xF8, 0x00]))
    colr = box(b'colr', b'nclx', struct.pack('>HHHB', 1, 1, 1, 0))  # BT.709, cheklangan diapazon
    avc1 = box(b'avc1', b'\x00' * 6, struct.pack('>H', 1), b'\x00' * 16, struct.pack('>HH', w, h),
               struct.pack('>II', 0x00480000, 0x00480000), b'\x00' * 4, struct.pack('>H', 1),
               b'\x00' * 32, struct.pack('>Hh', 0x18, -1), avcc, colr, box(b'pasp', struct.pack('>II', 1, 1)))
    key_ids = [i + 1 for i, k in enumerate(keys) if k]
    stbl_head = [
        full(b'stsd', 0, 0, struct.pack('>I', 1), avc1),
        full(b'stts', 0, 0, struct.pack('>III', 1, n, delta)),
        full(b'stss', 0, 0, struct.pack('>I', len(key_ids)), b''.join(struct.pack('>I', k) for k in key_ids)),
        full(b'stsc', 0, 0, struct.pack('>IIII', 1, 1, n, 1)),
        full(b'stsz', 0, 0, struct.pack('>II', 0, n), b''.join(struct.pack('>I', s) for s in sizes)),
    ]

    def moov(offset):
        stbl = box(b'stbl', *stbl_head, full(b'stco', 0, 0, struct.pack('>II', 1, offset)))
        dinf = box(b'dinf', full(b'dref', 0, 0, struct.pack('>I', 1), full(b'url ', 0, 1)))
        minf = box(b'minf', full(b'vmhd', 0, 1, b'\x00' * 8), dinf, stbl)
        hdlr = full(b'hdlr', 0, 0, b'\x00' * 4, b'vide', b'\x00' * 12, b'VideoHandler\x00')
        mdhd = full(b'mdhd', 0, 0, struct.pack('>IIII', 0, 0, TS, dur_media), struct.pack('>HH', 0x55C4, 0))
        tkhd = full(b'tkhd', 0, 3, struct.pack('>IIIII', 0, 0, 1, 0, dur_movie), b'\x00' * 8,
                    struct.pack('>hhhH', 0, 0, 0, 0), matrix, struct.pack('>II', w << 16, h << 16))
        mvhd = full(b'mvhd', 0, 0, struct.pack('>IIII', 0, 0, 1000, dur_movie), struct.pack('>IH', 0x00010000, 0x0100),
                    b'\x00' * 10, matrix, b'\x00' * 24, struct.pack('>I', 2))
        return box(b'moov', mvhd, box(b'trak', tkhd, box(b'mdia', mdhd, hdlr, minf)))

    ftyp = box(b'ftyp', b'isom', struct.pack('>I', 0x200), b'isom', b'iso2', b'avc1', b'mp41')
    offset = len(ftyp) + len(moov(0)) + 8  # ma'lumot moov va mdat sarlavhasidan keyin boshlanadi
    with open(path, 'wb') as f, open(mdat_path, 'rb') as m:
        f.write(ftyp + moov(offset) + struct.pack('>I', 8 + os.path.getsize(mdat_path)) + b'mdat')
        while chunk := m.read(1 << 20):
            f.write(chunk)
    os.remove(mdat_path)
