"""Analyse de la piste montée : pour chaque image, le numéro d'image SOURCE lu dans le code-barres ; pour l'audio, la
position dans le son SOURCE retrouvée par corrélation. Compare aux plans / gardes de la chaîne (synchro, dérive)."""
import json, subprocess, sys
import numpy as np
montage, etat_chemin = sys.argv[1], sys.argv[2]
FPS_SRC = 30000 / 1001
etat = json.load(open(etat_chemin))
plans = etat["plans"]; gardes = etat["coupes"]["gardes"]
W, H = 1080, 1920
r = subprocess.run(["ffmpeg", "-v", "error", "-i", montage, "-an", "-f", "rawvideo", "-pix_fmt", "gray", "pipe:1"], capture_output=True, check=True)
images = np.frombuffer(r.stdout, np.uint8).reshape(-1, H, W)
n = len(images)
# plans → bornes en images (comme l'étape cadrage)
bornes, cumul = [], 0
for p in plans:
    fin = int(round(p["finSec"] * 25)); k = max(1, fin - cumul); bornes.append((cumul, cumul + k, int(round(p["priseDebutSec"] * 25)), p)); cumul += k
ecarts, illisibles = [], 0
for (a, b, d0, p) in bornes:
    c = p["cadre"]
    for i in range(a, min(b, n)):
        bits = []
        for k in range(12):
            sx, sy = 204 + 60 * k, 1024
            ox, oy = (sx - c["x"]) * W / c["largeur"], (sy - c["y"]) * H / c["hauteur"]
            if not (2 <= ox < W - 2 and 2 <= oy < H - 2): bits = None; break
            bits.append(1 if images[i, int(oy) - 2:int(oy) + 3, int(ox) - 2:int(ox) + 3].mean() > 128 else 0)
        if bits is None: illisibles += 1; continue
        g = int("".join(map(str, bits)), 2); v = 0
        while g: v ^= g; g >>= 1
        attendu = (d0 + i - a) / 25 * FPS_SRC
        ecarts.append((i, v - attendu))
e = np.array([x[1] for x in ecarts])
print(f"images montées {n} (attendu {cumul}) ; lues {len(e)}, illisibles {illisibles}")
print(f"écart image (en images SOURCE 29,97) : médian {np.median(e):+.2f}, min {e.min():+.2f}, max {e.max():+.2f}, |écart|>1,5 : {int((np.abs(e) > 1.5).sum())}")
pire = sorted(ecarts, key=lambda x: -abs(x[1]))[:5]
print("pires :", [(i, round(x, 2), round(i / 25, 2)) for i, x in pire])
# Audio : corrélation d'une fenêtre de 0,4 s au milieu de chaque garde avec le son source (48 kHz mono)
def son(chemin):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", chemin, "-vn", "-ac", "1", "-ar", "8000", "-f", "f32le", "pipe:1"], capture_output=True, check=True)
    return np.frombuffer(r.stdout, np.float32)
sm, ss = son(montage), son(sys.argv[3])
t, res = 0.0, []
for g in gardes:
    dur = g["finSec"] - g["debutSec"]
    if dur > 0.8:
        milieu = t + dur / 2
        a = int((milieu - 0.2) * 8000); fen = sm[a:a + 3200]
        attendu = g["debutSec"] + dur / 2 - 0.2
        b0 = int((attendu - 0.3) * 8000); zone = ss[b0:b0 + 3200 + 4800]
        if len(fen) == 3200 and len(zone) > 3200 and fen.std() > 1e-4:
            cc = np.correlate(zone - zone.mean(), fen - fen.mean(), "valid")
            pos = (b0 + int(np.argmax(cc))) / 8000
            res.append(round((pos - attendu) * 1000, 1))
    t += dur
print("écart son / gardes (ms), par garde :", res)
# Synchro : image lue vs son retrouvé au même instant ≈ (écart image en s) - (écart son)
print("durées : montage", round(n / 25, 3), "s ; son", round(len(sm) / 8000, 3), "s ; coupes", etat["coupes"]["dureeSortieSec"])
