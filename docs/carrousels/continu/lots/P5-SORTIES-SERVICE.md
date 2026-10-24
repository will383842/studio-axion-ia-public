# P5 — Service, rendu de bout en bout, sorties Instagram / Facebook, ZIP, interrupteur : branche `carrousels/continu-p5` (après P2 ; P4/P4b peuvent être bouchonnés puis branchés)
## À créer (`src/visuels/continu/services/`)
- `rendu-toile.ts` :
  - `rendreToile(toile, deps)` : idempotent par `empreinteToile` ; registre `visuels.toile.<empreinte>` ; vérification de l'interrupteur ;
  - une demande `{ operation:"toile-continue", file:"courte", entrees:{}, sortie:{bande.jpg}, parametres:{ proprietes:{toile, versions}, depotsPages:[{cle:"…/page-<i>.jpg", urlDepot}], qualite:95 } }` ;
  - refus si une mesure manque ou est fautive (mêmes phrases que `rendrePageVisuel`, plus « La page N : un texte passe sur la couture », « la page 1 n'invite pas à glisser ») ;
  - résultat `{empreinte, format, pages, bandeCle, vignetteCle}`.
- `carrousels-continus.ts` : `creerToileDepuisSujet`, `deposerSessionToile`, `lancerRenduToile`, `validerToile`, `refuserToile`, `refaireToile`. Même table de statuts (`transitionPermise`), même verrou, même anti double clic que `carrousels.ts`. Importer `ErreurVisuel`, `masquerSecrets`, `RENDU_PERIME_MS` ; ne pas modifier `carrousels.ts`.
  - Après le rendu : `noterToile`. Pour une entrée sujet en simulation, une note de 85 à 89 ou sous 85 déclenche UN `refaireToile` automatique (versionSpec+1) tant que `versionSpec < 3`. Ensuite, sous 85 : statut « bloque » avec la phrase « note N/100 : à refaire ». Entrée session : aucune retouche automatique.
- `production-continus.ts` : `dependancesContinus()` (décision §4.10 de la note : partir de `dependancesCarrousels()` SANS modifier production.ts).
- `vues-continus.ts` : liste et fiche ; URL de lecture ; `nbPages` ; texte du post (P7).
- `src/app/api/carrousels-continus/[id]/zip/route.ts` : `sessionApi` exigée, `fluxZip`. Contenu : `page-01.jpg`…, `texte-du-post.txt`, `textes-alternatifs.txt` (une ligne par page), `LISEZMOI.txt` (« 4:5 : Instagram et Facebook ; 3:4 : téléchargement seulement, l'API Instagram refuse un ratio sous 0,8 »).
## À modifier (existants)
- `src/visuels/interrupteur.ts` : `CLES_INTERRUPTEURS_VISUELS` + `"carrousels-continus.actif"` ; `FamilleVisuelle` + `"carrousels-continus"` ; libellé du journal.
- `src/app/(studio)/reglages/carrousels/page.tsx` : 3e famille « Carrousels continus » ; `actions.ts` : accepter `"carrousels-continus"`.
- `src/visuels/services/vues.ts` : la liste classique filtre `v.famille === "carrousel"`.
- `.github/workflows/tests-visuels.yml` : chemin `src/app/api/carrousels-continus/**`.
## Tests ROUGES d'abord
- Bout en bout en mémoire avec un faux service de rendu (modèle `tests/visuels/tranche-bout-en-bout.test.ts`) : sujet → écrit → rendu → à valider → valider ; refuser ; refaire ; corbeille + restaurer.
- Interrupteur éteint → `GENERATEUR_ETEINT` (défaut : éteint).
- Même toile → aucun second rendu.
- Mesure absente ou `textesSurCouture=1` → `echec_rendu` avec la phrase.
- 11 pages refusées ; ZIP : noms et nombre d'entrées.
- La liste classique n'affiche pas une fiche continue.
- Aucun import de `production.ts` hors de `production-continus.ts`.
