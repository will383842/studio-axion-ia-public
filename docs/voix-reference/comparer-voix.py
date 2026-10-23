"""Compare une voix à la référence (v4, 25 s à 30 s). Usage : python comparer-voix.py fichier.(wav|mp4) [debut fin]
Mesures : hauteur (médiane, étendue), variation de hauteur, énergie, dynamique, rythme (pics/s), part de parole.
Version 2 de la mesure (15/10) : la part de parole se compte entre la première et la dernière fenêtre de parole (les
silences de début et de fin du fichier ne comptent plus), comme `studio-rendu/src/audio/voix.ts`."""
import sys, subprocess, tempfile, os, wave, numpy as np
REF = os.path.join(os.path.dirname(os.path.abspath(__file__)), "voix-reference-v4-25-30s.wav")
def charger(p, t0=None, t1=None):
    tmp = tempfile.mktemp(suffix=".wav")
    cmd = ["ffmpeg","-v","error","-y"] + (["-ss",str(t0),"-t",str(t1-t0)] if t0 is not None else []) + ["-i",p,"-vn","-ac","1","-ar","16000",tmp]
    subprocess.run(cmd, check=True)
    w = wave.open(tmp); x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(float)/32768; sr = w.getframerate(); w.close(); os.remove(tmp)
    return x, sr
def fiche(x, sr):
    n, h = int(.04*sr), int(.01*sr); rms=[]; f0=[]
    for i in range(0, len(x)-n, h):
        f = x[i:i+n]; r = np.sqrt((f**2).mean()); rms.append(r)
        if r < .02: f0.append(0); continue
        f = f - f.mean(); ac = np.correlate(f, f, 'full')[n-1:]; lo, hi = int(sr/300), int(sr/70)
        k = lo + np.argmax(ac[lo:hi]); f0.append(sr/k if ac[k] > .4*ac[0] else 0)
    rms, f0 = np.array(rms), np.array(f0); v = f0[f0 > 0]; act = rms > .02
    env = np.convolve(rms, np.ones(5)/5, 'same'); pk = ((env[1:-1] > env[:-2]) & (env[1:-1] > env[2:]) & (env[1:-1] > .03)).sum()
    return {"hauteur_Hz": float(np.median(v)), "variation_Hz": float(v.std()), "energie": float(rms[act].mean()),
            "dynamique": float(rms[act].std()/rms[act].mean()), "rythme_pics_s": float(pk/(len(x)/sr)), "parole": float(act[np.flatnonzero(act)[0]:np.flatnonzero(act)[-1]+1].mean())}
TOL = {"hauteur_Hz": .08, "variation_Hz": .25, "energie": .20, "dynamique": .20, "rythme_pics_s": .12, "parole": .12}  # écart relatif toléré
if __name__ == "__main__":
    ref = fiche(*charger(REF)); a = sys.argv
    cand = fiche(*charger(a[1], float(a[2]), float(a[3]))) if len(a) > 3 else fiche(*charger(a[1]))
    ok = True
    print(f"{'mesure':16s}{'référence':>11s}{'candidat':>11s}{'écart':>8s}  verdict")
    for k in ref:
        e = (cand[k]-ref[k])/ref[k]; bon = abs(e) <= TOL[k]; ok &= bon
        print(f"{k:16s}{ref[k]:11.3f}{cand[k]:11.3f}{e*100:7.0f}%  {'ok' if bon else 'HORS TOLÉRANCE'}")
    print("=> RESSEMBLANT" if ok else "=> S'ÉCARTE de la référence")
