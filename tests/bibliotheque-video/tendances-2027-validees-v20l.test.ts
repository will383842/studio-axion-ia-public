/** TENDANCES-2027-CAT-v20l : 7 effets validés sur planche → `eteint` ; 3 restent `prevu` ; rien n'est permis ni `prod` ; le document généré suit. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOGUE_CAPACITES } from "@/briques/bibliotheque-video/catalogue";
import { LIGNES_TENDANCES_2027 } from "@/briques/bibliotheque-video/catalogue/tendances-2027";
import { PROFILS_DU_CODE } from "@/briques/bibliotheque-video/profils";

const ETEINTES = ["texte.poids-variable", "texte.minimal-dynamique", "fond.verre-depoli", "transition.raccord-forme", "accroche.apercu-fin", "accroche.mot-cle", "rythme.boucle"];
const PREVUES = ["ecran.fenetre-inclinee", "transition.zoom-mot", "mention.ia"];
const etat = (id: string) => CATALOGUE_CAPACITES.find((l) => l.id === id)?.etat;

describe("TENDANCES-2027-CAT-v20l", () => {
  it("(a) les 7 effets validés sur planche sont `eteint` au catalogue", () => {
    for (const id of ETEINTES) expect(etat(id), id).toBe("eteint");
  });
  it("(b) zoom-mot (X1-05), fenêtre inclinée (X1-03) et la mention IA restent `prevu`", () => {
    for (const id of PREVUES) expect(etat(id), id).toBe("prevu");
  });
  it("(c) jamais `prod` ni `permis` : rien n'est branché", () => {
    for (const l of LIGNES_TENDANCES_2027) {
      expect(l.etat === "eteint" || l.etat === "prevu", l.id).toBe(true);
      expect("permis" in l, l.id).toBe(false);
    }
    for (const p of Object.values(PROFILS_DU_CODE)) for (const id of [...ETEINTES, ...PREVUES]) expect(p.capacites[id as never]?.permis === true, `${p.id} ${id}`).toBe(false);
  });
  it("(d) le document généré dit la même chose (régénéré par la commande, jamais à la main)", () => {
    const doc = readFileSync(join(process.cwd(), "docs/bibliotheque-video.md"), "utf8");
    for (const id of ETEINTES) expect(doc, id).toContain(`| \`${id}\` | eteint | X1 |`);
    for (const id of PREVUES) expect(doc, id).toContain(`| \`${id}\` | prevu | X1 |`);
  });
});
