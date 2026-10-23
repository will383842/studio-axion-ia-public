import React from "react";
/**
 * K13 · RepèreChapitre : pastille « 2/3 » (ou « Étape 3/5 ») fixe en haut, sous la marque, avec un segment par chapitre.
 * À chaque changement, l'ancien numéro monte et sort, le nouveau monte de dessous, son segment se remplit d'orange.
 * Pixels de l'écran de référence 1080 × 1920.
 */
import type { Fond } from "../../../src/briques/ecrans-motion";
import { COULEURS_DUO } from "../../../src/briques/habillage/charte-duo";
import { couleursDuFond, doux, famille, graisse, teinte } from "../cas-concret/plans/commun";
import { HAUT_REPERE, planRepere, type ChangementRepere } from "./plan-objets";

export function RepereChapitre({ changements, total, t, fond, prefixe }: { changements: ChangementRepere[]; total: number; t: number; fond: Fond; prefixe?: string }) {
  const r = planRepere(changements, total, t, prefixe);
  if (!r) return null;
  const c = couleursDuFond(fond);
  const sombre = fond === "sombre";
  const hauteur = r.taille * 1.3;
  const segment = 34;
  const largeurSegments = total * segment + (total - 1) * 10;
  const largeur = r.largeur + 28 + largeurSegments + 34;
  const b = doux(r.bascule);
  return (
    <div
      style={{
        position: "absolute",
        left: (1080 - largeur) / 2,
        top: HAUT_REPERE * 1920,
        width: largeur,
        height: hauteur,
        borderRadius: hauteur / 2,
        background: sombre ? teinte(COULEURS_DUO.blanc, 0.1) : COULEURS_DUO.blanc,
        boxShadow: `0 10px 26px ${teinte(COULEURS_DUO.encre, sombre ? 0.4 : 0.08)}`,
        display: "flex",
        alignItems: "center",
        padding: "0 0 0 34px",
        boxSizing: "border-box",
        opacity: r.entree,
        transform: `translateY(${(1 - r.entree) * -30}px)`,
      }}
    >
      <div style={{ position: "relative", width: r.largeur - 68, height: hauteur, overflow: "hidden", flex: "none", fontFamily: famille("anton"), fontWeight: graisse("anton"), fontSize: r.taille, lineHeight: `${hauteur}px`, color: c.texte, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
        {r.ancien !== null && b < 1 ? <div style={{ position: "absolute", left: 0, top: 0, transform: `translateY(${-b * hauteur}px)`, opacity: 1 - b }}>{r.ancien}</div> : null}
        <div style={{ position: "absolute", left: 0, top: 0, transform: `translateY(${(r.ancien === null ? 0 : 1 - b) * hauteur}px)` }}>{r.texte}</div>
      </div>
      <div style={{ display: "flex", gap: 10, marginLeft: 28 }}>
        {r.segments.map((s, i) => (
          <div key={i} style={{ position: "relative", width: segment, height: 12, borderRadius: 6, background: sombre ? teinte(COULEURS_DUO.blanc, 0.25) : COULEURS_DUO.grisClair, overflow: "hidden" }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${s * 100}%`, background: COULEURS_DUO.orangeVif }} />
          </div>
        ))}
      </div>
    </div>
  );
}
