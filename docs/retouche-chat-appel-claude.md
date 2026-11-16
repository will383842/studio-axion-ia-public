# Retouche par chat : procédure pour brancher Claude (G8-05)

Document de procédure SEUL : aucun code, aucun appel, aucune dépense. Il prépare la fiche d'argent G8-OBS, qui sera menée par un chef Opus avec deux audits argent. Tout est lu sur `origin/master` (be15ce9a). Aucun chiffre n'est inventé : chacun cite sa source ou est marqué « à fixer par le propriétaire ».

## 1. Où l'appel est débranché aujourd'hui

- `src/services/retouche-chat/studio.ts:28-30` : `appelNonBranche` lève `ErreurClaude("requete", "LLM du chat de retouche non branché")`.
- `src/services/retouche-chat/studio.ts:32-35` : `portsStudio` prend `options.appeler ?? appelNonBranche`. Sans appelant injecté, rien ne part.
- `src/services/retouche-chat/service.ts:68` : `apercevoirRetouche` appelle `comprendreDemande(..., ports.appeler)`.
- `src/services/retouche-chat/comprendre.ts:1-6` : l'appel est un port injecté (`AppelClaude`), modèle `MODELE_RETOUCHE_CHAT = "claude-opus-5-5"` (ligne 17), 4000 jetons (`MAX_JETONS_RETOUCHE_CHAT`, ligne 18). Si l'appel échoue, `comprendreDemande` passe à la lecture simple par mots-clés (`lecture-regles.ts`), sans exception.
- `src/services/retouche-chat/donnees-sures.ts:1-6` (S3-04) : consigne fermée. Tout texte de la vidéo ou de l'utilisateur est balisé comme DONNÉE, `neutraliser` remplace tous les `<` et `>`, `PHRASE_MAX = 2000`, la réponse est relue contre la liste fermée des opérations. Le fichier précise lui-même : « non branché », le branchement attend W1 (= W-A, Claude dans le chat).

Conséquence : brancher = fournir un `appeler` à `portsStudio`. Rien d'autre à rouvrir côté lecture de la phrase.

## 2. Le seul chemin facturé permis

- Chemin unique : `executerRolePourVideo` (`src/services/depense-claude-video.ts:256`), qui s'appuie sur `generation-claude.ts` et la brique Crédits. JAMAIS `src/fournisseurs/claude/client.ts` en direct, JAMAIS un appel hors suivi.
- Ordre des gardes, tel que lu (lignes 256-340) : simulation si Claude n'est pas choisi (0 $, ligne 263) ; comptes épuisés ; sous le verrou du mois : plafond de la vidéo (`plafondKitUsd`, ligne 315), limite Claude du mois (lignes 324-333), pré-vol et réservation (`verifierEtReserverSelonOrigine`, ligne 339) ; puis appel, coût réel écrit en `DepenseEnregistree`, réservation « consommée ».
- Ce que 0a (#692) a mis sous plafond : le chemin « Rédiger avec l'IA » des guides (`src/fournisseurs/claude/appel-redaction.ts`, `src/services/guides-redaction.ts`), avec `tests/guides-redaction-plafond.test.ts` et `tests/v4-argent.test.ts`. Il fournit le modèle à suivre (plafond, suivi des dépenses, refus propre) ; le chat de retouche n'en bénéficie pas : son appel reste débranché.
- Le chat doit être un appelant de plus de ce chemin, avec sa propre étape de dépense (préfixe à fixer par G8-OBS, de la forme « Retouche chat · … », comme `PREFIXE_ETAPE_MONTEUR` ligne 53) pour que ses dépenses se reconnaissent.
- Si Claude n'est pas choisi ou la clé manque : simulation, 0 $, lecture simple. Le chat reste utilisable.

## 3. Le plafond : dédié au chat

- Décision W-A (journal du 16/11 12:30, `AUDIT-ACCELERATION.md` ligne 50) : oui pour le chat seulement, sous un plafond mensuel dédié (exemple de l'audit : 5 €/mois, valeur à fixer par le propriétaire), après la 1re retouche gratuite ; pas « par vidéo » tant que ce n'est pas chiffré.
- Refus clair au plafond : message en mots simples, la lecture simple reste disponible (aucun blocage de la retouche elle-même).
- 1re retouche gratuite : lecture simple par mots-clés (0 €) ; Claude n'intervient qu'ensuite (règle exacte à écrire par G8-OBS).
- Fichier protégé à toucher pour un plafond propre : `src/services/depense-claude-video.ts`, ligne 73 (`id: "tbdec" | "tbscr" | "favid"` du type `PlafondPropre`, lignes 71-86), plus les préfixes lignes 104-107 et le calcul `engagePlafondPropreCentimes` (ligne 124). Ce fichier est en zone argent, interdit aux fiches ordinaires. G8-OBS est donc une fiche d'argent, menée par un chef Opus avec deux audits argent, et seulement après la réponse du propriétaire au point ouvert ci-dessous.
- Sans modifier ce fichier, le seul plafond disponible serait celui des textes de la vidéo (0,30 $ par vidéo, ligne 40), qui n'est pas celui voulu : les retouches mangeraient les textes de publication.

## 4. Le réglage

- Éteint par défaut ; seul `true` allume, lu par `lireParametre` (`src/services/_commun.ts:47`, défaut si absent).
- Nom proposé : `retoucheChat.claude` (à confirmer par G8-OBS). Plafond dédié : réglage distinct, en dollars comme les autres (`claude.plafondKitUsd`, `tableau.plafondDecoupageUsd`).
- Allumage : par le propriétaire seulement, jamais par une fiche, jamais par le code. Test obligatoire « éteint = identique » : aucun appel, aucune dépense, comportement actuel.

## 5. Le coût annoncé

- Estimation de l'audit : environ 0,03 à 0,10 € par message (`V4.md`, repris par `AUDIT-ACCELERATION.md` ligne 50). Estimation, pas mesure : à vérifier sur les premières dépenses réelles.
- À afficher AVANT l'envoi, en euros (une seule monnaie à l'écran, comme les autres prix, via `tauxUsdEur`). Le pire cas vient de `pireCasRole` (ligne 28 des imports) ; le montant affiché ne doit jamais être inférieur à ce qui sera réservé.

## 6. Point ouvert du 16/11 12:50 (NON tranché ici)

Source : journal de coordination du 16/11 12:50. Le chemin 0a refuse au plafond (plafond du mois, crédit, prix à confirmer), alors que le propriétaire a décidé le 11/11 « le Studio ne bloque jamais pour un prix » (mode budget « indicatif »). Question posée au propriétaire ; aucune fiche d'argent W-A ne part avant sa réponse. Constat de code : `executerRolePourVideo` gère déjà les deux régimes (`indicatif`, ligne 291 : `jugerPlafond` renvoie « ok » avec une alerte au lieu de « bloque » ; limite du mois, lignes 324-333 : alerte seule si indicatif, sinon refus).

Variante A : refus au plafond (comme 0a).
- Le chat refuse dès que le plafond dédié ou la limite Claude du mois est atteint ; message clair ; la lecture simple reste possible.
- Pour : l'argent est borné, vérifiable par test. Contre : contredit « ne bloque jamais pour un prix » ; le propriétaire peut être arrêté en pleine retouche.
- Recommandation du pilote (non décisionnelle) : refus à la limite Claude du mois ; « crédit / prix à confirmer » en alerte plus confirmation pour les actions du propriétaire.

Variante B : indicatif, jamais de blocage pour un prix.
- Le plafond dédié devient un repère : dépassement = cloche d'alerte, la retouche continue (`jugerPlafond` renvoie « ok »). Seuls un crédit Claude épuisé (refus d'Anthropic) ou le quota d'appels arrêtent.
- Pour : cohérent avec la décision du 11/11. Contre : la dépense du chat n'a plus de borne dure ; à n'accepter que si le propriétaire le dit par écrit pour le chat.

G8-OBS écrira l'une ou l'autre selon la réponse du propriétaire, jamais avant.

## Critères pour G8-OBS (à reprendre)

Fiche d'argent, chef Opus, 2 audits argent ; fichiers protégés listés en § 3 ; test rouge d'abord, test « éteint = identique », contre-épreuve du plafond ; aucune clé, aucun montant de crédit réel dans ce dépôt public.
