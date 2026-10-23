/** Puce : pastille blanche, rond vert à coche, texte court. */
import { planPuce } from "../plans/commun";

export function Puce({ texte, taille }: { texte: string; taille: number }) {
  const p = planPuce(texte.replace(/\*/g, ""), taille);
  const rond = taille * 1.27;
  return (
    <div style={{ position: "relative", display: "inline-block", padding: `${taille * 0.41}px ${taille * 0.77}px ${taille * 0.41}px ${taille * 2}px`, borderRadius: taille * 1.4, background: p.fond, color: p.texteCouleur, fontFamily: p.famille, fontSize: p.taille, whiteSpace: "nowrap" }}>
      <div style={{ position: "absolute", left: taille * 0.36, top: "50%", width: rond, height: rond, marginTop: -rond / 2, borderRadius: "50%", background: p.coche }} />
      <div style={{ position: "absolute", left: taille * 0.82, top: "50%", width: taille * 0.32, height: taille * 0.59, marginTop: -taille * 0.43, borderStyle: "solid", borderColor: p.cocheTrait, borderWidth: `0 ${taille * 0.14}px ${taille * 0.14}px 0`, transform: "rotate(45deg)" }} />
      {p.texte}
    </div>
  );
}
