# NAV · où vont les captures

Les parcours navigateur Zernio (`tests-navigateur/zernio/*.spec.ts`) **ne produisent ni ne conservent aucune capture, image ou vidéo dans ce dépôt public** (`screenshot: "off"` dans `playwright.config.ts` pour NAV ; pas de vidéo).

## Destination

Toute capture prise à la main ou par un essai local va dans le dépôt **privé** :

```
axion-plans-prive/studio/captures-zernio/
```

Ce dépôt public n'y pousse rien (la routine NAV n'a pas accès au privé).

## Nommage conseillé

`<ecran>-<parcours>-<format>-<theme>.png`, par exemple :

- `connexions-tester-bureau-sombre.png`
- `migration-ecart-telephone-clair.png`

Formats : `bureau` (1440 px) et `telephone` (390 px) ; thèmes : `clair` et `sombre`.

## À ne jamais y mettre

Un identifiant réel (compte, publication), une clé, un nom de personne. Les essais utilisent uniquement des données fictives « exemple-… ».

## Rappel

Les dossiers `test-results/` et `playwright-report/` sont ignorés par git : ne les forcez pas dans un commit.
