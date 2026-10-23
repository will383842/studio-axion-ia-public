# Journal du chantier face caméra

## Lot A « Fondations » — 09/10/2026 (session cloud, branche `feat/facecam`)

Référence : `PLAN-FACECAM-v4.md` § D (lot A). Rien n'est fusionné dans master, aucune PR, aucun déploiement, aucun serveur touché.

### Ce qui est fait

1. **Format `facecam`** (`src/formats/facecam/index.ts`), inscrit dans `FORMATS` et dans `registre-codes.ts` (code **FC**).
   - Statut `masque`, famille `face-camera` (la recette `recetteFaceCamera` n'est **pas** touchée : un test le vérifie).
   - `ratios: ["9:16"]`, `etapes: ["express","fabrication"]` (aucune nouvelle clé dans `CLES_ETAPES`), `moteur: "montage-facecam"`.
   - Choix par défaut D1-D13 : une seule ouverture (`declinaison: "aucune"`), titre fixe en haut (D5), aucune musique par défaut (D7, pas d'ambiance), pas d'image générée (D10), B-roll 1,2-2,5 s, export 25 i/s 16-20 Mb/s BT.709, mode de diction par défaut `teleprompteur`.
   - Styles par défaut : LUT `lut-axion-naturel`, sous-titres `st-avocat-v1`, rythme `sm-rythme`, son `ps-voix-claire`, aucun décor (fond réel).
   - **Selfie** passé en `masque` (une ligne). **Créateur B** non touché.
2. **Moteur `montage-facecam`** (`src/moteurs/montage-facecam/index.ts`), inscrit dans `IDS_MOTEURS` et `MOTEURS`.
   - Squelette qui passe `testerMoteurVideo` : étapes déclarées (reçue, **Le son, Les coupes, L'image, Les sous-titres et cartes**, montage, vidéo finale, vérification, relecture), avancement à l'horloge, échec typé réessayable, « Arrêter ».
   - `estimer()` (et retouche, format ajouté) rend **0 €**.
   - `refusAuLancement` refuse tout lancement réel (« Le montage face caméra n'est pas encore prêt. ») : les sorties de démonstration du squelette ne peuvent pas passer pour une vraie vidéo.
   - `MOTEUR_PRISES_FILMEES`, `deciderJeLis` et le chemin de l'avocat : **inchangés** (`deciderJeLis("facecam")` rend directement `montage-facecam` via `format.moteur`).
3. **Drapeau `sansPrix`** (`DefinitionFormat.sansPrix`, facultatif).
   - Serveur : `accordDuFormat()` donne l'accord de prix d'office au lancement, à la retouche et au format ajouté (`services/fabrication.ts`).
   - Écran : bloc Coût d'Express retiré (et sauté en mode pas à pas), prix du bouton et de « Avant de fabriquer » masqués ; `BlocCout` de l'Aperçu masqué ; montants de « Demander une modification » masqués (prop facultative `sansPrix`).
   - Le total du mois et le plafond restent dans Réglages (rien n'y a été changé).
   - **Plafond atteint** : `CommandeFabrication.plafondClaudeAtteint` (facultatif) → version simple, sans étape de relecture, aucun appel Claude, la vidéo sort quand même avec « Plafond du mois atteint — relever ? » (test unitaire).
4. **`TAILLE_MAX` à 15 Go pour facecam** (`services/envois.ts`) : une prise (`rush`) envoyée à une séance ou une version du format facecam a droit à 15 Go (`DefinitionFormat.tailleMaxEnvoiOctets`) ; tout le reste, avocat compris, garde 4 Go et le même message.
5. **`Video.entrees.facecam`** (`src/domaine/facecam.ts`) : `{ pisteVisageCle?, transcriptionCle?, masquesCle?, coupes:{auto[],retablies[]}, image:{lumiere,couleurs,mine,dents}, passages[], consignes[] }`. Lecture tolérante `lireEntreesFacecam` (jamais d'exception, clé R2 de plus de 400 caractères écartée). Réglages d'image en 3 crans (moins / juste / plus).
6. **studio-aligneur** : `aligneur/facecam.py` + branchement dans `serveur.py` et `__main__.py`.
   - Routes `POST /transcrire /visages /image /son /segmenter` et `GET /<route>/{id}`, même serveur, même clé `STUDIO_RENDU_CLE`.
   - Sans exécutant (aujourd'hui toutes) : **501** `{ statut: "echec", erreur: { code: "non-implemente", reessayable: false } }`.
   - `TravauxFacecam` prêt pour les lots suivants : un dossier et un `etat.json` par travail (dossier `STUDIO_ALIGNEUR_TRAVAUX`, sinon `/tmp/studio-aligneur-travaux`), un seul fil de calcul (un travail lourd à la fois), idempotent, travaux repris après un redémarrage.
   - Client TypeScript `src/fournisseurs/facecam/` (modèle : `fournisseurs/aligneur`) : ne lève jamais, 501 → échec non réessayable. **Double de simulation utilisé par défaut** ; le réel n'est pris que si l'appelant le demande (`fournisseurFacecam({ reel: true })`) et que `STUDIO_ALIGNEUR_URL` existe. Aucune nouvelle variable d'environnement.
7. **Enum `EtatFacecam`** (12 états) avec libellé français et geste suivant (`LIBELLES_ETAT_FACECAM`), et `libelleMontageFacecam(i)` pour les 4 étapes parlantes.

### Fichiers communs touchés (tous en ajouts facultatifs : absents, rien ne change)

- `src/formats/types.ts` (+ `sansPrix?`, `tailleMaxEnvoiOctets?`), `src/formats/index.ts` (+ facecam dans `FORMATS`, `formatSansPrix`, `accordDuFormat`, `tailleMaxEnvoi`), `src/formats/registre-codes.ts` (+ FC), `src/formats/autres.ts` (Selfie masqué).
- `src/domaine/types.ts` (+ `CommandeFabrication.plafondClaudeAtteint?`).
- `src/moteurs/ids.ts`, `src/moteurs/index.ts` (inscription), `src/moteurs/contrat.ts` (option facultative `{ sansPrix }` de `testerMoteurVideo` ; sans elle, contrat inchangé).
- `src/services/envois.ts`, `src/services/fabrication.ts` (3 appels `verifierEtReserver`).
- `src/assistant/etapes/Express.tsx`, `src/assistant/etapes/Apercu.tsx`, `src/components/videos/fiche/DemanderModification.tsx`, `src/app/(studio)/videos/[id]/page.tsx`.
- `studio-aligneur/aligneur/serveur.py` (paramètre facultatif `facecam`), `studio-aligneur/aligneur/__main__.py`.
- **Non touchés** : `studio-rendu` (aucune opération, aucune file, aucun contrat), `recetteFaceCamera`, `MOTEUR_PRISES_FILMEES`, `deploiement/`.

### Tests

- Nouveau : `tests/facecam-fondations.test.ts` (26 tests : contrat `testerMoteurVideo` avec facecam, plafond atteint sans appel Claude, 15 Go / 4 Go, `entrees.facecam`, `EtatFacecam`, client et double). `studio-aligneur/tests/test_facecam.py` (5 tests légers, sans modèle ; 12 avec `test_serveur.py`).
- `tsc --noEmit` : propre (hors `studio-rendu/`, dont les dépendances Remotion ne sont pas installées dans le cloud ; `next typegen` lancé avant).
- Suite Vitest complète : 2 957 réussis. Un seul échec restant, **déjà rouge avant le lot A** : `tests/g7a-programmer.test.ts` (« le plan propose les 5 versions… » : le plan suivant n'est pas vide). Deux dépassements de 5 s dans `e2e-verif1-bc-serie` sous la charge de la suite complète : verts relancés seuls.

### Ce qui reste

- **Lot B (chaîne vidéo)** : exécutants Python de `/transcrire` (faster-whisper small int8), `/visages`, `/image` (passe 10 bits, Look Will, préparation du rush HLG→SDR, rotation, 25 i/s), `/son` (DeepFilterNet) ; brique coupes (F0), consignes « Monteur », réalisation et rythme, grammaire, contrôles machine. Brancher le moteur sur `fournisseurFacecam` et écrire `entrees.facecam` (clés R2). Décider qui demande le réel (réglage en base, par exemple `moteur.facecam.aligneur`).
- **Lot C (habillage)** : brique commune `motion` d'abord (correctif du 09/10), cartes, `CarteSurMesure`, `sourcePreCadree`, `source10bits` (paramètres facultatifs de `assemblage` et `composition`), sous-titres, B-roll accordés, cadrage par calque.
- **Lot D (parcours et agent)** : envoi iPhone (Wake Lock, reprise, « fichier réduit par iOS »), états et notifications (s'appuyer sur `EtatFacecam`), écran « Votre vidéo » et ses feuilles, fil « Discuter avec mon monteur », agent monteur JSON, relecture Claude (injectée par `creerMoteurMontageFacecam({ relire })`), **remplir `plafondClaudeAtteint` dans `construireCommande`** pour facecam, segmentation à la demande.
- **Avant la mise en ligne** : retirer `refusAuLancement` du moteur, passer le format en `actif`, vérifier `COMPOSE_PROFILES` (profil `calage`) et `docker stats` sur l'hôte (non fait : aucun serveur touché dans ce lot).

### Points d'attention

- Le squelette rend des sorties de démonstration (`/demo/avocat-droits.mp4`) : seul `refusAuLancement` empêche un vrai lancement. Ne pas l'enlever avant le lot B.
- `sansPrix` n'empêche pas le BUDGET_DEPASSE : avec un coût nul, le budget ne bloque jamais (le restant est toujours ≥ 0). Si un vrai coût apparaît un jour pour facecam, il faudra revoir ce point.
- La limite de 15 Go est accordée d'après la séance (ou la version) de la prise : un envoi `rush` vers une séance mêlant avocat et facecam a droit à 15 Go.
- Les dossiers de travail Python restent sur disque 24 h (purge au redémarrage) : à surveiller quand `/image` écrira des fichiers lourds (lot B : effacer le dossier dès le résultat envoyé sur R2).
- `src/formats/facecam` est 2ᵉ dans `FORMATS` (ordre d'affichage) mais masqué : sans effet aujourd'hui.
