/**
 * BOUCLE-TABLEAU-b (X1-18) : la fin du tableau animé peut s'effacer vers la page vide (`finEnBoucle`), ÉTEINT par défaut.
 * Purs, sans `remotion` : les fichiers de `studio-rendu/**` sont lus en TEXTE par un chemin calculé. 0 €.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { proprietesScenes, type EntreeScenes } from "../../src/briques/tableau-scene/proprietes";
import type { MiseEnPageTableau as MiseBrique, SceneCalee } from "../../src/briques/tableau-scene/types";
import { mettreEnPage } from "../../src/moteurs/montage-tableau/mise-en-page";
import { sortiesTemoin, temoinGabarit } from "./gabarit-finitions/temoin";

const sortie = sortiesTemoin(temoinGabarit()).find((s) => s.id === "vertical")!;
const mise = mettreEnPage(sortie.fiche, sortie.options);
const entree = (): EntreeScenes => ({ miseEnPage: mise as unknown as MiseBrique, scenes: sortie.fiche.scenes as SceneCalee[], heures: sortie.elements, stylo: sortie.fiche.stylo, mots: sortie.mots });
const lire = (...p: string[]) => readFileSync(join(process.cwd(), "studio-rendu", "compositions", "tableau", ...p), "utf8");
const sans = (props: ReturnType<typeof proprietesScenes>) =>
  JSON.parse(JSON.stringify(props, (k, v) => (k === "finEnBoucle" ? undefined : v)));

describe("BOUCLE-TABLEAU-b : fin en boucle du tableau animé", () => {
  it("(a) éteint = identique : sans le champ, aucune clé finEnBoucle et même sortie", () => {
    const a = proprietesScenes(entree());
    const b = proprietesScenes({ ...entree() });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(a)).not.toContain("finEnBoucle");
    expect(a.length).toBeGreaterThan(1);
  });
  it("(b) dernière scène seulement ; false / chaîne = identique à (a)", () => {
    const base = proprietesScenes(entree());
    const on = proprietesScenes({ ...entree(), finEnBoucle: true });
    on.forEach((p, i) => expect(p.styleReference?.finEnBoucle, `scène ${i}`).toBe(i === on.length - 1 ? true : undefined));
    expect(sans(on)).toEqual(sans(base));
    for (const v of [false, "true", 1, null]) {
      expect(JSON.stringify(proprietesScenes({ ...entree(), finEnBoucle: v as never }))).toBe(JSON.stringify(base));
    }
  });
  it("(c) jamais vers le noir en boucle, toujours vers le noir sinon (texte)", () => {
    const un = (src: string, motif: string) => expect(src.split(motif).length - 1).toBe(1);
    const r1 = lire("reference", "PageReference.tsx");
    const r3 = lire("reference", "PageReference3.tsx");
    un(r1, 'backgroundColor: r.finEnBoucle ? COULEURS_REFERENCE.fond : "#000000", opacity: fondu');
    un(r3, 'backgroundColor: r.finEnBoucle ? C.fond : "#000000", opacity: fondu');
    const pt = lire("trois-styles", "PageTableau.tsx");
    expect(pt.split("\n")[875]).toBe("      g.fillStyle = `rgba(0,0,0,${f})`;");
    un(pt, "if (f > 0 && !r.finEnBoucle) {");
    un(pt, "if (f > 0 && r.finEnBoucle) {");
    un(pt, "g.globalAlpha = f; g.drawImage(sc.sup.fond, 0, 0); g.globalAlpha = 1;");
  });
  it("(d) même durée de fondu : aucune durée neuve dans les 3 fichiers", () => {
    const p1 = lire("reference", "PageReference.tsx");
    const p3 = lire("reference", "PageReference3.tsx");
    const pt = lire("trois-styles", "PageTableau.tsx");
    expect(p1.match(/FIN_REFERENCE\.fonduImageMs/g)).toHaveLength(2);
    expect(p3.match(/FIN_REFERENCE\.fonduImageMs/g)).toHaveLength(2);
    expect(pt.match(/const f = borne\(\(t \* 1000 - \(r\.finVideoMs - FIN_REFERENCE\.fonduImageMs\)\) \/ FIN_REFERENCE\.fonduImageMs\)/g)).toHaveLength(1);
  });
  it("(e) sans appelant : le moteur du tableau et les services ne posent pas finEnBoucle", () => {
    const parcourir = (d: string): string[] =>
      readdirSync(d).flatMap((n) => {
        const p = join(d, n);
        return statSync(p).isDirectory() ? parcourir(p) : /\.tsx?$/.test(n) ? [p] : [];
      });
    const fichiers = [...parcourir(join(process.cwd(), "src", "moteurs", "montage-tableau")), ...readdirSync(join(process.cwd(), "src", "services")).filter((n) => /^tableau-.*\.ts$/.test(n)).map((n) => join(process.cwd(), "src", "services", n))];
    expect(fichiers.length).toBeGreaterThan(3);
    for (const f of fichiers) expect(readFileSync(f, "utf8"), f).not.toContain("finEnBoucle");
  });
});
