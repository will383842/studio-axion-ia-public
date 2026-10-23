# Journal — qualité maximale face caméra avec FFmpeg 8.1.1 (09/10)

Branche `feat/ffmpeg8-qualite`, partie de `origin/master` fd856d6 (PR #6 FFmpeg récent fusionnée). Rien n'a été
fusionné ni déployé, aucun serveur n'a été touché et rien n'a été dépensé.

Toutes les mesures ont été faites avec le FFmpeg **8.1.1 statique des images** (`mwader/static-ffmpeg:8.1.1@sha256:735f…0e0a`,
binaires extraits de l'image), sur un conteneur Linux de 4 cœurs.

## 1. HDR iPhone → SDR BT.709 (studio-aligneur, avant la passe image)

### Détection à la réception

- `studio-aligneur/aligneur/media.py`, `sonder` : en plus de `hdr` et `transfert`, la sonde donne maintenant `primaires`,
  `matrice`, `plage`, `dolbyVision` (profil lu dans `DOVI configuration record`, 8 pour l'iPhone), `maxCll`, et surtout
  `conversion` : `hlg` (arib-std-b67, ce qui couvre Dolby Vision 8.4 dont la couche de base est HLG), `pq` (smpte2084),
  `bt2020` (primaires BT.2020 avec un transfert SDR) ou `""`.
- `studio-rendu/src/operations/analyse-media.ts` (vérificateur de rushs, à la réception) : `hlg`, `pq`, `bt2020`,
  `dolbyVision` et `bits10` s'ajoutent à `hdr`.

### Ce qui n'allait pas dans l'ancienne conversion

L'ancienne chaîne était `zscale=t=linear:npl=100, zscale=p=bt709, tonemap=hable:desat=0, zscale=t=bt709`. Mesurée sur une
**mire HLG construite avec les formules de l'UIT** (BT.2100 et BT.2408 : blanc SDR = 203 cd/m² = signal HLG 75 %, OOTF de
gamma 1,2 sur la luminance, écran de 1000 cd/m²), elle présente deux défauts :

1. **Tout sort trop sombre.** `npl=100` place le blanc de référence à 2,03 et `hable` comprime tout l'intervalle. Un blanc
   SDR à 95 % ressort à 186,6 sur 255 au lieu de 242,2, et un gris à 45 % ressort à 102,0 au lieu de 114,8.
2. **La peau est trop orangée.** zimg (`zscale`) applique l'OOTF HLG composante par composante, et non sur la luminance
   comme le demande BT.2100. Vérifié par le calcul : la peau claire (194, 150, 130) donne (200,7 ; 147,9 ; 124,5) avec une
   OOTF par composante, et on lit (200,8 ; 148,2 ; 124,4). Même avec `npl=203` (bonne luminance), l'écart sur la peau reste
   de ΔE 5,3.

Le FFmpeg statique n'a ni libplacebo ni tonemap BT.2390 (`tonemap` propose none, linear, gamma, clip, reinhard, hable et
mobius). Aucune combinaison de filtres ne fait l'OOTF sur la luminance.

### Choix : une table 3D calculée selon la norme

`media.filtre_conversion_sdr` :
`scale=in_color_matrix=bt2020 (YUV → R'G'B' 16 bits, transfert inchangé) → lut3d (tétraédrique, 65³) → scale=out_color_matrix=bt709:out_range=tv → yuv444p16le → setparams BT.709 tv`.

La table (`media.point_sdr`, en Python pur, sans numpy) suit les étapes suivantes :

- **HLG** : OETF inverse, puis OOTF BT.2100 sur la **luminance** de la scène (Lw = 1000 cd/m²), puis division par 203.
- **PQ** : EOTF, puis division par 203. Le pic vient de MaxCLL, ou vaut 1000 cd/m² à défaut.
- **BT.2020 SDR** : BT.1886.
- Ensuite : matrice BT.2020 → BT.709 en linéaire, les valeurs négatives (hors gamme) étant ramenées à 0.
- **Épaule des reflets** sur le **maximum de R, G, B** au-delà de 0,8 linéaire (≈ 91 % du signal) : pente 1 au genou et
  pic → 100 %. Les rapports R:G:B sont gardés, donc la teinte et la saturation aussi, et rien n'est écrêté. Une première
  version faisait l'épaule sur la luminance : elle blanchissait les rouges très vifs, ce qu'un test a révélé.
- Enfin : BT.1886 inverse (gamma 2,4, la convention de zimg et de la mire).

La table est écrite une seule fois par conteneur (en 1,86 s pour 65³) dans `/tmp/aligneur-luts` (ou `ALIGNEUR_LUTS`),
d'abord dans un fichier provisoire puis renommé. Son nom porte la nature, le pic, la taille et la version.

**Une prise SDR BT.709 passe inchangée** : la chaîne reste `fps=25` (avec `scale=…:flags=area` si demandé), exactement
comme avant. C'est vérifié par un test et par le contrôle réel.

### Mesures sur la mire

Mire de 960 × 720 en HEVC 10 bits sans perte, HLG BT.2020. On lit la moyenne d'un carré de 80 px au centre de chaque case,
en rgb48. Le ΔE*ab est calculé en Lab D65.

| Chaîne | ΔE moyen | ΔE max | ΔE peau (4 teintes) | Gris 45 % (114,8 attendu) | Blanc 95 % (242,2 attendu) | Reflet HLG 85 % / 95 % |
|---|---|---|---|---|---|---|
| Ancienne (npl=100, hable) | 8,80 | 20,99 | 7,96 | 102,0 | 186,6 | 221,8 / 245,6 |
| zscale npl=203, sans tonemap (écrêté) | 3,47 | 8,01 | 5,33 | 114,6 | 242,1 | 255 / 255 (écrêtés) |
| zscale npl=203, mobius 0,6 | 3,96 | 8,01 | 5,33 | 114,6 | 229,0 | 247,1 / 253,2 |
| zscale npl=203, hable | 15,69 | 29,21 | 14,62 | 84,6 | 165,6 | 207,2 / 240,3 |
| **Table 3D (retenue)** | **0,40** | **1,54** | **0,26** | **114,2** | **238,1** | **251,7 / 254,1** |

Valeurs des peaux avec la table 3D, lues contre attendues : claire (193,0 ; 149,6 ; 129,4) contre (194 ; 150 ; 130),
moyenne (165,7 ; 117,6 ; 91,6) contre (166 ; 118 ; 92), mate (140,4 ; 94,5 ; 69,8) contre (141 ; 95 ; 70), foncée
(114,6 ; 81,5 ; 67,7) contre (115 ; 82 ; 68). Le blanc à 95 % perd 4 points (238,1) : c'est le prix de l'épaule qui garde
des détails dans les reflets.

**Coût** (10 s d'HLG 1080 × 1920 à 30 i/s, décodage + préparation + sortie rgb48, 2 essais) : ancienne chaîne 12,53 s et
12,58 s ; table 3D 10,73 s et 11,31 s. La nouvelle chaîne n'est pas plus lente. Pour comparaison, une source SDR prend 1,94 s.

### Vérifier sur IMG_7747 (iPhone, 10 bits)

```bash
# 1. Ce que dit la sonde (attendu : arib-std-b67, bt2020, yuv420p10le, souvent dv_profile=8)
ffprobe -v error -select_streams v:0 -show_entries stream=pix_fmt,color_transfer,color_primaries,color_space:stream_side_data=dv_profile,dv_bl_signal_compatibility_id -of compact IMG_7747.MOV
# 2. Dans studio-aligneur (image ou poste avec FFmpeg 8.1.1)
python -c "from aligneur import media; s = media.sonder('IMG_7747.MOV'); print(s['conversion'], s['dolbyVision']); print(media.filtre_preparation(s))"
#    attendu : « hlg 8 » puis une chaîne scale=in_color_matrix=bt2020 … lut3d=file=/tmp/aligneur-luts/hlg-pic4.926-t65-v1.cube …
# 3. Image témoin à 5 s, ancienne contre nouvelle, côte à côte
F=$(python -c "from aligneur import media; print(media.filtre_preparation(media.sonder('IMG_7747.MOV')))")
ffmpeg -ss 5 -i IMG_7747.MOV -frames:v 1 -vf "$F" nouvelle.png
ffmpeg -ss 5 -i IMG_7747.MOV -frames:v 1 -vf "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv" ancienne.png
```

À regarder : avec la nouvelle chaîne, le mur et le visage sont plus clairs (l'ancienne sous-exposait d'environ un
diaphragme), la peau est moins orange et les reflets (fenêtre, front) gardent leurs détails. Le fichier IMG_7747 n'est pas
disponible dans cette session : **cette vérification reste à faire par Will**.

### Contrôle réel (studio-aligneur, `controle_ffmpeg.py`, 16 contrôles, 14 avant)

- « conversion HDR → SDR juste » : une mire HLG BT.2100 (gris 45 %, peau claire, peau foncée) est codée en HEVC sans
  perte, puis passe par `sonder`, `filtre_preparation` et `lire_images`. Chaque case doit revenir à **3 sur 255 près**.
  **Contre-épreuve** : avec l'ancienne chaîne, le contrôle échoue avec
  `gris 45 % : lu [102.0, 102.0, 102.0] au lieu de [114.8, 114.8, 114.8] (écart 12.8 sur 255)`.
- « prise SDR inchangée » : `filtre_preparation` d'une prise SDR vaut exactement `fps=25`.

## 2. Note de qualité VMAF de l'export (studio-rendu)

### Ce qui est mesuré

La **référence** est exactement ce que x264 a reçu. Le master et le texte repassent dans le **même** graphe d'export
(`grapheExport`, jusqu'au `yuv420p` 8 bits tramé), et la vidéo exportée y est comparée par `libvmaf`
(modèle `vmaf_v0.6.1`, fils = cœurs du conteneur). Le texte n'est donc pas compté comme un défaut : seule la perte de
l'encodage est notée. Si l'on comparait au master sans texte, chaque sous-titre ferait baisser la note.

**Coût** : un `select` garde **une image sur 5** AVANT le graphe. Le passage en 4:4:4, l'overlay et le tramage ne sont
alors calculés que pour ces images. (`n_subsample` de libvmaf, lui, aurait laissé tourner le graphe sur toutes les images.)

| Source de 60 s en 1080 × 1920, export CRF 17 | Images comparées | Note VMAF | Temps de la note |
|---|---|---|---|
| Une image sur 1 (référence) | 1500 | 98,590 | 77,32 s |
| **Une image sur 5 (retenu)** | 300 | **98,710** (+0,12) | **24,02 s** |
| Une image sur 10 | 150 | 99,023 (+0,43) | 15,29 s |

Le pas de 10 gonfle la note (le terme de mouvement de VMAF voit des images 10 fois plus espacées). Le pas de 5 reste à
0,12 point de la mesure complète. Sur ce poste, l'export de cette source prend environ 65 s : la note ajoute donc environ
**37 %** au temps d'export.

### Stockage, seuil, alerte et relance

- **Mesures de la version** : `vmaf` (moyenne), `vmafMin`, `vmafP5` (5e centile), `vmafImages`, `vmafSeuil` et
  `tempsVmafSec`. En cas de relance, s'y ajoutent `vmafRelance` = 1, `vmafAvantRelance` et `crfRelance` (ou
  `debitRelanceKbps`). Si la mesure tombe en panne, on a `vmafErreur` = 1 et la livraison n'est **jamais** bloquée. Ces
  mesures arrivent dans `mesures` du résultat de la composition, que le studio range déjà dans la version
  (`briques/composition/montage.ts`).
- **Seuil** : 93 par défaut. Il est réglable par un **paramètre caché**, dans cet ordre de priorité :
  1. `export.vmafMin` de la demande (champ facultatif de `ParametresExport`) ;
  2. la variable `STUDIO_RENDU_VMAF_MIN` du conteneur (même principe que `STUDIO_RENDU_EXPORT`) ;
  3. 93.

  `STUDIO_RENDU_VMAF=non` coupe la note. Un seuil de 0 mesure la note sans jamais alerter ni relancer. Les deux
  variables sont transmises par `deploiement/docker-compose.yml` et décrites dans `deploiement/env.exemple`.
- **Alerte qualité** (`controlesExport`, studio) : de gravité « attention », par exemple « Note de qualité de l'image
  91,3 sur 100 (VMAF, au moins 93) ». Elle ajoute « même après un second export plus fin » si la relance n'a pas suffi.
  Le seuil est celui que studio-rendu renvoie.
- **Relance UNIQUE** (`exportRelance`, `noterEtRelancer`) : sous le seuil, l'export est refait **une seule fois** à
  CRF − 3, sans descendre sous 12 (une demande en 2 passes passe en CRF 14). Si les 2 passes sont imposées par
  `STUDIO_RENDU_EXPORT`, le débit moyen monte de 25 % sous le plafond. La relance est gardée si sa note est au moins
  égale. Elle a lieu après la boucle de correction de la crête du son.

### Mesures de bout en bout (`exporter` + `noterEtRelancer`, 60 s)

| Source | Export | Débit | Note | Relance | Temps de la note (+ relance) |
|---|---|---|---|---|---|
| Mire testsrc2 10 bits | CRF 17 | — | 98,71 | non | 24,0 s |
| Mire granuleuse (`noise=alls=14`) 10 bits | CRF 17 (export 114,9 s) | 20 427 kb/s (plafond) | 97,60 (min 92,59, P5 93,59) | non | 40,9 s |
| Mire granuleuse 10 bits | CRF 28 (export 84,1 s) | 5 123 kb/s après relance | **92,78 → 95,43** (min 92,85, P5 93,65) | **oui, CRF 25** | 154,8 s |

### Contrôle réel (studio-rendu, `controle-ffmpeg.ts`, 21 contrôles, 19 avant)

- « note VMAF de l'export 10 bits » : `mesurerVmaf` sur l'export CRF 17 du contrôle donne une note ≥ 93.
- « export dégradé (CRF 45) » : la note est sous 93, la relance UNIQUE se fait à CRF 42, elle est gardée, et l'export
  relancé repasse la vérification (High 4.1, BT.709, `+faststart`).
- `tests/ffmpeg-reel.test.ts` : un FFmpeg de poste **sans libvmaf** (le 6.1 d'Ubuntu, par exemple) saute ces deux
  contrôles et le dit. Dans les images, libvmaf est présente et ils sont obligatoires.

## 3. Exports plus rapides : multithreading de FFmpeg 8

### Défaut trouvé

`argumentsExport` (et `argumentsImageFfmpeg`) passaient `-filter_threads <cœurs du conteneur>`. Or c'est l'option des
graphes **simples** (`-vf`) ; nos graphes sont des `-filter_complex`, qui ont leur propre option `-filter_complex_threads`.
Le plafond n'était donc **jamais appliqué** au graphe : FFmpeg prenait tous les cœurs de la machine. Mesure sur le graphe
d'export seul (15 s, 4 cœurs) :

| Option | Durée |
|---|---|
| `-filter_threads 1` | 12,48 s (sans effet) |
| `-filter_complex_threads 1` | 19,88 s (l'option agit) |
| aucune | 10,51 s |

Correctif : `-filter_complex_threads N`, avec en plus `threads=N` sur les trois `scale` du graphe d'export (swscale découpe
alors l'image en tranches ; il travaille sur 1 fil par défaut). x264 garde `-threads N`.

### Mesures avant / après

Source lavfi : master `testsrc2` de **60 s en 1080 × 1920, yuv420p10le** (x264 High 10, CRF 8), son PCM stéréo et texte en
liste `concat`. Export 10 bits CRF 17 réel (`argumentsExport`). La MD5 porte sur le flux vidéo exporté.

| Poste | Réglage | Temps | MD5 du flux vidéo |
|---|---|---|---|
| 4 cœurs libres, fils = 4 | **avant** (`-filter_threads 4`) | **68,95 s ; 63,84 s ; 63,46 s** | e0657ff0… |
| | `-filter_complex_threads 4` | 69,95 s | e0657ff0… (identique) |
| | **après** (`-filter_complex_threads 4` + `scale` à 4 fils) | **67,03 s** | e0657ff0… (identique) |
| | `scale` à 4 fils seulement | 67,14 s | e0657ff0… (identique) |
| | x264 à 6 fils (1,5 × cœurs) | 65,06 s | ef626ed5… (**différent**) |
| Docker `--cpus=2` (quota, comme le compose), fils = 2 | **avant** | **116,86 s ; 117,37 s** | a9b1698c… |
| | **après** | **120,27 s** (tests lancés en parallèle par erreur) ; **113,55 s** | a9b1698c… (identique) |
| Docker `--cpus=4`, fils = 4 | **avant** | **65,54 s ; 65,60 s** | b960d097… |
| | **après** | **66,76 s ; 66,40 s** | b960d097… (identique) |

**Conclusion honnête : aucun gain de vitesse mesurable**. Les écarts restent dans le bruit (± 3 s), et la sortie est
**identique au bit près**, donc la qualité ne change pas. Le profil explique pourquoi. Sur 15 s, l'export complet dure
18,29 s, pour 57,0 s de temps utilisateur et 4,7 s de temps système : il occupe déjà **3,4 cœurs sur 4**. FFmpeg 8 fait
déjà tourner en parallèle le décodage, chaque graphe (en tranches) et l'encodeur. Il n'y a plus de cœur libre à donner.
Sur ces 15 s, le graphe seul coûte 10,34 s (24,6 s utilisateur) : 420 → 444 en 1,67 s, puis l'overlay en 4:4:4 10 bits
(≈ 6,7 s), puis la descente 444 → 420 tramée (≈ 4,0 s). Le décodage ne prend que 0,98 s. Le correctif reste utile : le
plafond de cœurs voulu par le compose est maintenant vraiment appliqué au graphe, et le résultat est le même.
Je n'ai **pas** passé x264 à 6 fils : ce n'est pas plus rapide au-delà du bruit (65,06 s), et ça change la sortie.

**Piste mesurée, non faite** : réduire le calque texte au rectangle qui contient du texte avant l'`overlay`. Le résultat est
identique (même MD5, c5a21e69…), et le graphe passe de 11,27 s à 8,59 s sur 15 s (26,8 s utilisateur → 20,7 s). Mais il
faudrait calculer le rectangle commun à toutes les images du texte (une passe `bbox` sur les PNG), et le gain disparaît
quand titres et sous-titres couvrent l'image. C'est à décider à part.

## Tests et vérifications

- **Contrôle réel, FFmpeg 8.1.1** : studio-rendu **21 / 21 OK** ; studio-aligneur **16 / 16 OK** (avec numpy, comme
  l'image ; le Python du poste n'a pas numpy, ce qui fait échouer 4 contrôles sans lien avec ce travail).
- **Python** (studio-aligneur, `python -m unittest discover -s tests -t .`, avec numpy) : **46 tests OK**. Ce chiffre
  comprend `tests/test_hdr.py` (10 tests) : détection iPhone HLG avec Dolby Vision 8.4, PQ avec MaxCLL, BT.2020 SDR,
  prise SDR inchangée, aller-retour gris et peau à 0,002 près, monotonie, reflets non écrêtés, teinte gardée, PQ à 203
  cd/m², fichier `.cube` et filtre.
- **Vitest ciblés** (FFmpeg 8.1.1 en tête du PATH) : `ffmpeg8-qualite` (nouveau), `ffmpeg-reel`, `m4b-montage`,
  `m4-studio-rendu`, `facecam-pre-cadre`, `ffmpeg-overlay`, `studio-rendu` et `src/briques/composition` : **62 / 62 réussis**.
- **Suite Vitest complète** (`npx vitest run`, FFmpeg 8.1.1 en tête du PATH, 280 fichiers, 2 passages) :
  - 1er passage : **3386 réussis, 15 en échec, 3 sautés** ;
  - 2e passage : **3385 réussis, 16 en échec, 3 sautés**.

  Les échecs sont dans les 5 fichiers déjà en échec sur master, sans lien avec FFmpeg et notés dans
  `JOURNAL-FFMPEG-RECENT.md` : `e2e-verif1-a1-eteints`, `e2e-verif1-bc-serie`, `e2e-verif1-d-interrupteurs`,
  `r0-connexions` et `r6-je-lis-reel`. Au 2e passage s'y ajoute `garde-ecran` (1 échec), qui passe seul
  (6 / 6) : il est intermittent sous charge.
- FFmpeg du poste sans libvmaf (6.1 d'Ubuntu) : `ffmpeg-reel` passe, avec le message « contrôles de la note VMAF NON
  exécutés ».
- `npx tsc --noEmit` (racine, après `next typegen`) : **0 erreur** ; `studio-rendu` `tsc -p tsconfig.json --noEmit` :
  **0 erreur** ; `npx eslint .` : **0 erreur**.

## À faire par Will

1. Relire et fusionner la PR, puis lancer `deploiement/mettre-a-jour.sh`. Le contrôle doit afficher 21 lignes `OK` pour
   studio-rendu et 16 pour studio-aligneur.
2. Passer IMG_7747 dans le studio et comparer avec la procédure ci-dessus. Lire `vmaf` dans les mesures de la version
   (une valeur de 95 à 99 est attendue en CRF 17).
3. Pour changer le seuil : `STUDIO_RENDU_VMAF_MIN=95` dans l'environnement de `studio-rendu`. Pour couper la note :
   `STUDIO_RENDU_VMAF=non`.
