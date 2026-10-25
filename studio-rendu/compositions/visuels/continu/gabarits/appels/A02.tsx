/**
 * A02 « À retenir » (maquette v3) : page pêche, avant-dernière. « En trois idées » (le mot du milieu en accent serif), puis trois cartes
 * à tuile en relief. Les icônes, les variantes et l'ordre sont posés par le code.
 */
import { CHARTE_CONTINU as C } from "../../../../../../src/briques/visuels/charte-carrousel";
import type { NomIconeContinu } from "../../commun/icones-continu";
import { Carte, Etincelle, police, Pose, POLICE_SERIF, POLICE_TITRE, Tuile, type VarianteTuile } from "../../commun/Primitives";
import { LARGEUR_PAGE, MARGE_SURE } from "../../constantes-continu";
import type { ProprietesPlaquette } from "../../types";

const TUILES: [NomIconeContinu, VarianteTuile][] = [["target", "o"], ["shield", "k"], ["gear", "p"]];

export function A02({ page, hauteur }: ProprietesPlaquette) {
  const p = page as unknown as { titre: string; accent: string; suite: string; idees: string[] };
  return (
    <>
      <div style={{ position: "absolute", left: 0, top: 0, width: LARGEUR_PAGE, height: hauteur, background: C.peche }} />
      <div style={{ position: "absolute", left: MARGE_SURE, top: 196, width: 920, height: hauteur - 196 - 150, display: "flex", flexDirection: "column" }}>
        <h1 style={{ ...police(800, 120, 0.94, POLICE_TITRE), letterSpacing: "-0.045em", wordSpacing: "0.08em", margin: 0, marginBottom: 44, color: C.encre }}>
          {p.titre}{" "}
          <em style={{ ...police(400, 132, 0.9, POLICE_SERIF, true), letterSpacing: "-0.015em", color: C.orange, wordSpacing: 0 }}>{p.accent}</em> {p.suite}
        </h1>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {p.idees.map((idee, i) => (
            <Carte key={i} style={{ display: "flex", gap: 34, alignItems: "center", padding: "30px 38px", borderRadius: 48 }}>
              <Tuile icone={TUILES[i][0]} taille={130} variante={TUILES[i][1]} />
              <b style={{ ...police(800, 50, 1.02, POLICE_TITRE), letterSpacing: "-0.035em" }}>{idee}</b>
            </Carte>
          ))}
        </div>
      </div>
      <Pose x={900} y={200}>
        <Etincelle taille={58} />
      </Pose>
    </>
  );
}
