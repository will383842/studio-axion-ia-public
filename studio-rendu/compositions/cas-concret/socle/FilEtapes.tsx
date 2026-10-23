/** Fil d'avancement des étapes, au bas de la zone utile. */
import type { BoitePx } from "../../../../src/briques/ecrans-motion";
import { planFilEtapes } from "../plans/commun";

export function FilEtapes({ boite, numero, nombreEtapes, avance }: { boite: BoitePx; numero: number; nombreEtapes: number; avance: number }) {
  const f = planFilEtapes(numero, nombreEtapes, avance);
  return <div style={{ position: "absolute", left: boite.x, top: boite.y, height: boite.hauteur, width: boite.largeur * f.fraction, borderRadius: boite.hauteur / 2, background: f.couleur }} />;
}
