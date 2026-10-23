# INVENTAIRE DE NETTOYAGE — fin du chantier « Scripts exceptionnels »

> Date : 2026-10-18. **Lecture seule** : rien n'a été supprimé, fermé, fusionné ni modifié (hors ce fichier). Aucun appel payant.
> Base : `origin/master` @ e8bf581e · 573 branches distantes · 505 PR (476 fusionnées, 13 fermées sans fusion, 15 ouvertes dont 2 brouillons).
> Risque : **aucun** / **faible** / **à demander à Will**. Les familles protégées (cas-concret/*, facecam/*, usine/*, image-video, harmonisation/*), l'avocat et tout ce qui touche à des données de personnes ne sont **jamais** proposés à la suppression (ligne « NE PAS TOUCHER »).

## 1. Branches distantes dont la PR est fusionnée ou fermée

Limite : le dépôt fusionne en squash, donc `git branch --merged` ne reconnaît pas ces branches ; le classement vient de l'état des PR (API REST).

### 1a. PR fusionnée — branche distante restante (446)

| Élément | Pourquoi | Risque |
|---|---|---|
| `apprentissage/*` — 2 branche(s) : `apprentissage/gagnants-et-corrections`, `apprentissage/suivi-relecture` | PR fusionnée dans master ; la branche distante n'apporte plus rien (le contenu est dans master) | faible |
| `banc/*` — 2 branche(s) : `banc/aveugle-equipe-courte`, `banc/par-sujets` | PR fusionnée dans master ; la branche distante n'apporte plus rien (le contenu est dans master) | faible |
| `bases/*` — 2 branche(s) : `bases/resynchro-manifeste`, `bases/usine-lues-par-le-studio` | PR fusionnée dans master ; la branche distante n'apporte plus rien (le contenu est dans master) | faible |
| `cas-concret/*` — 128 branche(s) | NE PAS TOUCHER : famille protégée ou nom évoquant des données de personnes (avatar, reel, avocat…), même si la PR est fusionnée | à demander à Will |
| `commun/*` — 1 branche(s) : `commun/sans-textes-reseaux` | PR fusionnée dans master ; la branche distante n'apporte plus rien (le contenu est dans master) | faible |
| `console/*` — 11 branche(s) : `console/annuler-et-nettoyer`, `console/bandeau-generateur`, `console/classement-videos`, `console/corbeille-30-jours` … (+7) | PR fusionnée dans master ; la branche distante n'apporte plus rien (le contenu est dans master) | faible |
| `console/*` — 1 branche(s) | NE PAS TOUCHER : famille protégée ou nom évoquant des données de personnes (avatar, reel, avocat…), même si la PR est fusionnée | à demander à Will |
| `correctif/*` — 4 branche(s) : `correctif/exclure-banc-aveugle-du-build`, `correctif/interface-claire-import-react`, `correctif/lecteur-pas-de-double-sous-titres`, `correctif/police-v4-ne-bloque-plus-le-rendu` | PR fusionnée dans master ; la branche distante n'apporte plus rien (le contenu est dans master) | faible |
| `credits/*` — 1 branche(s) : `credits/alertes-claires` | PR fusionnée dans master ; la branche distante n'apporte plus rien (le contenu est dans master) | faible |
| `deploiement/*` — 1 branche(s) : `deploiement/protection-fabrications` | PR fusionnée dans master ; la branche distante n'apporte plus rien (le contenu est dans master) | faible |
| `dettes-argent-avant-lot3/*` — 1 branche(s) : `dettes-argent-avant-lot3` | PR fusionnée dans master ; la branche distante n'apporte plus rien (le contenu est dans master) | faible |
| `docs/*` — 1 branche(s) : `docs/regles-routines` | PR fusionnée dans master ; la branche distante n'apporte plus rien (le contenu est dans master) | faible |
| `ecrire/*` — 3 branche(s) : `ecrire/comite-editorial`, `ecrire/comite-sur-idees`, `ecrire/idees-de-l-usine` | PR fusionnée dans master ; la branche distante n'apporte plus rien (le contenu est dans master) | faible |
| `ecriture/*` — 10 branche(s) : `ecriture/bases-dans-equipe`, `ecriture/cache-repare`, `ecriture/chaine-courte-production`, `ecriture/chaine-equipe` … (+6) | PR fusionnée dans master ; la branche distante n'apporte plus rien (le contenu est dans master) | faible |
| `ecriture/*` — 2 branche(s) | NE PAS TOUCHER : famille protégée ou nom évoquant des données de personnes (avatar, reel, avocat…), même si la PR est fusionnée | à demander à Will |
| `facecam/*` — 1 branche(s) | NE PAS TOUCHER : famille protégée ou nom évoquant des données de personnes (avatar, reel, avocat…), même si la PR est fusionnée | à demander à Will |
| `facecam-animee/*` — 6 branche(s) | NE PAS TOUCHER : famille protégée ou nom évoquant des données de personnes (avatar, reel, avocat…), même si la PR est fusionnée | à demander à Will |
| `feat/*` — 3 branche(s) : `feat/ffmpeg-recent`, `feat/ffmpeg8-qualite`, `feat/monteur-connait-la-miniature` | PR fusionnée dans master ; la branche distante n'apporte plus rien (le contenu est dans master) | faible |
| `feat/*` — 2 branche(s) | NE PAS TOUCHER : famille protégée ou nom évoquant des données de personnes (avatar, reel, avocat…), même si la PR est fusionnée | à demander à Will |
| `fix/*` — 22 branche(s) : `fix/cartes-finitions`, `fix/controle-sdr-start-time`, `fix/coupes-reprises-mode-texte`, `fix/export-10bits-ffmpeg51` … (+18) | PR fusionnée dans master ; la branche distante n'apporte plus rien (le contenu est dans master) | faible |
| `fix/*` — 3 branche(s) | NE PAS TOUCHER : famille protégée ou nom évoquant des données de personnes (avatar, reel, avocat…), même si la PR est fusionnée | à demander à Will |
| `image-video/*` — 70 branche(s) | NE PAS TOUCHER : famille protégée ou nom évoquant des données de personnes (avatar, reel, avocat…), même si la PR est fusionnée | à demander à Will |
| `integration/*` — 1 branche(s) : `integration/15-23-24` | PR fusionnée dans master ; la branche distante n'apporte plus rien (le contenu est dans master) | faible |
| `interface-claire/*` — 11 branche(s) : `interface-claire/l1-planche`, `interface-claire/lot-b`, `interface-claire/lot-c-v3-integration`, `interface-claire/lot-i` … (+7) | PR fusionnée dans master ; la branche distante n'apporte plus rien (le contenu est dans master) | faible |
| `navigation/*` — 4 branche(s) : `navigation/fiche-image-video`, `navigation/registre-formats`, `navigation/un-seul-chemin`, `navigation/vocabulaire-etats` | PR fusionnée dans master ; la branche distante n'apporte plus rien (le contenu est dans master) | faible |
| `qualite/*` — 4 branche(s) : `qualite/anti-repetition`, `qualite/calibrage-socle`, `qualite/regles-will-partout`, `qualite/socle-commun` | PR fusionnée dans master ; la branche distante n'apporte plus rien (le contenu est dans master) | faible |
| `reglages/*` — 3 branche(s) : `reglages/choix-chaine-ecriture`, `reglages/libelles-economique-premium`, `reglages/plafond-sujet` | PR fusionnée dans master ; la branche distante n'apporte plus rien (le contenu est dans master) | faible |
| `rendu/*` — 1 branche(s) : `rendu/delai-de-garde` | PR fusionnée dans master ; la branche distante n'apporte plus rien (le contenu est dans master) | faible |
| `reseaux/*` — 4 branche(s) : `reseaux/t1-registre-sorties`, `reseaux/t2-table-tableau`, `reseaux/t4-choix-fichier-par-reseau`, `reseaux/t5-formats-voulus` | PR fusionnée dans master ; la branche distante n'apporte plus rien (le contenu est dans master) | faible |
| `reseaux/*` — 1 branche(s) | NE PAS TOUCHER : famille protégée ou nom évoquant des données de personnes (avatar, reel, avocat…), même si la PR est fusionnée | à demander à Will |
| `script/*` — 5 branche(s) : `script/relire-assistant`, `script/relire-cas-concret`, `script/relire-generateur`, `script/relire-script-commun` … (+1) | PR fusionnée dans master ; la branche distante n'apporte plus rien (le contenu est dans master) | faible |
| `scripts/*` — 5 branche(s) : `scripts/avertissement-nouveau-sujet`, `scripts/import-fichier-tableau-fca`, `scripts/lot-a-recette-positionnement`, `scripts/script-perso-identique` … (+1) | PR fusionnée dans master ; la branche distante n'apporte plus rien (le contenu est dans master) | faible |
| `site/*` — 2 branche(s) : `site/lots-studio`, `site/plan-lots-studio` | PR fusionnée dans master ; la branche distante n'apporte plus rien (le contenu est dans master) | faible |
| `studio/*` — 19 branche(s) : `studio/boutons-et-correctifs`, `studio/cas-concret-stock-statut`, `studio/finitions-page-vivante-police`, `studio/generateurs-grises` … (+15) | PR fusionnée dans master ; la branche distante n'apporte plus rien (le contenu est dans master) | faible |
| `suite/*` — 1 branche(s) : `suite/image-video-ton` | PR fusionnée dans master ; la branche distante n'apporte plus rien (le contenu est dans master) | faible |
| `tableau/*` — 75 branche(s) : `tableau/accord-generateur-decoupage`, `tableau/allumer`, `tableau/ancres-bornees`, `tableau/banc-bout-en-bout` … (+71) | PR fusionnée dans master ; la branche distante n'apporte plus rien (le contenu est dans master) | faible |
| `tableau/*` — 1 branche(s) | NE PAS TOUCHER : famille protégée ou nom évoquant des données de personnes (avatar, reel, avocat…), même si la PR est fusionnée | à demander à Will |
| `usine/*` — 17 branche(s) | NE PAS TOUCHER : famille protégée ou nom évoquant des données de personnes (avatar, reel, avocat…), même si la PR est fusionnée | à demander à Will |
| `verif/*` — 5 branche(s) : `verif/v1-chat-monteur`, `verif/v3-interface`, `verif/v4-argent`, `verif/v5-serveur` … (+1) | PR fusionnée dans master ; la branche distante n'apporte plus rien (le contenu est dans master) | faible |
| `verif/*` — 4 branche(s) | NE PAS TOUCHER : famille protégée ou nom évoquant des données de personnes (avatar, reel, avocat…), même si la PR est fusionnée | à demander à Will |
| `videos/*` — 1 branche(s) : `videos/suppression-definitive` | PR fusionnée dans master ; la branche distante n'apporte plus rien (le contenu est dans master) | faible |
| `vignettes/*` — 3 branche(s) : `vignettes/ecarter-2-photos`, `vignettes/lot1`, `vignettes/maquettes` | PR fusionnée dans master ; la branche distante n'apporte plus rien (le contenu est dans master) | faible |
| `voix/*` — 1 branche(s) : `voix/reference-et-fin-propre` | PR fusionnée dans master ; la branche distante n'apporte plus rien (le contenu est dans master) | faible |
| `voix/*` — 1 branche(s) | NE PAS TOUCHER : famille protégée ou nom évoquant des données de personnes (avatar, reel, avocat…), même si la PR est fusionnée | à demander à Will |

Liste complète : voir annexe A.

### 1b. PR fermée sans fusion (10 branches encore présentes)

| Élément | Pourquoi | Risque |
|---|---|---|
| `cas-concret/l4-entrees-sorties` (#285) | NE PAS TOUCHER : famille protégée, travail possiblement repris | à demander à Will |
| `cas-concret/maquettes-mises-en-page` (#308) | NE PAS TOUCHER : famille protégée, travail possiblement repris | à demander à Will |
| `cas-concret/portage-p2` (#407) | NE PAS TOUCHER : famille protégée, travail possiblement repris | à demander à Will |
| `cas-concret/portage-p3` (#409) | NE PAS TOUCHER : famille protégée, travail possiblement repris | à demander à Will |
| `cas-concret/portage-p4` (#444) | NE PAS TOUCHER : famille protégée, travail possiblement repris | à demander à Will |
| `feat/lot-p0-v6` (#24) | PR fermée sans fusion : le travail n'est PAS dans master, peut-être abandonné ou remplacé | à demander à Will |
| `image-video/variete-assemblage` (#313) | NE PAS TOUCHER : famille protégée, travail possiblement repris | à demander à Will |
| `interface-claire/lot-c-v2-integration` (#284) | PR fermée sans fusion : le travail n'est PAS dans master, peut-être abandonné ou remplacé | à demander à Will |
| `tableau/critique-289` (#291) | PR fermée sans fusion : le travail n'est PAS dans master, peut-être abandonné ou remplacé | à demander à Will |
| `tableau/timbre-voix` (#199) | PR fermée sans fusion : le travail n'est PAS dans master, peut-être abandonné ou remplacé | à demander à Will |

### 1c. Branches sans aucune PR et non intégrées à master (101)

Aucune PR : impossible de savoir si le travail a été repris ailleurs (squash, cherry-pick). **Ne rien supprimer sans validation.**

| Élément | Pourquoi | Risque |
|---|---|---|
| `X/*` — 1 : `X` | Sans PR, non ancêtre de master ; anciens lots/relectures/paquets probablement intégrés par une autre voie, à vérifier branche par branche | à demander à Will |
| `cas-concret/*` — 2 | NE PAS TOUCHER : famille protégée ou données de personnes | à demander à Will |
| `controles/*` — 8 : `controles/audit-a-bout-en-bout`, `controles/audit-d-production`, `controles/finale-efdebe7`, `controles/integration-93864fc`, `controles/paquet1-a59a726` … (+3) | Sans PR, non ancêtre de master ; anciens lots/relectures/paquets probablement intégrés par une autre voie, à vérifier branche par branche | à demander à Will |
| `controles/*` — 2 | NE PAS TOUCHER : famille protégée ou données de personnes | à demander à Will |
| `ecriture/*` — 1 : `ecriture/integration-chaine-courte` | Sans PR, non ancêtre de master ; anciens lots/relectures/paquets probablement intégrés par une autre voie, à vérifier branche par branche | à demander à Will |
| `essai-higgsfield-telephone/*` — 1 : `essai-higgsfield-telephone` | Sans PR, non ancêtre de master ; anciens lots/relectures/paquets probablement intégrés par une autre voie, à vérifier branche par branche | à demander à Will |
| `feat/*` — 17 | NE PAS TOUCHER : famille protégée ou données de personnes | à demander à Will |
| `fixture/*` — 1 | NE PAS TOUCHER : famille protégée ou données de personnes | à demander à Will |
| `generateur/*` — 2 : `generateur/maquettes`, `generateur/prepare-moteur` | Sans PR, non ancêtre de master ; anciens lots/relectures/paquets probablement intégrés par une autre voie, à vérifier branche par branche | à demander à Will |
| `harmonisation/*` — 1 | NE PAS TOUCHER : famille protégée ou données de personnes | à demander à Will |
| `image-video/*` — 1 | NE PAS TOUCHER : famille protégée ou données de personnes | à demander à Will |
| `interface-claire/*` — 2 : `interface-claire/lot-c`, `interface-claire/v4-branchement-session2` | Sans PR, non ancêtre de master ; anciens lots/relectures/paquets probablement intégrés par une autre voie, à vérifier branche par branche | à demander à Will |
| `outils/*` — 28 : `outils/d1`, `outils/ecran-propre`, `outils/final`, `outils/final-a`, `outils/final-b` … (+23) | Sans PR, non ancêtre de master ; anciens lots/relectures/paquets probablement intégrés par une autre voie, à vérifier branche par branche | à demander à Will |
| `outils/*` — 5 | NE PAS TOUCHER : famille protégée ou données de personnes | à demander à Will |
| `relectures/*` — 15 : `relectures/finale`, `relectures/finale2`, `relectures/paquet4-bis`, `relectures/paquet4-exactitude`, `relectures/paquet4-securite` … (+10) | Sans PR, non ancêtre de master ; anciens lots/relectures/paquets probablement intégrés par une autre voie, à vérifier branche par branche | à demander à Will |
| `scripts/*` — 2 : `scripts/lot-d-reseaux`, `scripts/lot-e-voyant-rouge` | Sans PR, non ancêtre de master ; anciens lots/relectures/paquets probablement intégrés par une autre voie, à vérifier branche par branche | à demander à Will |
| `site/*` — 1 : `site/plan-videos` | Sans PR, non ancêtre de master ; anciens lots/relectures/paquets probablement intégrés par une autre voie, à vérifier branche par branche | à demander à Will |
| `source-axion/*` — 1 : `source-axion` | Sans PR, non ancêtre de master ; anciens lots/relectures/paquets probablement intégrés par une autre voie, à vérifier branche par branche | à demander à Will |
| `tableau/*` — 8 : `tableau/apercus-images`, `tableau/apercus-images-v2`, `tableau/apercus-images-v3`, `tableau/maquette-gabarit-clair`, `tableau/maquette-style-reference` … (+3) | Sans PR, non ancêtre de master ; anciens lots/relectures/paquets probablement intégrés par une autre voie, à vérifier branche par branche | à demander à Will |
| `vignettes/*` — 2 : `vignettes/lot1-plan`, `vignettes/photos-will` | Sans PR, non ancêtre de master ; anciens lots/relectures/paquets probablement intégrés par une autre voie, à vérifier branche par branche | à demander à Will |

## 2. PR ouvertes et brouillons

| PR | Branche | État | Classement | Pourquoi | Risque |
|---|---|---|---|---|---|
| #505 | `fix/chaine-v4-nom-fiche` | ouverte | hors chantier | correctif TypeScript fiche (coulisse) | à demander à Will |
| #503 | `scripts/lot-c1-memoire-commune` | brouillon | chantier scripts | lot C1, modules purs non branchés | à demander à Will |
| #502 | `scripts/lot-b1-tableau` | brouillon | chantier scripts | lot B1 tableau sans tutoriel | à demander à Will |
| #501 | `facecam/suite-498` | ouverte | hors chantier — NE PAS TOUCHER | session facecam active | à demander à Will |
| #496 | `usine/n-09-ci-minimale` | ouverte | hors chantier — NE PAS TOUCHER | session usine active | à demander à Will |
| #493 | `fix/iv-visuel-controles-et-alerte` | ouverte | hors chantier — NE PAS TOUCHER | image → vidéo | à demander à Will |
| #449 | `cas-concret/portage-p5` | ouverte | hors chantier — NE PAS TOUCHER | session cas-concret active | à demander à Will |
| #395 | `cas-concret/portage-plan` | ouverte | hors chantier — NE PAS TOUCHER | plan cas-concret | à demander à Will |
| #363 | `controle/posts-buffer` | ouverte | hors chantier | contrôle Buffer lecture seule, ancienne (n° 363) | à demander à Will |
| #318 | `ecriture/audit-socle-qualite` | ouverte | chantier scripts (amont) | audit du système d'écriture, doc seule ; à relire avant de fermer | à demander à Will |
| #317 | `ecriture/recherche-bonnes-pratiques-2026` | ouverte | chantier scripts (amont) | recherche bonnes pratiques, doc seule | à demander à Will |
| #316 | `claude/exemple-illustratif-page-de-plus` | ouverte | hors chantier | tableau/banc, ancienne | à demander à Will |
| #280 | `tableau/maquettes-v2` | ouverte | hors chantier | maquettes seules à valider par Will | à demander à Will |
| #260 | `tableau/maquette-visuels-peps` | ouverte | hors chantier | maquettes seules à valider par Will | à demander à Will |
| #241 | `tableau/maquette-charte-axion` | ouverte | hors chantier | maquette charte, ancienne | à demander à Will |

Aucune de ces PR n'est proposée à la fermeture par cet inventaire ; les plus anciennes (#241, #260, #280, #316, #317, #318, #363) sont simplement signalées comme « à trancher ».

## 3. Fichiers temporaires ou artefacts commités

| Élément | Pourquoi | Risque |
|---|---|---|
| `docs/correctifs/G0-inscription-scriptClaude.patch`, `G4-instrumentation-boucle-generation.patch` | Fichiers `.patch` ; cités uniquement par `docs/GENERATEUR-G0/G4-RELEVE.md` et `src/services/boucle-generation.ts` (commentaire) : documentation historique | faible |
| `docs/facecam/ACTIVATION-FACECAM.patch` | `.patch` cité par les journaux facecam. NE PAS TOUCHER (facecam) | à demander à Will |
| `docs/formats/image-video/variete/integration/f45/correctif-hors-lot.patch` | `.patch` cité par `mesures.md`. NE PAS TOUCHER (image-video) | à demander à Will |
| `docs/captures/` (463 fichiers, ~175 Mo), `docs/captures-apprentissage/` | Captures d'écran 390/1440 px des relectures passées ; 15 documents les citent, la plupart des pages ont été refaites depuis. Pèsent sur le clone, ne servent plus au code | faible (captures UI) — mais peuvent montrer des données réelles : à demander à Will avant tout tri |
| `docs/vignettes/` (~56 Mo), `docs/facecam-animee-v4/` (~137 Mo), `docs/formats/` (~215 Mo, 742 images), `tests/cas-concret/` (~11 Mo) | Gros volumes d'images/vidéos de démonstration. NE PAS TOUCHER (facecam, cas-concret, image-video, ou personnes potentielles) | à demander à Will |
| `docs/facecam-animee-v2/`, `docs/facecam-animee-v3/` (2–3 Mo) | Anciennes versions de la doc facecam animée (v4 existe). NE PAS TOUCHER (facecam) | à demander à Will |
| `docs/VERIFICATION-2026-10-01.json`, `docs/JOURNAL-*.md`, `docs/OUTILS-REELS-R0..R8.md`, `docs/GENERATEUR-G*-RELEVE.md` | Journaux datés, historiques ; aucun fichier `.log`, `.diff`, `tmp/` ni `.DS_Store` n'est commité (vérifié) | aucun |

Recherche négative : aucun `.log`, `.diff`, `.orig`, `.bak`, `.zip`, dossier `tmp/`/`scratch/` ni `.env` suivi par git.

## 4. Doublons de tests et fichiers morts liés aux scripts

| Élément | Pourquoi | Risque |
|---|---|---|
| Code `etape-numero` (`src/domaine/scripts-tableau-controles.ts`, `src/services/tableau-scripts/index.ts`, `tests/tableau-scripts/regles.test.ts`) | **Vivant** : défini, utilisé dans la table de correspondance et testé. Aucune suppression à proposer | aucun (rien à faire) |
| Noms de tests identiques dans plusieurs dossiers (`regles.test.ts`, `controles.test.ts`, `moteur.test.ts`, `fiche.test.ts`, `domaine.test.ts`, `boucle.test.ts`…) | Même nom de fichier dans des dossiers de chantiers différents : homonymie, pas doublon prouvé (contenus non comparés, 16 fichiers sous `tests/tableau-scripts`). Rien de mort évident | aucun |
| `scripts/captures-relire-script.mjs`, `scripts/captures-relire-tableau.mjs`, `scripts/captures-relire-cas-concret.mjs`, `scripts/captures-relire-generateur.mjs`, `scripts/captures-gm.mjs` | Scripts de captures d'écran ponctuels liés aux relectures ; non vérifiés un à un pour usage par une CI. Candidats à examiner | à demander à Will |
| `src/app/(studio)/essais/relire-script/`, `src/app/(studio)/maquettes-generateur/scripts/` | Pages d'essai / maquettes ; encore exposées par le routeur, usage non confirmé | à demander à Will |

Limite honnête : pas de détection automatique de code mort (type knip) lancée ; seul le cas `etape-numero` cité en exemple a été vérifié.

## Annexe A — branches distantes dont la PR est fusionnée (hors familles protégées)

`apprentissage/gagnants-et-corrections`, `apprentissage/suivi-relecture`, `banc/aveugle-equipe-courte`, `banc/par-sujets`, `bases/resynchro-manifeste`, `bases/usine-lues-par-le-studio`, `commun/sans-textes-reseaux`, `console/annuler-et-nettoyer`, `console/bandeau-generateur`, `console/classement-videos`, `console/corbeille-30-jours`, `console/fab-f0-socle`, `console/fab-f2-tableau`, `console/fab-f5-suivi-generique`, `console/fab-verrou-tests-f0`, `console/suppression-complete`, `console/verbes-5a`, `console/verbes-5b`, `correctif/exclure-banc-aveugle-du-build`, `correctif/interface-claire-import-react`, `correctif/lecteur-pas-de-double-sous-titres`, `correctif/police-v4-ne-bloque-plus-le-rendu`, `credits/alertes-claires`, `deploiement/protection-fabrications`, `dettes-argent-avant-lot3`, `docs/regles-routines`, `ecrire/comite-editorial`, `ecrire/comite-sur-idees`, `ecrire/idees-de-l-usine`, `ecriture/bases-dans-equipe`, `ecriture/cache-repare`, `ecriture/chaine-courte-production`, `ecriture/chaine-equipe`, `ecriture/consignes-mot-cle-envoi`, `ecriture/controles-v4`, `ecriture/courte-correctifs`, `ecriture/garde-fous-budget`, `ecriture/petits-restes`, `ecriture/pire-cas-exact`, `feat/ffmpeg-recent`, `feat/ffmpeg8-qualite`, `feat/monteur-connait-la-miniature`, `fix/cartes-finitions`, `fix/controle-sdr-start-time`, `fix/coupes-reprises-mode-texte`, `fix/export-10bits-ffmpeg51`, `fix/fal-endpoint-id`, `fix/fiche-duree-chat-pendant-format`, `fix/fiche-video-cartes-formats-memoire`, `fix/fil-monteur-defilement`, `fix/iv-clic-isole-pause`, `fix/iv-debit-mots-par-seconde`, `fix/iv-fusion-preuve-silence-brut`, `fix/iv-relecture-images-et-refaire`, `fix/iv-version-prudente-et-ecran`, `fix/iv-visuel-fond-ivoire-pastille`, `fix/miniature-titre-et-image`, `fix/monteur-carte-de-fin-et-reponses`, `fix/monteur-grammaire-trop-grande`, `fix/monteur-remettre-carte-et-cartes-ecrasees`, `fix/monteur-schema-unions`, `fix/sous-titres-passage-dit-autrement`, `fix/sous-titres-sur-carte-pleine`, `fix/zoom-image-cassee`, `integration/15-23-24`, `interface-claire/l1-planche`, `interface-claire/lot-b`, `interface-claire/lot-c-v3-integration`, `interface-claire/lot-i`, `interface-claire/v4-branchement`, `interface-claire/v4-harmonisation`, `interface-claire/v4-lot1`, `interface-claire/v4-lot2`, `interface-claire/v4-lot3`, `interface-claire/v4-lot4`, `interface-claire/v4-lot5`, `navigation/fiche-image-video`, `navigation/registre-formats`, `navigation/un-seul-chemin`, `navigation/vocabulaire-etats`, `qualite/anti-repetition`, `qualite/calibrage-socle`, `qualite/regles-will-partout`, `qualite/socle-commun`, `reglages/choix-chaine-ecriture`, `reglages/libelles-economique-premium`, `reglages/plafond-sujet`, `rendu/delai-de-garde`, `reseaux/t1-registre-sorties`, `reseaux/t2-table-tableau`, `reseaux/t4-choix-fichier-par-reseau`, `reseaux/t5-formats-voulus`, `script/relire-assistant`, `script/relire-cas-concret`, `script/relire-generateur`, `script/relire-script-commun`, `script/relire-tableau`, `scripts/avertissement-nouveau-sujet`, `scripts/import-fichier-tableau-fca`, `scripts/lot-a-recette-positionnement`, `scripts/script-perso-identique`, `scripts/script-perso-suite`, `site/lots-studio`, `site/plan-lots-studio`, `studio/boutons-et-correctifs`, `studio/cas-concret-stock-statut`, `studio/finitions-page-vivante-police`, `studio/generateurs-grises`, `studio/harmonisation-h0-h2`, `studio/harmonisation-h3`, `studio/harmonisation-h4`, `studio/harmonisation-h5`, `studio/harmonisation-h6`, `studio/harmonisation-h8a`, `studio/harmonisation-h8b`, `studio/harmonisation-h8c`, `studio/harmonisation-plan`, `studio/maj-sans-couper`, `studio/memoire-2g`, `studio/memoire-native`, `studio/modification-comprise`, `studio/prix-annonce-vrai`, `studio/voix-phrase-coupee`, `suite/image-video-ton`, `tableau/accord-generateur-decoupage`, `tableau/allumer`, `tableau/ancres-bornees`, `tableau/banc-bout-en-bout`, `tableau/boutons-apres-arret`, `tableau/controle-indicatif-vous-cliquez`, `tableau/correctif-bruitages`, `tableau/correctif-image`, `tableau/correctifs-interface`, `tableau/design-charte-axion`, `tableau/dessin-3`, `tableau/dessin-4`, `tableau/ecran-nouvelle-video`, `tableau/ecriture-a-l-heure`, `tableau/essai-ecran-3`, `tableau/exemple-illustratif-page-de-plus`, `tableau/fabrication-dessins-trois-styles`, `tableau/faux-refus-decoupage`, `tableau/fin-scene-vide`, `tableau/fin-tiktok-rythme`, `tableau/fin-tiktok-une-demande`, `tableau/finitions-style`, `tableau/fins-par-reseau`, `tableau/formats-par-reseau`, `tableau/gabarit-clair-moteur`, `tableau/gabarit-finitions`, `tableau/gabarit-pages-trop-chargees`, `tableau/generateur-scripts`, `tableau/lot-fins`, `tableau/methode-courte`, `tableau/moteur-visuels-peps`, `tableau/mots-forts`, `tableau/mots-forts-enregistrer`, `tableau/org-02-tb-10-fiche-format`, `tableau/org-07a-voix-maitre`, `tableau/org-07b-voix-maitre`, `tableau/org-08-fiche-scenes`, `tableau/org-09-rendu-par-scenes`, `tableau/org-10-habillage-tb-04-stylo`, `tableau/org-12-droits-tb-07-dessins`, `tableau/org-13-controle-image`, `tableau/org-14-variete-org-01-guide`, `tableau/page-remplie-et-souffle`, `tableau/pages-v3`, `tableau/raccords`, `tableau/raccords-finaux`, `tableau/regle-4-apres-coupe`, `tableau/reprise-apres-voix`, `tableau/reprise-visuelle`, `tableau/rythme-longueur`, `tableau/script-en-fond`, `tableau/scripts-gabarit-cadre`, `tableau/scripts-v3`, `tableau/scripts-v3-plafond-sortie`, `tableau/sous-titres-centraux`, `tableau/sous-titres-design-central`, `tableau/sous-titres-dynamiques`, `tableau/style-reference-moteur`, `tableau/style-v2`, `tableau/tb-01-regles`, `tableau/tb-03-mise-en-page-tb-02-calage`, `tableau/tb-05-compositions`, `tableau/tb-06a-fabriquer`, `tableau/tb-11-moteur`, `tableau/tb-12-decoupage`, `tableau/tb-15-tb-16-fins-couverture`, `tableau/tb-17-series-sans-numero`, `tableau/tb-19-trente-dessins`, `tableau/tb-20-retouche`, `tableau/tb-21-ecrans`, `tableau/tb-22-controles`, `tableau/titre-seul-propriete`, `tableau/tracabilite`, `tableau/trois-styles-moteur`, `tableau/vis-04-vis-05`, `verif/v1-chat-monteur`, `verif/v3-interface`, `verif/v4-argent`, `verif/v5-serveur`, `verif/v6-completude`, `videos/suppression-definitive`, `vignettes/ecarter-2-photos`, `vignettes/lot1`, `vignettes/maquettes`, `voix/reference-et-fin-propre`


## Annexe B — PR fermées sans fusion

#444 #409 #407 #313 #308 #291 #285 #284 #199 #167 #24 #11 (voir 1b).
