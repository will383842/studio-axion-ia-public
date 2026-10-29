/**
 * Grands vides (issue 119) : correctifs 2 à 4 de la mise en scène. (Le correctif 1 est testé dans `filet-zero-blocage.test.ts`.)
 *  2. un moment dont les blocs cités ont déjà été montrés rappelle ces blocs au lieu de ne laisser que l'en-tête ;
 *  3. (voir plus bas) la toile montre les blocs déjà vus quel que soit le code d'apparition ;
 *  4. la nuée apparaît au plus tard 2 s après le début de son écran.
 */
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { FicheImage } from "@/domaine/image-video/fiche";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { BRUITAGES_V4_IV } from "@/moteurs/montage-image-video/fabrication";
import { planDesFinsIV } from "@/moteurs/montage-image-video/fins";
import { calculerScene } from "../../studio-rendu/compositions/image-video/plan";
import { Toile } from "../../studio-rendu/compositions/image-video/Toile";
import { mettreEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { carteFixe } from "./doubles-fabrication";

const exiger = createRequire(join(process.cwd(), "studio-rendu/package.json"));
const { createElement } = exiger("react") as typeof import("react");
const { renderToStaticMarkup } = exiger("react-dom/server") as typeof import("react-dom/server");

function entreeC(fiche: FicheImage, nom: "C" | "D" = "C") {
  const carte = carteFixe(nom);
  const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins.find((f) => f.reseaux.includes("youtube-shorts" as never))!;
  return { carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: BRUITAGES_V4_IV };
}

describe("correctif 2 : un moment dont les blocs cités sont déjà montrés les rappelle", () => {
  it("deuxième écran « email » qui cite le même bloc : il garde un champ au lieu du seul en-tête", () => {
    const f = structuredClone(FICHES_SIMULEES["essai-c"]);
    const par = (id: string) => f.ecrans.find((e) => e.id === id)!;
    par("e11").scene = "toile";
    par("e11").refs = [];
    Object.assign(par("e12"), { scene: "email", refs: ["n07", "l07"] });
    Object.assign(par("e13"), { scene: "email", refs: ["n07", "l07"] });
    for (const e of f.ecrans) e.surMot = e.surMot.filter((s) => !s.ref || e.refs.includes(s.ref));
    const r = mettreEnSceneIV(entreeC(f));
    const champs = (ecran: string) => r.ligne.evenements.filter((x) => x.ecran === ecran && x.genre === "frappe" && x.ref === "n07" && x.visible);
    expect(champs("e12").length).toBeGreaterThan(0);
    expect(champs("e13").length).toBeGreaterThan(0);
  });
});

describe("correctif 3 : la toile montre les blocs déjà vus quel que soit le code d'apparition", () => {
  it("sans variété (rendu APP-A), un bloc de `dejaVus` est dessiné « vu » ; sans `dejaVus`, il reste absent", () => {
    const r = mettreEnSceneIV(entreeC(FICHES_SIMULEES["essai-c"]));
    const b = r.ligne.blocs.find((x) => x.sorte === "toile" && (x.proprietes.dejaVus ?? []).length > 0);
    expect(b?.sorte).toBe("toile");
    if (b?.sorte !== "toile") return;
    const scene = calculerScene(b.proprietes);
    const html = (dejaVus?: string[]) => renderToStaticMarkup(createElement(Toile, { scene, schema: b.proprietes.schema, t: 0, ...(dejaVus ? { dejaVus } : {}) }));
    expect(html(b.proprietes.dejaVus)).not.toBe(html());
  });
});

describe("correctif 4 : la nuée apparaît au plus tard 2 s après le début de son écran", () => {
  it("D : `apparition` de chaque nuée ≤ 2 s après son début, sur les 5 réseaux, même quand la source n'est dite que tard dans l'écran", () => {
    let nuees = 0;
    for (const reseau of RESEAUX_IV) {
      const carte = carteFixe("D");
      const fiche = structuredClone(FICHES_SIMULEES["essai-d"]);
      const ecran = fiche.ecrans.find((e) => e.scene === "nuee")!;
      ecran.texteDit = `Et donc, regardez bien, tout ceci se passe très vite, dès le matin, sans que vous leviez le petit doigt. ${ecran.texteDit}`;
      const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins.find((f) => f.reseaux.includes(reseau))!;
      const r = mettreEnSceneIV({ carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: BRUITAGES_V4_IV });
      for (const o of r.ligne.blocs.flatMap((b) => (b.sorte === "objets" ? b.objets : []))) {
        if (o.sorte !== "nuee") continue;
        nuees++;
        expect(o.proprietes.apparition).toBeGreaterThanOrEqual(o.debut - 1e-9);
        expect(o.proprietes.apparition).toBeLessThanOrEqual(o.debut + 2 + 1e-9);
      }
    }
    expect(nuees).toBeGreaterThan(0);
  });
});
