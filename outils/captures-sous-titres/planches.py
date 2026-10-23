"""
Planches côte à côte des captures de contrôle (comme les maquettes validées par Will).
Usage (racine du dépôt), après captures.mts : python outils/captures-sous-titres/planches.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

D = os.path.join("docs", "captures", "sous-titres-styles")
NOIR = (22, 18, 15)
try:
    POLICE = ImageFont.truetype("segoeuib.ttf", 26)
except OSError:
    POLICE = ImageFont.load_default()

def planche(nom, tuiles, largeur=480):
    h = int(largeur * 16 / 9)
    c = Image.new("RGB", (largeur * len(tuiles), h + 64), (246, 240, 232))
    d = ImageDraw.Draw(c)
    for i, (fichier, titre) in enumerate(tuiles):
        im = Image.open(os.path.join(D, fichier)).convert("RGB").resize((largeur, h), Image.LANCZOS)
        c.paste(im, (i * largeur, 64))
        d.text((i * largeur + 14, 18), titre, fill=NOIR, font=POLICE)
    c.save(os.path.join(D, nom), quality=90)
    print(nom)

planche("planche-1-styles.jpg", [("01-karaoke.png", "Karaoké (base avocat)"), ("02-minimal.png", "Minimal (base calme)"), ("03-impact.png", "Impact (accent)"), ("04-bandeau.png", "Bandeau (accent)")])
planche("planche-2-controles-montant.jpg", [("05-montant-fond-noir.png", "Fond noir"), ("06-montant-illustration-claire.png", "Illustration claire"), ("07-montant-deuteranopie.png", "Deutéranopie"), ("07b-montant-deuteranopie-claire.png", "Deutéranopie, fond clair")])
planche("planche-3-melange.jpg", [
    ("08-melange-1-accroche-impact.png", "Accroche : Impact"),
    ("08-melange-2-base-karaoke.png", "Base : karaoké"),
    ("08-melange-3-souligne.png", "Mot souligné"),
    ("08-melange-4-impact-suivant.png", "Mot fort : Impact"),
    ("08-melange-5-bandeau.png", "Phrase clé : Bandeau"),
    ("08-melange-6-retour-base.png", "Retour à la base"),
], largeur=400)
