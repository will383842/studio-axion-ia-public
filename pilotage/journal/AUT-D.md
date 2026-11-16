# AUT-D : frein image→vidéo sous plafond de l'Usine
1. `src/services/image-video.ts` : l'accord de script absent ne refuse plus si `accordSansClicPour(dep.origine, videoId)` (indicatif OU Usine avec autonomie allumée) ; même règle pour la décision du script gardée (sinon la fabrication resterait à la porte).
2. Interrupteur éteint, à 0, absent ou illisible : comportement actuel inchangé (`PHRASE_ACCORD_ABSENT_IV`). Studio inchangé.
3. Le plafond lui-même est appliqué par la réservation qui suit (`verifierEtReserverSelonOrigine`, lot C) : ce lot ne le recode pas ; le test l'observe par un double.
4. Tests : `tests/autonomie-usine-image-video.test.ts` (7, mémoire, 0 €). Rouge vérifié sans le correctif : 2 échecs (allumée sous plafond, au plafond).
5. Mutation rejouée : `accordSansClicPour` → `budgetIndicatifPourVideo` : 2 tests rouges ; restauré, vert.
6. Constat hors périmètre (auditeur) : `budgetIndicatifPour` (mode-budget.ts) ne tient pour Usine que la chaîne exacte « usine » ; une origine « Usine », vide ou objet donne donc `indicatifIV` vrai ici (accord présumé), avant même AUT-D. À traiter dans un lot qui peut toucher mode-budget.ts.
7. Fichiers touchés : les trois autorisés, aucun autre.

## Correction (relecture PR 559)
1. Défaut : l'accord sans clic était décidé sur l'origine NORMALISÉE (lue sur la vidéo si la commande n'en porte pas : « usine »), mais la réservation recevait l'origine BRUTE (`undefined`, lue « studio » par la caisse) : cas B, autonomie allumée, plafond 1 centime, voix 40 c → réservé par le chemin Studio au-delà du plafond de l'Usine.
2. Correctif (`src/services/image-video.ts` seul) : l'origine est résolue UNE SEULE FOIS (`dep.origine ?? origineDeLaVideo`). La même valeur décide de l'accord (`accordSansClicPour(origineResolue)`, décision du script gardée comprise) ; la réservation (voix et pré-vol Claude) reçoit « usine » si l'origine était absente et la vidéo d'Usine, sinon la valeur brute inchangée (Studio, vidéo sans version, « Usine » en casse traité par la caisse depuis AUT-F). Interrupteur éteint : identique à avant (`PHRASE_ACCORD_ABSENT_IV`).
3. Tests : 6 ajoutés (13 au total). Mutations rejouées puis restaurées : origine brute à la réservation → 2 rouges (cas B) ; `accordSansClicPour` → `budgetIndicatifPourVideo` → 4 rouges. Le test « Usine » en casse ne peut pas rougir sous l'origine brute (la valeur brute y est déjà « Usine ») : il verrouille l'absence de régression.

## Correction complémentaire (cas A : casse de l'origine)

1. Reste après la correction précédente : l'origine fournie par la commande était transmise BRUTE à la réservation (« Usine » en casse → réservation par le chemin Studio, alors que `accordSansClicPour` la normalise en Usine et donnait l'accord).
2. Correctif (`src/services/image-video.ts`) : l'origine résolue une seule fois est désormais NORMALISÉE (`normaliserOrigine(dep.origine)`, sinon origine lue sur la vidéo) ; cette même valeur va à `accordSansClicPour`, à la réservation de la voix et au pré-vol. Interrupteur éteint : `PHRASE_ACCORD_ABSENT_IV` inchangé ; Studio explicite inchangé (une commande sans origine d'une vidéo Studio part désormais en « studio » au lieu de `undefined` : même chemin).
3. Tests : cas A (« Usine » allumé → réservation « usine »), cas C (éteint → refus, rien réservé), cas B et Studio conservés. Mutations rejouées (rouges, restaurées) : origine brute à la réservation ; `accordSansClicPour` → `budgetIndicatifPourVideo`.
4. `credits.ts` non touché (point 2 levé par AUT-F, PR 546).
5. Le mode indicatif (`budgetIndicatifPourVideo`) et `accordAutomatique` reçoivent aussi l'origine résolue : « Usine » en casse n'ouvre plus l'accord par l'indicatif (constat n°6 de la première section, levé).

## Correction 3 (relecture Opus PR 559, points 1 et 2)
1. Point 1 (double lecture Studio) : levé par la correction précédente de la branche (origine résolue et normalisée une seule fois ; `budgetIndicatifPourVideo` reçoit alors une origine définie, donc ne relit pas la vidéo). Mesuré : 1 lecture de versions à la construction des outils, comme master (l'ancienne tête 1d2d439 en faisait 2). Aucun changement de source ici.
2. Point 2 : 3 tests ajoutés (16 au total) : pré-vol « usine » (transcription puis Claude) au cas B ; pré-vol Studio inchangé ; comptage des lectures du chemin Studio. Mutation origine brute au pré-vol : rouge ; restauré, vert.
