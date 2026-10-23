# Intensité, bruitages, crédits, voix par format, calage — contrat d'exécution

> Écrit par l'architecte le 2026-10-02, après les lots A et B (`docs/BRANCHEMENTS-EXECUTION.md`).
> Mission de Will (02/10) : « lance l'intensité, les bruitages, les crédits et clés, la voix par format, le calage des
> sous-titres et l'aperçu rapide en autopilote ».
> **Ce document PRIME pour la répartition des fichiers.** Les consignes priment pour le fond :
> `INTENSITE-ET-BRUITAGES.md`, `CREDITS-ET-CLES.md` (section « 00. Ce qui EXISTE déjà »), `PLAN-MOTEUR-AVOCAT.md`
> (B.5 calage, B.0 §5 voix), dans `Axion-IA/<dossier-de-plan-prive>/`. Centralisation : `docs/ARCHITECTURE.md` §14
> (tout ce qui suit est une **brique commune paramétrée par la recette du format**, jamais un code propre à l'avocat).

Trois développeurs **en parallèle**, fichiers **DISJOINTS**, partant du commit de l'architecte (qui contient déjà
l'aperçu rapide et toutes les interfaces ci-dessous) :

| Dév. | Contenu |
|---|---|
| **D1** | **chef d'orchestre de l'intensité** + **bruitages modernes** (bibliothèque, placement, mixage, réglages, Aperçu) |
| **D2** | **crédits et clés** (soldes, pré-vol, réservations, attente de crédit, alertes, Réglages > Crédits, carte Accueil) + **voix par format** |
| **D3** | **calage des sous-titres au mot près** (WhisperX sur processeur, conteneur `studio-aligneur`, report sur le texte validé, écart < 40 ms) |

---

## 0. Règles communes (reprises de `BRANCHEMENTS-EXECUTION.md` §0, plus celles-ci)

1. **Clés réelles** : `<fichier de secrets local>`. Ne jamais les afficher, ni les écrire dans un fichier du
   dépôt, ni les commiter, ni les journaliser (masquées) : elles se chargent dans l'environnement du processus d'essai
   seulement. **Pas de clé Anthropic** : Claude reste simulé.
2. **Appels réels : seulement pour prouver le lot, plafonds stricts** (total de la mission : **≤ 0,50 $ de voix**,
   **aucune vidéo d'avatar**, **aucun appel payant fal.ai**). **Tout appel HeyGen en v3** (v1 et v2 s'arrêtent le 31/10/2026).

   | Dév. | Autorisé | Interdit |
   |---|---|---|
   | D1 | rien de payant (sons libres de droits téléchargés à la main, licence notée) | toute génération de son payante |
   | D2 | HeyGen `GET /v3/users/me` (solde, gratuit, déjà lu par l'architecte : 29,83 $, `tests/fixtures/credits-heygen-users-me.json`) et `GET /v3/voices` (gratuit) | tout appel payant ; toute clé ADMIN (Anthropic, fal.ai) |
   | D3 | HeyGen `POST /v3/voices/speech` sur 5 phrases courtes de la voix de Will, **≤ 0,50 $** | toute vidéo d'avatar |

   Chaque appel payant est noté dans le rapport (point d'accès, coût relevé). **Tous les tests passent sans aucune clé.**
3. **Rien n'est jamais effacé** (on archive, on versionne). **Français, vouvoiement**, très peu de texte, aucun mot
   interdit (job, render, prompt, token, API, upload, pipeline, workflow, mock, fictif, dashboard, avatar). **Mobile
   d'abord** (390 px), jetons de couleur, composants `@/components/ui`. Captures à 390 px de chaque écran livré
   (`scripts/captures.mjs`, `E2E_MDP='…'` en ligne de commande seulement).
4. **Mention IA** : une mention ou étiquette IA ne devient **jamais** obligatoire ; n'en parlez dans aucun texte affiché
   hors de son interrupteur existant.
5. **Démonstration M4** (`outils/demo-m4/rendre-demo.mts`) : elle doit rester **identique** (empreintes framemd5, même
   méthode que `docs/captures/b1-decors/demo-m4-inchangee.json`), sauf effet **VOULU** de l'intensité ou des bruitages ;
   dans ce cas l'écart est documenté (avant / après, pourquoi) et une **nouvelle** démonstration est faite (l'ancienne
   gardée dans `docs/captures/m4-demo/v2/`). Seul D1 peut produire un tel écart ; D2 et D3 prouvent l'identité.
6. **Fin de lot** : `pnpm exec tsc --noEmit` = 0, `(cd studio-rendu && npx tsc -p tsconfig.json --noEmit)` = 0 si touché,
   `pnpm exec eslint .` = 0 erreur 0 avertissement, `pnpm exec vitest run` vert, `pnpm build` vert (dans un autre dossier :
   `NEXT_DIST_DIR=.next-d1` etc., pour ne pas casser un serveur lancé sur `.next` ; remettre `tsconfig.json` ensuite, le
   build y ajoute ce dossier) ; commit en français (dernière ligne `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`)
   puis `git push`. **Aucun déploiement** : la session principale déploie.
7. On n'arrête que ses propres processus, par PID. On ne touche pas au serveur de production.
8. **Un fichier = un propriétaire.** Besoin d'un fichier d'un autre développeur : on ne le modifie pas, on crée un fichier
   à soi ou on écrit la demande dans le rapport. Les fichiers « figés » (§2) ne changent que par **ajout pur facultatif
   en fin d'interface**, signalé dans le rapport.
9. Tests dans des fichiers à son nom : `tests/d1-*.test.ts`, `tests/d2-*.test.ts`, `tests/d3-*.test.ts` (ou à côté du
   code, dans ses dossiers). `tests/lot-icc-interfaces.test.ts` (architecte) reste vert du début à la fin.

---

## 1. Aperçu rapide — FAIT par l'architecte (02/10)

**Problème** : l'aperçu du plateau (écran « Votre vidéo ») téléchargeait le `.cube` 65³ (7,4 Mo de texte, 275 000 lignes),
le lisait et le réduisait à 33³ dans le navigateur à chaque ouverture : 0,6 à 0,9 s sur un poste normal, 3,3 à 4,0 s sur
une machine chargée ; le contrôle « plateau composé en moins d'1 s » échouait de temps en temps.

**Fait** (rendu final inchangé : il garde le `.cube` 65³) :
- `public/luts/apercu/<nom>.33.bin` : copie d'aperçu **33³ binaire 8 bits** de chaque LUT livrée (107 819 octets au lieu
  de 7 414 981, ×69 plus léger). C'est **exactement** la texture que le navigateur fabriquait déjà (écart 0 sur les 4 LUT).
  Fabriquée par `outils/lut/apercus.mts`, gardée à jour par `tests/apercu-lut.test.ts` (empreinte identique à ce que
  l'outil produirait, `.cube` 65³ intact, adresse, copie cassée refusée).
- `src/lib/lut3d.ts` : `encoderLutApercu`, `lireLutApercu`, `urlApercuLut` (une LUT importée par Will, lue dans R2, n'a pas
  de copie : l'aperçu lit son `.cube` comme avant ; copie absente ou illisible → `.cube`).
- `src/components/creation/ApercuPlateau.tsx` : copie d'aperçu d'abord ; images décodées d'avance ; programme WebGL2
  compilé une fois par contexte ; **composition immédiate** quand tout est déjà chargé ; `prechargerApercuPlateau`.
- `src/assistant/etapes/Express.tsx` : la LUT et les images du plateau se chargent dès l'ouverture de l'écran.

**Preuve** (`outils/apercu-lut/mesurer.mjs`, serveur de production local, iPhone 13 à 390 px, cache vidé à chaque essai,
7 essais par série ; `docs/captures/apercu-lut-avant.json` et `apercu-lut-apres.json`) :

| Série | Avant (médiane / max) | Après (médiane / max) |
|---|---|---|
| Processeur normal, « Plateau » touché dès que le bouton paraît (le contrôle e2e) | 726 / 938 ms | **142 / 222 ms** |
| Processeur ralenti ×4 (« machine chargée »), touché dès que le bouton paraît (pire cas : la page s'anime encore) | 3 767 / 3 968 ms | **864 / 1 027 ms** |
| Processeur ralenti ×4, touché 2 s après l'ouverture de l'écran | 3 756 / 4 018 ms | **186 / 276 ms** |
| Fichier de LUT téléchargé | 7 414 981 octets | **107 819 octets** |

Le contrôle e2e (`tests/e2e/parcours.spec.ts`, « moins d'une seconde à 390 px ») a désormais une marge de ×4,5 sur un
poste normal, et passe aussi processeur ralenti ×4 dès que l'écran a fini de s'ouvrir. Reste au pire cas ×4 (toucher
« Plateau » pendant l'animation d'ouverture de la page) : 1 essai sur 7 à 1,03 s, le temps étant alors celui de la page
elle-même, plus celui de la LUT.

---

## 2. Interfaces FIGÉES par l'architecte (déjà dans le code, commit de ce document)

| Fichier | Ce qui est posé (ne pas renommer, ne pas changer de forme) | Pour |
|---|---|---|
| `src/domaine/types.ts` | `NiveauIntensite` (= `IntensiteSousTitres`), `ReglageBruitages` (`discrets` · `aucun`), `DeclencheurBruitage` (`chiffre` · `document` · `telephone` · `illustration-forte` · `impact`), `ChoixBruitagePlan`, `BruitageDisponible`, `RapportIntensite` ; `StylesChoisis.intensite/bruitages` ; `Plan.bruitage` (et `PlanCommande`) ; `ValeurElement` bruitage `.declencheur/variante/ecoute/sonieLufs` ; `CommandeFabrication.intensite/bruitagesDisponibles` ; `VersionVideo.rapportIntensite` ; `CodeAlerteQualite` + `intensite` | D1 |
| | `ModeSolde`, `RechargeCredit`, `ReservationCredit`, `ReleveSolde` ; `TypeNotification` + `credit` ; `RepriseTravail.motif/fournisseurCredit` (« en attente de crédit ») ; `Video.lancementEnAttente` ; `Personnage.voixParFormat` | D2 |
| | `RapportAlignement` | D3 |
| `src/domaine/depots.ts`, `donnees/memoire/index.ts`, `donnees/postgres/index.ts` | collections `recharges`, `reservations`, `relevesSoldes` (mémoire et Postgres) | D2 |
| `src/formats/types.ts` | `ProfilRendu.intensite/bruitages` (défauts du format ; l'avocat les reçoit de D1 : Équilibré, « discrets ») | D1 |
| `src/briques/intensite/types.ts` | `TypeEffet`, `POIDS_EFFETS`, `PLAFOND_PAR_NIVEAU`, `REGLES_INTENSITE`, `PrioriteEffet`, `DemandeEffet`, `DecisionEffet`, `OptionsOrchestration`, `ResultatOrchestration`, **signature `OrchestrerIntensite`** ; `BruitagePlace`, `REGLES_BRUITAGES` | D1 (propriétaire, la remplit) |
| `src/briques/intensite/reglage.ts` | `reglageIntensite(styles, profil)` : vidéo > ancien choix des sous-titres > format > Équilibré ; bruitages : vidéo > format > aucun. **Appelé par `construireCommande`** (l'intensité des sous-titres EST maintenant ce réglage global, mêmes valeurs qu'avant tant que rien n'est choisi) | D1 |
| `src/briques/composition/scene.ts` | `ParametresSon.bruitages?: { entree, debutSec, gainDb, passeHautHz }[]` | D1 (la seule à modifier la brique composition dans ce lot) |
| `src/moteurs/types.ts` | `ResultatFabrication.rapportIntensite` — **déjà recopié** sur la version par `services/travaux.ts` | D1 |
| `src/services/bruitages.ts` | `bruitagesDeLaCommande(reglage, formatId)` : les sons `ecoute: "validee"` avec un déclencheur, si « discrets » ; **appelé par `construireCommande`**, leurs fichiers ajoutés à `commande.medias` | D1 (propriétaire) |
| `src/services/credits.ts` | **`verifierBudgetEtCredits(estimation, confirme, quoi)`** (remplace `verifierBudget` aux **4 appels existants** de `services/fabrication.ts` : lancement, maquette, retouche, format ajouté — avec les LIGNES par fournisseur, plus le seul total) ; `controlerCredits(lignes)` (vide, D2) ; `reserverCredits({ videoId, travailId, lignes })` (**appelé** après le lancement) ; `libererReservation(travailId, issue)` ; `MARGE_CREDITS = 0,2` | D2 (propriétaire, remplit les corps) |
| `src/domaine/voix-format.ts` | `voixPourFormat(voix, personnage, formatId, choixVideo?)` : vidéo > format > défaut du personnage > première prête (seul point de résolution) | D2 (propriétaire) |
| `src/fournisseurs/types.ts` | `TypeFournisseur` + `alignement` ; `DemandeAlignement`, `ResultatAlignement`, `EtatAlignement`, `FournisseurAlignement` (soumettre / suivre, comme `studio-rendu`) | D3 |
| | `LectureSolde`, `TestConnexion` (4 derniers caractères de la clé, jamais plus), `LecteurCredit` (mode, page de recharge, variable de la clé, `lireSolde?`, `testerConnexion`) | D2 |
| `src/fournisseurs/index.ts` | `alignement: { simulation, ...aligneurReel() }` ; le registre ne se touche plus | — |
| `src/fournisseurs/simulation/alignement.ts` | calage simulé (renvoie l'horodatage de la voix, écart 0) | — |
| `src/fournisseurs/aligneur/inscription.ts` | `aligneurReel()` (vide) → `{ "studio-aligneur": … }` si `STUDIO_ALIGNEUR_URL` | D3 (propriétaire, la remplit) |
| `src/moteurs/montage-avocat/index.ts` | phases `a-aligner` → `alignement` → `a-analyser` (seulement si l'aligneur n'est PAS la simulation : démonstration et tests identiques) ; 3 essais puis horodatage de la voix gardé (jamais une vidéo bloquée) ; reprise après panne = calage relancé, son ni relu ni repayé ; `AudioMaitre.alignement` ; `deps.alignement` (tests) | D1 seul y touche ensuite (intensité, bruitages) ; D3 passe par `alignement.ts` |
| `src/moteurs/montage-avocat/alignement.ts` | `idAlignement`, `demandeAlignement`, `appliquerAlignement(voix, resultat, dureeSec)`, `ESSAIS_ALIGNEMENT` | D3 (propriétaire, affine les garde-fous) |
| `src/services/migrations.ts` | étapes **16 à 18** réservées, une par fichier : `migrations/etape-16-bruitages.ts` (D1), `etape-17-credits.ts` (D2), `etape-18-calage.ts` (D3) ; résumé dans `rapport.lots[nom]` | D1, D2, D3 |
| `deploiement/docker-compose.yml`, `deploiement/env.exemple` | variables du service `studio` : `STUDIO_ALIGNEUR_URL`, `FOURNISSEUR_ALIGNEMENT`, `ELEVENLABS_API_KEY` (et déjà `HEYGEN_API_KEY`, `FAL_KEY`, `ANTHROPIC_API_KEY`) | D3 seul ajoute le service `studio-aligneur` |
| `src/components/notifications/ClocheNotifications.tsx` | style de la notification `credit` | — |
| `src/components/reglages/Connexions.tsx` | icône du type `alignement` (rien d'autre : le reste est à D2) | D2 |

Restent figés : tout ce que `BRANCHEMENTS-EXECUTION.md` §1 et `MOTEUR-AVOCAT-EXECUTION.md` §1 figent. **`next.config.ts`
(CSP) n'est touché par personne.** `services/fabrication.ts` **n'est touché par personne** (tout y est déjà branché).

---

## 3. Propriété des fichiers (D1 ∥ D2 ∥ D3, DISJOINTS)

| | **D1 — intensité + bruitages** | **D2 — crédits et clés + voix par format** | **D3 — calage WhisperX** |
|---|---|---|---|
| Briques / domaine (purs) | `src/briques/intensite/**` (`orchestrateur.ts`, `bruitages.ts` : placement, variantes sans répétition, mixage), `src/briques/sous-titres/melange.ts` (Impact / Bandeau consultent l'orchestrateur), `src/briques/composition/**` (son : `parametres.ts` remplit `son.bruitages` ; `controles.ts` : alerte `intensite`) | `src/domaine/credits.ts` (nouveau : solde disponible, « ≈ N vidéos restantes » sur les 10 dernières, jauge verte / orange < 25 % / rouge < 10 % ou < 1 vidéo, seuils 50 / 25 / 10 %, rapprochement > 10 %, expiration à 30 jours), `src/domaine/voix-format.ts` | `src/moteurs/montage-avocat/alignement.ts` |
| Moteur avocat | `src/moteurs/montage-avocat/index.ts`, `decoupage.ts`, `recette-composition.ts`, `montage.ts` | — | — |
| Formats, données | `src/formats/**` (avocat : Équilibré, « discrets »), `src/donnees/bruitages.ts` (nouveau : la banque soignée, licence par fichier, `ecoute: "a_verifier"`), `public/bruitages/**` (nouveau) | — | — |
| Fournisseurs | — | `src/fournisseurs/credits/**` (nouveau : `heygen.ts` `GET /v3/users/me`, `elevenlabs.ts` `GET /v1/user/subscription`, `fal.ts` et `anthropic.ts` en « suivi », `index.ts` registre des lecteurs, masquage des clés) | `src/fournisseurs/aligneur/**` (client HTTP de `studio-aligneur`, `inscription.ts`) |
| Services | `src/services/bruitages.ts`, `src/services/recalque.ts` (« retirer / ajouter le son » : ne refait QUE le mixage, gratuit), `src/services/migrations/etape-16-bruitages.ts` | `src/services/credits.ts`, `src/services/couts.ts`, `src/services/travaux.ts` (`quota` → « en attente de crédit », libération des réservations, aucun appel payé en double), `src/services/boucle.ts` (reprise après recharge, brouillons « lancer dès que possible », rapprochement quotidien), `src/services/notifications.ts`, `src/services/personnages.ts`, `src/services/reglages.ts`, `src/services/migrations/etape-17-credits.ts` | `src/services/migrations/etape-18-calage.ts` |
| Écrans | `src/assistant/etapes/Reglages.tsx` (tuile Style : intensité globale, bruitages Discrets / Aucun), `src/assistant/etapes/Apercu.tsx` (petite courbe d'intensité sous la bande de plans, « retirer / ajouter le son » par plan), `src/app/(studio)/nouvelle/[format]/actions.ts`, `src/components/videos/fiche/OngletsLecture.tsx` (son par plan après fabrication), `src/components/bibliotheque/**` + `src/app/(studio)/bibliotheque/**` (écoute et validation des bruitages) | `src/components/reglages/**` (Connexions : « Tester la connexion », 4 derniers caractères, dernière utilisation ; **Crédits** juste après ; Budget gardé tel quel, dans cet ordre), `src/app/(studio)/reglages/**`, `src/app/(studio)/page.tsx` + `src/app/(studio)/_accueil/CarteCredits.tsx` (nouveau), `src/assistant/etapes/Express.tsx` (feuille « Crédit HeyGen insuffisant » : Recharger · Version économique · Garder en brouillon + « lancer dès que possible »), `src/app/(studio)/nouvelle/[format]/actions-credits.ts` (nouveau), `src/components/personnages/OngletVoix.tsx` (format → voix), `src/app/(studio)/personnages/**`, `src/app/(studio)/nouvelle/[format]/page.tsx`, `src/assistant/etapes/Distribution.tsx`, `src/assistant/express/logique.ts` (`voixInitiale` → `voixPourFormat`) | `src/components/videos/fiche/OngletSousTitres.tsx` seulement si un affichage du calage l'exige |
| `studio-rendu` | `studio-rendu/src/son/**`, `studio-rendu/src/composition/**` (mixage des bruitages : 18-24 dB sous la voix, passe-haut 120 Hz, aucune remontée) | — | — |
| Conteneur, déploiement | — | — | `studio-aligneur/**` (nouveau : Python 3.11, WhisperX + wav2vec2 français **préchargé à la construction**, processeur seul, une demande à la fois, même clé partagée `STUDIO_RENDU_CLE`), `deploiement/studio-aligneur/Dockerfile`, `deploiement/docker-compose.yml` (service `studio-aligneur`, réseau `interne`, `mem_limit` ≤ 2,5 g, `cpus` 2), `deploiement/mettre-a-jour.sh`, `outils/alignement/**` |
| Tests | `tests/d1-*.test.ts` | `tests/d2-*.test.ts` | `tests/d3-*.test.ts` |

Personne ne touche : `src/services/fabrication.ts`, `src/domaine/types.ts` (figé : ajouts purs signalés seulement),
`src/fournisseurs/types.ts`, `src/fournisseurs/index.ts`, `src/services/migrations.ts`, `next.config.ts`,
`src/lib/lut3d.ts`, `src/components/creation/ApercuPlateau.tsx`, `public/luts/**`, `tests/lot-icc-interfaces.test.ts`,
`tests/apercu-lut.test.ts`.

---

## 4. D1 — chef d'orchestre de l'intensité + bruitages modernes

**Orchestrateur** (`briques/intensite/orchestrateur.ts`, signature `OrchestrerIntensite`) : courbe d'intensité UNIQUE après
le découpage ; poids, plafond par fenêtre glissante de 3 s (Sobre 3 · Équilibré 5 · Très dynamique 7), au plus un effet
fort (poids ≥ 2) à la fois, respiration 1,5 s après un fort, priorité accroche (0-2 s) et relances, un choix verrouillé
passe toujours. Branché dans le moteur avocat **par la brique** : `decoupage.ts` (coupes, poitrine, zoom lent,
illustrations, second angle), `melange.ts` (Impact, Bandeau, souligné), incrustations, bruitages — chacun DEMANDE, l'orchestrateur
décide. Le réglage Sobre / Équilibré / Très dynamique devient le réglage GLOBAL (tuile Style ; défaut du format). Sortie :
`ResultatFabrication.rapportIntensite` (déjà recopié sur la version), petite courbe sous la bande de plans à l'Aperçu,
alerte qualité `intensite` si le plafond est dépassé.

**Bruitages** : banque soignée (`donnees/bruitages.ts`, `public/bruitages/`), libre de droits pour un usage commercial,
**licence enregistrée par fichier**, 3 à 5 variantes par son, sonie normalisée à l'import, **`ecoute: "a_verifier"`
jusqu'à l'écoute de Will** (écran d'écoute et de validation dans la Bibliothèque). Interdits : whoosh à chaque coupe,
« ding » à chaque mot, caisse enregistreuse, sons de mèmes, machine à écrire, dessin animé, sonneries de marque.
Déclencheurs, durées et mixage : `REGLES_BRUITAGES` (18-24 dB sous la voix, passe-haut 120 Hz, jamais pendant le mot clé,
au plus 1 toutes les 10 s, jamais sur la même coupe qu'un zoom — l'orchestrateur arbitre —, aucun dans la dernière seconde).
Activation : par format (avocat : « discrets »), par vidéo (Discrets / Aucun), par plan (`Plan.bruitage`) à l'Aperçu ou
après fabrication : **ne refait que le mixage** (gratuit, immédiat, `services/recalque.ts`).

**Critères de fin**
- Test : sur **20 scripts**, aucune fenêtre de 3 s au-dessus du plafond, aucun effet fort simultané, respiration respectée,
  verrouillé jamais déplacé (pour les 3 niveaux).
- Test : avec « Aucun », la piste de bruitages est vide et la **sonie de la voix est inchangée** (mesure `mesure-son`).
- Test : un son `a_verifier` n'est jamais posé ; variantes sans répétition consécutive ; mixage dans les bornes.
- Démonstration M4 : identique tant qu'aucun son n'est validé ; si l'orchestrateur change le montage de la démonstration,
  écart documenté et nouvelle démonstration (règle 0.5).
- **Test d'écoute avant / après** sur le script « 35 heures dans Excel » (vidéo locale, 0 €), fichiers dans
  `docs/captures/d1-bruitages/`, prêts à être envoyés à Will.
- Captures 390 px : tuile Style, courbe de l'Aperçu, son par plan, écran d'écoute des bruitages.

## 5. D2 — crédits et clés + voix par format

**S'appuyer sur l'existant** (consigne « 00 ») : `budget.mensuel`, alerte 80 %, tableau des coûts **gardés tels quels** ;
`verifierBudgetEtCredits` est **déjà** appelé aux 4 endroits ; une seule chaîne `estimer → verifierBudgetEtCredits →
reserverCredits → coût réel`, et **un seul endroit** dans Réglages : **Connexions → Crédits → Budget**.
- Lecteurs de solde (`fournisseurs/credits/**`) : HeyGen **réel** (`GET /v3/users/me`, `data.wallet.remaining_balance` en
  dollars), ElevenLabs réel (`GET /v1/user/subscription`, si `ELEVENLABS_API_KEY`), fal.ai et Anthropic **suivis** (somme
  des coûts réels depuis la dernière recharge déclarée ; aucune clé ADMIN). « Tester la connexion » : statut, **4 derniers
  caractères** de la clé, dernière utilisation ; la clé n'est jamais renvoyée au navigateur, jamais journalisée.
- **Pré-vol bloquant** (`controlerCredits`) : par fournisseur, solde − réservations actives ≥ estimation × 1,2 ; un seul
  insuffisant → la vidéo ne part pas, **rien n'est appelé chez les autres** ; erreur `CREDIT_INSUFFISANT` avec un message
  clair ; feuille « Crédit HeyGen insuffisant » (Recharger · Version économique si elle suffit · Garder en brouillon +
  « lancer dès que possible » → `Video.lancementEnAttente`).
- **Réservations** (`reservations`), libérées à la fin, à l'échec définitif ou à « Arrêter » (`services/travaux.ts`).
- **Pendant la fabrication** : erreur `quota` d'un fournisseur → `RepriseTravail.motif = "credit"` (« en attente de
  crédit »), rien de perdu ni de repayé, notification `credit` immédiate ; **reprise automatique** dans l'ordre après une
  recharge (déclarée ou lue).
- **Alertes** : 50 % · 25 % (cloche) · 10 % et « plus qu'une vidéo » (cloche + e-mail) ; rapprochement quotidien (écart
  > 10 % = « dépense inexpliquée ») ; expiration fal.ai à 30 jours ; clé refusée = alerte rouge et fabrications
  dépendantes bloquées.
- Écrans : Réglages > **Crédits** (une carte par fournisseur payant : solde étiqueté « réel » avec l'heure ou « suivi »,
  consommé ce mois, plafond, « ≈ N vidéos restantes », jauge, Recharger, J'ai rechargé), carte Crédits sur l'Accueil.
- **Voix par format** : dans la fiche personnage (onglet Voix), une liste « format → voix » (`Personnage.voixParFormat`),
  modifiable ensuite vidéo par vidéo ; `voixPourFormat` partout où une voix initiale est choisie. Will va enregistrer une
  voix « avocat » rapide : elle doit pouvoir devenir la voix du format avocat en deux touches.

**Critères de fin**
- Tests (consigne §7) : un solde insuffisant chez UN fournisseur bloque la vidéo et rien n'est appelé chez les autres ;
  deux vidéos simultanées dont la somme dépasse le solde → la seconde attend ; « crédit insuffisant » au milieu → étape en
  attente, reprise après recharge, **aucun appel payé en double** ; **une clé n'apparaît dans aucun journal, aucune
  réponse, aucun écran** (recherche de motif dans les sorties de test).
- Lecture réelle HeyGen (gratuite) consignée ; tests sur la réponse enregistrée `tests/fixtures/credits-heygen-users-me.json`.
- Voix par format : test de résolution + parcours (fiche personnage → nouvelle vidéo avocat → bonne voix choisie).
- Démonstration M4 identique (empreintes) ; captures 390 px : Connexions, Crédits, feuille « crédit insuffisant », carte
  Accueil, voix par format.

## 6. D3 — calage des sous-titres au mot près (WhisperX, processeur seul)

Mesuré : l'horodatage HeyGen est imprécis de **190 à 270 ms** (au-delà du seuil de 80 ms de `outils/alignement/README.md`) :
le conteneur **`studio-aligneur`** est donc construit (plan B.5). Le moteur est **déjà** branché (§2) : D3 livre le
conteneur, le client, et affine `alignement.ts`.
- `studio-aligneur/` : serveur HTTP Python (même protocole que `studio-rendu` : `POST` une demande, `GET` son état, 404 →
  soumise à nouveau ; clé partagée `STUDIO_RENDU_CLE`), WhisperX en **alignement forcé sur le texte connu** (aucune
  transcription), modèle wav2vec2 français **téléchargé à la construction de l'image** (aucun téléchargement au premier
  appel), processeur seul, une demande à la fois, son lu par adresse signée, fichiers temporaires effacés après chaque
  demande. Image ≤ 3 Go si possible ; mémoire ≤ 2,5 Go.
- `fournisseurs/aligneur/**` : client, `aligneurReel()`, activation `FOURNISSEUR_ALIGNEMENT=studio-aligneur`.
- `alignement.ts` : garde-fous (même nombre de mots ; mots dans l'ordre et dans la durée ; un mot non aligné garde
  l'horodatage voisin) ; **report sur le texte validé** par `report.ts` (inchangé : il reçoit des mots justes).
- Réglages > Connexions affiche « Calage des sous-titres » (simulation / relié) sans rien ajouter d'autre.

**Critères de fin**
- **Seuil < 40 ms** d'écart moyen, prouvé deux fois : (1) sur `tests/fixtures/voix-essai.wav` contre ses débuts de mots
  connus (`voix-essai.debuts.json`) ; (2) sur **5 phrases réelles** de la voix HeyGen de Will (≤ 0,50 $, dont « Un bon PV,
  puis un pépin », un montant, un nom propre), contre une référence indépendante (début des mots qui suivent une pause,
  détecté dans le son) — et l'écart HeyGen brut mesuré sur les mêmes phrases (attendu 190-270 ms). Résultats dans
  `docs/captures/d3-calage/`.
- Tests sans conteneur (réponses enregistrées) : calage appliqué avant le nettoyage, panne → 3 essais puis voix gardée,
  404 → même identifiant resoumis, résultat incohérent refusé.
- Démonstration M4 identique (le calage est sauté en simulation) ; aucun conteneur ni modèle dans l'image du studio.

---

## 7. Rapport attendu (une annexe par développeur, à la fin de ce document)

Livré (fichiers), essais réels faits (point d'accès, coût relevé), fichiers figés touchés (ajouts purs), écarts aux
consignes à trancher par Will, ce qui reste. Puis commit + push ; le déploiement est fait ensuite par la session principale.

---

## Annexe D2 — crédits et clés + voix par format (02/10, terminé après la reprise)

**Livré**
- Domaine : `src/domaine/credits.ts` (solde suivi, pré-vol estimation × 1,2, jauge verte / orange < 25 % / rouge < 10 % ou
  < 1 vidéo, « ≈ N vidéos » sur les 10 dernières, alertes 50 / 25 / 10 % et « plus qu'une vidéo », rapprochement > 10 %,
  rappel d'expiration fal.ai 30 jours avant, clés réduites aux 4 derniers caractères) ; `src/domaine/voix-format.ts`.
- Lecteurs : `src/fournisseurs/credits/` — `heygen.ts` (réel, `GET /v3/users/me`), `elevenlabs.ts` (réel,
  `GET /v1/user/subscription`), `suivis.ts` (fal.ai et Claude : soldes suivis, aucune clé ADMIN), `commun.ts`, `index.ts`.
- Services : `credits.ts` (corps de `controlerCredits`, `reserverCredits`, `libererReservation`, recharge déclarée ou lue,
  surveillance quotidienne, brouillons « lancer dès que possible »), `travaux.ts` (`quota` → « en attente de crédit »,
  réservations libérées à la fin / à l'échec / à « Arrêter »), `boucle.ts`, `notifications.ts`, `personnages.ts`,
  `videos.ts`, `vues.ts`, `migrations/etape-17-credits.ts`.
- Écrans : Réglages (Connexions → **Crédits** → Budget, dans cet ordre, « Tester la connexion »), carte Crédits de
  l'Accueil (`_accueil/CarteCredits.tsx`), feuille « Crédit HeyGen insuffisant » (`Express.tsx`, `actions-credits.ts` :
  Recharger · Version économique si elle suffit · Garder en brouillon + « lancer dès que possible »), voix par format
  (`OngletVoix.tsx`, `personnages/actions.ts`, `nouvelle/[format]/page.tsx`, `Distribution.tsx`, `express/logique.ts`,
  `services/videos.ts` : `voixPourFormat` partout).
- `verifierBudgetEtCredits` est appelé aux **4** endroits de `services/fabrication.ts` (lancement, maquette, retouche,
  format ajouté), le budget du mois toujours contrôlé en premier, à l'identique.

**Preuves** — `tests/d2-credits.test.ts` (30 tests) et `tests/d2-voix-format.test.ts` (3), verts :
un fournisseur insuffisant bloque la vidéo avant tout appel payant, Claude jamais appelé ; deux vidéos simultanées → la
seconde est refusée sans travail ni réservation, puis part après « Arrêter » de la première ; crédit épuisé au milieu →
étape « en attente de crédit », notification immédiate, jamais d'échec à 24 h, reprise après recharge **déclarée** et
(ajouté à la reprise) après recharge **lue** au rapprochement, voix payée une seule fois ; recherche de motif : la clé
n'apparaît dans aucune réponse, aucun écran (Connexions, Crédits), notification, journal, paramètre, relevé ni sortie
console ; résolution voix par format + parcours fiche personnage → nouvelle vidéo avocat.
Captures 390 px : `docs/captures/d2-credits/` (Connexions, Crédits, feuille « crédit insuffisant », carte Accueil, voix
par format ×4). Démonstration M4 identique : `docs/captures/d2-credits/demo-m4-inchangee.json` (aucun fichier D2 dans
les 61 fichiers exécutés par la démonstration).

**Essais réels** : `GET /v3/users/me` HeyGen (gratuit) — solde 29,83 $, clé acceptée (« …29Z0 »),
`docs/captures/d2-credits/lecture-heygen-reelle.json`. Aucun appel payant, aucune clé ADMIN.

**Fichiers hors colonne touchés (ajouts purs)** : `src/briques/index.ts` — la ligne estimée « Voix » porte le
fournisseur de la voix choisie (« heygen » pour une voix reliée) au lieu de « simulation », pour que le pré-vol contrôle
et réserve le bon crédit ; prix estimé inchangé.

**À trancher par Will** : rien.

**Reste** : rien côté D2. Le solde ElevenLabs ne s'affiche qu'une fois `ELEVENLABS_API_KEY` posée en production.

---

## Annexe D3 — calage des sous-titres au mot près (02/10, terminé après la reprise)

**Livré**
- `studio-aligneur/` : serveur HTTP Python (même protocole que `studio-rendu` : `POST /alignements`, `GET` l'état, 404 →
  resoumis ; clé partagée `STUDIO_RENDU_CLE`), alignement forcé sur le texte connu (modèle wav2vec2 français de WhisperX,
  aucune transcription), processeur seul, une demande à la fois, fichiers temporaires effacés ; tests Python
  `studio-aligneur/tests` (18, verts).
- `deploiement/studio-aligneur/Dockerfile` (modèle téléchargé à la construction, tests lancés pendant la construction),
  service `studio-aligneur` du compose (réseau `interne`, `mem_limit: 2500m`, `cpus: 2`, priorité basse) sous le
  **profil `calage`** : ni construit ni démarré tant que `STUDIO_ALIGNEUR_URL` n'est pas dans le `.env` du serveur
  (`deploiement/mettre-a-jour.sh` l'active de lui-même).
- `src/fournisseurs/aligneur/client.ts` + `inscription.ts` ; `src/moteurs/montage-avocat/alignement.ts` (même nombre de
  mots, ordre et durée respectés, mot non aligné → horodatage voisin, autre texte / autre son refusé).
- Outils : `outils/alignement/` (étalon, `mesurer_calage.py`, `phrase-heygen.mts` 6 à 9, `.gitignore` des caches Python).

**Preuves** — `tests/d3-calage.test.ts` (19, verts, sans conteneur) : calage appliqué avant le nettoyage ; panne →
3 essais puis voix gardée, la vidéo continue ; 404 → même identifiant resoumis ; résultat incohérent refusé sans nouvel
essai. Mesures (`docs/captures/d3-calage/mesures.json`, lecture simple dans `LISEZ-MOI.md`) : voix d'essai contre les
débuts exacts **22,8 ms** ; voix HeyGen de Will, 9 phrases, 17 mots mesurables : **39,1 ms** (seuil < 40 ms tenu, de
justesse). Mémoire max 1,6 Go. Démonstration M4 identique : `demo-m4-inchangee.json` (aucun fichier D3 parmi les 61
exécutés par la démonstration).

**Essais réels** : `POST /v3/voices/speech` × 4 (phrases 6 à 9), **0,11 $** relevés sur le solde (29,83 → 29,72 $).
Aucune vidéo, rien chez fal.ai.

**À trancher par Will — constat important** : sur les mêmes 17 mots, **HeyGen tel quel fait mieux (20,3 ms) que le
calage (39,1 ms)** ; les débuts de mots des deux s'accordent à 22 ms sur 138 mots. Le « 190-270 ms » du lot M0b venait
de la règle de mesure (seuil à −35 dB qui prenait le souffle de la voix pour le mot), pas de HeyGen. Recommandation :
**laisser le calage coupé pour la voix HeyGen** (réglage par défaut, rien à faire), le garder prêt pour une voix sans
horodatage fiable (voix du tournage, autre voix de synthèse).

**Reste** : l'image n'a pas été construite sur ce poste (Docker absent) : taille réelle non mesurée ; elle se construira
sur le serveur le jour où `STUDIO_ALIGNEUR_URL` sera posée.

## Annexe D1 — intensité + bruitages (02/10, terminé après la reprise)

**Livré** : chef d'orchestre `src/briques/intensite/orchestrateur.ts` (courbe unique, plafond par fenêtre de 3 s,
un seul effet fort, respiration 1,5 s, verrouillé jamais déplacé) branché par la brique (`decoupage.ts`, `melange.ts`,
incrustations, bruitages) ; `briques/intensite/bruitages.ts` (placement, variantes sans répétition, mixage) ;
banque `src/donnees/bruitages.ts` + `public/bruitages/` (5 sons × 4 variantes) ; mixage `studio-rendu/src/son/bruitages.ts`
(−21 dB sous la voix, passe-haut 120 Hz, voix jamais touchée) ; `services/intensite.ts`, `services/bruitages.ts`,
`services/recalque.ts` (« retirer / ajouter le son » après fabrication = remixage seul, gratuit) ; migration
`etape-16-bruitages.ts` ; écrans : tuile Style (intensité globale, Discrets / Aucun), courbe + son par plan,
son par plan dans la fiche vidéo (`SonsDesPlans.tsx`), écoute et validation des sons (Bibliothèque > Bruitages).

**Correction faite à la reprise** : le format avocat n'a pas d'étape « Aperçu » (seulement « Votre vidéo ») ; la courbe et
le son par plan n'y étaient donc visibles nulle part. Ils sont maintenant dans la feuille « Coût » de « Votre vidéo »
(`src/assistant/etapes/Apercu.tsx`, version compacte : courbe, numéros des plans, choix du son du plan).

**Sons** : créés par le studio par synthèse (`outils/bruitages/fabriquer.mts`), **CC0 1.0**, usage commercial permis, licence
écrite sur chaque élément et dans `public/bruitages/manifeste.json`. Tous **« à vérifier »** : aucun n'est posé dans une
vraie vidéo tant que Will ne les a pas écoutés et validés (Bibliothèque > Bruitages).

**Preuves**
- Tests `tests/d1-orchestrateur.test.ts` (20 scripts × 3 niveaux), `tests/d1-bruitages.test.ts` (banque, variantes, mixage ;
  avec FFmpeg : « Aucun » = son identique octet pour octet, sons posés = sonie de la voix inchangée ±0,2 LU, 18-24 dB sous
  la voix), `tests/d1-moteur.test.ts` (son « à vérifier » jamais posé, « Aucun », remixage seul) : 34 verts.
- Démonstration M4 **identique** (empreintes 0302e1a08c99 / 4cfe49eac70c / c6b1aa0e3fe5, son 1a829a7c2541) :
  `docs/captures/d1-bruitages/demo-m4-inchangee.json`. Pas de `m4-demo/v2/` : rien n'a été remplacé.
- Démonstration « avec intensité et sons » (sons traités comme validés), à part : `docs/captures/d1-bruitages/demo-m4-v3/`
  (vidéo, captures, `ecart-avec-la-demo-d-avant.json` : 1 son posé à 21 dB sous la voix, sonie −14,1 → −14,1 LUFS).
- Écoute avant / après « 35 heures dans Excel » (0 €) : `35h-avant.m4a`, `35h-apres.m4a`, `35h-bruitages-seuls-remontes.m4a`,
  `35h-rapport.json` (3 sons, tous à 21 dB sous la voix, sonie de la voix inchangée).
- Captures 390 px : `tuile-style-intensite-390.png`, `apercu-courbe-intensite-390.png`, `apercu-son-du-plan-390.png`,
  `ecoute-bruitages-390.png` (outil `outils/intensite/captures-d1.mjs`).

**Essais réels** : aucun appel payant.

**Fichiers figés touchés (ajouts purs)** : `src/domaine/types.ts` (`remixage` d'une demande de composition, `depots.master`),
`src/briques/composition/scene.ts` (commentaire de `gainDb`, `decalageSens`, `decalageSec` d'une incrustation),
`src/briques/intensite/types.ts` et `index.ts` (exports).

**À trancher par Will**
1. Dans la démonstration v3, sur le plan « économisé 2 500 € », le chef d'orchestre retire **l'incrustation du montant et
   l'accent Impact** (respiration après l'illustration, plafond atteint). C'est la règle appliquée à la lettre, mais c'est
   le chiffre clé : faut-il qu'un montant passe toujours en priorité ?
2. Les sons sont synthétisés (pas de banque téléchargée) : à l'écoute, Will dit s'ils conviennent ou s'il faut en prendre
   ailleurs.

**Reste** : l'écoute et la validation des 20 sons par Will. Les anciens sons « Autres sons » de la Bibliothèque (dont un
« Ding ») ne sont jamais posés automatiquement (ils n'ont pas de déclencheur).
