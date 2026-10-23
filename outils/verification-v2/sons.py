"""Voix de synthèse (flite) placée sur une ligne de temps : silences, euh, consigne, reprise. Écrit voix.wav (48 kHz) + mots.json."""
import json, subprocess, unicodedata, os, sys
import numpy as np
SR = 48000
D = sys.argv[1]
def ascii_(t): return unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode()
def flite(texte, i):
    p = os.path.join(D, f"u{i}.txt"); open(p, "w").write(ascii_(texte))
    r = subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", f"flite=textfile={p}:voice=slt", "-ac", "1", "-ar", str(SR), "-f", "f32le", "pipe:1"], capture_output=True, check=True)
    s = np.frombuffer(r.stdout, np.float32).copy()
    # bornes de la parole (énergie)
    e = np.abs(s) > 0.02
    a, b = int(np.argmax(e)), len(s) - int(np.argmax(e[::-1]))
    return s[a:b]
P = {
 "P1": "Vous perdez des heures chaque semaine sur des tâches qui ne servent à rien.",
 "P2": "Ce n'est pas un problème de travail, c'est une fuite.",
 "C": "Monteur, mets un zoom ici.",
 "P3": "Les soirées sur les devis, les relances à la main, les chiffres qui arrivent trop tard.",
 "E": "euh",
 "P4": "Chez Axion-IA, on forme les équipes, on accompagne en one-to-one, on audite et on automatise.",
 "P5a": "Un outil de plus ne règle rien, alors que",
 "P5": "Un outil de plus ne règle rien, alors que la vraie première étape c'est de trouver la fuite.",
 "P6": "Le diagnostic fuite dure 45 minutes, il est gratuit et se fait en visio.",
 "P7": "On vous pose trois questions.",
 "P8a": "Un, où part votre temps ?",
 "P8b": "Deux, qu'est-ce qui peut changer en premier ?",
 "P8c": "Trois, de quoi avez-vous besoin ?",
 "P9": "Ensuite on vous propose formation, accompagnement, audit complet ou automatisation.",
 "P10": "Réservez votre appel diagnostic gratuit.",
}
ligne = [(4.0,"P1"),(0.5,"P2"),(1.0,"C"),(1.0,"P3"),(0.4,"E"),(0.5,"P4"),(0.6,"P5a"),(0.9,"P5"),(0.5,"P6"),(2.6,"P7"),(0.4,"P8a"),(0.4,"P8b"),(0.4,"P8c"),(0.6,"P9"),(0.7,"P10")]
FIN = 3.5
morceaux, mots, t = [], [], 0.0
for k, (gap, cle) in enumerate(ligne):
    s = flite(P[cle], k)
    t += gap
    debut = t
    dur = len(s) / SR
    morceaux.append((debut, s))
    ws = P[cle].split()
    poids = np.array([len(w) + 2 for w in ws], float); poids /= poids.sum()
    x = debut
    for w, pw in zip(ws, poids):
        d = dur * pw
        mots.append({"mot": w, "debutSec": round(x, 3), "finSec": round(x + d * 0.92, 3)})
        x += d
    t = debut + dur
total = t + FIN
n = int(total * SR)
voix = np.zeros(n, np.float32)
for debut, s in morceaux:
    a = int(debut * SR); voix[a:a + len(s)] += s
# niveau iPhone discret : voix ramenée vers −26 dBFS RMS en parole, + bruit rose −50 dBFS + ronflette 50 Hz −55 dBFS
actif = np.abs(voix) > 0.01
voix *= 10 ** (-24 / 20) / (np.sqrt(np.mean(voix[actif] ** 2)) + 1e-9)
rng = np.random.default_rng(7)
blanc = rng.standard_normal(n).astype(np.float32)
f = np.fft.rfft(blanc); fr = np.fft.rfftfreq(n, 1 / SR); f[1:] /= np.sqrt(fr[1:]); f[0] = 0
rose = np.fft.irfft(f, n).astype(np.float32); rose *= 10 ** (-50 / 20) / np.sqrt(np.mean(rose ** 2))
ronf = (10 ** (-55 / 20) * np.sqrt(2) * np.sin(2 * np.pi * 50 * np.arange(n) / SR)).astype(np.float32)
sortie = voix + rose + ronf
open(os.path.join(D, "voix.f32"), "wb").write(sortie.astype(np.float32).tobytes())
# enveloppe pour la bouche (25 ms)
env = np.sqrt(np.convolve(voix ** 2, np.ones(1200) / 1200, "same"))
np.save(os.path.join(D, "enveloppe.npy"), env[:: SR // 1000])  # 1 valeur / ms
json.dump({"dureeSec": round(total, 3), "mots": mots, "texte": " ".join(P[k] for k in ["P1","P2","P3","P4","P5","P6","P7","P8a","P8b","P8c","P9","P10"]), "repere": {c: round(d, 3) for (d, _), (g, c) in zip(morceaux, ligne)}}, open(os.path.join(D, "mots.json"), "w"), ensure_ascii=False, indent=1)
print("durée", round(total, 2), "s ;", len(mots), "mots")
