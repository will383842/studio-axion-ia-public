"""
Planche « maquette | moteur » par code, et mesures d'occupation des images du moteur (banc commun des lots de variété).
Usage (depuis la racine du dépôt) :
  python3 -I scripts/image-video/variete/cote-a-cote.py <dossier-images-fixes> [--maquettes <dossier>] [--sortie <dossier>]
<dossier-images-fixes> : la sortie de `images-fixes.mts` (images + instants.json). --maquettes : images des maquettes
rendues par `prototypes/rendre.mts`, nommées <CODE>…jpg (sans elles, la colonne maquette est absente et le dit).
Écrit dans --sortie (défaut : le dossier des images) : `planche-<CODE>.jpg` (mise en page de `prototypes/planche.py`)
et `mesures.md` (sortie de `prototypes/occupation.py` : occupation, trou, équilibre, appoint, verdict).
"""
import json, os, shutil, subprocess, sys

PROTOS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../../docs/formats/image-video/variete/prototypes")


def option(nom, defaut=None):
    return sys.argv[sys.argv.index(nom) + 1] if nom in sys.argv else defaut


def main():
    if len(sys.argv) < 2 or sys.argv[1].startswith("--"):
        sys.exit("Usage : cote-a-cote.py <dossier-images-fixes> [--maquettes <dossier>] [--sortie <dossier>]")
    images = os.path.abspath(sys.argv[1])
    maquettes = option("--maquettes")
    sortie = os.path.abspath(option("--sortie", images))
    os.makedirs(sortie, exist_ok=True)
    with open(os.path.join(images, "instants.json"), encoding="utf-8") as f:
        instants = json.load(f)
    codes = []
    for i in instants["images"]:
        if i["code"] not in codes:
            codes.append(i["code"])
    # Toutes les vignettes d'une planche doivent être dans un seul dossier : on y copie maquettes et images du moteur.
    travail = os.path.join(sortie, "_planche")
    os.makedirs(travail, exist_ok=True)
    lignes = [f"# Mesures · carte {instants['carte']} · {instants['format']}", "", "Recette : " + ", ".join(instants["recette"].values()), ""]
    for code in codes:
        moteur = [i["fichier"][:-4] for i in instants["images"] if i["code"] == code]
        for n in moteur:
            shutil.copy(os.path.join(images, n + ".jpg"), os.path.join(travail, n + ".jpg"))
        colonnes = []
        trouvees = sorted(f for f in os.listdir(maquettes) if f.startswith(code) and f.endswith(".jpg")) if maquettes and os.path.isdir(maquettes) else []
        if trouvees:
            for f in trouvees[:3]:
                shutil.copy(os.path.join(maquettes, f), os.path.join(travail, "maquette-" + f))
            colonnes.append(f"{code}|maquette|" + ",".join("maquette-" + f[:-4] for f in trouvees[:3]))
        colonnes.append(f"{code}|moteur|" + ",".join(moteur[:3]))
        planche = os.path.join(sortie, f"planche-{code}.jpg")
        subprocess.run([sys.executable, "-I", os.path.join(PROTOS, "planche.py"), planche, f"{code} · maquette | moteur", travail, *colonnes], check=True)
        mesure = subprocess.run([sys.executable, "-I", os.path.join(PROTOS, "occupation.py"), images, *moteur], check=True, capture_output=True, text=True).stdout
        replis = sorted({i["repli"] for i in instants["images"] if i["code"] == code and i.get("repli")})
        lignes += [f"## {code}", "", f"Planche : `planche-{code}.jpg`" + ("" if trouvees else " (maquette non fournie : `--maquettes`)"), ""]
        lignes += [f"- {r}" for r in replis] + ([""] if replis else [])
        lignes += ["```", mesure.rstrip(), "```", ""]
    shutil.rmtree(travail)
    with open(os.path.join(sortie, "mesures.md"), "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lignes))
    print(f"planche(s) et mesures.md dans {sortie}")


if __name__ == "__main__":
    main()
