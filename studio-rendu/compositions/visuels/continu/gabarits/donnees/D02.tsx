/** D02 « Citation » : fond pêche, grand guillemet orange, citation en serif italique, auteur et fonction avec une tuile. */
import { CHARTE_CONTINU as C } from "../../../../../../src/briques/visuels/charte-carrousel";
import { Etincelle, police, POLICE_SERIF, POLICE_TEXTE, Pose, Tuile } from "../../commun/Primitives";
import { MARGE_SURE } from "../../constantes-continu";
import type { ProprietesPlaquette } from "../../types";

export function D02({ page, hauteur }: ProprietesPlaquette) {
  return (
    <>
      <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: hauteur, background: C.peche }} />
      <div style={{ position: "absolute", left: MARGE_SURE, top: 196, width: 920, height: hauteur - 196 - 150, display: "flex", flexDirection: "column" }}>
        <div style={{ ...police(400, 380, 0.7, POLICE_SERIF, true), letterSpacing: "-0.02em", color: C.orange, marginTop: 36 }}>“</div>
        <div style={{ ...police(400, 112, 1.01, POLICE_SERIF, true), letterSpacing: "-0.02em", marginTop: 6, color: C.encre }}>{String(page.citation)}</div>
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 26 }}>
          <Tuile icone="users" taille={120} variante="o" />
          <div style={{ maxWidth: 640 }}>
            <b style={{ ...police(700, 36, 1.2, POLICE_TEXTE), display: "block", color: C.encre }}>{String(page.auteur)}</b>
            <span style={{ ...police(500, 28, 1.3, POLICE_TEXTE), display: "block", color: C.encre, opacity: 0.78 }}>{String(page.fonction)}</span>
          </div>
        </div>
      </div>
      <Pose x={880} y={300}>
        <Etincelle taille={64} />
      </Pose>
      <Pose x={790} y={210}>
        <Etincelle taille={30} couleur={C.encre} />
      </Pose>
    </>
  );
}
