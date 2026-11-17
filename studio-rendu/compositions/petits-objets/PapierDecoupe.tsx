/**
 * PAPIER DÉCOUPÉ ET RUBAN : habillage Remotion seulement. Dessine `papierDecoupe` et `rubanAdhesif` (purs).
 * Aucun branchement : rien n'importe ce fichier (non inscrit, éteint).
 */
import { AbsoluteFill } from "remotion";
import { papierDecoupe, rubanAdhesif } from "../../../src/briques/motion/petits-objets/papier-decoupe";
import type { ZoneObjet } from "../../../src/briques/motion/petits-objets/contrat";

export function PapierDecoupe({ zone, graine, visage }: { zone: ZoneObjet; graine: number; visage?: ZoneObjet }) {
  const p = papierDecoupe({ graine, zone, visage });
  if (p === null) return null;
  const n = p.bord.length;
  const haut = p.bord.map((d, i) => `${(i / Math.max(1, n - 1)) * 100}% ${Math.max(0, d)}%`);
  const bas = p.bord.map((d, i) => `${(1 - i / Math.max(1, n - 1)) * 100}% ${100 + Math.min(0, d)}%`);
  const r = rubanAdhesif(zone);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.largeur}%`, height: `${zone.hauteur}%`, background: p.couleur, clipPath: `polygon(${[...haut, ...bas].join(", ")})` }} />
      <div style={{ position: "absolute", left: `${r.boite.x}%`, top: `${r.boite.y}%`, width: `${r.boite.largeur}%`, height: `${r.boite.hauteur}%`, background: r.couleur }} />
    </AbsoluteFill>
  );
}
