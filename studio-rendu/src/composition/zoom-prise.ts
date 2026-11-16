/**
 * Zoom de prise (fiche C8-Z08a) : fenêtres calculées par le Studio → filtre FFmpeg scale (eval=frame) + crop centré.
 * Pur, déterministe, non branché. Liste vide = chaîne vide (l'appelant n'ajoute rien).
 * Aucun import externe (le dossier est copié tel quel par le Dockerfile).
 */

export type FenetreZoomRendu = { debutSec: number; finSec: number; facteur: number };

const FACTEUR_MAX = 1.08;

function nombre(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

export function filtreZoomPrise(fenetres: FenetreZoomRendu[], largeur: number, hauteur: number): string {
  if (fenetres.length === 0) return "";
  const triees = [...fenetres].sort((a, b) => a.debutSec - b.debutSec || a.finSec - b.finSec);
  for (let i = 0; i < triees.length; i++) {
    const f = triees[i];
    if (![f.debutSec, f.finSec, f.facteur].every(Number.isFinite) || f.debutSec < 0 || f.finSec <= f.debutSec) {
      throw new Error(`Fenêtre de zoom invalide (${f.debutSec} → ${f.finSec}).`);
    }
    if (i > 0 && f.debutSec < triees[i - 1].finSec) {
      throw new Error(`Fenêtres de zoom qui se chevauchent (${triees[i - 1].finSec} > ${f.debutSec}).`);
    }
  }
  // FFmpeg n'évalue pas `t` dans les largeur/hauteur de `crop` (fixées à l'init) : on agrandit image par image
  // (`scale … eval=frame`) puis on recadre au centre à la taille d'origine. Dans `crop`, `iw`/`ih` sont aussi figés
  // à l'init : x/y sont donc recalculés avec la même expression de facteur (sinon zoom ancré en haut à gauche).
  const zoom = triees.reduceRight((reste, f) => {
    const facteur = Math.max(1, Math.min(f.facteur, FACTEUR_MAX));
    return `if(between(t,${nombre(f.debutSec)},${nombre(f.finSec)}),${nombre(facteur)},${reste})`;
  }, "1");
  return (
    `scale=w='trunc(iw*${zoom}/2)*2':h='trunc(ih*${zoom}/2)*2':eval=frame,` +
    `crop=${largeur}:${hauteur}:'(trunc(${largeur}*${zoom}/2)*2-${largeur})/2':'(trunc(${hauteur}*${zoom}/2)*2-${hauteur})/2'`
  );
}
