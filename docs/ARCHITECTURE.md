# Architecture du Studio — CONTRAT DES DÉVELOPPEURS

> Lot 1 (architecte), 2026-10-01. Ce document est la **seule** référence des 3 développeurs (lot 2, en parallèle).
> Le plan fonctionnel est `docs/PLAN.md` ; **l'AVENANT 2 prime**. En cas de doute : ce document décrit ce qui EXISTE, le plan décrit ce qu'il faut AFFICHER.

---

## 0. Règles absolues

1. **Écrans → actions serveur → services → dépôts / fournisseurs / moteurs.** Un écran (`src/app/**`, `src/components/**`, `src/assistant/**`) n'importe **jamais** `src/donnees/**`, `src/domaine/depots.ts`, `src/moteurs/**`, `src/fournisseurs/**` (sauf leurs **types**).
2. **Chaque action serveur et chaque route `/api` commence par `await exigerSession()`** (`@/services/auth`). Le proxy ne suffit pas. Les routes `/api` peuvent utiliser `sessionApi()` et répondre 401.
3. **Couleurs uniquement par jetons** (classes `bg-fond`, `text-texte-doux`, `border-trait`, `bg-orange`…). La palette Tailwind par défaut est **désactivée** : `bg-red-500` n'existe pas. Aucune couleur hexadécimale dans un composant.
4. **Français, première personne, vouvoiement.** Mots interdits à l'écran : job, render, prompt, token, API, upload, pipeline, workflow, mock, fictif, dashboard, avatar (dire « double » ou « personnage »).
5. **Mobile d'abord (390 px)**, puis bureau (1440 px). Cibles ≥ 44 px. **Une action principale par écran**, dans `BarreActionCollee`.
6. **Très peu de texte** : titres courts, une ligne d'aide au plus, des cartes, des icônes, des gros chiffres, des vignettes.
7. **Toute action simulée porte la pastille « Essai »** (`essai` sur `Bouton`, `PastilleEssai`) et son toast `notifier.essai("rien n'a été envoyé à Buffer")`.
8. Pas de `next dev` / `next build`, pas de commit (le responsable qualité le fait). Vérifier avec `pnpm exec tsc --noEmit` et `pnpm exec eslint <vos fichiers>`.
9. **Next 16** : `params` et `searchParams` sont des **Promise** (`const { id } = await params`), `proxy.ts` remplace `middleware`, la prop d'`error.tsx` s'appelle **`retry`** (plus `reset`). Lire `node_modules/next/dist/docs/` au besoin.
10. Le mot de passe n'est écrit nulle part. Ne jamais afficher `.env.local`.

---

## 1. Arborescence

```
src/
├─ app/
│  ├─ layout.tsx                 racine : polices, globals.css, Toasts, PWA        (architecte)
│  ├─ globals.css                JETONS + thème Tailwind 4                          (architecte)
│  ├─ manifest.ts, not-found.tsx, global-error.tsx, hors-ligne/                     (architecte)
│  ├─ connexion/                 page + FormulaireConnexion + actions               (architecte)
│  ├─ v/[code]/page.tsx          page publique d'un lien privé                      (dév. C)
│  ├─ api/
│  │  ├─ sante/                  GET public                                         (architecte)
│  │  ├─ crochets/[fournisseur]/ 501 (signature + dédoublonnage plus tard)          (architecte)
│  │  ├─ travaux/                GET ?id= → { travaux: VueTravail[] }               (architecte)
│  │  ├─ recherche/              GET ?q= → ResultatRecherche                        (architecte)
│  │  ├─ notifications/          GET → { notifications, nonLues }                   (architecte)
│  │  └─ sous-titres/[id]/       GET ?format=srt|vtt → fichier                      (architecte)
│  └─ (studio)/                  tout ce qui est connecté (coquille + session)
│     ├─ layout.tsx, loading.tsx, error.tsx, actions.ts (actions PARTAGÉES)         (architecte)
│     ├─ page.tsx + _accueil/    Accueil                                            (dév. A)
│     ├─ nouvelle/ , nouvelle/[format]/   Nouvelle vidéo, Assistant                 (dév. A)
│     ├─ ecrire/ , scripts/[id]/ , scripts/ (→ /ecrire) , idees/ (→ /ecrire)        (dév. A)
│     ├─ modeles/                Mes modèles                                        (dév. A)
│     ├─ personnages/ , personnages/[id]/                                           (dév. B)
│     ├─ bibliotheque/ , bibliotheque/[type]/                                       (dév. B)
│     ├─ videos/ , videos/[id]/ , formats/[id]/ , formats/ (→ /videos)              (dév. C)
│     ├─ calendrier/ , reglages/                                                    (dév. C)
│     └─ styleguide/             vitrine des composants                             (architecte)
├─ proxy.ts                      protège tout sauf /connexion, /v/*, /api/sante, /api/crochets/*, /hors-ligne, statiques
├─ components/
│  ├─ ui/                        SYSTÈME DE DESIGN (architecte) — import depuis "@/components/ui"
│  ├─ coquille/                  barre latérale, onglets du bas, en-tête, recherche, cloche (architecte ; dév. C : Cloche/Recherche)
│  └─ videos/                    CarteVideo, SuiviTravail (partagés ; dév. C peut enrichir)
├─ assistant/
│  ├─ Assistant.tsx              coquille de l'assistant (dév. A)
│  └─ etapes/                    BIBLIOTHÈQUE D'ÉTAPES : meta.ts, types.ts, registre.tsx, 1 fichier par étape (dév. A)
├─ hooks/useTravaux.ts           progression en direct (toutes les 2 s)
├─ domaine/                      PUR (client + serveur) : types.ts, depots.ts, derivations.ts, libelles.ts
├─ donnees/memoire/              dépôts en mémoire + démonstration (INTERDIT aux écrans)
├─ services/                     « server-only » : TOUT ce que les écrans peuvent appeler
├─ formats/                      REGISTRE DES FORMATS (PUR) : avocat/, podcast/, autres.ts, index.ts
├─ moteurs/                      REGISTRE DES MOTEURS : types.ts, simulation.ts, index.ts
├─ briques/                      9 briques communes (contrats + simulations)
├─ fournisseurs/                 12 fournisseurs simulés + resoudreFournisseur()
├─ reseaux/                      REGISTRE DES RÉSEAUX (PUR) : zones protégées, légendes, durées
└─ lib/                          cn, montants, dates, ids, textes, jeton-session
scripts/  generer-medias-demo.mjs (ffmpeg), captures.mjs (Playwright), hacher-mot-de-passe.mjs
public/   demo/ (médias), icones/, robots.txt (Disallow: /), sw.js (hors ligne)
```

### Propriété des fichiers (aucun chevauchement)

| Qui | Écrit dans | Ne touche pas |
|---|---|---|
| **A** | `app/(studio)/page.tsx`, `_accueil/**`, `nouvelle/**`, `ecrire/**`, `scripts/**`, `idees/**`, `modeles/**`, `assistant/**` | le reste |
| **B** | `app/(studio)/personnages/**`, `bibliotheque/**` | le reste |
| **C** | `app/(studio)/videos/**`, `formats/**`, `calendrier/**`, `reglages/**`, `app/v/**`, `components/videos/**`, `components/coquille/Cloche.tsx`, `components/coquille/Recherche.tsx` | le reste |
| **Architecte / QA** | `components/ui/**`, `domaine/**`, `services/**`, `donnees/**`, registres, `globals.css`, coquille | — |

- Chaque développeur crée ses **actions serveur** dans `actions.ts` **à côté de sa page** (ex. `app/(studio)/videos/[id]/actions.ts`) et ses composants client dans un sous-dossier `_composants/` de sa route.
- **Besoin d'un service ou d'un composant ui manquant ?** Ne pas modifier `services/` ni `components/ui/` : créer une fonction locale dans votre `actions.ts` en composant les services existants, ou un composant dans votre `_composants/`. Noter le besoin dans votre compte rendu ; le QA fusionnera.
- Exception tolérée : corriger une **faute de frappe** visible dans un composant ui (signaler).

---

## 2. Système de design

### Jetons (globals.css → classes Tailwind)

| Jeton | Classe | Usage |
|---|---|---|
| `--fond` #16120F | `bg-fond` | fond de page |
| `--surface-1/2/3` | `bg-surface-1` … | cartes, champs, survols |
| `--trait`, `--trait-fort` | `border-trait` | bordures |
| `--texte`, `--texte-doux`, `--texte-faible` | `text-texte` … | texte (AA vérifié) |
| `--orange`, `--orange-vif`, `--orange-doux` | `bg-orange`, `text-orange-vif`, `bg-orange-doux` | action principale, accent |
| `--sur-orange` | `text-sur-orange` | texte sur orange |
| `--sauge`, `--ambre`, `--brique` (+ `-doux`) | `text-sauge`, `bg-ambre-doux`… | succès, attention/essai, erreur |
| `--voile` | `bg-voile` | fond des feuilles |
| lueur | classes utilitaires `lueur`, `lueur-forte` ; composant `<Lueur/>` | halo orange |

- Polices : `font-titre` (Archivo Black, titres, déjà appliquée à h1/h2/h3) ; `font-texte` (Manrope, par défaut). `.titre-affiche` = grotesque en MAJUSCULES serrées (visuels « 5 TÂCHES… »).
- Rayons : `rounded-carte` (16 px), `rounded-champ` (12 px), boutons `rounded-full`. Ombres : `shadow-carte`, `shadow-orange`. Courbe : `ease-studio`.
- Animations 200–300 ms ; `prefers-reduced-motion` coupe tout (globals.css). Animation d'entrée : `<Apparition index={i}>` (CSS pur) ; micro-animations : `motion/react`.
- Utilitaires : `.sans-barre` (défilement sans barre), `.marge-onglets-bas` (déjà sur `<main>`).

### Composants (`import { … } from "@/components/ui"`)

| Composant | Rôle / props clés |
|---|---|
| `Bouton` | `variante` principal·secondaire·fantome·contour·danger, `taille` md·lg·xl, `icone`, `iconeDroite`, `chargement`, `essai`, `pleineLargeur`, `asChild` (ex. `<Bouton asChild icone="plus"><Link href=…>Texte</Link></Bouton>`) |
| `BoutonIcone` | `icone`, `libelle` (obligatoire), `compteur` |
| `BoutonCopier` | `texte`, `libelle`, `compact` |
| `Carte` | `interactive`, `lueur`, `sansMarge`, `as` |
| `Pastille` | `ton` orange·sauge·ambre·brique·neutre, `icone`, `point` (animé), `taille` |
| `PastilleEtat` | `type` video·editorial·travail·preparation + `statut` (libellés dans `domaine/libelles.ts`) |
| `PastilleEssai` | ambre « Essai » |
| `SelecteurPastilles` | simple : `valeur`/`onChange` ; `multiple` + `minimum` ; options `{valeur, libelle, detail, icone, visuel, desactive, raison}` ; `FormeRatio` pour le visuel d'un ratio |
| `Onglets` | radix ; `onglets[{valeur, libelle, icone, compteur, contenu}]` (le contenu peut venir du serveur) |
| `OngletsLiens` | onglets = liens (`actif` calculé par la page) |
| `Champ` | `libelle`, `aide`, `erreur`, `icone`, `motDePasse` (œil), `grand` |
| `ZoneTexte` | hauteur auto, `longueurMax` (compteur, ambre au-delà) |
| `Interrupteur`, `CaseACocher`, `Curseur` | ligne entière cliquable ; `Curseur` affiche la valeur en gros (intensité LUT) |
| `FeuilleBas` | vaul : `ouverte`, `onOuverteChange`, `titre`, `description`, `pied` (action collée), `pleinEcran` |
| `Dialogue` | radix ; confirmation sur ordinateur |
| `Menu` | radix ; éléments `{libelle, icone, onSelect, danger, essai, bientot}` ou `"separateur"` |
| `notifier` | `notifier.succes / erreur / info / essai(message)` (sonner) |
| `EtatVide` | illustration + `titre` + UNE `phrase` + `action` ; `compact` |
| `Squelette`, `SqueletteGrille`, `SquelettePage` | chargements |
| `EnTetePage` | `titre`, `sousTitre` (1 ligne), `retour`, `surTitre`, `actions` |
| `EnTeteSection` | `titre`, `compteur`, `lien` (« Tout voir ») |
| `BarreActionCollee` | action principale collée en bas (mobile, au-dessus des onglets) / en ligne (bureau). Enfant = action principale ; `secondaire` à gauche |
| `VignetteVideo` | `src`, `ratio`, `dureeSec`, `progression` (surimpression), `enEchec`, `lecture`, `coin` |
| `LecteurVideo` | `src`, `affiche`, `ratio`, `titre`, `sousTitresVtt` |
| `CarteFormat` | carte d'un format (aperçu animé au survol), `compacte` |
| `CartePersonnage`, `Portrait` | photo ronde / initiales (jamais « avatar ») |
| `JaugeBudget`, `GrosChiffre`, `BarreProgression` | chiffres |
| `ProgressionEtapes` | étapes d'un `Travail` + « Réessayer cette étape » (`onReessayer`) |
| `BarreEtapes` | barre de l'assistant (`etapes`, `courante`, `onAller`) |
| `ZoneDepot` | glisser-déposer → `onFichiers(File[])` ; pastille Essai par défaut |
| `CalqueZonesReseaux` | hachures des zones protégées (`ratio`, `reseaux`, `visible`, `deborde`) — à poser dans un parent `relative` |
| `LogoReseau` | monogramme du réseau (pas de logo de marque) |
| `Tuile` | tuile de grille (feuille Plus, Bibliothèque) |
| `Carrousel` | rangée horizontale aimantée |
| `ListeAvecFiltres<T>` | **client, à fonctions** : `elements`, `cle`, `rendu`, `texteRecherche`, `filtres[{id, libelle, options, tester}]`, `tris`, `actionsSelection` (sélection multiple + barre flottante) |
| `ListeElements<T extends ElementAffichable>` | liste générique de la Bibliothèque (recherche nom + mots-clés, filtre licence, tri, sélection) ; `renduCarte` pour personnaliser ; `CarteElement` exportée |
| `Icone` | `<Icone nom="balance" />` ; noms dans `ICONES` (Icone.tsx). Ajouter une icône = l'ajouter à `ICONES` (demander au QA) |
| `Apparition` | entrée en fondu, `index` pour décaler |

⚠️ Les composants à props-fonctions (`ListeAvecFiltres`, `ListeElements` avec `onOuvrir`, `Menu`, `SelecteurPastilles`…) s'utilisent **depuis un composant client** de votre route (`"use client"`), pas directement depuis une page serveur.

Composants partagés hors ui : `components/videos/CarteVideo` (`video: VueVideoCarte`, `ratioForce`, `afficherFormat`), `components/videos/SuiviTravail` (`initial: VueTravail` → progression en direct + Réessayer), `assistant/etapes/Reglages.ChampsReglages` (formulaire généré depuis `format.reglages.champs`).

Vitrine : **/styleguide**.

---

## 3. Coquille et navigation (AV2.1)

- Config : `components/coquille/navigation.ts` (`NAV_LATERALE`, `ONGLETS_BAS`, `TUILES_PLUS`). Formats sous « Mes vidéos » : depuis le registre (`services/formats.listerFormatsAvecCompteurs`).
- Bureau : barre latérale 264 px repliable à 72 px (mémorisé). Mobile : onglets Accueil · Vidéos · ➕ · Écrire · Plus (feuille de tuiles).
- En-tête : `Recherche` (loupe, feuille plein écran, Ctrl K ou « / ») + `Cloche` (popover, `/api/notifications`, marque lu à la fermeture).
- `<main>` : largeur max 1200 px, marges 16 px (mobile) / 32 px (bureau), marge basse pour les onglets.
- `BandeauHorsLigne` automatique ; service de cache `public/sw.js` (production) → `/hors-ligne`.

---

## 4. Connexion et sécurité (B.4)

| Élément | Où |
|---|---|
| Page `/connexion` | `app/connexion/` (mot de passe + œil, « Rester connecté » 30 j / 12 h) |
| Vérification | `services/auth.seConnecter(mdp, resterConnecte)` : argon2id contre l'empreinte **en base** (`auth.empreinteB64`, après un changement) sinon `STUDIO_PASSWORD_HASH_B64` (base64) ; 5 échecs / 15 min / IP (dépôt `tentatives`) — IP = `STUDIO_ENTETE_IP` (ex. `cf-connecting-ip`, seulement si le serveur n'est joignable que par ce proxy) sinon DERNIÈRE valeur de `x-forwarded-for` ; plus un plafond global (20 échecs → réponses ralenties, 50 → blocage 15 min) ; jeton émis avant le démarrage du processus et session inconnue → refusé ; réponse en temps constant (~800 ms) |
| Cookie | `studio_session`, httpOnly, Secure en prod, SameSite=Lax, jeton HS256 (`lib/jeton-session.ts`, `SESSION_SECRET`) |
| Proxy | `src/proxy.ts` : vérifie la signature ; `/api/*` → 401, pages → `/connexion?suite=…` |
| Garde serveur | `exigerSession()` (redirige) · `sessionApi()` (null) · `lireSession()` |
| Sessions | `listerSessions()`, `revoquerSession(id)`, `seDeconnecter()`, `changerMotDePasse(ancien, nouveau)` (coupe les autres sessions) |
| En-têtes | `next.config.ts` : X-Robots-Tag noindex nofollow, CSP (frame-ancestors 'none'), X-Frame-Options DENY, Referrer-Policy same-origin, nosniff |
| robots | `public/robots.txt` → `Disallow: /` |

Note mémoire : au redémarrage du serveur, un jeton signé encore valide recrée sa ligne de session (les données sont en mémoire en V1).

---

## 5. Modèle de données (`src/domaine/types.ts`)

Toutes les entités : `id`, `creeLe`, `modifieLe`, `estDemo?`. Fichiers par `fichierId` (jamais d'URL) ; les **vues** des services donnent les URL. Montants : `{ centimes, devise: "EUR" }` (`lib/montants` : `formaterMontant`, `additionner`, `euros`, `centimes`).

Entités : `Fichier`, `Marque`, `Personnage` (+`Accord`, `visageParDefautId`, `voixParDefautId`), `Visage` (`tenue` + `tenueId` normalisée, `fondTournage` — ancien `decor` —, `posture`, `origine`, `detoureFichierId`, statut `a_verifier`), `Voix` (`fournisseur` propre à la voix, `typeClone`), `Prononciation`, `ElementBibliotheque` (type ∈ couleurs, logo, police, lut, style-sous-titres, illustration-image, illustration-video, musique, bruitage, habillage, style-montage, **profil-son**, decor (`mode` teinte | image | boucle — l'ancien `fond` y est fusionné), accessoire ; `valeur` typée par union ; `Licence` détaillée), `Script` (`blocs[].segments[]` annotés : angle, titreEcran, emphase, intentionIllustration, zoom, pauseApresSec, role ; `statutEditorial`), `Video` (statut technique `brouillon|maquette|en_file|en_fabrication|prete|echec|annulee|archivee` + `etapeEditoriale` `a_relire|validee|programmee|publiee`, `versionFormat`, `distribution[]`, `styles`, `mentionIA` détaillée, `noteQualite`, `serieId`, `sourceVideoId`, `typeDerive`, `etapeAssistant`…), `VersionVideo` (commande figée), `Plan` (`texteEcran`, `motsEnValeur`, `illustration{verrouille, candidats}`, `cadrage`, `sourceImage`), `Piste`, `Retouche`, `Miniature`, `SousTitres` (mots horodatés), `Sortie` (`rapportQualite`), `KitPublication` (textes par réseau + `avantDePublier` 5 cases), `Publication` (`via: buffer|manuel|simulation`, `stats`), `Partage`, `Travail` + `EtapeTravail` (dépendances, `erreur{messagePourWill, reessayable}`), `LigneCout`, `DepenseEnregistree`, `RessourceFournisseur`, `EvenementFournisseur`, `Rush`, `Serie`, `Notification`, `Idee`, `Modele`, `Session`, `TentativeConnexion`, `Parametre`, `Evenement`, `CommandeFabrication` (**versionContrat 2** depuis le lot M0 du moteur avocat : `moteurId` figé, `adresse`, `posture`, `accessoires`, `profilRealisme`, `profilRendu`, `recetteMontage`, `tauxUsdEur`, styles résolus avec leur VALEUR, distribution avec visages par angle ; les commandes v1 déjà fabriquées restent lisibles).

Libellés et tonalités d'affichage (PUR) : `domaine/libelles.ts` → `STATUTS_VIDEO`, `ETAPES_EDITORIALES`, `STATUTS_TRAVAIL`, `STATUTS_PREPARATION`, `NATURES_PERSONNAGE`, `TYPES_BIBLIOTHEQUE` (ordre, icône, groupe), `LICENCES`.
Dérivations (PUR) : `domaine/derivations.ts` → `texteScript`, `plansDepuisScript`, `sousTitresDepuisPlans`, `versSrt`, `versVtt`, `etatLicence`, `creditsDepuisElements`, `MENTION_IA_PAR_DEFAUT`.

---

## 6. Services (`src/services/*`, serveur uniquement)

Convention : fonctions `async`, objets **sérialisables** (passables à un composant client). Les **mutations** appellent déjà `exigerSession()` et lèvent `ErreurStudio(code, message)` (message prêt pour Will). Dans une action serveur, envelopper avec `essayer()` :

```ts
"use server";
import { exigerSession } from "@/services/auth";
import { essayer, type Resultat } from "@/services/_commun";
import { archiverVideos } from "@/services/videos";
import { revalidatePath } from "next/cache";

export async function archiverAction(ids: string[]): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => { await archiverVideos(ids); revalidatePath("/videos"); return undefined; });
}
// côté client : const r = await archiverAction(ids); if (!r.ok) notifier.erreur(r.message);
```

Types de vues : `import type { VueVideoCarte, VueVideoDetail, VueTravail, VuePersonnage, VueElement, VueBudget, VueKit, VueModele, ResultatRecherche } from "@/services/vues"`.

### accueil
- `resumeAccueil(): ResumeAccueil` → `{ aujourdhui{aRelire, aProgrammer, publicationsDuJour}, brouillons, enCours: VueTravail[], dernieres, alertes[{id, ton, message, lien}], budget: VueBudget, pret{visage, voix, lut, logo} }`

### videos
- `listerVideos(f?: {formatId, statut | statut[], etapeEditoriale, ratio, serieId, q, tri: "recentes"|"anciennes"|"titre", inclureArchivees, limite}): VueVideoCarte[]`
- `compterVideosParFormat({seulementPretes?}): Record<formatId, number>` · `listerSeries()`
- `obtenirVideo(id): VueVideoDetail | null` (vidéo, carte, versions, versionCourante, plans+vignettes, sorties+URL, sousTitres, miniatures+URL, kit, publications, partages, retouches, script, distribution résolue, travail, coutLignes, noteQualite, licencesABloquer)
- Brouillons : `creerBrouillon(formatId, {modeleId?, scriptId?, ideeId?}): videoId` · `modifierBrouillon(id, DonneesBrouillon)` · `enregistrerScriptDuBrouillon(videoId, blocs): Script` · `supprimerBrouillon(id)` · `dernierBrouillon()`
- Actions : `archiverVideos(ids)` · `desarchiverVideo(id)` · `changerEtapeEditoriale(id, etape)` · `renommerVideo(id, titre)` · `choisirVersion(videoId, versionId)` · `choisirMiniature(videoId, miniatureId, titre?)` · `corrigerMotSousTitres(videoId, segmentId, indexMot, mot)` · `choisirIllustrationPlan(planId, elementId|null)` (**verrouille** le choix) · `demanderRetouche(videoId, planIds, consigne)` · `enregistrerCommeModele(videoId, nom): modeleId` · `creditsVideo(videoId)`

### fabrication
- `apercuFabrication(videoId): { plans: VuePlan[], estimation{dureeFabricationSec, lignes, total}, budget{restant, depasse, confirmationRequise, seuil}, etapes[{cle, nom, icone}] }` (crée les plans de l'Aperçu si besoin, illustrations auto)
- `plansApercu(videoId)` · `construireCommande(videoId, {simulerEchecEtape?}): CommandeFabrication` (accord bloquant, réglages validés et migrés)
- `lancerFabrication(videoId, {confirme?, simulerEchecEtape?}): {travailId, versionId}` — lève `BUDGET_DEPASSE` ou `CONFIRMATION_REQUISE` (afficher la feuille de confirmation puis rappeler avec `confirme: true`)
- `maquetteRapide(videoId): {url, vignette, dureeSec}` · `lancerRetouche(videoId, planIds, consigne)` · `reexporter(videoId, ratio)`

### travaux
- `listerTravaux({inclureTermines?}): VueTravail[]` (fait avancer la simulation) · `obtenirTravail(id)` · `reessayerTravail(id)` (seules les étapes en échec) · `annulerTravail(id)` · `avancerTravaux()`
- Client : `useTravaux({travailId?, initial?, onTermine?})` → `{ travaux, travail, erreur, actualiser }` (interroge `/api/travaux` toutes les 2 s).

### scripts
- `listerScripts({formatId, reference, favori, q}): (Script & {dureeEstimeeSec, apercu})[]` · `obtenirScript(id)` · `versionsScript(id)`
- `genererScripts({formatId, sujet, cible?, ton?, dureeSec?, nombre? = 3}): ScriptGenere[]` (NON enregistrés) · `enregistrerScript({formatId, sujet, blocs, notes?, dureeCibleSec?, ideeId?, parentId?}): id`
- `modifierScript(id, patch)` (re-note) · `noterScript(blocs, formatId, duree)` · `ameliorerBloc(formatId, bloc, "ameliorer"|"plus-percutant"|"plus-court")` · `validerScript(id)` · `basculerFavori(id)` · `basculerReference(id)`
- `lireFaconDeParler()` / `enregistrerFaconDeParler({expressions, motsInterdits, tutoiement, notes})`

### idees
- `listerIdees({inclureArchivees?})` · `ajouterIdee(texte, formatSuggere?)` (format suggéré automatiquement) · `modifierIdee` · `archiverIdee` · `transformerIdeeEnVideo(id): videoId` · (« en script » : `enregistrerScript({…, ideeId})`)

### modeles
- `listerModeles({formatId?}): VueModele[]` · `obtenirModele` · `renommerModele` · `supprimerModele` · `utiliserModele(id): videoId`

### personnages
- `listerPersonnages(): VuePersonnage[]` · `obtenirPersonnage(id)` · `creerPersonnage({nom, nature, role?})` · `modifierPersonnage(id, patch)`
- `enregistrerAccord(id, {case, documentFichierId, date, perimetre?})` (les 3 obligatoires) · `accordComplet(p)`
- `ajouterVisage(personnageId, {nom, angle, tenue, decor, fichierIds})` · `preparerVisage(visageId)` · `testerVisage(visageId, texte): url`
- `relierVoixExistante(personnageId, idExterne)` (lot M0b, voix HeyGen de Will : contrat `FournisseurVoix.listerVoixExistantes` en place) · `enregistrerVoix(personnageId, {fichierIds, minutes, langue?})` (copie ElevenLabs, secours seulement) · `modifierReglagesVoix(voixId, reglages)` · `ecouterEssaiVoix(voixId, texte): {url, dureeSec}` · `TEXTE_A_LIRE`
- Toute création de double/voix pour une personne réelle sans accord lève `ACCORD_MANQUANT`.

### bibliotheque
- `listerElements({type | type[], q, motCle, formatId}): VueElement[]` · `obtenirElement` · `compterElementsParType()`
- `creerElement({type, nom, motsCles?, valeur, fichierId?, vignetteFichierId?, licence?})` · `modifierElement(id, patch)` · `supprimerElement(id)`
- `definirParDefaut(elementId, formatId)` · `defautsParFormat(type)` · `validerLutCube(contenu)`
- `listerPrononciations()` · `ajouterPrononciation(mot, prononciation)` · `supprimerPrononciation(id)`

### publications
- `obtenirKit(videoId): VueKit | null` (textes par réseau triés par réseaux par défaut, `avertissements` « Trop longue pour Shorts », compteurs, `etiquetteIA`, `sortieConseillee`, `credits`, `avantDePublier`, `publiable`, `licencesABloquer`, `envoiSimule`)
- `modifierTexteKit(videoId, reseau, texte, motsDiese, titre?)` · `regenererTexteKit(videoId, reseau)` · `cocherAvantDePublier(videoId, cle, valeur)`
- `envoyerVersBuffer(videoId, reseaux, dateIso): {simulation, publications}` (V1 : `via: "simulation"`, statut brouillon, **jamais** affichée comme programmée ; toast Essai)
- `noterPublicationManuelle(videoId, reseau, dateIso, statut)` · `listerCalendrier(debutIso, finIso): JourCalendrier[]` · `listerAProgrammer()` · `resultatsVideo(videoId)` · `telechargementsVideo(videoId)` (sorties + liens .srt/.vtt)

### partages
- `creerPartage(videoId, {dureeJours|null, telechargementAutorise, sortieId?}): Partage & {chemin}` · `listerPartages(videoId)` (+ `actif`) · `revoquerPartage(id)`
- `resoudrePartage(code, {compterVue?}): EtatPartage` — **PUBLIC** (pas de session)

### couts · notifications · recherche · reglages · formats · fichiers
- `resumeBudget(): VueBudget` (budget, dépensé, restant, %, seuil, 3 mois, postes) · `definirBudget(mensuelCentimes, seuilCentimes?)`
- `listerNotifications(limite?)` · `compterNonLues()` · `marquerLues(ids?)`
- `rechercher(q): ResultatRecherche` (Vidéos · Scripts · Idées · Bibliothèque)
- `lireReglages()` · `definirAfficherExemples(bool)` (masque sans supprimer) · `definirMentionIA` · `definirReseauxParDefaut` · `definirNotifications` · `listerConnexions()` (Simulation / Relié / À relier) · `listerJournal(limite)` · `aPropos()` · `noterMePrevenir(formatId)` · `formatsAPrevenir()`
- `listerFormatsAvecCompteurs(): CarteFormatVue[]` · `obtenirFicheFormat(id)` → `{format (sans zod), videos prêtes, enCours, scripts, prevenir}`
- `deposerFichierSimule({nom, mime, taille, typeEntite, entiteId}): Fichier` (V1 : aucun octet envoyé ; pastille Essai)

---

## 7. Registres

### Formats (`src/formats`, PUR — importable côté client)
`listerFormats()`, `listerFormatsActifs()`, `trouverFormat(id)`, `obtenirFormat(id)`, `reglagesParDefaut(f)`, `validerReglages(f, r)`, `migrerReglages(f, r, depuisVersion)`, `estimerDureeTexte(f, texte)`, `libelleDuree(sec)`. Couleurs des blocs : `formats/presentation.ts` (`BORDURES_BLOC`, `TEXTES_BLOC`, `FONDS_BLOC`).
`DefinitionFormat` (types.ts) : id, **version**, nom, accroche, description, icone, statut, famille, durees{valeursSec, parDefautSec, extraitsCourtsSec}, ratios, **ratioMaitre**, miseEnPage, **miseEnPageParRatio**, personnages{min, max, roles, sources}, entrees[], **etapes** (clés de la bibliothèque), reglages{**schema zod**, **champs**}, recetteScript{blocs[{id, nom, couleur (jeton), consigne, dureeCibleSec, repetable, role}], regles, criteres, references, motsParSeconde, **annotations**}, stylesParDefaut (ids d'éléments), illustrations{mode, couvertureCiblePct, dureePlanSec, sourcesAutorisees, affichage}, accrocheVisuelle, capacitesRequises, moteur, reseauxConseilles, exemples, aFournir, migrerReglages.
7 formats : `avocat` (ACTIF), `podcast`, `createur-b`, `ecran-partage`, `motion`, `ugc`, `selfie` (bientôt). **Ajouter un format** = un dossier `src/formats/<id>/index.ts` + l'inscrire dans `FORMATS` (formats/index.ts). Test : `pnpm exec vitest run` (`formats/registre.test.ts`).
⚠️ Ne pas passer une `DefinitionFormat` d'un composant serveur à un composant client (schéma zod, fonctions) : passer l'`id` et appeler `obtenirFormat(id)` côté client.

### Briques facultatives (AV2.7)
- `DefinitionFormat.briques` : `Partial<Record<BriqueFacultative, "active" | "desactivee" | "au-choix" | "au-choix-coupee">>` (`au-choix-coupee` : interrupteur coupé par défaut — la mention IA de tous les formats) — briques : sous-titres, etalonnage, illustrations, son, habillage, texte-ecran, mention-ia. Absente = désactivée ; un format peut n'en avoir aucune.
- `briquesCoupables(format)` → les interrupteurs à afficher à l'étape Réglages (« Sous-titres », « Couleurs de cinéma (LUT) », « Musique »…) ; `briquesEffectives(format, coupees, allumees)` → état final (une brique `au-choix-coupee` n'est allumée que si la vidéo la porte dans `briquesAllumees`).
- Vidéo, brouillon (`BrouillonAssistant.briquesCoupees`) et modèle portent `briquesCoupees`. `construireCommande` met `commande.briques` (booléens) et `styles.x = null` pour une brique coupée ; le moteur simulé saute les étapes correspondantes. **Mention IA (décision de Will du 01/10, remplace l'ancienne règle « toujours dans la légende »)** : facultative, coupée par défaut, jamais bloquante, pour tous les formats ; `mentionIA.parDefaut` (Réglages) allume d'un seul interrupteur la pastille pour toutes les nouvelles vidéos ; la légende suit `mentionIA.dansLegende` sans forçage ; « Avant de publier » compte 4 cases quand la mention est coupée (`casesRequises`) ; chaque bascule est consignée au journal. ⛔ À reconfirmer par Will après avis d'un avocat (AI Act art. 50(4)).
- **Dév. A** : ajouter les interrupteurs des briques à l'étape Réglages (`modifier({ briquesCoupees })`).

### Étapes de l'assistant (`src/assistant/etapes`) — **brancher une étape**
1. `meta.ts` : clé dans `CLES_ETAPES` + `META_ETAPES[cle]` (titre, court, icône, libellé du bouton, `repliable`).
2. Un composant client `MonEtape.tsx` : `export function EtapeX(props: ProprietesEtape)` — props : `formatId`, `brouillon: BrouillonAssistant`, `modifier(patch)`, `suivant()`, `allerA(cle)`, `repliee`.
3. `registre.tsx` : `ETAPES[cle] = { cle, Composant, estValide(b), aDesValeursParDefaut?(b), resume?(b) }`.
4. Le format liste la clé dans `etapes`. Rien d'autre ne change.
`Assistant.tsx` (dév. A) : barre d'étapes, transition, `BarreActionCollee` avec `META_ETAPES[cle].action`. Reste à faire (dév. A) : enregistrement serveur à chaque étape (`creerBrouillon` puis `modifierBrouillon` / `enregistrerScriptDuBrouillon`, URL `?brouillon=`), étapes repliées, « Fabriquer avec les réglages habituels », lancement + suivi, comptage des touches (≤ 6).
URL de l'assistant : `/nouvelle/[format]?brouillon=<id>` (reprendre), `?modele=<id>`, `?script=<id>`, `?idee=<id>` (la page lit déjà `brouillon` et `script` ; `modele`/`idee` → appeler `creerBrouillon(formatId, {modeleId|ideeId})` dans une action).

### Moteurs (`src/moteurs`)
`MoteurVideo` : `capacites`, `estimer(commande)`, `etapes(commande)`, `lancer(commande, ctx)`, `avancer(travail, commande, maintenant?)`, `reessayer(travail)`, `retoucher({…, operations?, parent?})`, `reexporter(...)`, `maquette(commande)`, et (facultatifs) `recalquer(…)` (lot M4) et `annuler(travail)` (lot M1b). Un moteur **ne lit que la commande**. Le moteur est **choisi au lancement** (`choisirMoteurAuLancement` : réglage `moteur.<format>` > `MOTEUR_<FORMAT>` > `format.moteur`) et **figé** dans `commande.moteurId` ; tout le reste lit `moteurDeCommande(commande)` — jamais `obtenirMoteur(format.moteur)`. `ResultatFabrication` peut renvoyer `plans`, `sousTitres`, `pistes`, `elementsCrees` (appliqués par `travaux.appliquerProduitsDuMoteur`) ; `ResultatMaquette.fichierCle` est facultatif. `moteurSimulation` : étapes dépendantes (voix → double → montage → couleurs/son/sous-titres → formats d'image → vérification), ~25 s, échec simulé d'une étape au 1er essai via `simulerEchecEtape` (ex. `"visage"`), sorties = `public/demo`. Démo : `v-05` est en fabrication au démarrage, `v-06` en échec (étape « Le double »).

### Briques (`src/briques`) — 13 contrats + simulations : sous-titres, voix (débit de la recette, mots horodatés), nettoyage-blancs, decoupage-plans, visage (toujours sur un son déjà fabriqué), etalonnage, illustrations, decor, composition, son, habillage, export, controle-qualite (`estimer` → lignes de coût, `executer`, `version`). Tarifs des fournisseurs en dollars, convertis au taux `commande.tauxUsdEur`.

### Fournisseurs (`src/fournisseurs`)
script, visage, voix, montage, illustration, etalonnage, son, miniature, publication, texte-reseaux, notification, stockage — tous **simulés**. `resoudreFournisseur(type, valeurEnBase?)` : réglage en base → `FOURNISSEUR_<TYPE>` → simulation. `etatConnexion(type)`, `estSimule(type)`. Pour la voix d'une vidéo, le service passe `Voix.fournisseur` (jamais le réglage global). **Capacités** lues par les moteurs (`audioSeul`, `horodatageMots`, `fondTransparent`, `resolutionMax`, `fpsSortie`, `tarifUsd`) : le chemin se choisit d'après elles, jamais d'après le nom. Contrats du moteur avocat : `FournisseurVoix.lire` (son + mots horodatés) et `listerVoixExistantes`, `FournisseurVisage.rendre / suivreRendu / recuperer / creerLook`, `FournisseurIllustration.chercher / animer`, `FournisseurScript.decouper / accroches / resoudreDistribution` (+ `adresse` partout).

### Réseaux (`src/reseaux`, PUR)
LinkedIn, Instagram, Facebook, TikTok, YouTube, YouTube Shorts : ratios, durée max, export, niveau sonore, **zones protégées par ratio**, légende (longueur, mots-dièse), miniature, étiquette IA. `listerReseaux`, `obtenirReseau`, `verifierPourReseau`, `zoneProtegeeCombinee`.

---

## 8. Données de démonstration (`donnees/memoire/demo.ts`)

Personnages : **Williams** (moi, 2 visages + voix prêts), **Clara** (inventée), **Sophie Lambert** (personnage réel fictif de démonstration, accord manquant → bloquant). 44 éléments (3 LUT avec avant/après, 3 styles de sous-titres, 12 illustrations dont 1 licence à vérifier et 1 expirée, 4 musiques, 6 bruitages, 2 habillages, 3 styles de montage, 3 profils de son…). 15 vidéos (`v-01`…`v-15`, tous statuts, 5 formats, `v-01` en 2 versions), plans, sous-titres, kits, 8 publications (dont 2 « simulation »), 2 partages (`/v/mails7k2` actif, `/v/sms4n8qp` expiré), 2 modèles, 8 idées, 11 scripts dont 3 de référence, dépenses sur 3 mois, 5 notifications. Tout est `estDemo` (Réglages > « Afficher les exemples »). Médias : `public/demo/` (régénérer : `node scripts/generer-medias-demo.mjs`).
Données en mémoire : **perdues au redémarrage** (repart de la démo). Plus tard : Prisma + Postgres derrière les mêmes interfaces `Depot`.

---

## 9. Vérifier

- `pnpm exec tsc --noEmit` (si des types de routes manquent : `pnpm exec next typegen`) ; `pnpm exec eslint <fichiers>` ; `pnpm exec vitest run`.
- Captures (QA) : serveur lancé, puis `E2E_MDP=… node scripts/captures.mjs http://localhost:3100 [chemins…]` → `docs/captures/<page>-390.png` et `-1440.png`.

## 10. Ce qui reste en squelette (à faire au lot 2)

| Groupe | Écrans | État laissé par l'architecte |
|---|---|---|
| A | Accueil | complet (structure AV2.4-3), à peaufiner |
| A | Nouvelle vidéo | modèles + formats actifs + « Bientôt » compacts |
| A | Assistant + 7 étapes | navigation locale ; Sujet et Style fonctionnels ; Script, Qui, Images, Aperçu, Fabrication = squelettes ; aucune persistance |
| A | Écrire, fiche script, Mes modèles | listes en lecture ; génération, édition par blocs, versions, ajout d'idée (sauf champ de l'accueil) à faire |
| B | Personnages, fiche | lecture ; ajout, dépôt, guide de tournage, enregistrement de voix, accord à faire |
| B | Bibliothèque | tuiles + `ListeElements` générique ; LUT (avant/après + curseur d'intensité + .cube), Illustrations, Sous-titres (aperçu animé), ajout, prononciations éditables à faire |
| C | Mes vidéos, onglet format | onglets + grille ; filtres, recherche, tri, sélection multiple, « Me prévenir » à faire |
| C | Fiche vidéo | lecteur, chiffres, onglets en lecture ; kit complet (Avant de publier, Buffer, Télécharger par ratio, .srt/.vtt), retouches, miniature, sous-titres modifiables, partage (feuille), résultats, « Décliner » (bientôt) à faire |
| C | Page publique, Calendrier, Réglages, Notifications, Recherche | fonctionnels en lecture ; 410 pour un lien expiré, vue semaine, formulaires des réglages (mot de passe, budget, exemples…) à faire |

## 11. Moteur avocat — ce que le lot M0 a figé (2026-10-01)

Plan : `Axion-IA/<dossier-de-plan-prive>/PLAN-MOTEUR-AVOCAT.md` (v3.2). Répartition des lots M1b → M4, fichiers et critères de fin : **`docs/MOTEUR-AVOCAT-EXECUTION.md`** (il prime pour la répartition des fichiers).

- **Format avocat v2** (`formats/avocat`) : recette accroche · promesse · cœur · preuve · appel · boucle (4,4 mots/s), réglages `repartitionAngles` / `micro` / `ouvertureSurIllustration`, `migrerReglages` et **`migrerScript`** (scripts v1 migrés à la LECTURE par `scriptAJour`, aucun texte perdu, enregistrés avec `versionFormat` à la prochaine sauvegarde), `durees.mode = "depuis-script"` (zones 25-40 / 40-50 / hors zone), `musique: "interdite"`, `export` 25 i/s 12-16 Mb/s, `profilRendu` et `recetteMontage` figés dans la commande. Le parcours reste en 6 étapes jusqu'au lot M3 (clé `express` déjà inscrite, sans écran).
- **Durée depuis le script** dans toute la chaîne : `dureeVideo`, `estimerDureeTexte`, `zoneDuree`, `dureeParDefaut`, `valeursDuree` (formats/index.ts).
- **Tu / vous** : `Video.adresse`, `Script.adresse`, `commande.adresse` ; défaut = « Ma façon de parler » ; `domaine/adresse.ts` (`analyserAdresse`, `alerteAdresse`, `regleAdresse`).
- **Visages par angle** : `domaine/distribution.ts` (`resoudreVisagesParAngle`, `normaliserTenue`, `visageParDefaut`).
- **Éléments avocat** : `donnees/elements-avocat.ts` (st-avocat-v1, sm-avocat-v1, ps-avocat-v1, hab-avocat-v1, lut-avocat-v1, fond-noir-chaud en décor, acc-micro-podcast, ton-piece-will), installés par la démonstration ET par **`services/migrations.ts`** (migration idempotente lancée par `instrumentation.ts`, ne supprime rien).
- **Statut `annulee`** (vidéo et version) : `annulerTravail` la pose, `reprendreVideo` la remet en brouillon.
- **Sous-titres courants** = la version la plus haute (`videos.sousTitresCourants`).

## 12. Moteur avocat — lot M1b : boucle de fond, R2, `studio-rendu` (2026-10-01)

- **Boucle de fond** (`services/boucle.ts`) : lancée par `instrumentation.ts` APRÈS la migration (aussi sans base), une fois par processus, toutes les 5 s, premier tour immédiat (reprise après redémarrage). Un tour non fini fait SAUTER le suivant. Trois temps : `lireTravauxAAvancer` sous le verrou → `moteur.avancer` HORS verrou avec délai max (30 s, 90 s tant que la voix n'est pas faite) → `ecrireAvancement` / `ecrirePanne` sous le verrou, seulement si le travail n'a pas changé (statut, tentatives, `modifieLe`). Miniatures, textes du kit et notifications partent après, hors verrou. Coupure de secours : `STUDIO_BOUCLE=0`.
- `listerTravaux`, `obtenirTravail`, `listerNotifications` **n'avancent plus rien**. `avancerTravaux()` = un tour (tests).
- **File** (`domaine/suivi.ts`, pur) : 2 vidéos en parallèle (`fabrication.concurrence`), « urgent » passe devant (`rendreUrgent`), rang et heure de début ; les exemples ne prennent pas de place. **Reprise** : 3 essais (30 s, 2 min, 5 min), puis « en attente du fournisseur » relancée toutes les 10 min, échec + notification après 24 h (`Travail.reprise`). Temps restant en minutes + heure de fin, dépense en direct (`EtapeTravail.coutReel` posé par le moteur à chaque étape terminée).
- **Arrêter** : `annulerTravail` → `moteur.annuler` (hors verrou, 30 s) puis, sous le verrou, travail `annule`, vidéo `annulee`, `DepenseEnregistree` des SEULES étapes terminées. Bouton : `components/videos/BoutonArreter.tsx` (suivi de la fiche vidéo et écran de fabrication).
- **R2** (`fournisseurs/r2/`) : signature V4 pure (testée sur l'exemple officiel S3), stockage réel inscrit seulement si `R2_*` existent, activé par `FOURNISSEUR_STOCKAGE=r2`. Lecture navigateur 15 min, HeyGen 24 h, dépôt 6 h. **Envoi par morceaux** direct navigateur → R2 : `lib/envoi-multipart.ts` (10-50 Mo, 3 en parallèle, 3 essais par morceau, reprise d'un envoi interrompu), `/api/depots` (signatures, `services/envois.ts`), `ZoneDepot` prop `envoi`. CSP : `*.r2.cloudflarestorage.com` (+ `R2_PUBLIC_HOST`) ; CORS du seau : `deploiement/r2-cors.json`.
- **`studio-rendu/`** (paquet à part, `tsx`) : `FilesRendu` (file courte prioritaire 2 en parallèle / 30 s, file longue 1 à la fois), serveur HTTP (`POST /rendus`, `GET /rendus/{id}` 404 si inconnu, `/sante`, clé `STUDIO_RENDU_CLE`), opérations `analyse-media` (ffprobe), `image-fixe` (Remotion still), `composition` (squelette M4), `nettoyage-audio` (vide, M1) ; composition `Essai`. Essai local : `cd studio-rendu && npx tsx scripts/essai-local.ts`. Image : `deploiement/studio-rendu/Dockerfile`, service du compose (3 Go, 2 processeurs, priorité basse, réseau interne). Client du studio : `fournisseurs/rendu/client.ts` (`obtenirServiceRendu`, `suivreRendu` : 404 → même `idRendu` soumis à nouveau), simulé sans `STUDIO_RENDU_URL`.
- **Crochet HeyGen** (`/api/crochets/heygen`, `services/crochets.ts`) : 501 sans `HEYGEN_WEBHOOK_SECRET` ; sinon réveil signé (en-tête `x-heygen-signature` ou adresse signée `adresseCrochetHeygen`), contenu ignoré sauf `callback_id`, `EvenementFournisseur` dédoublonné, travail réveillé, état relu par la boucle.
- **Notifications** : `creerNotification` (cloche + file d'envoi) ; `diffuserNotifications` hors verrou : Web Push VAPID (`fournisseurs/notification/push.ts`, abonnement `/api/notifications/abonnement`, `public/sw.js`), e-mail de secours ZeptoMail (`email.ts`, simulé par défaut) ; alerte « budget à 80 % » une fois par mois.
- **Coûts** : `services/couts.ts` `tableauCouts` (par outil, coût moyen, écart annoncé / réel), taux dollar → euro réglable (Réglages > Budget).
- Variables : `deploiement/env.exemple`.

## 13. Moteur avocat — lot M1 : voix → audio maître → plans, maquette (2026-10-02)

- **Moteur `montage-avocat`** (`moteurs/montage-avocat/index.ts`), inscrit dans `MOTEURS` ; la production reste en simulation tant que le réglage `moteur.avocat` n'est pas posé (choix figé dans la commande). Étapes `voix` « Votre voix », `decoupage` « Plans », `visage` « Vous », `montage`, `sous-titres`, `etalonnage`, `son`, `export`, `controle-qualite` « Vérification ». **Réels derrière les fournisseurs** : voix (`FournisseurVoix.lire` de la VOIX de la distribution), nettoyage (`studio-rendu`), report, découpage. **Encore simulés** : visage, montage, couleurs, son, export (lots M4, M6) ; retouche et format ajouté délégués au moteur d'essai. Fournisseurs par injection : `creerMoteurMontageAvocat({ voix, stockage, rendu, environnement })`. Voix sans son seul → `ErreurMoteurAvocat` `VOIX_INCOMPATIBLE` (non réessayable).
- **Voix, phase par phase** (gardée dans `Travail.parametres.voix`, une phase par tour de boucle, jamais d'attente longue) : `a-lire` (texte PRONONCÉ envoyé, `prononciations: []`) → `a-analyser` → `analyse` (studio-rendu reconnaît les respirations) → `nettoyage` (studio-rendu coupe) → `faite` (audio maître + mots décalés par les instants réellement coupés). Échec passager du conteneur : nouvelle demande (`-e1`…, 3 fois), puis la reprise de la boucle ; « Réessayer » après un échec de la voix ne relit PAS le son déjà payé.
- **Report** (`report.ts`, pur) : `preparerTexteVoix` substitue les prononciations en gardant la correspondance ; `reporterHorodatages` aligne lettre à lettre les mots renvoyés par la voix (découpage libre du fournisseur) puis remonte au texte VALIDÉ ; `ecartMoyenMs` pour le contrôle B.5 (`outils/alignement/`).
- **Nettoyage** (`nettoyage.ts`, pur) : tête < 0,1 s, blancs > 180 ms → 80/100/120 ms (dans la phrase / virgule / point), respirations reconnues gardées à 150-250 ms (une toutes les 2 phrases au plus), 0,5 s après le dernier mot, fondus 15 ms ; `decalerTemps`, `coupuresAppliquees` (instants recalés renvoyés par le conteneur), `debitEtVitesseConseillee`. Opération `nettoyage-audio` de `studio-rendu` (`studio-rendu/src/audio/pcm.ts` : décodage FFmpeg, raccords au passage par zéro, fondu enchaîné centré à durée exacte, détection des souffles 1-5 kHz) ; testée sur un **vrai son** (`tests/fixtures/voix-essai.*`, voix de synthèse Windows, `outils/voix-essai/`).
- **Découpage** (`decoupage.ts`, pur) : règles R1 à R13 du plan B.2, une règle = un test (`decoupage.test.ts`) ; `controlerRythme` (alertes `rythme` / `fin`, jamais bloquantes) ; un nombre et son unité ne sont jamais coupés.
- **Audio maître réutilisé** : `empreinteAudioMaitre(commande)` (texte + voix + vitesse + prononciations) ; `services/fabrication.ts` cherche une piste `audio-maitre` de même empreinte (maquette ou fabrication) et la met dans `commande.audioMaitre` (ajout pur du contrat) : la voix n'est ni estimée ni repayée.
- **Maquette** (`maquetteRapide`) : budget vérifié AVANT la voix, version `maquette` avec plans, sous-titres et piste `audio-maitre` (`appliquerProduitsDuMoteur`), aucun fichier vidéo ; renvoie `versionId` et `audioUrl`. Lecture dans le navigateur : `components/creation/MaquetteNavigateur.tsx` (autonome, intégré au lot M3).
- **Notes des scripts** (`domaine/notation-script.ts`, pur) : critères accroche (parle au spectateur selon tu / vous, mot concret), promesse, clarté + densité, preuve, appel unique, durée (zones du format), oralité, boucle ; « à renforcer » sous 70. Utilisé par le générateur simulé (`noter`, `accroches`).
- **Accroches de référence** de la fiche de style : `donnees/references-avocat.ts`, démonstration + migration étape 8.
- **Mesure des références** : `outils/mesures/mesurer-references.ts` → `references-avocat/FICHE-STYLE-AVOCAT.md`.

## 14. Briques communes — la composition centralisée (2026-10-02)

Demande de Will : « certaines choses sont centralisées pour ne pas les refaire à chaque moteur ». La mise en image, écrite au lot M4 au nom du format avocat, est devenue la **brique commune `composition`**, paramétrée par une **recette de format**. Un nouveau moteur (podcast, écran partagé…) écrit sa recette et réutilise tout le reste. **Aucun changement de rendu** : la démonstration M4b refaite avant / après sort octet pour octet identique (`docs/captures/m4-demo/centralisation-preuve.json`).

### Ce qui est centralisé (`src/briques/composition/`, `studio-rendu` générique)

| Sujet | Où | Contenu |
|---|---|---|
| Scène (PUR, sans alias, lue par `studio-rendu`) | `briques/composition/scene.ts` | ratios et tailles, cadre source du double 1080 × 1920, plans, recadrage 9:16 et double ancré en bas en 4:5 / 1:1 (`transformation`, réduction donnée par la recette), zoom lent, accessoire (micro dessiné, capsule entière, marge de flou), encadré et incrustations à l'instant t, paramètres couleurs / son / export, demande `composition` (`ParametresDemandeComposition`) |
| Recette | `briques/composition/recette.ts` | `RecetteComposition` (ci-dessous) et `GEOMETRIE_INCRUSTATIONS_PAR_DEFAUT` |
| Calques image depuis la commande | `briques/composition/image.ts` | LUT de chaque plan (plan > vidéo > visage > format, « aucune »), plages des LUT, décor (fond neutre, photo floutée, Look → repli), source du double (piste transparente, image détourée, silhouette), côté du liseré |
| Encadré de titre | `briques/composition/encadre.ts` | métriques Inter Bold, coupe équilibrée sans mot outil en fin de ligne, placement sous les sous-titres RÉELLEMENT dessinés et au-dessus de la zone protégée (`placerEncadre`, `basSousTitres`, `boiteGroupe`) |
| Incrustations | `briques/composition/incrustations.ts` | montant vert / rouge, objet détouré, « montant dit = montant affiché », un montant jamais écrit deux fois |
| Assemblage | `briques/composition/parametres.ts` | `parametresComposition(commande, entrée, recette)` : image, texte (sous-titres du lot M2, encadré, incrustations), couleurs (LUT, grain, vignette), son (chaîne de la voix, ton de pièce, −14 LUFS, crête vraie), export |
| Demandes à `studio-rendu` | `briques/composition/montage.ts` | une demande par format d'image, file longue, reprise 3 fois, 404 → même identifiant, recalque ; la recette arrive par `OutilsMontage.recette` |
| Contrôles du fichier exporté | `briques/composition/controles.ts` | niveau, crête, pauses, étiquettes BT.709, `+faststart`, débit, cadence, image noire, note |
| Compositions Remotion | `studio-rendu/compositions/commune/` | `CompositionImage` (calques 1-5, repli navigateur du double simulé), `CompositionTexte` (6 bis, 7, 8), `CompositionAccessoire`, micro dessiné, silhouette et `DoubleEssai`, police Inter. Anciens identifiants `Avocat*` gardés (mêmes composants) |
| Passe FFmpeg et export | `studio-rendu/src/composition/` (`image-ffmpeg.ts`, `ffmpeg.ts`, `texte-instants.ts`, `entrees.ts`) et `src/operations/composition.ts` | calques image en une passe FFmpeg, LUT tétraédrique, grain, vignette, master sans texte, texte une image par état, export H.264 ; déjà génériques, ils lisent la scène commune |

### La recette d'un format (`RecetteComposition`)

`angles` par défaut · `encadreParDefaut` · `decorRepli` + `nomDecorRepli` · `reductionLarge` (4:5, 1:1) · `centreSousTitres` hors 9:16 · `tailleSousTitresPx` · `incrustations` (bande, taille du montant, largeur d'un objet) · `realisme` par défaut (grain, taille du grain, vignette) · `lutIntensiteParDefaut`. Tout le reste vient de la **commande** (décor, accessoires, LUT, sous-titres, habillage, profil de son, export, profil de réalisme, recette de montage), choisi dans la console et figé au lancement.

### Ce qui reste propre au moteur avocat (`src/moteurs/montage-avocat/`)

| Fichier | Rôle |
|---|---|
| `recette-composition.ts` | **sa recette** : `RECETTE_COMPOSITION_AVOCAT` (repli N1 Halo orange, 85 % / 72 %, sous-titres à 57 % / 61 %, montant 118 px, grain 4 % de 2 px, vignette 8 %, LUT à 70 %) |
| `decoupage.ts` + `RECETTE_MONTAGE_AVOCAT` (format) | **le rythme et les cadrages** : règles R1-R13, plans, poitrine 120 %, zoom lent, illustrations, deux angles |
| `ENCADRE_OUVERTURE_AVOCAT` (format) | **le titre** d'ouverture (0-3 s, thème puis accroche en majuscules) |
| `nettoyage.ts`, `report.ts`, `empreinte.ts` | la voix : blancs, respirations, report des horodatages, audio maître réutilisé |
| `index.ts` | le moteur : étapes, voix phase par phase, montage via la brique (`outils.recette`), maquette, recalque, format ajouté |
| `composition.ts`, `scene.ts`, `montage.ts`, `controles.ts`, `metriques-inter.ts` | **liaisons** : la brique sous les noms du lot M4 (tests, outils), rien n'y est calculé. Nouveau code : `@/briques/composition` |

Garde : `src/briques/composition/composition.test.ts` (aucun import de format dans la brique, scène sans alias, avocat = brique + recette à l'identique, une autre recette change ce qu'elle dit et rien d'autre). `deploiement/studio-rendu/Dockerfile` copie `src/briques/composition/scene.ts`.

### Remotion

**Remotion figé en 4.x : la 5.0 compte les prestataires dans la taille de l'équipe et ajoute des conditions ; passage en 5 seulement après relecture de la licence et accord de Will.** Aujourd'hui `remotion`, `@remotion/bundler` et `@remotion/renderer` = **4.0.532** exactement (`studio-rendu/package.json`, verrou compris) ; aucun Remotion dans le `package.json` racine. Garde : `tests/remotion-fige.test.ts` (version 4.x exacte, sans `^` ni `~`, la même partout, verrou conforme).

### Lots suivants

Répartition des lots A (M0b + prononciations ∥ M5 + Mes images) et B (décors réalistes ∥ veille des outils), fichiers, interfaces figées le 02/10 et critères de fin : **`docs/BRANCHEMENTS-EXECUTION.md`** (il prime pour la répartition des fichiers).

Lot « intensité · bruitages · crédits · voix par format · calage » (D1 ∥ D2 ∥ D3) et aperçu rapide (fait) : **`docs/LOT-INTENSITE-CREDITS-EXECUTION.md`** (il prime pour la répartition des fichiers). Nouvelles briques communes : `src/briques/intensite/` (chef d'orchestre de l'intensité, bruitages), `services/credits.ts` (une seule chaîne `estimer → verifierBudgetEtCredits → réserver → coût réel`), fournisseur `alignement` (calage WhisperX, conteneur `studio-aligneur`).

## 15. Générateur de scripts (lots G0 → G7, branche `generateur/maquettes`, 2026-10-03)

### Où est quoi

| Élément | Où |
|---|---|
| Écrans | `app/(studio)/ecrire/` (atelier, sujets, matières, tournage, voix), `app/(studio)/mesures/` (mesures, « ce qui marche ») |
| Chaîne d'écriture (PUR, exécutant injecté) | `generateur/chaine.ts` : 1 stratège → 2 fond → 3 accroches → 4 filtre → 5 plan → 6 contrôle du plan → 7 prose → 8 contrôles → 9 juges + duel → 10 réécriture → 11 déclinaisons par réseau → 12 contrôles des versions. Étape 0 (choix conjoint, gratuite) : `generateur/etape-zero.ts` ; étape 13 (rangement) : `services/boucle-generation.ts` |
| Rôles (consignes, schémas, estimations) | `generateur/roles/*` ; estimation réaliste (médiane du banc G4) : `roles/estimation.ts` |
| Services | `services/generateur.ts` (sujets, versions), `services/boucle-generation.ts` (lancement, boucle, reprise), `services/generation-claude.ts` (SEUL chemin qui dépense chez Claude), `services/matieres.ts`, `services/tournage.ts`, `services/telechargements.ts` (contenu des archives), `services/mesures*.ts` |
| Fournisseur Claude | `fournisseurs/claude/` : `client.ts` (fetch + flux SSE, sans SDK), `inscription.ts` (`ANTHROPIC_API_KEY`), `tarifs.ts`, `secret.ts` (`masquerSecrets` : aucune clé ne sort) |
| Fournisseurs de mesures (LECTURE SEULE) | `fournisseurs/mesures/plausible.ts` (`PLAUSIBLE_KEY`, `PLAUSIBLE_URL`, `PLAUSIBLE_SITE`), `fournisseurs/mesures/buffer.ts` (`BUFFER_API_KEY`, `query` GraphQL seulement). Sans clé : mode essai, rien n'est lu ni inventé. Pas de boucle : lecture à la demande |
| Téléchargement groupé | `app/api/telechargements/route.ts` + `lib/zip.ts` (`fluxZip`) : archive envoyée AU FIL DE L'EAU, mémoire bornée à un morceau ; fichier illisible → sauté et nommé dans `FICHIERS-ILLISIBLES.txt` |
| Migration | `services/migrations/etape-19-generateur.ts` : ajoute seulement, rejouable (fiche de style, 93 tournures, 33 règles datées, 2 éléments, contexte de marque) |
| Maquettes du lot GM | `app/(studio)/maquettes-generateur/` : fausses données, **fermées en production** (`layout.tsx` → 404 si `NODE_ENV=production`) |

### Les 12 collections (table unique `documents`, aucune requête DELETE)

`scriptsMaitres`, `variantes`, `preuves`, `matieres`, `exemplesStyle`, `fichesStyle`, `tournesInterdites`, `generations`, `bilansApprentissage`, `contexteAxion`, `reglesDatees`, `sessionsTournage`. Déclarées dans `domaine/types`, l'interface `Depots`, le dépôt mémoire et la liste `COLLECTIONS` de `donnees/postgres`.

### Argent : ordre des contrôles avant chaque appel Claude (`executerRoleFacture`)

1. **Simulation** si Claude n'est pas choisi (réglage `fournisseur.script` ou `FOURNISSEUR_SCRIPT=claude`) ou si la clé manque : 0 $.
2. **Plafond du sujet** (1,50 $ ; + 0,70 $ par format ou corps supplémentaire) : dépensé + réservé par les appels partis en parallèle + estimation réaliste. Contrôle et réservation se font d'un seul tenant sous le verrou des étapes (`reserverDansPlafondSujet`).
3. **Limite du mois** (100 $, réglage `claude.plafondMensuelUsd`) : consommé + réservé + pire cas × 1,2.
4. **Pré-vol** de la brique Crédits (budget du studio, solde Claude suivi).
5. **Réservation** et étape « lancée » écrite AVANT l'appel ; 6. **appel**, coût réel dans `DepenseEnregistree` (`anthropic`).

Reprise d'une écriture « en attente de crédit » : automatique dans le mois (recharge déclarée, limite relevée, réservation rendue). **Au mois suivant**, une écriture bloquée par la limite du mois ou par le budget attend un **geste de Will** (`relancerEcrituresEnAttente`, limite ré-enregistrée, recharge déclarée) ; Will est prévenu une fois par mois.

**Limite connue — redémarrage pendant un appel** : l'API Messages ne permet pas de relire une réponse déjà produite ; l'appel interrompu est rejoué et peut être payé deux fois. Plafonnée : l'étape « lancée » sans réponse garde son pire cas dans la dépense du sujet (jamais plus d'un sujet), sa réservation reste comptée dans son mois puis est soldée (`solderAppelsInterrompus`). D'où la règle de mise en ligne : déployer quand aucune écriture n'est « en cours ».

### Boucles de fond (une par processus, `Symbol.for` sur `globalThis`)

| Boucle | Rythme | Coupure de secours | Lancée par |
|---|---|---|---|
| Fabrications (`services/boucle.ts`) | 5 s | `STUDIO_BOUCLE=0` | `instrumentation.ts`, après la migration |
| Écriture du générateur (`services/boucle-generation.ts`) | 4 s | `STUDIO_BOUCLE_GENERATION=0` | `instrumentation.ts`, premier lancement, ouverture d'une fiche sujet |
| Veille des outils (`services/veille.ts`) | 1 fois par jour | `STUDIO_VEILLE=0` | `instrumentation.ts` |

La boucle d'écriture ne déroule que des générations créées par un geste de Will ; un tour en cours fait sauter le suivant.

### Variables d'environnement du générateur

Toutes transmises par `deploiement/docker-compose.yml` (le compose ne transmet QUE les variables listées) et décrites dans `deploiement/env.exemple` : `ANTHROPIC_API_KEY`, `FOURNISSEUR_SCRIPT`, `STUDIO_BOUCLE_GENERATION`, `STUDIO_BOUCLE`, `PLAUSIBLE_KEY`, `PLAUSIBLE_URL`, `PLAUSIBLE_SITE`, `BUFFER_API_KEY` (et `FAL_PLAFOND_USD`, `STUDIO_ADRESSE`, `EMAIL_SECOURS_ADRESSE`, lues par le code depuis plus tôt).

**Développement seulement** (jamais sur le serveur, ignorées quand `NODE_ENV=production`) : `STUDIO_APERCU_MESURES=1` (exemples de mesures pour les captures, `services/mesures-completes.ts`), `CREDITS_ESSAI` (soldes d'essai), `STUDIO_SIMULATION_LENTEUR_MS` (lenteur de l'écriture simulée).

### Proxy

`src/proxy.ts` ne laisse passer sans connexion que des chemins NOMMÉS (`/_next/static/`, `/_next/image`, `/demo/`, `/icones/`, `favicon.ico`, `robots.txt`, `manifest.webmanifest`, `sw.js`) : plus aucune exception par extension (`.mp4`, `.png`…). Chaque page et action rappelle `exigerSession()`.
