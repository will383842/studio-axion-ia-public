# Relecture PR 568 (v2) — fiche MAQ-01

**VERDICT : À CORRIGER** (tête relue : `ca497989f0e7615be72ce5037fc6225ec30a4838`, branche `usine/MAQ-01-v2`)

1. **Le test est affaibli par rapport à la 1re version (`88ee47c2`), et pas seulement à cause du nouveau libellé.** Le test de la PR est celui du commit `bc821af3`, réécrit en entier. Contrôles perdus ou assouplis :
   - a. le contrôle des motifs privés (noms de personne, lus hors dépôt via `INTERDITS_PUBLIC_FICHIER`) est supprimé. Il est remplacé par un seul mot écrit en dur et un filtre d'adresses mail ;
   - b. le contrôle « aucune étiquette Essai » est supprimé ;
   - c. l'interdiction de toute ressource externe accepte désormais `fonts.googleapis.com` et `fonts.gstatic.com`. Le lien de polices pourrait donc revenir sans que le test échoue ;
   - d. `<script` était interdit. Seul `<script src=` l'est maintenant ;
   - e. les liens absolus `href="/…"` ne sont plus interdits ;
   - f. le « $ » seul n'est plus refusé (seulement s'il touche un chiffre). Les formes tutoyées `peux`, `veux`, `as`, `es`, `tiens` ne sont plus cherchées.

   Avoir plus de vérifications (46 contre 35) ne compense pas ces pertes. L'ancien test, lancé sur les nouvelles pages, échoue sur 9 points : script en ligne (×4), menu qui n'est plus fixé à gauche (×4) et icônes changées (×1). Seules les icônes et le menu relèvent d'un vrai changement de maquette.

   À faire : remettre les points a à e et f sans exception pour les polices. Pour les scripts, voir le point 2.
2. **Les 4 pages contiennent un script en ligne.** Il n'a aucun appel réseau : seulement des boutons factices, des filtres et des petits messages. Mais la consigne demande « aucun script ni appel externe », et la 1re version n'en avait aucun. Ces scripts viennent bien de la version `bc821af3`, celle que le fondateur a vue.

   À faire, au choix :
   - soit les retirer, ce qui donne des pages purement statiques ;
   - soit faire accepter par écrit au fondateur que ces scripts restent, et garder dans le test l'interdiction des appels réseau, qui y est déjà (`fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`).
3. **La description de la PR affirme « Le test est adapté au nouveau libellé, sans être affaibli ».** C'est inexact (voir le point 1). À corriger avec le test.

## Contrôles effectués
- Tête complète confirmée : `git rev-parse origin/usine/MAQ-01-v2` = `ca497989f0e7615be72ce5037fc6225ec30a4838`.
- (1) **Conforme.** Maquettes comparées à `bc821af3` (usine/MAQ-01) : chacune des 4 pages ne diffère que d'une ligne, le lien Google Fonts retiré comme demandé par la 1re relecture. Tout le reste est identique à l'octet. Le test est identique à l'octet à celui de `bc821af3`. Le point 1 de la 1re relecture est donc réglé.
- (2) **Conforme.** Diff à partir de la base commune : 5 fichiers (4 pages `docs/maquettes/*/index.html` et `tests/maquettes/maq-01-maquettes.test.ts`), les mêmes chemins qu'en 1re relecture. Aucun code applicatif. `scripts/echecs-connus.json` n'est pas touché. Master a avancé depuis la base `6da382d3`, sans conflit sur ces chemins.
- (3) **Conforme.** Aucun prix ni montant (€, $, euros, dollars, prix, tarif, abonnement). Aucun « Buffer », aucun « Essai ». Vouvoiement partout : les deux occurrences de « tes » sont « Vous êtes ». Phrases courtes. La mention « Maquette fictive : rien n'est branché, rien ne part » figure sur les 4 pages. Aucun nom de personne dans le diff, auteur du commit générique.
- (4) **Réserve (point 2).** HTML bien formé, toutes les balises sont fermées. Ouverture dans Chromium en `file://`, avec un clic sur tous les boutons : 4 pages chargées, 0 erreur de console, 0 requête externe. Il reste les scripts en ligne.
- (5) **Non conforme (point 1).** Le test passe : 46/46 verts en local (vitest). Mais il est affaibli.
- (6) **Conforme.** La description mentionne la validation du fondateur du 14/11/2026 (« je valide toutes les maquettes ») et le commit `bc821af3`. Remarque : la trace écrite dans le dépôt privé, demandée en 1re relecture, n'a pas pu être vérifiée d'ici (dépôt public seulement).
- CI de la tête `ca497989` : 7 contrôles sur 8 en succès, « eslint et tsc différentiels » encore en cours au moment de la relecture. La PR est toujours en brouillon.
