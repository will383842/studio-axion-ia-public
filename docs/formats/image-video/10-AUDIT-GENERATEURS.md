# 10 · Audit de tous les générateurs vidéo du studio (14/10/2026, soir)

**Chef audit** de l'équipe « Image → vidéo ». L'audit a été fait en lecture seule sur `origin/master` **769aedae** (fusion de la PR #203, 14/10 à 21 h 31) du dépôt `studio-axion-ia`, sur la branche `origin/interface-claire/lot-c` (fc4c3272, non fusionnée) et sur les sources locales de la v4.
- Rien n'a été exécuté : ni rendu, ni test, ni build, ni dépense.
- Cet audit met à jour celui du matin (`<dossier-de-plan-prive>\`, sur 454e789). Les constats ont été revérifiés dans le code ; les plus lourds ont été relus par le chef audit.
- Chemins : sauf mention contraire, ils sont relatifs au dépôt `studio-axion-ia`, et les lignes sont celles d'`origin/master` actuel.
- Notes : « — » veut dire sans objet. « NON VÉRIFIÉ » veut dire non constaté (aucune image regardée depuis les correctifs).

---

## 0. Tableau récapitulatif

| Générateur (code) | État réel | Script | Fidélité script→vidéo | Motion vs v4 | Son (voix + bruitages) | Réseaux | Contrôles auto | Évolution depuis le matin |
|---|---|---|---|---|---|---|---|---|
| **v4 faite à la main** (hors dépôt) | Vidéo unique, chaîne manuelle | 8 | 9 | **9** (référence) | 7 | 5 | 3 | — |
| **Cas concret** (CC, motion design) | Fusionné, **masqué** au menu | **8** | 6 | 6 (NON VÉRIFIÉ à l'image) | 4 | 5 | 5 | Fidélité **3 → 6** (script validé rejoué mot pour mot) |
| **Tableau animé** (TB) | **En ligne**, gabarit clair par défaut | 6 | 5,5 | 4,5 | 4,5 | **7** | 6 | Visuel corrigé (« parfait » pour Will sur v-b19aefb21d57) |
| **Face caméra animée** (FA) | Lots A-B sur master (masqué, moteur refuse tout lancement réel), lots C-D sur branche, E-J à faire | 6 | 7 (plan) | 6 | 6 (sons absents du dépôt) | 2 | 6 (plan seulement) | Nouveau |
| **Face caméra** (FC) | En ligne, « terminé » le 11/10 | 4 | 6 | 4 | 5 | 2 | 6 | **Aucun commit** depuis le matin |
| **Avocat** (AV, avatar HeyGen) | Actif, mais moteur « simulation » par défaut, aucune vraie production | 6 | 6 | 3 | 6 | 6 | 5 | Contrôle de ressemblance de voix v4 branché (#178) |
| **Générateur de scripts « 14 étapes »** + chaîne courte + socle | En ligne (sert l'avocat, la face caméra et les autres formats) | 6 | — | 1 | — | 8 | 7 | Socle de Will (#187), chaîne courte et banc (#191) |
| **Motion design « MO »** | Statut « bientôt », **aucun moteur** | 3 | — | 2 | 0 | 3 | — | Inchangé |
| Écran partagé, UGC, Créateur B, podcast, selfie | « Bientôt » ou masqué, moteur « simulation » | — | — | — | — | — | — | Inchangé (coquilles) |
| Pub face caméra (un créateur de référence) | Plan seulement | — | — | — | — | — | — | Inchangé |

**Les 5 constats majeurs**
1. **Aucun générateur ne transforme une image en vidéo.** MO est une coquille, et aucun moteur ne lit une image pour en faire des écrans. En revanche, **80 % des briques existent** : la grammaire v4 portée en Remotion (cas concret), la bibliothèque d'animations « interface claire » et le réalisateur Opus à plan contrôlé (FA), les sorties par réseau (tableau), les fins (banque), la voix et le socle d'écriture.
2. **Le cas concret a fait le plus gros progrès** : le script validé est rejoué mot pour mot (A1 corrigé). En revanche, **ses bruitages ne sont jamais posés** (réglage « aucun » par défaut). Le tableau (gabarit clair) n'en a pas non plus, et ceux du FA ne sont pas dans le dépôt. Or les bruitages sont **obligatoires** pour Will.
3. **Aucun format n'écoute la vidéo finie** : pas de transcription comparée au script, et pas de relecture par l'image, sauf en face caméra. La garde « dernière phrase dite en entier » du cas concret peut toujours **se sauter en silence** (`fabriquer.ts:684`).
4. **Le rythme reste loin de la v4.** La v4 change toutes les ~1,6-2,4 s. Les seuils codés sont de 4 s (tableau `regles.ts:62`, FA `regles.ts:27-42`) et de 6 à 10 s (monteur face caméra `role.ts:109`). Seul le cas concret impose ~2 s (R06). Anton n'est utilisé que par le cas concret.
5. **Adaptation par réseau inégale, et deux règles contradictoires sur LinkedIn.**
   - Le tableau fait une vraie mise en page par format. Le cas concret ne change que la fin et n'a **pas YouTube Shorts**. FA et FC sont identiques partout.
   - LinkedIn : la base 7 dit « rien n'est dit dans une vidéo LinkedIn ». Pourtant, le cas concret fait dire « Faites votre diagnostic gratuit… Le lien est en premier commentaire » (`formats/cas-concret/index.ts:70` → `briques/fins/banque.ts:236,240`). Will doit trancher.

---

## 1. Ce qui a changé depuis l'audit du matin (vérifié dans le code)

| Sujet du matin | État au soir | Preuve |
|---|---|---|
| Cas concret : Claude réécrit le script à chaque fabrication (A1) | **CORRIGÉ**. Le script validé est rejoué sans Claude. Sans script validé, la chaîne s'arrête sur « relisez puis validez ». Will peut modifier la phrase dite et les textes (#202) | `montage-cas-concret/fabriquer.ts:462-512`, `script-valide.ts:63`, `modifier-script.ts`, `services/cas-concret-scripts.ts:32` |
| Cas concret : phrase reformulée pendant la voix (A2) | **CORRIGÉ** pour un script validé. Une hésitation (« euh ») déclenche une lecture neuve HeyGen `force_regenerate` (#197) | `montage-cas-concret/voix.ts:356-375` |
| Cas concret : coupes dans les blancs inopérantes sur MP3 (G2) | **PARTIEL**. Le son brut est copié en WAV (#200), mais si la copie échoue, on revient au MP3 sans le signaler | `fabriquer.ts:611-639`, `:628` |
| Cas concret : garde de fin qui se saute en silence (G1) | **TOUJOURS LÀ** | `fabriquer.ts:684` (`if (!son \|\| !dernier) continue;`), `:349-356` |
| Cas concret : aucune transcription contre le script (G3) | **TOUJOURS LÀ**. L'aligneur réel (#186) force le texte, il ne le vérifie pas | grep `whisper\|transcri` vide dans `montage-cas-concret` |
| Cas concret : sous-titres illisibles sur ivoire | **PARTIEL**. Couleur #15100c sans ombre (#198), Inter 60 px, mais toujours vers 87 % de la hauteur | `fabriquer.ts:228-238`, `formats/cas-concret/index.ts:24-32` |
| Cas concret : double appel final | **CORRIGÉ** (une seule demande par fin) | `formats/cas-concret/index.ts:66-71` |
| Cas concret : socle d'écriture | **NOUVEAU** (#203) : charte, style, preuves, ton v4 W01-W09 | `services/socle-will.ts`, `cas-concret-branchements.ts:318-331` |
| Tableau : pages blanches, moitié basse vide | **CORRIGÉ** par le gabarit clair (#182, #185, #194) : titres 90/72/54 px, page remplie à 85-90 %, page trop chargée réparée | `montage-tableau/gabarit.ts`, `mise-en-page-gabarit.ts`, `briques/tableau-scene/reference/charte.ts:157-215` |
| Tableau : texte écrit réécrit sans contrôle (T1) | **PARTIEL**. La phrase clé et les détails doivent reprendre ≥ 50 % des mots dits et tous les chiffres ; le titre et l'avant/après ne sont pas contrôlés | `gabarit.ts:305-315` |
| Tableau : règle « mot pour mot » tautologique en fabrication (T2) | **TOUJOURS LÀ** | `montage-tableau/index.ts:344`, `services/tableau-creation.ts:1133` |
| Tableau : verdict « bloque » qui ne lit que la 1ʳᵉ sortie | **TOUJOURS LÀ** | `fabriquer.ts:901`, `index.ts:663` |
| Avocat : ressemblance de voix non branchée | **CORRIGÉ** (#178), actif par défaut, 2 relances au plus | `briques/voix-maitre/reference.ts`, `services/voix-ressemblance.ts:3`, `montage-avocat/index.ts:602-634` |
| Face caméra : écran partagé, sous-titres gris et bas, pas de version par réseau | **INCHANGÉ** (aucun commit) | `montage-facecam/habillage.ts:215`, `briques/sous-titres/style.ts:60`, `formats/facecam/index.ts:39` |
| Générateur : pas de grammaire visuelle | **INCHANGÉ**. La chaîne courte retire même `intentionIllustration` | `generateur/chaine-courte.ts:114` |

---

## 2. Fiches

### 2.1 v4 faite à la main (référence de qualité)
- **À quoi elle sert** : la vidéo « On recrute en 15 minutes » que Will juge parfaite, fabriquée hors du studio.
- **État** : une vidéo, plus des déclinaisons v5 à v10. Sources dans `Axion-IA\<dossier-de-plan-prive>\sources\` ; état final de publication dans `PUBLIER.md`.

**Chaîne de fabrication**
1. **Script** écrit à la main : avant → coût → bascule → étapes → résultat → appel.
2. **Voix** HeyGen : clone `77ea2dbe…`, moteur starfish, vitesse 1,1, un seul appel (`voix4.mjs:7,27`). Les blancs sont resserrés à 0,10/0,13/0,20 s, puis la voix est accélérée de 8 % (`v4.html:213`).
3. **Visuels** : une page HTML de 1080×1920, un plan par bloc, l'image entière calculée en fonction du temps (`compo\v4.html:247-333`). Les vrais écrans du site sont photographiés (`tournage.mjs`).
4. **Montage** : rendu image par image dans Chrome à 30 images/s (`rendu.mjs`), puis ffmpeg.
5. **Sous-titres** : lots de 5 mots ou 24 signes, mots forts en orange, Inter 42 px à 1600 px de haut (`v4.html:235-242`).
6. **Bruitages** : 20 sons calés sur les événements (`v4.html:224-233`) : un « illustration-forte » par plan, « impact » sur 7 mots, « document », « téléphone », « chiffre », rafales de tics. Pas de musique.
7. **Fins** : une par réseau à partir de la v6.
8. **Contrôles** : seulement les mots introuvables (`v4.html:341`).

**Ce qui la rend excellente**
- Anton en capitales et Inter Bold.
- Palette : #110A05, #C2532A, #F0703C, #F4EFE7, vert #22A55B.
- Deux fonds qui alternent.
- Entrée mot par mot : montée de 60 px avec flou.
- Objets de biais en 3D toujours en mouvement.
- Puces qui rebondissent avec une coche, onde orange au doigt, particules sur les fonds sombres.
- Éclair orange sur 3 moments forts.
- 17 plans d'environ 2,4 s, **chacun calé sur un mot dit** (`q(mot, n, avance)`, l.217).
- Fil d'étapes orange.

**Défauts**
- Voix coupée net dans « machine » à 39,7 s.
- Sous-titres et écrans hors des zones sûres (83 % de la hauteur).
- Presque aucun contrôle.
- Le texte dépend du temps : tout est à recalculer si la voix change.

**Réutilisable** : presque tout est déjà porté dans `studio-rendu/compositions/cas-concret/` (inventaire `docs/formats/v4-reference/INVENTAIRE.md`). La capture d'écrans réels n'est pas portée, mais c'est sans objet pour une infographie.

### 2.2 Cas concret (CC) : motion design d'une automatisation
- **À quoi il sert** : à partir d'un cas du catalogue, il fabrique une vidéo verticale 9:16 de 40 à 60 s, sans visage, façon v4, avec un fichier par groupe de fins.
- **État** : tout est fusionné, mais le format est `statut: "masque"` (`formats/cas-concret/index.ts:103`). Un seul cas a un script validé, « recrutement-apporteurs » (`script-valide.ts:44-46`).

**Chaîne de fabrication** (`montage-cas-concret/fabriquer.ts`)
1. **Script** : script validé rejoué, sinon Claude écrit avec le socle de Will et la chaîne s'arrête pour validation (`:462-512`).
2. **Relecture** : règles R02 à R23, bloquantes (`:497-514`). R06 impose un changement toutes les ~2 s, R07 l'alternance des fonds (`regles.ts:486`), R10 interdit « machine » (`ecriture.ts:200`).
3. **Visuels** : capture du site et image du cas (`captures.ts`, `visuels-du-cas.ts`).
4. **Voix** : HeyGen, relecture neuve si hésitation, aligneur réel, coupes dans les blancs mesurés sur WAV, tempo ×1,08 (`:571-690`).
5. **Calage au mot** : `calage.ts`.
6. **Écrans** : propriétés contrôlées (`:735`), rendu Remotion écran par écran (`studio-rendu/compositions/cas-concret/` : 12 types d'écran, 19 objets, fonds `socle/Fond.tsx`, `FilEtapes.tsx`, `Eclair.tsx`, `Biais.tsx`, `plans/commun.ts`).
7. **Sous-titres** : charte duo (`:228-238`).
8. **Bruitages** : `bruitages.ts` (voir défauts).
9. **Fins** : `fins.ts` (`planDesFins`), avec texte du post, premier commentaire et lien suivi (`publication.ts`).
10. **Contrôles** : `controles.ts` et `defauts-visuels.ts`.

**Notes**
- **Script 8** : verrouillé, modifiable et nourri par le socle de Will.
- **Fidélité 6** : le texte dit est bien le texte validé, mais les heures restent calculées et rien n'écoute le son final.
- **Motion 6** : la grammaire v4 est portée presque à l'identique, mais NON VÉRIFIÉ à l'image depuis les essais « catastrophiques ».
- **Son 4** : voix très bien traitée, mais zéro bruitage.
- **Réseaux 5** : seuls la fin et les textes changent, pas de Shorts.
- **Contrôles 5** : contrôles sur la mise en page théorique, pas sur les images rendues.

**Défauts précis**
- **Bruitages jamais posés.**
  - La vidéo est créée avec `styles: {}` (`services/creation-format.ts:47`) et le format n'a pas de profil de rendu.
  - Le réglage vaut donc « aucun » (`briques/intensite/reglage.ts:17`), et `bruitagesDeLaCommande` rend `[]` (`services/bruitages.ts:21`).
  - Le moteur `montage-cas-concret/bruitages.ts` existe mais ne reçoit rien.
- **Garde de fin** : saut silencieux (`fabriquer.ts:684`, `:349-356`).
- **Garde « fin de voix » circulaire** : elle compare l'heure **calculée** du dernier mot (`fabriquer.ts:879-881`) ; la voix est ensuite coupée à la durée vidéo (`studio-rendu/src/son/chaine.ts:223`).
- **Recalage dans les blancs** : retour au MP3 sans le signaler (`fabriquer.ts:628`).
- **Réseaux** : YouTube Shorts absent (`formats/cas-concret/index.ts:51`).
- **LinkedIn dit un appel** (`index.ts:70`, `banque.ts:236,240`), contraire à la base 7 (`banque.ts:82-88`).
- **Validation tracée** : des phrases de l'Usine sont marquées `par: "will"` (`banque.ts:201`).
- **Sous-titres** à ~87 % de la hauteur, sous l'interface de 4 réseaux sur 5 (écart assumé).
- **Défauts visuels seulement indicatifs** : texte sur texte, téléphone vide, objet sous les sous-titres (`defauts-visuels.ts:10`).
- **Onglet Sous-titres** : il ne montre que la 1ʳᵉ fin (`fabriquer.ts:925`).

**Réutilisable** : c'est **le socle du futur moteur image → vidéo**.
- Grammaire d'écrans : `src/briques/ecrans-motion/` (types, `geometrie.ts`, `controlerProprietes`, `zonesEcran`).
- Compositions v4 : `studio-rendu/compositions/cas-concret/`. `TelephoneCapture` sait déjà poser une image fournie.
- Script : verrouillé avec `script-valide.ts` et `modifier-script.ts`, écran `ValidationScript.tsx`, règles `regles.ts`.
- Écriture : `ecriture.ts` et `EXEMPLE_TON_V4`.
- Voix : `voix.ts`, `recette-voix.ts`, `fin-de-voix.ts` ; corriger d'abord le saut silencieux et le retour au MP3.
- Calage : `calage.ts`.
- Fins et liens par réseau : `fins.ts`, `publication.ts`, `mots-branches.ts`.
- Bruitages : `bruitages.ts` (6 sortes calées sur la v4), en mettant le réglage sur « discrets ».

### 2.3 Tableau animé (TB)
- **À quoi il sert** : une voix HeyGen explique une chose simple pendant qu'un crayon écrit et dessine sur une page claire. Il n'y a pas de visage.
- **État** : en ligne. Le style par défaut est le « gabarit clair » (`formats/tableau-anime/index.ts:101`) : titre de 1 à 3 mots souligné, pastille numérotée écrite au mot, phrase clé, détails, dessin, avant/après, page « À retenir ».
  - Visuel jugé « parfait » par Will (v-b19aefb21d57, 14/10).
  - Branche `tableau/timbre-voix` fermée sans fusion.
  - `docs/formats/tableau-anime.md` est périmé.

**Chaîne de fabrication**
1. **Script** : `services/tableau-scripts/` (3 passes Opus, socle de Will).
2. **Découpage en scènes** : `decoupage.ts` ; 18 règles dans `regles.ts:1002-1019`.
3. **Voix** : `voix-tableau.ts`, `recette-voix.ts` (souffle corrigé #177, contrôle de ressemblance #178).
4. **Calage** du mot écrit sur le mot dit : `calage.ts`.
5. **Mise en page par format** : `mise-en-page-gabarit.ts`, `formats-sortie.ts`.
6. **Fin par réseau** : `variantes-fin.ts`, avec une voix de fin lue à part (`:501`).
7. **Rendu** : `studio-rendu/compositions/tableau/`.
8. **Contrôles** : `controles*.ts`, `relecture.ts`.

**Notes**
- **Script 6.**
- **Fidélité 5,5.**
- **Motion 4,5** : une page unique, Montserrat et non Anton, règle de rythme de 4 s (`regles.ts:62`) ; monotone par construction, même si c'est lisible.
- **Son 4,5** : voix soignée, aucun bruitage.
- **Réseaux 7** : 4 formats calculés, pas recadrés, avec zones sûres sourcées.
- **Contrôles 6.**

**Défauts précis**
- **Aucun bruitage en gabarit clair** : `fabriquer.ts:1153` ne pose des sons que pour l'ancien style « blocs/2 ». Pourtant `index.ts:104` déclare des sons d'écriture et de page, et les fichiers `public/bruitages/tableau-*.wav` ne servent pas.
- **Règle « mot pour mot » tautologique** en fabrication (`index.ts:344`, `tableau-creation.ts:1133`).
- **Verdict sur la 1ʳᵉ sortie seulement** (`fabriquer.ts:901`, `index.ts:663`).
- **Relecture des images clés jamais fournie** (`controles.ts:172`).
- **Sous-titres** : déclarés obligatoires dans le format, absents du rendu, mais `sousTitres: true` est écrit en dur dans le rapport (`fabriquer.ts:612`, `index.ts:468`).
- **Prononciations** : jamais transmises par les services.
- **Écart crayon ↔ mot** : aucune mesure (`briques/tableau-scene/reference/animation.ts:285-310`).

**Réutilisable**
- **Sorties par réseau**, la meilleure du studio :
  - `formats-sortie.ts` (4 formats, zones sûres, `sortiesDesReseaux`, `SORTIES_SANS_APPEL_AU_MOT:202`) ;
  - `variantes-fin.ts` (corps lu une fois, fins lues à part) ;
  - `fin-propre.ts`.
- **Réparation automatique** d'une page trop chargée : le principe est transposable à un écran d'infographie trop dense.

### 2.4 Face caméra animée (FA), en cours
- **À quoi il sert** : Will dépose sa prise (son visage, sa voix). Un réalisateur Opus écrit un plan de mise en scène (cartes claires, étiquettes, fenêtres photo, zooms, sous-titres mot à mot, bruitages), rendu en style « interface claire ».
- **État** :
  - Sur master : lots A-B. Format masqué ; le moteur refuse tout lancement réel (`montage-facecam-animee/index.ts:182-183`). Bibliothèque `studio-rendu/compositions/interface-claire/**` et galerie.
  - Sur la branche `interface-claire/lot-c`, non fusionnée et sans PR :
    - lot C : contrat de plan, réalisateur, règles, rendu universel ;
    - lot D : images choisies automatiquement (Mes images → Pexels → Pixabay → capture, avec contrôle visuel Claude).
  - Lots E-J non faits. Le réalisateur n'est appelé par aucun moteur.
  - **Fichiers OCCUPÉS** par l'équipe FA (voir brief).

**Notes**
- **Script 6** : recette propre au format, pas encore reliée au générateur.
- **Fidélité 7** : chaque sous-élément est ancré à ±0,15 s sur un mot dit, et aucun chiffre n'est affiché sans être dit (`regles.ts:374-392`).
- **Motion 6** : micro-animations proches de la v4, mais Montserrat, pas de fonds alternés et un seuil de 4 s (`regles.ts:27-42`) ; 71 gros mouvements par minute contre 109 pour la référence.
- **Son 6** : bruitages dérivés du plan (`realisateur/sons.ts`), mais **fichiers absents du dépôt**. `VideoAnimee.tsx:177` lit `sons/<nom>.wav`, introuvables sur master comme sur la branche (vérifié). Ils ne sont que dans `<dossier-de-plan-prive>\planche-v1\sons-cc0\`.
- **Réseaux 2** : un seul plan, une seule fin (`Fin.tsx:58`).
- **Contrôles 6** : riches sur le plan, rien sur la vidéo rendue.

**Autres défauts**
- Sous-titres à 80-84 % de la hauteur (`VideoAnimee.tsx:136-140`).
- `stylesParDefaut.sousTitres: "st-avocat-v1"` incohérent avec ses propres sous-titres.
- `scripts/essai-realisateur.ts:9` : chemin de worktree en dur.

**Réutilisable** : **la 2ᵉ brique clé du futur générateur**.
- **Bibliothèque d'animations** :
  - `cartes/*.tsx` : 10 comportements (frise, chat, vignettes, liste cochée, calendrier, graphique, statuts, calcul, logos, commentaire) ;
  - `elements.tsx` (icônes, étiquettes, tuiles, barre), `etiquettes-plus.tsx` (compteur), `Fenetre.tsx`, `Fin.tsx`, `SousTitres.tsx` ;
  - `mouvement.ts`, et `charte.ts` en fractions de l'image, donc valable à toute taille.
- **Contrat de plan validé** : `src/domaine/facecam-animee/plan.ts`.
- **Réalisateur** : Opus → zod → `verifierPlan`, 3 essais corrigés par les erreurs exactes, repli déterministe `regles-fixes.ts`, `sons.ts`, `mots.ts` (interdits).
- **Rendu universel** `VideoAnimee.tsx` : il faut lui permettre de tourner **sans prise filmée**. Aujourd'hui, le fond est la vidéo de Will (`:148-150`).

### 2.5 Face caméra (FC)
- **À quoi il sert** : Will se filme ; le studio coupe, règle l'image et le son, pose cartes, zooms et sous-titres. Un monteur Claude retouche par la conversation.
- **État** : en ligne, « terminé » pour Will (11/10). Aucun commit depuis le matin.

**Chaîne de fabrication**
1. Générateur central, puis téléprompteur.
2. Whisper et coupes contre le script (`briques/coupes/index.ts`), alignement forcé (`montage-facecam/chaine.ts`).
3. 13 cartes et zooms.
4. Sous-titres `st-avocat-v1`, 1 à 4 mots.
5. Bruitages seulement à la demande du monteur.
6. Déclinaison par ratio, pas par réseau (`declinaisons.ts`).
7. Relecture Claude des images finales (`relecture.ts`) et garde couleurs.

**Notes**
- **Script 4** : recette d'avocat, 90 s par défaut.
- **Fidélité 6** : seul format qui écoute la parole, mais non bloquant.
- **Motion 4** : changement toutes les 6 à 10 s (`monteur/role.ts:109`).
- **Son 5.**
- **Réseaux 2** (`formats/facecam/index.ts:39`).
- **Contrôles 6.**

**Défauts inchangés**
- Écran partagé qui coupe la tête (`habillage.ts:215`).
- Mots à venir grisés à 45 % (`sous-titres/style.ts:60`).
- `motsMax: 4` (`habillage-facecam/sous-titres.ts:25`).
- Opération « musique » encore permise au monteur (`role.ts:299-300`) ; le format ne porte pas `musique: "interdite"`.

**Réutilisable** : `montage-facecam/relecture.ts`, **la seule relecture par l'image de la vidéo finie du studio**. C'est le modèle à étendre (un appel, 24 images au plus, une correction).

### 2.6 Avocat (AV)
- **À quoi il sert** : un avatar HeyGen de Will dit un script du générateur central, avec des illustrations calées sur les mots.
- **État** : actif, mais `moteur: "simulation"` par défaut (`formats/avocat/index.ts:243`). Aucune production réelle.

**Notes**
- **Script 6** : débit écrit à 4,4-4,5 mots/s (`:207`) contre 2,6 mots/s mesurés pour la voix.
- **Fidélité 6** : aucune garde de fin de voix (aucune occurrence de `fin-de-voix` dans `montage-avocat` ni `voix-maitre`).
- **Motion 3** : motion commune coupée par défaut.
- **Son 6** : ressemblance v4 et bruitages discrets validés à la main.
- **Réseaux 6** : seuls l'ouverture et la fin sont refaites par réseau.
- **Contrôles 5.**

**Réutilisable**
- `src/briques/voix-maitre/` : machine de voix, plafond de dépense, reprise sans repayer, **ressemblance aux secondes 25-30 de la v4**.
- `src/briques/declinaison/` : principe « mère + ouvertures et fins par réseau ».

### 2.7 Générateur de scripts « 14 étapes », chaîne courte et socle commun
- **À quoi il sert** : écrire les scripts de l'avocat, de la face caméra et des autres formats, avec une version par réseau.
- **État** : en ligne.

**Ce qui a changé depuis le matin**
- **Socle de Will** `services/socle-will.ts`, lu par le générateur, le tableau et le cas concret : charte `donnees/generateur/domaine-axion.ts:226-235`, ton W01-W09 `modeles-will.ts:15-25`.
- **Chaîne courte** `generateur/chaine-courte.ts` (3 appels).
- **Banc à l'aveugle** `scripts/banc-ecriture.ts`. Résultat NON VÉRIFIÉ, rien dans le dépôt.

**Notes**
- **Script 6** : structures d'avocat, aucune structure accroche → douleur → réponse → explication → appel.
- **Motion 1** : aucune grammaire visuelle (`roles/prose.ts:29`) ; la chaîne courte la retire même (`:114`).
- **Réseaux 8** : règles datées par réseau, `contexte.ts:205-216`.
- **Contrôles 7.**

**Défauts**
- Interdits de marque (« Villeexemple », « Aucun gain garanti », « machine ») **non codés** dans le générateur. Ils dépendent de données en base (`controles-script/style.ts:290-302`). Le tableau en code deux (`domaine/scripts-tableau-controles.ts:273-274`), le cas concret « machine » et « Villeexemple ».
- **Contradiction** : le modèle de ton W09 contient « le plan de cette machine » (`modeles-will.ts:24`), alors que R10 interdit « machine ».

**Réutilisable**
- `blocsEnCache` + `chargerSocleWill`.
- Le contrôle d'invention des chiffres (chiffre rattaché à une preuve) : essentiel pour qu'un script ne dise que les chiffres de l'image.
- Les règles d'écriture par réseau.
- La chaîne courte comme patron d'un appel unique « script + publication ».
- Le banc A/B.

### 2.8 Motion design « MO » et autres formats « bientôt »
- **MO** (`formats/autres.ts:122-165`) : fiche seulement. 15 à 60 s, aucun visage, recette « accroche chiffre/question → idée répétable → schéma → conclusion », 6 mots par écran, `moteur: "simulation"`.
  - **Ce qui existe mais n'est pas assemblé** : `src/briques/motion/` (cartes en Poppins, autre style que la v4) et `studio-rendu/compositions/commune/motion/` (14 modèles).
  - **Ce qui manque** : un moteur, l'entrée image, la grammaire v4, un script typé par écran, les bruitages, les fins par réseau.
  - Notes : script 3, motion 2, son 0, réseaux 3.
  - **C'est l'emplacement naturel du futur générateur** : le code MO est déjà réservé (`registre-codes.ts`). On peut aussi créer un code dédié.
- **Écran partagé (EP), UGC, Créateur B, podcast, selfie** : `moteur: "simulation"` (`autres.ts:51,115,160,205,252`, `podcast/index.ts:66`), aucun moteur.
  - UGC imposerait un faux avis client, interdit par la charte.
  - Selfie est masqué, remplacé par la face caméra.
- **Pub face caméra (un créateur de référence)** : plan seulement (`<dossier-de-plan-prive>`).

---

## 3. Briques transversales (état au soir)

| Brique | Où | État | Pour le générateur image → vidéo |
|---|---|---|---|
| Fins par réseau | `src/briques/fins/banque.ts` (base 7 l.63-152, plus table studio l.225-245), `table.ts`, `index.ts:55-64` (garde LinkedIn) | Mot à commenter dit en vidéo : **Facebook et Instagram seulement** (Instagram avec abonnement). TikTok et Shorts : lien dans le profil. LinkedIn : mot dans le texte du post, mais le cas concret fait dire un appel (contradiction) | Reprendre ; **ne pas modifier sans Will** (banque validée) |
| Zones sûres par réseau | `src/reseaux/index.ts` | 9:16 bas : Instagram/Facebook 30 %, TikTok 26 %, Shorts 20 %, LinkedIn 14 % | Reprendre ; **aucun format actuel ne respecte la bande basse** pour ses sous-titres |
| Sorties par format | `montage-tableau/formats-sortie.ts`, `variantes-fin.ts` | Le plus abouti | Reprendre le principe |
| Voix | `fournisseurs/heygen/voix.ts` (starfish, 0,8-1,15, `force_regenerate`), `briques/voix-maitre/` (ressemblance v4), `montage-cas-concret/voix.ts` (euh), `recette-voix.ts` (1,1) | Bon | Reprendre. L'identifiant du clone n'est pas dans le code, il est lié par la base |
| Bruitages | banque bibliothèque (`services/bruitages.ts`, `donnees/bruitages.ts`, 20 sons CC0 **à valider par Will**), règles `briques/intensite/types.ts:123`, placement `montage-cas-concret/bruitages.ts`, mixage `studio-rendu/src/son/bruitages.ts` | **Branchés nulle part par défaut** (CC « aucun », TB gabarit clair rien, FA fichiers absents) | Reprendre, **forcer « discrets »** et vérifier qu'au moins un son par sorte est validé |
| Contrôle de l'image | `src/briques/controle-image/` (géométrique : −14 LUFS, crête, contraste théorique, zone sûre), `defauts-visuels.ts` (indicatif), `montage-facecam/relecture.ts` (vision, FC seulement) | Partiel | **Étendre la relecture vision** aux images rendues, et la rendre bloquante |
| Écoute du son final | — | **Absente partout** (sauf Whisper sur la prise en FC) | **À créer** (transcription comparée au script, fin dite en entier) |
| Textes de publication et Buffer | `montage-cas-concret/publication.ts`, `fournisseurs/publication/buffer.ts` | Bon. Le premier commentaire d'un Reel Facebook est à poser à la main (`publication.ts:32`) | Reprendre |

---

## 4. Ce que le futur générateur « une image → une vidéo motion design » doit reprendre, corriger, créer

**Reprendre**
- Le moteur `montage-cas-concret` : fiche d'écrans, script validé rejoué mot pour mot, règles R02-R23, calage au mot, voix.
- Les compositions v4 du cas concret.
- La bibliothèque « interface claire » et le réalisateur à plan contrôlé du FA : **lecture seule, fichiers occupés**.
- Les sorties par format du tableau.
- La banque des fins, le socle de Will et le contrôle d'invention des chiffres.

**Corriger avant réemploi** (sinon les défauts se copient)
- La garde de fin qui se saute en silence.
- Le retour au MP3 sans le signaler.
- Le verdict qui ne lit que la 1ʳᵉ sortie.
- La référence tautologique du texte dit.
- Les bruitages éteints par défaut.
- Les sous-titres dans la bande basse.
- Le seuil de rythme : 4 s, à remplacer par ~1,6-2 s.

**Créer**
1. La **lecture de l'image** par Claude en vision : zones, éléments, flèches, embranchements, chiffres. On en tire une fiche d'écrans typés, chaque élément dessiné devenant un objet animé.
2. Le **script** accroche → douleur → début de réponse → explication → appel à commenter. Il ne dit que les chiffres de l'image.
3. Un **corps et une durée par réseau**, YouTube Shorts compris.
4. Le **contrôle d'écoute** du son final.
5. La **relecture vision** des images rendues, bloquante.
6. Les **interdits codés** (« machine », « Villeexemple », « Aucun gain garanti »).

**Décisions à demander à Will**
- (a) LinkedIn : la vidéo dit-elle « lien en premier commentaire » (comme le brief et la v6-v10) ou rien (base 7) ?
- (b) Le modèle de ton W09 contient « machine ».
- (c) Valider l'écoute d'au moins un bruitage par sorte dans la Bibliothèque.
