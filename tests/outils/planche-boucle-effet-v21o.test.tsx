/** PLANCHE-BOUCLE-EFFET-v21o : planche « fin avec fondu / fin en boucle » (outil local). Rien n'est allumé, rien n'est lu. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FIN_PROPRE_COMMUNE } from "../../src/briques/composition/fin-propre";
import { decisionBoucleCasConcret } from "../../src/moteurs/montage-cas-concret/boucle-effet";
import { ECRANS_STOCK, PlancheBoucleEffet, opaciteFondFin, vignettesBoucle, vignettesFondu } from "../../outils/boucle-effet/PlancheBoucleEffet";

const RACINE = join(__dirname, "..", "..");
const lire = (p: string) => readFileSync(join(RACINE, p), "utf8");
function fichiers(dossier: string): string[] {
  return readdirSync(join(RACINE, dossier)).flatMap((n) => {
    const rel = `${dossier}/${n}`;
    if (n === "node_modules" || n.startsWith(".")) return [];
    return statSync(join(RACINE, rel)).isDirectory() ? fichiers(rel) : /\.(ts|tsx|mts)$/.test(n) ? [rel] : [];
  });
}
const rendre = (variante: "fondu" | "boucle", format?: "16x9" | "9x16") => renderToStaticMarkup(createElement(PlancheBoucleEffet, { variante, format }));
const opacites = (h: string): number[] => [...h.matchAll(/data-opacite="([0-9.]+)"/g)].map((m) => Number(m[1]));

describe("PLANCHE-BOUCLE-EFFET-v21o", () => {
  it("(a) même entrée = même balisage, pour chaque variante et chaque format", () => {
    for (const v of ["fondu", "boucle"] as const) for (const f of ["16x9", "9x16"] as const) expect(rendre(v, f)).toBe(rendre(v, f));
  });

  it("(b) boucle : le mot « boucle » et l'état final rendu par decisionBoucleCasConcret(ECRANS_STOCK)", () => {
    const d = decisionBoucleCasConcret(ECRANS_STOCK);
    expect(d.boucle).toBe(true);
    const h = rendre("boucle");
    expect(h).toContain('data-decision="boucle"');
    if (d.boucle) expect(h).toContain(d.raccord.etatFinal);
    expect(vignettesBoucle().map((v) => v.id)).toEqual(["derniere", "premiere"]);
    expect(opacites(h)).toEqual([0, 0]);
  });

  it("(c) fondu : 4 vignettes de fin dont l'opacité vaut 0, 0, ~0,5, 1 (depuis FIN_PROPRE_COMMUNE), puis le tour suivant à 0", () => {
    const { tenueSec, fonduSec } = FIN_PROPRE_COMMUNE;
    expect(opaciteFondFin(0)).toBe(0);
    expect(opaciteFondFin(tenueSec)).toBe(0);
    expect(opaciteFondFin(tenueSec + fonduSec / 2)).toBeCloseTo(0.5, 5);
    expect(opaciteFondFin(tenueSec + fonduSec)).toBe(1);
    expect(opaciteFondFin(tenueSec + fonduSec + 5)).toBe(1);
    const v = vignettesFondu();
    expect(v).toHaveLength(5);
    expect(v.slice(0, 4).map((x) => Number(x.opacite.toFixed(2)))).toEqual([0, 0, 0.5, 1]);
    expect(opacites(rendre("fondu"))).toEqual([0, 0, 0.5, 1, 0]);
  });

  it("(d) les deux bouts du stock ont le même fond ; aucune personne ; texte en Manrope ; couleur de fin de l'export", () => {
    expect(ECRANS_STOCK[0]!.fond).toBe(ECRANS_STOCK[ECRANS_STOCK.length - 1]!.fond);
    const h = rendre("fondu");
    expect(h).toContain("Manrope");
    expect(h).toContain(FIN_PROPRE_COMMUNE.couleur.replace("0x", "#"));
    expect(h.toLowerCase()).not.toMatch(/visage|<img|face-camera/);
  });

  it("(e) gardes statiques : rien d'interdit, finally/rmSync, sortie locale, aucun importeur dans src/ ni studio-rendu/", () => {
    for (const f of ["outils/boucle-effet/PlancheBoucleEffet.tsx", "outils/boucle-effet/planche.mts"]) {
      expect(lire(f), f).not.toMatch(/reglages|depots|process\.env|fetch\(|mention-ia|MentionIA|fins\/boucle/i);
      expect(lire(f), f).not.toMatch(/from ["'][^"']*studio-rendu/);
    }
    const s = lire("outils/boucle-effet/planche.mts");
    expect(s).toMatch(/finally\s*\{[^}]*rmSync/);
    expect(s).toContain('"captures", "boucle-effet"');
    for (const f of [...fichiers("src"), ...fichiers("studio-rendu")]) expect(lire(f), f).not.toMatch(/outils\/boucle-effet|PlancheBoucleEffet/);
  });
});
