"""
MAQUETTES DE VARIÉTÉ (lot L1) · étape 3 : planches pour Will (étiquettes courtes en français).
Usage (racine du dépôt), après serveur.sh : python outils/maquettes-variete/planche.py
Sortie : outils/maquettes-variete/sortie/planche-1.jpg, planche-2.jpg et planche-maquettes.jpg (les deux réunies).
"""
import os
from PIL import Image, ImageDraw, ImageFont

D = os.path.join("outils", "maquettes-variete", "sortie")
FOND = (244, 239, 231)
ENCRE = (21, 16, 12)
ORANGE = (194, 83, 42)
GRIS = (138, 124, 110)


def police(taille, gras=True):
    for nom in (["segoeuib.ttf", "arialbd.ttf"] if gras else ["segoeui.ttf", "arial.ttf"]):
        try:
            return ImageFont.truetype(nom, taille)
        except OSError:
            pass
    return ImageFont.load_default()


L = 300  # largeur d'une vignette
H = int(L * 16 / 9)
MARGE = 22
ETIQ = 58


def tuile(c, d, x, y, fichier, titre, sous=None, couleur=ENCRE):
    im = Image.open(os.path.join(D, fichier)).convert("RGB").resize((L, H), Image.LANCZOS)
    c.paste(im, (x, y + ETIQ))
    d.text((x, y + 4), titre, fill=couleur, font=police(23))
    if sous:
        d.text((x, y + 31), sous, fill=GRIS, font=police(18, False))


def planche(nom, titre, rangees):
    cols = max(len(r[1]) for r in rangees)
    larg = MARGE + cols * (L + MARGE)
    haut = 96 + len(rangees) * (H + ETIQ + 56)
    c = Image.new("RGB", (larg, haut), FOND)
    d = ImageDraw.Draw(c)
    d.text((MARGE, 22), titre, fill=ENCRE, font=police(38))
    y = 96
    for entete, tuiles in rangees:
        d.text((MARGE, y), entete, fill=ORANGE, font=police(24))
        y += 36
        for i, t in enumerate(tuiles):
            tuile(c, d, MARGE + i * (L + MARGE), y, *t)
        y += H + ETIQ + 20
    chemin = os.path.join(D, nom)
    c.save(chemin, quality=84, optimize=True)
    print(chemin, c.size, os.path.getsize(chemin) // 1024, "Ko")
    return c


p1 = planche(
    "planche-1.jpg",
    "Cas concret · Variété — planche 1/2 : les 8 maquettes prévues",
    [
        ("AUJOURD'HUI (v4) puis OUVERTURES ET ÉTAPES", [
            ("aujourdhui-accroche.jpg", "Aujourd'hui · ouverture", "le montage actuel", GRIS),
            ("aujourdhui-etape.jpg", "Aujourd'hui · étape", "le montage actuel", GRIS),
            ("m01-ouverture-chiffre.jpg", "1 · Ouverture chiffre", "sous-titre : mot fort"),
            ("m02-ouverture-titre-gauche.jpg", "2 · Titre géant à gauche", "le titre déborde"),
            ("m03-etape-plein-cadre.jpg", "3 · Objet plein cadre", "sous-titre : souligné"),
            ("m04-etape-objet-gauche.jpg", "4 · Objet à gauche", "texte à droite"),
        ]),
        ("LISTE, FOND FORT, RÉSULTAT, OBJET ASSEMBLÉ — ET UNE TRANSITION + UN ZOOM", [
            ("m05-liste-pile.jpg", "5 · Avant en pile de cartes"),
            ("m06-fond-terracotta.jpg", "6 · 3ᵉ fond terracotta", "1-2 moments forts"),
            ("m07-barres-proportionnelles.jpg", "7 · Barres 1 → 200", "à l'échelle réelle"),
            ("m08-objet-compose.jpg", "8 · Objet assemblé", "téléphone + 3 rangées"),
            ("t1-volet-entree.jpg", "Volet terracotta (1/2)", "il couvre l'écran A"),
            ("t2-volet-sortie.jpg", "Volet terracotta (2/2)", "il révèle l'écran B"),
        ]),
    ],
)

p2 = planche(
    "planche-2.jpg",
    "Cas concret · Variété — planche 2/2 : 8 variantes de plus",
    [
        ("OUVERTURES ET FORMES NOUVELLES", [
            ("m09-ouverture-question.jpg", "9 · Ouverture question"),
            ("m10-ouverture-avant-apres.jpg", "10 · Avant / après éclair", "écran partagé"),
            ("m11-ouverture-zoom-arriere.jpg", "11 · Zoom arrière", "l'objet se révèle"),
            ("m12-citation-geante.jpg", "12 · Citation géante"),
            ("t3-zoom-debut.jpg", "Zoom lent · début", "caméra à 100 %"),
            ("t4-zoom-fin.jpg", "Zoom lent · fin", "caméra à 104 %"),
        ]),
        ("COMPARATIF, JOURNÉE, JAUGE, FIN — ET UNE AUTRE VIDÉO", [
            ("m13-comparatif-deux-colonnes.jpg", "13 · Comparatif"),
            ("m14-journee-8h-22h.jpg", "14 · Journée 8 h → 22 h"),
            ("m15-jauge-13-criteres.jpg", "15 · Jauge 13 critères", "sous-titre : base calme"),
            ("m16-fin-variante.jpg", "16 · Fin variante", "même logo, même bouton"),
            ("m17-recrutement-autre-tirage.jpg", "Recrutement", "autre vidéo, autre tirage"),
        ]),
    ],
)

# Les deux planches réunies (une seule image à ouvrir).
w = max(p1.width, p2.width)
r = Image.new("RGB", (w, p1.height + p2.height), FOND)
r.paste(p1, (0, 0))
r.paste(p2, (0, p1.height))
chemin = os.path.join(D, "planche-maquettes.jpg")
r.save(chemin, quality=82, optimize=True)
print(chemin, r.size, os.path.getsize(chemin) // 1024, "Ko")
