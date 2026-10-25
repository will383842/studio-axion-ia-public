/**
 * Traits fins des parcours qui ne doivent jamais tomber sur une couture (tracés PURS, testés sans navigateur) : la règle graduée du
 * « grand mot » (PC) et les tirets de la voie « avec nous » (PB).
 */
import { LARGEUR_PAGE, MARGE_SURE } from "../constantes-continu";

/**
 * Graduations de la règle de PC : un repère tous les 40 px, décalé de 20 px par rapport aux coutures (la maquette partait de x = 80 et
 * posait un repère PILE sur les coutures 1080 et 2160) ; un repère long tous les 200 px. Jamais à moins de 20 px d'une couture.
 */
export function graduationsPC(pages: number): { x: number; long: boolean }[] {
  const fin = pages * LARGEUR_PAGE - MARGE_SURE;
  const reperes: { x: number; long: boolean }[] = [];
  for (let x = MARGE_SURE + 20; x <= fin; x += 40) reperes.push({ x, long: (x - MARGE_SURE - 20) % 200 === 0 });
  return reperes;
}

const DEBUT_TIRETS_PB = 1560;
const FIN_TIRETS_PB = 3040;
/** Période du motif de tirets « 3 18 » (trait de 3 px, vide de 18 px). */
export const PERIODE_TIRETS_PB = 21;
/** Écart entre la fin d'un segment et la couture (le vide du motif y passe). */
const ECART_COUTURE = 6;

/**
 * Tirets de PB en segments qui s'arrêtent AVANT chaque couture interne et reprennent APRÈS elle, avec la phase du motif d'origine
 * (`decalage` = position dans la période au début du segment) : le motif reste continu, aucun tiret ne coupe une couture.
 */
export function segmentsTiretsPB(): { x1: number; x2: number; decalage: number }[] {
  const coutures = [LARGEUR_PAGE * 2];
  const bornes = [DEBUT_TIRETS_PB, ...coutures.flatMap((c) => [c - ECART_COUTURE, c + ECART_COUTURE]), FIN_TIRETS_PB];
  const segments: { x1: number; x2: number; decalage: number }[] = [];
  for (let i = 0; i < bornes.length; i += 2) segments.push({ x1: bornes[i], x2: bornes[i + 1], decalage: (bornes[i] - DEBUT_TIRETS_PB) % PERIODE_TIRETS_PB });
  return segments;
}
