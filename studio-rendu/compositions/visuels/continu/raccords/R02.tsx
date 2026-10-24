/** Raccord `R02` : tuile à icône en relief (`tile()` de la maquette), légèrement tournée, à cheval sur la couture. */
import { Tuile } from "../commun/Primitives";
import type { ProprietesRaccord } from "../types";

export function R02({ diametre }: ProprietesRaccord) {
  const taille = Math.round(diametre * 0.78);
  return (
    <div style={{ width: diametre, height: diametre, display: "grid", placeItems: "center" }}>
      <Tuile icone="link" taille={taille} variante="k" style={{ transform: "rotate(-8deg)" }} />
    </div>
  );
}
