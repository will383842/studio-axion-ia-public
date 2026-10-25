/**
 * Parcours PH « Le circuit » (4 pages, maquette id « h ») : un circuit en quatre nœuds (tuiles en relief) relié par une ligne qui traverse
 * trois coutures. La dernière page est sombre : « Vous validez » est le point final. Chaque nœud tient sur une seule page ; les numéros
 * 01 à 04 sont posés par le code.
 */
import { CHARTE_CONTINU as C } from "../../../../../src/briques/visuels/charte-carrousel";
import { Etincelle, police, Pose, POLICE_SERIF, Tuile, type VarianteTuile } from "../commun/Primitives";
import type { NomIconeContinu } from "../commun/icones-continu";
import type { ProprietesParcours } from "../types";
import { bf, CalqueDecor, champ, Petit, TitreP, typo } from "./commun-parcours";

const CX = [300, 1380, 2460, 3540];
const Y = 860;
const NOEUDS: { icone: NomIconeContinu; variante: VarianteTuile }[] = [
  { icone: "mail", variante: "w" },
  { icone: "spark", variante: "k" },
  { icone: "doc", variante: "w" },
  { icone: "check", variante: "o" },
];

export function PH({ pages }: ProprietesParcours) {
  return (
    <>
      <CalqueDecor largeur={4320}>
        <path d={`M${CX[0]} ${Y} H${CX[3]}`} stroke={C.encre} strokeOpacity={0.08} strokeWidth={60} strokeLinecap="round" />
        <path data-a-cheval="" d={`M${CX[0]} ${Y} H${CX[3]}`} stroke={C.orange} strokeWidth={16} strokeLinecap="round" />
        {[0, 1, 2].map((i) => {
          const x = (CX[i] + CX[i + 1]) / 2;
          return <path key={i} d={`M${x - 12} ${Y - 26} l26 26 l-26 26`} fill="none" stroke={C.orange} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />;
        })}
      </CalqueDecor>
      <TitreP x={80} y={200} taille={100} largeur={920} titre={champ(pages[0], "titre")} accent={champ(pages[0], "accent")} />
      {NOEUDS.map((n, i) => {
        const x = CX[i];
        const derniere = i === 3;
        return (
          <div key={n.icone}>
            <Pose x={x - 110} y={Y - 110}>
              <Tuile icone={n.icone} taille={220} variante={n.variante} />
            </Pose>
            <div style={{ position: "absolute", left: x - 230, top: Y + 150, width: 460, textAlign: "center" }}>
              <b style={{ ...bf(52), display: "block", color: derniere ? C.creme : C.encre }}>{typo(champ(pages[i], "etape"))}</b>
              <Petit taille={30} style={{ marginTop: 10, color: derniere ? C.sableSombre : undefined, opacity: derniere ? 1 : 0.78 }}>
                {typo(champ(pages[i], "detail"))}
              </Petit>
            </div>
            <div style={{ position: "absolute", left: x - 230, top: Y - 300, width: 460, textAlign: "center", ...police(400, 110, 1, POLICE_SERIF, true), color: C.orange }}>{`0${i + 1}`}</div>
          </div>
        );
      })}
      <Pose x={2000} y={560}>
        <Etincelle taille={52} />
      </Pose>
      <Pose x={3000} y={1080}>
        <Etincelle taille={40} couleur={C.encre} />
      </Pose>
    </>
  );
}
