# Moteur avocat — contrat d'exécution des lots M1b, M1, M2, M3, M4

> Écrit par l'architecte le 2026-10-01, à la fin du lot **M0** (fait, commit « moteur avocat : lot M0 »).
> Plan : `Axion-IA/<dossier-de-plan-prive>/PLAN-MOTEUR-AVOCAT.md` v3.2 (+ « Corrections de l'architecte » en tête).
> **Ce document PRIME pour la répartition des fichiers.** Le plan prime pour le fond (le quoi et le pourquoi).
> Hors périmètre ici : M0b (voix HeyGen réelle), M5 (illustrations réelles), M6 (visage réel), M7 (banc d'essai) — ils attendent des clés et les doubles de Will.
> **État au 10/10/2026 (vérification A3) :** M0b, M5 et M6 (visage réel, par les lots R7, R7e et R8) sont faits ; restent M7 (envoi privé), D2 (webm transparent réel) et le déploiement de M4b. Ce qui manque au format : `docs/verification/A3-COMPLETUDE-AVOCAT.md`.

Ordre : M0 ✅ → **M1b** ✅ (rapport en fin de document) → **M1** ✅ (rapport en fin de document) → (**M2** ∥ **M3**, en parallèle, fichiers DISJOINTS) → **M4** (→ M4b si la mesure l'exige).
(M0b peut tourner en parallèle de M1b dès que `HEYGEN_API_KEY` existe ; il ne touche que les fichiers listés en annexe A.)

---

## 0. Règles communes à tous les lots

1. **Aucun appel payant ni réseau** vers HeyGen, ElevenLabs, fal.ai, Anthropic, Pexels, Pixabay ou R2 pendant le développement. Le code réel est écrit derrière les interfaces et **activé seulement par variables d'environnement** (ou par le réglage en base `fournisseur.<type>` / `moteur.<format>`). La simulation reste le défaut ; **tous les tests passent sans aucune clé**.
2. **Rien n'est purgé automatiquement** : aucune suppression physique par le code. Seule exception (décision de Will du 17/10) : la suppression MANUELLE d'une vidéo par Will, confirmée, l'efface pour de bon (`supprimerVideoDefinitivement`, dépenses et réservations gardées). Partout ailleurs, on archive, on renomme, on crée une nouvelle version. Une donnée remplacée est gardée sous une clé d'archive (exemple : `travaux.appliquerProduitsDuMoteur` garde les plans d'avant redécoupage).
3. Textes affichés en **français, vouvoiement**, très peu de texte. **Mots interdits** à l'écran : job, render, prompt, token, API, upload, pipeline, workflow, mock, fictif, dashboard, avatar. Mobile d'abord (390 px), jetons de couleur seulement, composants de `@/components/ui`.
4. **Une seule passe qualité par lot** : un lot est livré FINI — tests unitaires de sa logique, `pnpm exec tsc --noEmit` = 0, `pnpm exec eslint .` = 0, `pnpm exec vitest run` vert ; captures à 390 px quand le lot a un écran. Le mot de passe n'est jamais écrit dans un fichier (`E2E_MDP='…'` dans la commande seulement).
5. **Next 16** : lire `node_modules/next/dist/docs/` avant toute API Next (`params` et `searchParams` sont des Promise, `proxy.ts` remplace le middleware, `error.tsx` reçoit `retry`).
6. **Windows, pas de Docker local** : un conteneur se DÉCRIT (Dockerfile, docker-compose) et ne se lance pas ici ; Remotion et FFmpeg peuvent tourner en local pour les tests.
7. **Fichiers figés par M0** (section 1) : un lot qui en a besoin d'un changement ne le fait pas seul — il ajoute un fichier à lui, ou il écrit la demande dans son rapport. Exception unique : **ajout pur** d'un champ facultatif en fin d'interface, signalé dans le rapport du lot.
8. **Migration de données** : toute correction de données par défaut passe par `src/services/migrations.ts` (idempotente, testée, sans suppression), en **ajoutant une étape numérotée à la fin** de `migrerDonnees` — jamais en modifiant une étape existante.
9. Commit en français, dernière ligne `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, puis `git push`. Rien n'est déployé sur le serveur par les agents.

---

## 1. Interfaces partagées figées par le lot M0

| Fichier | Ce qui est figé (ne pas renommer, ne pas changer de forme) |
|---|---|
| `src/domaine/types.ts` | `Visage` (`tenueId`, `fondTournage`, `posture`, `origine`, `detoureFichierId`, statut `a_verifier`), `Personnage.visageParDefautId/voixParDefautId`, `Voix.typeClone`, `ValeurStyleSousTitres`, `ValeurStyleMontage`, `ValeurProfilSon`, `ValeurDecor`, `ValeurAccessoire`, `Incrustation`, `Adresse`, `TypeAccroche`, `Script.adresse/accroche`, `Video.adresse/posture/briquesAllumees`, `StatutVideo`/`StatutVersion` + `annulee`, `CodeAlerteQualite`, `Distribution.visagesParAngle/repartitionAngles`, `StylesChoisis.decorId/accessoireIds`, `Plan.cadrage` (`CadragePlan`), `Plan.incrustation/motAncre`, `TexteEcran.positionPct` + style `encadre`, `TypePiste` + `master-sans-texte`/`audio-maitre`, `Piste.empreinte/mots`, `StatsPublication` (4 champs v3.2), `TypeTravail` + `recalque-sous-titres`, `TypeNotification` + `plan-a-verifier`, `VisageResolu`, `DistributionResolue` (v2), `StyleResolu`, `StylesResolus.decor`, `PlanCommande`, `ProfilRealisme`, **`CommandeFabrication` v2** (`moteurId`, `adresse`, `posture`, `accessoires`, `profilRealisme`, `profilRendu`, `recetteMontage`, `tauxUsdEur`), `ElementBibliotheque.utilisations/derniereVideoId/dernierRangVideo/fabrique/version`. |
| `src/formats/types.ts` | `DureesFormat` (liste / depuis-script), `EncadreOuverture`, `ExportFormat`, `ProfilRendu`, `RecetteMontage`, `EtatBrique` (+ `au-choix-coupee`), `DefinitionFormat.musique/export/profilRendu/recetteMontage/migrerScript`. |
| `src/formats/index.ts` | `briquesEffectives(format, coupees, allumees)`, `estimerDureeTexte`, `dureeDepuisScript`, `dureeParDefaut`, `valeursDuree`, `dureeVideo`, `zoneDuree`, `blocsAJour`, `scriptAJour`, `blocsACompleter`, `mentionIAActive`, `casesRequises`, `musiqueInterdite`, `musiqueRetenue`. |
| `src/formats/communs.ts` | `REPARTITIONS_ANGLES`, `repartitionDepuisReglages`, `briquesAuChoix` (mention IA `au-choix-coupee`), `REGLES_COMMUNES` sans tu/vous. |
| `src/formats/avocat/index.ts` | Format v2 complet. **Seul M3** y change une ligne : `etapes` → `["express", "fabrication"]`. |
| `src/fournisseurs/types.ts` | `CapacitesFournisseur` (`audioSeul`, `horodatageMots`, `fondTransparent`, `resolutionMax`, `fpsSortie`, `tarifUsd`), `ErreurFournisseur`, `DemandeLecture` / `ResultatLecture` (`mots`), `VoixExistante`, `FournisseurVoix.listerVoixExistantes`, `DemandeRenduVisage`, `EtatRenduVisage`, `FournisseurVisage.rendre/suivreRendu/recuperer/creerLook`, `ResultatBanque`, `FournisseurIllustration.chercher/animer`, `AccrocheProposee`, `CatalogueDistribution`, `PastilleDistribution`, `DemandeModification` / `ReponseModification`, `FournisseurScript.decouper/accroches/resoudreDistribution/interpreterDemande` (+ `adresse`), **`OperationRendu`, `DemandeRendu`, `EtatRendu`, `ServiceRendu`** (contrat de `studio-rendu`). |
| `src/moteurs/types.ts` | `ResultatFabrication.plans/sousTitres/pistes/elementsCrees`, `PlanProduit`, `PisteProduite`, `ElementCree`, `ResultatMaquette` (`fichierCle` facultatif), `OperationMontage`, `ParentRetouche`, `retoucher({operations, parent})`, `recalquer?`, `annuler?`, `DefinitionEtapeMoteur.coutEstime`. |
| `src/moteurs/index.ts` | `choisirMoteurAuLancement`, `idMoteurDeCommande`, `moteurDeCommande`. **Aucun** `obtenirMoteur(format.moteur)` nouveau dans les services. |
| `src/moteurs/contrat.ts` | `testerMoteurVideo` (tolérance de durée `toleranceDuree`, ratio pris dans les capacités). M1b y AJOUTE le test d'`annuler` ; rien d'autre ne change. |
| `src/briques/index.ts` | `IdBrique` (13 briques), `Entree*`, `alertesMentionIA`, `alertesDuree`. M2 remplace l'implémentation de `briqueSousTitres` (pas sa signature). |
| `src/domaine/adresse.ts`, `distribution.ts`, `lecture.ts` | Fonctions pures `analyserAdresse`, `alerteAdresse`, `regleAdresse`, `adresseDepuisFacon` ; `resoudreVisagesParAngle`, `normaliserTenue`, `tenueDe`, `visageParDefaut` ; `phrasesDe`, `phrasesTropDenses`, `SEUIL_MOTS_PAR_SECONDE` (M2 peut affiner le calcul de `lecture.ts`, pas la signature). |
| `src/donnees/elements-avocat.ts` | Valeurs des éléments avocat (une seule source pour la démonstration et la migration). Réglées sur captures : la VALEUR peut changer (M2 : sous-titres ; M4 : son, décor, LUT), le nom des constantes non. |
| `src/services/fabrication.ts` | `construireCommande` (contrat v2), `plansApercu`, `maquetteRapide` (version `maquette` non numérotée), `lancerRetouche` (fournit `parent`). |
| `src/services/travaux.ts` | `appliquerProduitsDuMoteur(videoId, versionId, resultat, langue, estDemo?)`. |
| `src/services/videos.ts` | `sousTitresCourants(versionId)` (plus haute version), `obtenirScriptAJour`, `adresseParDefaut`, `reprendreVideo`. |
| `src/services/migrations.ts` | `migrerDonnees(depots, maintenant?)` → `RapportMigration` ; étapes 1 à 7. On ajoute des étapes à la fin. |

---

## 2. Lot M1b — boucle de fond, R2, `studio-rendu`, file et reprise

**But** (plan B.9 ter) : une fabrication avance sans visiteur ; les fichiers vivent dans R2 ; le travail lourd part dans un conteneur sans état.

**Crée**
- `src/services/boucle.ts` — `demarrerBoucle()` (minuterie 5 s, une seule fois par processus, `globalThis`), `tourDeBoucle()` : drapeau « en cours » (un tour sauté si le précédent n'est pas fini, aucune mise en file), lecture sous `sousVerrou`, appels réseau HORS verrou avec délai max (30 s ; 90 s pour une synthèse vocale entière), réécriture sous verrou en vérifiant que l'étape n'a pas été annulée entre-temps ; reprise automatique (3 tentatives espacées, puis « en attente du fournisseur », relance toutes les 10 min, échec avec notification après 24 h). Test : `tests/boucle.test.ts` (tour de 12 s + minuterie 5 s → une exécution à la fois ; « Arrêter » pendant un tour → l'état annulé n'est pas réécrit ; 404 de `studio-rendu` → nouvelle soumission même `idRendu`).
- `src/fournisseurs/r2/stockage.ts` — `StockageFichiers` réel (S3 signé, préfixe `studio/{env}/…`, adresses courtes pour le navigateur, **24 h** pour HeyGen), activé par `FOURNISSEUR_STOCKAGE=r2` + `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_HOST` ; envoi multipart signé (morceaux 10-50 Mo, reprise d'un morceau et d'un envoi interrompu). `src/lib/envoi-multipart.ts` (client) ; `src/app/api/depots/route.ts` (signatures des morceaux, `exigerSession`).
- `src/fournisseurs/rendu/client.ts` — `ServiceRendu` réel (HTTP vers `STUDIO_RENDU_URL`, réseau interne) + `src/fournisseurs/simulation/rendu.ts` (simulé, défaut). Ce n'est **pas** un nouveau `TypeFournisseur` : il est obtenu par `obtenirServiceRendu()` dans le même fichier.
- `studio-rendu/` (racine du dépôt, paquet à part) : `package.json`, `src/serveur.ts` (POST `/rendus`, GET `/rendus/{id}`, deux files, priorité courte, un seul rendu long à la fois, dépôt R2), `src/operations/` (une opération par fichier : `nettoyage-audio.ts` vide à remplir au lot M1, `analyse-media.ts`, `image-fixe.ts`, `composition.ts` squelette pour M4), `compositions/Essai.tsx` (une composition d'essai). Un sous-dossier `compositions/sous-titres/` est **réservé au lot M2**, `compositions/avocat/` au **lot M4**.
- `deploiement/studio-rendu/Dockerfile` (Node + Chromium sans affichage + FFmpeg/ffprobe, `nice`, utilisateur non root).
- `src/fournisseurs/notification/push.ts` (Web Push VAPID : `VAPID_PUBLIQUE`, `VAPID_PRIVEE`, `VAPID_SUJET`) et `src/fournisseurs/notification/email.ts` (secours).
- `components/videos/BoutonArreter.tsx` (« Arrêter », confirmation : « seules les étapes faites sont payées »).

**Modifie** (seul propriétaire pendant M1b)
`src/instrumentation.ts` (lance la boucle APRÈS `migrerDonnees`), `src/services/travaux.ts` (`listerTravaux` / `obtenirTravail` n'avancent plus rien ; `annulerTravail` passe par `moteur.annuler` si présent et enregistre une `DepenseEnregistree` des seules étapes terminées ; temps restant en minutes + heure de fin), `src/services/notifications.ts`, `src/services/couts.ts` (ventilation par `LigneCout.fournisseur`, par mois, coût moyen, écart estimé / réel), `src/moteurs/simulation.ts` + `src/moteurs/contrat.ts` (ajout d'`annuler` et de son test), `src/fournisseurs/index.ts` (inscrit `r2`), `src/app/api/crochets/[fournisseur]/route.ts` (réveil HeyGen sans confiance : `callback_id`, relecture par GET, `EvenementFournisseur`), `next.config.ts` (CSP : hôte R2 dans `media-src`, `img-src`, `connect-src`), `public/sw.js` (gestionnaire `push`), `src/components/coquille/EnregistrementPwa.tsx` (abonnement), `src/components/ui/ProgressionEtapes.tsx`, `src/components/videos/SuiviTravail.tsx`, `src/components/reglages/Budget.tsx` (taux dollar → euro, dépenses par outil), `src/app/(studio)/reglages/actions.ts` et `src/app/(studio)/videos/actions.ts` (actions « Arrêter », taux), `src/components/ui/ZoneDepot.tsx` (envoi multipart), `src/assistant/etapes/Fabrication.tsx` (« Vous pouvez fermer : on vous prévient » seulement quand la boucle tourne), `deploiement/docker-compose.yml` (service `studio-rendu` : `mem_limit 3g`, `cpus 2`, réseau `interne` ; variables du service `studio` : `HEYGEN_API_KEY: ${HEYGEN_API_KEY:-}`, `FOURNISSEUR_VOIX`, `R2_*`, `VAPID_*`, `STUDIO_RENDU_URL`), `deploiement/mettre-a-jour.sh` (construit aussi l'image `studio-rendu`), `src/components/personnages/GuideTournage.tsx` (**guide de tournage de Will**, B.3 + plan double, livré à la fin du lot).

**Critères de fin**
- [ ] Un travail simulé avance jusqu'à « prête » **sans aucune lecture de page** (test de la boucle).
- [ ] Aucun empilement (test 12 s / 5 s) ; aucun appel réseau sous le verrou (revue du code + test).
- [ ] « Arrêter » : vidéo `annulee`, dépense des seules étapes terminées, l'état annulé n'est jamais réécrit.
- [ ] Reprise : 3 tentatives, attente du fournisseur avec bandeau, relance 10 min, échec + notification après 24 h (horloge simulée).
- [ ] Sans variable R2 : stockage simulé, tout fonctionne ; avec `FOURNISSEUR_STOCKAGE=r2` : adresses signées (testées sans réseau, signature vérifiée hors ligne).
- [ ] `studio-rendu` : files courte / longue testées en local (Node, sans Docker) ; 404 → resoumission même `idRendu`.
- [ ] Web Push : abonnement enregistré, notification « Votre vidéo est prête » reçue en local (Chrome) ; e-mail de secours simulé par défaut.
- [ ] Tableau des coûts par outil + écart estimé / réel ; temps restant en minutes et heure de fin.
- [ ] Captures 390 px : suivi de fabrication (avec « Arrêter »), Réglages > Budget. Guide de tournage remis à Will.

---

## 3. Lot M1 — accroches, profil avocat, voix → audio maître → plans, maquette

**But** (plan B.1, B.2, B.4, B.5 contrôle, B.9 bis accroches) : le moteur `montage-avocat` existe et découpe sur le vrai son ; la maquette est composée dans le navigateur.

**Crée**
- `src/moteurs/montage-avocat/index.ts` — `moteurMontageAvocat: MoteurVideo` (clés d'étapes `voix`, `decoupage`, `visage`, `montage`, `sous-titres`, `etalonnage`, `son`, `export`, `controle-qualite` ; libellés « Votre voix », « Plans », « Vous », « Montage », « Vérification »). Fournisseurs par injection (`resoudreFournisseur`). Refuse une voix sans `audioSeul` (erreur typée). Le visage, le montage et l'export restent simulés jusqu'aux lots M4 et M6.
- `src/moteurs/montage-avocat/nettoyage.ts` — calcul PUR des coupures (blanc > 180 ms → 80-120 ms, tête < 0,1 s, fondus 10-20 ms aux passages par zéro, respirations 150-250 ms au plus une toutes les 2-3 phrases) et décalage des horodatages ; la coupe du son est l'opération `nettoyage-audio` de `studio-rendu` (file courte).
- `src/moteurs/montage-avocat/report.ts` — report mot pour mot des horodatages du texte PRONONCÉ (prononciations substituées) sur le texte VALIDÉ.
- `src/moteurs/montage-avocat/decoupage.ts` — découpage B.2 complet (ouverture 1,5-2,5 s sur 6 s, ≥ 2 coupes avant 5 s, première coupe < 2 s, 2,5-3,5 s ensuite, plafond 6 s, rupture forte 10-15 s au-delà de 30 s, 85/15, second angle jamais deux fois de suite ni sur l'accroche, poitrine sur l'emphase, écart de cadrage ≥ 15 %, plafond 112 % si `levresNote` < 85, illustrations ancrées sur `motAncre` −0,2/+0,1 s, jamais dans les 1,5 dernières secondes, fin 0,4-0,6 s après le dernier mot ; identité des plans par `segmentId` + recouvrement).
- `src/moteurs/montage-avocat/maquette.ts` — maquette : voix (après `verifierBudget`), nettoyage, découpage ; renvoie `plans`, `pistes` (`audio-maitre` avec `empreinte` = texte + voix + prononciations) et `lignesReelles`, **sans `fichierCle`**.
- Tests : `src/moteurs/montage-avocat/*.test.ts` + `tests/montage-avocat.contrat.test.ts` (`testerMoteurVideo(moteurMontageAvocat, …)`), test « verrouiller, redécouper, l'illustration reste sur la même phrase ».
- `src/components/creation/MaquetteNavigateur.tsx` — lecture dans le navigateur : vignettes des plans + piste `audio-maitre` (sans canvas du plateau, qui est au lot M3). Composant **autonome** : M3 l'intègre, ne le modifie pas.
- `outils/mesures/` — scripts de mesure des références restantes (débit par alignement, détection de coupes, part du temps en illustrations) ; résultats reportés dans `references-avocat/FICHE-STYLE-AVOCAT.md`.
- Contrôle de l'horodatage (B.5) : `outils/alignement/README.md` + script WhisperX pour un poste de développement ; `studio-aligneur` n'est construit QUE si l'écart moyen dépasse 80 ms (alors lot à part, signalé).

**Modifie**
`src/moteurs/index.ts` (inscrit `montage-avocat` dans `MOTEURS` — la production reste en simulation tant que le réglage `moteur.avocat` n'est pas posé), `src/fournisseurs/simulation/script.ts` (note de l'accroche v3.2 : bonus « parle au spectateur » et « mot concret », densité ; accroches notées — `accrochesSimulees` existe déjà), `src/services/fabrication.ts` (`maquetteRapide` réutilise la piste `audio-maitre` de même empreinte ; `lancerFabrication` la transmet au moteur), `studio-rendu/src/operations/nettoyage-audio.ts`, `src/donnees/elements-avocat.ts` (valeurs mesurées, si les références les corrigent).

**Critères de fin**
- [ ] `testerMoteurVideo` passe sur `montage-avocat` (fournisseurs simulés), y compris `annuler` (ajouté par M1b).
- [ ] Toutes les règles B.2 testées une par une (une règle = un test nommé).
- [ ] Nettoyage : coupures et décalages testés ; fichier son réel de la voix de Will traité en local par FFmpeg **si** un fichier est fourni (sinon un fichier de synthèse de test) — aucun appel HeyGen.
- [ ] Report des horodatages : texte substitué ≠ texte affiché → horodatages toujours alignés (test).
- [ ] Maquette : aucune vidéo produite, piste `audio-maitre` enregistrée et réutilisée (test « pas repayée »).
- [ ] Fiche de style mise à jour avec les fourchettes mesurées.

---

## 4. Lots M2 et M3 — EN PARALLÈLE, fichiers DISJOINTS

### 4.1 Propriété des fichiers (aucun chevauchement)

| Fichier ou dossier | M2 | M3 |
|---|---|---|
| `src/briques/sous-titres/**` (nouveau) | ✅ crée | lit |
| `src/briques/index.ts` | ✅ (implémentation de `briqueSousTitres` seulement) | ✗ |
| `src/domaine/lecture.ts` | ✅ (calcul, pas la signature) | lit |
| `src/services/videos.ts` | ✅ (`corrigerMotSousTitres` seulement) | ✗ |
| `src/services/fabrication.ts` | ✅ (sous-titres créés au lancement et recopiés à la retouche) | ✗ |
| `src/app/api/sous-titres/[id]/route.ts` | ✅ | ✗ |
| `src/components/ecrire/EditeurBlocs.tsx`, `Atelier.tsx` | ✅ (alerte « phrase trop dense ») | ✗ |
| `src/components/bibliotheque/SousTitreAnime.tsx`, `EcranSousTitres.tsx` | ✅ (aperçu du nouveau style) | ✗ |
| `src/donnees/elements-avocat.ts` | ✅ (`STYLE_SOUS_TITRES_AVOCAT` après captures) | ✗ |
| `studio-rendu/compositions/sous-titres/**` | ✅ crée | ✗ |
| `outils/captures-sous-titres/**`, `docs/captures/sous-titres-*` | ✅ | ✗ |
| `src/assistant/**` (Express, feuilles compactes, Script, Distribution, Reglages, Apercu, registre, types, Assistant) | ✗ | ✅ |
| `src/formats/avocat/index.ts` (ligne `etapes`), `src/formats/registre.test.ts` | ✗ | ✅ |
| `src/app/(studio)/nouvelle/**`, `src/app/(studio)/videos/**` (pages ET actions) | ✗ | ✅ |
| `src/components/creation/**` (sauf `MaquetteNavigateur.tsx`, lu tel quel), `src/lib/lut3d.ts` (nouveau) | ✗ | ✅ |
| `src/components/videos/**` (dont `fiche/OngletSousTitres.tsx`, `fiche/OngletRetouches.tsx`, `fiche/DemanderModification.tsx`), `src/components/ui/LecteurVideo.tsx` | ✗ | ✅ |
| `src/services/express.ts`, `src/services/modifications.ts` (nouveaux) | ✗ | ✅ crée |
| `tests/e2e/parcours.spec.ts`, `docs/captures/votre-video-*`, `plateau-*`, `revue-*` | ✗ | ✅ |
| Fichiers figés de la section 1 | ✗ | ✗ |

Un besoin hors de sa colonne → écrit dans le rapport du lot, traité par l'autre lot ou par l'architecte après la fusion. Les deux lots ne se fusionnent dans `main` qu'après leurs propres vérifications ; le second à fusionner relance `tsc`, `eslint`, `vitest`.

### 4.2 Lot M2 — sous-titres (plan B.5, B.0 §20 sans rendu)

**Crée** `src/briques/sous-titres/groupement.ts` (2 à 4 mots, mot seul seulement pour un mot en valeur ou un montant, 0,4-0,9 s, cible 0,6 s, fusion < 200 ms, jamais de mot outil seul en fin de groupe, nombres et montants insécables, rien pendant un blanc, calage à moins de 0,2 s d'une coupe), `largeur.ts` (largeur max depuis `zoneProtegeeCombinee('9:16', reseauxConseilles)`, mesure réelle de la largeur rendue — métriques de Raleway Bold embarquées), `report.ts` (texte validé ← horodatage), `style.ts` (styles CSS pour Remotion et le navigateur : `paint-order: stroke fill`, `stroke-linejoin: round`, `font-variant-numeric: lining-nums tabular-nums`, jeton `orange-vif`), `index.ts`, tests ; `studio-rendu/compositions/sous-titres/` (calque Remotion des sous-titres, rendu `still`) ; `outils/captures-sous-titres/` (3 captures : fond noir, illustration claire, simulation de deutéranopie, chacune avec « 2 500 € » ou « 135 € »).

**Modifie** `src/briques/index.ts` (`briqueSousTitres` délègue à `briques/sous-titres`), `src/services/fabrication.ts` (sous-titres du lancement par le nouveau groupement ; la retouche recopie la version COURANTE seulement), `src/services/videos.ts` (`corrigerMotSousTitres` crée une NOUVELLE version de `SousTitres`, l'ancienne gardée), `src/app/api/sous-titres/[id]/route.ts` (version la plus haute, `.srt` / `.vtt` sans chevauchement de minutage), `src/domaine/lecture.ts`, `src/components/ecrire/EditeurBlocs.tsx` + `Atelier.tsx` (alerte « phrase trop dense pour être lue », non bloquante), `src/components/bibliotheque/SousTitreAnime.tsx` + `EcranSousTitres.tsx`, `src/donnees/elements-avocat.ts`.

**Critères de fin**
- [ ] Chaque règle de groupement testée (dont « 67 000 € » groupé, jamais « de » ou « le » en fin de groupe, calage sur les coupes à 0,2 s).
- [ ] Largeur : aucun groupe ne dépasse la zone libre combinée (TikTok + Instagram : 64 % ≈ 690 px), mesure réelle.
- [ ] Correction d'un mot : nouvelle version, l'ancienne intacte, tous les lecteurs sur la plus haute (fiche, export, retouche).
- [ ] 3 captures produites par Remotion `still` sur ce poste, montrées à Will (style validé avant M4).
- [ ] Alerte de densité visible dans l'atelier et l'assistant (> 5,5 mots/s).

### 4.3 Lot M3 — écran « Votre vidéo » (plan B.9, B.0 §2, §16)

**Crée** `src/assistant/etapes/Express.tsx` (remplace le composant d'attente du lot M0), `src/assistant/express/` (blocs Script · Plateau · Voix · Style · Coût en feuilles du bas `FeuilleBas`, mode « pas à pas » = enchaînement des mêmes feuilles, `useEnregistrementDiffere.ts` ≈ 800 ms), `src/components/creation/ApercuPlateau.tsx` (canvas : `Visage.detoureFichierId` sur `decor.imageFichierId`, flou, accessoire, **shader LUT 3D** chargé depuis le `.cube` via `src/lib/lut3d.ts` ; < 1 s à 390 px ; sans image détourée : la vignette brute, et l'écran le dit), `src/components/videos/fiche/DemanderModification.tsx` (conversation, résumé + coût + plans touchés, rien sans confirmation, via `FournisseurScript.interpreterDemande`), `src/services/express.ts` (données de l'écran : Mes scripts filtrés sur le format, triés par note puis date ; texte collé → `decouper` ; saisie libre → `resoudreDistribution` en pastilles ; formats d'image dans le bloc Coût, 9:16 coché), `src/services/modifications.ts` (demande → opérations → `lancerRetouche` avec `operations`).

**Modifie** `src/formats/avocat/index.ts` (`etapes: ["express", "fabrication"]`), `src/formats/registre.test.ts` (fin de parcours « express, fabrication » admise), `src/assistant/etapes/{Script,Distribution,Reglages,Apercu}.tsx` (prop `compacte`, aucune copie d'écran ; onglets « Mes scripts » / « Coller » / « Une idée », la génération automatique seulement en « Une idée » ; pastille Vous / Tu), `src/assistant/etapes/types.ts`, `registre.tsx`, `src/assistant/Assistant.tsx` (enregistrement différé quand l'étape est `express`), `src/app/(studio)/nouvelle/[format]/{page.tsx,actions.ts}`, `src/app/(studio)/videos/[id]/page.tsx` + `actions.ts`, `src/components/videos/fiche/OngletSousTitres.tsx` (liste synchronisée au lecteur, groupe en cours surligné, toucher un mot → `corrigerMotAction` existante ; bouton « Appliquer à la vidéo » visible seulement si `moteur.recalquer` existe), `src/components/ui/LecteurVideo.tsx` (temps courant exposé), `tests/e2e/parcours.spec.ts` (test des touches déplacé sur le podcast ; nouveau test « avocat express ≤ 2 touches après le choix du format », le collage compte pour une action).

**Critères de fin**
- [ ] Captures 390 px de « Votre vidéo », du plateau et de la revue **validées par Will AVANT la série** (règle : une direction sur 1-2 écrans d'abord ; moderne, en blocs, très peu de texte).
- [ ] Tous les états du tableau A.3 du plan, chacun avec un test.
- [ ] Aperçu du plateau < 1 s à 390 px (mesure dans le test e2e).
- [ ] Brouillon enregistré à chaque changement (≈ 800 ms) ; repris depuis l'Accueil ; double supprimé entre-temps → bloc orange.
- [ ] « Demander une modification » : rien ne s'exécute sans confirmation ; hors capacités → réponse claire avec le prix de la vidéo à refaire.
- [ ] e2e : podcast ≤ 6 touches, avocat express ≤ 2 touches après le choix du format.

---

## 5. Lot M4 — montage, couleurs, son, export, recalque

**But** (plan B.7, B.0 §20) : la vraie vidéo sort de `studio-rendu`, sur le webm transparent réel du double d'essai (D2).

**Crée** `studio-rendu/compositions/avocat/` (calques 1 à 8 dans l'ordre B.7 : décor, double — agrandissement Lanczos sans renforcement —, accessoire avant recadrage, recadrage, illustration ou incrustation photographique, LUT + grain luminance 1,5-2 px + vignette → piste `master-sans-texte`, incrustations graphiques au-dessus de la LUT, encadré de titre, sous-titres du lot M2 ; 4:5 et 1:1 composés à part, double ancré en bas), `studio-rendu/src/operations/composition.ts` (rendu `colorSpace: 'bt709'`, H.264 High 4.1 12-16 Mb/s VBR 2 passes, GOP fermé, `+faststart`, `yuv420p` étiqueté, AAC-LC 320 kb/s 48 kHz), `studio-rendu/src/son/` (chaîne de la voix : passe-haut 80 Hz → atténuation 250-400 Hz si besoin → compression douce seulement si LRA > 3 LU → de-esser 6-8 kHz → présence 3-5 kHz → limiteur crête vraie → `loudnorm` 2 passes, −14 LUFS ±1, ≤ −1,5 dBTP ; mono centrée ; ton de pièce bouclé avec fondu 0,5-1 s et départ aléatoire à −40/−45 dB), `studio-rendu/src/operations/mesure-son.ts`, `src/moteurs/montage-avocat/composition.ts` (paramètres de la composition depuis la commande), `src/moteurs/montage-avocat/recalque.ts` (`recalquer` : calques 7-8 sur `master-sans-texte`, coût nul), `outils/lut/generateur-lut-buffer.py` + `outils/lut/qc.py` (copiés de `luts/`), `scripts/importer-luts.mjs` (les 4 `.cube` Axion Buffer → éléments `lut`, `lut-avocat-v1` = Clair-obscur), `tests/luts.test.ts` (chaque `.cube` livré : taille 65, gris monotone, cassure < 0,02, en-tête valide).

**Modifie** `src/moteurs/montage-avocat/index.ts` (étapes montage, couleurs, son, export ; contrôle `export` par `ffprobe`), `src/services/migrations.ts` (étape 8 : fichiers des LUT sur `lut-avocat-v1` et les 3 autres, sans toucher aux LUT d'exemple), `src/donnees/elements-avocat.ts` (son, décor, LUT après captures), `src/components/bibliotheque/outils.ts` + `src/fournisseurs/simulation/autres.ts` (validation `.cube` : contrôle `qc` à l'import, refus clair si cassé, avertissement si cassure > 0,02), `src/components/videos/fiche/OngletSousTitres.tsx` (le bouton « Appliquer à la vidéo » devient actif), un service `src/services/recalque.ts` (nouveau) pour lancer le `TypeTravail 'recalque-sous-titres'`.

**Critères de fin**
- [ ] Une vidéo 9:16, une 4:5 et une 1:1 rendues en local sur le webm transparent du double d'essai ; captures côte à côte avec une référence l'avocat de référence (plan poitrine à 120 %, bord du détourage sur le décor par défaut).
- [ ] Mesures sur le fichier EXPORTÉ : −14 LUFS ±1, crête vraie ≤ −1,5 dBTP, pauses entre −48 et −35 dB, BT.709 / tv / `yuv420p` (tests).
- [ ] Recalque d'un mot corrigé : nouvelle sortie sans repayer voix ni visage (coût 0).
- [x] Temps de rendu local mesuré (45 s, par ratio) et décodage du webm alpha 1080p ; **au-delà de 4 min : lot M4b** (Remotion Lambda), décision consignée. *(M4 : 7 à 12 min → lot M4b fait SANS compte AWS, en accélérant le rendu local : ≈ 3 min pour 45 s avec 6 cœurs ; Remotion Lambda écrit et éteint. Annexe E.)*
- [ ] LUT validées sur captures par Will ; envoi privé TikTok / Instagram préparé pour M7.

---

## Annexe A — lot M0b (voix HeyGen réelle), pour mémoire

Fichiers : `src/fournisseurs/heygen/voix.ts` (`listerVoixExistantes` : `GET /v3/voices?type=private` paginé, type de clone déduit de `available_engines` ; `lire` : `POST /v3/voices/speech`, `word_timestamps`, son copié aussitôt dans R2), `src/fournisseurs/index.ts` (inscrit `heygen` pour la voix), `src/services/personnages.ts` (`relierVoixExistante`), `src/components/personnages/OngletVoix.tsx` (« Relier ma voix HeyGen », écoute, `MINUTES_CONSEILLEES = 30` pour le seul secours ElevenLabs, curseurs masqués selon le fournisseur), `src/app/api/voix/ecoute/route.ts` (relais : aucun domaine HeyGen dans la CSP), `deploiement/docker-compose.yml` (`HEYGEN_API_KEY`, `FOURNISSEUR_VOIX`). Activation : `FOURNISSEUR_VOIX=heygen` + `HEYGEN_API_KEY`. Réglage `voix.choixWill` après le test d'écoute.

## Annexe B — ce que le lot M0 a livré (rappel)

Voir `docs/ARCHITECTURE.md` §11 et le commit du lot M0 : format avocat v2 (recette, `migrerReglages`, `migrerScript`, durée depuis le script, musique interdite, export, profil de rendu, recette de montage), mention IA facultative coupée par défaut (tous formats, 4 cases quand coupée, journal), tu / vous transmis à tous les générateurs, fusion fond → décor + accessoire, visages par angle, commande v2 (moteur figé), contrats des fournisseurs et du service de rendu, briques étendues, résultats du moteur appliqués, statut `annulee` + « Reprendre », tarifs en dollars convertis, profils de zones Instagram / Facebook / LinkedIn, migration de données idempotente au démarrage, 39 tests.

## Annexe C — rapport du lot M1 (2026-10-02)

**Livré** (aucun appel payant, rien de déployé ; tsc 0, eslint 0, vitest 283/283, `pnpm build` vert) :
- `src/moteurs/montage-avocat/` : `index.ts` (moteur, injection des fournisseurs), `report.ts`, `nettoyage.ts`, `decoupage.ts`, `empreinte.ts`, et leurs tests (`report`, `nettoyage`, `decoupage` : R1 à R13 + R1 bis, une règle = un test). Le calcul de la maquette est dans `index.ts` (`maquette()`), pas dans un fichier `maquette.ts` à part : il réutilise exactement les phases de la voix de la fabrication.
- `studio-rendu/src/operations/nettoyage-audio.ts` (modes `analyse` et `appliquer`) + `studio-rendu/src/audio/pcm.ts` (décodage FFmpeg, passage par zéro, fondu enchaîné centré à durée exacte, souffles 1-5 kHz).
- `tests/montage-avocat.contrat.test.ts` (`testerMoteurVideo` complet dont « Arrêter », file courte, 404 → même `idRendu`, échec passager / définitif, stockage non relié, « Réessayer » sans relire la voix, maquette → fabrication sans repayer, migration étape 8) ; `tests/montage-avocat-son.test.ts` (vrai fichier son).
- `src/components/creation/MaquetteNavigateur.tsx` (autonome, pour le lot M3) ; `src/domaine/notation-script.ts` (critères notés B.9 bis) ; `src/donnees/references-avocat.ts`.
- `outils/voix-essai/` (son de test fabriqué par la voix de synthèse de Windows), `outils/mesures/` (mesure des références), `outils/alignement/` (contrôle WhisperX, README).

**Fichiers figés touchés (ajouts purs, signalés)** : `domaine/types.ts` — `CommandeFabrication.audioMaitre?` en fin d'interface ; `services/migrations.ts` — **étape 8** ajoutée à la fin (accroches de référence) : l'étape « LUT » du lot M4 devient donc l'**étape 9** ; `RapportMigration.scriptsReferenceAjoutes?`. `services/fabrication.ts` (prévu par ce contrat) : `maquetteRapide` vérifie le budget AVANT la voix, applique les produits du moteur à la version maquette et renvoie en plus `versionId` et `audioUrl` ; `lancerFabrication` transmet l'audio maître de même empreinte.

**Contrat pour M0b** : le moteur envoie à `FournisseurVoix.lire` le texte DÉJÀ substitué et `prononciations: []` (une seule source de la correspondance, `report.ts`) ; la voix HeyGen ne doit pas substituer à nouveau. Le son renvoyé doit être une clé de stockage lisible par `urlLectureDuree` (copie R2).

**Mesures** (fiche de style mise à jour) : coupes, illustrations et débit des 7 références. Le débit (4,1-4,9 mots/s) confirme 4,4. **Écarts à trancher par Will**, défauts NON modifiés : plans de l'avocat de référence à 1,3-2,1 s (le plan vise 2,5-3,5 s), illustrations 1,2-1,7 s (règle 1,5-2,5 s), première coupe souvent à 2-3 s (règle < 2 s), parfois 2-3 illustrations à la suite.

**Reste** : contrôle de l'horodatage HeyGen sur la voix de Will (M0b, `outils/alignement/`) ; nettoyage sur un son de Will copié dans R2 (même code, dès que la clé et R2 existent) ; retouche réelle (opérations) aux lots M3/M4/M6 ; intégration de `MaquetteNavigateur` (M3) ; sous-titres groupés (M2, la brique actuelle est appelée avec l'horodatage réel).


## Annexe D — rapport du lot M4 (2026-10-02)

**Livré** (aucun appel payant, rien de déployé ; le commit du lot M4 porte aussi les livraisons M2 et M3, qui n'avaient pas été commitées) :
- `src/moteurs/montage-avocat/` : `scene.ts` (scène PURE partagée avec Remotion, sans alias `@/`), `composition.ts` (paramètres d'un format depuis la commande : LUT par plan plan > vidéo > visage > format et « aucune », décor hybride, encadré, incrustations, sous-titres sur décor clair, son, export), `montage.ts` (une demande `composition` par format, file longue, reprise 3 fois, 404 → même identifiant), `controles.ts` (contrôles sur le fichier EXPORTÉ), `metriques-inter.ts` (généré par `outils/composition/metriques-inter.py`). `index.ts` : montage / couleurs / son / export menés par `studio-rendu` quand il est réel (`STUDIO_RENDU_URL`), horloge simulée sinon ; `reexporter` (gratuit) et `recalquer` (gratuit) réels.
- `studio-rendu` : `compositions/avocat/` (calques image 1-5 « AvocatImage », calques texte 6 bis-8 « AvocatTexte », double d'essai simulé « DoubleEssai » en webm VP9 transparent, Inter Bold local), `src/operations/composition.ts` (son → Remotion image → FFmpeg LUT tétraédrique + vignette + grain luminance = `master-sans-texte` → Remotion texte PNG → export H.264 High 4.1 VBR 2 passes 14/16 Mb/s, GOP fermé, `+faststart`, BT.709 / tv / yuv420p, AAC 320 kb/s 48 kHz → mesures), `src/son/` (chaîne de la voix, ton de pièce bouclé, mesures `ebur128` crête vraie et pauses), `src/operations/mesure-son.ts`, `src/composition/` (graphes FFmpeg purs, entrées, serveur de fichiers local).
- LUT : `public/luts/` (4 `.cube` Axion Buffer de 65 points), `outils/lut/` (générateur, `qc.py`), `scripts/importer-luts.mjs`, `src/lib/qc-lut.ts` (contrôle à l'import), `src/donnees/luts-axion.ts`, migration **étape 10**, défaut selfie = Naturel, choix « Sans » dans Réglages.
- Décor par défaut de l'avocat : **N1 Halo orange** (`formats/avocat`, `stylesParDefaut.decor` et `profilRendu.decorId`).
- `src/services/recalque.ts` + bouton « Appliquer à la vidéo · gratuit » (nouvelle version, l'ancienne intacte) ; format ajouté affiché « gratuit ».
- Preuve : `outils/demo-m4/` et `docs/captures/m4-demo/` (vidéo 9:16, captures, `mesures.json`).

**Fichiers figés touchés (ajouts purs)** : `domaine/types.ts` — `Piste.ratio?`, `StylesResolus.lut.origine?`, `CommandeFabrication.medias?` + `MediaCommande` ; `moteurs/types.ts` — `ParentRetouche.pistes[].ratio?`, `reexporter({ parent?, segments? })` ; `fournisseurs/types.ts` — `validerCube` renvoie `avertissement?` ; `briques/sous-titres/scene.ts` — `DonneesCalque.facteurOmbre?`. **Modification non pure** : `moteurs/contrat.ts`, le coût d'un format ajouté peut être **nul** (`≥ 0`, B.9 « gratuit »).

**Mesures** (vidéo de démonstration de 15,6 s, poste Windows 12 fils, `STUDIO_RENDU_CONCURRENCE=2`) : sur le fichier exporté −14,1 LUFS, crête vraie −3,1 dBTP, pauses −43/−42 dB, BT.709 / tv / yuv420p, High 4.1, 14,1 Mb/s, `+faststart`, aucune image noire. Temps par format : 9:16 ≈ 3,5 min, 4:5 ≈ 3 min, 1:1 ≈ 2,5 min, dont 50-60 % pour les calques image (≈ 3 images/s ; le webm alpha 1080p seul : ≈ 4,5 images/s ; le liseré flouté par le navigateur divisait la vitesse par 4, il est maintenant net). **Extrapolé à 45 s : 7 à 12 min par format sur ce poste, davantage sur 2 processeurs → au-delà de 4 min : le lot M4b (Remotion Lambda) est déclenché**, décision consignée ; piste moins chère à arbitrer d'abord : composer les calques image dans FFmpeg (le navigateur ne garderait que les calques texte).

**Reste** : D2 (webm transparent RÉEL du double d'essai, bord du détourage, cadence) et M6 (pistes du visage transmises au montage, `pistesDouble`) ; validation des LUT, du grain et des captures par Will, puis envoi privé TikTok / Instagram (M7) ; M4b ou la piste FFmpeg ; Looks HeyGen (R1-R8) toujours simulés (repli N1 et alerte).


## Annexe E — rapport du lot M4b (2026-10-02) : les 3 défauts de la démonstration, et la fabrication accélérée

**Corrigé** (aucun appel payant, rien de déployé ; tsc 0, eslint 0, vitest, `pnpm build` vert ; nouvelle démonstration dans `docs/captures/m4-demo/`, l'ancienne gardée dans `docs/captures/m4-demo/v1/`) :
1. **Montant écrit deux fois** (« 2 500 € » en sous-titre et « + 2 500 € » incrusté en même temps) : pendant une incrustation de montant, le groupe de sous-titres qui dit ce montant (mêmes nombres, `montantDit`) est retiré de l'IMAGE (`masquerMontantsDits`, `composition.ts`) ; les `.srt` / `.vtt` gardent tout le texte. Preuve : `mesures.json` → `preuves.montantsEnDouble: []` dans les 3 formats ; capture `5-montant-incruste.jpg`.
2. **Ouverture chargée** (sous-titre et encadré qui se touchent) : l'encadré se place sous le bas RÉEL des sous-titres dessinés pendant ses 3 s (`basSousTitres` : taille de l'accent agrandi, contour, ombre, rebond, inclinaison), à 80 px au moins, et au-dessus de la zone protégée du bas (B.2). Pendant l'encadré, la ligne ne descend plus sur la poitrine ; si la place manque encore (accent ×1,8, format 1:1), la ligne des groupes de l'ouverture monte juste ce qu'il faut (`DonneesCalque.ouverture`, ajout pur dans `briques/sous-titres/scene.ts`), jamais au milieu d'un groupe. Preuve : écart mesuré 80 px en 9:16, 4:5 et 1:1 (`preuves.ecartPx`), test de non-chevauchement image par image sur les boîtes calculées ; capture `1-ouverture-encadre.jpg`.
3. **Micro** (rectangle gris flou coupé par le bord) : micro de studio DESSINÉ (`compositions/avocat/MicroPodcast.tsx` : mousse tournée vers la bouche, corps, étrier et molette, liseré orange, pied jusqu'au bas du cadre), du côté du regard, à hauteur du menton ; la capsule reste ENTIÈRE en plan large, poitrine 120 % et zoom lent, dans les 3 formats (test `contenuDans` sur `fenetreSource`). Flou ramené à 3 px. **Écarts à B.3 à confirmer par Will** : B.3 disait « coupé par le bord, x > 92 % » et « flou 6-10 px » ; réglables dans la Bibliothèque. Migration étape 11 : le micro du lot M0 est remplacé seulement si personne n'y a touché. Captures `2-plan-large.jpg`, `3-plan-poitrine-120.jpg`.
4. **Son AAC** : l'encodeur AAC de FFmpeg (libfdk_aac n'est pas distribuable) livre environ 240 kb/s sur une voix en double mono quelle que soit la consigne au-delà de 256 (le canal différence est vide). Consigne du format passée à **256 kb/s** (mesuré : 243 kb/s). Les plateformes réencodent vers 128 kb/s.

**M4b — fabrication accélérée, sans AWS** :
- **Calques image dans FFmpeg** (`studio-rendu/src/composition/image-ffmpeg.ts`, PUR et testé) : une seule passe décor → liseré → double (webm VP9 transparent, `libvpx-vp9`) → accessoire → recadrage du plan (Lanczos ; `zoompan` pour le zoom lent) → illustrations → LUT, vignette, grain → master. Chaque plan est un morceau d'images découpé par numéro d'image dans les pistes continues (les lèvres ne bougent pas d'une image). Décor (recadré et flouté) et accessoire (dessiné et flouté) préparés UNE fois ; images fixes et grain tirés à la demande dans le graphe (en entrées « -loop » / « lavfi », ils s'empilaient : 2,3 Go → 0,85 Go). Le navigateur ne dessine plus les calques image que pour le double SIMULÉ (silhouette), ou si `STUDIO_RENDU_IMAGE=navigateur`.
- **Calques texte : une image par état différent** (`texte-instants.ts`) : 69 images rendues au lieu de 389, rendu identique image pour image (test), en même temps que la passe image.
- **Export** : une passe CRF 17 plafonnée à 16 Mb/s (variante admise par B.7) au lieu de VBR 2 passes (`ParametresExport.mode` ; `STUDIO_RENDU_EXPORT=2-passes` pour revenir) ; préréglage `faster` (SSIM égal à `medium`, mesuré) ; master intermédiaire en `ultrafast` (3 fois moins de processeur). Débit mesuré 4,4 à 7,8 Mb/s sur le double simulé (peu de détails) ; plus haut sur une vraie vidéo.
- **Cœurs** : concurrence du navigateur = la moitié des cœurs du CONTENEUR (quota `cpu.max`), de 1 à 4 ; fils FFmpeg = cœurs du conteneur. **Compose : `cpus: 2` → `cpus: 6`** pour `studio-rendu` (toujours `cpu_shares: 256` et `nice` : le site garde la main).
- **Remotion Lambda** écrit et ÉTEINT : `studio-rendu/src/remotion-lambda.ts` (rendu des calques texte en ProRes 4444 transparent sur Lambda, suivi, téléchargement, coût relevé ; client injecté, paquet `@remotion/lambda` non installé), fournisseur `remotion-lambda` dans `fournisseurs/rendu/montage.ts` (capacités, environ 0,04 $ par minute et par format), inscrit seulement si `REMOTION_LAMBDA_ACTIVE=true` avec région, fonction, site et clés AWS. Aucun appel.

**Mesures** (démonstration 15,57 s, même poste i7-9750H 6 cœurs / 12 fils ; `mesures.json`, `mesures-coeurs.json`) :

| | 9:16 | 4:5 | 1:1 |
|---|---|---|---|
| Avant (M4, concurrence 2) | 210 s | 173 s | 147 s |
| Après (M4b, 12 fils) | **52,5 s** | **45,1 s** | **37,3 s** |

9:16 selon les fils donnés : 12 → 52,5 s ; 6 → 61,7 s ; 4 → 72,8 s ; 2 → 120,7 s. **Pour 45 s de vidéo : environ 2,5 min (12 fils), 3 min (6), 3,5 min (4), 6 min (2)** — seuil du plan : 4 min. **Estimation serveur** (8 vCPU partagés avec le site, `cpus: 6`, priorité basse) : **environ 3 à 3,5 min par format pour 45 s** quand le site est calme, davantage s'il est chargé (le rendu cède la place) ; avec l'ancien `cpus: 2`, environ 6 min. Mémoire FFmpeg (6 fils) : 0,85 Go (image), 1,1 Go (export), plus le navigateur du texte : sous les 3 Go du conteneur.

**Reste** : déploiement (session principale : image `studio-rendu` reconstruite, `cpus: 6` du compose) ; captures validées par Will (micro, encadré) ; D2 et M6 (vrai double HeyGen) : refaire la mesure de temps et le débit sur la vraie vidéo ; envoi privé TikTok / Instagram (M7).

## Annexe F — centralisation de la composition (2026-10-02)

La mise en image des lots M4 / M4b (`scene.ts`, `composition.ts`, `montage.ts`, `controles.ts`, `metriques-inter.ts` du moteur, `studio-rendu/compositions/avocat/`) est devenue la **brique commune `src/briques/composition/`** (+ `studio-rendu/compositions/commune/`), paramétrée par une recette ; le moteur avocat garde `recette-composition.ts` et des fichiers de liaison sous les anciens noms (tests et outils inchangés). Rendu identique octet pour octet : `docs/captures/m4-demo/centralisation-preuve.json`. Inventaire : `docs/ARCHITECTURE.md` §14. Lots suivants (A : M0b + prononciations ∥ M5 + Mes images ; B : décors réalistes ∥ veille) : **`docs/BRANCHEMENTS-EXECUTION.md`**, qui prime pour la répartition des fichiers.
