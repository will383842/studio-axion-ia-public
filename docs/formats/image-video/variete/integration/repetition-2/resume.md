# Répétition générale 2 de la variété « Image → vidéo » (intégration, 17/10/2026)

Refaite après l'intégration (branche `image-video/variete-integration` : master fusionné, 4 défauts corrigés, règle de
l'image figée). **Carte C (chatbot), TikTok 9:16 seulement**, sans aucun appel payant : même script et même méthode que
la 1ʳᵉ répétition (`../repetition/resume.md`) — fiche simulée selon le récit tiré, voix `public/demo/essai-voix.mp3`
bouclée, vrai serveur `studio-rendu` local, vrai service `rendreVersionIV`. Le MP4 n'est pas commité (`.gitignore`).

## Recette

Tirée (graine `repetition-c`) : OUV-E · REC-D · CHI-E · CAM-E · TYP-B · APP-C · TRA-C · FIN-C · MAT-C · SOU-B.
Rendue en TikTok : **OUV-C** (ouverture du 9:16) · REC-D · CHI-E · **CAM-A** · TYP-B (TYP-C sur 1 écran) · APP-C ·
TRA-C · FIN-C · MAT-C · SOU-B.

Seul changement avec la vidéo 1 de la 1ʳᵉ répétition : **CAM-E se replie** (« l'écran côte à côte ne montre pas le
nœud n02 dont parle la voix ») : sur cette carte, l'écran côte à côte allume la 2ᵉ branche avant qu'elle soit dite et
reste ~2,8 s sans changement alors que le rythme en compte ; la règle d'or « rien de compté qui ne soit dessiné » le
refuse désormais par construction (la toile reste).

## Fichier (FFprobe, `mesures.json`)

| Fichier | Durée / ligne | Cadre | Son | Noir max | Figé max | Figé hors voix max | Figés refusés (hors fin) | Occupation OK |
|---|---|---|---|---|---|---|---|---|
| video-1-tiktok.mp4 | 62,44 / 62,44 s | 1080 × 1920 | oui | 0 s | 1,6 s | 1,6 s (dans les 2 dernières s) | **aucun** | 18 / 22 |

Empreinte : `889321d3f77a126d952a7a29e2756ada7bdb7348552b91876869ec7469986598` (12 404 575 octets). Volume −14 LUFS.
Rendu : 1 448 s sur ce poste (4 cœurs).

**Image figée (décision de Will du 17/10)** : jusqu'à 2,5 s tant que la voix parle, 0,5 s hors voix. Avant : 1,6 s
figée relevée et refusée par le critère « 0,5 s hors fin ». Maintenant : aucun passage figé refusé hors fin (le seul
passage figé de plus de 0,5 s sans voix est la fin, jugée à l'œil comme avant).

Occupation : les 4 « NON » sont 6 s (écran de texte TYP-B, mot géant seul, 41 %) et les 3 écrans de fin du cas concret
(54, 57, 60 s : texte petit sur fond nuit), comme sur master et à la 1ʳᵉ répétition.

## Les 4 défauts, revus à l'œil (`images-video-1-tiktok.jpg`)

1. TYP-C : plus de ligne coupée sous son cache (6 s : « ET DEMAIN MATIN, / IL A VU » entiers).
2. Hors cadre : aucun texte coupé sur les 22 images.
3. Repère « k/3 » : en haut à gauche, entre la marque et l'étiquette (12 s, 21 s → 42 s), jamais sur le titre.
4. Contraste : sous-titres à l'encre sur ivoire (24-48 s), clairs sur nuit (0,5 s, 1,5 s, 51 s) ; aucun accent pendant
   l'ouverture. Reste pâle : « combien de messages » à 54 s, sur l'écran de fin du cas concret (inchangé, hors variété).

## Refaire

```
studio-rendu/node_modules/.bin/tsx scripts/image-video/variete/repetition-generale.mts tirage --sortie docs/formats/image-video/variete/integration/repetition-2
studio-rendu/node_modules/.bin/tsx scripts/image-video/variete/repetition-generale.mts rendu --video 1 --version tiktok --budget 2400 --sortie docs/formats/image-video/variete/integration/repetition-2
studio-rendu/node_modules/.bin/tsx scripts/image-video/variete/repetition-generale.mts mesures --sortie docs/formats/image-video/variete/integration/repetition-2
python3 -I scripts/image-video/variete/grille-images.py <dossier>/images-video-1-tiktok.jpg <dossier>/images video-1-tiktok studio-rendu/compositions/commune/polices
```

Le rendu d'une version prend ~25 min sur 4 cœurs : avec le budget par défaut (540 s), chaque passage tue les scènes en
cours et n'en finit aucune ; d'où `--budget 2400` en un seul passage. Mesures : Pillow, numpy et scipy nécessaires.
