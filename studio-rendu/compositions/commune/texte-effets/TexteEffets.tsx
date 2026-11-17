/** C11-T8b-a : monté nulle part ; mème, légende native, planche, inscription = C11-T8b-b (chef). Traduit en CSS les styles purs de `effets.ts` (9 effets validés). */
import React from "react";
import { FAMILLE_CSS, PALETTE } from "../../../../src/briques/charte/axion-2026";
import {
  appliquerEffet,
  EFFETS_TEXTE,
  type EffetTexte,
  type StyleContour,
  type StyleDegrade,
  type StyleIntonation,
  type StyleInterlettrage,
  type StyleOpacite,
  type StyleRetrogradation,
} from "../../../../src/briques/motion/texte-effets/effets";
import { chargerPolicesMotion } from "../motion/polices";

export type ParametresTexteEffets = {
  texte: string;
  effet: EffetTexte;
  /** Image courante, reçue en propriété (pas de lecture du temps Remotion). */
  image: number;
  ips: number;
  options?: Record<string, unknown>;
  /** Mot de remplacement, obligatoire pour « retrogradation ». */
  motNouveau?: string;
  taillePx?: number;
  couleur?: string;
};

export const TexteEffets: React.FC<ParametresTexteEffets> = ({ texte, effet, image, ips, options, motNouveau, taillePx = 64, couleur = PALETTE.noir }) => {
  if (!(EFFETS_TEXTE as readonly string[]).includes(effet)) throw new Error(`TexteEffets : effet inconnu « ${String(effet)} »`);
  if (effet === "retrogradation" && !motNouveau) throw new Error("TexteEffets : « retrogradation » exige motNouveau");
  chargerPolicesMotion();
  const style = appliquerEffet(effet, image, ips, options ?? {});
  const base: React.CSSProperties = { fontFamily: FAMILLE_CSS, fontStyle: "normal", fontSize: taillePx, color: couleur, display: "inline-block" };
  let css: React.CSSProperties = base;
  let contenu = texte;
  if ("filtre" in style) css = { ...base, filter: style.filtre };
  else if ("balayage" in style) {
    // Pas de dégradé CSS (charte : « ni dégradé ») : deux calques, le second (arrivée) est rogné de gauche à droite.
    const d = style as StyleDegrade;
    const reste = Math.round((1 - d.balayage) * 10000) / 100;
    return (
      <span data-texte-effet={effet} style={{ ...base, position: "relative", color: d.depart }}>
        {texte}
        <span aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, color: d.arrivee, clipPath: `inset(0 ${reste}% 0 0)`, whiteSpace: "pre" }}>
          {texte}
        </span>
      </span>
    );
  } else if ("decoration" in style) {
    const r = style as StyleRetrogradation;
    css = { ...base, textDecoration: r.decoration };
    contenu = r.mot === "ancien" ? texte : (motNouveau as string);
  } else if ("opacite" in style) css = { ...base, opacity: (style as StyleOpacite).opacite };
  else if ("interlettrage" in style) css = { ...base, letterSpacing: (style as StyleInterlettrage).interlettrage };
  else if ("graisse" in style) {
    const s = style as StyleIntonation;
    css = { ...base, fontWeight: s.graisse, fontFamily: s.famille, fontStyle: "normal" };
  } else if ("contourPx" in style) {
    const c = style as StyleContour;
    css = { ...base, WebkitTextStroke: `${c.contourPx}px ${c.couleurContour}` };
  }
  return (
    <span data-texte-effet={effet} style={css}>
      {contenu}
    </span>
  );
};
