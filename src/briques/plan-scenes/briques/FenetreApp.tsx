import type { ReactNode } from "react";
import type { ParametresPiece } from "../catalogue";
import { TOILES } from "../toiles";
import { adoucir, avecOpacite, entre, progression } from "../../jetons-motion";
import { apparition, ombre, palette, RACINE, round, type ProprietesBrique } from "./communs";

type P = ParametresPiece<"fenetre-app">;

/** Fenêtre de logiciel qui s'ouvre en douceur ; `enfants` se dessinent dans la zone de contenu. */
export function FenetreApp({ image, fond, accent, parametres: p, enfants }: ProprietesBrique<P> & { enfants?: ReactNode }) {
  const c = palette(fond, accent);
  const t = progression(image, 0, 14, adoucir);
  const { largeur, hauteur } = TOILES["fenetre-app"];
  const contenu = Array.from({ length: p.contenu === "vide" ? 0 : p.contenu === "formulaire" ? 3 : 4 }, (_, i) => i);
  return (
    <div style={RACINE}>
      <div style={{ position: "absolute", left: 20, top: 20, width: largeur - 40, height: hauteur - 40, borderRadius: 28, background: c.panneau, boxShadow: `${ombre(fond)}, 0 0 0 2px ${c.filet}`, overflow: "hidden", opacity: t, transform: `scale(${round(entre(0.96, 1, t))})` }}>
        <div style={{ height: 76, display: "flex", alignItems: "center", gap: 14, padding: "0 28px", background: c.panneauRelief }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: 16, height: 16, borderRadius: 8, background: avecOpacite(c.texte, 0.18) }} />
          ))}
          <span style={{ marginLeft: 18, fontSize: 28, fontWeight: 700, color: c.texte }}>{p.titre}</span>
        </div>
        {p.onglets.length > 0 && (
          <div style={{ display: "flex", gap: 34, padding: "0 32px", height: 66, alignItems: "flex-end", borderBottom: `2px solid ${c.filet}` }}>
            {p.onglets.map((o, i) => (
              <span key={o + i} style={{ fontSize: 24, fontWeight: i === p.ongletActif ? 700 : 500, color: i === p.ongletActif ? c.texte : c.texteDoux, paddingBottom: 14, borderBottom: `4px solid ${i === p.ongletActif ? c.accent : "transparent"}` }}>
                {o}
              </span>
            ))}
          </div>
        )}
        <div style={{ position: "relative", padding: 32, display: "flex", flexDirection: "column", gap: 22 }}>
          {contenu.map((i) => (
            <div key={i} style={{ ...apparition(image, 10 + i * 4), display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={{ width: 120 + (i % 2) * 60, height: 14, borderRadius: 7, background: avecOpacite(c.texte, 0.16) }} />
              <span style={{ height: 52, borderRadius: 14, border: `2px solid ${c.filet}`, background: c.panneauRelief }} />
            </div>
          ))}
        </div>
      </div>
      {/* enfants hors du conteneur animé : la frappe et le curseur gardent leur propre minutage */}
      {enfants}
    </div>
  );
}
