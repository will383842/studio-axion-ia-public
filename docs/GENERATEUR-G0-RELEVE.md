# Générateur de scripts : relevé du lot G0 (Claude et crédits), 02/10/2026

Plan : `_GENERATEUR-SCRIPTS-2026-10-02/11-PLAN-FINAL-GENERATEUR-v5.md` (B.3.2 à B.3.8, B.9, B.10 ligne G0) ;
l'addendum du 02/10 prime : **budget Claude de Will = 30 $ par mois**. Branche `generateur/maquettes`, rien commité.
**Aucune clé Claude n'existe encore** : tout tourne et se teste en simulation ou sur des réponses enregistrées.

## 1. Livré

| Fichier | Rôle |
|---|---|
| `src/fournisseurs/claude/client.ts` | Client `fetch` minimal, serveur seulement, **sans SDK** (non installé) : flux SSE, délai d'inactivité 60 s, délai total 180 s, erreurs classées (`facturation`, `modele-introuvable`, `surcharge`, `cle-refusee`…), messages masqués |
| `src/fournisseurs/claude/tarifs.ts` | Tarifs (pur), coût sur le modèle **renvoyé**, pire cas d'un appel |
| `src/fournisseurs/claude/secret.ts` | Masquage (clé connue + tout motif `sk-ant-`) ; `nettoyerEvenementSentry` (le `beforeSend`, prêt : **Sentry n'est pas dans le studio**) |
| `src/fournisseurs/claude/inscription.ts` | `scriptClaude()` (inscrit seulement si `ANTHROPIC_API_KEY` existe) ; fournisseur `claude` dont **toutes les anciennes méthodes sont celles de la simulation** ; `executerRole` |
| `src/generateur/roles/types.ts`, `sonde.ts` | Contrat d'un rôle (B.3.1), phrases fixes, requête avec le contexte en cache dans l'ordre figé (B.3.3), rôle « sonde » |
| `src/services/generation-claude.ts` | `executerRoleFacture` : simulation si Claude n'est pas choisi ; plafond du sujet ; **plafond mensuel 30 $** (`claude.plafondMensuelUsd`) ; pré-vol `verifierBudgetEtCredits` ; `reserverCredits` ; coût réel dans `DepenseEnregistree` (`anthropic`, `scriptMaitreId`) ; facturation → `en-attente-credit` sans nouvel essai ; modèle introuvable → `bloquee-modele` ; 429/529/5xx → 3 essais. `reprendreGenerationsEnAttenteCredit`, `declarerRechargeClaude`, `definirPlafondMensuelClaude`, `etatClaude` |
| `src/generateur/fixtures.ts`, `outils/generateur/exporter-fixture.mts`, `tests/generateur/*-fictives.ts` | Fixtures sans donnée client : anonymisation et refus d'écrire ; registres fictifs ; liste locale `.fixtures-termes-sensibles` (ignorée par git) |
| `outils/generateur/essai-claude.mts` | Essai réel ≤ 0,05 $ (pire cas calculé avant : 0,041 $), **pas lancé** |
| `docs/correctifs/G0-inscription-scriptClaude.patch` | La ligne `...scriptClaude()` de `fournisseurs/index.ts` (fichier partagé avec la session du moteur) : préparée, **non posée** |

Fichier partagé touché : `.gitignore` (deux lignes ajoutées en fin).

## 2. Vérifié avec la skill `claude-api` (02/10)

- Modèles : `claude-opus-5-5` (4 $ / 20 $ par million, lecture en cache 0,20 $, écriture 5 $), `claude-sonnet-5-5` (2 $ / 10 $, 0,20 $). Tarifs du plan confirmés.
- Opus 5.5 : pensée toujours active (on n'envoie pas `thinking`), **effort par défaut `medium`** donc toujours explicite (`output_config.effort`) ; `temperature` refusée ; `tool_choice` forcé refusé ; pas de pré-remplissage.
- Sortie structurée : `output_config.format = { type: "json_schema", schema }`.
- Cache : au plus 4 points ; minimum mis en cache 512 jetons sur Opus 5.5 et Sonnet 5.5 ; un changement d'effort invalide le cache des messages (effort fixe par rôle, donc sans effet ici).
- Repli serveur : `fallbacks: "default"` + `anthropic-beta: server-side-fallback-2026-07-01` (activé ; le coût est alors compté au plus cher des deux modèles).
- Erreurs : 402 `billing_error` ; 404 `not_found_error` « model: … » ; 429 ; 529 `overloaded_error`. Formes historiques aussi traitées comme facturation : 400 « credit balance is too low », « API usage limits ».

## 3. Reste ouvert (demande la clé)

1. **Appel réel ≤ 0,05 $** : `pnpm exec tsx --conditions=react-server outils/generateur/essai-claude.mts` (vérifie aussi `cache_read_input_tokens`, la forme du 404 et la variance de 3 tirages Sonnet ; sortie `docs/captures/g0-claude/essai.json`). Chargement vérifié avec une fausse clé : refus 401, 0 $.
2. **Forme exacte d'un refus de facturation** : non provocable ; relevée au premier vrai refus (journal).
3. **Mesure sur 5 sujets** (p50, p90, `maxTokens` p99 par rôle) : attend les rôles d'écriture (G4).
4. **Reprise automatique sans geste** : `reprendreGenerationsEnAttenteCredit` est prête ; elle part déjà sur « J'ai rechargé Claude » (`declarerRechargeClaude`) et sur une limite relevée. L'appel à chaque tour de boucle se branchera dans `boucle-generation.ts` (G4).

## 4. Révocation de la clé (à reporter dans CREDITS-ET-CLES sur accord de Will)

1. platform.claude.com → Settings → API keys → la clé « studio-video-prod » → **Disable / Delete**.
2. Créer une nouvelle clé dans l'espace de travail « Studio vidéo », la coller dans Coolify (`ANTHROPIC_API_KEY`, portée exécution), redémarrer.
3. Réglages > Connexions → Claude → « Tester la connexion » : « Clé acceptée · …XXXX ».
4. Si la clé a pu fuiter : vérifier la consommation du jour sur platform.claude.com (Usage) et la comparer à Réglages > Crédits.
