import React from "react";
/**
 * 7. Equation — empilement construit au mot : « SAVOIR-FAIRE » + « L'IA » = « TEMPS GAGNÉ », chaque terme sur sa plaque, les signes (+, =) dans des
 * pastilles rondes ENCRE à texte ACCENT_1 (posées juste à gauche des plaques pour tenir en 0,165 H). Gabarit M1, 3 lignes de ≈ 60 px.
 * Déroulé : 0 terme 1 pop · `instants.plus` « + » CLAQUE · +3 terme 2 s'étire · `instants.egal` « = » CLAQUE · +3 résultat sur plaque ACCENT_2 CLAQUE + secousse ·
 * `sortie` de bas en haut, 1 i par ligne.
 */
import { useCurrentFrame } from "remotion";
import { Anim, BAS_M1, COULEURS, MONTSERRAT, Plaque, Son, W, ombreEncre, accents, corpsPour, entreeEtire, entreePop, hauteurPlaque, secousse } from "./commun-lot1";
import type { Palette } from "./commun-lot1";

export type EquationProps = {
  palette: Palette;
  termes: [string, string];
  resultat: string;
  instants?: { plus: number; egal: number };
  sortie?: number;
  muet?: boolean;
};
export const DUREE_DEFAUT = 72;
export const evenements = (p: Pick<EquationProps, "instants" | "sortie">): number[] => {
  const { plus, egal } = p.instants ?? { plus: 14, egal: 36 };
  return [0, plus, plus + 3, egal, egal + 3, egal + 9, p.sortie ?? 62];
};

function Signe({ signe, i, palette, sortie }: { signe: string; i: number; palette: Palette; sortie: number }) {
  const { ACCENT_1 } = accents(palette);
  return (
    <Anim etat={entreePop(i, { nom: "CLAQUE", incl: -4, sortie, depart: 0.2 })} style={{ position: "absolute", left: -84, top: "50%", marginTop: -34 }}>
      <div style={{ boxSizing: "border-box", width: 68, height: 68, borderRadius: 999, background: COULEURS.ENCRE, border: `5px solid ${COULEURS.ENCRE}`, boxShadow: ombreEncre("S"), color: ACCENT_1, fontFamily: `${MONTSERRAT}, sans-serif`, fontWeight: 900, fontSize: 52, lineHeight: "56px", textAlign: "center" }}>{signe}</div>
    </Anim>
  );
}

export function Equation({ palette, termes, resultat, instants = { plus: 14, egal: 36 }, sortie = 62, muet }: EquationProps) {
  const i = useCurrentFrame();
  const { ACCENT_1, ACCENT_2 } = accents(palette);
  const corps = corpsPour([termes[0], termes[1], resultat], 0.62 * W, 54, 44);
  const hP = hauteurPlaque(corps);
  const hTotal = 3 * hP + 2 * 4;
  const top = BAS_M1 - hTotal;
  // sortie de bas en haut : résultat d'abord, puis terme 2, puis terme 1
  const sorties = [sortie + 2, sortie + 1, sortie];
  if (i >= sortie + 2 + 3) return null;
  const largeur = (t: string) => Math.round(t.length * corps * 0.79 + 0.6 * corps + 10);
  const largeurMax = Math.max(largeur(termes[0]), largeur(termes[1]), largeur(resultat));
  const lignes = [
    { t: termes[0], etat: entreePop(i, { incl: -3, sortie: sorties[2], nSortie: 3 }), fond: COULEURS.BLANC, y: 0, signe: null as string | null, tInst: 0, orig: "50% 50%" },
    { t: termes[1], etat: entreeEtire(i - (instants.plus + 3), { sortie: sorties[1] - (instants.plus + 3), nSortie: 3 }), fond: ACCENT_1, y: hP + 4, signe: "+", tInst: instants.plus, orig: "0% 50%" },
    { t: resultat, etat: entreePop(i - (instants.egal + 3), { nom: "CLAQUE", incl: 1.5, sortie: sorties[0] - (instants.egal + 3), nSortie: 3 }), fond: ACCENT_2, y: 2 * (hP + 4), signe: "=", tInst: instants.egal, orig: "50% 50%" },
  ];
  const dx = secousse(i - (instants.egal + 9), 9);
  return (
    <>
      <div style={{ position: "absolute", left: W / 2 + 40, top, width: 0, height: 0 }}>
        {lignes.map((l, k) => (
          <div key={k} style={{ position: "absolute", left: -largeurMax / 2 + (k === 2 ? dx : 0), top: l.y, width: largeur(l.t), height: hP }}>
            <Anim etat={l.etat} origine={l.orig} style={{ width: "100%", height: "100%" }}>
              <Plaque fond={l.fond} corps={corps} largeur={largeur(l.t)} style={{ height: hP }}>{l.t}</Plaque>
            </Anim>
            {l.signe ? <Signe signe={l.signe} i={i - l.tInst} palette={palette} sortie={sorties[k] - l.tInst} /> : null}
          </div>
        ))}
      </div>
      {!muet && <Son t={instants.plus} fichier="click_001" volume={0.3} />}
      {!muet && <Son t={instants.egal} fichier="click_001" volume={0.3} />}
      {!muet && <Son t={instants.egal + 3} fichier="ding-2" volume={0.2} />}
    </>
  );
}
