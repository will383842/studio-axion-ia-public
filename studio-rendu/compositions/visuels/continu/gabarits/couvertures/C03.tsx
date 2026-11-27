/** C03 Sommaire illustré : titre à accent, trois entrées numérotées (numéros et icônes posés par le code), une sphère qui déborde à droite. */
import { CHARTE_CONTINU as C } from "../../../../../../src/briques/visuels/charte-carrousel";
import type { NomIconeContinu } from "../../commun/icones-continu";
import { Carte, police, Pose, POLICE_TITRE, Sphere, Tuile } from "../../commun/Primitives";
import type { ProprietesPlaquette } from "../../types";
import { Cadre, TitreCouverture, ZoneTexte } from "./commun";

const ENTREES: [string, NomIconeContinu][] = [
  ["01", "target"],
  ["02", "users"],
  ["03", "chart"],
];

export function C03({ page, hauteur }: ProprietesPlaquette) {
  const entrees = page.entrees as string[];
  return (
    <Cadre hauteur={hauteur}>
      <Pose x={820} y={560} style={{ opacity: 0.9 }}>
        <Sphere rayon={190} />
      </Pose>
      <ZoneTexte>
        <TitreCouverture taille={120} titre={String(page.titre)} accent={String(page.accent)} style={{ maxWidth: 900 }} />
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 20 }}>
          {ENTREES.map(([numero, icone], i) => (
            <Carte key={numero} style={{ display: "flex", alignItems: "center", gap: 30, padding: "26px 34px" }}>
              <span style={{ ...police(800, 74, 1, POLICE_TITRE), letterSpacing: "-0.04em", width: 112, color: i === 0 ? C.orange : C.encre }}>{numero}</span>
              <b style={{ ...police(700, 42, 1.05, POLICE_TITRE), letterSpacing: "-0.03em", flex: 1 }}>{entrees[i]}</b>
              <Tuile icone={icone} taille={104} variante={i === 0 ? "o" : "p"} />
            </Carte>
          ))}
        </div>
      </ZoneTexte>
    </Cadre>
  );
}
