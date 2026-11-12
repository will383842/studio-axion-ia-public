/** Image d'une infographie : dessine la mise en page pure (`mise-en-page.ts`). Le JSX ne vit que dans des fonctions appelées au rendu. */
import { AbsoluteFill } from "remotion";
import type { InfographieSpecType } from "../../../../../src/domaine/visuels/schema-infographie";
import { GRAISSE_TITRE, POLICE_CORPS, POLICE_TITRE } from "../../commun/constantes";
import { INTERLIGNE_INFOGRAPHIE, miseEnPageInfographie, type Gabarit, type RatioInfographie } from "./mise-en-page";

export type ProprietesInfographie = { spec: InfographieSpecType; gabarit: Gabarit; ratio: RatioInfographie };

export function Infographie({ spec, gabarit, ratio }: ProprietesInfographie) {
  const m = miseEnPageInfographie(gabarit, ratio, spec);
  return (
    <AbsoluteFill style={{ background: m.fond }}>
      {m.formes.map((f, i) => (
        <div key={`f${i}`} style={{ position: "absolute", left: f.x, top: f.y, width: f.largeur, height: f.hauteur, background: f.fond, borderRadius: f.largeur === f.hauteur ? f.largeur / 2 : 28 }} />
      ))}
      {m.textes.map((t) => (
        <div
          key={t.zone}
          style={{ position: "absolute", left: t.x, top: t.y, width: t.largeur, height: t.hauteur, overflow: "hidden", color: t.couleur, fontFamily: t.graisse === 800 ? POLICE_TITRE : POLICE_CORPS, fontWeight: t.graisse === 800 ? GRAISSE_TITRE : 500, fontSize: t.taille, lineHeight: INTERLIGNE_INFOGRAPHIE, textAlign: t.zone.endsWith("numéro") ? "center" : "left" }}
        >
          {t.lignes.map((l, i) => (
            <div key={i} style={{ whiteSpace: "nowrap" }}>{l}</div>
          ))}
        </div>
      ))}
    </AbsoluteFill>
  );
}
