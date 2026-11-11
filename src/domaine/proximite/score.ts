/** Score de proximité entre deux empreintes (PUR) : symétrique, 1 si identiques, 0 sans axe commun. */
import type { Empreinte } from "./empreinte";

function axesDe(e: Empreinte): Set<string> {
  const s = new Set(e.axes);
  if (e.signature) s.add(`sig:${e.signature}`);
  return s;
}

/** Jaccard des axes (racines du sujet + signature de l'usine). Une empreinte sans axe ne ressemble à rien. */
export function scoreProximite(a: Empreinte, b: Empreinte): number {
  const x = axesDe(a);
  const y = axesDe(b);
  if (!x.size || !y.size) return 0;
  let commun = 0;
  for (const m of x) if (y.has(m)) commun++;
  return commun / (x.size + y.size - commun);
}

export interface Voisine {
  id: string;
  empreinte: Empreinte;
}

/** Publications voisines au seuil donné (score > 0 et >= seuil), les plus proches d'abord. */
export function voisines(cible: Empreinte, autres: readonly Voisine[], seuil = 0.5): (Voisine & { score: number })[] {
  return autres
    .map((v) => ({ ...v, score: scoreProximite(cible, v.empreinte) }))
    .filter((v) => v.score > 0 && v.score >= seuil)
    .sort((p, q) => q.score - p.score);
}
