import React from "react";
/**
 * CHI-E · En objets (maquette CHI-E-2) : le chiffre en grand, puis on compte : une grille de bulles qui se cochent une
 * à une (8 sur 10 pour 80 %) ; le reste déjà dit (« 20 % ») et ses bulles partent vers la sortie. Appoint : la carte de
 * la sortie, où les bulles arrivent (aucun mot).
 */
import type { DonneesEcranChiffresRendu } from "./donnees";
import { a, Appoint, Bulle, C, CartePleine, ChiffreAnton, Coche, contreEchelle, doux, INTER, Points, progres, surplusLegende, type CadreChiffres } from "./outils";

/** Taille du chiffre compté (point focal : reste ≥ 230 px une fois la variante rangée). */
export const TAILLE_OBJETS = 350;
/** Écart minimal, en px, entre le bas de la légende du chiffre et le haut de la grille de bulles. */
export const ECART_LEGENDE_GRILLE = 40;

export function Objets({ d, t, t0, cadre, discret = 0, echelle = 1 }: { d: DonneesEcranChiffresRendu; t: number; t0: number; cadre: CadreChiffres; discret?: number; echelle?: number }) {
  const o = d.objets ?? { total: 10, part: 8 };
  const focal = d.chiffres[d.focal];
  const dy = cadre.haut - 300;
  const reste = o.reste;
  const cols = o.part <= 8 ? 4 : 5;
  const rangs = Math.ceil(o.part / cols);
  // La légende du chiffre (62 px, comme l'anneau) se pose SOUS lui ; la grille descend d'autant. Une fois la variante
  // rapetissée, la légende est contre-agrandie (elle reste à 62 px à l'écran) : la grille lui laisse la place.
  const legende = focal.legende;
  const decal = legende ? 52 + ECART_LEGENDE_GRILLE + surplusLegende(71, echelle) : 0;
  const hautGrille = 624 + dy + decal;
  const basGrille = reste ? 900 + dy : cadre.bas;
  const pasY = Math.min(150, (basGrille - hautGrille) / rangs);
  const pasX = 936 / cols;
  const l = pasX * 0.87;
  const h = Math.min(96, pasY * 0.64);
  const libres = Math.min(3, o.total - o.part);
  return (
    <>
      <div style={{ position: "absolute", left: 72, top: 280 + dy, width: 936, display: "flex", justifyContent: "center", opacity: doux(progres(t, t0 - 0.1, 0.25)) }}>
        <ChiffreAnton texte={focal.texte} taille={TAILLE_OBJETS} couleur={C.orange} />
      </div>
      {legende ? (
        <div style={{ position: "absolute", left: 72, top: 280 + dy + Math.round(TAILLE_OBJETS * 0.9), width: 936, textAlign: "center", ...INTER, fontSize: 62, color: C.encre, opacity: doux(progres(t, t0 + 0.2, 0.4)), ...contreEchelle(echelle, "50% 0%") }}>{legende}</div>
      ) : null}
      {Array.from({ length: o.part }, (_, i) => {
        const x = 74 + (i % cols) * pasX;
        const y = hautGrille + Math.floor(i / cols) * pasY;
        const entree = doux(progres(t, Math.min(d.debut, t0) + 0.05 * i, 0.25));
        const coche = progres(t, t0 + 0.35 + 0.1 * i, 0.2);
        return (
          <React.Fragment key={i}>
            <Bulle x={x} y={y} l={l} h={h} contour={coche > 0 ? C.vert : C.encre} ombre={false} opacite={entree}>
              <Points taille={Math.round(h * 0.18)} couleur={coche > 0 ? C.gris : C.encre} />
            </Bulle>
            {coche > 0 ? <Coche x={x + l - 6} y={y + 6} r={Math.round(h * 0.29)} echelle={0.6 + 0.4 * doux(coche)} /> : null}
          </React.Fragment>
        );
      })}
      {reste ? (
        <>
          <div style={{ position: "absolute", left: 72, top: 930 + dy, opacity: 1 - discret }}>
            <ChiffreAnton texte={reste.texte} taille={160} couleur={C.encre} />
          </div>
          <svg width={1080} height={cadre.hauteur} style={{ position: "absolute", left: 0, top: 0 }}>
            <path d={`M900 ${1060 + dy} C 930 ${1080 + dy}, 950 ${1100 + dy}, 960 ${1136 + dy}`} fill="none" stroke={a(C.encre, 0.35)} strokeWidth={6} strokeDasharray="2 18" strokeLinecap="round" />
          </svg>
          {Array.from({ length: libres }, (_, k) => (
            <Bulle key={k} x={392 + k * 268} y={956 + dy + k * 46} l={226} h={104} contour={C.encre} rotation={k % 2 ? 8 : -6} opacite={doux(progres(t, t0 + 0.4 + 0.1 * k, 0.3))}>
              <Points taille={17} />
            </Bulle>
          ))}
        </>
      ) : null}
    </>
  );
}

/** Appoint : la carte de la sortie, où arrivent les bulles qui restent. */
export function AppointObjets({ d, cadre }: { d: DonneesEcranChiffresRendu; cadre: CadreChiffres }) {
  return (
    <Appoint cadre={cadre}>
      <CartePleine x={130} y={1316} l={820} h={214} icone={d.icones.sortie}>
        <div style={{ position: "relative", width: 520, height: 140 }}>
          <Bulle x={0} y={22} l={230} h={86} contour={C.encre} ombre={false} rotation={-3}>
            <Points taille={16} />
          </Bulle>
          <Bulle x={262} y={22} l={230} h={86} contour={C.encre} ombre={false} rotation={3}>
            <Points taille={16} />
          </Bulle>
        </div>
      </CartePleine>
    </Appoint>
  );
}
