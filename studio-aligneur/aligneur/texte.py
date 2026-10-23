"""
Préparation du TEXTE CONNU pour l'alignement forcé (pur, sans dépendance, testé par tests/test_texte.py).

Le studio envoie le texte EXACT prononcé (prononciations déjà substituées). Le modèle wav2vec2 français ne connaît
que des lettres : un chiffre, un symbole ou un sigle écrit en capitales n'a aucune lettre « entendue ». Pour le seul
calcul, chaque mot reçoit donc une FORME DITE (« 135 » → « cent-trente-cinq », « € » → « euros », « PV » → « pé-vé ») ;
le mot rendu au studio reste celui du texte, inchangé.
"""
from __future__ import annotations

import re
import unicodedata

UNITES = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze",
          "treize", "quatorze", "quinze", "seize"]
DIZAINES = {2: "vingt", 3: "trente", 4: "quarante", 5: "cinquante", 6: "soixante"}

LETTRES = {"a": "a", "b": "bé", "c": "cé", "d": "dé", "e": "e", "f": "èf", "g": "jé", "h": "ach", "i": "i", "j": "ji",
           "k": "ka", "l": "èl", "m": "èm", "n": "èn", "o": "o", "p": "pé", "q": "ku", "r": "èr", "s": "ès", "t": "té",
           "u": "u", "v": "vé", "w": "doublevé", "x": "iks", "y": "igrèk", "z": "zèd"}

# Sigles prononcés comme des mots (jamais épelés).
SIGLES_DITS = {"SAS", "SARL", "SASU", "CAF", "SMIC", "PACS", "ONU", "OTAN", "URSSAF", "INSEE", "CNIL", "ANSSI",
               "BOFIP", "UNESCO", "OPCO"}

SYMBOLES = {"€": "euros", "%": "pour-cent", "&": "et", "$": "dollars", "£": "livres", "+": "plus", "°": "degrés",
            "@": "arobase", "§": "paragraphe"}


def _moins_de_cent(n: int) -> str:
    if n <= 16:
        return UNITES[n]
    if n < 20:
        return "dix-" + UNITES[n - 10]
    d, u = divmod(n, 10)
    if d in (7, 9):  # soixante-dix…, quatre-vingt-dix…
        base = "soixante" if d == 7 else "quatre-vingt"
        reste = 10 + u
        if d == 7 and u == 1:
            return "soixante-et-onze"
        return base + "-" + _moins_de_cent(reste)
    if d == 8:
        return "quatre-vingts" if u == 0 else "quatre-vingt-" + UNITES[u]
    base = DIZAINES[d]
    if u == 0:
        return base
    if u == 1:
        return base + "-et-un"
    return base + "-" + UNITES[u]


def _moins_de_mille(n: int) -> str:
    c, r = divmod(n, 100)
    if c == 0:
        return _moins_de_cent(r)
    tete = "cent" if c == 1 else UNITES[c] + "-cent" + ("s" if r == 0 else "")
    return tete if r == 0 else tete + "-" + _moins_de_cent(r)


def nombre_en_lettres(n: int) -> str:
    """Entier positif en toutes lettres, orthographe à tirets (1990). Jusqu'aux milliards."""
    if n < 0:
        return "moins-" + nombre_en_lettres(-n)
    if n < 1000:
        return _moins_de_mille(n)
    morceaux = []
    for valeur, nom in ((10**9, "milliard"), (10**6, "million")):
        q, n = divmod(n, valeur)
        if q:
            morceaux.append(nombre_en_lettres(q) + "-" + nom + ("s" if q > 1 else ""))
    q, n = divmod(n, 1000)
    if q:
        morceaux.append("mille" if q == 1 else _moins_de_mille(q).removesuffix("s") + "-mille")
    if n:
        morceaux.append(_moins_de_mille(n))
    return "-".join(morceaux)


def _nombre(texte: str) -> str:
    """« 135 », « 1,5 », « 2.5 », « 1er », « 3e » → lettres."""
    m = re.fullmatch(r"(\d+)(?:[.,](\d+))?", texte)
    if m:
        dit = nombre_en_lettres(int(m.group(1)))
        if m.group(2):
            dit += "-virgule-" + nombre_en_lettres(int(m.group(2)))
        return dit
    m = re.fullmatch(r"(\d+)(er|re|ère|e|ème|eme)", texte, re.IGNORECASE)
    if m:
        n = int(m.group(1))
        if n == 1:
            return "premier" if m.group(2).lower() == "er" else "première"
        base = nombre_en_lettres(n)
        base = base[:-1] if base.endswith("e") else base
        base = base.replace("cinq", "cinqu").replace("neuf", "neuv")
        return base + "ième"
    return texte


def _sans_accent(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def _sigle(partie: str) -> str | None:
    """Un sigle en capitales (2 à 5 lettres) est épelé, sauf s'il se dit comme un mot."""
    lettres = re.sub(r"[^A-Za-zÀ-ÿ]", "", partie)
    if 2 <= len(lettres) <= 5 and lettres.isupper() and lettres not in SIGLES_DITS:
        return "-".join(LETTRES.get(_sans_accent(c).lower(), c.lower()) for c in lettres)
    return None


def forme_dite(mot: str) -> str:
    """Forme lue par le modèle pour un mot du texte ; chaîne vide s'il ne contient rien de prononçable."""
    sortie = []
    # Les tirets séparent des morceaux traités un à un (« Axion-IA » → « axion-i-a »).
    for morceau in re.split(r"[-‑–]", mot):
        reste = morceau
        for symbole, dit in SYMBOLES.items():
            reste = reste.replace(symbole, f" {dit} ")
        for bout in reste.split():
            coeur = bout.strip(".,;:!?…«»\"'()[]{}’“”")
            if not coeur:
                continue
            nombre = re.fullmatch(r"\d+(?:[.,]\d+)?|\d+(?:er|re|ère|e|ème|eme)", coeur, re.IGNORECASE)
            if nombre:
                sortie.append(_nombre(coeur))
                continue
            sigle = _sigle(coeur)
            if sigle:
                sortie.append(sigle)
                continue
            heure = re.fullmatch(r"(\d{1,2})h(\d{2})?", coeur, re.IGNORECASE)
            if heure:
                dit = nombre_en_lettres(int(heure.group(1))) + "-heures"
                sortie.append(dit + ("-" + nombre_en_lettres(int(heure.group(2))) if heure.group(2) else ""))
                continue
            # Chiffres collés à des lettres (« 3D ») : chaque nombre dit, les lettres gardées.
            sortie.append(re.sub(r"\d+", lambda m: "-" + nombre_en_lettres(int(m.group(0))) + "-", coeur).strip("-").lower())
    return "-".join(s for s in sortie if s)


def decouper(texte: str) -> list[str]:
    """Mots du texte (séparés par des blancs), sans la ponctuation isolée (« : », « ? ») qui n'a aucun son."""
    mots = []
    for m in texte.split():
        if re.search(r"[\w€%&$£+°@§]", m):
            mots.append(m)
    return mots


def phrases(mots: list[str], max_mots: int = 45) -> list[tuple[int, int]]:
    """Groupes de mots [début, fin) : coupés après une fin de phrase, ou tous les `max_mots` mots au plus."""
    groupes = []
    debut = 0
    for i, m in enumerate(mots):
        fin_phrase = re.search(r"[.!?…]+[»\"”’)]*$", m) is not None
        if fin_phrase or i + 1 - debut >= max_mots:
            groupes.append((debut, i + 1))
            debut = i + 1
    if debut < len(mots):
        groupes.append((debut, len(mots)))
    return groupes
