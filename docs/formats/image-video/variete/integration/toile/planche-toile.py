"""
Lot G (toile remplie) : planche AVANT | APRÈS | MAQUETTE d'un code, et tableau des mesures (doc 76).
Usage (depuis la racine du dépôt) :
  python3 -I docs/formats/image-video/variete/integration/toile/planche-toile.py <avant> <apres> <maquettes> <sortie> CODE…
<avant>, <apres> : sorties de `toiles.mts` rangées en <dossier>/<CARTE>-<9x16|4x5>/<CODE>/ (CODE « REF » = référence).
<maquettes> : images de `prototypes/rendre.mts` (<CODE>-1.jpg, R45-<CODE>-1.jpg) ; la référence prend celle de APP-A.
Écrit <sortie>/<CODE>.jpg : une section par carte et format (C, E ; 9:16, 4:5), une rangée avant, une rangée après,
chaque vignette avec sa mesure (occupation · trou · équilibre · appoint, ✓ si tous les seuils passent).
"""
import os, sys
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../prototypes"))
import occupation as O  # noqa: E402

V = 150  # largeur d'une vignette
POLICE = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
GRAS = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def police(chemin, taille):
    return ImageFont.truetype(chemin, taille) if os.path.exists(chemin) else ImageFont.load_default()


def texte_mesure(r):
    if r is None: return "—"
    p, t, e, a = r
    return f"{p*100:.0f}·{t*100:.0f}·{e:.1f}" + ("" if a is None else f"·{a*100:.0f}")


def main():
    avant, apres, maquettes, sortie, *codes = sys.argv[1:]
    os.makedirs(sortie, exist_ok=True)
    f, fg, fp = police(POLICE, 13), police(GRAS, 16), police(GRAS, 26)
    for code in codes:
        sections = []
        for carte in "CE":
            for fmt in ("9x16", "4x5"):
                d0, d1 = os.path.join(avant, f"{carte}-{fmt}", code), os.path.join(apres, f"{carte}-{fmt}", code)
                if not os.path.isdir(d1): continue
                noms = sorted(n for n in os.listdir(d1) if n.endswith(".jpg"))
                sections.append((carte, fmt, d0, d1, noms))
        cle = "APP-A" if code == "REF" else code
        maq = [os.path.join(maquettes, n) for n in (f"{cle}-1.jpg", f"R45-{cle}-1.jpg") if os.path.exists(os.path.join(maquettes, n))]
        hv = {"9x16": V * 16 // 9, "4x5": V * 5 // 4}
        largeur = 70 + 6 * (V + 6) + 20 + V + 20
        hauteur = 50 + sum(30 + 2 * (hv[s[1]] + 22) for s in sections)
        P = Image.new("RGB", (largeur, hauteur), "white")
        D = ImageDraw.Draw(P)
        D.text((10, 10), f"Lot G · toile remplie · {code if code != 'REF' else 'référence (sans variante)'} · avant | après | maquette", fill="black", font=fp)
        y = 50
        for carte, fmt, d0, d1, noms in sections:
            D.text((10, y + 5), f"Carte {carte} · {fmt.replace('x', ':')}   (occupation · trou · équilibre · appoint)", fill="black", font=fg)
            y += 30
            for k, (etiq, d) in enumerate((("avant", d0), ("après", d1))):
                D.text((10, y + hv[fmt] // 2), etiq, fill="black", font=fg)
                for i, n in enumerate(noms):
                    x = 70 + i * (V + 6)
                    chemin = os.path.join(d, n)
                    if not os.path.exists(chemin): continue
                    im = Image.open(chemin).convert("RGB").resize((V, hv[fmt]), Image.LANCZOS)
                    P.paste(im, (x, y))
                    r = O.mesure(chemin)
                    ok = r is not None and O.verdict(r)
                    D.text((x, y + hv[fmt] + 3), texte_mesure(r) + (" ✓" if ok else " ✗"), fill=(0, 120, 0) if ok else (180, 0, 0), font=f)
                y += hv[fmt] + 22
        ym = 50
        for m in maq:
            im = Image.open(m).convert("RGB")
            im = im.resize((V, V * im.height // im.width), Image.LANCZOS)
            xm = 70 + 6 * (V + 6) + 20
            D.text((xm, ym), "maquette v3" + (" 4:5" if "R45" in m else ""), fill="black", font=fg)
            P.paste(im, (xm, ym + 22))
            ym += im.height + 40
        P.save(os.path.join(sortie, f"{code}.jpg"), quality=80)
        print("planche :", os.path.join(sortie, f"{code}.jpg"))


if __name__ == "__main__":
    main()
