/** C04 Cartes en éventail : titre à accent, une ligne, trois cartes inclinées (maquette `heroDeck`). */
import { alpha, CHARTE_CONTINU as C } from "../../../../../../src/briques/visuels/charte-carrousel";
import type { NomIconeContinu } from "../../commun/icones-continu";
import { Carte, Etincelle, police, Pose, POLICE_TITRE, Texte, Tuile, type VarianteCarte, type VarianteTuile } from "../../commun/Primitives";
import type { ProprietesPlaquette } from "../../types";
import { Cadre, TitreCouverture, ZoneTexte } from "./commun";

interface CarteEventail {
  x: number;
  y: number;
  rotation: number;
  icone: NomIconeContinu;
  variante: VarianteCarte;
  z: number;
}

const CARTES: CarteEventail[] = [
  { x: 20, y: 130, rotation: -12, icone: "calendar", variante: "pl", z: 1 },
  { x: 600, y: 130, rotation: 12, icone: "shield", variante: "k", z: 1 },
  { x: 290, y: 40, rotation: 0, icone: "target", variante: "o", z: 2 },
];

function Eventail({ libelles }: { libelles: string[] }) {
  return (
    <div style={{ position: "relative", width: 960, height: 640 }}>
      {CARTES.map((c, i) => {
        const tuile: VarianteTuile = c.variante === "o" ? "k" : "o";
        const barre = { display: "block", height: 12, borderRadius: 6, background: alpha(c.variante === "k" ? C.creme : C.encre, 0.14) };
        return (
          <Pose key={c.icone} x={c.x} y={c.y} rotation={c.rotation} style={{ zIndex: c.z }}>
            <Carte variante={c.variante} style={{ width: 330, height: 410, padding: 34, borderRadius: 52, display: "flex", flexDirection: "column", justifyContent: "space-between", color: c.variante === "k" ? C.creme : C.encre }}>
              <Tuile icone={c.icone} taille={150} variante={tuile} />
              <div>
                <b style={{ ...police(800, 46, 1, POLICE_TITRE), letterSpacing: "-0.04em", display: "block" }}>{libelles[i]}</b>
                <span style={{ ...barre, marginTop: 20, width: "80%" }} />
                <span style={{ ...barre, marginTop: 12, width: "56%" }} />
              </div>
            </Carte>
          </Pose>
        );
      })}
    </div>
  );
}

export function C04({ page, hauteur }: ProprietesPlaquette) {
  return (
    <Cadre hauteur={hauteur}>
      <Pose x={60} y={690}>
        <Eventail libelles={page.cartes as string[]} />
      </Pose>
      <Pose x={930} y={620}>
        <Etincelle taille={52} />
      </Pose>
      <ZoneTexte>
        <TitreCouverture taille={150} titre={String(page.titre)} accent={String(page.accent)} suite={page.suite ? String(page.suite) : undefined} style={{ marginTop: 20, maxWidth: 900 }} />
        <Texte style={{ marginTop: 34 }}>{String(page.texte)}</Texte>
      </ZoneTexte>
    </Cadre>
  );
}
