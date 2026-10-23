/** Objet `dossier-classe` : la feuille descend dans le dossier orange, puis la coche verte surgit. */
import type { ProprietesObjet } from "../plans/commun";
import { planDossierClasse } from "../plans/DossierClasse";
import type { ContexteObjet } from "../plans/Objet";
import { mvt, styleMouvement, valeurDe } from "../plans/anim-objets";
import { CocheTracee } from "./CocheTracee";

const posee = (b: { x: number; y: number; largeur: number; hauteur: number }) => ({ position: "absolute" as const, left: b.x, top: b.y, width: b.largeur, height: b.hauteur });

export function DossierClasse(p: ProprietesObjet) {
  const d = planDossierClasse(p as ContexteObjet);
  const f = d.feuille;
  const trace = valeurDe(d.coche, "trace");
  return (
    <div style={{ ...posee(d.boite), overflow: "hidden" }}>
      <div style={{ ...posee(d.dos.boite), borderRadius: d.dos.rayon, background: d.dos.couleur, ...styleMouvement(mvt(d.dos)) }} />
      <div style={{ ...posee(d.onglet.boite), borderRadius: `${d.onglet.rayon}px ${d.onglet.rayon}px 0 0`, background: d.onglet.couleur, ...styleMouvement(mvt(d.onglet)) }} />
      <div style={{ ...posee(f.boite), boxSizing: "border-box", padding: `${f.marge.y}px ${f.marge.x}px`, borderRadius: f.rayon, background: f.fond, ...styleMouvement(mvt(f), { transform: `translateY(${f.decalageY}px)` }) }}>
        {f.lignes.map((l, i) => (
          <div key={i} style={{ width: `${l.largeurPct}%`, height: l.hauteur, marginBottom: l.ecart, borderRadius: l.rayon, background: l.couleur }} />
        ))}
      </div>
      <div style={{ ...posee(d.avant.boite), borderRadius: d.avant.rayon, background: `linear-gradient(180deg, ${d.avant.haut}, ${d.avant.bas})`, boxShadow: `0 ${-10 * d.k}px ${40 * d.k}px ${d.avant.ombre}`, ...styleMouvement(mvt(d.avant)) }} />
      <div style={{ ...posee(d.coche.boite), borderRadius: "50%", background: d.coche.fond, opacity: d.coche.opacite, transform: `scale(${d.coche.echelle}) rotate(${d.coche.rotation}deg)` }}>
        {trace !== undefined ? (
          <CocheTracee trace={trace} couleur={d.coche.trait} epaisseur={d.coche.epaisseur} diametre={d.coche.boite.largeur} />
        ) : (
          <div style={{ position: "absolute", left: d.coche.boite.largeur * 0.36, top: d.coche.boite.hauteur * 0.17, width: d.coche.boite.largeur * 0.28, height: d.coche.boite.hauteur * 0.51, boxSizing: "border-box", borderStyle: "solid", borderColor: d.coche.trait, borderWidth: `0 ${d.coche.epaisseur}px ${d.coche.epaisseur}px 0`, transform: "rotate(45deg)" }} />
        )}
      </div>
    </div>
  );
}
