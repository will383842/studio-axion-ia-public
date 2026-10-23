# Plan du moteur « Face caméra » (facecam) — v1, 08/10/2026

> ⚠️ **08/10 soir : `PLAN-IMPLEMENTATION-FACECAM.md` (v3) PRIME sur ce document.** Décisions de Will : PAS de fond flouté ni de sujet décroché (look « studio sombre » et cible « fond Y 35-60 » abandonnés), anti-grain, bonne mine, écran partagé texte en haut, motion design, tout gratuit.


> Demande de Will (08/10) : `EXIGENCES-WILL.md` (même dossier). Ce sera **le format le plus fabriqué**, niveau « monteur très professionnel ».
> Bases : inventaire du dépôt `studio-axion-ia` (master 03d297b) + recherche web du 08/10 (sources en fin de fichier).
> **Rien n'est codé.** Étape 0 (essai sur une vraie vidéo de Will) AVANT toute construction ; maquettes des 2 écrans nouveaux à valider (règle « 1-2 écrans avant la série »).

## 0. Principe

**Environ 90 % du rendu « pro » est gratuit, sur notre serveur** : montage piloté par la transcription, multicaméra par recadrage, étalonnage mesuré sur le visage, chaîne voix, sous-titres et rythme. Les outils IA payants (rééclairage, agrandissement, angles générés) ne sont que des **options, passage par passage, avec devis**, et seulement après essai sur les vidéos de Will : aucune source ne prouve qu'ils laissent les lèvres intactes sur une vidéo parlée.

## 1. Ce qui existe déjà et sera réutilisé

| Brique existante | Où | Réutilisation |
|---|---|---|
| Famille de formats `face-camera` (recette, modes `teleprompteur` / `trame`) | `src/formats/familles/face-camera.ts` | le nouveau format en hérite |
| Personnage de source `rush` (vraie vidéo) | `DefinitionFormat.personnages.sources` | source du format |
| « Monter ma prise » (prise « je lis » calée sur le texte validé, assemblée, sous-titrée, **un seul angle**) | `services/fabrication-reseaux.ts` `monterJeLis`, `briques/declinaison` | point de départ du chemin « prise réelle » |
| Aligneur au mot (CTC, Python) | `studio-aligneur/` | horodatage mot à mot de la prise |
| Nettoyage des blancs | `moteurs/montage-avocat/nettoyage.ts` | étendu aux reprises, faux départs, début/fin |
| Découpage en plans, cadrage `principal`/`second`, zoom lent | `moteurs/montage-avocat/decoupage.ts`, `briques/composition/scene.ts` | généralisé à 3 valeurs de plan sur une source 16:9 |
| Composition FFmpeg une passe + Remotion texte, export H.264 BT.709 | `studio-rendu/src/operations/composition.ts` | inchangé |
| LUT (4 « Axion » + intensité) | `src/lib/lut3d`, `donnees/luts-axion.ts` | « look » après la correction |
| Chaîne voix (passe-haut, compresseur, de-esser, −14 LUFS, crête vraie) | `studio-rendu/src/son/chaine.ts` | précédée d'un débruitage |
| Sous-titres (Karaoké, Minimal, Impact, Bandeau), zones protégées | `briques/sous-titres` | inchangé |
| Régulateur d'intensité + bruitages | `briques/intensite` | inchangé, compte aussi les changements de plan |
| Illustrations (Mes images → banques → fabrication) | `moteurs/montage-avocat/fabrication-illustrations.ts` | B-roll, avec J-cut / L-cut |
| Analyse d'un fichier (ffprobe : orientation, HDR, cadence) | `studio-rendu/src/operations/analyse-media.ts` | **sens inversé** : on convertit au lieu de refuser |
| Export par réseau, Buffer | `services/fabrication-reseaux.ts`, `reseaux/` | inchangé |

**Écarts constatés** : le plan R7a (`PLAN-OUTILS-REELS`) et le plan avocat (l. 554-560) prévoient de **refuser** horizontal et HDR → pour ce format on les **accepte et on convertit**. L'enregistreur intégré filme en 1080×1920 caméra avant (`Enregistreur.tsx`) : il reste pour le mode rapide, mais le chemin principal devient l'**envoi d'un fichier iPhone** (gros fichier, envoi par morceaux).

## 2. La chaîne, du fichier iPhone à la publication

[S] = gratuit sur notre serveur (sans carte graphique) · [API] = payant à l'usage, option avec devis.

| # | Étape | Comment | Coût |
|---|---|---|---|
| 1 | **Réception** | envoi par morceaux vers R2 ; `ffprobe` (rotation, HDR, cadence, définition) ; HLG → SDR BT.709 (`zscale` linéaire → `tonemap=hable:desat=0` → BT.709, puis reprise du point noir, piège du HLG Apple) ; Apple Log → LUT officielle ; fichier de travail léger | [S] |
| 2 | **Son** | DeepFilterNet3 (CPU, ~0,2 s par s de son) puis chaîne existante ; si la pièce résonne : ElevenLabs Voice Isolator (déjà branché, ~0,12 $/min) ; ton de pièce sous les coupes | [S] / [API] faible |
| 3 | **Transcription au mot** | aligneur existant si texte validé ; sinon Whisper (faster-whisper CPU) ou ElevenLabs Scribe | [S] / [API] faible |
| 4 | **Décisions de montage par Claude** | liste de montage JSON : début et fin à jeter, **phrases reprises (garder le dernier essai complet et fluide)**, faux départs, « euh », blancs > 0,4 s (on garde 2-4 images de marge, pas toutes les respirations) ; valeur de plan à chaque coupe ; emplacements B-roll (J-cut / L-cut) ; mots-clés des sous-titres ; rupture de rythme toutes les 3-6 s ; accroche remontée si utile | quelques centimes |
| 5 | **Suivi du visage** | MediaPipe Face Detector, 1 image sur 2-3, interpolation ; lissage aller-retour (pas de retard) ; **cadre fixe par plan**, zone morte ~15 %, recentrage seulement aux coupes ; yeux à 35-40 % de la hauteur en 9:16 | [S] |
| 6 | **Image** | mesure sur la zone du visage : balance des blancs (`grayworld` en linéaire), exposition et contraste (`eq`/`curves`) vers une cible de luminance du visage (~60-70 %), relevée des ombres, teinte de peau ; **un seul réglage par prise** (médiane : pas de couleur qui « pompe », plans harmonisés) ; débruitage `hqdn3d` (ou `nlmeans` si le temps le permet) ; netteté légère `cas` ; puis LUT « look » à l'intensité du format | [S] |
| 7 | **Multicaméra par recadrage** | 3 valeurs sur la colonne 9:16 d'une source 4K (1215×2160) : **large 100 %, moyen ~115 %, serré 125-130 % max** (au-delà l'image devient molle) ; changement uniquement sur une coupe, entre deux mots ; écart ≥ 15 % entre deux plans qui se suivent ; pas deux coupes à moins de 1 s ; serré sur les phrases fortes, large sur les respirations et avant un B-roll ; zoom doux 100 → 108 % pour masquer une coupe sèche | [S] |
| 8 | **Composition** (existant) | sous-titres dans l'**union des zones sûres** TikTok / Reels / Shorts (1080×1920 : haut 288, bas 672, gauche 120, droite 192) ; B-roll ; chiffres animés ; bruitages ; intensité | [S] |
| 9 | **Formats de sortie** | 9:16 (TikTok, Reels, Shorts, LinkedIn mobile) ; 4:5 (fil LinkedIn et Instagram, conseillé pour les dirigeants) ; 1:1 en option ; 16:9 (LinkedIn bureau, YouTube) — chaque format a SA fenêtre de recadrage et SES positions de texte | [S] |
| 10 | **Contrôle qualité** (idée « Watch ») | images par plan + transcription : aucune phrase manquante ni en double, visage jamais coupé, yeux dans la zone, luminance du visage dans la cible, sous-titres calés, −14 LUFS / −1 dBTP | [S] + centimes |
| 11 | **Validation par Will** | sur téléphone ; retouches d'un toucher (voir § 4) ; puis Buffer | — |

## 3. Options payantes (désactivées par défaut, devis avant, passage par passage)

| Option | Outil candidat | Ordre de prix (à revérifier) | Règle |
|---|---|---|---|
| Rééclairage IA du visage | Higgsfield Video Relight (connecteur branché), Magnific Relight ; Beeble SwitchLight (le plus sûr pour les lèvres) n'a pas d'API | ~27 $/min (Higgsfield) | **accroche seulement** au début ; essai sur 5 passages de Will, lèvres vérifiées |
| Agrandissement des plans serrés > 130 % | Topaz Starlight Fast, SeedVR2 (fal) | ~3,5 $/min | seulement les passages serrés |
| Angles générés (côté, d'en bas) | Seedance / Runway Aleph / Higgsfield 3D + resynchro des lèvres (HeyGen précision 4 $/min, sync.so, Kling) | ~15 $/min et plus | **plans sans parole visible** seulement ; jamais par défaut (risque « ce n'est pas tout à fait lui ») |
| Correction du regard | NVIDIA Maxine (GPU loué, licence) | non publié | inutile si le téléprompteur à vitre est utilisé (texte dans l'axe de l'objectif) |

## 4. Écrans nouveaux (maquettes à valider avant tout)

1. **« Coupes »** : la vidéo en frise ; passages retirés grisés et étiquetés (« début », « reprise », « blanc ») ; résumé « 3 reprises coupées · 12 s au début » ; **rétablir d'un toucher** ; rien n'est jamais effacé.
2. **« Image »** : avant / après en glissant le doigt ; curseurs Lumière et Couleurs (intensité de la correction) ; choix du « look » ; cadrage ajustable par format (déplacer la fenêtre).

## 5. Fiche de tournage (une page, pour Will)

- iPhone **à l'horizontale**, sur pied, à hauteur des yeux, objectif **1x** (pas 0,5x) ; **4K 30 i/s** ; **HDR Vidéo coupé** (le studio sait le convertir, mais le résultat est meilleur sans).
- **Sujet au centre** (pas sur les tiers), cadre poitrine à 1-1,5 m, ~10 % d'air au-dessus de la tête, épaules entières, fond à plus de 1 m.
- **Verrouiller exposition et mise au point** (appui long sur le visage, puis baisser un peu la luminosité).
- Lumière : une fenêtre ou une lampe **devant** soi, jamais derrière.
- Texte du téléprompteur dans l'axe de l'objectif (vitre).
- On peut se tromper et reprendre la phrase : le studio coupe ; pas besoin de couper la caméra.

## 6. Ordre de construction (lots)

| Lot | Contenu | Condition |
|---|---|---|
| **F0** | Essai sur la **vidéo test de Will** (1 min, vraies conditions, avec reprises et début à jeter), hors studio, sur le serveur : conversion, son, étalonnage mesuré, recadrage suivi, 3 valeurs de plan → **avant / après montré à Will** + mesures | vidéo test de Will |
| F1 | Format « Face caméra » déclaré (famille `face-camera`, source `rush`, ratios 9:16, 4:5, 1:1, 16:9) ; envoi de gros fichiers ; analyse qui **convertit** (HDR, Log, rotation) | feu vert F0 |
| F2 | Son : DeepFilterNet3 (dans le conteneur Python de l'aligneur) + Voice Isolator en option | — |
| F3 | Transcription + décisions de montage (reprises, début/fin, blancs) + écran « Coupes » | maquette validée |
| F4 | Suivi du visage + recadrages par format + multicaméra par recadrage | — |
| F5 | Étalonnage mesuré + débruitage + netteté + écran « Image » | maquette validée |
| F6 | Branchement des briques existantes (sous-titres, B-roll J/L-cut, intensité, bruitages, chiffres) ; défauts du format | — |
| F7 | Contrôle qualité facecam | — |
| F8 | Options payantes, une à une, chacune après essai et accord de Will | accord de Will par option |

Règles de chantier : sessions locales et cloud selon les ordres en vigueur ; une seule commande lourde à la fois sur le PC (les traitements vidéo tournent sur le **serveur**, jamais sur le PC) ; ne pas redémarrer le conteneur du studio sans prévenir la session studio.

## 6 bis. Résultats de l'essai F0 (08/10, IMG_7747.MOV, traité sur le serveur, dossier `F0-essai-IMG_7747/`)

- **Source** : 3840×2160, **25 i/s, SDR (HDR coupé)**, H.264 22 Mb/s, 2 min 11 s, rotation 180° (iPhone retourné, corrigée automatiquement), micro-cravate DJI, son AAC stéréo.
- **Cadre** : sujet centré, plan poitrine, yeux à ~34 % de la hauteur → le recadrage 9:16 tient sans suivi (cadre fixe) ; serré 125 % net. Coins noirs visibles en haut à droite / bas à gauche (bord de la vitre du téléprompteur) → hors champ en 9:16, **recadrage ≥ 5 % nécessaire en 16:9**.
- **Lumière** : lumière mixte (froide à gauche, lampe chaude à droite), visage un peu gris et plat, mur clair qui « mange » le sujet. Luminance moyenne 129/255 (pas sous-exposé).
- **⚠️ Piège confirmé** : la balance des blancs automatique sur toute l'image (`grayworld`) rend l'image ORANGE (le pull bleu trompe le calcul) → la correction doit être **mesurée sur la peau et le mur**, jamais sur l'image entière.
- **Correction retenue pour l'essai** (gratuite) : `colorbalance` léger vers le chaud dans les tons moyens, `eq` contraste 1,09 / saturation 1,12, courbe en S douce, `hqdn3d`, `cas` 0,45, vignette → peau plus vivante, fond assombri, sujet détaché.
- **Son** : **−29,4 LUFS** (très faible) et crête vraie **+0,2 dBTP** (saturation ponctuelle) → après chaîne : −15,0 LUFS, −1,5 dBTP.
- **Coupes détectées** : début à jeter **0 → 15,1 s** (chaise vide, installation) ; **reprise** « Quel que soit votre taille. Si vous sentez que du temps… » **101,8 → 111,2 s** (on garde l'essai de 111,2 s) ; fin à jeter **118,3 → 130,7 s** (départ de la chaise). Durée utile ≈ 94 s sur 131.
- **Transcription** : Whisper « small » fait des fautes sur les noms (ActionIA, odite, Calliopee) → en production, toujours caler sur le **texte validé** (aligneur existant) et le dictionnaire de prononciations.
- Durées de calcul sur le serveur (3 cœurs, priorité basse) : extrait de 15 s monté en ~1 min ; transcription de 2 min en quelques minutes.

## 6 ter. Après l'étude des références (08/10) — la fiche de style (non publiée) PRIME sur les chiffres ci-dessus

- **Changement d'emplacement de caméra** (demande de Will) : chez les pros = **vraie 2ᵉ caméra** (un créateur de référence « Summit » : A de face regard objectif, B à 30-40° plus serrée, alternance toutes les 2,9 s). Le recadrage ne change que la valeur de plan. Angle par IA sur visage parlant : **déconseillé**. → Recommandation : **2 iPhones filmant en même temps** (A face, B 35-40° côté) + option 3ᵉ en contre-plongée (téléphone posé bas) ; le studio **synchronise les caméras par le son** (nouvelle brique, lot F4b) et alterne entre phrases. À défaut : 2 prises du même texte (calage phrase par phrase sur le texte validé).
- **Rythme** : 1 angle → jump cut toutes les 1,5-2,5 s + punch-in ×1,10-1,20 toutes les ~3 coupes ; 2 angles → changement toutes les 2,5-3,5 s ; jamais > 8 s sur le même cadre ; silences > 0,25 s retirés.
- **Lumière** : look « studio sombre » visé = visage Y 110-125, fond Y 35-60, peau réchauffée, fond désaturé + flouté par détourage, vignette (essai F0 « lumière virtuelle » = MediaPipe segmentation + lampe virtuelle, OK, halo à corriger). La lumière **latérale** vient du tournage (fenêtre à 45°, lampe chaude dans le fond, pas de mur blanc nu) ou d'un relight IA payant.
- **Sous-titres** : 1-4 mots, blanc gras, sans encadré ni emoji, à 55-72 % de la hauteur, mot-clé ×2-3 ou orange ; encadré-titre blanc en haut (accroche, pas de nom/marque).
- **Illustrations** 5-15 % (titres géants animés sur chiffres/dates surtout) ; **accroche** en pleine phrase, élément animé < 1,5 s, 1ʳᵉ coupe < 2 s ; **fin** coupe sèche en boucle.
- **Dents** : blanchiment naturel faisable gratuitement (masque bouche, lot F5) ; redresser = non fiable, essai éventuel seulement.

## 6 quater. Décisions de Will (08/10, fin de journée)

- **Une seule caméra** (iPhone 16 Pro Max), pas de 2ᵉ téléphone → style par défaut **« 1 angle »** : jump cuts toutes les 1,5-2,5 s + punch-ins + 3 valeurs de plan par recadrage. Option proposée : **2 prises successives** du même texte (iPhone déplacé de côté) pour un vrai changement d'angle, calées phrase par phrase sur le texte validé.
- **Lumière : Will « n'y arrive pas » au tournage** → c'est le studio qui doit la faire : lumière virtuelle + fond assombri/flouté (gratuit) par défaut ; aucune consigne de lumière exigée au tournage (conseils facultatifs seulement).
- **GRATUIT UNIQUEMENT** pour commencer (« on va rester en gratuit et on verra ce que ça donne ») : le lot F8 (options payantes) est **retiré du périmètre** ; aucun appel payant dans le moteur facecam.
- Couper les erreurs et reprises : confirmé comme exigence centrale (déjà en § 2 étape 4).

## 7. Questions à Will

1. ~~Quel iPhone ?~~ → **iPhone 16 Pro Max** (réponse de Will, 08/10). 4K max (pas d'« open gate », réservé au 17 Pro) → serré natif ≤ 125-130 % confirmé ; Apple Log (v1) et ProRes disponibles ; réglage retenu : caméra arrière 1x, 4K 25 i/s (cohérent avec l'essai F0 et HeyGen) ou 30 i/s, HEVC, SDR. Apple Log = essai « expert » plus tard (plus de latitude pour la lumière, mais grain dans les ombres) — le studio saura appliquer la LUT officielle Apple Log.
2. Caméra arrière derrière la vitre du téléprompteur, ou caméra avant ?
3. Budget plafond des options payantes par vidéo (ex. 0 € par défaut, jusqu'à 5 € sur accord) ?

## Sources (recherche du 08/10/2026)
- Tournage iPhone : petapixel.com (Final Cut Camera 2.0), leeminglutpro.com (guide iPhone), teleprompter.com, ulanzi.com.
- HDR → SDR : instagit.com/browser-use/video-use ; lists.cinelerra-gg.org (point noir HLG Apple).
- Rééclairage : developer.beeble.ai/pricing ; omidsaffari.com (Higgsfield Video Relight) ; magnific.com/ai/docs/relight ; docs.dev.runwayml.com/guides/pricing ; atlabs.ai.
- Agrandissement : fal.ai/models/topaz/upscale/video/generative ; developer.topazlabs.com ; fal.ai/models/fal-ai/seedvr/upscale/video.
- Étalonnage : ffmpeg.org (vf_grayworld).
- Recadrage et zones sûres : upload-post.com/tools/safe-zone-checker ; reap.video ; adaptlypost.com ; authoredup.com (LinkedIn).
- Lèvres : sync.so/pricing ; fal.ai (Kling lipsync) ; help.heygen.com (API pricing) ; huggingface.co/ByteDance/LatentSync-1.6.
- Son : elevenlabs.io/pricing/api ; auphonic.com/pricing ; arxiv.org/pdf/2305.08227 (DeepFilterNet) ; forasoft.com (LUFS 2026).
- Outils de montage auto : captions.ai ; descript.com (Underlord) ; aiindigo.com (AutoCut) ; nofilmschool.com (Eddie AI).
- Regard : docs.nvidia.com/nim/maxine/eye-contact.
