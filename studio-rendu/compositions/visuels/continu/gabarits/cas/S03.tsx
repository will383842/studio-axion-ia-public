/** S03 · Schéma en trois nœuds : tuiles de 180 px reliées par des tirets épais (jamais un trait fin ; rien ne touche une couture). */
import { CHARTE_CONTINU as C } from "../../../../../../src/briques/visuels/charte-carrousel";
import { Etincelle, police, POLICE_TITRE, Pose, Texte, Titre, Tuile, type VarianteTuile } from "../../commun/Primitives";
import type { NomIconeContinu } from "../../commun/icones-continu";
import { TAILLES_CONTINU } from "../../constantes-continu";
import type { ProprietesPlaquette } from "../../types";
import { EtiquetteCas, ZoneCas } from "./commun-cas";

const NOEUDS: [NomIconeContinu, VarianteTuile][] = [["mail", "w"], ["spark", "k"], ["check", "o"]];

/** `link()` : 10 × 54 px, tirets de 14 px espacés de 12 px. */
function Lien() {
  return <div style={{ marginLeft: 86, width: 10, height: 54, borderRadius: 5, background: `repeating-linear-gradient(${C.orange} 0 14px, transparent 14px 26px)` }} />;
}

export function S03({ page, hauteur }: ProprietesPlaquette) {
  const noeuds = page.noeuds as { titre: string; texte: string }[];
  return (
    <>
      <ZoneCas hauteur={hauteur}>
        <EtiquetteCas />
        <Titre taille={100} texte={String(page.titre)} accent={String(page.accent)} style={{ marginBottom: 40 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {noeuds.map((n, i) => (
            <div key={i} style={{ display: "contents" }}>
              {i > 0 ? <Lien /> : null}
              <div style={{ display: "flex", gap: 36, alignItems: "center" }}>
                <Tuile icone={NOEUDS[i][0]} taille={180} variante={NOEUDS[i][1]} />
                <div>
                  <b style={{ ...police(800, 58, 1, POLICE_TITRE), letterSpacing: "-0.04em", display: "block" }}>{n.titre}</b>
                  <Texte taille={TAILLES_CONTINU.sm} style={{ marginTop: 8, color: C.encre, opacity: 0.78 }}>{n.texte}</Texte>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ZoneCas>
      <Pose x={920} y={320}>
        <Etincelle taille={60} />
      </Pose>
    </>
  );
}
