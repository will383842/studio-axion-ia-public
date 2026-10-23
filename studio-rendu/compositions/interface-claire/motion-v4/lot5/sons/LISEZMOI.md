# Bruitages synthétisés du lot 5 (maison, aucun échantillon tiers, CC0)
- `boum.wav` (0,55 s) : impact grave (sinus 42 Hz à hauteur qui retombe + attaque 90 Hz), pour la `DalleClaquee`.
- `whoosh-grave.wav` (0,7 s) : bruit rose filtré < 650 Hz, pour le `MotDerriere` (« whoosh-in grave »).
- `montee.wav` (0,62 s) : sinus qui monte de 1,2 à 2,6 kHz (+ 2ᵉ harmonique), pour le `PanneauFin` (le « son qui monte » de la référence LinkedIn, 78,4-79 s).
Produits par `ffmpeg -f lavfi` (voir la commande dans `rendre-lot5.mjs`, fonction `fabriquerSons`).
