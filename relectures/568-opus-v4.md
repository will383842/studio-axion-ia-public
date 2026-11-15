# Relecture PR 568 (v4) — fiche MAQ-01

**VERDICT : OK — FUSION POSSIBLE sur la tête complète `df608942b1cc7ae819e82e346abcc09f571d06f9`** (branche `usine/MAQ-01-v2`).

Le seul point de la 3e relecture (appels réseau cherchés uniquement dans les balises `<script>`) est corrigé. Aucun nouveau point.

## Contrôles effectués
- **Tête complète** : `git rev-parse origin/usine/MAQ-01-v2` = `df608942b1cc7ae819e82e346abcc09f571d06f9`, comme attendu. Un seul commit depuis `8cdd3b95` : « MAQ-01 : le test cherche les appels réseau dans tout le HTML, attributs d'événement compris ». Il ne touche que `tests/maquettes/maq-01-maquettes.test.ts` (+5 / −3).
- **Correction du point 1 (v3)** : le test inspecte désormais tout le HTML (après retrait des seules valeurs d'attributs `xmlns`), pour `fetch|XMLHttpRequest|WebSocket|sendBeacon|EventSource`, `import(` et toute adresse `http(s)://`.
- **Mutations jetables, non poussées** (bouton `#imp` de `stock/index.html`, fichier remis en état après chaque essai, `git status` propre) :
  - `onclick="fetch('x')"` : **1 rouge** (57/58) ;
  - `onclick="navigator.sendBeacon('https://x.example')"` : **1 rouge** ;
  - en plus : `onload="new WebSocket('ws://x')"` : **1 rouge** ; `onclick="import('x')"` : **1 rouge** ;
  - contournement par le retrait des `xmlns` (`xmlns:a='"' onclick="fetch('x')"`) : **1 rouge**. Le retrait des `xmlns` n'ouvre pas de brèche.
- **4 pages HTML inchangées depuis `8cdd3b95`. Conforme.** `git diff 8cdd3b95 df608942 -- docs/` est vide.
- **Test ciblé. Conforme.** Clone neuf, `pnpm install --frozen-lockfile`, puis `npx vitest run tests/maquettes` : **58/58 verts**.
- **Diff = 5 fichiers. Conforme.** Depuis la base commune `6da382d3` : les 4 pages `docs/maquettes/{a-publier,stock,infographie,ecrans-sans-prix}/index.html` et le test, 626 lignes ajoutées, 0 retirée.
- **`scripts/echecs-connus.json` inchangé. Conforme.** Diff vide.
- **Aucun nom de personne. Conforme.** Auteur du nouveau commit générique ; le message et les lignes modifiées du test ne contiennent aucun nom (« le fondateur » seulement). Les pages sont identiques à celles relues en v3.
- La phrase de la description « le test refuse … tout appel réseau » est maintenant exacte.
