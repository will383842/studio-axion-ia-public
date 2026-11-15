# Relecture PR 568 (v3) — fiche MAQ-01

**VERDICT : À CORRIGER** (tête complète relue : `8cdd3b958018d09f5b8d484a66b5637e9ca9b2bc`, branche `usine/MAQ-01-v2`). Il reste un seul point, de gravité **mineure**, qui se corrige en une ligne. Tout le reste est conforme.

1. **`tests/maquettes/maq-01-maquettes.test.ts:51-53`. Gravité : mineure. Les appels réseau ne sont cherchés que dans les balises `<script>`.** La 2e relecture a accepté les scripts en ligne à une condition : que le test interdise `<script src=` et **tout** appel réseau. Or l'expression des lignes 51-52 ne lit que le contenu des balises `<script>…</script>`. Un appel placé dans un attribut d'événement passe donc, et le test reste vert :
   - `onclick="fetch('x')"` ajouté au bouton `#imp` de `stock` : 58/58 verts ;
   - `onclick="navigator.sendBeacon('https://x.example')"` : 58/58 verts. Ici, seul `href`/`src` aurait attrapé l'adresse, et ce n'est pas le cas.

   Les pages actuelles n'ont aucun attribut `on…=` : leurs gestionnaires sont posés en JavaScript. Le défaut n'existe donc que dans le garde-fou, pas dans les pages.

   À faire : chercher les mêmes mots (`fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `EventSource`, `import(`) dans **tout** le HTML, pas seulement dans les scripts, ou bien interdire tout attribut `\son[a-z]+\s*=` dans les balises. Ensuite, la phrase de la description « le test refuse … tout appel réseau » deviendra exacte. Aujourd'hui, elle ne l'est qu'en partie.

## Contrôles effectués
- **Tête complète** : `git rev-parse origin/usine/MAQ-01-v2` = `8cdd3b958018d09f5b8d484a66b5637e9ca9b2bc`, comme attendu. Il n'y a qu'un seul commit depuis `ca497989` (« MAQ-01 : rétablit les contrôles du test des maquettes »), et il ne touche que le test.
- **Diff = 5 fichiers. Conforme.** Diff depuis la base commune `6da382d3` : les 4 pages `docs/maquettes/{a-publier,stock,infographie,ecrans-sans-prix}/index.html` et `tests/maquettes/maq-01-maquettes.test.ts`, soit 624 lignes ajoutées et 0 retirée.
- **`scripts/echecs-connus.json` inchangé. Conforme.** Diff vide.
- **Les 4 pages HTML sont inchangées depuis `ca497989`. Conforme.** `git diff ca497989 8cdd3b95 -- docs/` est vide.
- **Test ciblé. Conforme.** Après `pnpm install --frozen-lockfile` sur un clone neuf, `npx vitest run tests/maquettes` donne 58/58 verts. La CI de la tête est au vert : 8 contrôles sur 8 en succès.
- **Contrôles a à f de la 2e relecture : rétablis, et chacun rougit sous mutation.** Chaque mutation est faite à la main dans `stock/index.html`, puis le fichier est remis en état.
  - a. Motifs privés lus hors dépôt (`INTERDITS_PUBLIC_FICHIER`) : avec un fichier de motifs, un mot interdit ajouté dans un titre donne **1 rouge**. Sans fichier, le contrôle est ignoré, comme dans la 1re version.
  - b. « Essai » ajouté dans le texte : **1 rouge**.
  - c. Polices externes : un `<link href="https://fonts.googleapis.com/…" rel="stylesheet">` donne **1 rouge**. `@import "fonts.googleapis.com/…"` et une simple mention `fonts.gstatic.com` donnent aussi **1 rouge** chacun. L'exception pour les polices a disparu.
  - d. `<script src="x.js">` : **1 rouge**. Un `fetch("x")` dans le script en ligne : **1 rouge**, et aussi dans un `<script type="module">`. Une adresse externe assignée en JavaScript (`new Image().src="https://…"`, `location.href="https://…"`) : **1 rouge**. Seule exception : un appel placé dans un attribut `onclick` (point 1).
  - e. Lien absolu `<a href="/x">` : **1 rouge**.
  - f. « $ » seul dans le texte : **1 rouge**. Formes tutoyées : « Tu peux », « Vous peux » (« peux » seul), « veux » et « tiens » donnent **1 rouge** chacune.
- **Scripts en ligne.** Ils sont acceptés, comme l'a établi la 2e relecture : la maquette validée le 14/11 par le fondateur (« je valide toutes les maquettes », commit `bc821af3`) les contient. Ils n'ont aucun appel réseau, seulement des messages factices.
- **Description de la PR (`gh api …/pulls/568`, le GraphQL n'est pas accessible d'ici).** Elle est corrigée : la phrase « sans être affaibli » a disparu. Elle énumère les contrôles rétablis, annonce 58/58 verts (vérifié) et des mutations qui rougissent (vérifié). Un seul reste : « tout appel réseau » est trop large tant que le point 1 n'est pas corrigé. La PR n'est plus en brouillon.
- **Aucun nom de personne. Conforme.** Les 3 commits ont un auteur générique. Dans les lignes ajoutées, les mots à majuscule sont des libellés d'interface, des réseaux sociaux et des noms de polices. La description dit « le fondateur », sans nom.
