# Correction PR 568 (v4) — fiche MAQ-01

Tête de `usine/MAQ-01-v2` après correction : `df608942b1cc7ae819e82e346abcc09f571d06f9`

- Un seul commit ajouté sur `8cdd3b95`, sans réécriture d'historique.
- `tests/maquettes/maq-01-maquettes.test.ts` : fetch, XMLHttpRequest, WebSocket, sendBeacon, EventSource, `import(` et toute adresse http(s):// sont cherchés dans tout le HTML, attributs d'événement compris. Seules les déclarations `xmlns` sont exclues.
- Les 4 pages HTML ne sont pas modifiées.
- Mutation à la main sur le bouton `#imp` de `stock` : `onclick="fetch('x')"` donne 1 rouge ; `onclick="navigator.sendBeacon('https://x.example')"` donne 1 rouge. Page remise ensuite.
- `npx vitest run tests/maquettes/maq-01-maquettes.test.ts` : 58/58 verts.
