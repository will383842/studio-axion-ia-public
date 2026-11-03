/** S02 · Conversation (page sombre) : quatre bulles, l'assistant à gauche en verre, vous à droite ; une tuile par message. */
import type { CSSProperties } from "react";
import { alpha, CHARTE_CONTINU as C } from "../../../../../../src/briques/visuels/charte-carrousel";
import { Bulle, police, POLICE_TEXTE, Titre, Tuile } from "../../commun/Primitives";
import { TAILLES_CONTINU } from "../../constantes-continu";
import type { ProprietesPlaquette } from "../../types";
import { EtiquetteCas, ZoneCas } from "./commun-cas";

/** `.bub.l` posée sur fond sombre (style `gl` de la maquette) : verre crème, coin bas gauche resserré. */
const VERRE: CSSProperties = { borderRadius: 34, borderBottomLeftRadius: 10, padding: "26px 32px", maxWidth: 760, ...police(500, TAILLES_CONTINU.bub, 1.3, POLICE_TEXTE), background: alpha(C.creme, 0.1), boxShadow: `inset 0 0 0 1.5px ${alpha(C.creme, 0.12)}`, color: C.creme };
/** `.bub.r` sur fond sombre : crème sur encre inversée. */
const CREME: CSSProperties = { borderRadius: 34, borderBottomRightRadius: 10, padding: "26px 32px", maxWidth: 760, ...police(500, TAILLES_CONTINU.bub, 1.3, POLICE_TEXTE), background: C.creme, color: C.encre };

const LIGNE: CSSProperties = { display: "flex", gap: 18, alignItems: "flex-end" };

export function S02({ page, hauteur }: ProprietesPlaquette) {
  return (
    <ZoneCas hauteur={hauteur}>
      <EtiquetteCas />
      <Titre taille={96} texte={String(page.titre)} accent={String(page.accent)} sombre style={{ marginBottom: 44 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={LIGNE}>
          <Tuile icone="spark" taille={80} variante="g" />
          <div style={VERRE}>{String(page.question)}</div>
        </div>
        <div style={{ ...LIGNE, justifyContent: "flex-end" }}>
          <Bulle cote="ro">{String(page.reponse)}</Bulle>
          <Tuile icone="users" taille={80} variante="w" />
        </div>
        <div style={LIGNE}>
          <Tuile icone="spark" taille={80} variante="g" />
          <div style={VERRE}>{String(page.pret)}</div>
        </div>
        <div style={{ ...LIGNE, justifyContent: "flex-end" }}>
          <div style={CREME}>{String(page.validation)}</div>
          <Tuile icone="check" taille={80} variante="o" />
        </div>
      </div>
    </ZoneCas>
  );
}
