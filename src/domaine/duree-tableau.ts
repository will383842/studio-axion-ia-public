/**
 * DURÉE DITE DU TABLEAU ANIMÉ — LE SEUL ESTIMATEUR, partagé par le générateur de scripts (fourchette par réseau, durée
 * affichée à l'écran), les règles du découpage (temps des scènes : douleur en tête, rythme, durée maximale, geste fort)
 * et la consigne du découpage. Domaine PUR : sa seule dépendance est `./debit-voix` (constantes de débit, pur lui aussi).
 *
 * CONSTAT DU 12/10 (essai réel n° 2) : trois estimateurs différents. Le générateur comptait 3,6 mots par seconde (plus
 * une pause par phrase), les règles 2,6 mots par seconde. Le même script de 1 487 caractères dits était accepté par le
 * générateur pour le fil (40 à 75 s), puis refusé au découpage (« environ 96,9 s », plafond 90 s), alors que la voix
 * réelle l'aurait dit en 75 s environ.
 *
 * CALAGE sur la voix RÉELLE, recette en vigueur `voix-tableau/1` (`src/moteurs/montage-tableau/recette-voix.ts` :
 * HeyGen starfish, vitesse 1,1, puis `atempo` 1,08, blancs resserrés) :
 *  - un script de 857 caractères dits → 43,0 s mesurées en production (12/10) ;
 *  - le témoin « Formation » (`tests/tableau/style-v2/temoin-formation.ts`, 1 106 caractères) → 52,3 s mesurées.
 * Débit retenu : 20,5 caractères par seconde, espaces et ponctuation compris (857 → 41,8 s, écart −2,8 % ;
 * 1 106 → 54,0 s, écart +3,2 %). Le caractère suit mieux la voix que le mot (un mot long dure plus qu'un mot court) et
 * c'est déjà l'unité du tarif de la voix. `tests/tableau/duree-tableau.test.ts` vérifie les deux mesures à 10 % près ;
 * une autre recette de voix (identifiant différent) oblige à recaler (le test échoue).
 *
 * [HISTORIQUE, remplacé par le recalage B2a ci-dessous] RECALAGE du 18/10 (accord de Will) : recette `voix-tableau/2`, `atempo` 1,04 au lieu de 1,08 (voix 4 % plus lente).
 * Débit recalé par le calcul, en attendant la mesure de la prochaine vraie vidéo : 20,5 × 1,04 / 1,08 ≈ 19,7 caractères
 * par seconde (ancien débit ; aujourd'hui 16,9). Les mesures ci-dessous restent celles faites à 1,08 (`ATEMPO_DES_MESURES`).
 *
 * RECALAGE du lot B2a : 165 mots/min, voir `DEBIT_TABLEAU_MOTS_PAR_SEC` ci-dessous. Les mesures de calage restent celles
 * faites à `atempo` 1,08 (`ATEMPO_DES_MESURES`) ; `tests/tableau/duree-tableau.test.ts` les ramène à la recette en vigueur
 * (vitesse × `atempo`) avant de les comparer à l'estimateur, à 10 % près.
 *
 * ⚠ DÉBIT NON MESURÉ : 16,9 caractères/s (= 2,75 × 6,15) est une CIBLE, pas une mesure. Le débit réel de `voix-tableau/3`
 * est À MESURER sur la 1re vraie vidéo produite avec cette recette, puis ajouté à `MESURES_CALAGE` (avec
 * `ATEMPO_DES_MESURES` mis à jour) et l'estimateur recalé si l'écart dépasse 10 %. Au plafond de 90 s, la limite
 * (1 520 caractères dits) vaut ce que vaut cette cible.
 */
import { CARACTERES_PAR_MOT_FR, DEBIT_CIBLE_MOTS_PAR_SEC, plafondMotsParSec } from "./debit-voix";

/** Recette de voix sur laquelle le débit est calé (`RECETTE_VOIX_TABLEAU.id`). */
export const RECETTE_CALEE = "voix-tableau/3";

/**
 * RECALAGE du lot B2a (décision de Will) : recette `voix-tableau/3` (HeyGen 1,0, `atempo` 1,0, blanc de phrase 0,30 s),
 * ≈ 165 mots par minute. Le débit est celui du module `domaine/debit-voix` (cible 2,75 mots/s, plafond +10 %), branché
 * ICI seulement : Image→vidéo (3,4 mots/s) et le cas concret gardent leur débit.
 */
export const DEBIT_TABLEAU_MOTS_PAR_SEC = DEBIT_CIBLE_MOTS_PAR_SEC;

/** Au-delà de ce débit (mots/s), la voix du tableau est jugée trop rapide (cible + 10 %). */
export const PLAFOND_DEBIT_TABLEAU_MOTS_PAR_SEC = plafondMotsParSec();

/**
 * Débit de la voix du tableau, en caractères dits par seconde : 2,75 mots/s × 6,15 caractères par mot ≈ 16,9. CIBLE, pas
 * mesure : à mesurer sur la 1re vraie vidéo `voix-tableau/3`, puis à consigner dans `MESURES_CALAGE`.
 */
export const CARACTERES_PAR_SECONDE_TABLEAU = Math.round(DEBIT_TABLEAU_MOTS_PAR_SEC * CARACTERES_PAR_MOT_FR * 10) / 10;

/**
 * Débit de la recette `voix-tableau/1` (`atempo` 1,08), celle des mesures de calage ; c'est aussi le débit de la voix du
 * cas concret, qui garde sa propre recette à 1,08 (`src/moteurs/montage-cas-concret/recette-voix.ts`).
 */
export const CARACTERES_PAR_SECONDE_ATEMPO_108 = 20.5;

/** `atempo` de la recette sur laquelle les mesures de calage ont été faites. */
export const ATEMPO_DES_MESURES = 1.08;

/** Plafond de durée d'une vidéo du tableau (règle 14 du découpage ; aucune fourchette du générateur ne le dépasse). */
export const DUREE_MAX_TABLEAU_SEC = 90;

/** Début de la vidéo où la douleur doit être dite, écrite et soulignée (règles 10 et 17 du découpage). */
export const DEBUT_DOULEUR_SEC = 3;

/** Mesures réelles qui ont servi au calage (gardées pour les tests et la documentation). */
export const MESURES_CALAGE = [
  { quoi: "script de l'essai du 12/10", caracteres: 857, dureeSec: 43.0 },
  { quoi: "témoin « Formation »", caracteres: 1106, dureeSec: 52.3 },
] as const;

/** Caractères dits d'un texte : espaces resserrés (une espace entre deux mots), ponctuation comprise. */
export function caracteresDits(texte: string): number {
  return texte.replace(/\s+/g, " ").trim().length;
}

/** Durée estimée d'un texte dit, en secondes (non arrondie). */
export function dureeDiteBrute(texte: string, caracteresParSeconde = CARACTERES_PAR_SECONDE_TABLEAU): number {
  return caracteresDits(texte) / caracteresParSeconde;
}

/** Durée estimée d'un texte dit, en secondes, arrondie au dixième. */
export function dureeDiteSec(texte: string, caracteresParSeconde = CARACTERES_PAR_SECONDE_TABLEAU): number {
  return Math.round(dureeDiteBrute(texte, caracteresParSeconde) * 10) / 10;
}

/** Nombre de caractères dits en `secondes` (arrondi au caractère inférieur). */
export function caracteresEn(secondes: number, caracteresParSeconde = CARACTERES_PAR_SECONDE_TABLEAU): number {
  return Math.floor(secondes * caracteresParSeconde);
}

/** Caractères à retirer pour qu'un texte dure au plus `plafondSec` (0 s'il tient déjà). */
export function caracteresEnTrop(texte: string, plafondSec: number, caracteresParSeconde = CARACTERES_PAR_SECONDE_TABLEAU): number {
  return Math.max(0, caracteresDits(texte) - caracteresEn(plafondSec, caracteresParSeconde));
}

/**
 * LA borne de longueur du texte dit (constat du 12/10, essai réel n° 3 : l'écran affichait « 1670 / 1600 » pour un
 * script que le générateur venait d'accepter) : les caractères dits en `DUREE_MAX_TABLEAU_SEC` à ce débit, soit 1 520 au débit cible de 16,9 caractères/s.
 * 1 520 est la valeur VOULUE, figée en constante explicite : 90 × 16,9 vaut 1 521 sur le papier, mais en virgule flottante JS donne 1520,9999999999998 (`Math.floor` : 1 520). Un test garde l'accord avec `caracteresEn(DUREE_MAX_TABLEAU_SEC)` ; toute comparaison de longueur (écran, durée, découpage) passe par cette constante, jamais par une durée en secondes.
 * Compteur de l'écran, saisie, prix annoncé du découpage, générateur et découpage la lisent tous ici ; aucune autre.
 */
export const CARACTERES_DITS_MAX_TABLEAU = 1520;
