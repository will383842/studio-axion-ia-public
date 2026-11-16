/**
 * Zoom gratuit (fiche C8-Z03) : garde-fous purs. Aucun réglage lu, aucun effet de bord, déterministe.
 * Le Studio calcule les fenêtres ; le rendu ne fait que les appliquer (D2-15).
 */
import type { Exclusion, FenetreZoom, OptionsZoom } from "./types";

export const FACTEUR_ABSOLU_MAX = 1.08;
export const DEBUT_INTERDIT_SEC = 0.8;
export const FIN_INTERDITE_SEC = 1;

type Intervalle = [number, number];

/** Zones libres = [0,8 ; durée - 1] moins les exclusions. */
function zonesLibres(exclusions: Exclusion[], dureeTotaleSec: number): Intervalle[] {
  let libres: Intervalle[] = [[DEBUT_INTERDIT_SEC, dureeTotaleSec - FIN_INTERDITE_SEC]];
  for (const ex of exclusions) {
    const suivantes: Intervalle[] = [];
    for (const [a, b] of libres) {
      if (ex.finSec <= a || ex.debutSec >= b) {
        suivantes.push([a, b]);
        continue;
      }
      if (ex.debutSec > a) suivantes.push([a, ex.debutSec]);
      if (ex.finSec < b) suivantes.push([ex.finSec, b]);
    }
    libres = suivantes;
  }
  return libres.filter(([a, b]) => b > a);
}

export function fenetresPermises(
  demandes: FenetreZoom[],
  exclusions: Exclusion[],
  dureeTotaleSec: number,
  options: OptionsZoom,
): FenetreZoom[] {
  if (demandes.length === 0) return [];
  const plafond = Math.min(options.facteurMax, FACTEUR_ABSOLU_MAX);
  const libres = zonesLibres(exclusions, dureeTotaleSec);

  const triees = [...demandes].sort(
    (x, y) => x.debutSec - y.debutSec || x.finSec - y.finSec || x.facteur - y.facteur || x.type.localeCompare(y.type),
  );

  const morceaux: FenetreZoom[] = [];
  for (const d of triees) {
    const facteur = Math.max(1, Math.min(d.facteur, plafond));
    for (const [a, b] of libres) {
      const debutSec = Math.max(d.debutSec, a);
      let finSec = Math.min(d.finSec, b);
      if (finSec - debutSec <= 0) continue;
      finSec = Math.min(finSec, debutSec + options.dureeMaxSec);
      if (finSec - debutSec < options.dureeMinSec) continue;
      morceaux.push({ debutSec, finSec, facteur, type: d.type });
    }
  }

  const gardees: FenetreZoom[] = [];
  for (const m of morceaux) {
    const derniere = gardees[gardees.length - 1];
    if (derniere && m.debutSec < derniere.finSec + options.ecartMinSec) continue;
    const dansLaMinute = gardees.filter((g) => g.debutSec > m.debutSec - 60).length;
    if (dansLaMinute >= options.parMinuteMax) continue;
    gardees.push(m);
  }
  return gardees;
}
