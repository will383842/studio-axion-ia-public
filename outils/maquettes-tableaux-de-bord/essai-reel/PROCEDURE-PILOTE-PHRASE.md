# Procédure du pilote « je pars d'une phrase » (T-EXT-V2-11)

Cette procédure ne se **joue** qu'après le oui écrit de Williams **avec le prix**. Personne d'autre que Williams n'allume un réglage.
La phrase de l'essai est choisie par Williams : cette procédure n'en impose aucune.
Le montant relevé reste dans le terminal du pilote : jamais dans le Studio, jamais dans une vidéo.

## Avant
- [ ] V2-07, V2-09 et V2-10 sont fusionnées et vertes.
- [ ] Le prix accepté par Williams est le chiffre de V2-07, vérifié par l'audit argent.
- [ ] Le plafond de **création par Claude** (celui fixé par V2-07, vérifié par l'audit argent, accepté par Williams en Q1 : 2 propositions au plus) est présent dans le panneau et n'est pas nul, et il n'est pas supérieur au chiffre accepté par Williams. Ce n'est pas le plafond de la vidéo entière. **Sinon : ARRÊT, rien ne s'allume.**
- [ ] Le oui de Williams, avec le prix, est noté par écrit.
- [ ] Williams allume lui-même, dans le panneau des réglages, « entrée par une phrase » et « création par Claude ».
- [ ] Le plafond de création et le plafond de la vidéo sont lus dans le panneau et notés (deux chiffres distincts). Le plafond noté et l'export des dépenses restent **hors du dépôt** : jamais versionnés, jamais collés dans une PR, dans le Studio ni dans une vidéo.

## Pendant
- [ ] Déposer la phrase choisie par Williams.
- [ ] Attendre l'aperçu de la maquette. **En cas d'erreur ou d'attente anormale : ne rien relancer** (ni redéposer la phrase, ni relancer la création, la voix ou le film : chaque relance est un nouvel appel payant). Éteindre les réglages, ARRÊT, faire l'export et le relevé, signaler à Williams.
- [ ] Sur le poste de capture (cloud seulement) : lancer `ecrire-maquette.mts --apercu`.
- [ ] Déposer l'aperçu dans l'écran « Votre maquette ».
- [ ] Williams garde, corrige, demande une autre proposition (une seule : c'est le 2e et dernier appel du maquettiste pour la vidéo) ou arrête.
- [ ] Williams choisit le script.
- [ ] Williams accepte le devis.
- [ ] Voix.
- [ ] Film de la navigation : `--attendue`.
- [ ] Williams regarde la vidéo finie.

## Après
- [ ] **Éteindre** les deux réglages allumés pour l'essai.
- [ ] Exporter les lignes de dépense de la vidéo dans un fichier **hors du dépôt** (JSON : `plafondUsd` pour la vidéo, `plafondCreationUsd` pour la création, et `lignes` avec `role` et `coutUsd`). Dans `role`, écrire le nom du rôle tel quel, en minuscules : `maquettiste` pour les appels qui écrivent la maquette (un autre nom donne un faux « aucune création relevée »).
- [ ] Lancer le relevé, qui s'affiche dans le terminal (remplacer `<export.json>` par le chemin du fichier hors du dépôt) :
  `pnpm exec tsx -e 'import { readFileSync } from "node:fs"; import { relevePhrase } from "./outils/maquettes-tableaux-de-bord/essai-reel/releve-phrase.ts"; console.log(JSON.stringify(relevePhrase(readFileSync(process.argv[1], "utf8")), null, 2));' <export.json>`
- [ ] Un « dépassement », une « aucune création relevée » ou un relevé avec `arret: true` (`sousLePlafond: false` ou `sousLePlafondCreation: false`, écart négatif : la dépense du seul maquettiste dépasse le plafond de création, même si la vidéo reste sous son plafond) ⇒ **ARRÊT** : à signaler à Williams avant toute autre vidéo.
