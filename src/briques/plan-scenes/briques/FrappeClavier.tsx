import type { ParametresPiece } from "../catalogue";
import { TOILES } from "../toiles";
import { apparition, ombre, palette, RACINE, type ProprietesBrique } from "./communs";

type P = ParametresPiece<"frappe-clavier">;

/** Nombre de caractères tapés à cette image (départ après l'apparition du champ). */
export function caracteresTapes(p: P, image: number, fps: number): number {
  return Math.max(0, Math.min(p.texte.length, Math.floor(((image - 10) * p.vitesse) / fps)));
}

/** Champ de saisie qui se remplit lettre par lettre, curseur texte qui clignote. */
export function FrappeClavier({ image, fps, fond, accent, parametres: p }: ProprietesBrique<P>) {
  const c = palette(fond, accent);
  const { largeur } = TOILES["frappe-clavier"];
  const n = caracteresTapes(p, image, fps);
  const visible = n < p.texte.length || Math.floor(image / 12) % 2 === 0;
  return (
    <div style={{ ...RACINE, ...apparition(image, 0, 10) }}>
      <div style={{ position: "absolute", left: 40, top: 30, fontSize: 26, fontWeight: 600, color: c.texteDoux }}>{p.champ}</div>
      <div style={{ position: "absolute", left: 40, top: 80, width: largeur - 80, height: 120, borderRadius: 22, background: c.panneau, boxShadow: `${ombre(fond)}, 0 0 0 3px ${c.accent}`, display: "flex", alignItems: "center", padding: "0 34px", boxSizing: "border-box" }}>
        <span style={{ fontSize: 44, fontWeight: 600, color: c.texte, whiteSpace: "pre" }}>{p.texte.slice(0, n)}</span>
        <span style={{ width: 4, height: 54, marginLeft: 4, background: c.accent, opacity: visible ? 1 : 0 }} />
      </div>
    </div>
  );
}
