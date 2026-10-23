import React from "react";
/**
 * 2. Interjection — étiquette de chapitre : plaque ENCRE (liseré IVOIRE_CLAIR de 3 px), texte ACCENT_1, corps 84, « REGARDEZ. », « ATTENTION. »…
 * Gabarit M1, largeur ≈ 0,55 L, inclinaison -3°. Déroulé : i0 pop CLAQUE (échelle 0,3 → 1) · i6 secousse ±0,006 L sur 4 i · i12 soulignement ACCENT_1 de 8 px
 * tracé de gauche à droite en 5 i · sortie S-RETRECIT 3 i (au plus 0,9 s de présence).
 */
import { useCurrentFrame } from "remotion";
import { Anim, BAS_M1, COULEURS, Plaque, Son, W, accents, courbe, entreePop, secousse } from "./commun-lot1";
import type { Palette } from "./commun-lot1";

export type InterjectionProps = { palette: Palette; texte?: string; sortie?: number; decalage?: number; muet?: boolean };
export const DUREE_DEFAUT = 27;
export const evenements = (p: Pick<InterjectionProps, "sortie"> = {}): number[] => [0, 6, 12, 17, p.sortie ?? 24];

export function Interjection({ palette, texte = "REGARDEZ.", sortie = 24, decalage = 0, muet }: InterjectionProps) {
  const i = useCurrentFrame();
  const { ACCENT_1 } = accents(palette);
  const corps = Math.min(84, Math.floor((0.62 * W - 40) / (texte.length * 0.79)));
  const etat = entreePop(i, { incl: -3, nom: "CLAQUE", sortie, nSortie: 3 });
  const dx = secousse(i - 6, 0.006 * W * 1.6);
  const trace = courbe(i, 12, 5);
  return (
    <>
      <Anim etat={etat} origine="50% 100%" style={{ position: "absolute", left: W * (0.5 + decalage) + dx, bottom: 1920 - (BAS_M1 + 8), transform: "translateX(-50%)" }}>
        <Plaque fond={COULEURS.ENCRE} texte={ACCENT_1} corps={corps} interl={0.01} padV={0.2} padH={0.36} style={{ position: "relative" }}>
          {texte}
          <span style={{ position: "absolute", left: 0.36 * corps, bottom: 0.1 * corps, width: `calc((100% - ${0.72 * corps}px) * ${trace})`, height: 8, background: ACCENT_1 }} />
        </Plaque>
      </Anim>
      {!muet && <Son t={0} fichier="drop_001" volume={0.22} />}
    </>
  );
}
