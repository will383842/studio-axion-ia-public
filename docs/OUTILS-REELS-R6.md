# Lot R6 — Calage des sous-titres, et vidéos « je lis » entièrement réelles (relevé)

> 03/10/2026 · branche `outils/r6` depuis `outils/r0` (`48d6ad6`) · plan : `<dossier-de-plan-prive>/PLAN-OUTILS-REELS-2026-10-03.md` (§2 C5-C6, §3, « R6 ») · mesure : `docs/LOT-INTENSITE-CREDITS-EXECUTION.md` (annexe D3).
> Aucun appel réseau, aucune dépense, aucune clé. Rien n'est effacé. Rien n'est déployé.

## En deux phrases (pour Will)

- Quand le calage des sous-titres sera relié, **vos prises filmées seront sous-titrées au mot près** ; la voix de votre double, elle, garde son propre minutage, qui est déjà plus juste (c'est la mesure du 02/10).
- Dans Réglages > Connexions > Montage, un interrupteur **« Vidéos « je lis » montées pour de vrai »** fait monter vos prises par le studio **dès maintenant**, sans attendre le double. Gratuit. Si le calage n'est pas encore relié, la vidéo le dit : « Sous-titres approximatifs ».

## Ce qui est fait

| Constat | Avant (`outils/r0`) | Maintenant |
|---|---|---|
| C6 | Dès qu'un aligneur réel était relié, la **voix de synthèse** (HeyGen) était recalée, alors que la mesure D3 montre qu'elle est plus juste telle quelle (20,3 ms d'écart moyen contre 39,1 ms après calage). | La voix de synthèse **garde son horodatage**. Elle n'est calée que si le réglage `alignement.voixSynthese` est allumé (coupé par défaut, aucun écran : la mesure dit de le laisser coupé), ou si la voix ne donne pas l'horodatage de ses mots (estimation seulement). |
| C5 | Prises filmées sans aligneur : sous-titres posés sur une estimation (le texte réparti sur la durée de la prise), sans rien dire. | Les prises filmées sont **toujours** calées quand l'aligneur est relié. Sinon, ou si le calage échoue 3 fois, la vidéo sort quand même, avec l'alerte **« Sous-titres approximatifs »** (carte Qualité de la vidéo et rapport de chaque format), et l'indication « Reliez le calage des sous-titres (Réglages > Connexions) ». |
| R0 → moteur | Le choix « Calage » fait dans Réglages > Connexions n'arrivait pas au moteur (il ne lisait que `FOURNISSEUR_ALIGNEMENT`). | Le choix part avec la commande, **figé au lancement** (`entrees.fournisseurAlignement`, comme `fournisseurIllustration`) ; le réglage de la voix aussi (`entrees.calerVoixSynthese`). Les commandes déjà lancées suivent la variable du serveur, comme avant. |
| « je lis » réel | Les vidéos « je lis » suivaient `moteur.avocat` (simulation tant que le double n'est pas prêt, R8) : jamais montées pour de vrai. | Interrupteur **par format** dans la carte Montage (`moteur.<format>.jeLis`). Allumé, et le montage (studio-rendu, `STUDIO_RENDU_URL`) ET le stockage reliés : la vidéo « je lis » part sur le moteur réel (`montage-avocat`). Les vidéos du double restent sur `moteur.<format>`, inchangé. Sinon : simulation, interrupteur grisé avec « Il faut d'abord relier le montage / le stockage des fichiers ». « Montage réel pour » affiche « Type avocat · je lis ». |

### Fichiers

- `src/moteurs/montage-avocat/alignement.ts` : `calerLaVoix`, `optionsCalage`, `alerteSousTitresApproximatifs` (purs).
- `src/moteurs/montage-avocat/index.ts` — **partie calage seulement** (fusion facile avec R7) : l'aligneur suit la commande ; règle de la voix (`calerVoix`) ; prises et voix marquent `approximatif` ; `AudioMaitre.sousTitresApproximatifs` (ajout pur) ; l'alerte rejoint la note, les alertes de chaque format et `noteQualite.alertes`. Rien dans le rendu du double, la composition, les illustrations.
- `src/services/fabrication.ts` : 2 lignes dans `entrees` (calage choisi, voix de synthèse).
- `src/moteurs/index.ts` : `moteurPrisesFilmees`, `deciderJeLis` (ajouts en fin de fichier) : **la seule règle « je lis »**, lue par le lancement ET par la carte Montage.
- `src/services/fabrication-reseaux.ts` : `complementsGenerateur` fige le moteur des prises (une ligne).
- `src/services/reglages.ts` : `decisionJeLis` (lit l'interrupteur et les connexions, puis appelle `deciderJeLis`), `definirJeLisReel` ; la connexion Montage porte `jeLis` et `calageRelie`.
- `src/app/(studio)/reglages/actions.ts` (`definirJeLisReelAction`), `page.tsx` (transmet les 2 champs), `src/components/reglages/Connexions.tsx` (`BlocJeLis`, dans la feuille Montage).
- `deploiement/docker-compose.yml`, `deploiement/env.exemple` : commentaires seulement (valeurs R6, taille d'image).
- `studio-aligneur/aligneur/__main__.py` : le serveur refuse de démarrer sans `STUDIO_RENDU_CLE` ; `deploiement/mettre-a-jour.sh` : profil « calage » seulement pour une vraie adresse ET avec la clé, conteneur arrêté (jamais supprimé) si l'adresse est retirée.
- Tests : `tests/r6-calage-moteur.test.ts` (13), `tests/r6-je-lis-reel.test.ts` (14), `studio-aligneur/tests/test_principal.py` (2) ; `tests/d3-calage.test.ts` et `tests/lot-icc-interfaces.test.ts` : leurs essais du calage **de la voix** allument désormais `calerVoixSynthese` (le fond de ces tests est inchangé).

## Preuves

- **ROUGES prouvés sur `outils/r0` (48d6ad6)**, plan R6 : sources `src/` de `outils/r0` remises dans l'arbre (`git diff 48d6ad6 HEAD -- src | git apply -R`, puis réappliqué : `git diff HEAD -- src` vide), tests R6 lancés → **10 échecs / 13** :
  - « aligneur réel + voix HeyGen → aucune soumission » : `expected [ { …(5) } ] to deeply equal []` (la voix était envoyée au calage) ;
  - « prises filmées sans aligneur → alerte visible » : `expected false to be true` (aucune alerte « Sous-titres approximatifs ») ; idem après 3 pannes du calage ;
  - choix de Connexions non transmis (`expected undefined to be 'studio-aligneur'`), réglage de la voix ignoré ;
  - les 5 tests « je lis » réels (`definirJeLisReel is not a function`, `jeLis` absent, `BlocJeLis` absent).
  Les 3 verts sur l'ancien code : voix sans horodatage calée, prise calée quand l'aligneur est relié (comportement G6b gardé), réglage de la voix sans effet sur les prises. Puis code R6 → **13/13 verts**.
- `npx tsc --noEmit -p .` = 0 (après `npx next typegen`) ; studio-rendu `npx tsc -p tsconfig.json --noEmit` = 0 (non touché).
- `npx eslint` des 13 fichiers touchés = 0.
- `npx vitest run --maxWorkers=2` complet : **148 fichiers, 1 983 tests verts**, 1 ignoré, **1 échec hors R6** : `tests/g4c-tournage.test.ts` « 3 prises rangées… » dépasse le délai de 5 s (5,9 s) — identique avec les sources de `outils/r0` remises (5,9 s, même échec) : lenteur du poste partagé, pas une régression R6. Les 10 autres tests du fichier sont verts.
- Tests Python de l'aligneur (sans rien installer : numpy présent sur le poste, PyTorch inutile pour ces tests) : `python -m unittest discover -s tests -t .` dans `studio-aligneur/` → **18 tests OK**. Service non modifié.
- Démonstration M4 : rendue pour de vrai (`outils/demo-m4/rendre-demo.mts`, réglages par défaut) **avec les sources R6 puis avec celles de `outils/r0`** : empreintes **identiques entre les deux** — 9:16 `59cf135d2d1b`, 4:5 `484cf25eb7ee`, 1:1 `cec2f851029f`, son `1a829a7c2541` (389 images chacune). R6 ne change donc rien à la démonstration ; en outre aucun fichier R6 n'est dans son graphe d'imports (77 fichiers, esbuild). ⚠️ Ces empreintes d'image diffèrent des empreintes de référence (0302e1a08c99 / 4cfe49eac70c / c6b1aa0e3fe5 ; son identique) **dès `outils/r0`** : l'écart vient du poste (rendu du navigateur) ou d'un lot antérieur, pas de R6 — à regarder à l'intégration, sur la machine de référence. Les fichiers de `docs/captures/m4-demo/` ont été remis tels quels (copie gardée avant le rendu ; aucun changement dans le dépôt).
- Aucune dépense : aligneur, voix et rendu imités dans les tests ; la réponse de l'aligneur est la sortie RÉELLE enregistrée au lot D3.
- Aucune valeur de réglage à l'écran : test « interrupteur et aucune valeur de réglage à l'écran » (valeurs marquées « SECRETR6 »).

## Serveur — ce que l'opérateur pose (liste EXACTE)

**Avant** : `free -h` (au moins 3 Go « available » en plus de l'existant) et `df -h /var/lib/docker` (au moins 6 Go libres : image ≈ 2 Go, plus la construction).

Dans `/opt/studio-axion-ia/.env` :

```
STUDIO_ALIGNEUR_URL=http://studio-aligneur:4200
FOURNISSEUR_ALIGNEMENT=studio-aligneur
```

- `STUDIO_RENDU_CLE` : **déjà posée** (même clé partagée, rien à ajouter ; le conteneur la reçoit du compose).
- **Ne PAS poser** de réglage pour la voix de synthèse : `alignement.voixSynthese` reste coupé (mesure D3).
- Vidéos « je lis » réelles : **aucune variable** ; c'est l'interrupteur de la carte Montage (il exige `STUDIO_RENDU_URL` + Montage « studio-rendu » + Stockage « r2 », déjà en place si le montage réel l'est).

Puis `deploiement/mettre-a-jour.sh` (il voit `STUDIO_ALIGNEUR_URL` et active le profil « calage » : construit et démarre `studio-aligneur`).

### Ressources

| Service | Plafond mémoire | Processeurs |
|---|---|---|
| base | 512 Mo | — |
| studio | 1 Go | 2 |
| studio-rendu | 3 Go | 6 (`cpu_shares: 256`) |
| **studio-aligneur** | **2 500 Mo** (`mem_limit: 2500m`, mesuré ≈ 1,6-1,7 Go au plus, ≈ 1 Go au repos modèle chargé) | **2** (`cpus: 2`, `cpu_shares: 256`, `nice 10`) |

Total des plafonds ≈ 7 Go, sous les ≈ 9 Go disponibles (le site axion-ia.com garde la main : priorité basse).
Image `studio-aligneur:local` estimée **≈ 1,8 à 2,1 Go** (non construite ici, Docker absent du poste) : Python 3.11 slim ≈ 0,13 Go, FFmpeg Debian ≈ 0,35 Go, PyTorch 2.8 processeur + dépendances ≈ 0,8-1 Go, numpy et torchaudio ≈ 0,08 Go, modèle wav2vec2 français ≈ 0,36 Go.

## Contrôles après déploiement

1. `cd /opt/studio-axion-ia/source/deploiement && docker compose --env-file /opt/studio-axion-ia/.env --profile calage ps` : `studio-aligneur` « healthy », **un seul** conteneur `studio`.
2. `docker stats --no-stream` : `studio-aligneur` ≈ 1 Go au repos, limite affichée 2.441 GiB.
3. `docker image ls studio-aligneur:local` : taille (attendu ≈ 2 Go) ; `df -h /var/lib/docker` encore confortable.
4. Santé vue du studio : `docker compose --env-file /opt/studio-axion-ia/.env exec studio node -e "fetch('http://studio-aligneur:4200/sante').then(r=>r.json()).then(console.log)"` → `{ ok: true, modele: 'VOXPOPULI_ASR_BASE_10K_FR', … }`.
5. Réglages > Connexions : « Calage des sous-titres » → **Relié** ; carte Montage : l'interrupteur « Vidéos « je lis » montées pour de vrai » apparaît, actif (pas grisé).
6. Essai réel **gratuit** (Will) : interrupteur allumé, une version « je lis » filmée → « Monter ma prise ». Attendu : la vidéo sort, sans l'alerte « Sous-titres approximatifs » ; `docker compose logs --tail 50 studio-aligneur` montre une demande `…-alignement`.
7. Contrôle C6 : une vidéo du double (quand R7/R8 seront là) ne doit produire **aucune** demande dans les journaux de `studio-aligneur`.

Retour arrière : vider `STUDIO_ALIGNEUR_URL` dans `/opt/studio-axion-ia/.env`, puis lancer `deploiement/mettre-a-jour.sh` : le studio repart sans calage (les prises seront dites « approximatives ») et le script **arrête de lui-même** `studio-aligneur` (arrêté, jamais supprimé : rien n'est effacé ; reposer l'adresse et relancer le script le redémarre).

## Points d'intégration

- **R7** (`montage-avocat/index.ts`) : R6 ne touche que l'aligneur (`aligneur(c)`), la phase `a-lire` de la voix (règle de calage), la phase `prises`, le nettoyage (un champ recopié) et l'assemblage des alertes dans `resultat`. Conflits attendus au plus sur ces lignes, sans recouvrement de sens.
- **R8** : quand `moteur.avocat = montage-avocat`, la ligne « Type avocat · je lis » s'efface d'elle-même (« Type avocat » couvre tout) ; l'interrupteur reste sans effet sur le double. `deciderJeLis` ne remplace jamais un moteur réel déjà choisi.
- **R0** : aucun changement au catalogue (`studio-aligneur`, `STUDIO_ALIGNEUR_URL` inchangés).
- **Autres formats** : un format dont le moteur sait monter des prises s'ajoute dans `MOTEUR_PRISES_FILMEES` (`src/moteurs/index.ts`) ; l'écran le montre seul.

## Relecture (03/10 soir)

Exactitude et sécurité : acceptées (voix réutilisée sans horodatage calée, panne non réessayable, adresses du son valables 15 min au lieu d'une heure, choix figés au lancement, clé obligatoire de l'aligneur, script de mise à jour). Simplicité — corrections faites :

1. **Règle « je lis » à un seul endroit** : `deciderJeLis` (moteur à figer, « effectif », ce qui manque) remplace `manqueJeLis` + `choisirMoteurPrisesAuLancement` + le calcul refait dans `contexteJeLis` ; le lancement, l'interrupteur et « Montage réel pour » la lisent tous (test « une seule règle », 6 cas).
2. « Montage réel pour » (`formatsMontesPourDeVrai`) lit la même décision, au lieu de refaire le choix du moteur à côté.
3. `actif` → `allume` (c'est l'état de l'interrupteur, pas « il agira ») ; commentaires des champs.
4. À l'écran et au journal : plus de « serveur » ni de « simulation » (« Montées par le studio. Gratuit. », « … · je lis : coupé ») ; le journal donne le nom du type de vidéo, pas son identifiant.
5. `fabrication.ts` : les deux réglages du calage lus une fois chacun (plus de double lecture).
6. Durée des adresses du son données à l'aligneur nommée (`DUREE_ADRESSE_CALAGE_SEC`, 15 min, commentée) au lieu de `3600` en double.
7. `calerLaVoix` prend `motsEstimes` directement (plus de double négation `horodatageVoix: !motsEstimes`).
8. Cause des sous-titres approximatifs des prises : une ligne lisible (« non relié » l'emporte, c'est la cause que Will peut corriger) ; aligneur du moteur nommé `aligneurDe(c)`, raccourci local `aligneur()` commenté.

Contrôles après corrections : `npx tsc --noEmit -p .` = 0 ; eslint des 14 fichiers touchés = 0 ; `npx vitest run --maxWorkers=2` complet : **147 fichiers verts, 1 998 tests verts**, 1 ignoré, 0 échec ; Python `studio-aligneur` : **20 tests OK**.

### 2e relecture simplicité (03/10 soir)

1. **Pourquoi des sous-titres sont approximatifs : une seule règle**, `causeApproximation` (`montage-avocat/alignement.ts`), au lieu de 5 copies sous 3 formes. La voix passe par `versAnalyse` (décision prise UNE fois, gardée dans l'état et dans le son brut repris `voixBrute.approximatif`) ; les prises par `causePrise`. Une copie avait divergé : après un calage réussi, la voix restait « estimée » et, si la maquette tombait en panne pendant l'analyse du son, la reprise affichait à tort « Reliez le calage ». Test « maquette reprise APRÈS le calage » : rouge par mutation (ancienne règle remise : `expected true to be undefined` ; cause non gardée : `expected undefined to be 'echec'`), vert ensuite.
2. Retour arrière ci-dessus corrigé : `mettre-a-jour.sh` arrête bien `studio-aligneur` quand l'adresse est retirée.
3. `deciderJeLis` sans expression redondante ; `calageRelie` reprend l'état du calage déjà calculé dans la liste des connexions ; « sur le serveur » retiré du résumé pour Will.

Contrôles : `npx tsc --noEmit -p .` = 0 ; eslint des fichiers touchés = 0 ; `npx vitest run --maxWorkers=2` complet : 142 fichiers verts, 1 994 tests verts, 1 ignoré, **5 dépassements du délai de 5 s** (5,1 à 6,8 s : g4c-tournage, e2e1-moteur-02, e2e2-console-proxy, e2e2-gen-argent, e2e2-gen-fabriquer-version, aucun lié à R6) ; ces 5 fichiers relancés seuls : **30/30 verts**.

### Chef correcteur après la relecture EXACTITUDE (REFUSÉ, tête 3ab20bf)

Rapport : `docs/controles/RELECTURE-R6-EXACTITUDE-3ab20bf.md` (branche `relectures/r6-exactitude-3ab20bf`). Les 2 vrais défauts sont corrigés ; le petit défaut n° 3 (son brut ancien sans `motsEstimes`, sans effet pratique) est laissé tel quel, comme le propose le rapport.

1. **Aligneur retiré pendant le calage : plus jamais présenté comme un calage.** Si l'aligneur réel est retiré (adresse retirée) ou n'est plus inscrit pendant les phases `a-aligner` / `alignement`, la simulation prend le relais et renvoie l'estimation telle quelle. La règle unique `causeApproximation` (`montage-avocat/alignement.ts`) ne compte désormais un calage que s'il vient d'un aligneur réel : sinon la cause est « non relié » (Will peut la corriger). Correction choisie : la plus simple, dans la règle elle-même (aucun nouveau chemin dans le moteur). Effet de bord voulu : un calage raté puis un aligneur retiré donne « non relié » au lieu de « n'a pas abouti » (c'est ce que Will peut corriger). Test : `tests/r6-calage-correcteur.test.ts` n° 1 (bascule aligneur réel → simulation pendant `alignement`, attendu `non-relie`).
2. **La cause suit l'audio maître réutilisé.** Champ optionnel `sousTitresApproximatifs` (ajout pur) sur la piste `audio-maitre` (`Piste`, donc aussi `PisteProduite`) et dans `CommandeFabrication.audioMaitre` : le moteur l'écrit avec la piste (maquette et fabrication), `audioMaitreReutilisable` (`services/fabrication.ts`) le transmet, la branche « réutilisation » de `a-lire` le reprend tel quel (`...c.audioMaitre`, jamais recalculé). Pistes anciennes sans le champ : comme avant. La voix n'est pas relue ni repayée (le test le vérifie). Test : `tests/r6-calage-correcteur.test.ts` n° 2 (maquette approximative → fabrication réutilisée → alerte « Sous-titres approximatifs … Réglages > Connexions » présente).

Preuve du rouge avant correction (`npx vitest run tests/r6-calage-correcteur.test.ts` sur 3ab20bf + tests seuls) :

```
× le « calage » fait par la simulation n'est pas un vrai calage : sous-titres approximatifs, cause « non relié »
× la cause suit l'audio maître : la vidéo fabriquée garde l'alerte, et la voix n'est pas repayée
AssertionError: expected undefined to be 'non-relie' // Object.is equality
TypeError: .toMatch() expects to receive a string, but got undefined
Tests  2 failed (2)
```

Contrôles après corrections : `npx tsc --noEmit` = 0 ; `pnpm lint` = 0 ; `npx vitest run` complet : **148 fichiers verts, 1 ignoré — 2 000 tests verts, 2 ignorés, 0 échec**. Aucun appel payant (voix, aligneur et rendu injectés ou simulés), aucun nom technique ajouté à l'écran.

## Restes

- Captures 390 px et bureau de la carte Montage : à l'intégration (ni `next dev` ni `next build` ici) ; mise en page vérifiée par rendu (interrupteur ≥ 44 px du composant commun, une ligne par format).
- Image `studio-aligneur` jamais construite (ni ici, ni au lot D3) : sa taille réelle se lit au contrôle n° 3.
- Will : rien d'obligatoire. Pour essayer : allumer l'interrupteur et « Monter ma prise » sur une version filmée.
