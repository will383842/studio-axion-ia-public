/** Éléments communs aux cas concrets : zone de contenu (`.main` de la maquette) et étiquette « Scénario type » posée par le code. */
import type { ReactNode } from "react";
import { TEXTES_FIXES_L9 } from "../../../../../../src/briques/visuels/textes-fixes";
import { Etiquette } from "../../commun/Primitives";
import { MARGE_SURE } from "../../constantes-continu";

/** `.main` : padding 52 / 0 / 150 sous l'en-tête (84 + 60), marges sûres de 80 px. */
export function ZoneCas({ hauteur, children }: { hauteur: number; children: ReactNode }) {
  return <div style={{ position: "absolute", left: MARGE_SURE, top: 196, width: 920, height: hauteur - 196 - 150, display: "flex", flexDirection: "column" }}>{children}</div>;
}

export function EtiquetteCas() {
  return (
    <div style={{ marginBottom: 22, display: "flex" }}>
      <Etiquette>{TEXTES_FIXES_L9.t26Etiquette}</Etiquette>
    </div>
  );
}
