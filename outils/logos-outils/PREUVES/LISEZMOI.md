# Preuves des logos d'outils

Un dossier par logo récupéré : `PREUVES/<id>-<AAAA-MM-JJ>/`, écrit par `outils/logos-outils/recuperer.mts`.

Il doit contenir :

- `charte.<ext>` : la page de charte (ou la licence) de l'outil, **copiée telle quelle et datée** (fichier local fourni par l'humain, jamais téléchargé par l'outil) ;
- `preuve.json` : `id`, `source` (pack ou `simple-icons@<version exacte>`), `version` (exacte, jamais une plage), `sha256` du SVG, `date` (AAAA-MM-JJ), `licence` du fichier, `charte`, `charteSha256`, `luParUnHumain`.

Règles :

- « Vérifié » veut dire seulement : page copiée, datée, **lue par un humain** (règle 8). L'outil n'écrit jamais `statut: "valide"` ; le passage à `valide` au manifeste est un geste humain.
- Dépôt public : seuls les tracés sous licence permettant la redistribution (Simple Icons, CC0) y entrent. Un kit dont la charte l'interdit va en stockage privé (option `sortie` hors dépôt), seule l'empreinte allant au manifeste.
- Refus : licence Simple Icons autre que CC0, version non figée, charte absente, empreinte différente, SVG refusé par `assainirSvg`.

Ce dossier ne contient aucune vraie preuve tant que la décision F1 n'est pas prise (fiche C8-L09).
