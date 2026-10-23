/**
 * Polices manuscrites des trois styles du tableau (16/10/2026, maquettes validées PR #280) : Permanent Marker (licence
 * Apache 2.0), Kalam Bold et Caveat Brush (SIL OFL 1.1), chargées EN LOCAL. Le rendu attend leur chargement (jamais une
 * image avec une police de secours). Rien n'est chargé au niveau du module.
 */
import { continueRender, delayRender } from "remotion";
import caveatBrush from "./polices/CaveatBrush-Regular.ttf";
import kalamBold from "./polices/Kalam-Bold.ttf";
import permanentMarker from "./polices/PermanentMarker-Regular.ttf";

export const FAMILLES_POLICES_TABLEAU = { marker: "Axion Permanent Marker", kalam: "Axion Kalam Bold", caveat: "Axion Caveat Brush" } as const;

let chargementTableau: Promise<void> | null = null;

/** Charge les trois polices manuscrites (une fois) ; la promesse se résout quand elles sont prêtes. */
export function chargerPolicesTableau(): Promise<void> {
  if (chargementTableau) return chargementTableau;
  if (typeof document === "undefined") return Promise.resolve();
  const attente = delayRender("Polices manuscrites du tableau");
  const sources: [string, string, FontFaceDescriptors?][] = [
    [FAMILLES_POLICES_TABLEAU.marker, permanentMarker],
    [FAMILLES_POLICES_TABLEAU.kalam, kalamBold, { weight: "700" }],
    [FAMILLES_POLICES_TABLEAU.caveat, caveatBrush],
  ];
  chargementTableau = Promise.all(sources.map(([famille, url, d]) => new FontFace(famille, `url(${url})`, d).load())).then((fs) => {
    for (const f of fs) document.fonts.add(f);
    continueRender(attente);
  });
  return chargementTableau;
}
