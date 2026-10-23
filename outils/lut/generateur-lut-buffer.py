# -*- coding: utf-8 -*-
"""
Generateur de LUT 3D .cube 65 points pour Axion IA.
Pipeline par variante (entree R'G'B' Rec.709 display-referred, [0,1]) :
  1. linearisation sRGB
  2. balance des blancs (gains lineaires, luma preservee)
  3. retour gamma, courbe de contraste S lisse (smoothstep parametree)
  4. split-toning ombres/hautes lumieres (masques luma lisses)
  5. vibrance avec protection des tons chair (gaussienne autour de la teinte peau)
  6. roll-off doux des hautes lumieres, clamp final
Toutes les operations sont C1-continues -> zero cassure, zero banding ajoute.
"""
import numpy as np
import os

SIZE = 65
OUT = os.path.dirname(os.path.abspath(__file__))
os.makedirs(OUT, exist_ok=True)

# ---------- outils colorimetriques ----------

def srgb_to_lin(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)

def lin_to_srgb(c):
    c = np.clip(c, 0.0, None)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.clip(c, 1e-8, None) ** (1 / 2.4) - 0.055)

def luma709(rgb):
    return rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722

def smootherstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * t * (t * (t * 6 - 15) + 10)

def tone_curve(x, contrast, pivot=0.435, black_lift=0.0, rolloff=0.85):
    """Courbe S monotone autour d'un pivot, lift optionnel des noirs,
    roll-off asymptotique des hautes lumieres au-dela de `rolloff`."""
    y = pivot + (x - pivot) * contrast + (x - pivot) ** 3 * (1.0 - contrast) * 1.6
    y = y + black_lift * (1.0 - smootherstep(0.0, 0.35, x))
    hi = y > rolloff
    span = 1.0 - rolloff
    y = np.where(hi, rolloff + span * np.tanh((y - rolloff) / np.maximum(span, 1e-6)), y)
    return np.clip(y, 0.0, 1.0)

def rgb_to_hue_sat(rgb):
    mx = rgb.max(axis=-1); mn = rgb.min(axis=-1)
    c = mx - mn
    sat = np.where(mx > 1e-8, c / np.maximum(mx, 1e-8), 0.0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    hue = np.zeros_like(mx)
    m = (mx == r) & (c > 1e-8)
    hue[m] = (60 * ((g - b) / np.maximum(c, 1e-8)) % 360)[m]
    m = (mx == g) & (c > 1e-8)
    hue[m] = (60 * ((b - r) / np.maximum(c, 1e-8)) + 120)[m]
    m = (mx == b) & (c > 1e-8)
    hue[m] = (60 * ((r - g) / np.maximum(c, 1e-8)) + 240)[m]
    return hue, sat

def skin_weight(rgb):
    """Poids 0..1 des tons chair : teinte ~15-45 deg, saturation moderee."""
    hue, sat = rgb_to_hue_sat(rgb)
    d = np.minimum(np.abs(hue - 30.0), 360.0 - np.abs(hue - 30.0))
    w_h = np.exp(-(d / 22.0) ** 2)
    w_s = np.exp(-((sat - 0.32) / 0.28) ** 2)
    return w_h * w_s

def apply_wb(rgb_lin, r_gain, b_gain):
    g = np.array([r_gain, 1.0, b_gain])
    out = rgb_lin * g
    # preserver la luma d'un gris moyen pour ne pas changer l'exposition
    scale = 1.0 / (0.2126 * r_gain + 0.7152 + 0.0722 * b_gain)
    return out * scale

def split_tone(rgb, luma, sh_color, hi_color, sh_amt, hi_amt, skin_w):
    """Ajoute une teinte aux ombres / hautes lumieres. Couleurs = offsets RGB
    normalises (somme nulle -> luma preservee). Protection peau incluse."""
    # fade-in sous 7% de luma : les noirs profonds restent PURS (pas de teinte
    # residuelle au noir, signature des LUT propres) et l'axe gris reste monotone
    m_sh = (1.0 - smootherstep(0.10, 0.55, luma)) * smootherstep(0.0, 0.07, luma)
    m_hi = smootherstep(0.45, 0.90, luma)
    prot = (1.0 - 0.75 * skin_w)
    out = rgb.copy()
    for i in range(3):
        out[..., i] += (sh_color[i] * sh_amt * m_sh + hi_color[i] * hi_amt * m_hi) * prot
    return out

def vibrance(rgb, amount, skin_w):
    """Boost de saturation degressif (plus fort sur les couleurs ternes),
    reduit sur les tons chair."""
    lum = luma709(rgb)[..., None]
    _, sat = rgb_to_hue_sat(rgb)
    boost = amount * (1.0 - sat)[..., None] * (1.0 - 0.8 * skin_w)[..., None]
    return lum + (rgb - lum) * (1.0 + boost)

def shadow_desat(rgb, amount):
    lum = luma709(rgb)
    m = (1.0 - smootherstep(0.05, 0.40, lum))[..., None]
    lum4 = lum[..., None]
    return lum4 + (rgb - lum4) * (1.0 - amount * m)

def desat_froids(rgb, amount, centre=200.0, largeur=50.0):
    """Eteint progressivement les teintes froides (cyan/bleu, ~150-250 deg),
    poids gaussien -> C1-continu, aucune cassure. Les tons chair et l'orange ne sont pas touches."""
    hue, sat = rgb_to_hue_sat(rgb)
    d = np.minimum(np.abs(hue - centre), 360.0 - np.abs(hue - centre))
    w = np.exp(-(d / largeur) ** 2) * smootherstep(0.0, 0.15, sat)
    lum = luma709(rgb)[..., None]
    return lum + (rgb - lum) * (1.0 - amount * w)[..., None]

# ---------- grille d'entree ----------

axis = np.linspace(0.0, 1.0, SIZE)
# .cube : rouge varie le plus vite
B, G, R = np.meshgrid(axis, axis, axis, indexing="ij")
grid = np.stack([R, G, B], axis=-1).reshape(-1, 3)

def build(name, title, wb, contrast, black_lift, rolloff,
          sh_color, hi_color, sh_amt, hi_amt, vib, sh_desat, noir_chaud=(0, 0, 0), froids=0.0):
    rgb = grid.copy()
    lin = srgb_to_lin(rgb)
    lin = apply_wb(lin, *wb)
    rgb = lin_to_srgb(lin)
    if froids > 0:
        rgb = desat_froids(rgb, froids)
    skin = skin_weight(rgb)
    rgb = tone_curve(rgb, contrast, black_lift=black_lift, rolloff=rolloff)
    lum = luma709(rgb)
    rgb = split_tone(rgb, lum, sh_color, hi_color, sh_amt, hi_amt, skin)
    rgb = vibrance(rgb, vib, skin)
    if sh_desat > 0:
        rgb = shadow_desat(rgb, sh_desat)
    rgb = np.clip(rgb, 0.0, 1.0)
    nc = np.array(noir_chaud)
    rgb = nc + rgb * (1.0 - nc)  # plancher lineaire chaud : reste C1-continu
    path = os.path.join(OUT, name)
    with open(path, "w", newline="\n") as f:
        f.write(f'TITLE "{title}"\n')
        f.write("LUT_3D_SIZE 65\n")
        f.write("DOMAIN_MIN 0.0 0.0 0.0\n")
        f.write("DOMAIN_MAX 1.0 1.0 1.0\n")
        np.savetxt(f, rgb, fmt="%.6f")
    print("OK", path)

# ---------- reglages « ton Buffer » (2026-10-01) ----------
# Ton des 16 visuels Buffer : clair-obscur chaud, noirs bruns, lumiere doree rasante,
# blancs creme, orange #C65A2E seule couleur vive. Moteur repris tel quel de
# generation_videos/STUDIO/brand/lut/generateur-lut.py (65 points, C1-continu, QC).
GOLD = (+0.055, +0.010, -0.065)   # lumieres or/ambre
BRUN = (+0.035, +0.004, -0.039)   # ombres brun chaud (remplace TEAL : pas d'ombres froides chez Axion)

build("Axion-Buffer-Clair-obscur.cube", "Axion - Clair-obscur (ton Buffer) v3",
      wb=(1.070, 0.930), contrast=1.16, black_lift=0.0, rolloff=0.86,
      sh_color=BRUN, hi_color=GOLD, sh_amt=0.30, hi_amt=0.30, vib=0.06, sh_desat=0.30,
      noir_chaud=(0.026, 0.014, 0.005), froids=0.80)
build("Axion-Buffer-Doux.cube", "Axion - Doux (ton Buffer) v3",
      wb=(1.050, 0.950), contrast=1.07, black_lift=0.006, rolloff=0.88,
      sh_color=BRUN, hi_color=GOLD, sh_amt=0.20, hi_amt=0.20, vib=0.06, sh_desat=0.20,
      noir_chaud=(0.020, 0.011, 0.004), froids=0.60)
build("Axion-Buffer-Nuit.cube", "Axion - Nuit (ton Buffer) v3",
      wb=(1.080, 0.920), contrast=1.24, black_lift=0.0, rolloff=0.84,
      sh_color=BRUN, hi_color=GOLD, sh_amt=0.36, hi_amt=0.34, vib=0.04, sh_desat=0.38,
      noir_chaud=(0.030, 0.016, 0.006), froids=0.90)

# Naturel : selfie / lumiere du jour / telephone. A peine chaud, contraste leger,
# noirs purs, aucune extinction forte des bleus (un ciel reste un ciel).
build("Axion-Buffer-Naturel.cube", "Axion - Naturel (selfie, lumiere du jour)",
      wb=(1.018, 0.985), contrast=1.04, black_lift=0.004, rolloff=0.90,
      sh_color=BRUN, hi_color=GOLD, sh_amt=0.05, hi_amt=0.08, vib=0.06, sh_desat=0.04,
      noir_chaud=(0.0, 0.0, 0.0), froids=0.15)

def qc(name):
    path = os.path.join(OUT, name)
    data = np.loadtxt(path, skiprows=4).reshape(SIZE, SIZE, SIZE, 3)
    gray = np.array([data[i, i, i] for i in range(SIZE)])
    mono = all(np.all(np.diff(gray[:, c]) >= -1e-6) for c in range(3))
    d2max = max(float(np.abs(np.diff(data, n=2, axis=a)).max()) for a in range(3))
    print(f"QC {name}: gris monotone={mono}, max|d2|={d2max:.5f} (seuil banding ~0.02)")

for n in ["Axion-Buffer-Clair-obscur.cube", "Axion-Buffer-Doux.cube", "Axion-Buffer-Nuit.cube", "Axion-Buffer-Naturel.cube"]:
    qc(n)
