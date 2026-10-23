import React from "react";
/**
 * K05 · Embranchement : au nœud de décision, le fil se sépare en Y (ou en 3) — les flèches des branches sont tracées par
 * la toile depuis l'heure de séparation — ; ici, le point de jonction et les pastilles de part (« 80 % » orange,
 * « 20 % » noir) qui comptent de 0 à leur valeur. Branche active allumée, l'autre atténuée ; de retour au nœud de
 * décision, la branche parcourue s'éteint et la suivante s'allume. Pixels de toile.
 */
import type { BoiteNoeud } from "../../../src/briques/schema-motion";
import { COULEURS_DUO } from "../../../src/briques/habillage/charte-duo";
import { famille, graisse, planSurgir, teinte } from "../cas-concret/plans/commun";
import { couleurTrait, OPACITE_VU, PASTILLE_PART, type PartEmbranchement } from "./plan";

export function Embranchement({ decision, parts }: { decision: BoiteNoeud; parts: PartEmbranchement[] }) {
  if (parts.length === 0) return null;
  const P = PASTILLE_PART;
  const jonction = planSurgir(parts[0].entree);
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: decision.x + decision.largeur / 2 - 16,
          top: decision.y + decision.hauteur - 16,
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: COULEURS_DUO.orangeVif,
          opacity: jonction.opacite,
          transform: `scale(${jonction.echelle})`,
        }}
      />
      {parts.map((p) => {
        const s = planSurgir(p.entree);
        const fond = p.allumee ? couleurTrait(p.couleur) : COULEURS_DUO.grisClair;
        return (
          <div
            key={p.fleche}
            style={{
              position: "absolute",
              left: p.x,
              top: p.y,
              transform: `translate(-50%, -50%) scale(${s.echelle})`,
              opacity: s.opacite * (p.allumee ? 1 : OPACITE_VU + 0.25),
              background: fond,
              color: COULEURS_DUO.blanc,
              borderRadius: 999,
              padding: `${P.padHaut}px ${P.padX}px ${P.padBas}px`,
              fontFamily: famille("anton"),
              fontWeight: graisse("anton"),
              fontSize: P.taille,
              lineHeight: 1.15,
              whiteSpace: "nowrap",
              boxShadow: p.allumee ? `0 16px 36px ${teinte(fond, 0.45)}` : "none",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {p.valeur} %
          </div>
        );
      })}
    </>
  );
}
