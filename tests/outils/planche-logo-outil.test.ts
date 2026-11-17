/**
 * C8-L08 : la planche de la pastille « logo + nom d'outil » (outils/captures-sous-titres/planche-logo-outil.mts) doit
 * montrer ce qu'elle annonce : chaque cas de sa matrice donne une géométrie, et les trois cas « avec logo » ont un logo,
 * « repli texte seul » et « logo trop petit » n'en ont pas, avec la bonne raison. Le script lui-même rend des images
 * (Remotion) et ne s'importe pas : on lit sa source pour reprendre sa matrice et vérifier qu'elle n'utilise que des formes neutres.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { geometriePastilleLogo, type DemandePastilleLogo } from "@/briques/sous-titres/pastille-logo";
import type { DessinLogo } from "@/briques/motion/logos-outils/types";

const SOURCE = readFileSync(join(process.cwd(), "outils/captures-sous-titres/planche-logo-outil.mts"), "utf8");

const TABLE: Record<string, DessinLogo> = {
  "essai-carre": { vue: [0, 0, 24, 24], noeuds: [["path", { d: "M0 0H24V24H0Z" }]] },
  "essai-rond": { vue: [0, 0, 24, 24], noeuds: [["path", { d: "M12 0A12 12 0 1 1 12 24A12 12 0 1 1 12 0Z" }]] },
  "essai-triangle": { vue: [0, 0, 24, 24], noeuds: [["path", { d: "M12 1L23 23H1Z" }]] },
};
const CAS = [
  { nom: "avec-logo", logoId: "essai-carre", taille: 64, logo: true },
  { nom: "avec-logo-rond", logoId: "essai-rond", taille: 64, logo: true },
  { nom: "avec-logo-triangle", logoId: "essai-triangle", taille: 64, logo: true },
  { nom: "repli-texte-seul", logoId: undefined, taille: 64, logo: false, raison: "logo-absent" },
  { nom: "logo-trop-petit", logoId: "essai-carre", taille: 20, logo: false, raison: "trop-petit" },
] as const;
const FORMATS = [[1080, 1920], [1920, 1080]] as const;

describe("planche de la pastille logo + nom d'outil (C8-L08)", () => {
  it("la source déclare les mêmes cas et la même table neutre que ce test", () => {
    for (const c of CAS) expect(SOURCE).toContain(`nom: "${c.nom}"`);
    for (const id of Object.keys(TABLE)) expect(SOURCE).toContain(`"${id}"`);
    expect(SOURCE).toMatch(/geometriePastilleLogo\(demande, TABLE_TEST\)/);
  });

  for (const variante of ["ligne", "autonome"] as const) {
    for (const fondVoulu of ["ivoire", "noir"] as const) {
      for (const [W, H] of FORMATS) {
        it(`${variante} / ${fondVoulu} / ${W}x${H} : chaque cas donne la géométrie attendue`, () => {
          for (const c of CAS) {
            const demande: DemandePastilleLogo = {
              variante, outilId: "chatgpt", logoId: c.logoId, fondsPermis: ["ivoire", "noir"], fondVoulu,
              largeurImage: W, hauteurImage: H, tailleTextePx: (c.taille * W) / 1080,
              ...(variante === "ligne" ? { xCentre: W / 2, yCentre: H * 0.5 } : { zone: "bas" as const }),
            };
            const g = geometriePastilleLogo(demande, TABLE);
            expect(g, c.nom).not.toBeNull();
            expect(g!.avecLogo, c.nom).toBe(c.logo);
            expect(g!.fond).toBe(fondVoulu);
            if (c.logo) expect(g!.logo).not.toBeNull();
            else {
              expect(g!.logo).toBeNull();
              expect(g!.raisonTexteSeul).toBe(c.raison);
            }
            expect(g!.pastille.x).toBeGreaterThanOrEqual(0);
            expect(g!.pastille.x + g!.pastille.w).toBeLessThanOrEqual(W + 1e-6);
            expect(g!.pastille.y + g!.pastille.h).toBeLessThanOrEqual(H + 1e-6);
          }
        });
      }
    }
  }
});
