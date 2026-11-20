# Procédure du pilote « je pars d'une phrase » (T-EXT-V2-11)

Cette procédure ne se **joue** qu'après le oui écrit de Williams **avec le prix**. Personne d'autre que Williams n'allume un réglage.
La phrase de l'essai est choisie par Williams : cette procédure n'en impose aucune.
Le montant relevé reste dans le terminal du pilote : jamais dans le Studio, jamais dans une vidéo.

## Avant
- [ ] Le oui de Williams, avec le prix, est noté par écrit.
- [ ] Williams allume lui-même, dans le panneau des réglages, « entrée par une phrase » et « création par Claude ».
- [ ] Le plafond de la vidéo est lu dans le panneau et noté.

## Pendant
- [ ] Déposer la phrase choisie par Williams.
- [ ] Attendre l'aperçu de la maquette.
- [ ] Sur le poste de capture (cloud seulement) : lancer `ecrire-maquette.mts --apercu`.
- [ ] Déposer l'aperçu dans l'écran « Votre maquette ».
- [ ] Williams garde, corrige, demande une autre proposition (une seule) ou arrête.
- [ ] Williams choisit le script.
- [ ] Williams accepte le devis.
- [ ] Voix.
- [ ] Film de la navigation : `--attendue`.
- [ ] Williams regarde la vidéo finie.

## Après
- [ ] **Éteindre** les deux réglages allumés pour l'essai.
- [ ] Exporter les lignes de dépense de la vidéo (JSON : `plafondUsd` et `lignes` avec `role` et `coutUsd`).
- [ ] Lancer le relevé (`releve-phrase.ts`, fonction `relevePhrase`) sur cet export.
- [ ] Un « dépassement » ou « aucune création relevée » se signale à Williams avant toute autre vidéo.
