"""Pic mémoire (RSS cumulée du processus et de ses enfants FFmpeg) des étapes visages puis passe sur une prise."""
import json, os, sys, threading, time
sys.path.insert(0, "/home/user/studio-axion-ia/studio-aligneur")
from aligneur.visages import executer_visages
from aligneur.image import executer_passe
pic = {"total": 0, "python": 0}
def rss(pid):
    try:
        with open(f"/proc/{pid}/status") as f:
            for l in f:
                if l.startswith("VmRSS:"): return int(l.split()[1]) * 1024
    except OSError: pass
    return 0
def enfants(pid):
    try: return [int(x) for x in open(f"/proc/{pid}/task/{pid}/children").read().split()]
    except OSError: return []
def arbre(pid):
    vus, a = [pid], [pid]
    while a:
        p = a.pop(); e = enfants(p); vus += e; a += e
    return vus
fini = False
def echantillonner():
    while not fini:
        me = os.getpid(); t = sum(rss(p) for p in arbre(me))
        pic["total"] = max(pic["total"], t); pic["python"] = max(pic["python"], rss(me)); time.sleep(0.1)
threading.Thread(target=echantillonner, daemon=True).start()
src, d = sys.argv[1], sys.argv[2]
os.makedirs(d, exist_ok=True)
for k in ("v", "p"): os.makedirs(os.path.join(d, k), exist_ok=True)
v = executer_visages({"idTravail": "m", "source": src, "depots": {"piste": f"{d}/piste.json.gz", "points": f"{d}/points.json.gz"}}, os.path.join(d, "v"), lambda p: None)
pv = dict(pic); pic.update(total=0, python=0)
r = executer_passe({"idTravail": "m", "source": src, "depots": {"image": f"{d}/image.mp4"}, "parametres": {"points": f"{d}/points.json.gz", "piste": f"{d}/piste.json.gz"}}, os.path.join(d, "p"), lambda p: None)
fini = True
print(json.dumps({"visages_pic_Go": round(pv["total"] / 1e9, 2), "visages_python_Go": round(pv["python"] / 1e9, 2), "passe_pic_Go": round(pic["total"] / 1e9, 2), "passe_python_Go": round(pic["python"] / 1e9, 2), "bande": r["bande"], "mesures": r["mesures"]}))
