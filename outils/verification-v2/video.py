"""Prise « iPhone » : portrait 1080×1920 affiché, stocké 1920×1080 + rotation, HEVC Main10 HLG BT.2020, 30000/1001 i/s.
Visage réel (photo), bouche animée par la voix, grain, code-barres Gray 12 bits = numéro d'image source."""
import json, subprocess, sys, os
import numpy as np, cv2
D = sys.argv[1]
W, H = 1080, 1920
FPS = 30000 / 1001
info = json.load(open(os.path.join(D, "mots.json")))
env = np.load(os.path.join(D, "enveloppe.npy"))
N = int(info["dureeSec"] * FPS)
photo = cv2.cvtColor(cv2.imread(sys.argv[2]), cv2.COLOR_BGR2RGB).astype(np.float32) / 255
ech = W / photo.shape[1]
ph = cv2.resize(photo, (W, int(photo.shape[0] * ech)), interpolation=cv2.INTER_AREA)
fond = np.ones((H, W, 3), np.float32) * np.array([0.80, 0.78, 0.74], np.float32)  # mur clair un peu chaud
y0 = 180
fond[y0:y0 + ph.shape[0]] = ph[: H - y0]
bouche = (int(505 * ech), int(y0 + 385 * ech))
# Couleurs : sRGB (≈ gamma 2,4) → linéaire BT.709 → BT.2020 → OOTF inverse HLG (blanc SDR = 203 cd/m²) → OETF HLG
M = np.array([[0.6274, 0.3293, 0.0433], [0.0691, 0.9195, 0.0114], [0.0164, 0.0880, 0.8956]], np.float32)
a, b, c = 0.17883277, 0.28466892, 0.55991073
def vers_hlg(rgb):
    lin = np.clip(rgb, 0, 1) ** 2.4
    l2020 = lin @ M.T
    Fd = l2020 * (203 / 1000)
    Yd = (Fd @ np.array([0.2627, 0.6780, 0.0593], np.float32))[..., None]
    E = Fd * np.power(np.maximum(Yd, 1e-6), (1 - 1.2) / 1.2)
    E = np.clip(E, 0, 1)
    return np.where(E <= 1 / 12, np.sqrt(3 * E), a * np.log(np.maximum(12 * E - b, 1e-6)) + c).astype(np.float32)
def vers_ycbcr10(rgb):
    kr, kb = 0.2627, 0.0593; kg = 1 - kr - kb
    Y = kr * rgb[..., 0] + kg * rgb[..., 1] + kb * rgb[..., 2]
    Cb = (rgb[..., 2] - Y) / (2 * (1 - kb)); Cr = (rgb[..., 0] - Y) / (2 * (1 - kr))
    return [np.clip(np.round(v), 0, 1023).astype(np.uint16) for v in (64 + 876 * Y, 512 + 896 * Cb, 512 + 896 * Cr)]
rng = np.random.default_rng(3)
grains = [rng.normal(0, 0.012, (H, W, 1)).astype(np.float32) for _ in range(6)]
cmd = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "yuv444p10le", "-s", f"{H}x{W}", "-r", "30000/1001", "-i", "pipe:0",
       "-vf", "format=yuv420p10le", "-c:v", "libx265", "-preset", "ultrafast", "-crf", "18", "-tag:v", "hvc1",
       "-x265-params", "log-level=error:colorprim=bt2020:transfer=arib-std-b67:colormatrix=bt2020nc:range=limited",
       "-color_primaries", "bt2020", "-color_trc", "arib-std-b67", "-colorspace", "bt2020nc", "-color_range", "tv", os.path.join(D, "stocke.mp4")]
p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
base = fond.copy()
for i in range(N):
    t = i / FPS
    f = base.copy()
    e = float(env[min(len(env) - 1, int(t * 1000))])
    ouv = int(np.clip(e / 0.05, 0, 1) * 20)
    if ouv > 1:
        cv2.ellipse(f, bouche, (26, ouv), 0, 0, 360, (0.25, 0.05, 0.06), -1, cv2.LINE_AA)
    f += grains[i % 6]
    g = i ^ (i >> 1)
    for k in range(12):
        v = 1.0 if (g >> (11 - k)) & 1 else 0.0
        f[1000:1048, 180 + k * 60:228 + k * 60] = v
    hlg = vers_hlg(f)
    stocke = np.ascontiguousarray(np.rot90(hlg, 1))  # portrait → paysage (tourné de 90° à gauche)
    p.stdin.write(b"".join(pl.tobytes() for pl in vers_ycbcr10(stocke)))
p.stdin.close(); p.wait()
print("images", N)
