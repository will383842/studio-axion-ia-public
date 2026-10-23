import React from "react";
/**
 * Témoin des sous-titres dans les GALERIES (jamais dans la vidéo : les vrais sous-titres viennent de la voix) : une
 * phrase courte dans la bande des sous-titres, au style de la maquette validée (Inter Bold, mot orange, trait orange
 * dessous). Il montre l'image entière telle qu'elle sera lue. Pixels de l'écran de référence 1080 × 1920.
 */
import type { Fond } from "../../../src/briques/ecrans-motion";
import { COULEURS_DUO } from "../../../src/briques/habillage/charte-duo";
import { couleursDuFond, famille, graisse } from "../cas-concret/plans/commun";
import { planTemoinSousTitres } from "./mise-en-page";

export function TemoinSousTitres({ texte, fond }: { texte: string; fond: Fond }) {
  const p = planTemoinSousTitres(texte);
  const c = couleursDuFond(fond);
  const accent = fond === "sombre" ? COULEURS_DUO.orangeVif : COULEURS_DUO.orange;
  return (
    <div style={{ position: "absolute", left: p.x, top: p.y, width: p.largeur, height: p.hauteur, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 26 }}>
      <div style={{ fontFamily: famille("inter-gras"), fontWeight: graisse("inter-gras"), fontSize: p.taille, lineHeight: 1.15, color: c.texte, textAlign: "center" }}>
        {p.mots.map((m, i) => (
          <span key={i} style={{ color: m.accent ? accent : undefined }}>
            {i ? " " : ""}
            {m.mot}
          </span>
        ))}
      </div>
      <div style={{ width: p.largeur * 0.72, height: 6, borderRadius: 3, background: accent, opacity: 0.85 }} />
    </div>
  );
}
