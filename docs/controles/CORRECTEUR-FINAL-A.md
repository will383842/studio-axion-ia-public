# CORRECTEUR FINAL A — parcours et argent (04/10/2026)

Branche `outils/final-a`, partie de master **b544423** (en ligne).
Sources :
- `docs/controles/VERIF-E2E-1.md` : bloquants 2 à 7, et les gênes liées au parcours et à l'argent ;
- `docs/controles/TEST-UI-REEL.md` : U1 (bloquant) et U2.

Les tests `tests/e2e-verif1-*` ont été repris de `controles/verif-e2e-1`.

Je n'ai pas touché à l'import de fichiers, au déploiement (`deploiement/`, `Dockerfile`), aux textes, à l'accessibilité ni au mobile : c'est le travail du correcteur B.

## La correction de fond

On décide qu'une vidéo est un **essai** d'après le moteur figé dans sa version, et non plus d'après la carte « Montage » :

```
commandeEnEssai(commande) = idMoteurDeCommande(commande) === "simulation"   // src/moteurs/index.ts
```

Ce test sert partout : refus, prix, pastilles, notification, textes Claude, envoi à Buffer.

## Ce qui est corrigé

| N° | Défaut | Correction | Test (rouge avant, vert après) |
|---|---|---|---|
| **2** | Le refus de « Fabriquer » disait « Reliez ces outils », alors qu'ils sont déjà reliés. | Le message dit le vrai geste : « Allumez “Votre avatar parle dans le studio” puis “Montage réel des vidéos …” (Réglages › Connexions). En attendant : “Ma vidéo HeyGen” ». Si le double n'est pas choisi, il le dit d'abord. Le refus s'affiche **dès l'Aperçu** et en Express (bouton grisé, phrase et lien). La feuille du générateur a un lien vers Réglages › Connexions. La phrase « Rien n'a été payé » n'apparaît plus en double. | a1 « CORRIGÉ — le refus nomme le vrai geste » ; d « CORRIGÉ — … “Montage réel” » ; bc-script-video « CORRIGÉ — production… » et « CORRECTEUR FINAL A — … voix HeyGen » ; d (D4) `apercu.refus` |
| **3** | Une vidéo de démonstration était livrée comme la vraie vidéo de Will. | Notification « Essai · vidéo de démonstration prête » (« c'est un essai, rien n'a été payé »). Bandeau « Vidéo d'essai » sur la fiche. `fabricationSimulee` lit le moteur de la version. « Monter ma prise » est **refusé** avec « Je lis » éteint : la prise de Will n'est jamais remplacée par une démonstration, et le message dit quel interrupteur allumer. | a1 « CORRIGÉ — la fiche… » ; a2 « CORRIGÉ — la notification… » ; ef-video-heygen « CORRIGÉ — “Je lis” ÉTEINT… » |
| **4** | Un prix fictif était présenté comme une vraie dépense. | `partPayee` tient compte du moteur décidé au lancement. Interrupteurs éteints, le double et les illustrations ne sont pas payés, et la pastille « Essai » s'affiche. Une voix reliée reste annoncée comme payée. Un essai ne s'ajoute plus au total du jour ni au budget. La feuille ne promet plus « votre double et votre voix ». « Monter ma prise » est marqué Essai d'après le moteur « Je lis ». | a1 « CORRIGÉ — … la feuille annonce l'essai » ; bc-serie « CORRIGÉ — Fabriquer les N… » et « CORRECTEUR FINAL A — … ni au total du jour » |
| **5** | Une vidéo d'essai partait chez Buffer comme une vraie. | Avec le vrai Buffer, l'envoi est refusé avant tout appel quand la vidéo est un **exemple**, une version d'essai, ou un fichier `/demo/`. `urlVideoPourBuffer` ne signe jamais un fichier de démonstration. | a2 « CORRIGÉ — une vidéo d'essai… » et « CORRIGÉ — une vidéo d'exemple… » |
| **6** | En Express, un vrai paiement était confirmé sur un bouton marqué « Essai ». | `decisionLancement` reçoit `montageReel` et `double` : la confirmation est toujours demandée, avec la vraie raison. La phrase du serveur s'affiche, au lieu de « Plus cher que d'habitude ». La pastille « Essai » n'apparaît que si rien de réel n'est payé (Express et Aperçu). | d « CORRIGÉ — Express… » |
| **7** | En parcours C, une écriture tombée en panne ne pouvait plus aboutir, et l'argent était perdu. | À « Reprendre l'écriture », le plafond du sujet est relevé **une seule fois** du pire cas des appels restés sans réponse (`releverPlafondApresPannes`, champ `appelsReleves`). La reprise a donc la même marge qu'au lancement et va au bout. Les appels sans réponse restent comptés dans le mois : rien n'est effacé. | bc-serie « CORRIGÉ — Reprendre l'écriture… » et « CORRECTEUR FINAL A — la reprise va au bout… » |
| **U1** | Le personnage d'exemple p-will comptait comme « Moi » : Will ne pouvait pas se créer. | `estMoiReel` et `choisirMoi` (`src/domaine/moi.ts`), `trouverMoi` (`src/services/moi.ts`). Un personnage d'exemple n'empêche jamais de créer « Moi ». Le vrai « Moi » passe toujours en premier, et celui d'exemple ne sert que si les exemples sont affichés. Cela couvre : `moiExiste`, `creerPersonnage`, les looks, la distribution par défaut, la voix par défaut, le prix du second angle, l'accueil et la nouvelle vidéo. Le vrai « Moi » est créé `principal`. | `tests/correcteur-final-a.test.ts` (U1, 4 tests) |
| **U2** | La durée d'un texte collé était sous-évaluée : 55 mots donnaient 12 s. | Débit réel de la voix HeyGen de Will **mesuré** : 10 mots en 3,8 s de parole, voir la réponse réelle du 02/10 dans `tests/a1-voix-heygen`. D'où `DEBIT_VOIX_HEYGEN_MESURE = 2,6` mots/s, multiplié par la vitesse de la voix (`debitLecture`). La carte Script, la commande et donc le prix suivent la voix qui lira : 55 mots donnent maintenant 21 s. Une voix d'essai garde la recette du format (4,4). | `tests/correcteur-final-a.test.ts` (U2, 2 tests) |

**Gênes corrigées en plus (argent et parcours)**
- **Claude n'écrit et ne fait payer aucun texte des réseaux pour une vidéo d'essai.** La ligne « Textes des réseaux » disparaît de l'estimation, et l'écriture automatique reste disponible pour la vraie vidéo. Résultat : avec la voix d'essai, le parcours B ne bute plus sur cette ligne et part en essai, avec les pastilles, comme le parcours A.
- **Plus de prix d'avatar annoncé pour une vidéo d'essai.** C'est le cas « avatar allumé, Montage réel éteint » (`briques/index.ts`). Test : d « CORRIGÉ — avatar allumé sans montage réel ».
- **Suivi de série** : une écriture arrêtée s'affiche « Arrêtée : à reprendre », et non plus « À compléter ». Test : bc-serie « CORRIGÉ — suivi de série ».
- **Une idée déjà écrite, renvoyée par un écran périmé, n'est ni réécrite ni repayée.** Test : bc-serie « CORRIGÉ — une idée de “Idées” déjà écrite ».

## Preuve « rouge avant »

J'ai copié les tests de cette branche dans une copie de **b544423** (worktree), sans le code corrigé, puis lancé :

```
npx vitest run tests/correcteur-final-a tests/e2e-verif1- -t "CORRIGÉ|U1|U2|CORRECTEUR FINAL A"
```

Résultat : **19 échecs sur 19**. Le fichier `correcteur-final-a` ne se charge même pas, car `@/domaine/moi` et `@/services/moi` n'existent pas encore. Les mêmes tests sont verts sur `outils/final-a`.

## Tests existants adaptés (règle nouvelle, et non un défaut)

- **Fixtures Buffer** (r1, r1b, r2) : la « vraie vidéo » utilisée dans ces tests est une vidéo d'exemple. Le nouvel outil `tests/helpers/videos-reelles.ts` lui donne ce que laisse une vraie fabrication : vrai moteur dans la version, fichier sur le stockage, `estDemo: false` pour les envois.
- **r2 et r7e** : la ligne Claude et le prix de l'avatar se vérifient au vrai moteur (`moteur.avocat = montage-avocat`).
- **e2e2-argent n° 7** : « budget insuffisant » est vérifié hors essai, car un essai ne paie rien.
- **e2e-verif1** : les « constats » qui décrivaient un défaut maintenant corrigé ont été réécrits pour vérifier le comportement corrigé, ou retirés (avec un commentaire).
- **d (D2)** : le texte de référence de « 45 s » est ramené à 45 s au débit réel de la voix HeyGen.

## Non corrigé (hors périmètre ou à trancher)

- **Bloquant 1 (.pdf dans l'image autonome)** et les gênes d'import, de textes techniques et de déploiement : correcteur B.
- **Parcours C : une idée arrêtée à 0 € consomme quand même un numéro d'épisode.** La série ne réutilise jamais un numéro (`dernierEpisode`). Corriger veut dire n'attribuer l'épisode qu'au départ de l'écriture : la règle de numérotation change, c'est à trancher avec Will. Le test `it.fails` reste rouge.
- **Prix « vidéo de 45 s »** : il manque les illustrations fal.ai, et la voix HeyGen est annoncée 0 €. Les deux `it.fails` restent : il faut choisir un nombre d'illustrations « type » et changer l'arrondi de la voix.
- **fal.ai sans idempotence** ; **rendu HeyGen « processing » sans délai maximal** ; **finition perdue au redémarrage** : ce sont des chantiers de reprise. Leurs `it.fails` sont inchangés.
- **« Plafond atteint » reprenable** dans le cas général : seul le cas causé par les pannes est réglé (n° 7).
- **Le débit de 2,6 mots/s** vient d'une seule mesure (une phrase). Il faudra le remesurer sur une vraie vidéo de Will et ajuster la constante. Si Will monte la vitesse de sa voix dans sa fiche, l'estimation suit.
- **U3, U4** (affichage de Réglages et états vides) : textes et écrans, donc correcteur B.

## Contrôles

| Contrôle | Résultat |
|---|---|
| `tsc --noEmit`, racine | OK |
| `tsc --noEmit`, studio-rendu | OK |
| `eslint src tests` | OK |
| vitest complet | **222 fichiers OK** (1 ignoré), **2755 tests verts**, 16 échecs attendus (`it.fails` hors périmètre), 0 rouge |
| `npx next build --webpack` | OK |

Aucun appel réseau réel, aucune clé, aucune donnée effacée.
