# 20 · Inventaire des briques du générateur « Une image → une vidéo motion design par réseau »

Chef des briques, 14/10/2026 (soir). **Lecture seule** : rien n'a été construit, testé ni rendu.
Code lu sur `origin/master` du dépôt `studio-axion-ia` (tête `769aedae`, PR #203 « socle de Will ») et sur les branches distantes actives non fusionnées (surtout `origin/interface-claire/lot-c`, face caméra animée, lots C et D). Tous les chemins ci-dessous sont relatifs à `<dossier utilisateur>\Documents\Projets\studio-axion-ia` et valent pour `origin/master` sauf mention « (lot-c) ».
Appuis : audit du matin `<dossier-de-plan-prive>\` (rapports 20, 30, 40) ; je n'en recopie que ce que j'ai revérifié dans le code de ce soir.

Légende du tableau
- **Existe ?** OUI = en code sur master · PARTIEL = existe mais ne couvre qu'une partie du besoin · BRANCHE = seulement sur une branche non fusionnée · NON = rien en code.
- **Qualité /10** = qualité de ce qui existe POUR CE BESOIN (pas dans l'absolu). « — » quand rien n'existe.
- **Décision** : TEL QUEL (réutilisable sans changement) · ADAPTER · CRÉER.
- **Risque** : ce qui peut empêcher la perfection si on se trompe.

---

## 1. Tableau de synthèse

| # | Brique | Existe ? | Où | Qualité /10 | Décision | Risque |
|---|---|---|---|---|---|---|
| 1.1 | Envoi de l'image dans le studio (dépôt, stockage) | OUI | `src/app/api/depots/route.ts`, `src/services/envois.ts`, `src/services/mes-images.ts` | 8 | TEL QUEL (dépôt) | faible |
| 1.2 | Envoi d'une image à Claude (vision) | OUI | `src/fournisseurs/claude/client.ts:33-99` (`images?: ImageClaude[]`, JPEG/PNG base64) | 8 | TEL QUEL | faible (taille max image à borner) |
| 1.3 | Lecture STRUCTURÉE de l'image (titres, étapes, flèches, embranchements, chiffres, icônes, phrase-choc) | NON | — (le seul « analyserImage » de Mes images classe une photo : catégorie, mots-clés, cadrage) | — | **CRÉER** | **critique** |
| 1.4 | Détection du type d'image (bénéfices / linéaire / embranchement / entonnoir / avant-après / mixte) | NON | — | — | **CRÉER** | **critique** |
| 1.5 | Localisation des zones dans l'image (cadres en pixels de chaque bloc, pour zoomer / découper / redessiner) | NON | — | — | **CRÉER** | élevé (Claude situe mal au pixel près) |
| 1.6 | Contrôle « rien d'inventé » (aucun nombre sans source) | OUI | `src/moteurs/montage-cas-concret/regles.ts` R12 « aucun nombre libre » (l.653), `champs-du-cas.ts:159`, schéma `faits` de `src/formats/cas-concret/cas.ts` | 8 | ADAPTER (la source devient « l'image ») | moyen |
| 1.7 | Contrôle « rien d'oublié » (chaque chiffre / étape / branche de l'image présent dans le script ET à l'écran) | NON | — | — | **CRÉER** | **critique** |
| 1.8 | Validation humaine de la lecture de l'image (Will corrige ce que Claude a lu) | NON | — (le cas concret part d'un catalogue écrit à la main : `src/formats/cas-concret/catalogue/*.ts`, 7 cas) | — | **CRÉER** | élevé |
| 2.1 | Socle commun de Will (charte, style, preuves, interdits) | OUI | `src/services/socle-will.ts` (PR #187), branché sur le cas concret par PR #203 | 8 | TEL QUEL | faible |
| 2.2 | Ton v4 + structure accroche → douleur → début de réponse → explication → appel à commenter | PARTIEL | recette par blocs `src/formats/cas-concret/recette.ts` (accroche, chiffre, avant, bascule, étapes, reste humain, résultat, question) ; écriture `src/moteurs/montage-cas-concret/ecriture.ts` (964 l.) | 7 | ADAPTER (recette par TYPE d'image) | moyen |
| 2.3 | Interdits (machine, Villeexemple, aucun gain garanti…) dans le script | OUI | `regles.ts:58` `MOTS_INTERDITS_FORMAT` + interdits de Will (R10) | 9 | TEL QUEL | faible |
| 2.4 | Validation + modification du script par Will avant la voix | OUI | `src/moteurs/montage-cas-concret/modifier-script.ts`, `script-valide.ts`, `src/components/formats/cas-concret/fiche-video/ValidationScript.tsx` (PR #202) | 8 | ADAPTER (zone occupée par axion-ia-43 : réutiliser, ne pas modifier) | faible |
| 3.1 | Découpage en écrans (« fiche d'écrans ») + règles (durées 1-5 s, un événement ≤ 2 s, fonds alternés, mots courts, marque) | OUI | `src/moteurs/montage-cas-concret/fiche.ts`, `regles.ts` (R01-R23) | 8 | ADAPTER (nouveaux types d'écran) | moyen |
| 3.2 | Plan d'animation « quel élément s'anime sur quel mot » | OUI | événements `surMot` de la fiche (`fiche.ts`, `calage.ts`) ; réalisateur Opus (lot-c) `src/moteurs/montage-facecam-animee/realisateur/*` + contrat `src/domaine/facecam-animee/plan.ts` (lot-c) | 7 | ADAPTER | moyen |
| 3.3 | Stratégie pour les schémas TRÈS complexes (12+ blocs, 2 branches) : vue d'ensemble → parcours branche par branche → retour vue d'ensemble | NON | — (le cas concret plafonne à 3-7 étapes linéaires, `cas.ts` `etapes.min(3).max(7)`) | — | **CRÉER** | **critique** |
| 4.1 | Écrans motion « v4 » (Anton, deux fonds, mot orange, fils, cartes) | OUI | `studio-rendu/compositions/cas-concret/` (types : Accroche, Chiffre, Etape, ListeAvant, Objet, Preuve, Promesse, Question, Resultat, Titre, Lien, AppelMot ; socle : Fond, Marque, MotParMot, FilEtapes, Ligne, Puce, Surgir, Eclair, Biais) | 8 | TEL QUEL (socle) / ADAPTER (types) | faible |
| 4.2 | Objets redessinés (e-mail, dossier classé, chrono, barres avant/après, outils reliés, notifications, calendrier, rapport…) | OUI | `studio-rendu/compositions/cas-concret/objets/` (17 objets, banque FERMÉE `OBJETS` de `cas.ts`) | 8 | TEL QUEL + compléter | moyen |
| 4.3 | Cartes « interface claire » (liste cochée, calcul, statuts, pile de logos, graphique, chat, commentaire, calendrier, vignettes, étiquettes, compteur) | OUI + BRANCHE | `studio-rendu/compositions/interface-claire/` (master) ; `VideoAnimee.tsx`, `plan-galerie.ts` (lot-c) | 8 | TEL QUEL (zone occupée par axion-ia-ca : importer, ne pas modifier) | moyen (charte claire ≠ charte v4 sombre/ivoire) |
| 4.4 | Flèche qui se dessine / fil orange | PARTIEL | `socle/Ligne.tsx`, `FilEtapes.tsx` (barre d'avancement), fil de `OutilsRelies.tsx` ; GSAP DrawSVG/MotionPath dans `commune/motion/sur-mesure/vendeur/` | 6 | ADAPTER (flèche courbe générique entre deux blocs quelconques) | moyen |
| 4.5 | **Embranchement** (un bloc → 2 ou 3 branches, % sur chaque branche) | NON | — | — | **CRÉER** | **critique** (images C, D) |
| 4.6 | **Entonnoir** (20 enveloppes qui entrent, tri 80/20) | NON | — | — | **CRÉER** | **critique** (image D) |
| 4.7 | Pile / nuée d'objets nombreux (20 enveloppes, 16 cochées vertes) | PARTIEL | `PileNotifications.tsx`, `ListeCochee` (interface claire) | 5 | ADAPTER | moyen |
| 4.8 | Compteur de chiffre (0 → 80 %, 19 min → 45 s) | OUI | `types/Chiffre.tsx` (cas concret, `compteur`), `ticsCompteur` (lot-c `realisateur/sons.ts`), `MotionChiffre.tsx` | 8 | TEL QUEL | faible |
| 4.9 | Avant / après en écran partagé (deux colonnes qui se répondent) | PARTIEL | `objets/BarresAvantApres.tsx` (barres), `commune/motion/MotionAvantApres.tsx` + `MotionDeuxColonnes.tsx` (charte Poppins ancienne) | 5 | ADAPTER (vrai écran partagé à la charte v4) | moyen (images E, F) |
| 4.10 | **Caméra virtuelle** qui parcourt un grand schéma (panoramique + zoom sur la zone dite) | NON (seulement un travelling de frise) | `commune/motion/spectaculaire/LigneDeTempsSpectaculaire.tsx:37-57` (travelling sur une ligne) | 3 | **CRÉER** | **critique** (automatisations complexes) |
| 4.11 | Icônes vectorielles libres | OUI ×3 listes | Lucide ISC : `src/briques/motion/icones.ts` (≈40 noms, Poppins/charte motion) ; `interface-claire/elements.tsx` `NOMS_ICONES` (≈30, autre liste) ; dessins maison `src/briques/dessins/registre/` (41 tracés SVG, droits tenus dans `src/briques/droits/registre/`) ; `lucide-react` installé côté site seulement | 6 | ADAPTER (UNE liste commune + correspondance « icône de l'image » → nom) | moyen |
| 4.12 | Polices (Anton, Inter, Montserrat, Poppins) chargées en local | OUI | `studio-rendu/compositions/commune/polices/` (Anton OFL), `commune/motion/polices.ts` | 9 | TEL QUEL | faible |
| 4.13 | Charte terracotta / ivoire / sombre chaud | OUI | `src/briques/habillage/charte-duo` (`COULEURS_DUO`, `FONDS`, contraste mini), `interface-claire/charte.ts` | 8 | TEL QUEL | faible (deux chartes coexistent) |
| 4.14 | Animation « sur mesure » écrite par Claude (HTML + GSAP en iframe isolée) | OUI | `src/briques/motion/sur-mesure.ts`, `commune/motion/CarteSurMesure.tsx` | 6 | réserve (repli pour cas inédits) | élevé (rendu imprévisible) |
| 5.1 | Voix clone HeyGen unique (starfish, 1,1) | OUI | `src/fournisseurs/heygen/voix.ts`, `recette-voix.ts` (cas concret, ne pas toucher) | 9 | TEL QUEL | faible |
| 5.2 | Contrôle de ressemblance à la voix de référence (v4 25-30 s) | OUI | `src/briques/voix-maitre/reference.ts`, `src/services/voix-ressemblance.ts`, `docs/voix-reference/voix-reference-v4-25-30s.wav` (PR #174 ; `origin/voix/avocat-ressemblance` non fusionnée) | 7 | TEL QUEL | moyen (relances = coût) |
| 5.3 | Détection d'hésitation (« euh », souffle, blanc trop long) + lecture neuve | OUI | `src/moteurs/montage-cas-concret/voix.ts:144, 354` + `nouvelleLecture → force_regenerate` (`heygen/voix.ts:182`) ; `studio-aligneur/aligneur/hesitations.py` | 8 | TEL QUEL (appeler) | faible |
| 5.4 | Coupes dans les vrais blancs (son brut copié en WAV, blanc mesuré) | OUI | `fabriquer.ts` (PR #200), `fin-de-voix.ts` `recalerCoupesSurSilences` | 8 | TEL QUEL | faible |
| 5.5 | Contrôle de fin de voix (dernière phrase dite en entier, bloquant) | OUI | `src/moteurs/montage-cas-concret/fin-de-voix.ts` `controlerFinDeVoix` ; `src/briques/composition/fin-propre.ts` | 8 | TEL QUEL | faible |
| 6.1 | Calage écran ↔ mot (heures des mots, alignement forcé) | OUI | `src/moteurs/montage-cas-concret/calage.ts`, `src/briques/calage/`, `src/fournisseurs/aligneur/client.ts` → `studio-aligneur/aligneur/ctc.py` | 8 | TEL QUEL | faible |
| 7.1 | Sous-titres mot à mot (groupes, largeur, #15100c sur ivoire, sans ombre) | OUI | `src/briques/sous-titres/` (scene.ts, groupement.ts, largeur.ts, style.ts), `studio-rendu/compositions/sous-titres/CalqueSousTitres.tsx` ; réglages v4 PR #198 | 8 | TEL QUEL | faible |
| 7.2 | Sous-titres placés selon le RÉSEAU (3 zones / zones sûres propres à chaque appli) | NON | un seul jeu pour tous (union des réseaux, `briques/sous-titres/largeur.ts:20`) ; cas concret : bande à 8 %, sous l'interface de 4 réseaux sur 5 (écart assumé v4) | 4 | ADAPTER (décision Will) | moyen |
| 8.1 | Banque de bruitages CC0 maison | OUI | `public/bruitages/` (29 sons synthétisés, `manifeste.json`, `outils/bruitages/fabriquer.mts`) | 7 | TEL QUEL | faible |
| 8.2 | Placement automatique des bruitages | OUI | cas concret `src/moteurs/montage-cas-concret/bruitages.ts` (souffle, pop, papier, vibration, tic, clôture) ; lot-c `realisateur/sons.ts` (whoosh, drops, tics de compteur, clic de zoom) | 8 | ADAPTER (sons pour branche, entonnoir, coche, zoom) | moyen |
| 8.3 | Sons de la galerie « interface claire » (`whoosh-in`, `drop_00x`, `tick_001`…) | **INTROUVABLES dans le dépôt** | appelés par `staticFile("sons/…")` (`interface-claire/Galerie.tsx:274`, `Planche.tsx:66`) mais `studio-rendu/public/` n'est suivi ni sur master ni sur lot-b / lot-c | ? | VÉRIFIER | **élevé** (vidéo muette ou rendu en erreur en prod) |
| 8.4 | Pas de musique | OUI | `formats/cas-concret/index.ts:135` `musique: "interdite"` | 10 | TEL QUEL | nul |
| 9.1 | Fins par réseau (banque VALIDÉE) | OUI | `src/briques/fins/banque.ts` (+ `table.ts`, `index.ts` : LinkedIn sans appel à commenter) ; `montage-cas-concret/fins.ts` `planDesFins` | 9 | TEL QUEL (ne rien modifier sans Will) | faible |
| 9.2 | Mot à commenter réellement « branché » (document envoyé) | NON | `src/formats/cas-concret/mots-branches.ts` « vide aujourd'hui » | — | décision Will | moyen |
| 9.3 | Formats d'export 9:16 / 4:5 / 1:1 / 16:9, mise en page RECALCULÉE (pas recadrée) | PARTIEL | tableau animé : `src/moteurs/montage-tableau/formats-sortie.ts` (vertical, portrait, carré, horizontal + zones sûres) ; cas concret : **9:16 seulement** (`formats/cas-concret/index.ts:108`) | 6 | ADAPTER | élevé (écrans v4 pensés en vertical) |
| 9.4 | Durées max et visées par réseau, zones sûres de chaque appli | OUI (indicatif) | `src/reseaux/index.ts`, `src/reseaux/ecriture.ts` ; non bloquant (`verifierPourReseau` non lu par `publiable`) | 6 | ADAPTER (rendre bloquant) | moyen (Facebook 90 s) |
| 9.5 | Version COURTE par réseau (TikTok 25-35 s vs LinkedIn jusqu'à 60 s) à partir du même schéma | NON | cas concret : un seul corps 40-60 s, seules les fins changent | — | **CRÉER** (ou décision : un corps unique) | moyen |
| 10.1 | Texte du post par réseau + premier commentaire + consigne « où poser le lien » | OUI | `src/moteurs/montage-cas-concret/publication.ts` | 8 | ADAPTER (lire le contenu de l'image au lieu du cas) | faible |
| 10.2 | Lien suivi utm | OUI | `src/domaine/mesures.ts:143-153` `lienSuivi` ; `montage-cas-concret/fins.ts:60-70` (`utm_content`) | 8 | TEL QUEL | faible |
| 10.3 | Interdits contrôlés sur le TEXTE DU POST (Villeexemple, gain garanti) | NON | gardes seulement sur scripts (cas concret, tableau) | — | **CRÉER** (petit) | moyen |
| 11.1 | Contrôles de mise en page (contraste, texte trop petit, débordement de boîte, zone sûre) | OUI | `src/briques/controle-image/` (`controlerMiseEnPage`, seuils), `src/briques/ecrans-motion` `controlerProprietes` | 8 | TEL QUEL | faible |
| 11.2 | Défauts visibles (texte sur texte, objet vide, objet sous sous-titres, phrase en double) | OUI (indicatif) | `src/moteurs/montage-cas-concret/defauts-visuels.ts` | 7 | ADAPTER (bloquant pour le nouveau format) | moyen |
| 11.3 | Mesures du fichier (sonie, crête, image noire, taille, fin de voix 2 s avant la fin) | OUI | `montage-cas-concret/controles.ts`, `studio-rendu/src/operations/mesure-son.ts`, `controle-ffmpeg.ts` | 8 | TEL QUEL | faible |
| 11.4 | Rythme (un changement visible ≤ 2 s ; v4 ≈ 1,6 s) | OUI | `regles.ts` R06 `ECART_EVENEMENT_MAX_MS = 2000`, R05 écrans 1-5 s | 8 | ADAPTER (cible 1,6 s) | faible |
| 11.5 | **Écoute de la vidéo finie** (transcription du son final comparée au script validé, refus si écart) | NON | route Whisper `/transcrire` existe (`studio-aligneur/aligneur/transcrire.py`, utilisée seulement par le face caméra) ; comparaison prête `src/briques/coupes/texte.ts` | 2 | **CRÉER** (assembler l'existant) | **critique** |
| 11.6 | Relecture des IMAGES de la vidéo finie par Claude (comparer à l'image source : tout est montré, rien de faux) | NON | seule base : images jointes à Claude (`client.ts`) et contrôle visuel du lot D (lot-c `images/verification.ts`) | — | **CRÉER** | élevé |
| 11.7 | Refus automatique si défaut (porte unique bloquante) | PARTIEL | `controles.ts` (lignes `bloquant`) ; défauts visuels et rythme indicatifs | 6 | ADAPTER | moyen |
| 12.1 | Rendu Remotion + FFmpeg (serveur sans état, deux files) | OUI | `studio-rendu/src/remotion.ts`, `operations/composition.ts`, `assemblage.ts`, `mixage.ts` | 8 | TEL QUEL | faible |
| 12.2 | Rendu en nuage (Lambda) | PRÊT, ÉTEINT | `studio-rendu/src/remotion-lambda.ts` (aucun compte AWS) | — | inutile pour l'instant | faible |
| 12.3 | Coût annoncé et réservé avant chaque appel payant | OUI | `src/fournisseurs/claude/tarifs.ts` (`pireCasUsd`), `src/fournisseurs/credits/`, budget injecté (`ecriture.ts`) | 8 | TEL QUEL | faible |
| 12.4 | Stockage des fichiers (R2) | OUI | `StockageFichiers` (`src/fournisseurs/types.ts`), envois par morceaux | 8 | TEL QUEL | faible |
| 12.5 | Dépôt automatique dans le Drive de Will pour vérification | NON | Drive branché en LECTURE seule (`src/services/google-drive.ts`, `drive.readonly`) ; aujourd'hui copie à la main vers `G:\Mon Drive` | — | CRÉER ou garder manuel | faible |
| 12.6 | Publication Buffer (brouillon par défaut) | PARTIEL | `src/fournisseurs/publication/buffer.ts` ; **choix du fichier par ratio seulement** (`services/publications.ts:332`), **premier commentaire jamais envoyé** mais déclaré envoyé (`classement-generateur.ts:310-313`) | 5 | ADAPTER (P0 de l'audit 40, toujours ouverts ce soir) | élevé |
| 13.1 | Onglet du studio + dépôt de l'image + aperçu du script + validation | PARTIEL | modèle à suivre : `src/app/(studio)/cas-concret/` + `src/components/formats/cas-concret/` (entrée par catalogue de cas, `ValidationScript`, `SuiviCasConcret`, `VosFichiers`) ; dépôt d'image : Mes images | 6 | CRÉER l'onglet en réutilisant les pièces | moyen |
| 13.2 | Format déclaré au registre du studio + moteur | NON | à ajouter : `src/formats/index.ts`, `registre-codes.ts`, `src/moteurs/ids.ts`, `src/moteurs/index.ts`, `studio-rendu/compositions/Racine.tsx` (UNE ligne chacun, fichiers partagés avec axion-ia-ca) | — | CRÉER | moyen (conflits de fusion) |
| 14 | Fidélité visuelle à l'image (mêmes couleurs, mêmes icônes, même vocabulaire, même phrase-choc à l'écran) | NON | — | — | **CRÉER** (règles + contrôle 11.6) | élevé |
| 15 | Machine à états reprenable (une voix payée n'est jamais relue, reprise après panne) | OUI | modèle `montage-cas-concret/voix.ts`, `index.ts`, `src/briques/chaine-scenes/` | 8 | TEL QUEL (patron) | faible |
| 16 | Banc d'essai sans dépense (simulations Claude / HeyGen / rendu) | OUI | doubles de simulation (`roleEcritureCasConcret.simuler`, `fournisseurs/*/simulation.ts`), banc `origin/scripts/banc-comparaison` (#191) | 7 | ADAPTER (6 images de Will en jeu d'essai) | faible |

---

## 2. Les briques MANQUANTES qui empêcheraient la perfection

Classées par gravité. Sans les sept premières, le générateur ne peut pas tenir la promesse de Will (« de la liste de bénéfices à l'automatisation hyper complexe, sans rien oublier »).

1. **Lecteur d'image structuré (1.3 + 1.4)** : un appel Claude vision qui rend un **graphe** de l'image (blocs, textes exacts, chiffres avec unité, icônes, flèches orientées, branches et leurs %, regroupements avant/après, phrase-choc, logo) + le **type** d'image. Rien n'existe. Tout le reste en dépend.
2. **Validation de la lecture par Will (1.8)** : écran « voici ce que j'ai compris de votre image » à corriger avant toute écriture. Sans elle, une erreur de lecture se propage jusqu'à la voix payée.
3. **Contrôle « rien d'oublié » (1.7)** : chaque chiffre, chaque étape, chaque branche du graphe doit être DIT dans le script et MONTRÉ dans un écran ; refus sinon. Le contrôle inverse « rien d'inventé » existe (R12) et s'adapte.
4. **Stratégie des schémas complexes (3.3) + caméra virtuelle (4.10)** : vue d'ensemble, puis parcours branche par branche avec zoom sur la zone dite, puis retour à l'ensemble. Le cas concret est bloqué à 3-7 étapes linéaires ; l'image C a 11 blocs et 2 branches.
5. **Composants embranchement (4.5) et entonnoir (4.6)**, à la charte v4, avec leurs bruitages. Absents. Avant/après en écran partagé (4.9) n'existe qu'en ancienne charte.
6. **Écoute de la vidéo finie (11.5)** : transcription du son final (route `/transcrire` déjà en service) comparée au script validé (`briques/coupes/texte.ts` déjà écrit), bloquante. Aucun format ne le fait aujourd'hui.
7. **Relecture visuelle finale par Claude (11.6 + 14)** : quelques images clés de la vidéo + l'image source envoyées à Claude : « tout ce qui est dans l'image est-il montré, sans erreur, aux couleurs de l'image ? ». À créer sur le patron du contrôle visuel du lot D.
8. **Sons de l'interface claire introuvables dans le dépôt (8.3)** : à vérifier AVANT de réutiliser ces cartes (les sons du cas concret, eux, sont dans `public/bruitages/`).
9. **Buffer** (12.6) : fichier choisi par ratio et premier commentaire jamais posé, alors que le kit dit le contraire. Pas propre au nouveau générateur, mais une vidéo parfaite publiée avec la mauvaise fin ou sans lien n'est pas parfaite.
10. **Une version par réseau au-delà de la fin (9.3 + 9.5)** : formats 4:5 / 1:1 / 16:9 pour un écran v4 (seul le tableau sait recalculer la page), et version courte TikTok éventuelle. Demande une décision de Will (ratio LinkedIn, une seule durée ou deux).

Plus petit mais à faire : garde des interdits sur le texte du post (10.3), localisation des blocs en pixels (1.5) si on choisit de montrer l'image d'origine (voir § 3.3), liste d'icônes unique (4.11), onglet + registre (13.x).

---

## 3. Détail par brique

### 3.1 Lecture de l'image

- **Ce qui existe.** Le client Claude sait joindre des images (`src/fournisseurs/claude/client.ts:33-99`, JPEG ou PNG en base64, avec légende). Le dépôt de fichiers par morceaux vers le stockage et la bibliothèque « Mes images » existent (`api/depots`, `services/envois.ts`, `services/mes-images.ts`) ; « Mes images » appelle `analyserImage` mais pour CLASSER une photo (catégorie, mots-clés FR/EN, cadrage, zones sensibles), pas pour en lire le contenu.
- **Ce qui manque.**
  - Un **schéma zod du « graphe de l'image »** (version numérotée, comme `plan-facecam-animee/1`) : `type` (benefices | lineaire | embranchement | entonnoir | avant-apres | mixte), `titre`, `sousTitre`, `blocs[]` (id, texte exact, rôle : source / étape / décision / résultat / bénéfice / chiffre-clé, icône vue, couleur orange|noir), `liens[]` (de → vers, libellé, % ), `groupes[]` (avant, après, branche gauche, branche droite), `chiffres[]` (valeur, unité, texte autour, bloc d'origine), `phraseChoc`, `bandeauChiffres[]`, `pied[]`.
  - Une **double lecture** pour fiabiliser : deux appels indépendants (ou un appel + relecture « qu'ai-je oublié ? ») puis comparaison ; écarts → montrés à Will.
  - **Chiffres extraits par le code** depuis les textes lus (comme `nombresDe` de `regles.ts`) pour ne pas dépendre d'une liste tenue par Claude.
  - Écran de validation de la lecture (voir 13).
- **Type d'image** : à faire déterminer par Claude MAIS contrôlé par le code sur le graphe (une branche = au moins un bloc à deux sorties ; entonnoir = N entrées → 1 traitement → 2 sorties chiffrées ; avant/après = deux groupes opposés). Les 6 images du brief servent de jeu d'essai (attendus écrits à la main).
- **Risque** : Claude lit bien le texte mais peut confondre l'ordre des flèches ou rattacher un chiffre au mauvais bloc. D'où validation Will obligatoire au début (au moins tant que le banc n'a pas montré 6/6 sans erreur).

### 3.2 Écriture du script

- **Réutilisable** : `src/services/socle-will.ts` (charte, fiche de style validée, textes retenus, preuves, interdits ; PR #187) — déjà lu par le cas concret depuis PR #203. Écriture en deux appels au plus avec relance guidée par les refus, budget réservé avant l'appel, simulation sans clé : `src/moteurs/montage-cas-concret/ecriture.ts` (patron, fichier occupé par axion-ia-43 : COPIER le patron, ne pas importer ni modifier). Interdits `regles.ts:58` + interdits de Will (R10). Validation et modification du script écran par écran avant la voix : `modifier-script.ts`, `script-valide.ts`, `ValidationScript.tsx`.
- **À adapter** : la recette du cas concret (`recette.ts`) est une recette par OFFRE (formation, audit, intégration) avec des blocs pensés pour un cas linéaire. Il faut une **recette par TYPE d'image**, toutes sur l'ossature accroche → douleur → début de réponse → explication → appel à commenter :
  - bénéfices : accroche → douleur → « voici ce que ça change » → un bénéfice par écran (5 au plus, regroupés si plus) → phrase-choc → appel ;
  - linéaire / embranchement : accroche (le chiffre-clé) → douleur → déclencheur → étapes → **chaque branche avec son %** → résultat chiffré → appel ;
  - entonnoir : accroche → le tas d'entrées → le tri → les deux sorties chiffrées → ce qui reste humain → appel ;
  - avant / après : douleur chiffrée (avant) → bascule → après chiffré → l'écart → appel.
- **Mot « IA »** : pas de garde particulière ; « machine » est déjà interdit (R10), le vocabulaire de l'image (« IA classe et répond ») est conservé tel quel.
- **Fausse posture** : l'image n'est PAS un cas client réel ; la posture doit être « notre méthode » / « situation type » (`ETIQUETTE_POSTURE.offre`) et le script ne doit jamais dire « un client a… ». Règle à ajouter au contrôle.

### 3.3 Découpage en scènes et plan d'animation

- **Réutilisable** : la fiche d'écrans du cas concret (`fiche.ts`) et ses 23 règles (`regles.ts` : accroche ≤ 8 mots finie avant 3 s, écran 1 à 5 s, un événement visible toutes les 2 s au plus, débit 3,0-3,9 mots/s, pas 4 fonds identiques de suite, textes courts, marque « axion-ia.com » sur chaque écran). Le calage des événements sur un mot (`surMot`) donne exactement « quelle partie s'anime à quel mot ». Le réalisateur du face caméra animé (lot-c, `realisateur/index.ts` : Opus + règles fixes de repli, 3 essais guidés par les erreurs, plan vérifié par le code) est le meilleur patron pour un plan d'animation décidé d'après le script.
- **À créer** : la **règle de mise en scène d'un graphe** : chaque bloc du graphe a son écran ou son instant d'apparition, chaque flèche est dessinée sur le mot qui la dit, chaque branche a un écran de transition (la caméra se déplace), et un **écran de vue d'ensemble** au début de l'explication et à la fin (le schéma complet, comme l'image). Le contrôle « rien d'oublié » se branche ici : tout bloc du graphe doit avoir au moins un événement.
- **Choix d'approche à trancher** (impacte 1.5) : (a) **tout redessiner** en composants v4 (rendu net, cohérent, animable ; demande les composants 4.5-4.10) ou (b) **animer l'image d'origine** (zooms et surlignages sur la vraie image ; demande des cadres en pixels fiables, rendu moins « motion design »). Recommandation : (a) pour le corps, l'image d'origine seulement en dernier plan « voici le schéma complet » (et comme repère pour la relecture 11.6).

### 3.4 Bibliothèque de motion design

- **Existe, réutilisable** :
  - socle v4 du cas concret `studio-rendu/compositions/cas-concret/socle/` (Fond deux tons, Marque, MotParMot, Ligne, Puce, Surgir, Eclair, Biais, FilEtapes) et 12 types d'écran `types/` ;
  - 17 objets redessinés `objets/` (EMail, DossierClasse, Chrono, BarresAvantApres, OutilsRelies, PileNotifications, TelephoneNotification, Calendrier, Rapport, ListeTaches, CarteTaches, BouclierCoche, BulleLien, ChampCommentaire, ContratSignature, Programme, TelephoneCapture) — banque fermée `OBJETS` (`src/formats/cas-concret/cas.ts`) ;
  - cartes interface claire `studio-rendu/compositions/interface-claire/` (Calcul, Calendrier, ChatTape, Commentaire, Graphique, GrilleVignettes, ListeCochee, PileLogos, Statuts, étiquettes, compteur, barre de progression) + rendu universel `VideoAnimee.tsx` (lot-c). Consigne du brief : les réutiliser plutôt que refaire (import seulement, zone de axion-ia-ca) ;
  - catalogue motion générique `src/briques/motion/` + `commune/motion/` (liste, chiffre, avant/après, ligne de temps, comparaison, graphique, icône + mot, problème → solution, check-list, capture annotée) : **charte Poppins plus ancienne**, utile comme logique, pas comme rendu final ;
  - GSAP + DrawSVG + MorphSVG + MotionPath + Three.js locaux (`commune/motion/sur-mesure/vendeur/`, licences notées) : base technique pour flèches qui se dessinent et chemins de caméra.
- **À créer, à la charte v4** : `Embranchement` (un nœud, 2-3 branches qui se dessinent, % qui comptent, couleur orange/noir comme l'image), `Entonnoir` (N objets qui tombent, tri, deux sorties), `NueeObjets` (20 enveloppes, 16 se cochent en vert en cascade), `EcranPartage` avant/après, `FlecheCourbe` générique entre deux boîtes, `CameraSchema` (le schéma complet posé une fois sur une grande toile, la caméra pan/zoom de bloc en bloc sur les mots), `CarteBenefice` (icône + titre + ligne, entrée en cascade), `AlerteTelegram`/`Bulle notification` si absent des cartes, `Chronometre` qui s'arrête (existe : `Chrono`).
- **Icônes** : trois listes coexistent (Lucide ISC 40 noms dans `src/briques/motion/icones.ts`, `NOMS_ICONES` de l'interface claire ≈ 30 noms, 41 dessins maison avec registre de droits). Il faut UNE liste pour ce générateur + une table « ce que Claude voit dans l'image » → « nom d'icône » ; un nom inconnu donne aujourd'hui un simple rond (`lot-c realisateur/icones.ts`). Lucide (licence ISC) peut être étendu par le script générateur existant `scripts/motion/generer-icones.mjs` — gratuit, pas de banque payante.
- **Polices** : Anton (titres, OFL), Inter Bold, Montserrat ExtraBold, Poppins, toutes locales (`commune/polices/`). OK.
- **Charte** : `src/briques/habillage/charte-duo` (couleurs, fonds, contraste minimum, taille plancher). Vérifier que l'orange de la charte vidéo correspond à celui des images (#C9471B environ dans le brief) ; sinon décider lequel prime.

### 3.5 Voix

Tout existe et a été mis au point sur le cas concret ce 14/10 : clone HeyGen (`fournisseurs/heygen/voix.ts`, starfish, 1,1 ; recette `montage-cas-concret/recette-voix.ts` à ne pas toucher), ressemblance à la référence v4 25-30 s (`briques/voix-maitre/reference.ts`, `services/voix-ressemblance.ts`, prix annoncé = lectures max), hésitations et lecture neuve (`voix.ts:144, 354`, `force_regenerate`), coupes dans les blancs mesurés (`fabriquer.ts`, `fin-de-voix.ts`), contrôle bloquant de fin de voix (`controlerFinDeVoix`). Le nouveau moteur doit **appeler** ces pièces (via la brique `voix-maitre` et des copies de patron), jamais modifier les fichiers du cas concret. Coût : chaque relance = une lecture payée, aucune sans accord de Will.

### 3.6 Calage image ↔ mot

`montage-cas-concret/calage.ts` (écran = premier mot de son texte moins l'avance, arrondi à l'image ; événement = son mot ; nombres dits en lettres tolérés ; écran trop court jamais sorti) + aligneur `studio-aligneur` (`ctc.py`, alignement forcé, jamais bloquant : repli sur l'horodatage HeyGen). Réutilisable en copiant le patron. Pour la caméra virtuelle, les mouvements devront partir ~0,2-0,3 s AVANT le mot (même logique que `avanceMs`).

### 3.7 Sous-titres

Brique commune `src/briques/sous-titres/` + `CalqueSousTitres.tsx`, réglage v4 (#15100c sur ivoire, sans ombre, PR #198). Manque : position par réseau (un seul jeu, union des réseaux) ; dans le cas concret la bande est à 8 % du bas, donc sous les boutons d'Instagram, Facebook, TikTok et Shorts : écart accepté par Will pour la v4. À reconfirmer pour ce générateur (une ligne dans la liste des décisions).

### 3.8 Bruitages

- Banque maison CC0 `public/bruitages/` : 29 sons synthétisés (chiffre, document, illustration forte, impact, téléphone, verre, tableau), manifeste avec niveaux. Placement automatique cas concret `bruitages.ts` (souffle avant chaque changement d'écran, pop sur le mot orange, papier, vibration, tic, son de clôture 1,5 s avant la fin, jamais deux sons au même instant).
- Lot-c `realisateur/sons.ts` : règles plus riches (tics de compteur qui se resserrent, clic de zoom, cascade de coches, cadenas) mais avec des sons (`whoosh-in`, `drop_00x`, `tick_001`, `confirmation_002`…) **dont les fichiers ne sont pas dans le dépôt** (`studio-rendu/public/` non suivi). À vérifier sur le serveur avant de s'y fier.
- À créer : sons pour embranchement (séparation), entonnoir (chute + tri), coche verte en série, mouvement de caméra (souffle doux), alerte (cloche). Fabricables gratuitement par `outils/bruitages/fabriquer.mts` (synthèse, CC0). Pas de musique (garde déjà codée).

### 3.9 Fins, formats, durées, zones sûres

- Fins : `src/briques/fins/banque.ts` validée par Will (ne pas modifier sans lui) ; LinkedIn sans appel à commenter dans la vidéo (`fins/index.ts`), Facebook / LinkedIn « lien en premier commentaire », Instagram / TikTok « lien dans le profil » ; regroupement des réseaux par fin identique `montage-cas-concret/fins.ts` `planDesFins` (un fichier par fin). Le mot à commenter n'est branché sur aucun envoi (`mots-branches.ts` vide) : fin « au mot » jamais déclenchée tant que Will n'a pas préparé mot et document.
- Formats : le cas concret ne sort qu'en 9:16 ; le tableau animé sait sortir vertical / portrait 4:5 / carré / horizontal avec zones sûres par format et page RECALCULÉE (`montage-tableau/formats-sortie.ts`). Pour le nouveau générateur : partir du 9:16 (LinkedIn compris si Will confirme), et ne créer les autres formats qu'après décision (le ratio LinkedIn a 4 réponses différentes dans le code).
- Durées : registre `src/reseaux/index.ts` (Facebook 90 s max) mais non bloquant à la publication. Un schéma complexe dit en entier peut dépasser 60 s : prévoir une règle de durée PAR TYPE et une garde bloquante.

### 3.10 Textes de publication

`montage-cas-concret/publication.ts` (texte par réseau, premier commentaire seulement quand le lien y va, consigne « où poser le lien », LinkedIn : le mot en dernière ligne, jamais « commentez ») + `lienSuivi` utm (`domaine/mesures.ts`). À adapter pour lire le graphe de l'image. À ajouter : contrôle des interdits sur le texte du post et le commentaire (absent partout aujourd'hui).

### 3.11 Contrôles qualité automatiques

- **Existe** : mise en page (`briques/controle-image` : contraste, taille plancher, débordement, zone sûre), propriétés d'écran (`ecrans-motion` `controlerProprietes`), défauts visibles (`defauts-visuels.ts`, indicatif), mesures du fichier (sonie, crête, image noire, dimensions, voix finie ≥ 2 s avant la fin), rythme (R05/R06), fin de voix (bloquant).
- **Manque** : (1) écoute de la vidéo finie, bloquante ; (2) relecture des images finales par Claude face à l'image source ; (3) contrôle « rien d'oublié » ; (4) une **porte unique** qui refuse la vidéo si un contrôle bloquant échoue, avec phrase claire pour Will (le cas concret a des lignes indicatives que ce générateur devrait rendre bloquantes : chevauchement de textes, objet sous les sous-titres).
- Tous les tests lourds (rendus, transcriptions) : en routine cloud, jamais sur le PC.

### 3.12 Rendu, stockage, Drive, Buffer

- Rendu : `studio-rendu` (Remotion 4.0.532 + FFmpeg, serveur sans état, deux files), seuil mesuré « 45 s en moins de 4 min avec 6 cœurs » (en-tête de `remotion-lambda.ts`). Lambda prêt mais éteint (pas de compte AWS) : inutile. Rappel du brief : chaque `.tsx` de `studio-rendu` doit `import React from "react"` (l'oubli a cassé tout le rendu prod, PR #201).
- Coût par vidéo (ordre de grandeur, NON MESURÉ) : 2 appels Claude d'écriture + 1-2 de lecture d'image + 1 de relecture visuelle ; 1 à 3 lectures HeyGen (corps) + 1 par fin ; rendu sur notre serveur. Le prix doit être annoncé avant, comme le cas concret.
- Stockage R2 : OK. Drive : lecture seule ; le dépôt pour vérification reste manuel (`G:\Mon Drive`) sauf à créer un envoi (scope écriture à accorder par Will).
- Buffer : deux défauts ouverts (audit 40 P0-1 et P0-2, revérifiés ce soir) : fichier choisi par ratio seulement (`services/publications.ts:332`), premier commentaire déclaré envoyé mais jamais transmis (`classement-generateur.ts:310-313`, `buffer.ts`). Brouillon par défaut, Will relit.

### 3.13 Interface du studio

Patron complet dans le cas concret : page `src/app/(studio)/cas-concret/`, entrée `components/formats/cas-concret/entree/`, fiche vidéo (`EcritureCasConcret`, `ScriptEcrans`, `ValidationScript`, `SuiviCasConcret`, `VosFichiers`). À créer : un onglet « Une image → une vidéo » avec 4 étapes visibles : 1) déposer l'image (dépôt existant), 2) « voici ce que j'ai compris » (graphe affiché sur l'image, corrigeable), 3) script écran par écran, modifiable puis validé, avec le prix, 4) suivi + fichiers par réseau. Le format doit aussi être inscrit dans les fichiers partagés de registre (une ligne chacun, à coordonner avec axion-ia-ca qui ajoute aussi sa ligne).

---

## 4. Briques réutilisables clés (à ne pas refaire)

1. Voix complète du cas concret : clone unique, ressemblance v4, hésitations + lecture neuve, coupes dans les vrais blancs, fin de voix bloquante.
2. Calage mot à mot + aligneur.
3. Socle de Will (PR #187) + interdits + validation / modification du script (PR #202).
4. Fiche d'écrans + 23 règles + socle visuel v4 + 17 objets redessinés + cartes interface claire.
5. Sous-titres v4, bruitages CC0 maison et leur placement automatique, pas de musique.
6. Banque de fins par réseau validée, textes de publication, lien suivi utm.
7. Contrôles de mise en page et de mesures du fichier ; rendu Remotion + FFmpeg ; coût réservé avant chaque appel.

## 5. Points à faire trancher par Will (rien ne bloque l'écriture du plan)

- Ratio LinkedIn (9:16 comme la v4, ou carré / 4:5) et nombre de formats d'export.
- Sous-titres dans la bande basse (comme la v4) ou remontés au-dessus des boutons des applis.
- Une durée unique par vidéo, ou une version courte pour TikTok quand le schéma est complexe.
- Validation de la lecture de l'image : toujours, ou seulement au début (le temps que le banc prouve 6/6).
- Mot à commenter : rester sur « diagnostic + lien » tant qu'aucun document n'est branché.
