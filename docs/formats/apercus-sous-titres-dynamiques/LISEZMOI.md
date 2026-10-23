# Sous-titres dynamiques du tableau — aperçus réels (17/10/2026)

Fiche réelle de la vidéo v-6616b3800357 (« Réunion finie depuis trois jours… »), style par défaut « Pastille Axion »,
intensité équilibrée. Tout est rendu par le moteur (Remotion : `TableauScene` pour la page, `SousTitres` pour le calque),
par la chaîne de la fabrication (`segmentsSousTitresTableau`) : rien n'est redessiné à la main, aucun appel payant
(minutage réaliste, pas de voix).

Pour refaire les images : `npx tsx tests/tableau/sous-titres-dynamiques/apercus.mts` (après `npm ci` dans `studio-rendu`, et
avec `numpy` et `Pillow` installés pour Python).

- `<moment>-<fond>-<format>.jpg` : 4 moments × 3 fonds × 9:16 (`vertical`) et 4:5 (`portrait`) :
  - `accroche` : « DEPUIS TROIS JOURS » en **Impact** (pastille orange clair, capitales, plus grande, penchée de 2° en 9:16
    et de 1° en 4:5) ;
  - `chiffre` : « EN DIX MINUTES » en **Impact** (le chiffre dit compte comme un chiffre) ;
  - `bandeau` : « UN NOM FAUX » en **Bandeau** (rectangle ivoire cerné d'encre, mot dit en terracotta foncé) ;
  - `base` : « qui s'en charge, » au style de base (pastille sombre, mot dit en orange clair).
- `planche-vertical.jpg`, `planche-portrait.jpg` : les moments en lignes, les fonds en colonnes.
- `video-test-ardoise-vertical.mp4` : 10 s de l'ardoise en 9:16 (36,5 s → 46,5 s), à 12 images/s : groupe de base,
  phrase clé en Bandeau, soulignement, Impact « PARTAIENT TROIS », groupe important « jours après. ».
  `planche-mouvement-1.jpg` et `planche-mouvement-2.jpg` : la même vidéo à 6 images/s, de 2,3 s à 4,3 s (le Bandeau
  « UN NOM FAUX » entre en fondu, sans glisser) puis de 7,6 s à 9,6 s (l'Impact « PARTAIENT TROIS » penche de 2°, puis
  « jours après. » reste plus gros, avec « jours » en orange).
- `resume.json` : pour chaque image, le groupe, son style, son importance, son inclinaison, la bande et les pixels hors
  charte (vert, bleu, violet) dans la bande.

Ce qu'on a vérifié en regardant les images : chaque groupe se lit, il reste dans la bande basse, sous le contenu de la
page, et rien ne monte sur la page. Pixels verts, bleus ou violets dans la bande : 0 sur les 24 images.
