# Journal — reprise absorbée et cartes automatiques (IMG_7747 v2, 10/10)

Données réelles : `tests/fixtures/img7747-v2-montage-reel.json` (312 mots, coupes et cartes produites en prod) et
`tests/fixtures/img7747-transcription-whisper.txt` (ce qui a vraiment été dit). Aucun appel réel, aucun serveur touché,
rien de fusionné ni de déployé.

## Défaut 1 — vraie reprise non coupée

### Cause
- Will dit « Quel que soit votre taille. Si vous sentez que du temps, » (101,76 → ~111,2 s), puis redit **tout** à
  111,20 s. Dans les mots fournis à la brique coupes, chaque mot n'existe qu'une fois : la redite a été **absorbée**
  par des mots étirés (« Si » 1,26 s, « sentez » 3,42 s, « échappe, » 3,56 s, pour 0,16 à 0,41 s attendus). Ce sont
  les seules anomalies du fichier entier (vérifié : aucun autre mot > max(0,8 s, 2,5 × attendu), aucun autre trou en
  pleine phrase).
- La brique coupes (mode texte) cherche les phrases dites deux fois : avec une seule occurrence, elle ne voit rien.
- Origine des mots, à vérifier sur le serveur (sans y toucher) : dans ce dépôt, `/transcrire` est un Whisper libre
  (faster-whisper `small`, glossaire, sans le texte ; le texte n'est envoyé qu'en simulation). Les mots du fixture
  ressemblent pourtant à une transcription où la redite a disparu (Whisper saute souvent un passage répété et étire
  alors les mots ; ou un alignement forcé). Le résultat est le même pour la brique : elle doit se débrouiller seule.
- Ce que `studio-aligneur` peut fournir : le json.gz de `/transcrire` contient les mots et les `segments` du même
  Whisper (qui a manqué la redite) ; aucune seconde transcription libre n'existe aujourd'hui. La brique accepte donc
  une transcription libre **facultative** (`motsLibres`) ; la chaîne la passe si le résultat de `/transcrire` porte un
  champ `motsLibres` (rien ne change tant qu'il est absent).

### Correction
- `src/briques/coupes/absorbees.ts` (nouveau, pur) : mots étirés et trous de plus de 1,2 s en pleine phrase,
  regroupés ; reprise soupçonnée à partir de 2,5 s de temps en trop. La prise complète finit avec la dernière
  anomalie ; son départ est le début de phrase (celle de la première anomalie ou l'une des 2 d'avant) dont le nombre
  de mots correspond au temps en trop, au débit de la personne mesuré sur la vidéo (0,24 s par mot ici), avec 0,15 s
  de marge ; avec une transcription libre, le départ est lu dedans (dernière occurrence du début de phrase).
  **Dans le doute, on garde** : seuil non atteint, aucun début de phrase plausible (écart > 40 %), ou transcription
  libre sans redite → rien n'est retiré.
- `calculerCoupes` (mode texte) : la première tentative devient une coupe `reprise` (« Phrase reprise : « Quel que soit
  votre taille. Si vous… » »), et les mots repris sont **recalés** sur la prise complète (`plan.recalages`, appliqués
  par `appliquerRecalages`) : sous-titres et cartes tombent sur la bonne prise, aucune coupe dans un mot. La chaîne
  garde les recalages dans `etat.coupes.recalages` et les applique partout où elle relit les mots de la prise.
- `texte.ts` (`occurrences`) : un faux départ (seul le premier mot reconnu, puis des mots « de trop ») ne démarre plus
  une occurrence : « claires **et** classées. Et vous comprendrez » avalait la phrase « En 45 minutes… », qui n'était
  plus retrouvée.
- `controlerCoupes` : une phrase est présente si la plupart de ses mots sont entendus (avant : seul son milieu était
  regardé ; il tombait dans un blanc raccourci).

### `phrasesManquantes` — faux positif confirmé et corrigé
Sur le fixture, l'ancien code signalait la phrase 0 (milieu 18,02 s dans le blanc 17,84 → 18,24 s) et la phrase 21
(« En 45 minutes… », avalée par le faux départ ci-dessus) alors que tout est dit. La prod en comptait 5 avec le texte
validé réel (non fourni) : mêmes deux causes. Résultat maintenant : **0 phrase manquante**.

### Résultats exacts sur le fixture (texte validé reconstitué, et texte écrit comme les mots : identiques)
| | Avant | Après |
|---|---|---|
| Coupes hors blancs | début 0 → 14,88 ; fin 117,48 → 130,732 | début 0 → 14,88 ; **reprise 101,04 → 110,72** ; fin 117,48 → 130,732 |
| Blancs raccourcis | 30 | 28 (les 2 blancs de la première tentative sont dans la reprise) |
| Durée montée | 90,72 s | **82,68 s** |
| `phrasesManquantes` | [0, 21] | [] |
| Coupes dans un mot | [] | [] |
| Avec la transcription Whisper du fixture | — | reprise 101,04 → **111,20** (départ exact) |

Marge du mode « débit » : la coupe finit 0,48 s avant 111,20 (on garde un souffle plutôt que de couper le « Quel »).

## Défaut 2 — cartes automatiques pauvres et incohérentes

### Cause
Sans consigne « Monteur, … », Claude n'est pas appelé (`piloterMonteur` n'appelle le rôle monteur que s'il y a des
consignes) : les cartes viennent de l'**heuristique** `planifierEcransPartages` → `choisirModeleTous` → `liste()` de
`choix.ts`, 3 cartes au plus, 25 % de la durée, 6 s d'écart. « un outil » était pris pour une annonce de liste
(« un » = 1 + « outil ») : titre « veut colmater en ajoutant un outil », un seul point « De plus ». Pas de rôle Claude
à corriger ni de double de test à ajouter : c'est l'heuristique qui est corrigée.

### Correction
- `src/briques/habillage-facecam/cartes-auto.ts` (nouveau, pur) : `planifierCartesAuto(mots, durée, réglages)` sur les
  mots de la vidéo montée. Détecteurs : liste numérotée (« Un, / Deux, / Trois, » ou 1. 2. 3.), propositions
  parallèles (≥ 3, même sujet + verbe, ou même déterminant), noms énumérés (une phrase et sa suite en « Ou… »), chiffre
  + qualificatifs (« gratuit · en visio »), titre nommé (fusionné en sur-titre du chiffre qui suit : deux cartes de 3 s
  ne tiennent pas dans 5,3 s de parole), problème → solution (« X, alors que … c'est de Y »), « pas X, Y » (icône +
  mot), appel à l'action final ; puis les règles des 13 modèles passées au crible (textes tirés de la phrase, liste ≥ 2
  points, jamais un mot de liaison seul, jamais de titre). Chaque élément porte son `aSec` = mot dit. Densité : comblement
  de tout trou de plus de 20 s (`ecartCibleSec`, réglable), aucun chevauchement, 3 à 8 s par carte ; la traîne d'une
  carte peut être raccourcie pour laisser passer la suivante.
- Branché dans `habillageFacecam` et dans les déclinaisons (`declinaisons.ts`) à la place de `planifierEcransPartages`
  (gardée, exportée, testée). Toutes les cartes automatiques sont en **moitié haute** (écran partagé : le visage reste
  visible en bas).
- `choix.ts` (`liste`, commun à l'avocat) : une annonce « un / une » n'est plus une liste ; un point fait seulement de
  mots de liaison est écarté. Suite avocat verte.

### Cartes produites sur le fixture (temps de la vidéo montée, 82,68 s)
| Début → fin (s) | Modèle | Contenu (apparition au mot dit, s après le début de la carte) |
|---|---|---|
| 3,04 → 6,04 | icône + mot | « Pas un problème de travail » → **Une fuite** (goutte) à 1,74 |
| 7,35 → 13,15 | liste | Les soirées sur les devis (0) · Les relances à la main (1,14) · Les chiffres qui arrivent trop tard (2,20) |
| 15,73 → 23,69 | liste « Chez Axion-IA » | Forme les équipes (0,76) · Accompagne en one-to-one (2,12) · Audite (4,26) · Automatise (5,62) — **(a)** |
| 27,15 → 35,03 | problème → solution | Un outil de plus, une embauche de plus → « La vraie première étape » : Trouver la fuite (4,30) |
| 46,20 → 51,02 | chiffre | sur-titre **Le diagnostic fuite** (dès « Le ») — **45 min** · gratuit · en visio, compteur à 2,94 (« 45 ») — **(c) (d)** |
| 51,32 → 59,21 | liste numérotée « 3 questions » | Où part votre temps ? (0,20 = « Un ») · Qu'est-ce qui peut changer en premier ? (2,80 = « Deux ») · De quoi avez-vous besoin ? (5,19 = « Trois ») — **(b)** |
| 59,89 → 67,63 | liste | Formation (0) · Accompagnement one-to-one (3,60) · Audit complet (5,50) · Automatisation (6,20) |
| 79,46 → 82,63 | titre | **Réservez votre appel diagnostic gratuit** — **(e)** |

8 cartes au lieu de 2, 5 modèles différents, plus aucune carte absurde. Écart le plus long entre deux débuts : 20,75 s
(59,89 → 79,46 : rien d'illustrable n'y passe le crible).

Note : le texte validé réel n'est pas dans le fixture ; le test le reconstitue depuis les mots en rétablissant
l'orthographe du script là où la transcription se trompait (colmater, Certifexemple, « Où part », « Un, Deux, Trois »,
« audite »). Les cartes de prod citaient « colmater » : elles sont bien bâties sur le texte validé.

## Vérifications
- `tests/facecam-reprise-cartes.test.ts` (nouveau, 16 tests sur les données réelles) : vert.
- Ciblés (`src/briques/coupes`, `tests/facecam-*`, `tests/v-coherence-facecam`, `tests/h-facecam*`,
  `tests/z-integration-facecam`, `src/briques/motion`, `src/briques/monteur`, `src/briques/habillage-facecam`) :
  22 fichiers (dont le nouveau), 272 tests, verts (un test des 13 modèles a d'abord échoué : le chiffre seul passait avant le
  graphique à 3 valeurs ; corrigé, le graphique est posé d'office).
- Suite complète Vitest : 280 fichiers verts (1 ignoré), 3418 tests verts (3 ignorés).
- `next typegen` puis `tsc --noEmit` : 0 erreur (après installation des dépendances de `studio-rendu`, sans quoi
  `@remotion/*` manque). `eslint .` : 0 erreur, 0 avertissement.
