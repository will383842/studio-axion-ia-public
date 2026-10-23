# Journal — Lot P0 du rapport V6 (10/10/2026)

**Branche :** `feat/lot-p0-v6`, partie de master `79aa203`. **Rien n'a été fusionné ni déployé.** Aucun serveur touché, aucun appel réel (ni Claude, ni R2, ni studio-aligneur ou studio-rendu distants, ni téléchargement de modèle). Tout a été mesuré dans le conteneur, avec les doubles et le FFmpeg du poste.

Chaque sous-lot a son commit et son test, écrit **avant** le code et vu **rouge**. Pour le sous-lot 2, le test a été écrit juste après le code, puis vu rouge en retirant le code (`git stash`).

| Sous-lot | Commit | Rapport V6 |
|---|---|---|
| 1. Interdit de mentir | `cc8380a` | n° 6 |
| 2. Look Will gardé et appliqué | `5dbe713` | n° 4 (et la référence du n° 5) |
| 3. Hésitations, bégaiements, phrases en double | `5201625` | n° 7, 8 |
| 4. Composition 10 bits, bandes, passe visage, cartes cumulées | `9885bb4` | n° 1, 2, 3, 9 |
| 5. Écran « Votre look » au premier usage | `fdc9b40` | n° 5 |
| Correctif du test de garde des formats `overlay` | `d246c75` | — |

---

## 1. Interdit de mentir (n° 6)

**Constat de départ :** `zoom`, `titre`, `generique`, `vitesse`, `arretImage`, `masquerPersonne`, `texteDerriere`, la musique et les bruitages étaient acceptés et enregistrés, sans aucun rendu. Le monteur répondait « C'est fait ».

En plus, nous avons trouvé deux autres opérations acceptées mais **jamais rendues** :

- un `ecranPartage` ou une carte sans modèle reconnu était perdu sans rien dire (`cartePosee` rendait `null`) ;
- les réglages posés par le monteur à la PREMIÈRE fabrication (son, teinte, coupes demandées) arrivaient trop tard : le son et la passe image partaient dans le même tour que le monteur, avec les entrées d'avant.

**Ce qui est fait :**

- **Registre `monteur/disponibilite.ts`.** Chaque type du vocabulaire est soit **rendu** (avec l'endroit où il l'est), soit **« Pas encore possible »** avec une phrase pour Will.
- **Rendus branchés :**
  - **zoom :** un plan serré à 130 % sur le passage, d'au moins 2 s, rendu au cadrage. Le code est dans `briques/realisation/zooms.ts`. Le plan est scindé sans jamais franchir une coupe, et le plan voisin repasse à 100 % ;
  - **titre :** une carte « titre » (plein écran seulement sur demande) ;
  - **générique :** une carte « titre plein écran ». Le générique de fin est ramené sur les dernières secondes de la vidéo ;
  - **bruitages :** les sons de la banque du studio (`public/bruitages`, CC0) : whoosh (souffle court), pop, tic, papier, vibration, verre. Ils sont posés au mixage de la composition ;
  - **écran partagé ou carte sans modèle :** une liste faite de ses textes, sinon un titre.
- **Refusés clairement** (l'opération n'est jamais enregistrée) : vitesse, arrêt sur image, cache-moi et texte derrière (détourage non branché), musique (aucun mixage musical branché), bruitage hors de la banque.
- **Zooms non rendus tels quels :** le zoom lent, le zoom flou et le zoom sur la main deviennent un zoom net sur le visage, et Will est averti.
- **Réponse du monteur :** le monteur ne répond plus « C'est fait » quand une demande n'est pas rendue. Sa réponse dit « J'ai fait : … » puis « Pas encore possible : … ». La phrase de Claude n'est pas reprise.
- **« Que puis-je demander ? » et la consigne de Claude** ne proposent plus que ce qui est rendu. La consigne liste aussi ce qui n'est « pas encore possible ».
- **Première fabrication :** ce que le monteur vient de poser (son, teinte, crans, zooms, coupes demandées) est relu dans le même tour.
- **Retouche :** un zoom ajouté refait les plans et la piste montée (nouvelle partie `plans`).

**Tests :**

- `tests/facecam-monteur-honnete.test.ts` : **27 tests**, chaîne complète avec les doubles.
  - Le test transversal parcourt les **19 types** du vocabulaire. Les **15 types rendus** ont chacun une preuve dans la sortie : paramètres envoyés au cadrage, à la passe image, au son ou à la composition. Pour l'effet réaliste par IA, la preuve renvoie à son test de bout en bout existant.
  - Les **4 types non rendus** sont refusés avec « Pas encore possible ».
- Rouge d'abord : **17 échecs sur 26** avant le code.
- Deux anciens tests ont été mis à jour, car ils attendaient l'ancien comportement :
  - `facecam-monteur.test.ts` : la musique « calme » était comptée comme comprise ;
  - `facecam-effets-speciaux.test.ts` : un « cache-moi » était posé.

## 2. Look Will (n° 4)

**Constat de départ :** `facecamLookWill` n'était écrit par **aucun** code. Le réglage `facecam.look` ne gardait que les 3 crans.

**Ce qui est fait :**

- **Module pur `moteurs/montage-facecam/look.ts` :**
  - « Garder pour les prochaines vidéos » range les crans **et** la teinte, et marque la version qui part comme « à mesurer » ;
  - en fin de fabrication de cette version (`memoriserMesureLook`, appelé par `services/travaux.ts`), la peau et le mur **mesurés par la passe image** deviennent la référence. Ils sont rangés dans `projetMontage.lookMesure` ;
  - au **lancement** de chaque nouvelle vidéo face caméra (`services/fabrication.ts`), la commande reçoit les crans et la teinte (si la vidéo n'a pas les siens) et `facecamLookWill`. La chaîne les envoie à la passe image (`lookWill`), qui vise la référence et mesure le ΔE00 (alerte à partir de 4).
- **studio-aligneur :** `mesures_passe` rend aussi `murLab`.

**Tests :**

- `tests/facecam-look-will.test.ts` (dépôts en mémoire, chaîne doublée) suit le bout en bout : retouche gardée, version mesurée, vidéo suivante lancée, passe image avec `lookWill`, alerte « Teint éloigné du Look Will (ΔE 6,3) ». Il est rouge sans le code.
- `studio-aligneur/tests/test_passe_image.py::TestMesuresLook`.

## 3. Hésitations, bégaiements et phrases en double (n° 7, 8)

**Constat de départ :** la transcription réelle d'IMG_7747 contient **0 « euh »**. Le test le revérifie sur `tests/fixtures/img7747-v2-montage-reel.json`.

**Ce qui est fait :**

- **Invite Whisper VERBATIM :** un exemple avec « euh », « hum » et « je, je » est placé avant le glossaire. Whisper recopie le style de son invite.
- **Détection acoustique des pauses remplies** (`studio-aligneur/aligneur/hesitations.py`, numpy seul). Une pause remplie, c'est :
  - une voyelle tenue, voisée, au timbre et à la hauteur stables ;
  - d'au moins 0,22 s ;
  - assez forte, mais pas plus de 18 dB sous la parole ;
  - à 70 % au moins hors des mots transcrits.

  Chaque pause trouvée devient un mot « euh » (`source: "acoustique"`), que la brique `coupes` coupe. Le WAV flottant extrait par FFmpeg est maintenant relu, et `transcrire_fichier` est enfin testé (avec un modèle simulé).
- **Aucune phrase en double :** une suite d'au moins 4 mots redite à moins de 10 s est coupée la première fois. On garde le dernier essai, sauf si le texte validé contient lui-même la répétition.
- **Contrôle `phrasesEnDouble` :** les alertes « entendu deux fois » et « phrase absente » sont maintenant **bloquantes**.

**Résultats :**

- Détection acoustique sur son synthétisé (syllabes variées, respiration, voyelle tenue dans un mot, « euh » hors des mots), sur **30 tirages** : **0 « euh » manqué, 0 fausse détection**. Le chemin réel est testé aussi : WAV → `extraire_son` du vrai FFmpeg → relecture → détection.
- Sur la vraie transcription d'IMG_7747, avec 3 « euh » acoustiques posés dans de vrais blancs de la prise : les 3 sont coupés, et aucune coupe ne tombe dans un mot.
- Tests : `studio-aligneur/tests/test_hesitations.py` (6 tests) et `tests/facecam-hesitations-doubles.test.ts` (6 tests ; 4 étaient rouges avant le code. Les 2 tests « euh » et « je je » passaient déjà : la brique les coupait, c'est l'amont qui ne les donnait pas).

**Limite honnête :** l'invite verbatim et le détecteur n'ont **pas** été essayés sur une vraie voix. Il n'y a ni prise avec des « euh » dans le dépôt, ni modèle Whisper téléchargé (aucun appel réel). Le « 0 euh sur IMG_7747 » réel reste à remesurer sur le serveur avec la nouvelle invite (décision n° 5).

## 4. Composition 10 bits, bandes, passe visage, cartes cumulées (n° 1, 2, 3, 9)

**n° 1 — Composition 10 bits.**

La composition « 10 bits » était en fait du 8 bits, à deux endroits :

- le graphe RVB (`gbrp` / `gbrap`) ;
- **et** `chaineCouleurs`, qui repassait en `yuv420p` avant la vignette et le grain.

Maintenant, quand la source est en 10 bits, le graphe travaille en `gbrp10le` / `gbrap10le`. Les superpositions passent en `yuv444p10`, car `overlay` n'a pas de RVB 10 bits. LUT, vignette et grain restent en 10 bits. La seule descente en 8 bits a lieu à l'export, avec tramage.

**Mesure au vrai FFmpeg** : une ligne d'un dégradé de mur, 96 niveaux lus entre 10 % et 90 % de la largeur.

| Chemin | Niveaux gardés |
|---|---|
| Master « 10 bits » d'avant | **34 / 96** (vu rouge) |
| Master 10 bits corrigé, plan plein | **96 / 96** |
| Master 10 bits corrigé, moitié basse d'un écran partagé | **96 / 96** |
| Témoin 8 bits (avocat) | **25 / 96** |

Les couleurs entre 8 et 10 bits sont identiques à moins de **0,6 / 255** en moyenne RVB (plan plein et écran partagé). Le graphe de l'avocat est inchangé, à l'identique (test existant).

**n° 2 — Contrôle des bandes.** Une mire « dégradé de mur 10 bits » est ajoutée aux deux contrôles réels :

- `studio-rendu/src/controle-ffmpeg.ts` (lancé par `verifier-outils-video.sh` et `tests/ffmpeg-reel.test.ts`) ;
- `studio-aligneur/aligneur/controle_ffmpeg.py` (encodeur de la passe et LUT).

Les deux exigent au moins 85 % des niveaux gardés. Il n'y a **pas encore** d'alerte sur la vidéo de Will elle-même : il faudrait repérer une zone de mur dans la prise (reste à faire, P1).

**n° 3 — Passe visage exécutée.** `executer_passe` → `Passe.traiter` est exécutée de bout en bout par un test, avec le vrai FFmpeg et le vrai OpenCV. Le support : 5 s d'un visage **de synthèse** (points posés comme ceux de `/visages`, grain temporel, bouche ouverte de 2 à 3 s). Résultats :

- luminance du visage passée de **93** à la plage **100-140** ;
- bruit en baisse (`bruitRatio` < 1) ;
- gain fixe : écart-type du rapport sortie / entrée sur le mur **< 0,01** sur 5 instants, donc aucun pompage ;
- dents blanchies **seulement bouche ouverte** : b* inférieur d'au moins 3 à celui des mêmes dents quand la piste dit « fermée ».

En chemin, une **mesure** (et non une panne) : le gain global de 1,27 plus la lumière virtuelle saturent des dents claires, ce qui fait tomber leur b* jusqu'à 5 sans aucune retouche des dents. Le test utilise donc des dents plus sombres.

**Limite :** pas de vraie prise avec un visage dans le dépôt, et pas de modèle MediaPipe (aucun téléchargement). L'essai sur IMG_7747 avec ses mesures reste à faire sur le serveur.

**n° 9 — Cartes cumulées.** `cartesAvecAutomatiques` place les cartes du monteur d'abord, puis les automatiques dans les trous :

- 1 s d'écart au moins ;
- jamais sur un effet spécial ;
- en 9:16 comme dans les formats.

Sur IMG_7747, avec une carte du monteur : **1 carte avant**, **au moins 5 maintenant** (`tests/facecam-cartes-cumulees.test.ts`, vu rouge avec « expected 1 to be ≥ 5 »).

## 5. « Votre look » au premier usage (n° 5)

- Une carte « Votre look » s'affiche sur « Votre vidéo » tant qu'aucun look n'est validé.
- **« C'est mon look »** garde les crans et la teinte de la version affichée, **sans nouvelle version**. La référence mesurée est posée tout de suite si la version a été mesurée.
- **« Le régler d'abord »** ouvre la feuille Image avec « Garder pour les prochaines vidéos » coché.
- L'avant/après glissé n'est **pas** fait.
- Test : `tests/facecam-look-will.test.ts`.

---

## Vérifications (résultats exacts)

| Vérification | Résultat |
|---|---|
| `next typegen` puis `tsc --noEmit` | **0 erreur** |
| `tsc -p studio-rendu` | **0 erreur** |
| `eslint .` | **0 erreur, 0 avertissement** |
| Vitest, état de départ (master `79aa203`) | 285 fichiers : **3 528 réussis**, 1 échec, 3 sautés. L'échec est un délai de 5 s dépassé dans `e2e-verif1-bc-serie.test.ts`, sous charge ; il est passé au second lancement |
| Vitest, suite complète (une fois, en fin de lot) | **290 fichiers (288 réussis, 1 en échec, 1 sauté) ; 3 568 tests réussis, 1 échec, 3 sautés** |
| Échec de la suite complète | `ffmpeg-overlay.test.ts` : le test de garde lisait `format=${fOv}` comme une valeur. Corrigé (`d246c75`) : la variable est vérifiée par ses deux valeurs. Fichier relancé seul : **4/4** |
| Tests ciblés après correction | facecam, effets, look, coupes, réalisation, FFmpeg réel : tous verts |
| Tests Python (`unittest discover`, Python 3.13 du poste, numpy 2.1.3, OpenCV 4.11.0.86, MediaPipe 1.1.0, faster-whisper 1.1.1, sans modèle) | **68 tests OK** (39 au rapport V6) |
| Contrôle réel `aligneur.controle_ffmpeg` (FFmpeg 6.1.1 du poste) | **17/17** (dont la nouvelle mire) |
| Contrôle réel `studio-rendu/src/controle-ffmpeg.ts` (FFmpeg 6.1.1 du poste) | **21/23**. Les 2 échecs sont les notes VMAF : libvmaf est absent du FFmpeg du poste. Cet échec existait avant le lot ; libvmaf est présent dans le FFmpeg 8.1.1 des images. Le nouveau contrôle « aucune bande sur le dégradé du mur » est **OK** |

**Ce qui n'a pas pu être fait ici :**

- vrai FFmpeg 8.1.1 des images : le poste a la version 6.1.1. Le graphe 10 bits utilise `overlay=format=yuv444p10`, présent en 8.1.1 (test de garde) ;
- Python 3.11 de l'image : les tests ont tourné en 3.13 ;
- essais sur une vraie prise (IMG_7747) ;
- appel Whisper ou MediaPipe réels.
