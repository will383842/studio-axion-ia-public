/** Raccord `R03` : grande étincelle (`spk()` de la maquette) et sa petite sœur, à cheval sur la couture. */
import { CHARTE_CONTINU as C } from "../../../../../src/briques/visuels/charte-carrousel";
import { Etincelle } from "../commun/Primitives";
import type { ProprietesRaccord } from "../types";

export function R03({ diametre }: ProprietesRaccord) {
  return (
    <div style={{ width: diametre, height: diametre, position: "relative" }}>
      <Etincelle taille={diametre} />
      <div style={{ position: "absolute", right: -diametre * 0.12, top: -diametre * 0.08 }}>
        <Etincelle taille={Math.round(diametre * 0.22)} couleur={C.encre} />
      </div>
    </div>
  );
}
