/**
 * Types des gabarits de parcours (T-EXT-22) : un gabarit dit ce que l'écran peut faire, temps par temps. Il ne calcule
 * PAS la caméra (zoom, curseur, surbrillance : T-EXT-38) ; il ne fixe que ce qui doit rester lisible. Pur, rien ne l'appelle.
 */
import type { CasTutoriel, IdGabarit } from "../chef-de-projet";
import type { TempsPhrase } from "../scenariste";

export type Temps = TempsPhrase;

export type Montre = "avant-dessine" | "avant-maquette" | "maquette" | "vue-ensemble" | "conversation" | "flux" | "schema-flux";

export type GesteParcours = "clic" | "defilement" | "zoom" | "saisie" | "survol" | "apparition";

export interface SegmentGabarit {
  temps: Temps;
  /** Par ordre de préférence. */
  montre: readonly Montre[];
  /** Gestes permis, par ordre de préférence. */
  gestes: readonly GesteParcours[];
}

export interface Gabarit {
  id: IdGabarit;
  nom: string;
  cas: readonly CasTutoriel[];
  sequence: readonly SegmentGabarit[];
  /** 3 moments « ça change tout » au plus (audit § 2 ter). */
  momentsMax: 3;
  /** Jamais d'image fixe au-delà de `fixeMaxMs` (audit § 2 bis). */
  rythme: { readonly phraseMinMs: 1200; readonly fixeMaxMs: 1500 };
  /** Largeur minimale (en % de l'image) d'une zone une fois zoomée. */
  lisibilite: { readonly largeurZoomeeMinPct: 25 };
}

/** Fige un gabarit en profondeur. */
export function figerGabarit(g: Gabarit): Gabarit {
  for (const s of g.sequence) {
    Object.freeze(s.montre);
    Object.freeze(s.gestes);
    Object.freeze(s);
  }
  Object.freeze(g.sequence);
  Object.freeze(g.cas);
  Object.freeze(g.rythme);
  Object.freeze(g.lisibilite);
  return Object.freeze(g);
}
