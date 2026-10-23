"""Assemble toutes les planches de variété (et la planche du tirage) depuis le verdict du critique. Usage : python3 -I planches.py <verdict.json> <rendus> <sortie>"""
import json, subprocess, sys, os
verdict, rendus, sortie = sys.argv[1:4]
ICI = os.path.dirname(os.path.abspath(__file__))
v = json.load(open(verdict))["variantes"]
AXES = [("OUV", "1-ouverture", "Axe 1 · Ouverture"), ("REC", "2-recit", "Axe 2 · Déroulé du récit"), ("CHI", "3-chiffres", "Axe 3 · Les chiffres"), ("CAM", "4-camera", "Axe 4 · Parcours de la caméra"), ("TYP", "5-ecrans-texte", "Axe 5 · Écrans de texte"), ("APP", "6-apparition", "Axe 6 · Apparition du schéma"), ("TRA", "7-transitions", "Axe 7 · Transitions"), ("FIN", "8-fin", "Axe 8 · Fin"), ("MAT", "9-matiere", "Axe 9 · Matière"), ("SOU", "10-sous-titres", "Axe 10 · Sous-titres")]
def planche(*args): subprocess.run(["python3", "-I", os.path.join(ICI, "planche.py"), *args], check=True)
# v3 : les planches d'axe ne montrent que les variantes (toutes mesurées par occupation.py) ; les références
# « aujourd'hui » (images du moteur actuel, non retouchées) sont regroupées sur une planche à part pour comparer.
for pre, fic, titre in AXES:
    cols = [f"{x['code']}|{x['nom']}|{','.join(x['images'])}" for x in v if x["code"].startswith(pre) and x["decision"] == "garder"]
    planche(f"{sortie}/planche-{fic}.jpg", titre, rendus, *cols)
refs = [f"{x['code']}|{x['nom']}|{x['images'][0]}" for x in v if x["decision"] == "reference"]
planche(f"{sortie}/planche-0-aujourdhui.jpg", "Aujourd’hui : le niveau actuel du studio (pour comparer)", rendus, *refs)
planche(f"{sortie}/planche-4x5-linkedin-facebook.jpg", "4:5 LinkedIn / fil Facebook (en haut : le 9:16)", rendus,
        "OUV-A|Ouverture|OUV-A-1,R45-OUV-A-1", "CAM-C|Schéma|CAM-C-1,R45-CAM-C-1", "CHI-B|Chiffres : jauge|CHI-B-2,R45-CHI-B-1", "CHI-D|Chiffre géant|CHI-D-1,R45-CHI-D-1", "FIN-D|Fin|FIN-D-2,R45-FIN-D-1")
# Planche « 3 vidéos tirées au sort » : mêmes moments (ouverture, récit, schéma, chiffre, transition, fin), une rangée par vidéo.
subprocess.run(["python3", "-I", os.path.join(ICI, "tirages.py"), f"{sortie}/planche-tirage-3-videos.jpg", rendus, "Ouverture,Récit,Schéma,Chiffre,Transition,Fin",
                "Vidéo 1|OUV-C · REC-C · CAM-C · CHI-E · TRA-B · FIN-C|OUV-C-1,REC-C-2,CAM-C-1,CHI-E-2,TRA-B-2,FIN-C-1",
                "Vidéo 2|OUV-A · REC-B · CAM-B · CHI-B · TRA-D · FIN-D|OUV-A-1,REC-B-2,CAM-B-1,CHI-B-2,TRA-D-1,FIN-D-2",
                "Vidéo 3|OUV-D · REC-D · CAM-E · CHI-D · TRA-C · FIN-C|OUV-D-2,REC-D-2,CAM-E-1,CHI-D-1,TRA-C-1,FIN-C-1"], check=True)
