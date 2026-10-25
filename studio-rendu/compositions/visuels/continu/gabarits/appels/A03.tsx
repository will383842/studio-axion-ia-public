/**
 * A03 « Enregistrer et partager » (maquette v3) : page orange, dernière page. Titre à accent encre (serif italique, pas d'orange sur orange),
 * une phrase d'invitation, un marque-page et un avion en papier en relief. Aucun domaine. Objets ancrés au bas de la page (3:4 : +90 px).
 */
import { CHARTE_CONTINU as C } from "../../../../../../src/briques/visuels/charte-carrousel";
import { Etincelle, police, Pose, POLICE_SERIF, POLICE_TEXTE, POLICE_TITRE, Tuile } from "../../commun/Primitives";
import { HAUTEURS, LARGEUR_PAGE, MARGE_SURE, TAILLES_CONTINU } from "../../constantes-continu";
import type { ProprietesPlaquette } from "../../types";

export function A03({ page, hauteur }: ProprietesPlaquette) {
  const p = page as unknown as { titre: string; accent: string; texte: string };
  const d = hauteur - HAUTEURS["4:5"];
  return (
    <>
      <div style={{ position: "absolute", left: 0, top: 0, width: LARGEUR_PAGE, height: hauteur, background: C.orange }} />
      <div style={{ position: "absolute", left: MARGE_SURE, top: 196, width: 920, height: hauteur - 196 - 150, display: "flex", flexDirection: "column" }}>
        <h1 style={{ ...police(800, 150, 0.94, POLICE_TITRE), letterSpacing: "-0.045em", wordSpacing: "0.08em", margin: 0, marginTop: 10, color: C.encre, textWrap: "balance" }}>
          {p.titre}{" "}
          <em style={{ ...police(400, 165, 0.9, POLICE_SERIF, true), letterSpacing: "-0.015em", color: C.encre, wordSpacing: 0 }}>{p.accent}</em>
        </h1>
        <p style={{ ...police(500, TAILLES_CONTINU.p, 1.32, POLICE_TEXTE), color: C.encre, margin: 0, marginTop: 36, maxWidth: 640 }}>{p.texte}</p>
      </div>
      <Pose x={90} y={790 + d} rotation={-8}>
        <Tuile icone="bookmark" taille={330} variante="k" />
      </Pose>
      <Pose x={470} y={880 + d} rotation={7}>
        <Tuile icone="send" taille={250} variante="w" />
      </Pose>
      <Pose x={780} y={740 + d}>
        <Etincelle taille={70} couleur={C.encre} />
      </Pose>
      <Pose x={900} y={1020 + d}>
        <Etincelle taille={40} couleur={C.ecume} />
      </Pose>
    </>
  );
}
