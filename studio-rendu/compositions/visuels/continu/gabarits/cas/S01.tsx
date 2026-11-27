/** S01 · Fenêtre : la relance. Fenêtre de brouillon (trois points, objet, message, interrupteur « Vous validez avant l'envoi »). */
import { CHARTE_CONTINU as C } from "../../../../../../src/briques/visuels/charte-carrousel";
import { Carte, Etincelle, Interrupteur, police, Pose, POLICE_TEXTE, Titre, Tuile } from "../../commun/Primitives";
import type { ProprietesPlaquette } from "../../types";
import { EtiquetteCas, ZoneCas } from "./commun-cas";

/** Points de la barre de fenêtre : jeton `lin` à la place de la teinte légèrement plus claire de la maquette (écart de teinte imperceptible, aucune couleur littérale permise). */
function Point({ couleur }: { couleur: string }) {
  return <b style={{ width: 18, height: 18, borderRadius: "50%", background: couleur, display: "block" }} />;
}

export function S01({ page, hauteur }: ProprietesPlaquette) {
  return (
    <>
      <ZoneCas hauteur={hauteur}>
        <EtiquetteCas />
        <Titre taille={98} texte={String(page.titre)} accent={String(page.accent)} style={{ marginBottom: 34 }} />
        <Carte style={{ padding: 0, overflow: "hidden", borderRadius: 50 }}>
          <div style={{ background: C.creme2, padding: "22px 34px", display: "flex", gap: 10, alignItems: "center" }}>
            <Point couleur={C.lin} />
            <Point couleur={C.lin} />
            <Point couleur={C.orange} />
            <span style={{ marginLeft: 18, ...police(600, 26, 1.2, POLICE_TEXTE), opacity: 0.6, whiteSpace: "nowrap" }}>{String(page.fenetre)}</span>
          </div>
          <div style={{ padding: "34px 40px", display: "flex", flexDirection: "column", gap: 22 }}>
            <div style={{ display: "flex", gap: 22, alignItems: "center" }}>
              <Tuile icone="mail" taille={84} variante="o" />
              <div>
                <b style={{ ...police(700, 30, 1.2, POLICE_TEXTE), display: "block" }}>{`À : ${String(page.destinataire)}`}</b>
                <span style={{ ...police(500, 26, 1.2, POLICE_TEXTE), opacity: 0.6 }}>{String(page.objet)}</span>
              </div>
            </div>
            <div style={{ ...police(500, 33, 1.35, POLICE_TEXTE) }}>{String(page.message)}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 22, marginTop: 6 }}>
              <Interrupteur allume />
              <b style={{ ...police(600, 30, 1.2, POLICE_TEXTE)}}>{String(page.validation)}</b>
            </div>
          </div>
        </Carte>
      </ZoneCas>
      <Pose x={910} y={300}>
        <Etincelle taille={52} />
      </Pose>
    </>
  );
}
