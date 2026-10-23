# Images des cas (objet `telephone-capture`)

Depuis V4-1, une étape dont le visuel est l'objet `telephone-capture` peut déclarer l'image qu'elle montre dans le
téléphone (`visuel.image` du cas : clé de stockage, largeur, hauteur). La chaîne (`imagesDuCas`, étape « Les vrais
écrans ») vérifie que le fichier est **déposé** ; sinon l'étape prend un objet de repli dessiné
(`telephone-notification`) et une ligne « Téléphone de … dessiné sans image » apparaît dans les vérifications. Plus
jamais de téléphone vide.

## Image du cas « recrutement-apporteurs » (l'annonce de la v4) — À DÉPOSER, rien n'a été téléversé

- Fichier : `docs/formats/v4-reference/rushes/pub.png` (1080 × 1920, PNG, 1,3 Mo).
- Clé attendue : `visuels-cas-concret/recrutement-apporteurs/annonce.png` (dans le seau R2 du studio, `$R2_BUCKET`, à la
  racine, sans préfixe d'environnement : la même clé sert à tous les environnements).
- Type : `image/png`.

Marche exacte (session studio, poste qui a les accès R2 ; une seule fois) :

    # avec wrangler (Cloudflare), connecté au compte du studio
    npx wrangler r2 object put "$R2_BUCKET/visuels-cas-concret/recrutement-apporteurs/annonce.png" \
      --file docs/formats/v4-reference/rushes/pub.png --content-type image/png --remote

    # ou avec l'interface S3 de R2 (aws CLI)
    aws s3 cp docs/formats/v4-reference/rushes/pub.png \
      "s3://$R2_BUCKET/visuels-cas-concret/recrutement-apporteurs/annonce.png" \
      --content-type image/png --endpoint-url "https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com"

Vérifier : la prochaine fabrication du cas ne doit plus afficher la ligne « Téléphone de « L'annonce » dessiné sans
image » dans ses vérifications.

## Ajouter une image à un autre cas

1. Déposer le fichier sous `visuels-cas-concret/<id-du-cas>/<nom>.png|jpg` (forme imposée par le schéma du cas).
2. Dans le cas : `visuel: { sorte: "objet", objet: "telephone-capture", image: { cle, largeur, hauteur } }`.
3. L'image est montrée entière dans l'écran du téléphone (règle de l'objet : jamais rognée).

Autre voie possible (non prise, à décider) : servir l'image depuis `public/` par la recopie automatique
(`cleLisibleParLeRendu`), ce qui demande d'ajouter un dossier à `PUBLICS_LISIBLES` (`src/services/etalonnage.ts`), une
liste relue pour la sécurité.
