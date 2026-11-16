# Banc d'étude du détourage (C5-5.20)

**But : étude, hors production, gratuite.** Mesurer sur une vraie prise (sur le poste, jamais dans le dépôt) ce que donne un détourage de personne, pour la décision de Williams (C5-5.21). Le banc n'est importé par aucun module du service, n'ajoute aucune route, ne lance rien à l'import, ne dessine rien sur le visage et ne publie aucune image.

> Le texte derrière la tête est PLUS TARD et PAYANT (2e rendu HeyGen) ; ce banc ne l'allume pas.

## Commande

```
cd studio-aligneur
python etudes/banc_segmentation.py PRISE.mp4 --modele /chemin/selfie_segmenter.tflite --sortie /tmp/banc
python etudes/banc_segmentation.py PRISE.mp4 --methode fond-uni --sortie /tmp/banc   # référence sans modèle (fond uni)
python etudes/banc_segmentation.py --aide
```

`--sortie` doit être hors du dépôt : elle reçoit `banc_segmentation.json` et au plus 5 masques de contrôle. `--max-images N` limite la mesure.

## Mesuré (par image, puis moyenne / min / max)

- temps par image (CPU, ms, plus p95) ;
- stabilité : IoU entre images voisines (seuil 0,5), dans [0, 1] ;
- part de bord incertain : pixels entre 0,3 et 0,7 ;
- cheveux et mains : incertitude dans l'anneau de bord (tiers haut = cheveux, tiers bas = mains) ;
- fuites autour de la tête : masque allumé hors de la plus grande composante, moitié haute.

## Seuils proposés pour la décision (C5-5.21)

À confirmer sur la vraie prise : IoU moyen ≥ 0,95 et min ≥ 0,85 ; bord incertain ≤ 2 % de l'image ; fuites ≤ 1 % du masque ; temps ≤ 100 ms par image sur CPU.

## Licences (règle 8)

- MediaPipe (segmentation de personne, `mediapipe==1.1.0` déjà au `requirements.txt`) : Apache 2.0, relevée le 15/11/2026. Le modèle `selfie_segmenter.tflite` (Google, Apache 2.0, même date) est à poser par la personne qui lance le banc ; rien n'est téléchargé ni ajouté au dépôt.
- `fond-uni` : calcul maison (numpy / OpenCV, Apache 2.0), aucune licence payante.
