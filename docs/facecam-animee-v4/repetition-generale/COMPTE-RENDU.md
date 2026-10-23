# Face caméra v4 : branchement au réalisateur et répétition générale (17/10/2026)

## Corrections après avis de Will (17/10)

Will a vu la répétition (OK) et demandé 5 corrections + une décision (Certifexemple). Vidéo re-rendue (`video-complete.mp4`, 1080×1920 30 i/s, son, **34,2 Mo**, 82,7 s), planche contact 2 i/s refaite et regardée : **zéro Certifexemple, zéro turquoise, sous-titres jamais sur les yeux, aucun zoom, fond de la prise intact**. Un seul tour de rendu final (le 2ᵉ n'a pas été nécessaire). Plan toujours validé par `verifierPlan` via la chaîne réelle `realiser()` (version complète, 1 essai, 0 erreur) ; plan écrit par moi, pas par Opus (pas de clé Claude ici).

**1. Certifexemple interdit à l'écran.** Liste de mots interdits (Certifexemple, certifié / certifiée / certification, Villeexemple, « gain garanti ») appliquée aux plaquettes (refus **V8a** dans `verifierPlan`) et aux sous-titres (le groupe saute le mot, sans trou ; refus **V8b** si un plan en garde un ; filet de sécurité aussi dans `VideoAnimeeV4`). Une session parallèle avait poussé la même fonction sur la branche (commits 6e1cb9d, ba7dd79) : j'ai fusionné en gardant **sa** version (V8) et ajouté mes tests. Dans la vidéo, « grâce à Certifexemple » (à 61,7 s) s'affiche « grâce à ». Tests : `mots-interdits-ecran.test.ts` + 5 cas dans `regles-v4.test.ts`.

**2. Rythme.** Cartes plus courtes (fiches : 1,5 s mini), 38 plaquettes (au lieu de 35) à durées plus courtes, plus de lignes (checklist à 4 lignes…), et un **geste de vie visible sur TOUTES les plaquettes** (avant, seules celles du lot 1 en avaient) : un saut franc toutes les 13 images (saut de 12 à 22 px, inclinaison 1,2 à 2,2°, grossissement 3 à 6 % ; plein cadre : grossissement 4 % seul). Règle **H1 recalée** : les événements déclarés sont ceux du rendu (gestes inclus) et regroupés en salves de 4 images ; nouvelle règle **H1b** : aucun calme > 0,75 s. Constantes du geste testées égales entre le catalogue et le registre.
- Mesure sur le rendu (`mesurer-rendu.mjs`, rendu sans prise ni sous-titres, même chaîne avant et après) :

| | avant (ancien plan + ancien code) | après |
|---|---|---|
| Plus long calme | **2,07 s** (17 calmes > 0,5 s) | **0,43 s** (aucun > 0,5 s) |
| Densité, définition d'origine (salves séparées par ≥ 4 images calmes) | 1,83 /s | **1,14 /s** |
| Densité par pics de mouvement (`densitePics`, ajoutée au même outil) | 3,04 /s (pire fenêtre 5 s : 1,2) | **4,02 /s** (pire fenêtre : 1,8) |
| Déclaré par H1 (plan) | — | 3,53 /s, pire fenêtre 2,6 |

  **Honnêteté** : avec la définition d'origine, la densité *baisse* (1,14) alors que le rendu est plus vivant : combler les calmes soude les salves entre elles (un enchaînement continu ne compte que pour un événement). Cette définition mesure donc surtout les calmes ; j'ai ajouté le comptage par pics (chaque pastille, ligne ou saut qui arrive compte) et c'est lui que H1 suit désormais. **Non atteint à la lettre** : pire fenêtre de 5 s à 1,8 /s (5,4 s → 10,4 s : la mosaïque vidéo défile en continu, un seul pic) ; la moyenne 4,02 et le calme maximal 0,43 s respectent la cible.

**3. Fenêtres vidéo littérales** (clips de `communs/broll/`, un clip par chose dite) : **3 passages**.
- 8,2 → 10,5 s `MosaiqueVideos` « les devis, les relances **à la main**, les chiffres » : signature de devis, écriture à la main (tuile héroïne), frappe au clavier, devis signé.
- 29,5 → 31,4 s `duel-video` « un **outil** de plus / une **embauche** de plus » : homme à son ordinateur (noir et blanc) contre équipe en réunion.
- 49,2 → 51,5 s `MosaiqueVideos` « en **visio avec notre équipe** » : réunion d'équipe, ordinateur, ordinateur avec café, téléphone. *Littéralité moyenne* (la banque n'a pas de vraie visio ; le clip téléphone est le moins littéral).
Ailleurs, interface dessinée sobre (aucun clip sans phrase qui s'y prête : `AvantApres` non utilisé).

**4. Mots décor non dits remplacés** : jours LUN…DIM → 7 points ; « VS » (carte comparaison et duel) → éclair ; « EN COURS / FAIT » → sablier / coche ; compteur « 1/1 », « n/N » et « ✓ FAIT » de la checklist → coche ; initiale et « 1/1 » du profil → pictogramme personne ; carrousel : en-tête « AX / Axion-IA / · 1 j » et chiffres de page → pictogramme et formes ; fenêtre double (« NOUVEAU MESSAGE », « DEVIS.PDF »…) retirée du plan ; pastilles rangées (mots trop larges) retirées. Les composants gardent leurs textes par défaut pour les planches des lots.

**5. Sorties et bords.** Mesure directe sur le rendu (`mesurer-visage.ts` : rendu sur fond magenta, boîte du visage suivie avec la descente réelle) : **au plus 2 images d'affilée de visage à moitié couvert** (une seule suite de 2, à 31,3 s ; 19 suites d'une image), contre 5-6 avant. Corrections : dalle claquée qui sort en 3 images (12 %, 80 %, 100 %) ; la prise bouge dans la même image qu'une plaquette qui couvre ; bug trouvé : `descenteA` « téléportait » la prise quand une descente n'avait pas fini (6 images de visage coupé à 63,6 s), corrigé. `PileNotifications` sort en rétrécissant (plus de bulle coupée par le bord ; vérifié sur les images).

**Ce qui reste** : pire fenêtre de densité 1,8 /s (mosaïque) ; littéralité de la 2ᵉ mosaïque ; bruitages toujours non écoutés ; plan écrit à la main (appel réel à Opus jamais testé) ; `H1` suit une définition par pics que Will devra valider ; la fenêtre téléphone et les cartes montrent encore des mots dits mais pas toujours « littéraux ».

**Tests** : `npx vitest run` → 6 échecs, tous préexistants (`garde-ecran`, `garde-regle-unique` (EPS), `rendu-garde/garde`, `miniatures-serie`, `final-b-image-rendu-fichiers`, `tableau/formats/rendu-reel`) ; 28 tests v4 + les nouveaux passent. `npx tsc --noEmit` : les 4 erreurs de base (`RouteContext`, `LayoutProps`) ; la PR parallèle avait ajouté 4 erreurs `.ttf`, corrigées par `src/polices-ttf.d.ts`. Outils ajoutés : `mesurer-rendu.mjs` (parallèle), `mesurer-visage.ts`, `mesurer-densite.mjs` (pics). Rien n'est fusionné.

---


Branche `interface-claire/v4-branchement` (depuis `interface-claire/lot-c`, avec `interface-claire/lot-c-v3-integration` fusionnée sans conflit). Cette PR **remplace #295**. Rien n'est fusionné.

## Ce qui est fait
1. **Fusion** de la mécanique v3 (#295) dans la base v4 : zéro conflit, tout ce qui est v4 est gardé.
2. **Réalisateur branché sur le catalogue v4** (`src/moteurs/montage-facecam-animee/realisateur/`) :
   - `catalogue-v4.ts` : les **26** plaquettes `actif: true` (+ les 13 « en coulisse », refusées par la règle D0), emplacement (`tete`, `carte`, `fenetre`, `plein-cadre`, `bas`), gabarit, descente de la prise, visage entier / couvert, durées, événements, bruitages, nombre de textes / lignes / instants / vidéos. Les chiffres viennent des .tsx et du standard ; un test compare avec `motion-v4/catalogue-v4.ts`.
   - `regles-v4.ts` : les décisions fixes de Will V1 à V7 (visage entier ou couvert, tolérance **3 images acceptée / 4 refusée**, aucun zoom, rien sur le visage avant 5 s, plein cadre ≥ 8 s, pas de musique, sous-titres jamais sur les yeux, jamais deux fois de suite la même plaquette ni le même emplacement, coups de poing), rythme H1 (≥ 2,2 événements/s sur 5 s) et H2 (prise seule ≤ 0,5 s, ≤ 3 %), diversité, littéralité D15 (mots et chiffres dits, jamais « Villeexemple » / « gain garanti » / « Certifexemple » / « certifié »), calage de chaque ligne sur son mot dit.
   - `consignes.ts` : la consigne d'Opus porte maintenant le catalogue v4 (une ligne par plaquette), le rythme, les règles et la forme des champs ; `index.ts` : `elementsV4` dans la sortie du réalisateur et dans le plan (30 i/s, aucun bruitage d'écran de fin) ; `plan.ts` : `schemaElementV4`.
   - `verifierPlan` : un plan à `elementsV4` n'est jugé que par les règles v4.
3. **Rendu v4** (`studio-rendu/compositions/interface-claire/`) : `motion-v4/registre-v4.tsx` (id → composant Remotion, 26 ids, descente de la prise, position des sous-titres), `VideoAnimeeV4.tsx` (composition `InterfaceClaireFaceCameraV4`), `motion-v4/rendre-repetition.mjs`. Les sous-titres sont `SousTitresV4` des briques communes (1-2 mots, position recalculée à chaque image depuis la descente réelle, mot masqué quand une plaquette l'affiche déjà). Chaque `.tsx` des lots 1 à 3 commence par `import React` (la ligne a été remontée en tête, rien d'autre n'a changé).
4. **Transcription** : l'outil `@remotion/install-whisper-cpp` / whisper.cpp ne peut pas télécharger de modèle depuis cette session (huggingface.co et github.com refusés par le mandataire : 403). J'ai donc utilisé **la transcription déjà faite par le générateur sur cette prise** (faster-whisper, mots horodatés de la prise brute : `tests/fixtures/img7747-v2-montage-reel.json`), passée dans les **coupes réelles** (`calculerCoupes` : 30 intervalles gardés, 2 min 10 → 1 min 23) puis recalée sur la grille de 30 i/s. Écrite dans `transcription.json` (mots bruts, intervalles, mots montés avec l'orthographe du texte validé). Contrôle sur le son : 13 reprises de parole détectées dans la vidéo finale, écart médian avec le début du mot transcrit **0,09 s** (max 0,47 s, 4 sur 13 au-delà de 0,25 s : seuil de détection du silence, pas décalage).
5. **Tests** : `tests/facecam-animee/catalogue-v4.test.ts` et `regles-v4.test.ts` (28 tests) : 26 actifs, ids uniques, composant + `import React` + entrée du registre pour chaque id, géométrie du registre = fiches, bruitages existants, zéro turquoise dans `motion-v4/`, une règle = au moins un test, plan de la répétition validé par `verifierPlan`, `realiser` avec essai refusé puis corrigé.

## Répétition générale (de bout en bout, vrais fichiers)
- **Prise** : `prise-complete-IMG7747.mp4` (130,7 s) → coupes → `prise-montee.mp4` (82,67 s, 30 i/s, voix de Will).
- **Plan du réalisateur : écrit par moi, pas par Opus** (aucune clé Claude dans cette session), en suivant la consigne à la lettre, **mais passé dans la chaîne réelle** : `outils/facecam-animee-v4/plan-repetition.ts` appelle `realiser()` avec ce plan comme « réponse de Claude » ; lecture zod, `verifierPlan` et assemblage sont ceux de la production. Résultat : version complète, 1 essai, 0 erreur, 0 avertissement, 35 plaquettes.
- **Vidéo** : `video-complete.mp4`, H.264 1080×1920 30 i/s + AAC, **29,2 Mo**, 82,7 s. **Rendu : 440 s** (4 cœurs, Remotion, crf 18 puis ré-encodage ≤ 3,4 Mb/s). `planche-contact-2ips.jpg` (165 images à 2 i/s) ; je l'ai regardée image par image.
- **Tours** : tour 1 puis tour 2 (le maximum). Corrigé au tour 2 : mots décor non dits (« MA SEMAINE », « L'ÉQUIPE AU TRAVAIL », « AGENCE OU AGENTS », « RÉPONSES », « DEVIS / SIGNATURE / J'ACCEPTE » : les composants acceptent maintenant un en-tête dit, ou aucun), sous-titres qui restaient sous les pleins cadres (bug `null ?? "base"`), textes trop larges coupés (« UN PROBLÈME DE TRAVAIL », « PRIORITÉS CLAIRES », lignes de comparaison).

### Chiffres
| | |
|---|---|
| Plaquettes dans le plan | 35 (16 différentes) |
| Utilisation | CarteCalendrier 3, element-barre 3, PileNotifications 3, CarteChecklist 3, CarteStatuts 3, MotSaute 3, Interjection 3, dalle-claquee 3, EtiquetteTete 2, BadgeProfil 2, FenetreTelephone 2, CarteComparaison 1, rafale-trois-mots 1, Chrono 1, EclatChiffre 1, GraphiqueBarres 1 |
| Emplacements | tête 14, carte haute 11, plein cadre 5, bas 3, fenêtre 2 (aucune fois deux de suite le même) |
| Temps par gabarit | cartes 39,0 s, tête 23,9 s, bas 8,5 s, plein cadre 5,8 s, fenêtre 5,5 s ; visage couvert 11,3 s (13,7 %), premier plein cadre à 15,0 s |
| Prise seule | 0 s (aucun trou ; les plaquettes s'enchaînent) |
| Densité **déclarée** (événements des fiches + geste de vie toutes les 0,4 s) | 4,6 /s en moyenne, 3,2 /s au minimum sur 5 s |
| Densité **mesurée sur le rendu** (rendu sans prise ni sous-titres, une salve de changement = un événement, `outils/facecam-animee-v4/mesurer-densite.mjs`) | **1,75 /s** en moyenne, **0,6 /s** au pire sur 5 s (seuil 0,35) ; plus long calme 1,8 s |

## ⚠ Ce qui ne marche pas encore (honnêtement)
- **La densité mesurée est sous la cible (2,2 /s)** : les fiches annoncent 4,6 /s parce qu'elles comptent des gestes de vie (pulsations de quelques % qui ne se voient pas comme un « événement »). Les calmes de plus de 0,5 s sont les cartes qui attendent le mot suivant (calendrier à 13-14 s, comparaison à 29-31 s, checklist à 52-55 s, profil à 35-37 s). Pistes : durées plus courtes, plus de lignes par carte, gestes de vie plus marqués dans le lot 2, règle H1 recalée sur la mesure (le plan passe H1 sur les déclarations, pas sur le rendu).
- **Mots décor** encore codés en dur : jours LUN…DIM du calendrier, pastille « 1/1 » et initiale du profil, « EN COURS / FAIT » des statuts, « VS ». Non dits par Will ; à décider.
- **Littéralité partielle** : certaines plaquettes ne montrent qu'un mot-clé dit (étiquettes, interjections) faute de scène concrète ; `FenetreTelephone` montre un écran de signature dessiné (pas de devis dit à ce moment, texte retiré) ; aucune fenêtre vidéo (B-roll) n'est dans ce plan : `AvantApres`, `DuelVideo`, `MosaiqueVideos` n'ont pas été rendus avec de vraies vidéos littérales.
- **Sorties de dalle** : la dalle orange laisse le visage à moitié couvert quelques images à la sortie (la fiche déclare 2 images, tolérance de Will 3).
- **Texte « Certifexemple »** : jamais affiché par une plaquette (règle), mais Will le dit et les sous-titres l'écrivent. À confirmer.
- Une bulle de `PileNotifications` est coupée par le bord à sa sortie (25 s).
- Bruitages : présence vérifiée, pas écoutés par un humain.

## Pannes rencontrées et corrections
- Modèle Whisper non téléchargeable (403) → transcription du générateur + coupes réelles (voir plus haut).
- Dérive entre la grille 25 i/s des coupes et le rendu à 30 i/s → intervalles recalés sur 30 i/s, mots refaits sur ces intervalles (durée exacte 82,667 s).
- Codes R1 / R2 en collision avec les anciens R1 à R7 (tests existants) → rythme renommé **H1 / H2** (H9, H10).
- `illustre` limité à 60 caractères par le schéma → extraits exacts de la voix.
- Tests existants adaptés : la consigne du réalisateur n'est plus v3 (`catalogue-v3.test.ts`, le catalogue v3 reste dans le code).

## `npx vitest run` et `npx tsc --noEmit` (base = `interface-claire/lot-c` + #295, avant mes changements)
- Base : **7 échecs préexistants** (`e2e-verif1-bc-serie` ×2 selon le passage, `garde-ecran`, `garde-regle-unique` (EPS défini 4 fois), `rendu-garde/garde`, `miniatures-serie` (Miniature.tsx / master), `final-b-image-rendu-fichiers` (plan.ts, Frise.tsx)) ; `tsc` : 4 erreurs (`RouteContext`, `LayoutProps`), `studio-rendu` : 2 erreurs (`findLast`).
- Après (mon dernier passage complet) : **6 échecs, tous préexistants** : `garde-ecran`, `garde-regle-unique` (EPS), `rendu-garde/garde`, `miniatures-serie`, `final-b-image-rendu-fichiers` (plan.ts, Frise.tsx), plus `tableau/formats/rendu-reel` (« NetworkError » : le test veut du réseau, absent du premier passage de la base par hasard de timing). Les 2 échecs `e2e-verif1-bc-serie` de la base sont passés cette fois (instables). **Aucun nouvel échec** : 3 tests existants que j'avais cassés (collision des codes R1/R2, consigne v3) sont corrigés. 7 075 tests passent.
- `tsc --noEmit` : les 4 mêmes erreurs de base (`RouteContext`, `LayoutProps`), aucune nouvelle ; `studio-rendu` : 2 erreurs de base (`findLast`), aucune nouvelle.

## Ce qui reste avant de brancher au studio (Lot I)
1. Version simple (règles fixes, sans Claude) encore à l'ancien catalogue : à refaire en v4 ou à remplacer par un plan v4 minimal.
2. Le service de rendu du studio doit lancer la composition `InterfaceClaireFaceCameraV4` (une seule vidéo « prise + plan »), fournir la prise montée à 30 i/s, les polices (Montserrat Black, Inter Bold, Montserrat 900 woff2), `sons/` (+ 3 bruitages maison du lot 5), `broll/` et `marque/` ; `rendre-repetition.mjs` montre l'assemblage.
3. Banque B-roll réelle (fenêtres vidéo littérales), historique D13 v4, recalage de H1 sur la mesure du rendu, écoute des bruitages, test des 4 fonds sur le plan complet.
4. Appel réel à Opus avec la consigne v4 (jamais testé ici).
