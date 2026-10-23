/** Objet `e-mail` (R5) : enveloppe dont le rabat s'ouvre, message avec son objet, coche ; dessine le plan. */
import { planEMail } from "../plans/EMail";
import type { ProprietesObjet } from "../plans/commun";
import { mvt, styleMouvement, valeurDe, type AvecAnim } from "../plans/anim-objets";
import { CocheTracee } from "./CocheTracee";

const posee = (b: { x: number; y: number; largeur: number; hauteur: number }) => ({ position: "absolute" as const, left: b.x, top: b.y, width: b.largeur, height: b.hauteur });

export function EMail(p: ProprietesObjet & AvecAnim) {
  const c = planEMail(p);
  const { rabat, message, coche, corps, pochette } = c;
  const trace = valeurDe(coche, "trace");
  return (
    <div style={{ position: "relative", width: c.boite.largeur, height: c.boite.hauteur, fontFamily: c.police.famille, fontWeight: c.police.graisse, color: c.police.couleur }}>
      <div style={{ ...posee(corps.boite), borderRadius: corps.rayon, background: corps.couleur, boxShadow: `0 ${c.boite.hauteur * 0.06}px ${c.boite.hauteur * 0.13}px ${c.ombre}`, ...styleMouvement(mvt(corps)) }} />
      {message.visible ? (
        <div style={{ ...posee(message.boite), borderRadius: message.rayon, background: message.couleur, boxShadow: `0 ${message.boite.hauteur * 0.04}px ${message.boite.hauteur * 0.1}px ${c.ombre}`, ...styleMouvement(mvt(message)) }}>
          {message.objet ? <div style={{ position: "absolute", left: message.objet.boite.x - message.boite.x, top: message.objet.boite.y - message.boite.y, width: message.objet.boite.largeur, height: message.objet.boite.hauteur, display: "flex", alignItems: "center", fontSize: message.objet.taille, lineHeight: 1.2 }}><div>{message.objet.lignes.map((l, k) => <div key={k} style={{ whiteSpace: "nowrap" }}>{l}</div>)}</div></div> : null}
          {message.lignes.map((l, i) => (
            <div key={i} style={{ position: "absolute", left: l.x - message.boite.x, top: l.y - message.boite.y, width: l.largeur, height: l.hauteur, borderRadius: l.hauteur / 2, background: l.couleur }} />
          ))}
        </div>
      ) : null}
      <div style={{ ...posee(pochette.boite), borderRadius: `0 0 ${pochette.rayon}px ${pochette.rayon}px`, background: pochette.couleur, ...styleMouvement(mvt(pochette)) }} />
      <div style={{ ...posee(rabat.boite), background: rabat.couleur, clipPath: "polygon(0 0, 100% 0, 50% 100%)", transformOrigin: "50% 0", ...styleMouvement(mvt(rabat), { transform: `scaleY(${rabat.echelleY})` }) }} />
      <div style={{ ...posee(coche.boite), borderRadius: "50%", background: coche.couleur, opacity: coche.opacite, transform: `scale(${coche.echelle}) rotate(${coche.rotation}deg)` }}>
        {trace !== undefined ? (
          <CocheTracee trace={trace} couleur={coche.trait} epaisseur={coche.boite.largeur * 0.1} diametre={coche.boite.largeur} />
        ) : (
          <div style={{ position: "absolute", left: "32%", top: "20%", width: "26%", height: "48%", borderStyle: "solid", borderColor: coche.trait, borderWidth: `0 ${coche.boite.largeur * 0.1}px ${coche.boite.largeur * 0.1}px 0`, transform: "rotate(45deg)" }} />
        )}
      </div>
    </div>
  );
}
