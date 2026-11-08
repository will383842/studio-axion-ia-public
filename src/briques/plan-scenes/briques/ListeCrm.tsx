import type { ParametresPiece } from "../catalogue";
import { TOILES } from "../toiles";
import { avecOpacite, progression } from "../../jetons-motion";
import { BOITE_INCLUSE, apparition, palette, RACINE, round, type ProprietesBrique } from "./communs";

type P = ParametresPiece<"liste-crm">;

const LIBELLES = { nouveau: "Nouveau", "en-cours": "En cours", gagne: "Signé", perdu: "Perdu" } as const;

/** Liste de contacts : les lignes arrivent une à une, la ligne choisie se surligne ensuite. */
export function ListeCrm({ image, fond, accent, parametres: p }: ProprietesBrique<P>) {
  const c = palette(fond, accent);
  const { largeur } = TOILES["liste-crm"];
  const surligne = progression(image, 10 + p.lignes.length * 6, 14);
  const pastille = (s: P["lignes"][number]["statut"]) =>
    s === "gagne" ? { background: c.accent, color: c.fond } : s === "nouveau" ? { boxShadow: `inset 0 0 0 2px ${c.accent}`, color: c.accent } : s === "en-cours" ? { background: c.panneauRelief, color: c.texte } : { color: c.texteDoux, boxShadow: `inset 0 0 0 2px ${c.filet}` };
  return (
    <div style={RACINE}>
      <div style={{ ...apparition(image, 0), position: "absolute", left: 40, top: 20, fontSize: 38, fontWeight: 800, color: c.texte }}>{p.titre}</div>
      {p.lignes.map((l, i) => (
        <div key={l.nom + i} style={{ ...apparition(image, 8 + i * 6, 12, 30), position: "absolute", left: 40, top: 110 + i * 100, width: largeur - 80, height: 86, borderRadius: 20, ...BOITE_INCLUSE, padding: "0 28px", display: "flex", alignItems: "center", gap: 24, background: i === p.surligner ? avecOpacite(c.accent, round(0.12 * surligne)) : c.panneau, boxShadow: `0 0 0 2px ${i === p.surligner && surligne > 0 ? c.accent : c.filet}` }}>
          <span style={{ width: 50, height: 50, borderRadius: 25, background: c.panneauRelief, color: c.texte, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700 }}>{l.nom.replace(/^(M\.|Mme)\s+/, "").slice(0, 1)}</span>
          <span style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 30, fontWeight: 700, color: c.texte }}>{l.nom}</span>
            <span style={{ fontSize: 22, fontWeight: 500, color: c.texteDoux }}>{l.detail}</span>
          </span>
          <span style={{ ...pastille(l.statut), fontSize: 22, fontWeight: 700, padding: "8px 18px", borderRadius: 999 }}>{LIBELLES[l.statut]}</span>
        </div>
      ))}
    </div>
  );
}
