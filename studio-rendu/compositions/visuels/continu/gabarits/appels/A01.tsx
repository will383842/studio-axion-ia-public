/**
 * A01 « Message privé » (maquette v3) : page sombre, dernière page. Titre à accent serif, une bulle reçue en verre, une bulle envoyée orange, puis
 * l'unique bouton « écrire en message privé » en bas. Aucun domaine, jamais « commentez ». Texte courant ≥ 34 px.
 */
import { alpha, CHARTE_CONTINU as C, degrade } from "../../../../../../src/briques/visuels/charte-carrousel";
import { Bulle, Etincelle, Icone, police, Pose, POLICE_TEXTE, POLICE_TITRE, Titre, Tuile } from "../../commun/Primitives";
import { MARGE_SURE, TAILLES_CONTINU } from "../../constantes-continu";
import type { ProprietesPlaquette } from "../../types";

export function A01({ page, hauteur }: ProprietesPlaquette) {
  const p = page as unknown as { titre: string; accent: string; recu: string; envoye: string; bouton: string };
  return (
    <>
      <div style={{ position: "absolute", left: MARGE_SURE, top: 196, width: 920, height: hauteur - 196 - 150, display: "flex", flexDirection: "column" }}>
        <Titre taille={124} texte={p.titre} accent={p.accent} sombre style={{ marginTop: 10 }} />
        <div style={{ marginTop: 44, display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", gap: 18, alignItems: "flex-end" }}>
            <Tuile icone="spark" taille={84} variante="g" />
            <div style={{ ...police(500, TAILLES_CONTINU.bub, 1.3, POLICE_TEXTE), borderRadius: 34, borderBottomLeftRadius: 10, padding: "26px 32px", maxWidth: 620, color: C.creme, background: alpha(C.creme, 0.1), boxShadow: `inset 0 0 0 1.5px ${alpha(C.creme, 0.12)}` }}>
              {p.recu}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 580, alignSelf: "flex-end" }}>
            <Bulle cote="ro">{p.envoye}</Bulle>
          </div>
        </div>
        <div style={{ marginTop: "auto", display: "flex", gap: 20, alignItems: "center" }}>
          <span style={{ background: degrade(150, [C.orangeLumiere, C.orange]), color: C.encre, borderRadius: 999, padding: "24px 30px 24px 44px", ...police(800, 40, 1, POLICE_TITRE), letterSpacing: "-0.02em", display: "flex", gap: 20, alignItems: "center", whiteSpace: "nowrap", boxShadow: `inset 0 2px 0 ${alpha(C.blancCarte, 0.4)}, 0 30px 40px -20px ${alpha(C.orange, 0.6)}` }}>
            {p.bouton}
            <span style={{ width: 74, height: 74, borderRadius: "50%", background: C.encre, color: C.orangeLumiere, display: "grid", placeItems: "center" }}>
              <Icone nom="send" taille={38} epaisseur={2} />
            </span>
          </span>
        </div>
      </div>
      <Pose x={900} y={360}>
        <Etincelle taille={64} />
      </Pose>
    </>
  );
}
