# Tableau animé · essai réel de la plus petite première version (TB-06b)

Mode d'emploi pour la **session locale du studio**, après l'accord de dépense de Will. La chaîne et son lanceur
(TB-06a) ont tourné **une première fois pour de vrai** (essai du 11/10, § 6) ; trois défauts constatés ont été traités
(§ 7).

- Chaîne : `src/moteurs/montage-tableau/fabriquer.ts` (`fabriquerTableau`, tout injecté).
- Lanceur : `scripts/tableau/fabriquer.ts` (branche les vrais outils avec `--reel`).
- Tests : `tests/tableau/fabriquer/` (doubles, aucun appel).

## 1. Ce que fait la commande

1. Lit et valide la fiche (refus = arrêt, code 2, rien n'est construit).
2. Affiche le **coût estimé** (voix seule, tarif HeyGen au taux prudent 1 $ = 1 €) ; s'arrête (code 3) si
   `--accord-depense` est absent ou inférieur.
3. Contrôles d'avant la voix (fiche, variété, déjà-vu, mise en page, première image) ; un bloquant = arrêt (code 4).
4. Voix maître (une lecture payée), juste après le contrôle du budget du mois et la réservation des crédits.
5. Calage, mise en page, fin commune provisoire (phrase de `--fin`, affichée 3,5 s, **non dite**).
6. Rendu des scènes une à une (`TableauScene`, file longue), clé par empreinte : une scène déjà déposée n'est pas
   refaite.
7. Composition `complet` : scènes posées comme plans, voix à −14 LUFS, sous-titres « Encre » (écriture de la charte
   `#110A05`, ni contour ni ombre, Inter Bold) dans la bande réservée, export 9:16, mesures du fichier.
8. Contrôles finaux et compte rendu (coût, durée de chaque étape, scènes rendues ou reprises, clés des fichiers).
9. Écrit la vidéo `v-<videoId>` en **brouillon** (format `tableau-anime`, masqué), jamais publiée.

Une panne ? **Relancer la même commande** : les étapes réussies sont reprises (journal `journal.json` du dossier de
travail), la voix payée n'est jamais relue.

## 2. Pré-requis de mise en ligne

- `master` à jour **déployé**, image `studio-rendu` **reconstruite** (`deploiement/mettre-a-jour.sh`) : elle doit
  contenir les compositions `TableauScene` (TB-05) ; sinon le rendu des scènes répond « Composition introuvable ».
- Variables du lanceur (celles du service `studio`) : `DATABASE_URL`, `STUDIO_RENDU_URL` et `STUDIO_RENDU_CLE`,
  `R2_*` avec `FOURNISSEUR_STOCKAGE=r2`, `HEYGEN_API_KEY`. Le lanceur refuse le mode réel sans `STUDIO_RENDU_URL`,
  sans stockage relié ou avec une voix d'essai.
- Le lanceur doit tourner **là où `studio-rendu` est joignable** (réseau `interne` du compose). L'image du studio est
  une construction `standalone` sans les sources ni `tsx` : prévoir un conteneur ponctuel construit depuis les
  sources sur le réseau `interne`, ou ouvrir l'accès le temps de l'essai (décision de la session locale).
- Le personnage de Williams a une **voix prête** (statut « prêt ») reliée chez HeyGen.
- Budget du mois et crédit HeyGen suffisants (contrôlés par `verifierEtReserver` du studio avant la voix).
- La case du « déjà-vu » a été cochée par Will (date à passer à `--deja-vu`).
- Un fichier de contexte (`--contexte`) relu par Will : `sourcesChiffres`, `preuves` et `matieres` citées par la
  fiche (identifiants, statut `validee`, `perimeLe`), `contenusPreuves` (phrase testée et date, par `preuveId`),
  `prononciations` éventuelles.

## 3. Commande exacte

Répétition à blanc d'abord (simulation, rien de payant, aucun client réel) :

```sh
npx tsx --conditions=react-server scripts/tableau/fabriquer.ts \
  --fiche <fiche.json> --contexte <contexte.json> --personnage <id-williams> \
  --fin "<phrase de fin validée par Will>" --deja-vu <AAAA-MM-JJ> \
  --accord-depense <euros> --dossier <dossier-de-travail>
```

Essai réel : la même commande avec `--reel` (et un `--dossier` neuf, pour ne pas reprendre la simulation).

- `--sorties vertical,carre,…` : formats d'image (défaut `vertical`) ; une seule voix pour toutes les sorties.
- `--accord-depense` : en euros (`0,50` ou `0.50`), au moins le coût affiché.
- `--fin` absent = pas de scène de fin.
- `--conditions=react-server` : les services du studio importent `server-only` (sinon ils refusent de se charger).
- Hors de Next, `--reel` charge `credits` → `auth` → `next/navigation`, `next/headers` : le lanceur pose LUI-MÊME les
  bouchons `scripts/tableau/bouchons-next.cjs` avant ces imports (plus besoin de `--require`). Commande équivalente à la
  main, si besoin : `npx tsx --conditions=react-server --require ./scripts/tableau/bouchons-next.cjs scripts/tableau/fabriquer.ts …`.
  Les bouchons refusent `cookies()`, `headers()`, `redirect()`… (erreur claire) et rendent `next/cache` sans effet.

## 4. Quoi relever

| Relevé | Comment |
|---|---|
| Mémoire du rendu | `docker stats studio-rendu` pendant le rendu des scènes **et** pendant la composition ; noter le pic (plafond 3 Go, critère § 16-4). |
| Durée | Durée de chaque étape (compte rendu) ; temps de file d'une scène et de la composition ; total (cible : moins de 15 min). |
| Coût | « Coût de ce lancement » du compte rendu, comparé à Réglages › Budget (dépense HeyGen enregistrée). |
| 6 images clés | Extraire 6 images de la vidéo (première image, une par page, la fin) : accroche lisible sans le son, texte au-dessus de la bande, sous-titres lisibles sur la page ivoire. |
| Bord droit | Colonnes de droite de la vidéo (trait noir de l'essai du 11/10) : commande du § 7, défaut n° 2. |
| Contrôles | Verdict du compte rendu (volume, crête, image noire ou figée, note de qualité). |
| Reprise | Relancer la même commande : « Scènes rendues : aucune », coût 0. |

Six images clés (exemple, à adapter à la durée) :

```sh
for t in 0 3 <milieu-page-2> <milieu-page-3> <fin-5> <fin-1>; do
  ffmpeg -ss "$t" -i video.mp4 -frames:v 1 "cle-$t.png"
done
```

## 5. Ce qui n'a PAS pu être vérifié sans vrai appel

- **Rendu réel des scènes** : `TableauScene` n'a jamais été rendue par `studio-rendu` en file longue ; durée et
  mémoire inconnues (plan § 4.1 [supposé]).
- **Composition `complet` sans double** : déduite de la lecture du code, pas exécutée. Choix faits :
  - le décor est la teinte de la page de la charte (`#E9DCC8`), sans image ;
  - les scènes couvrent toute la durée (plans d'illustration) : aucun morceau « double » ne doit être monté ;
  - la piste du double désigne le fichier de la première scène (téléchargé par le conteneur, jamais monté) pour garder
    le chemin rapide FFmpeg ; un écart d'arrondi entre la fin du dernier plan et la durée créerait un morceau
    « double » d'une image (à vérifier sur la dernière image) ;
  - les scènes passent par les plans d'illustration et non par `cartesPleinEcran` : ce dernier chemin retire tous
    les sous-titres pendant les cartes.
- **Sous-titres sur la page ivoire** : style « Encre » depuis le 11/10 (§ 7) ; vu sur un rendu local (Remotion +
  FFmpeg 6), pas encore sur une vidéo de production.
- **Voix HeyGen réelle** : horodatage des mots face au calage (ponctuation, nombres, prononciations), durée, coût réel.
- **Nettoyage des blancs** (`nettoyage-audio`) sur la voix réelle, et la voix à −14 LUFS sans ton de pièce.
- **Branchements réels du lanceur** (`branchementsReels`) : exécutés une fois le 11/10 (avec un bouchon `--require`,
  désormais rangé dans le dépôt) ; avant cela jamais exécutés (lecture du personnage, de sa voix et de
  sa ressource HeyGen, signature R2, `existe` par lecture de l'en-tête du stockage, `verifierEtReserver`,
  enregistrement de la vidéo brouillon en base, `--conditions=react-server` avec `tsx`).
- **Fin non dite** : la phrase de fin est affichée seulement (la voix reste le script validé, règle 2) ; le plan
  § 11 prévoit qu'elle soit dite. À trancher par Will.
- **Granularité de la reprise** : une scène est refaite quand ses propriétés changent ; elles portent toute sa page
  (mise en page commune) et la page précédente quand elle en ouvre une nouvelle. Changer un élément refait donc les
  scènes de sa page (et la suivante si elle tourne la page), pas seulement la sienne. La fin, elle, se refait seule.
- **Variété** : aucun historique du compte n'est lu par le lanceur (première vidéo).

## 6. Résultats de l'essai réel du 11/10

| Relevé | Valeur |
|---|---|
| Vidéo | 17,4 s, 1080 × 1920, 25 i/s, 6 scènes `TableauScene` assemblées par `complet` |
| Voix (lecture HeyGen + calage) | 21,9 s |
| Rendu des 6 scènes | 56,4 s |
| Composition `complet` | 20,1 s |
| Coût | 0,10 € pour 335 caractères |
| Contrôle « Image figée » | « non mesuré » (voir § 7) |

## 7. Défauts de l'essai réel et corrections (branche `tableau/corrections-essai-reel`)

1. **Sous-titres presque illisibles** (crème sur ivoire). Cause : `parametresComposition` ne passe aucune marque au
   calque, qui prend les couleurs de repli (texte `#F3EDE4`, ombre `#16120F` doublée par la règle « décor clair »).
   Correction : style NEUF « Encre » (`STYLE_SOUS_TITRES_ENCRE`, champ facultatif `encre` du style) posé par le seul
   tableau : texte et emphase `#110A05`, ni contour ni ombre, Inter Bold de la charte ; contraste 14,5:1 sur `#E9DCC8`
   (test : échec sous 7:1). « Minimal » et les autres formats sont inchangés (champ absent = chemin d'avant).
2. **Trait noir vertical au bord droit** — **cause trouvée et corrigée le 11/10 soir** (branche
   `tableau/formats-par-reseau`). Reproduit avec le FFmpeg **8.1.1 exact de l'image** (même empreinte sha256) : la
   conversion `yuv420p → gbrp` de `grapheExport` (export, pose du texte) laisse NOIRES les colonnes au-delà du dernier
   multiple de 16 (1072 à 1079 en 1 080 px). Le FFmpeg 6.1 de ce poste ne le fait pas (d'où le « non reproduit »
   ci-dessous). Correction : le tableau exporte par `gbrap` (`RECETTE_COMPOSITION_TABLEAU.exportBordsSurs` →
   `export.conversionRvbSure`), et `studio-rendu` mesure les bords noirs du fichier exporté (`export.mesurerBords` →
   `bordNoir*`), lus par le contrôle de chaque sortie (`controles-sortie.ts`). Les autres formats gardent l'export
   d'avant : **l'avocat (export 8 bits) a très probablement la même bande** ; à décider par la session studio.
   Mesure d'avant (historique) : NON reproduit ici : la fiche de démonstration a été rendue de bout en bout
   (7 scènes `TableauScene` par Remotion, graphe image FFmpeg réel, calque texte, export en deux passes) ; les colonnes
   0-2 et 1074-1079 restent à la couleur de la page à chaque instant mesuré. Ni le décor (inutilisé : toutes les images
   sont couvertes par les scènes), ni la piste du double (jamais montée), ni une largeur impaire (scènes en 1080 × 1920,
   `scale`+`crop` sans effet) n'en sont la cause dans ce chemin. Écart restant avec la production : FFmpeg 8 (6.1 ici),
   la voix et la fiche réelles. Aucune mesure « bords noirs » n'existe dans les contrôles (rien à brancher). À mesurer
   sur la vraie vidéo (moyenne et minimum de chaque colonne de droite ; ≈ 220-240 attendu, < 60 = trait) :
   ```sh
   for t in 1 5 10 15; do ffmpeg -v error -ss $t -i video.mp4 -frames:v 1 -vf "crop=6:ih:iw-6:0,format=gray" -f rawvideo - \
     | python3 -c "import sys;b=sys.stdin.buffer.read();print($t,[min(b[i::6]) for i in range(6)])"; done
   ```
   Si le trait est là : refaire la même mesure sur une scène déposée (`studio/…/scenes/…mp4`) pour savoir si elle vient
   de la scène ou de la composition.
   Trouvé en chemin (corrigé) : les scènes sortaient en `yuvj420p` plage PLEINE (BT.601) et la composition les lit en
   BT.709 plage TV → page délavée (`#E9DCC8` → 253, 236, 213). Les scènes sont désormais demandées avec `crf` 12, ce qui
   fait sortir Remotion en BT.709 plage TV (mesuré : 231, 219, 199). Les scènes déjà déposées sont refaites une fois
   (empreinte changée).
3. **Le lanceur réel plantait hors de Next**. Le lanceur pose lui-même `scripts/tableau/bouchons-next.cjs` en mode
   réel ; `tests/tableau/fabriquer/chemin-reel.test.ts` charge le chemin `--reel` dans un vrai processus
   `tsx --conditions=react-server` jusqu'aux imports (aucun appel).

**Image figée « non mesuré »** : aucun format ne la mesure. Le contrôle lit `imagesFigeesHorsFin`, que `studio-rendu`
ne produit pas (pas de `freezedetect` dans la composition) ; il n'y a donc rien à brancher. Quand la mesure existera,
le tableau devra l'accepter comme normale (page immobile entre deux scènes) : seuil propre au format, jamais un échec.
