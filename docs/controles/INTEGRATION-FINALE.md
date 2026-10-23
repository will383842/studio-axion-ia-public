# INTÉGRATION FINALE (04/10/2026)

Branche `outils/final`, partie de master **b544423** (en ligne). `master` n'a pas été touché.

## 1. Fusions

| Étape | Résultat |
|---|---|
| `git merge --no-ff origin/outils/final-a` | sans conflit |
| `git merge --no-ff origin/outils/final-b` | sans conflit |
| Préparation : `pnpm install --frozen-lockfile`, `npx next typegen`, `studio-rendu : npm ci --ignore-scripts` | OK |

Premier passage de la suite après les fusions : **17 `it.fails`** restaient. Il y avait aussi **6 tests rouges** dans `e2e-verif2-limites` : la nouvelle règle de A, « une vidéo d'exemple ne part pas chez Buffer », touchait les vidéos d'exemple de ce test.

## 2. Restes « Non corrigé » du rapport A : corrigés

Pour chaque reste, le test était rouge avant (`it.fails`, ou nouveau test rouge sur l'ancien code) et il est vert après. Le titre du test passe de « ROUGE » à « CORRIGÉ ».

| N° | Reste | Correction | Preuve |
|---|---|---|---|
| 1 | Une idée arrêtée à 0 € consommait un numéro d'épisode. | L'épisode est pris **au départ réel de l'écriture**, dans `attribuerNumero`, avec le numéro du sujet (décision prise). À la création, le sujet est seulement rangé dans la série. Un sujet déjà écrit qu'on rattache reçoit son épisode tout de suite. Si la série est rangée entre-temps, l'écriture continue, sans épisode. | `e2e-verif1-bc-serie` « CORRIGÉ — une idée arrêtée à 0 €… » : épisodes `[1, 2]`. Le constat voisin et `e7-series` suivent la nouvelle règle. |
| 2a | Prix « vidéo de 45 s » sans les illustrations. | Nouvelle ligne « Illustrations fabriquées (jusqu'à 8) », ajoutée seulement quand fal.ai est branché. Le nombre type vient de la recette avocat : 25 % de couverture découpée en plans de 1,5 s, soit ⌈45 × 0,25 ÷ 1,5⌉ = **8**, au prix fal.ai image + clip de 5 s. C'est le plus grand nombre que la cascade puisse laisser « à fabriquer » : le prix n'est jamais sous-estimé. | `e2e-verif1-d` « CORRIGÉ — le prix de 45 s… à moins de 10 % de l'aperçu ». Nouveau test `r8-montage-reel` (nombre type, ligne absente sans fal.ai). |
| 2b | Voix HeyGen annoncée 0 €. | La brique Voix estime une voix HeyGen à son tarif au caractère (0,03 c$), **arrondi au centime supérieur**. Il en va de même pour la ligne Voix du prix de 45 s : 19,44 c€ deviennent 20 c€. Le pré-vol contrôle et réserve maintenant ce montant. | `e2e-verif1-d` « CORRIGÉ — la voix HeyGen est annoncée à son vrai prix ». `r8-montage-reel` : une voix d'1 s coûte 1 c€, jamais 0. |
| 3 | fal.ai : pas d'idempotence. | Chaque soumission est **tracée en base** par sa clé d'idempotence (`fal.demande.<clé>`) : « envoi » avant l'appel, puis « soumise » avec l'identifiant dès la réponse. **Avant toute soumission**, la trace est lue. Si elle dit « soumise », la même demande est reprise et rien n'est renvoyé. Si elle dit « envoi » (coupure pendant l'envoi), la demande est incertaine : elle est comptée comme payée, le plan garde le double, et elle n'est jamais renvoyée. Après un échec chez fal.ai, la nouvelle tentative prend une clé neuve. | Nouveau `tests/integration-finale-fal.test.ts` : 3 tests, dont **2 rouges sur l'ancien code**. |
| 4 | Rendu HeyGen « processing » sans délai maximal. | `DELAI_MAX_RENDU_DOUBLE_MS` = **6 h** depuis l'envoi de la pièce. Au-delà, échec réessayable. Will lit « HeyGen n'a pas terminé votre double en 6 heures. Touchez « Réessayer » : ce qui est déjà payé ne sera pas repayé. » et reçoit une notification d'échec. « Réessayer » relance seulement la pièce bloquée, après avoir relu l'ancien rendu : s'il a fini entre-temps, il est gardé et rien n'est resoumis. La voix n'est pas relue. Les textes bruts de HeyGen (`failure_message`) ne vont plus qu'en console et dans `detailTechnique`. Un refus définitif montre la vraie raison en français. | `e2e-verif1-g-ecran-fabrication` (2) et `e2e-verif1-ef-reessayer-redemarrage` (3) passent en « CORRIGÉ ». Nouveau test « Réessayer après délai : l'ancien rendu fini entre-temps est repris ». |
| 5 | Finition perdue au redémarrage. | Les suites d'une fabrication terminée (miniatures, textes du kit, versions par réseau) sont **notées en base dans la même écriture que « terminé »**, puis levées une fois faites. Au premier tour d'un nouveau processus, les finitions notées sont reprises une fois. Chaque suite est sans effet si elle est déjà faite : rien n'est repayé. | `e2e-verif1-ef` « CORRIGÉ — redémarrage entre « terminé » et la finition ». Le test vérifie aussi qu'un second redémarrage ne refait rien et ne relance aucun appel Claude. |

**Limite connue (n° 4)** : si l'ancien rendu n'a toujours pas fini au moment de « Réessayer », un nouvel envoi dépasserait le plafond accepté au lancement (1,5 fois les secondes annoncées). L'ancien rendu reste compté, car HeyGen peut encore le facturer. Rien n'est alors envoyé, et Will lit qu'il doit relancer la vidéo pour voir le nouveau prix. C'est voulu (« aucune dépense sans prix et accord »). Un renvoi sans nouvel accord demanderait une décision de Will.

## 3. Autres `it.fails` de VERIF-E2E-1 et 2 (rejoués et corrigés)

| Test | Correction |
|---|---|
| bc-import · .pdf scanné | Nouveau refus `IMPORT_SCAN` : « Ce fichier est une image (un scan)… Copiez le texte et collez-le, ou dictez-le. » |
| bc-import · .txt en Windows-1252 | `decoderTexteFichier` : UTF-8 strict, sinon une vraie table Windows-1252 (œ, €, guillemets courbes). Le même code sert dans le navigateur et sur le serveur. |
| bc-import · .docx avec Maj + Entrée | Chaque `<w:br/>` et `<w:cr/>` devient un saut de ligne : les mots ne sont plus soudés. |
| bc-import · lignes d'un paragraphe de .pdf | `recollerLignesPdf` recolle les lignes d'un même paragraphe. Une phrase finie par une ponctuation reste maintenant entière jusqu'à **32 mots** (`MOTS_MAX_PHRASE`, 16 avant) pour tout texte collé. Un texte sans ponctuation est toujours coupé à 16 mots. |
| bc-import · « en fin de ligne | Le guillemet passe avec le mot qui suit (`ouvrantsAvecLaSuite`). Aucun mot n'est réécrit. |
| g-import-autonome · .pdf dans l'image | Le test reprend l'alias haché `unpdf-<empreinte>` de la vraie sortie Turbopack. Il est prouvé aussi dans l'image (voir § 4). |
| e2e-verif2-limites · « Réécrire ce texte » touché deux fois | La marque `reecrituresEnCours[réseau]` est posée sous le verrou du kit, avant l'appel payant. Le second toucher reçoit `REECRITURE_EN_COURS` (« Ce texte est déjà en cours de réécriture… »). Une marque de plus de 5 min est ignorée. |
| a1-allumes · illustration Pexels dans une vidéo de version | `plansIndicatifsDeLaVersion` remplace `plans: []` : la cascade (Bibliothèque, banques gratuites, puis « à fabriquer ») s'applique au texte assemblé de la version. Ce qui est à fabriquer est **compté dans le prix avant l'accord**. « Je lis » est inchangé (0 €). |
| e2e-verif2-limites · 6 tests Buffer | Ils avaient rougi à la fusion. Leurs vidéos reçoivent l'état d'une vraie fabrication (`tests/helpers/videos-reelles.ts`), et la règle de A n'a pas changé. |

**Il ne reste aucun `it.fails`** dans `tests/` ni dans `src/`. La seule mention restante est dans un commentaire d'en-tête qui décrit l'ancienne convention.

## 4. Contrôles (tête de `outils/final`)

| Contrôle | Résultat |
|---|---|
| `npx tsc --noEmit`, racine | 0 erreur |
| `npx tsc --noEmit`, studio-rendu | 0 erreur |
| `npx eslint .` | 0 remarque |
| `npx vitest run` (complet) | **232 fichiers OK** (1 ignoré), **2 863 tests verts**, 3 sautés, **0 `it.fails`**, 0 rouge (avant ce travail : 17 `it.fails` et 7 rouges) |
| `npx next build --webpack` | réussi, sans avertissement |
| `pnpm build` (Turbopack, comme le Dockerfile) | réussi. 2 avertissements « Edge Runtime » sur `src/instrumentation.ts` : fichier inchangé depuis master, avertissements déjà présents. L'alias `unpdf-fe9c66141c03beec` est bien dans `.next/standalone/.next/node_modules`. |
| studio-aligneur : `python -m unittest discover -s tests -t .` | 21 tests OK. Il a fallu installer `numpy` dans ce bac à sable. |
| `shellcheck -x deploiement/*.sh` | 0 remarque |
| **Image racine** (`Dockerfile`) | **construite**. Comme pour le correcteur B, une copie du Dockerfile ajoute le certificat du mandataire de ce bac à sable aux étapes de construction. L'étape `run` est identique. |
| **Image racine lancée** (`STUDIO_SANS_BASE=1`) | santé **healthy**, `/api/sante` renvoie `{"ok":true}`. Connexion réelle par `/connexion` (Chromium), puis `POST /api/import` : **.pdf → 200**, texte avec les lignes recollées en une phrase ; **.docx → 200**, `<w:br/>` devient un saut de ligne. |
| Image studio-rendu | **non construite ici** : `deb.debian.org` est refusé par la politique réseau de ce bac à sable (403), donc `apt-get` échoue. Le garde-fou des fichiers copiés (`final-b-image-rendu-fichiers`) est vert : `erreur-lisible.ts`, modifié ici, n'importe rien. |

### Correctif d'image trouvé en route

`next build` vérifiait aussi les types de `tests/`. Plusieurs tests importent `studio-rendu/src/…` (Remotion), dont les dépendances ne sont pas dans l'image : **l'image racine ne se construisait plus**. Sur master, l'erreur des polices Google cachait ce défaut. Correction : `tests` ajouté à `.dockerignore`, car les tests n'ont rien à faire dans l'image.

## 5. Gestes serveur

- **Aucune migration.** Les nouveautés en base sont des réglages : `fal.demande.<clé>`, `fabrication.finitionAFaire.<travail>`. Il y a aussi un champ facultatif du kit, `reecrituresEnCours`. Rien n'est effacé.
- Au déploiement : construire l'image depuis `outils/final` une fois fusionnée. Puis faire « Importer un fichier » avec un .pdf et un .docx, et vérifier que `docker compose ps` montre tous les services `healthy`. L'image studio-rendu n'a pas pu être construite ici : à vérifier sur le serveur.
- À savoir pour Will : le prix « vidéo de 45 s » monte quand fal.ai est branché (environ +1,06 € pour 8 illustrations au plus). La voix n'est plus jamais annoncée 0 €.

Aucun appel réseau réel vers un fournisseur, aucune clé réelle, aucune donnée effacée.
