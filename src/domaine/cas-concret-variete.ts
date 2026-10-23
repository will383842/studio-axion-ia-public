/**
 * MÉMOIRE ANTI-COPIE DES SCRIPTS DU CAS CONCRET (demande de Will, 18/10/2026 : le script d'un nouveau cas copiait la
 * première vidéo, mêmes blocs, mêmes tournures). PUR : aucune lecture de base, aucun appel ; le service lit les scripts
 * déjà écrits ou validés et les passe en paramètre.
 *
 * - `memoireAntiCopie` : les séquences de `TAILLE_MEMOIRE` mots ou plus DÉJÀ DITES dans les scripts donnés (casse,
 *   ponctuation et accents ignorés ; hors mots outils ; hors ce que le cas courant doit redire : sa promesse, ses faits…),
 *   les plus fréquentes puis les plus longues d'abord, plafonnées (`MEMOIRE_MAX_SEQUENCES`, `MEMOIRE_MAX_CARACTERES`).
 *   Elle grossit toute seule : chaque script de plus ajoute ses séquences.
 * - `copiesDe` : les séquences de `TAILLE_SIMILARITE` mots ou plus d'un script rendu qui sont reprises d'un script antérieur
 *   (même exclusions).
 *
 * Une séquence ne traverse jamais la fin d'une phrase (. ! ? …) ; elle compte au moins `PLEINS_MIN` mots pleins.
 */
export {
  MEMOIRE_MAX_CARACTERES,
  MEMOIRE_MAX_SEQUENCES,
  MEMOIRE_MOTS_MAX,
  blocMemoire,
  memoireAntiCopie,
} from "@/domaine/ecriture-commune/memoire";
export {
  PLEINS_MIN,
  TAILLE_MEMOIRE,
  TAILLE_SIMILARITE,
  copiesDe,
  sequencesDe,
  type OptionsVariete,
  type Sequence,
} from "@/domaine/ecriture-commune/ressemblance";
