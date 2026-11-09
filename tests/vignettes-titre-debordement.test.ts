/** Le titre d'une vignette ne dépasse JAMAIS la zone sûre : retour à la ligne, puis réduction de taille. */
import { describe, expect, it } from "vitest";
import { MISES } from "../studio-rendu/compositions/commune/vignette/mises";
import { mettreTitreVignette } from "../studio-rendu/compositions/commune/vignette/titre";

const mesure = (texte: string, taille: number) => [...texte].reduce((s, c) => s + (/[IJ.,:;!?'’  ]/.test(c) ? 0.27 : /[MW]/.test(c) ? 0.85 : 0.64), 0) * taille;
const LONGS = ["Collaborateurs perdent chaque semaine", "Facturation impayée recouvrement systématique", "Anticonstitutionnellement responsabilité professionnelle", "Soir, vos rattrapages interminables"];

describe("titre long", () => {
  for (const ratio of ["16:9", "9:16"] as const)
    for (const mise of ["m1", "m2", "m3"] as const)
      it(`aucune ligne ne dépasse la largeur (${ratio} ${mise})`, () => {
        for (const c of LONGS) {
          const t = mettreTitreVignette({ couverture: c, motCle: "", ratio, mise, mesurer: mesure });
          const larg = MISES[ratio][mise].titre.largeur;
          for (const l of t.lignes) expect(mesure(l.map((u) => u.texte).join(" "), t.taillePx), c).toBeLessThanOrEqual(larg);
        }
      });
});
