# Correcteur final B — version de départ b544423 (en ligne)

Date : 04/10/2026. Branche `outils/final-b`. Aucun appel aux services payants, aucune clé. Rien n'est effacé.
Sources : `VERIF-E2E-2.md` (en entier), `VERIF-E2E-1.md` (bloquant 1, « Images Docker »), `TEST-UI-REEL.md` (U3, U4).
Les tests de `controles/verif-e2e-2` sont repris dans la branche (`tests/e2e-verif2-*`).

## 1. Import .pdf cassé en production — CORRIGÉ ET PROUVÉ DANS L'IMAGE

**Cause** : la sortie autonome construite par Turbopack (`pnpm build`, comme le `Dockerfile`) ne met pas `unpdf` en tête
de `node_modules` ; seulement `.next/node_modules/unpdf-<empreinte>` et `node_modules/.pnpm/unpdf@1.8.1/…` (seule
l'entrée ESM est gardée). Le processus enfant faisait `import("unpdf")` par son nom.

**Correction** (`src/services/import-texte.ts`, `chargerUnpdf` dans le code de l'enfant) : par son nom d'abord ; sinon
l'alias haché `.next*/node_modules/unpdf-<empreinte>`, puis le dossier pnpm ; entrée ESM lue dans `package.json`.
Aucun changement au `Dockerfile` (rien à copier en plus). `extraireDansUnProcessus` accepte le dossier du studio
(par défaut `process.cwd()`, comme avant) pour les essais.

**Preuves** :
| Où | Ancien code | Nouveau code |
|---|---|---|
| Copie isolée de `.next/standalone` (build Turbopack), enfant rejoué tel quel | `.pdf` → `illisible` « Cannot find package 'unpdf' » ; `.docx` OK | `.pdf` et `.docx` lus |
| **Image Docker construite** (`Dockerfile` racine ; seule différence : le certificat du mandataire de ce bac à sable ajouté aux étapes `deps`/`build`, étape `run` identique) | `.pdf` → `illisible` | `.pdf` et `.docx` lus |
| **Image lancée** (`STUDIO_SANS_BASE=1`), connexion réelle par `/connexion`, `POST /api/import` | — | `.pdf` → 200 + texte ; `.docx` → 200 + texte |
| `tests/final-b-import-autonome.test.ts` (dossier isolé, 2 dispositions) | 2 rouges | 4 verts |

Construire l'image a aussi révélé la gêne 20 (polices) : corrigée, voir plus bas.

## 2. Mise à jour : santé des 4 services — CORRIGÉ

`deploiement/commun.sh`, `mettre-a-jour.sh`, `revenir.sh` :
- après `/api/sante` en 200, **chaque service doit être `healthy`** : base, studio, studio-rendu, et studio-aligneur
  si le calage est actif (`attendre_services_sains`) ; sinon échec clair (état de chaque service + fin de journal des
  malades), code 1, commande de retour arrière ;
- le tag `:bonne` est posé **image par image, seulement pour les services attendus et sains** (`marquer_bonnes`) ;
  idem dans `revenir.sh` ;
- `STUDIO_RENDU_CLE` vide → arrêt **avant** toute construction (studio-rendu refuserait de démarrer).

`tests/final-b-mise-a-jour-sante.test.ts` lance les vrais scripts avec un faux `docker` et un faux `git` : l'incident
du matin (studio-rendu `restarting`) donnait « Studio à jour et en bonne santé », code 0 (rouge sur l'ancien script) ;
maintenant code 1 et aucun `:bonne`. 8 cas (base malade, calage malade, tout sain, sans calage, clé vide, retour
arrière malade / sain).

**Garde-fou studio-rendu** : `tests/final-b-image-rendu-fichiers.test.ts` lit les `COPY` de
`deploiement/studio-rendu/Dockerfile`, suit les imports exécutés (statiques, dynamiques, `require`, imports de types
ignorés) depuis le code du conteneur, et exige que chaque fichier `src/…` atteint soit copié, sans alias `@/`.
Il retrouve l'oubli du 04/10 : sans `erreur-lisible.ts` dans le `COPY`, il rougit (cas vérifié dans le test même).

## 3. Gênes de VERIF-E2E-2

| N° | État | Où |
|---|---|---|
| 1. Deux onglets : décochage « Avant de publier » annulé | **Corrigé** : lecture et écriture sous le verrou du kit (aussi `decocherApresRetouche`) ; les 2 `it.fails` passent en `it` verts | `src/services/publications.ts` |
| 2. « Réécrire ce texte » payé deux fois | **Laissé au correcteur A** (chemin d'argent : appel Claude payé) | — |
| 3. Adresses inconnues en 200 | **Corrigé** : `/nouvelle/<format>`, `/ecrire/tournage/<id>`, `/ecrire/sujets/<id>/lire/<variante>` vérifiées par le proxy → 404 soigné | `src/proxy.ts` (`ficheDeChemin`), `src/services/recherche.ts`, `/api/fiches` ; `tests/final-b-adresses-404.test.ts` |
| 4. Pas de copie de la base avant migration | **Corrigé** : `pg_dump` vérifié (`gunzip -t`, fin de dump) dans `sauvegardes/avant-maj-….sql.gz` avant le redémarrage ; échec → rien n'est redémarré | `commun.sh` (`sauvegarder_avant_mise_a_jour`) |
| 17. `cpus: 6` | **Corrigé** : `cpus: ${STUDIO_RENDU_CPUS:-6}`, réglé par les scripts sur le nombre de cœurs (6 au plus) si le `.env` ne dit rien ; vérifié par `docker compose config` | `docker-compose.yml`, `commun.sh` |
| 18. Adresse du calage entre guillemets | **Corrigé** (`calage_actif`, testé avec `"http://…"`) | `commun.sh` |
| 19. Retour arrière manuel incomplet | **Corrigé** (studio-aligneur, `--profile calage`, contrôle `ps`) + ce que vérifie la mise à jour | `deploiement/README.md` |
| 20. Construction dépendante du réseau (polices) | **Corrigé** : polices rangées dans le dépôt (`next/font/local`, sous-ensemble latin, licence OFL) ; l'image se construit sans Google Fonts | `src/app/layout.tsx`, `src/app/polices/` |
| 21. « Essais (montants simulés) » | **Corrigé** : « Essais (rien n'est payé) » | `src/services/couts.ts` |
| 5. `/veille` déborde | **Corrigé** (préventif : non reproduit avec les données d'exemple, mesuré 375 px partout) : `grid-cols-1 sm:grid-cols-2`, `min-w-0` | `veille/_composants/EcranVeille.tsx` |
| 6. Raison cachée sous la barre | **Corrigé** : « Validez la limite ci-dessus. » (et « Tout est programmé ») avant la barre ; aucune logique touchée | `generateur/FicheSujet.tsx` |
| 7. Vitesse qui chevauche « Filmer » | **Corrigé** : `w-auto`, `role="group"` « Vitesse du texte » (le bouton Filmer est décalé d'environ 20 px du centre) | `tournage/Enregistreur.tsx` |
| 8. Rangée des réseaux trop large | **Corrigé** : bouton format `max-w-[6rem]`, `min-w-0` (340 px pour 343) | `generateur/ListeSujets.tsx` |
| 9. Barre collée sous l'encoche | **Corrigé** : `top-[calc(4rem+env(safe-area-inset-top))]` (même valeur que l'en-tête) | `generateur/ListeSujets.tsx` |
| 10. Textes longs | **Corrigé** : fiche vidéo (Coût + ESSAI), aperçu (pastilles), calendrier, avertissement du kit, chiffres de la bibliothèque ; `overflow-wrap: break-word` global + `anywhere` sur les blocs de texte | divers, `globals.css` |
| 11. Bandeau hors ligne | **Corrigé** : pastille d'une ligne sous l'en-tête (« Hors ligne » sur téléphone, phrase complète à partir de sm) | `coquille/BandeauHorsLigne.tsx` |
| 12-13. Feuilles au clavier, pas de « Fermer » | **Corrigé** : `autoFocus`, focus rendu au déclencheur à la fermeture, bouton « Fermer » | `ui/FeuilleBas.tsx` |
| 14. Fenêtre de prise faite main | **Corrigé** : fenêtre Radix (focus gardé, Échap sauf pendant une prise ou un envoi), vrai bouton Pause / Reprendre | `tournage/Enregistreur.tsx` |
| 15. Focus invisible | **Corrigé** : anneau au focus clavier (sujet, curseur LUT), `touch-pan-y` sur l'aperçu LUT | `generateur/EcranSujet.tsx`, `bibliotheque/EcranLut.tsx` |
| 16. Annonces | **Corrigé** : textes masqués à la place d'`aria-label` sur des points, état des étapes en toutes lettres + `aria-current`, chiffres des mesures nommés, `radiogroup` en choix unique et raison reliée par `aria-describedby`, libellés « Plus d'actions : … » / « Ranger « … » », sous-titres en tabulation itinérante (flèches), erreur de `ZoneTexte` reliée | 10 fichiers ; `tests/final-b-accessibilite.test.ts` (17 tests, rouges sur l'ancien code) |

Tests mobile : `tests/final-b-mobile.test.ts` (10 tests, rouges sur l'ancien code). Mesure réelle en Chromium 375 px
(`next dev`, base d'exemple) : /veille, feuille « Surveiller un outil », /calendrier, /ecrire, /videos : `scrollWidth` 375.

## 4. TEST-UI-REEL

- **U3** : la pastille « Essai » et la phrase ne s'affichent plus quand aucun service n'est en essai
  (`src/components/reglages/Connexions.tsx`).
- **U4** : sans personnage, Plateau (qui joue) et Voix montrent « Ajoutez-vous d'abord » avec un bouton
  « Personnages » (`AjoutezVousDabord` dans `src/assistant/etapes/Distribution.tsx`, en tête de `FeuillePlateau`).
- Tests : `tests/final-b-ecrans-vides.test.ts` (rouges sur l'ancien code).

## 5. Contrôles (tête de branche)

| Contrôle | Résultat |
|---|---|
| `npx tsc --noEmit` (racine) / (studio-rendu) | 0 erreur / 0 erreur |
| `npx eslint .` | 0 remarque |
| `npx vitest run` (complet) | **218 fichiers, 2 735 verts**, 1 `it.fails` restant (D2, correcteur A), 2 ignorés |
| `npx next build --webpack` | réussi, sans avertissement |
| `shellcheck -x deploiement/*.sh` | 0 remarque |
| studio-aligneur : `python -m unittest discover -s tests -t .` | 21 tests OK |
| `docker compose --profile calage config` | OK ; `STUDIO_RENDU_CPUS=3` → `cpus: 3` |
| Image Docker du studio | construite, `.pdf` et `.docx` lus par `/api/import` (voir § 1) |

## Non fait / à suivre
- Gêne 2 (« Réécrire ce texte » payé deux fois) : chemin d'argent, laissé au correcteur A ; son `it.fails` reste.
- Image construite avec les correctifs d'import et de polices ; une dernière reconstruction après les écrans a été
  refusée par Docker Hub (429, limite de requêtes) — aucun des fichiers vérifiés dans l'image n'a changé depuis.
- Images studio-rendu et studio-aligneur non construites ici (dépôt Debian bloqué) ; le garde-fou des fichiers copiés
  les couvre en partie.
- Au prochain déploiement sur le serveur : « Importer un fichier » avec un .pdf, et `docker compose ps` tous `healthy`.
