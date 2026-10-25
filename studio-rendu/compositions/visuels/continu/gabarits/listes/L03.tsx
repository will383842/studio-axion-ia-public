/** L03 · Escalier : des marches de plus en plus hautes, une tuile au-dessus de chacune, la dernière en orange. */
import { CHARTE_CONTINU as C, degrade } from "../../../../../../src/briques/visuels/charte-carrousel";
import type { NomIconeContinu } from "../../commun/icones-continu";
import { Etincelle, Pose, POLICE_TITRE, Titre, Tuile, police } from "../../commun/Primitives";
import type { ProprietesPlaquette } from "../../types";
import { ZoneListe } from "./commun";

interface Etape {
  icone: NomIconeContinu;
  label: string;
}

const MARCHE_SOMBRE = degrade(180, [C.brun, C.encre]);
const MARCHE_ORANGE = degrade(180, [C.orangeLumiere, C.orange]);

export function L03({ page, hauteur }: ProprietesPlaquette) {
  const etapes = page.etapes as Etape[];
  const n = etapes.length;
  return (
    <>
      <ZoneListe hauteur={hauteur}>
        <Titre taille={110} texte={String(page.titre)} accent={String(page.accent)} style={{ marginBottom: 20 }} />
        <div style={{ marginTop: "auto", display: "flex", gap: 14, alignItems: "flex-end", position: "relative" }}>
          {etapes.map((e, i) => {
            const derniere = i === n - 1;
            const h = Math.round(210 + (i * 390) / (n - 1));
            return (
              <div key={i} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 18, alignItems: "center" }}>
                <Tuile icone={e.icone} taille={118} variante={derniere ? "o" : "w"} />
                <div style={{ width: "100%", height: h, borderRadius: "30px 30px 0 0", background: derniere ? MARCHE_ORANGE : MARCHE_SOMBRE, color: derniere ? C.encre : C.creme, padding: "26px 20px", ...police(800, 36, 1.05, POLICE_TITRE), letterSpacing: "-0.03em" }}>{e.label}</div>
              </div>
            );
          })}
        </div>
      </ZoneListe>
      <Pose x={120} y={hauteur - 610}>
        <Etincelle taille={60} />
      </Pose>
    </>
  );
}
