import React from "react";
/**
 * K12 · BandeauChiffres : 2 à 4 chiffres qui claquent un par un sur leur mot (le chiffre simple compte, « 80 % » de 0 à
 * 80 ; un chiffre composé comme « 24h/24 » claque tel quel), chacun avec sa légende, sur fond sombre — comme l'image 09
 * de la maquette validée. Le premier est orange, en lueur. Pixels de l'écran de référence 1080 × 1920.
 */
import { COULEURS_DUO, TAILLES_DUO } from "../../../src/briques/habillage/charte-duo";
import { famille, graisse, teinte } from "../cas-concret/plans/commun";
import { Lignes } from "./CarteBenefice";
import { MARGE_IV, planBandeau, type ChiffreBandeau } from "./plan-objets";

export function BandeauChiffres({ chiffres, t, etiquette }: { chiffres: ChiffreBandeau[]; t: number; etiquette?: string }) {
  const b = planBandeau(chiffres, t);
  return (
    <>
      {etiquette ? (
        <div style={{ position: "absolute", left: 0, top: 0.15 * 1920, width: 1080, textAlign: "center", fontFamily: famille("inter-gras"), fontWeight: graisse("inter-gras"), fontSize: TAILLES_DUO.etiquette * 1920, letterSpacing: "0.32em", textTransform: "uppercase", color: COULEURS_DUO.orangeVif }}>
          {etiquette}
        </div>
      ) : null}
      {b.rangees.map((r, i) => {
        if (r.claque.opacite <= 0) return null;
        const couleur = r.orange ? COULEURS_DUO.orangeVif : COULEURS_DUO.blanc;
        return (
          <div key={i} style={{ position: "absolute", left: MARGE_IV, top: r.y, width: 1080 - 2 * MARGE_IV, height: r.hauteur, display: "flex", alignItems: "center", gap: 40 }}>
            <div style={{ width: b.colChiffre, display: "flex", justifyContent: "center", flex: "none" }}>
              <div
                style={{
                  fontFamily: famille("anton"),
                  fontWeight: graisse("anton"),
                  fontSize: r.chiffre.taille,
                  lineHeight: 1,
                  color: couleur,
                  whiteSpace: "nowrap",
                  fontVariantNumeric: "tabular-nums",
                  opacity: r.claque.opacite,
                  transform: `scale(${r.claque.echelle})`,
                  textShadow: r.orange ? `0 0 ${40 + 60 * r.claque.eclair}px ${teinte(COULEURS_DUO.orangeVif, 0.75)}` : r.claque.eclair > 0 ? `0 0 ${50 * r.claque.eclair}px ${teinte(COULEURS_DUO.orangeVif, 0.8)}` : undefined,
                }}
              >
                {r.texte}
              </div>
            </div>
            {r.legende ? (
              <div style={{ opacity: r.legendeEntree, transform: `translateX(${(1 - r.legendeEntree) * 30}px)` }}>
                <Lignes texte={r.legende} couleur={COULEURS_DUO.ivoire} police="inter-gras" />
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
