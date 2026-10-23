import numpy as np, sys
def qc(path):
    L=open(path).read().split('\n'); n=int([l for l in L if l.startswith('LUT_3D_SIZE')][0].split()[1])
    rows=[l for l in L if l and (l[0].isdigit() or l[0]=='-')]
    d=np.array([list(map(float,r.split())) for r in rows]).reshape(n,n,n,3)
    gris=np.array([d[i,i,i] for i in range(n)])
    mono=all(np.all(np.diff(gris[:,c])>=-1e-6) for c in range(3))
    # d2 normalisé par pas (pour comparer 33 et 65 points)
    d2=max(float(np.abs(np.diff(d,n=2,axis=a)).max()) for a in range(3))*(n-1)**2/64**2
    noir=d[0,0,0]; blanc=d[-1,-1,-1]
    print('%-32s points=%d gris_monotone=%s cassure_max=%.4f noir=%s blanc=%s'%(path.split('/')[-1],n,mono,d2,np.round(noir,3),np.round(blanc,3)))
for p in sys.argv[1:]: qc(p)
