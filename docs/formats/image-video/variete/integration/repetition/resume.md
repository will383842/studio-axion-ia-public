# Répétition générale de la variété « Image → vidéo » (lot F, 17/10/2026)

3 vidéos de bout en bout, **sans aucun appel payant** : cartes C, D, E des fixtures, fiches simulées écrites selon le
récit tiré, voix = `public/demo/essai-voix.mp3` bouclée par FFmpeg (mots par `pisteSimulee`), bruitages de
`public/bruitages/`, rendu par le **vrai serveur `studio-rendu`** lancé en local (`STUDIO_RENDU_ESSAI=1`, faux seau HTTP)
et le vrai service `rendreVersionIV` (scènes par bloc, puis montage `complet`).
Script : `scripts/image-video/variete/repetition-generale.mts` (`tirage`, `rendu --video N --version tiktok|linkedin`,
`mesures`). Le **4:5 est allumé pour la répétition seulement** (version LinkedIn) ; il reste éteint dans le studio
(`FORMAT_4X5_PRET_IV = false`).

**Les MP4 ne sont pas commités** (`.gitignore`). La release GitHub brouillon a été refusée à cette session (HTTP 403,
« Creating, editing, or deleting releases is not permitted for this session type ») : les vidéos sont donc découpées
en images, une planche par fichier (`images-video-N-<version>.jpg`, toutes les images extraites).

## Recettes tirées (graine = identifiant de la vidéo, historique enchaîné)

| Vidéo | Carte | Recette tirée | TikTok 9:16 (rendue) | LinkedIn 4:5 (rendue) |
|---|---|---|---|---|
| 1 | C | OUV-E · REC-D · CHI-E · CAM-E · TYP-B · APP-C · TRA-C · FIN-C · MAT-C · SOU-B | OUV-**C** · … · CAM-E · TYP-B (repli TYP-C sur 1 écran) | OUV-E · … · CAM-**B** · TYP-**C** · FIN-**D** |
| 2 | D | OUV-D · REC-C · CHI-D · CAM-B · TYP-C · APP-D · TRA-D · FIN-C · MAT-C · SOU-C | OUV-D · … (replis REC-C, CAM-B, APP-D, TRA-D : la carte D n'a pas de toile) | OUV-**B** · … · FIN-**D** · SOU-**B** |
| 3 | E | OUV-B · REC-D · CHI-C · CAM-B · TYP-B · APP-B · TRA-C · FIN-C · MAT-B · SOU-B | OUV-**A** · … (repli TYP-C sur 1 écran) | OUV-B · … · TYP-**C** · FIN-**D** |

Ressemblance de recette deux à deux : **1-2 : 12,9 %**, **1-3 : 38,7 %**, **2-3 : 19,4 %** (toutes < 60 %).
Détail : `recettes.json`. Planche des 3 tirages (TikTok, mêmes instants) : `planche-tirages.jpg`.

## Fichiers rendus (FFprobe, `mesures.json`)

| Fichier | Durée / ligne de temps | Cadre | Son | Noir max | Figé max | Occupation OK | Empreinte (sha256) |
|---|---|---|---|---|---|---|---|
| video-1-tiktok.mp4 | 62,44 / 62,44 s | 1080 × 1920 | oui | 0 s | 1,6 s | 18 / 22 | `fcb32974d74e6ff30ef9f1f4eec6cc85c781375bcb65f46fa9b69ea05b5c5412` |
| video-1-linkedin.mp4 | 54,12 / 54,12 s | 1080 × 1350 | oui | 0 s | 1,6 s | 12 / 20 | `56b5bec19ffc436e232934c21d943b7ff48da900916ed75c4040cbb572f53b12` |
| video-2-tiktok.mp4 | 53,32 / 53,32 s | 1080 × 1920 | oui | 0 s | 2,56 s | **1 / 19** | `498f762ed8ea95a228e00eb33cacd2a06937fc3394f23c642031e8fb95666c19` |
| video-2-linkedin.mp4 | 44,68 / 44,68 s | 1080 × 1350 | oui | 0 s | 1,6 s | 8 / 16 | `5eddd60995a5e9f7cf9484bacf5154453f1602ca250ca8f384e03168f296f3dc` |
| video-3-tiktok.mp4 | 50,44 / 50,44 s | 1080 × 1920 | oui | 0 s | 1,6 s | 8 / 18 | `a5582a4658dc7dd5fd549035c7039673b77b3d4a1eb2ec97ad78a8274626cf58` |
| video-3-linkedin.mp4 | 41,76 / 41,76 s | 1080 × 1350 | oui | 0 s | 1,6 s | 8 / 15 | `5631d6dfe90be2f9631b875475838a58de1f5b6ab8f6455649db0321046ec439` |

Temps de rendu : 5 à 15 min par fichier (une scène à la fois sur ce poste).

## Critère de fin du § 5 : ce qui passe, ce qui ne passe pas

- Durée = ligne de temps ± 0,1 s : **oui** (écart 0 sur les 6). Cadre 1080 × 1920 / 1080 × 1350 : **oui**. Son : **oui**.
  Aucune image noire : **oui**.
- Aucune image figée > 0,5 s hors fin : **NON**. FFmpeg (`freezedetect`, −60 dB, 0,1 s) relève 7 à 26 passages figés
  de 0,5 à 2,6 s par fichier : ce sont les écrans tenus pendant une phrase (texte posé, carte qui attend son mot). Le
  critère, tel qu'écrit, est plus strict que le rythme actuel du moteur ; à trancher (seuil, ou micro-mouvement).
- Occupation (doc 76) : **55 images sur 110 passent**. Les fins (3 derniers écrans de chaque TikTok, empruntés au cas
  concret) sont à 5-7 % : vérifiées à l'œil, elles sont **vides** (texte petit sur fond nuit), comme sur master.

## Défauts vus à l'œil (toutes les planches regardées)

1. **Écrans de texte TYP-C qui attendent leur ligne** : vidéo 2 à 1,5 s (écran ivoire vide, « ce matin. » seul), 6 s
   (« ET » seul), 9 s (« ATTENDENT » + une ligne coupée à mi-hauteur) ; vidéo 1 à 6 s (« IL A VU » coupé). La ligne
   suivante glisse sous un cache et reste illisible pendant plusieurs dixièmes de seconde.
2. **Texte qui sort du cadre** : vidéo 3 à 33 s, « BON DE COMMANDE MARTIN » coupé à droite (en-tête trop long) ;
   LinkedIn 1 à 0,5 s, la carte « ALERTE TELEGRAM » d'OUV-E coupée à droite en 4:5.
3. **Repère « k/3 » posé sur l'en-tête** (REC-D) : vidéo 1 à 21 s (sur « 80 % »), LinkedIn 1 de 33 à 42 s, vidéo 3 de
   18 à 33 s : la pastille recouvre l'étiquette ou le titre.
4. **Texte illisible** : vidéo 3 à 1,5 s, « POUR RETROUVER » encre sur nuit (OUV-A, 2ᵉ image) ; sous-titres gris très
   pâles sur ivoire (vidéo 2 à 42 s « L'IA gère », vidéo 3 à 36 s, LinkedIn 1 à 45-48 s) ; sous-titre SOU-C « VINGT
   E-MAILS » en contour, sur l'appoint de l'ouverture (vidéo 2 à 0,5 s).
5. **LinkedIn 4:5** : sous-titres posés sur les cartes de la toile (12 s) et sur les chiffres de la vue d'ensemble
   (15-18 s, « 23h14 · 4 sec · 2h » mêlés au sous-titre) ; FIN-C/FIN-D : « MÊME À TROIS » (sous-titre) sur la
   phrase-choc (51 s).
6. **Carte D** : la recette tirait REC-C, CAM-B, APP-D, TRA-D, impossibles sur une image sans toile (4 replis) : les
   `possibles` de ces axes ne regardent pas si la mise en scène aura une toile.
7. **Vues fugitives** : balayage orange TRA-C plein écran (vidéo 3 à 27 s, LinkedIn 1 à 30 s) et titres flous en cours
   d'apparition : normaux sur 0,4 s, mais ils tombent sur les instants de mesure.
8. **FIN-C tirée pour les 3 vidéos** en 9:16 (l'historique ne pèse la fin qu'à 1 sur 15,5).
9. Non fait : la porte unique (`porteUniqueIV`) sur ces MP4 avec transcription simulée ; elle est exercée en doubles
   par `tests/image-video/variete/assemblage.test.ts` (fabrication complète, 6 fichiers).

## Refaire

```
studio-rendu/node_modules/.bin/tsx scripts/image-video/variete/repetition-generale.mts tirage
studio-rendu/node_modules/.bin/tsx scripts/image-video/variete/repetition-generale.mts rendu --video 1 --version tiktok   # relancer tant qu'il dit « Pas fini »
studio-rendu/node_modules/.bin/tsx scripts/image-video/variete/repetition-generale.mts mesures
python3 -I scripts/image-video/variete/grille-images.py <sortie.jpg> <dossier>/images video-1-tiktok studio-rendu/compositions/commune/polices
```
