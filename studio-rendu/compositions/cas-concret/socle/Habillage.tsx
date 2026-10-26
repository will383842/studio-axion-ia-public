/**
 * Enveloppe d'habillage d'un écran (entrée, sortie, caméra, transition, mot par mot du `jeu`). Sans `jeu` qui en demande,
 * aucune enveloppe : l'arbre rendu est celui de la v4. Le calcul est dans `plans/habillage.ts` (pur).
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { imagesEcran, type ProprietesEcran } from "../../../../src/briques/ecrans-motion";
import { couleursDuFond } from "../plans/commun";
import { estNeutre, habille, planHabillage, styleMotParMot } from "../plans/habillage";
import { StyleMotParMotContexte } from "./MotParMot";

export function Habillage({ p, children }: { p: ProprietesEcran; children: React.ReactNode }) {
  const style = styleMotParMot(p.jeu);
  const image = useCurrentFrame();
  const contenu = style ? <StyleMotParMotContexte.Provider value={style}>{children}</StyleMotParMotContexte.Provider> : children;
  if (!habille(p)) return <>{contenu}</>;
  const h = planHabillage(p, image / p.fps, imagesEcran(p) / p.fps);
  if (estNeutre(h)) return <>{contenu}</>;
  const k = p.largeur / 1080;
  const cx = p.zone.x + p.zone.largeur / 2;
  const cy = p.zone.y + p.zone.hauteur / 2;
  const r = h.rognage;
  // Le fond de l'écran derrière le contenu qui glisse ou se rogne (jamais une bande noire).
  const fondEcran = p.jeu?.fondAlterne === "sombre" || p.jeu?.fondAlterne === "ivoire" ? p.jeu.fondAlterne : p.fond;
  const bord = couleursDuFond(fondEcran).degrade.bord;
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: bord }}>
      <AbsoluteFill style={h.camera ? { transform: `translateX(${h.camera.dx * k}px) scale(${h.camera.echelle})`, transformOrigin: `${cx}px ${cy}px` } : undefined}>
        <AbsoluteFill
          style={{
            opacity: h.opacite,
            transform: h.dx || h.echelle !== 1 ? `translateX(${h.dx * k}px) scale(${h.echelle})` : undefined,
            filter: h.flou ? `blur(${h.flou * k}px)` : undefined,
            clipPath: r ? `inset(${r.haut}% ${r.droite}% ${r.bas}% ${r.gauche}%)` : undefined,
          }}
        >
          {contenu}
        </AbsoluteFill>
      </AbsoluteFill>
      {h.voile ? <AbsoluteFill style={{ background: h.voile.couleur, opacity: h.voile.opacite, transform: `translateX(${h.voile.dxPct}%)` }} /> : null}
    </AbsoluteFill>
  );
}
