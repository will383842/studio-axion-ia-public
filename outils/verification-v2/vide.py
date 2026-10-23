"""Images « panneau vide » d'une carte : aucun pixel de texte/icône (clair ou orange vif) au-delà du fond."""
import subprocess, sys, numpy as np
for chemin in sys.argv[1:]:
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries", "stream=width,height", "-of", "csv=p=0", chemin], capture_output=True, text=True)
    w, h = map(int, r.stdout.strip().strip(",").split(",")[:2])
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", chemin, "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], capture_output=True).stdout
    img = np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3).astype(np.int16)
    # contenu : pixels nettement plus clairs que le fond (fond ≤ ~90)
    contenu = ((img.max(-1) > 150)).reshape(len(img), -1).mean(1) * 100
    vides = [i for i, c in enumerate(contenu) if c < 0.05]
    debut = [i for i in vides if i < len(img) / 2]; fin = [i for i in vides if i >= len(img) / 2]
    print(f"{chemin.split('/')[-1]}: {len(img)} images ; vides au début {len(debut)} ({debut[:3]}…), à la fin {len(fin)} ({fin[:1]}…{fin[-1:] })")
