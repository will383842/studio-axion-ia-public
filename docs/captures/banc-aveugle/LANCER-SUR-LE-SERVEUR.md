# Lancer le banc à l'aveugle sur le serveur

Pour la session principale, sur le serveur. Le code est dans `/opt/studio-axion-ia/source` (sans `node_modules`) ; le
conteneur du studio n'a pas `tsx`. On lance donc un conteneur JETABLE, de la même image Node que le `Dockerfile`
(`node:22-bookworm-slim`) :

- le code est monté en LECTURE SEULE (`/source:ro`), et seule une copie minimale (`package.json`, `pnpm-lock.yaml`,
  `pnpm-workspace.yaml`, `tsconfig.json`, `src`, `scripts`, `tests`, ≈ 45 Mo) est faite dans le `/tmp` du conteneur ;
  les dépendances s'installent là et disparaissent avec lui (`--rm`) ;
- la clé arrive par `--env-file /opt/studio-axion-ia/.env` : elle n'est jamais affichée (ne lancez ni `env`, ni
  `printenv`, ni `docker inspect`) ; le banc masque la clé dans tout message d'erreur ;
- mémoire limitée à 2 Go (`--memory 2g`) ;
- aucune base de données, aucun Redis : le banc ne lit ni n'écrit rien d'autre que `/sortie` ;
- il faut l'accès sortant à `registry.npmjs.org` (installation) et à `api.anthropic.com` (appels).

Prérequis : la branche `banc/aveugle-equipe-courte` (ou master après fusion par Will) doit être celle de
`/opt/studio-axion-ia/source`. Vérifier : `ls /opt/studio-axion-ia/source/scripts/banc-aveugle.ts`.

## 1. Estimation (aucun appel, aucune clé, 0 $)

```bash
docker run --rm --memory 2g \
  -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 -e PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
  -v /opt/studio-axion-ia/source:/source:ro \
  node:22-bookworm-slim bash -c '
set -eu
corepack enable
mkdir -p /tmp/banc && cd /tmp/banc
tar -C /source -cf - package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json src scripts tests | tar -xf -
pnpm install --frozen-lockfile --silent
pnpm exec tsx --conditions=react-server scripts/banc-aveugle.ts --estimer'
```

Résultat attendu (calculé sur la branche, 17/10) :

| Sujet (réseau) | Courte : prévu / pire cas | Équipe : prévu / pire cas | Sujet : prévu / pire cas |
|---|---|---|---|
| TPE électricien (TikTok) | 0,35 $ / 0,75 $ | 0,25 $ / 1,13 $ | 0,60 $ / 1,88 $ |
| PME industrie (Instagram) | 0,35 $ / 0,75 $ | 0,25 $ / 1,13 $ | 0,60 $ / 1,87 $ |
| PME DAF, cas fictif (Facebook) | 0,35 $ / 0,75 $ | 0,25 $ / 1,13 $ | 0,60 $ / 1,88 $ |
| ETI DRH (YouTube Shorts) | 0,35 $ / 0,75 $ | 0,25 $ / 1,13 $ | 0,60 $ / 1,87 $ |
| Grand groupe, filiale (LinkedIn) | 0,35 $ / 0,75 $ | 0,25 $ / 1,13 $ | 0,60 $ / 1,88 $ |
| **Total** | | | **≈ 3,00 $ prévu · 9,38 $ au pire** |

Lecture honnête :
- « prévu » de la courte = médianes MESURÉES (banc d'écriture n° 3). Les rôles de l'équipe n'ont JAMAIS été mesurés :
  leur « prévu » est la règle par défaut (entrée + un quart de `maxTokens`), probablement BAS. Avec 4 appels Opus au
  coût d'un appel de la courte (0,14 à 0,17 $), l'équipe coûterait plutôt 0,60 à 0,70 $ par sujet, soit **4,5 à 5 $
  pour le banc entier**.
- « pire cas » = la règle de la réserve du studio (`pireCasChaineCourte`, `pireCasChaineEquipe` : chef appelé deux
  fois, toutes les sorties à `maxTokens`). Il dépasse 8 $ : dans ce cas extrême, le plafond arrête proprement la fin du
  banc (probablement l'équipe du 5e sujet) et le rapport partiel est écrit. **La dépense ne peut pas dépasser 8 $.**

## 2. Banc réel (8 $ au plus)

```bash
mkdir -p /opt/studio-axion-ia/banc-aveugle-sortie
docker run --rm --memory 2g \
  --env-file /opt/studio-axion-ia/.env \
  -e PLAFOND_USD=8 -e DOSSIER=/sortie \
  -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 -e PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
  -e HOTE_UID="$(id -u)" -e HOTE_GID="$(id -g)" \
  -v /opt/studio-axion-ia/source:/source:ro \
  -v /opt/studio-axion-ia/banc-aveugle-sortie:/sortie \
  node:22-bookworm-slim bash -c '
set -eu
trap "chown -R \"\$HOTE_UID:\$HOTE_GID\" /sortie" EXIT
corepack enable
mkdir -p /tmp/banc && cd /tmp/banc
tar -C /source -cf - package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json src scripts tests | tar -xf -
pnpm install --frozen-lockfile --silent
pnpm exec tsx --conditions=react-server scripts/banc-aveugle.ts' 2>&1 | tee /opt/studio-axion-ia/banc-aveugle-sortie/journal.txt
```

- Les `-e` passent APRÈS `--env-file` et l'emportent sur lui : `PLAFOND_USD=8` et `DOSSIER=/sortie` sont imposés même
  si le `.env` contient une variable du même nom.
- Sans `--graine`, la graine est tirée au hasard et notée en tête de `paires.md` et dans `cle.json`.
- Le script refuse de partir si `PLAFOND_USD` dépasse 8 (code de sortie 1) ou si la clé manque (code 2).
- Lancer au PREMIER PLAN et attendre la ligne `Fini · dépense … / 8 $`. Durée non mesurée pour l'équipe ; ordre de
  grandeur : quelques minutes par sujet (G4 : 4 min pour un sujet de la grande chaîne), soit 15 à 30 min.
- Une ligne par appel : `sujet · rôle  modèle  durée  coût · cumul X $ / 8 $`.

## 3. Ce qui sort dans `/opt/studio-axion-ia/banc-aveugle-sortie/`

- `paires.md` : à donner à Will. Pour chaque sujet, « Script A » et « Script B », textes dits seulement.
- `cle.json` : quelle lettre est quelle chaîne. **Ne pas montrer à Will avant son vote.**
- `couts.json` : coût réel et durée par sujet et par chaîne, chaque appel, total, arrêt éventuel du plafond.
- `brut/` : l'état complet de chaque chaîne (il dit qui a écrit quoi : après le vote seulement).
- `journal.txt` : la sortie standard du banc.

Pour vérifier la dépense : `grep -o '"depenseUsd": [0-9.]*' /opt/studio-axion-ia/banc-aveugle-sortie/couts.json`.
