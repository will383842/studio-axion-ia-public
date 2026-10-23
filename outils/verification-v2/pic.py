"""Lance une commande shell et rend le pic de RSS cumulée de son arbre de processus (Mo)."""
import subprocess, sys, time
def rss(pid):
    try:
        for l in open(f"/proc/{pid}/status"):
            if l.startswith("VmRSS:"): return int(l.split()[1])
    except OSError: return 0
    return 0
def arbre(pid):
    vus, a = [pid], [pid]
    while a:
        p = a.pop()
        try: e = [int(x) for x in open(f"/proc/{p}/task/{p}/children").read().split()]
        except OSError: e = []
        vus += e; a += e
    return vus
p = subprocess.Popen(sys.argv[1], shell=True)
pic = 0
while p.poll() is None:
    pic = max(pic, sum(rss(x) for x in arbre(p.pid))); time.sleep(0.05)
print(f"{pic // 1024} Mo (code {p.returncode})")
