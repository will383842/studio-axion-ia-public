/** Ligne de texte (Inter Bold), couleur secondaire du fond, qui monte doucement. */
import type { Fond, TextePose } from "../../../../src/briques/ecrans-motion";
import { couleursDuFond, famille, planLigne } from "../plans/commun";

export function Ligne({ pose, fond, t, debut }: { pose: TextePose; fond: Fond; t: number; debut: number }) {
  const l = planLigne(t, debut);
  return (
    <div style={{ position: "absolute", left: pose.boite.x, top: pose.boite.y, width: pose.boite.largeur, textAlign: "center", fontFamily: famille(pose.police), fontSize: pose.tailleRendue, lineHeight: pose.interligne, color: couleursDuFond(fond).secondaire, opacity: l.opacite, transform: `translateY(${l.decalageY}px)` }}>
      {pose.lignes.map((x, i) => (
        <div key={i}>{x}</div>
      ))}
    </div>
  );
}
