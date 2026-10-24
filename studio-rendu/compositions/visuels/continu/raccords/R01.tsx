/** Raccord `R01` : sphère orange (`sph()` de la maquette) à cheval sur la couture. */
import { Sphere } from "../commun/Primitives";
import type { ProprietesRaccord } from "../types";

export function R01({ diametre }: ProprietesRaccord) {
  return <Sphere rayon={diametre / 2} />;
}
