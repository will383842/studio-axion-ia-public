/**
 * Écran de fin : un panneau ivoire MONTE depuis le bas et pousse toute l'image vers le haut (≈ 0,2 s, mesuré sur la
 * référence), puis se construit élément par élément : la marque grossit, les tuiles arrivent une à une, l'adresse,
 * puis le bouton d'appel à l'action.
 */
import React from "react";
import { COULEURS, POLICES, TEMPS } from "./charte";
import { Icone, styleBoite } from "./elements";
import { progression, rebond } from "./mouvement";

export const DUREE_POUSSEE_FIN = 0.2;

/** Progression de la poussée (0 = image en place, 1 = écran de fin en place). */
export const pousseeFin = (t: number, debut: number) => rebond(t, debut, DUREE_POUSSEE_FIN, 1.1);

export type FinProps = {
  t: number;
  debut: number;
  largeurImage: number;
  hauteurImage: number;
  marque: string;
  adresse: string;
  /** Mot-clé à commenter (appel à l'action). */
  motCle: string;
  tuiles: string[];
  /** Lot B : texte du bouton selon le réseau (« Le lien en commentaire », « Lien dans la bio »…). Absent : « Commentez « motCle » ». */
  appel?: string;
};

/** Durée de construction de la fin sur le visage (revue finale du 14/10 : « se construit en ≤ 1 s »). */
export const DUREE_CONSTRUCTION_FIN = 0.85;

/**
 * FIN SUR LE VISAGE (revue finale du 14/10, priorité 1 d) : plus d'écran ivoire fixe. Un panneau de la taille d'une carte
 * TOMBE en haut (la prise descend dessous, comme pour une carte : Will reste à l'écran), puis se construit en moins d'une
 * seconde — marque, tuiles une à une, adresse, bouton d'appel à l'action posé à cheval sur le bas du panneau. Ensuite
 * l'image reste VIVANTE : le bouton bat, une tuile s'allume à tour de rôle, une flèche montre le bouton.
 * `rect` : emprise du panneau (fractions), calculée par `cadrage.ts` (FIN_SUR_VISAGE).
 */
export function FinSurVisage(p: FinProps & { rect: { x0: number; x1: number; y0: number; y1: number } }) {
  if (p.t < p.debut) return null;
  const W = p.largeurImage;
  const H = p.hauteurImage;
  const x = p.rect.x0 * W;
  const y = p.rect.y0 * H;
  const l = (p.rect.x1 - p.rect.x0) * W;
  const h = (p.rect.y1 - p.rect.y0) * H;
  // Chute du panneau en 4 images avec petit rebond (comme une carte), puis construction élément par élément.
  const chute = rebond(p.t, p.debut, TEMPS.entreeCarte, 1.2);
  const t0 = p.debut + 0.1;
  const marque = rebond(p.t, t0, TEMPS.pop, 1.8);
  const pas = Math.min(0.08, 0.32 / Math.max(1, p.tuiles.length));
  const debutTuiles = t0 + 0.14;
  const finTuiles = debutTuiles + p.tuiles.length * pas;
  const adresse = progression(p.t, finTuiles, 0.1);
  const debutBouton = Math.min(p.debut + DUREE_CONSTRUCTION_FIN - TEMPS.pop, finTuiles + 0.08);
  const bouton = rebond(p.t, debutBouton, TEMPS.pop, 2.2);
  const vivant = p.t >= p.debut + DUREE_CONSTRUCTION_FIN;
  const battement = vivant ? 1 + 0.07 * Math.max(0, Math.sin((2 * Math.PI * (p.t - p.debut - DUREE_CONSTRUCTION_FIN)) / 0.7)) : 1;
  const allumee = vivant ? Math.floor((p.t - p.debut - DUREE_CONSTRUCTION_FIN) / 0.35) % Math.max(1, p.tuiles.length) : -1;
  const cote = Math.min(W * 0.12, (l * 0.86) / Math.max(1, p.tuiles.length * 1.25));
  const fleche = vivant ? Math.sin((2 * Math.PI * (p.t - p.debut)) / 0.6) * W * 0.012 : 0;
  return (
    <>
      <div style={{ position: "absolute", left: x, top: y, width: l, height: h, transform: `translateY(${-(1 - chute) * (y + h + 0.02 * H)}px) rotate(${-4 * (1 - chute)}deg)`, transformOrigin: "50% 0%", ...styleBoite(W, COULEURS.ivoire), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: h * 0.06, paddingBottom: h * 0.12, boxSizing: "border-box" }}>
        <div style={{ fontFamily: POLICES.titre, fontSize: W * 0.1, lineHeight: 1, color: COULEURS.encre, transform: `scale(${p.t < t0 ? 0 : 0.2 + 0.8 * marque})`, letterSpacing: -1 }}>
          {p.marque}
          <span style={{ color: COULEURS.orange }}>.</span>
        </div>
        <div style={{ display: "flex", gap: cote * 0.25 }}>
          {p.tuiles.map((nom, i) => {
            const a = debutTuiles + i * pas;
            const e = rebond(p.t, a, TEMPS.pop, 2.6);
            const on = i === allumee;
            const fond = on ? COULEURS.encre : i % 2 ? COULEURS.ivoire : COULEURS.orange;
            return (
              <div key={`${nom}-${i}`} style={{ width: cote, height: cote, ...styleBoite(W, fond), display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${p.t < a ? 0 : e * (on ? 1.12 : 1)}) rotate(${i % 2 ? 3 : -3}deg)` }}>
                <Icone nom={nom} taille={cote * 0.55} couleur={on ? COULEURS.ivoire : i % 2 ? COULEURS.orange : COULEURS.ivoire} />
              </div>
            );
          })}
        </div>
        <div style={{ fontFamily: POLICES.titre, fontSize: W * 0.042, color: COULEURS.encre, opacity: adresse, transform: `translateY(${(1 - adresse) * 20}px)` }}>{p.adresse}</div>
      </div>
      {/* Bouton d'appel à l'action, à cheval sur le bas du panneau, au-dessus de la tête de Will. */}
      <div style={{ position: "absolute", left: 0, width: W, top: y + h - W * 0.045, display: "flex", justifyContent: "center", alignItems: "center", gap: W * 0.02, transform: `translateY(${-(1 - chute) * (y + h + 0.02 * H)}px)` }}>
        <div style={{ ...styleBoite(W, COULEURS.orange, 16), padding: `${W * 0.016}px ${W * 0.045}px`, fontFamily: POLICES.titre, fontSize: W * 0.052, color: COULEURS.ivoire, textTransform: "uppercase", whiteSpace: "nowrap", transform: `scale(${p.t < debutBouton ? 0 : (0.2 + 0.8 * bouton) * battement}) rotate(-2deg)` }}>
          {p.appel ?? `Commentez « ${p.motCle} »`}
        </div>
        {vivant ? (
          <div style={{ transform: `translateX(${fleche}px) rotate(-8deg)`, display: "flex", ...styleBoite(W, COULEURS.encre, 14), padding: W * 0.012 }}>
            <Icone nom="envoyer" taille={W * 0.05} couleur={COULEURS.ivoire} epaisseur={3} />
          </div>
        ) : null}
      </div>
    </>
  );
}

export function Fin(p: FinProps) {
  if (p.t < p.debut) return null;
  const W = p.largeurImage;
  const H = p.hauteurImage;
  const monte = pousseeFin(p.t, p.debut);
  const t0 = p.debut + DUREE_POUSSEE_FIN;
  const marque = rebond(p.t, t0, TEMPS.pop * 1.2, 1.8);
  const cote = W * 0.12;
  const finTuiles = t0 + 0.2 + p.tuiles.length * 0.09;
  const adresse = progression(p.t, finTuiles, 0.12);
  const bouton = rebond(p.t, finTuiles + 0.12, TEMPS.pop, 2.2);
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H * 1.3, paddingBottom: H * 0.3, boxSizing: "border-box", background: COULEURS.ivoire, transform: `translateY(${(1 - monte) * H}px)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: H * 0.03 }}>
      <div style={{ fontFamily: POLICES.titre, fontSize: W * 0.11, color: COULEURS.encre, transform: `scale(${0.2 + 0.8 * marque})`, letterSpacing: -1 }}>
        {p.marque}
        <span style={{ color: COULEURS.orange }}>.</span>
      </div>
      <div style={{ display: "flex", gap: W * 0.025 }}>
        {p.tuiles.map((nom, i) => {
          const e = rebond(p.t, t0 + 0.2 + i * 0.09, TEMPS.pop, 2.6);
          return (
            <div key={nom} style={{ width: cote, height: cote, ...styleBoite(W, i % 2 ? COULEURS.ivoire : COULEURS.orange), display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${p.t < t0 + 0.2 + i * 0.09 ? 0 : e}) rotate(${i % 2 ? 3 : -3}deg)` }}>
              <Icone nom={nom} taille={cote * 0.55} couleur={i % 2 ? COULEURS.orange : COULEURS.ivoire} />
            </div>
          );
        })}
      </div>
      <div style={{ fontFamily: POLICES.titre, fontSize: W * 0.04, color: COULEURS.encre, opacity: adresse, transform: `translateY(${(1 - adresse) * 20}px)` }}>{p.adresse}</div>
      <div style={{ ...styleBoite(W, COULEURS.orange, 16), padding: `${W * 0.015}px ${W * 0.04}px`, fontFamily: POLICES.titre, fontSize: W * 0.05, color: COULEURS.ivoire, textTransform: "uppercase", transform: `scale(${p.t < finTuiles + 0.12 ? 0 : 0.2 + 0.8 * bouton}) rotate(-2deg)` }}>
        {p.appel ?? `Commentez « ${p.motCle} »`}
      </div>
    </div>
  );
}
