# Audit C · « rien de technique à l'écran » — branche `outils/ecran-propre`

Date : 03/10/2026. Base : `origin/master` d186500 (version en ligne).

Règle : Will ne doit jamais lire un nom de service interne (« studio-rendu », « texte-reseaux »…), de l'anglais, du
code, un code HTTP, un identifiant interne, un message brut de fournisseur (HeyGen, Buffer, Claude, fal.ai, R2…) ni
le mot « Simulation ». Le détail technique va seulement en console serveur.

## 1. Défaut connu : choix d'un service dans le Journal

**Avant** : `definirFournisseur` (`src/services/C-videos-publication-complements.ts`) écrivait
`Service « ${type} » : ${propre} choisi` → Will lisait « Service « son » : studio-rendu choisi ».

**Correction**

- `TITRES_SERVICES` déplacée dans `src/fournisseurs/titres.ts` (fichier pur, non client) ; `Connexions.tsx` la
  réexporte (`export { TITRES_SERVICES }`) : rien n'est cassé côté écran.
- Nouveau `src/fournisseurs/journal-lisible.ts` :
  - `phraseChoixService(type, id)` → « Son et mixage : Serveur du studio choisi », « Textes de publication : Claude
    choisi », « Son et mixage remis en mode essai » (titre du service + `implementationPrevue(type, id)?.nom`) ;
  - `traduireLigneJournal(message)` → réécrit à l'AFFICHAGE les anciennes lignes déjà en base (« Service « son » :
    studio-rendu choisi », « Service « texte-reseaux » : claude choisi », « … remis en simulation / en mode essai »).
- `definirFournisseur` journalise `phraseChoixService(type, propre)`.
- `listerJournal` (`src/services/reglages.ts`, seule source de toutes les vues du Journal) traduit chaque ligne.
  Les lignes en base ne sont ni modifiées ni effacées.

**Test ROUGE d'abord** : `tests/c-ecran-journal.test.ts` (4 tests). Rouge sur la base (modules absents), puis rouge
de comportement vérifié en remettant l'ancienne ligne de code (« ROUGE — choisir un service… » échoue), vert après
correction.

## 2. Audit de tout `src/`

La garde `tests/garde-ecran.test.ts` a d'abord été étendue (voir § 3), ce qui a fait sortir 49 constats ; tri à la
main, puis correction.

### Journal (journaliser)

| Fichier | Avant (ce que Will lisait) | Après |
|---|---|---|
| `services/boucle-generation.ts` | « Arrêt gratuit (ANCRAGE_MANQUANT) : … » | « Écriture non lancée, rien n'est payé : … » |
| idem | « n° 12 : écriture lancée (2 réseau(x), complet) » | sans le mode interne |
| idem | « Écriture arrêtée (CLE_REFUSEE) : … » | « Écriture arrêtée : … » (code en console.warn) |
| idem | « Arrêt propre à l'étape 3 (PREUVE_MANQUANTE) : … » | « Écriture mise en pause, rien n'est perdu : … » |
| `services/choix-generateur.ts` | « Choix réservé : probleme-solution, 1 relâchement(s). » | « Plan du sujet choisi. » |
| `services/generation-claude.ts` | « Appel « stratege » resté sans réponse… » | « Un appel à Claude est resté sans réponse… » |
| idem | « Plafond du sujet atteint (1.50 $) avant « prose » » | « … : l'écriture s'arrête là » |
| idem | « « juge » servi par claude-… (repli après refus de claude-…) » | « Une étape a été écrite par le modèle de secours de Claude » (détail en console.info) |
| idem | « Le modèle a changé (not_found_error: model: …) » | phrase fixe seule (détail en console.warn) |
| idem | « Écriture interrompue : overloaded_error … » (message brut de l'API) | phrase fixe selon la cause (surcharge, clé, demande refusée, réponse illisible, sinon « Claude n'a pas répondu ») |
| `services/depense-claude-video.ts` | « « Texte de publication · LinkedIn » … » | même libellé lisible, variable renommée `libelle` |
| `services/boucle.ts` | « Voix … perdue au redémarrage : heygen (…) » | sans l'identifiant du fournisseur |
| `services/matieres.ts` | « Matière ajoutée (anecdote-will) », « Matière retirée (accord-retire) » | « Matière ajoutée (Anecdote) », « (accord retiré) » |
| `services/preuves.ts` | « Preuve ajoutée (chiffre-interne) », « Preuve retirée (faux) » | « (chiffre maison) », « (c'est faux) » |
| `services/reglages.ts` | « Me prévenir quand « avocat-court » sera prêt » | nom du format |

Libellés ajoutés à `src/domaine/matieres.ts` : `LIBELLES_MOTIF_RETRAIT`, `LIBELLES_TYPE_PREUVE`.

### Erreurs (ErreurStudio) et messages bruts

| Fichier | Défaut | Correction |
|---|---|---|
| `services/generation-claude.ts` | `ErreurStudio("CLAUDE_INDISPONIBLE", message)` et « Claude refuse cette demande : ${message} » relayaient le message brut de l'API | phrases fixes |
| `lib/envoi-multipart.ts` | `Morceau refusé (403)` (code HTTP) remontait jusqu'à la bulle d'erreur | « Une partie du fichier n'est pas passée… » ; statut en console.warn |
| `components/ui/ZoneDepot.tsx`, `components/tournage/Seance.tsx`, `components/tournage/Enregistreur.tsx` | `e instanceof Error ? e.message` : un « Failed to fetch » du navigateur était affiché | seul le message d'une `ErreurLisible` est affiché, sinon la phrase fixe |
| `lib/qc-lut.ts`, `services/etalonnage.ts`, `lib/lut3d.ts` | même motif pour les fichiers de couleur | `lut3d` lève des `ErreurLisible` (phrases déjà françaises) ; tout le reste → phrase fixe |
| `app/api/telechargements/route.ts`, `app/api/mes-images/essai-local/route.ts` | `{ erreur: e.message }` d'une exception quelconque | message d'une `ErreurStudio` seulement, sinon phrase fixe |
| `lib/zip.ts` (note « fichiers illisibles » dans l'archive téléchargée) | « b.mp4 (fichier illisible (404)) » | le nom du fichier seul ; détail en console.warn |
| `services/mesures.ts` | message d'une exception quelconque dans « ignorées » (fiche sujet) | `ErreurStudio` seulement |

Nouveau : `src/lib/erreur-lisible.ts` (`ErreurLisible`) — erreur dont le message est déjà une phrase pour Will,
utilisable côté navigateur.

### Vérifié, laissé tel quel

- `slot.role` (`assistant/etapes/Distribution.tsx`) : libellé français du format (« Face caméra ») → exception
  justifiée.
- `${e.message}` dans `services/fabrication-reseaux.ts` : `e` y est une `ErreurStudio` (contrôlé juste avant) →
  exception justifiée.
- Codes de version (« 0042-AV-TT ») : référence métier affichée volontairement partout (B.2.4), pas un identifiant
  interne.
- Rendu du double (`moteurs/montage-avocat/index.ts`, `messagePourWill`) : le détail vient de nos propres erreurs
  HeyGen/rendu, déjà en français et contrôlées par la garde (les tests R7e en dépendent) → inchangé.
- `source-axion.ts`, `depense-claude-video.ts` : le message brut ne part qu'en console.
- Raisons d'abandon des illustrations (`fabrication-illustrations.ts`) : état interne, jamais affiché.

## 3. Garde étendue — `tests/garde-ecran.test.ts`

- Nouveaux contextes contrôlés : `creerNotification({ titre, message })` (cloche, téléphone, e-mail),
  `evenements.enregistrer({ message })` (lignes du Journal écrites directement, migrations), `NextResponse.json` /
  `Response.json` (propriété `erreur` lue par l'écran).
- Nouvelle règle « identifiant interne interpolé » : `${type}`, `${x.id}`, `${role}`, `${modele}`, `${replis}`,
  `${mode}`, `${fournisseur}`, `${formatId}`, `${structure}`, `${propre}`, `${etape}`, `${motif}` dans un message.
  Le défaut d'origine (« Service « ${type} » : ${propre} choisi ») rougit désormais.
- Nouvelle règle « message technique brut » : `e instanceof Error ? e.message : …` ou `(e as Error).message` passé
  tel quel à un message.
- Les `EXCEPTIONS` s'appliquent à toutes les règles (2 entrées, avec leur raison).
- Preuve permanente : nouveau test « rougit aussi sur un identifiant interne au Journal, une notification brute et un
  message d'exception recopié » (extraits fautifs écrits en dur).

`docs/controles/GARDE-ECRAN.md` mis à jour (tableaux « Textes analysés » et « Ce qui est refusé »).

Test existant ajusté : `tests/e2e1-secu-zip-flux.test.ts` attendait « (fichier illisible (404)) » dans la note de
l'archive ; il vérifie maintenant le nom du fichier et l'ABSENCE de « 404 ».

## 4. Résultats des contrôles

| Contrôle | Résultat |
|---|---|
| `npx tsc --noEmit` | 0 erreur (après `npm ci --ignore-scripts` dans `studio-rendu/`, dont les dépendances manquaient dans le conteneur : 9 erreurs « module @remotion/… introuvable » sans rapport avec ce lot) |
| `npx eslint .` | 0 problème |
| `npx vitest run` | 177 fichiers réussis, 1 ignoré ; 2420 tests réussis, 2 ignorés, 0 échec |
| `npx next build --webpack` | réussi |
