# Journal du lot E1 « Décor IA » (Higgsfield) — 09/10/2026

Session cloud, branche `feat/facecam-e1` (partie de `origin/feat/facecam`, fondations du lot A intégrées jusqu'à
`32c69fd`). Référence : `PLAN-FACECAM-v4.md` n° 32 (L10) et `PLAN-IMPLEMENTATION-FACECAM.md` (« Variante Higgsfield
de bout en bout », « RÉSULTATS DE L'ESSAI », « Essai v2 », P10).
Rien n'est fusionné dans master, aucune PR, aucun déploiement, aucun serveur touché, **aucun appel réel à Higgsfield**
(zéro crédit dépensé) : tout passe par le double de simulation.

## Ce qui est fait (uniquement des fichiers NOUVEAUX)

1. **Fournisseur `src/fournisseurs/higgsfield/`**
   - `types.ts` : contrat `FournisseurHiggsfield` (solde, envoi d'un média, lancement, suivi, téléchargement), modèles
     `flux_3_video_edit` (15 s max, 1 crédit/s, sans image) et `kling_video_edit` (image de référence obligatoire,
     2 crédits/s), devis « seconde entamée = comptée », `verifierDemande` (contrôle AVANT tout appel).
   - `client.ts` : client HTTP qui ne lève jamais ; envoi en 3 temps (`media_upload` → PUT présigné **sans la clé** →
     `confirm`), `declined_preset_id` transmis, en-tête d'idempotence, 401/403/402/429/5xx typés, clé masquée.
   - `simulation.ts` : double par défaut (704×1248, 24 i/s, même durée, solde débité ; pannes, refus, décalage de durée).
   - `index.ts` : `fournisseurHiggsfield({ reel })` — même règle que `fournisseurFacecam` (lot A) : le réel seulement
     si l'appelant le demande ET `HIGGSFIELD_API_KEY` ET `HIGGSFIELD_API_URL` (https) existent côté serveur.
   - `API.md` : ce qui est sûr (essai du 08/10) et ce qui est **supposé**.
2. **Brique pure `src/briques/decor/`**
   - `decoupage.ts` : passages de 10-15 s, frontière au milieu de la pause la plus longue de la fenêtre, coupe forcée à
     15 s sans pause, pas de dernier passage minuscule (≥ 4 s quand c'est possible), calage à l'image (25 i/s).
   - `consigne.ts` : consigne (anglais) avec les 6 règles de l'essai v2 (vraie lumière, pièce profonde 4-6 m, fond
     légèrement flou, même lumière et même balance des blancs, photoréaliste sans toile de fond, visage/lèvres/mains
     identiques image par image) ; `REGLES_DECOR_V2` en français.
   - `raccord.ts` : contrôle de raccord (écart bouche/voix d'origine ≤ 80 ms, ressemblance du visage ≥ 0,85, visage
     trouvé ≥ 90 %, durée ±0,12 s) ; retour à 25 i/s par `fps=25` (duplication d'images, **jamais** `setpts`/`atempo`) ;
     `PlanDecor` (morceaux, `audio: "origine"`, `ips: 25`, `zoomMax: 1.1` quand le décor est appliqué).
   - `cout.ts` : lignes `LigneCout` « Décor IA » (`higgsfield` en réel, `simulation` en essai, donc jamais compté),
     marge 1,2, contrôle du plafond.
   - `passe.ts` : `appliquerDecor` — même consigne et même image de référence pour tous les passages ; devis de la
     vidéo entière contrôlé contre le budget du mois restant puis le solde (sinon rien ne part) ; passage par passage ;
     un seul nouvel essai sur panne réessayable, dans le devis avec marge ; **tout ou rien** : au premier échec, arrêt
     (plus aucun crédit) et toute la vidéo repart sur ses passages d'origine ; ne lève jamais.
3. **Réglage et point d'insertion**
   - `src/services/decor-ia.ts` : réglage `facecam.decorIa` `{ actif:false, description, imageReferenceCle?, modele:"kling_video_edit", reel:false }` ;
     `passeDecorFacecam(demande)` rend `null` si l'option est coupée (étape ignorée), sinon lit le budget restant
     (`resumeBudget`), lance la brique et **enregistre la dépense réelle tout de suite** (`DepenseEnregistree` rattachée
     à la vidéo et au travail : comptée dans le total du mois et le plafond).
   - `src/app/(studio)/reglages/actions-decor.ts` (`definirDecorIaAction` : `actif` et `description` seulement ; `reel`
     n'est pas réglable depuis l'écran).
   - `src/components/reglages/DecorIa.tsx` : interrupteur « Décor IA » + description du décor, **aucun prix affiché**.
4. **Tests** : `tests/decor-ia.test.ts` (23 tests) — découpage aux pauses, consigne v2, raccord et 25 i/s, tout ou rien,
   repli (refus, panne, lèvres, durée, exception), un seul nouvel essai, solde insuffisant, plafond, Kling sans image,
   FLUX sans image, choix du fournisseur, double, client HTTP sur faux réseau (clé jamais envoyée au dépôt ni écrite),
   option coupée par défaut.

## Vérifications

- `npx vitest run tests/decor-ia.test.ts tests/facecam-fondations.test.ts` : 49 réussis.
- `npx tsc --noEmit` : aucune erreur dans les fichiers du lot (restent les erreurs déjà présentes : `RouteContext` /
  `LayoutProps` sans `next typegen`, et `studio-rendu/` sans les dépendances Remotion).
- `eslint` sur les fichiers du lot : propre.

## Intégrations à faire (fichiers d'autres lots, NON modifiés ici)

1. **Moteur `montage-facecam` (lot B)** : après l'étape « L'image » et avant « Le montage » (réalisation), si
   `passeDecorFacecam` rend un résultat : ajouter une étape facultative `{ cle: "decor", nom: "Le décor", dependDe:
   ["etalonnage"] }` (ignorée quand l'option est coupée), appeler
   `passeDecorFacecam({ videoId, travailId, dureeUtileSec, mots, lireImageReference, extrairePassage, deposerPassage, mesurer })`,
   puis passer `resultat.plan` à la réalisation : morceaux `decor` (clé R2 + `conversion.filtreVideo`), audio
   **toujours** celui de la prise utile, zooms limités à `plan.zoomMax` (110 %). En repli : `EtatFacecam.EffetRate`
   avec `resultat.message` (sans montant). Les lignes de `resultat.lignes` peuvent aller dans `lignesReelles` :
   `lignesRestantes` (même `travailId`) évite le double compte.
2. **studio-aligneur (lots B/D)** : `extrairePassage` (image seule du cadre déjà traité, mp4), `deposerPassage`
   (ffmpeg `-vf <conversion.filtreVideo> -t <conversion.dureeSec>`, sans son, vers R2), `mesurer` (route `/visages`
   sur la sortie : écart bouche/voix, ressemblance, visage trouvé). À brancher sur `fournisseurFacecam`.
3. **Réglages** (`src/app/(studio)/reglages/page.tsx`) : poser
   `<CarteSection id="decor-ia" icone="image" titre="Décor IA"><DecorIa initial={await lireReglageDecorIa()} /></CarteSection>`,
   visible seulement quand le format facecam est actif. Envoi de l'image de référence : à faire avec l'envoi R2
   existant, puis `definirReglageDecorIa({ imageReferenceCle })`.
4. **Liste des clés** (Réglages > Crédits/Connexions) : ajouter `HIGGSFIELD_API_KEY` quand le réel sera ouvert.

## Points incertains (à vérifier avant tout essai réel — rien n'a été inventé sans être isolé)

- **API publique Higgsfield** : adresse de base, chemins, champs, authentification `Bearer`, codes HTTP, en-tête
  d'idempotence : tous **supposés**, rangés dans `CONTRAT_SUPPOSE` (`client.ts`) et listés dans `API.md`. Aucune
  adresse par défaut : le réel est impossible tant que `HIGGSFIELD_API_URL` n'est pas posée.
- **Nom du champ de l'image de référence** de Kling (`reference_image_media_id` supposé) et durée max de Kling (15 s
  retenus d'après le devis).
- **Crédits débités sur un travail raté** : on compte `credits_used` s'il est rendu, sinon 0 ; sur un travail réussi,
  le devis si l'API ne dit rien.
- **Prix d'un crédit** : 5 c€ (essai : ≈ 90 crédits ≈ 4-5 €) — à recaler sur la facture (`PRIX_CREDIT_HIGGSFIELD_CENTIMES`).
- **Cadence** : la mission demande le retour à **25 i/s** (cadence du studio, export facecam) ; le n° 32 du plan v4
  écrit « 24 i/s gardé ». Retenu : 25 i/s par duplication d'images, vitesse inchangée. À confirmer avec Will.
- **Seuils de raccord** (80 ms, 0,85, 90 %) : à régler sur le banc d'essai avec de vraies sorties.
- Le plan v4 place le passage « APRÈS L5 » ; la mission dit « après la passe image (lot B) » : même endroit (cadre
  déjà traité), avant la réalisation.
